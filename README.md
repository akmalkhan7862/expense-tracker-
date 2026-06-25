# Spendwise — Expense Tracker

A full-stack expense tracker with a Flask (Python) backend and SQLite database.

## Features
- 📊 Dashboard with donut chart (by category) and bar chart (daily spending)
- ➕ Add, edit, delete expenses
- 🏷️ 9 expense categories with colour coding
- 📅 Month-by-month filtering
- 💾 Persistent SQLite storage — no config needed
- 📱 Responsive sidebar layout

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the server
python app.py
```

Then open **http://localhost:5000** in your browser.

## Project Structure

```
expense-tracker/
├── app.py              # Flask backend (REST API + SQLite)
├── requirements.txt
├── expenses.db         # Auto-created on first run
├── templates/
│   └── index.html      # Single-page HTML template
└── static/
    ├── css/style.css
    └── js/app.js
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expenses?month=YYYY-MM&category=X` | List expenses |
| POST | `/api/expenses` | Add expense |
| PUT | `/api/expenses/<id>` | Update expense |
| DELETE | `/api/expenses/<id>` | Delete expense |
| GET | `/api/summary?month=YYYY-MM` | Summary + chart data |
