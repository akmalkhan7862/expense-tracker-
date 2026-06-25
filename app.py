from flask import Flask, request, jsonify, render_template  # type: ignore[reportMissingImports]
import sqlite3
import os
from datetime import datetime, date
from collections import defaultdict

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "expenses.db")

CATEGORIES = [
    "Food & Dining", "Transport", "Shopping", "Housing",
    "Health", "Entertainment", "Travel", "Education", "Other"
]

CATEGORY_COLORS = {
    "Food & Dining":   "#00D4AA",
    "Transport":       "#F5A623",
    "Shopping":        "#7C6FED",
    "Housing":         "#E8526A",
    "Health":          "#36B5FF",
    "Entertainment":   "#FF6B6B",
    "Travel":          "#54D98C",
    "Education":       "#FFB347",
    "Other":           "#9EA8B8",
}

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                date TEXT NOT NULL,
                note TEXT DEFAULT ''
            )
        """)
        conn.commit()
        # Seed sample data if empty
        count = conn.execute("SELECT COUNT(*) FROM expenses").fetchone()[0]
        if count == 0:
            today = date.today()
            samples = [
                ("Grocery run", 2450, "Food & Dining", str(today), "Weekly groceries"),
                ("Metro pass", 800, "Transport", str(today), "Monthly pass"),
                ("Netflix", 649, "Entertainment", str(today), "Subscription"),
                ("Electricity bill", 1800, "Housing", str(today), "June bill"),
                ("Lunch with team", 650, "Food & Dining", str(today), ""),
                ("Books", 950, "Education", str(today), "Python & Data Science"),
            ]
            conn.executemany(
                "INSERT INTO expenses (title, amount, category, date, note) VALUES (?,?,?,?,?)",
                samples
            )
            conn.commit()

@app.route("/")
def index():
    return render_template("index.html", categories=CATEGORIES, colors=CATEGORY_COLORS)

@app.route("/api/expenses", methods=["GET"])
def get_expenses():
    month = request.args.get("month")  # YYYY-MM
    category = request.args.get("category")
    with get_db() as conn:
        query = "SELECT * FROM expenses WHERE 1=1"
        params = []
        if month:
            query += " AND strftime('%Y-%m', date) = ?"
            params.append(month)
        if category and category != "All":
            query += " AND category = ?"
            params.append(category)
        query += " ORDER BY date DESC, id DESC"
        rows = conn.execute(query, params).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/expenses", methods=["POST"])
def add_expense():
    data = request.json
    if not data.get("title") or not data.get("amount") or not data.get("category"):
        return jsonify({"error": "Missing required fields"}), 400
    try:
        amount = float(data["amount"])
        if amount <= 0:
            raise ValueError
    except ValueError:
        return jsonify({"error": "Invalid amount"}), 400

    expense_date = data.get("date") or str(date.today())
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO expenses (title, amount, category, date, note) VALUES (?,?,?,?,?)",
            (data["title"], amount, data["category"], expense_date, data.get("note", ""))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM expenses WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201

@app.route("/api/expenses/<int:eid>", methods=["DELETE"])
def delete_expense(eid):
    with get_db() as conn:
        conn.execute("DELETE FROM expenses WHERE id=?", (eid,))
        conn.commit()
    return jsonify({"deleted": eid})

@app.route("/api/expenses/<int:eid>", methods=["PUT"])
def update_expense(eid):
    data = request.json
    with get_db() as conn:
        conn.execute(
            "UPDATE expenses SET title=?, amount=?, category=?, date=?, note=? WHERE id=?",
            (data["title"], float(data["amount"]), data["category"], data["date"], data.get("note",""), eid)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM expenses WHERE id=?", (eid,)).fetchone()
    return jsonify(dict(row))

@app.route("/api/summary", methods=["GET"])
def summary():
    month = request.args.get("month")
    with get_db() as conn:
        query = "SELECT * FROM expenses WHERE 1=1"
        params = []
        if month:
            query += " AND strftime('%Y-%m', date) = ?"
            params.append(month)
        rows = conn.execute(query, params).fetchall()

    total = sum(r["amount"] for r in rows)
    by_category = defaultdict(float)
    for r in rows:
        by_category[r["category"]] += r["amount"]

    # Daily spending for sparkline (last 30 days or current month)
    daily = defaultdict(float)
    for r in rows:
        daily[r["date"]] += r["amount"]

    return jsonify({
        "total": total,
        "count": len(rows),
        "by_category": [
            {
                "category": cat,
                "amount": amt,
                "color": CATEGORY_COLORS.get(cat, "#9EA8B8"),
                "pct": round(amt / total * 100, 1) if total else 0
            }
            for cat, amt in sorted(by_category.items(), key=lambda x: -x[1])
        ],
        "daily": [{"date": d, "amount": a} for d, a in sorted(daily.items())]
    })

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
