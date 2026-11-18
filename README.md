# Personal Finance Tracker

> A simple yet powerful web app to track income, expenses, and budgets.
> Built with **Flask**, **HTML**, **CSS**, and **Vanilla JavaScript**.

![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- ✅ Add, list, and delete income / expense transactions
- 📁 Predefined categories (Food, Transport, Housing, …)
- 📅 Month filter — see only the transactions of a chosen month
- 💰 Summary cards: total income, expenses, and balance
- 📊 Interactive doughnut chart of expenses by category (Chart.js)
- 🎯 Monthly budgets per category with visual progress bars
  (green → yellow → red as you approach / exceed the limit)
- 💾 Data persisted in SQLite
- 📱 Responsive UI (works on mobile)

## 🛠 Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Backend   | Python 3.9+, Flask 3.0            |
| Frontend  | HTML5, CSS3, Vanilla JavaScript   |
| Database  | SQLite (built into Python)        |
| Charting  | Chart.js (via CDN)                |

## 📦 Project structure

```
personal-finance-tracker/
├── app.py              # Flask app + REST API
├── requirements.txt
├── templates/
│   └── index.html
└── static/
    ├── css/style.css
    └── js/app.js
```

## 🚀 Installation

```bash
# 1. Clone
git clone https://github.com/<your-username>/personal-finance-tracker.git
cd personal-finance-tracker

# 2. Create & activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run
flask run
# or: python app.py
```

Open <http://127.0.0.1:5000> in your browser.
The SQLite database `finance.db` is created automatically on first run.

## 📖 Usage

1. Pick a month in the header — everything below reflects that month.
2. Fill the **Add Transaction** form, choose Expense or Income, and click **Add**.
3. Set a **Budget** per category in the right column to track overspending.
4. Watch the doughnut chart and progress bars update in real time.
5. Hover any chart slice to see exact amounts.

## 🔌 API reference

| Method | Endpoint                    | Description                          |
|--------|-----------------------------|--------------------------------------|
| GET    | `/api/categories`           | Lists income & expense categories    |
| GET    | `/api/transactions?month=`  | List transactions (optional filter)  |
| POST   | `/api/transactions`         | Create a transaction                 |
| PUT    | `/api/transactions/<id>`    | Update a transaction                 |
| DELETE | `/api/transactions/<id>`    | Delete a transaction                 |
| GET    | `/api/budgets`              | List budgets                         |
| POST   | `/api/budgets`              | Create or update a budget            |
| DELETE | `/api/budgets/<id>`         | Delete a budget                      |
| GET    | `/api/stats?month=`         | Summary statistics for a given month |

Example `POST /api/transactions` body:

```json
{
  "type": "expense",
  "amount": 42.50,
  "category": "Food",
  "description": "Lunch",
  "date": "2024-05-17"
}
```

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file.
