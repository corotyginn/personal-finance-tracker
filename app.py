import os
import sqlite3
from datetime import datetime

from flask import Flask, g, jsonify, render_template, request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "finance.db")

app = Flask(__name__)

EXPENSE_CATEGORIES = [
    "Food", "Transport", "Housing", "Entertainment",
    "Health", "Shopping", "Education", "Utilities", "Other",
]
INCOME_CATEGORIES = ["Salary", "Freelance", "Investment", "Gift", "Other"]


# ---------- Database ----------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with sqlite3.connect(DATABASE) as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS transactions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                type        TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                amount      REAL NOT NULL CHECK(amount > 0),
                category    TEXT NOT NULL,
                description TEXT DEFAULT '',
                date        TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS budgets (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL UNIQUE,
                amount   REAL NOT NULL CHECK(amount >= 0)
            );
            """
        )


# ---------- Helpers ----------
def validate_transaction(data):
    if data.get("type") not in ("income", "expense"):
        return "type must be 'income' or 'expense'"
    try:
        if float(data.get("amount")) <= 0:
            return "amount must be > 0"
    except (TypeError, ValueError):
        return "amount must be a number"
    if not str(data.get("category") or "").strip():
        return "category is required"
    try:
        datetime.strptime(str(data.get("date") or ""), "%Y-%m-%d")
    except (ValueError, TypeError):
        return "date must be YYYY-MM-DD"
    return None


# ---------- Routes ----------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/categories")
def api_categories():
    return jsonify({"expense": EXPENSE_CATEGORIES, "income": INCOME_CATEGORIES})


@app.route("/api/transactions", methods=["GET"])
def list_transactions():
    month = request.args.get("month")
    db = get_db()
    if month:
        rows = db.execute(
            "SELECT * FROM transactions WHERE substr(date, 1, 7) = ? "
            "ORDER BY date DESC, id DESC",
            (month,),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM transactions ORDER BY date DESC, id DESC"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/transactions", methods=["POST"])
def create_transaction():
    data = request.get_json(force=True) or {}
    err = validate_transaction(data)
    if err:
        return jsonify({"error": err}), 400

    payload = (
        data["type"],
        float(data["amount"]),
        str(data["category"]).strip(),
        str(data.get("description") or "").strip()[:200],
        str(data["date"]),
    )
    db = get_db()
    cur = db.execute(
        "INSERT INTO transactions (type, amount, category, description, date) "
        "VALUES (?, ?, ?, ?, ?)",
        payload,
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM transactions WHERE id = ?", (cur.lastrowid,)
    ).fetchone()
    return jsonify(dict(row)), 201


@app.route("/api/transactions/<int:tid>", methods=["PUT"])
def update_transaction(tid):
    data = request.get_json(force=True) or {}
    err = validate_transaction(data)
    if err:
        return jsonify({"error": err}), 400

    db = get_db()
    db.execute(
        "UPDATE transactions SET type = ?, amount = ?, category = ?, "
        "description = ?, date = ? WHERE id = ?",
        (
            data["type"],
            float(data["amount"]),
            str(data["category"]).strip(),
            str(data.get("description") or "").strip()[:200],
            str(data["date"]),
            tid,
        ),
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM transactions WHERE id = ?", (tid,)
    ).fetchone()
    if row is None:
        return jsonify({"error": "Not found"}), 404
    return jsonify(dict(row))


@app.route("/api/transactions/<int:tid>", methods=["DELETE"])
def delete_transaction(tid):
    db = get_db()
    db.execute("DELETE FROM transactions WHERE id = ?", (tid,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/budgets", methods=["GET"])
def list_budgets():
    rows = get_db().execute(
        "SELECT * FROM budgets ORDER BY category"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/budgets", methods=["POST"])
def upsert_budget():
    data = request.get_json(force=True) or {}
    category = str(data.get("category") or "").strip()
    if not category:
        return jsonify({"error": "category is required"}), 400
    try:
        amount = float(data.get("amount"))
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a number"}), 400
    if amount < 0:
        return jsonify({"error": "amount must be >= 0"}), 400

    db = get_db()
    db.execute(
        "INSERT INTO budgets (category, amount) VALUES (?, ?) "
        "ON CONFLICT(category) DO UPDATE SET amount = excluded.amount",
        (category, amount),
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM budgets WHERE category = ?", (category,)
    ).fetchone()
    return jsonify(dict(row))


@app.route("/api/budgets/<int:bid>", methods=["DELETE"])
def delete_budget(bid):
    db = get_db()
    db.execute("DELETE FROM budgets WHERE id = ?", (bid,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/stats", methods=["GET"])
def stats():
    month = request.args.get("month") or datetime.now().strftime("%Y-%m")
    db = get_db()

    income = db.execute(
        "SELECT COALESCE(SUM(amount), 0) AS s FROM transactions "
        "WHERE type = 'income' AND substr(date, 1, 7) = ?",
        (month,),
    ).fetchone()["s"]

    expenses = db.execute(
        "SELECT COALESCE(SUM(amount), 0) AS s FROM transactions "
        "WHERE type = 'expense' AND substr(date, 1, 7) = ?",
        (month,),
    ).fetchone()["s"]

    by_category = db.execute(
        "SELECT category, SUM(amount) AS total FROM transactions "
        "WHERE type = 'expense' AND substr(date, 1, 7) = ? "
        "GROUP BY category ORDER BY total DESC",
        (month,),
    ).fetchall()

    budget_rows = db.execute("SELECT category, amount FROM budgets").fetchall()
    budget_map = {b["category"]: b["amount"] for b in budget_rows}
    spent_map = {r["category"]: r["total"] for r in by_category}

    budget_status = []
    for cat, limit in budget_map.items():
        spent = spent_map.get(cat, 0)
        budget_status.append({
            "category": cat,
            "limit": limit,
            "spent": spent,
            "remaining": limit - spent,
            "percent": (spent / limit * 100) if limit > 0 else 0,
        })
    budget_status.sort(key=lambda x: x["percent"], reverse=True)

    return jsonify({
        "month": month,
        "income": income,
        "expenses": expenses,
        "balance": income - expenses,
        "by_category": [dict(r) for r in by_category],
        "budgets": budget_status,
    })


init_db()

if __name__ == "__main__":
    app.run(debug=True)
