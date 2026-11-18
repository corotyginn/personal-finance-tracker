(() => {
    'use strict';

    const $ = (sel) => document.querySelector(sel);

    const localMonth = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    const localDate = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const state = {
        month: localMonth(),
        categories: { expense: [], income: [] },
        transactions: [],
        budgets: [],
        stats: null,
        chart: null,
    };

    const fmt = (n) =>
        '$' + Number(n || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    const esc = (s) =>
        String(s ?? '').replace(/[&<>"']/g, (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    async function api(path, opts = {}) {
        const res = await fetch(path, {
            headers: { 'Content-Type': 'application/json' },
            ...opts,
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Request failed: ${res.status}`);
        }
        return res.json();
    }

    // ---------- Init ----------
    async function init() {
        const monthInput = $('#month');
        monthInput.value = state.month;
        monthInput.addEventListener('change', () => {
            state.month = monthInput.value || state.month;
            loadAll();
        });

        $('#tx-type').addEventListener('change', populateCategorySelect);
        $('#tx-form').addEventListener('submit', onSubmitTransaction);
        $('#budget-form').addEventListener('submit', onSubmitBudget);
        $('#tx-date').value = localDate();

        try {
            state.categories = await api('/api/categories');
        } catch (e) {
            console.error(e);
        }
        populateCategorySelect();
        populateBudgetSelect();
        await loadAll();
    }

    function populateCategorySelect() {
        const type = $('#tx-type').value;
        const list = state.categories[type] || [];
        $('#tx-category').innerHTML = list
            .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
            .join('');
    }

    function populateBudgetSelect() {
        $('#budget-category').innerHTML = state.categories.expense
            .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
            .join('');
    }

    async function loadAll() {
        await Promise.all([loadTransactions(), loadBudgets(), loadStats()]);
    }

    async function loadTransactions() {
        try {
            state.transactions = await api(
                `/api/transactions?month=${encodeURIComponent(state.month)}`
            );
        } catch (e) {
            console.error(e);
            state.transactions = [];
        }
        renderTransactions();
    }

    async function loadBudgets() {
        try {
            state.budgets = await api('/api/budgets');
        } catch (e) {
            console.error(e);
            state.budgets = [];
        }
    }

    async function loadStats() {
        try {
            state.stats = await api(
                `/api/stats?month=${encodeURIComponent(state.month)}`
            );
        } catch (e) {
            console.error(e);
            state.stats = null;
        }
        renderSummary();
        renderChart();
        renderBudgets();
    }

    // ---------- Render ----------
    function renderSummary() {
        const s = state.stats || { income: 0, expenses: 0, balance: 0 };
        $('#sum-income').textContent = fmt(s.income);
        $('#sum-expenses').textContent = fmt(s.expenses);
        const bal = $('#sum-balance');
        bal.textContent = fmt(s.balance);
        bal.style.color = s.balance < 0 ? 'var(--expense)' : '';
    }

    function renderTransactions() {
        const list = $('#tx-list');
        const empty = $('#tx-empty');
        list.innerHTML = '';
        if (!state.transactions.length) {
            empty.hidden = false;
            return;
        }
        empty.hidden = true;
        const frag = document.createDocumentFragment();
        for (const tx of state.transactions) {
            const li = document.createElement('li');
            li.className = `tx-item ${tx.type}`;
            li.innerHTML = `
                <span class="tx-cat">${esc(tx.category)}</span>
                <div class="tx-desc">
                    <strong>${esc(tx.description || tx.category)}</strong>
                    <small>${esc(tx.date)}</small>
                </div>
                <span class="tx-amount">${tx.type === 'expense' ? '-' : '+'}${fmt(tx.amount)}</span>
                <button class="tx-delete" title="Delete" data-id="${tx.id}">×</button>
            `;
            frag.appendChild(li);
        }
        list.appendChild(frag);
        list.querySelectorAll('.tx-delete').forEach((btn) =>
            btn.addEventListener('click', () => deleteTransaction(btn.dataset.id))
        );
    }

    function renderChart() {
        const canvas = $('#categoryChart');
        const empty = $('#chart-empty');
        const byCat = state.stats?.by_category || [];

        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }

        if (!byCat.length) {
            empty.hidden = false;
            canvas.style.display = 'none';
            return;
        }
        empty.hidden = true;
        canvas.style.display = '';

        const palette = [
            '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
            '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
        ];

        state.chart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: byCat.map((r) => r.category),
                datasets: [{
                    data: byCat.map((r) => r.total),
                    backgroundColor: byCat.map((_, i) => palette[i % palette.length]),
                    borderWidth: 2,
                    borderColor: '#fff',
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 12 } },
                    },
                    tooltip: {
                        callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt(ctx.parsed)}` },
                    },
                },
            },
        });
    }

    function renderBudgets() {
        const list = $('#budget-list');
        const empty = $('#budget-empty');
        const stats = state.stats?.budgets || [];
        list.innerHTML = '';

        if (!stats.length) {
            empty.hidden = false;
            return;
        }
        empty.hidden = true;

        const frag = document.createDocumentFragment();
        for (const b of stats) {
            const pct = Math.min(b.percent, 100);
            const cls = b.percent > 100 ? 'over' : b.percent > 80 ? 'warn' : '';
            const li = document.createElement('li');
            li.className = 'budget-item';
            li.innerHTML = `
                <div class="budget-head">
                    <strong>${esc(b.category)}</strong>
                    <span>${fmt(b.spent)} / ${fmt(b.limit)}</span>
                    <button data-cat="${esc(b.category)}" title="Remove">×</button>
                </div>
                <div class="progress ${cls}"><div style="width:${pct}%"></div></div>
            `;
            frag.appendChild(li);
        }
        list.appendChild(frag);
        list.querySelectorAll('.budget-head button').forEach((btn) =>
            btn.addEventListener('click', () => deleteBudget(btn.dataset.cat))
        );
    }

    // ---------- Handlers ----------
    async function onSubmitTransaction(e) {
        e.preventDefault();
        const errEl = $('#form-error');
        errEl.hidden = true;

        const payload = {
            type: $('#tx-type').value,
            amount: $('#tx-amount').value,
            category: $('#tx-category').value,
            description: $('#tx-description').value.trim(),
            date: $('#tx-date').value,
        };

        try {
            await api('/api/transactions', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            $('#tx-form').reset();
            $('#tx-date').value = localDate();
            populateCategorySelect();
            await loadAll();
        } catch (err) {
            errEl.textContent = err.message;
            errEl.hidden = false;
        }
    }

    async function deleteTransaction(id) {
        if (!confirm('Delete this transaction?')) return;
        try {
            await api(`/api/transactions/${id}`, { method: 'DELETE' });
            await loadAll();
        } catch (err) {
            alert(err.message);
        }
    }

    async function onSubmitBudget(e) {
        e.preventDefault();
        try {
            await api('/api/budgets', {
                method: 'POST',
                body: JSON.stringify({
                    category: $('#budget-category').value,
                    amount: $('#budget-amount').value,
                }),
            });
            $('#budget-amount').value = '';
            await loadBudgets();
            await loadStats();
        } catch (err) {
            alert(err.message);
        }
    }

    async function deleteBudget(category) {
        const b = state.budgets.find((x) => x.category === category);
        if (!b) return;
        if (!confirm(`Remove budget for ${category}?`)) return;
        try {
            await api(`/api/budgets/${b.id}`, { method: 'DELETE' });
            await loadBudgets();
            await loadStats();
        } catch (err) {
            alert(err.message);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
