/* ── STATE ── */
let currentMonth = new Date().toISOString().slice(0, 7);
let editingId = null;
let selectedCategory = "";
let allExpenses = [];

/* ── UTILS ── */
const fmt = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const today = () => new Date().toISOString().split("T")[0];

function catInitials(cat) {
  return cat.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

/* ── NAVIGATION ── */
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("view-" + btn.dataset.view).classList.add("active");
    if (btn.dataset.view === "expenses") loadExpenses();
    if (btn.dataset.view === "dashboard") loadDashboard();
  });
});

/* ── MONTH PICKER ── */
const monthInput = document.getElementById("globalMonth");
monthInput.value = currentMonth;
monthInput.addEventListener("change", () => {
  currentMonth = monthInput.value;
  loadDashboard();
  loadExpenses();
});

/* ── DASHBOARD ── */
async function loadDashboard() {
  const [summary, expenses] = await Promise.all([
    fetch(`/api/summary?month=${currentMonth}`).then(r => r.json()),
    fetch(`/api/expenses?month=${currentMonth}`).then(r => r.json()),
  ]);

  // Month label
  const d = new Date(currentMonth + "-01");
  document.getElementById("dashMonth").textContent = d.toLocaleString("default", { month: "long", year: "numeric" });

  // Stats
  document.getElementById("totalSpent").textContent = fmt(summary.total);
  document.getElementById("totalCount").textContent = `${summary.count} transaction${summary.count !== 1 ? "s" : ""}`;

  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const today_date = new Date();
  const daysPassed = d.getMonth() === today_date.getMonth() && d.getFullYear() === today_date.getFullYear()
    ? today_date.getDate() : daysInMonth;
  document.getElementById("avgDay").textContent = fmt(summary.total / (daysPassed || 1));

  const top = summary.by_category[0];
  document.getElementById("topCategory").textContent = top ? top.category : "—";
  document.getElementById("topCatAmt").textContent = top ? fmt(top.amount) : "₹0";

  // Donut
  drawDonut(summary.by_category);
  document.getElementById("donutTotal").textContent = fmt(summary.total);

  // Legend
  const legend = document.getElementById("legend");
  legend.innerHTML = summary.by_category.slice(0, 6).map(c => `
    <div class="legend-item">
      <div class="legend-left">
        <div class="legend-dot" style="background:${c.color}"></div>
        <span class="legend-cat">${c.category}</span>
      </div>
      <span class="legend-pct">${c.pct}%</span>
    </div>
  `).join("");

  // Bar chart
  drawBar(summary.daily, currentMonth);

  // Recent transactions
  const list = document.getElementById("recentList");
  const recent = expenses.slice(0, 8);
  list.innerHTML = recent.length ? recent.map(txHTML).join("") : `<div class="tx-empty">No transactions this month</div>`;
  attachTxHandlers(list);
}

/* ── DONUT CHART ── */
function drawDonut(cats) {
  const canvas = document.getElementById("donutChart");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, R = 88, r = 54;
  ctx.clearRect(0, 0, W, H);

  if (!cats.length) {
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = R - r;
    ctx.stroke(); return;
  }

  const total = cats.reduce((s, c) => s + c.amount, 0);
  let start = -Math.PI / 2;
  const gap = 0.025;

  cats.forEach(cat => {
    const sweep = (cat.amount / total) * (Math.PI * 2 - gap * cats.length);
    ctx.beginPath();
    ctx.arc(cx, cy, (R + r) / 2, start + gap / 2, start + sweep + gap / 2);
    ctx.strokeStyle = cat.color;
    ctx.lineWidth = R - r;
    ctx.lineCap = "round";
    ctx.stroke();
    start += sweep + gap;
  });
}

/* ── BAR CHART ── */
function drawBar(daily, month) {
  const canvas = document.getElementById("barChart");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Fill all days of the month
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const dayMap = {};
  daily.forEach(d => { dayMap[d.date.slice(8, 10)] = d.amount; });

  const data = [];
  for (let i = 1; i <= daysInMonth; i++) {
    data.push({ day: i, amount: dayMap[String(i).padStart(2, "0")] || 0 });
  }

  const max = Math.max(...data.map(d => d.amount), 1);
  const pad = { l: 10, r: 10, t: 20, b: 30 };
  const bw = (W - pad.l - pad.r) / daysInMonth;
  const bGap = Math.max(bw * 0.2, 1);
  const bInner = bw - bGap;
  const chartH = H - pad.t - pad.b;

  // Grid line
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t + chartH); ctx.lineTo(W - pad.r, pad.t + chartH);
  ctx.stroke();

  // Today indicator
  const todayNum = new Date().getDate();
  const [ty, tm] = [new Date().getFullYear(), new Date().getMonth() + 1];
  const isCurrentMonth = ty === year && tm === mon;

  data.forEach((d, i) => {
    const x = pad.l + i * bw + bGap / 2;
    const barH = (d.amount / max) * chartH;
    const y = pad.t + chartH - barH;
    const isTd = isCurrentMonth && d.day === todayNum;

    // Bar
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, isTd ? "#F5A623" : "#00D4AA");
    grad.addColorStop(1, isTd ? "rgba(245,166,35,0.3)" : "rgba(0,212,170,0.15)");
    ctx.fillStyle = grad;
    const br = Math.min(3, bInner / 2);
    ctx.beginPath();
    if (barH > 0) {
      ctx.moveTo(x + br, y); ctx.lineTo(x + bInner - br, y);
      ctx.quadraticCurveTo(x + bInner, y, x + bInner, y + br);
      ctx.lineTo(x + bInner, y + barH); ctx.lineTo(x, y + barH);
      ctx.lineTo(x, y + br); ctx.quadraticCurveTo(x, y, x + br, y);
    }
    ctx.closePath(); ctx.fill();

    // Day label every 5
    if (d.day % 5 === 0 || d.day === 1) {
      ctx.fillStyle = "rgba(122,139,170,0.7)";
      ctx.font = "9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(d.day, x + bInner / 2, H - 8);
    }
  });
}

/* ── EXPENSES VIEW ── */
async function loadExpenses() {
  const cat = document.getElementById("filterCategory").value;
  const url = `/api/expenses?month=${currentMonth}&category=${encodeURIComponent(cat)}`;
  const expenses = await fetch(url).then(r => r.json());
  allExpenses = expenses;
  renderExpenses(expenses);
}

function renderExpenses(expenses) {
  const list = document.getElementById("allExpensesList");
  list.innerHTML = expenses.length
    ? expenses.map(txHTML).join("")
    : `<div class="tx-empty">No expenses found</div>`;
  attachTxHandlers(list);
}

document.getElementById("filterCategory").addEventListener("change", loadExpenses);

/* ── TX HTML ── */
function txHTML(tx) {
  const color = CATEGORY_COLORS[tx.category] || "#9EA8B8";
  const dateStr = new Date(tx.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `
    <div class="tx-item" data-id="${tx.id}">
      <div class="tx-dot" style="background:${color}22; color:${color}">${catInitials(tx.category)}</div>
      <div class="tx-info">
        <div class="tx-title">${tx.title}</div>
        <div class="tx-meta">${tx.category} · ${dateStr}${tx.note ? " · " + tx.note : ""}</div>
      </div>
      <div class="tx-amount">${fmt(tx.amount)}</div>
      <div class="tx-actions">
        <button class="btn-icon edit" data-id="${tx.id}" title="Edit">✎</button>
        <button class="btn-icon delete" data-id="${tx.id}" title="Delete">✕</button>
      </div>
    </div>
  `;
}

function attachTxHandlers(container) {
  container.querySelectorAll(".btn-icon.delete").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this expense?")) return;
      await fetch(`/api/expenses/${btn.dataset.id}`, { method: "DELETE" });
      loadDashboard();
      loadExpenses();
    });
  });
  container.querySelectorAll(".btn-icon.edit").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEdit(Number(btn.dataset.id));
    });
  });
}

/* ── ADD EXPENSE ── */
document.getElementById("fDate").value = today();

document.querySelectorAll(".cat-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedCategory = btn.dataset.cat;
  });
});

document.getElementById("submitExpense").addEventListener("click", async () => {
  const msg = document.getElementById("formMsg");
  const title = document.getElementById("fTitle").value.trim();
  const amount = document.getElementById("fAmount").value;
  const date = document.getElementById("fDate").value;
  const note = document.getElementById("fNote").value.trim();

  if (!title || !amount || !selectedCategory) {
    msg.textContent = "Please fill in title, amount and select a category.";
    msg.className = "form-msg error"; return;
  }

  const res = await fetch("/api/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, amount: parseFloat(amount), category: selectedCategory, date, note })
  });

  if (res.ok) {
    msg.textContent = "Expense added successfully!";
    msg.className = "form-msg success";
    document.getElementById("fTitle").value = "";
    document.getElementById("fAmount").value = "";
    document.getElementById("fNote").value = "";
    document.getElementById("fDate").value = today();
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("selected"));
    selectedCategory = "";
    loadDashboard();
    setTimeout(() => { msg.textContent = ""; }, 3000);
  } else {
    const err = await res.json();
    msg.textContent = err.error || "Failed to add expense.";
    msg.className = "form-msg error";
  }
});

/* ── EDIT MODAL ── */
function openEdit(id) {
  const tx = [...allExpenses].find(e => e.id === id);
  if (!tx) return;
  editingId = id;
  document.getElementById("mTitle").value = tx.title;
  document.getElementById("mAmount").value = tx.amount;
  document.getElementById("mDate").value = tx.date;
  document.getElementById("mCategory").value = tx.category;
  document.getElementById("mNote").value = tx.note || "";
  document.getElementById("modalOverlay").classList.add("open");
}

document.getElementById("modalClose").addEventListener("click", () => {
  document.getElementById("modalOverlay").classList.remove("open");
});
document.getElementById("modalOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
});

document.getElementById("saveEdit").addEventListener("click", async () => {
  const data = {
    title: document.getElementById("mTitle").value.trim(),
    amount: parseFloat(document.getElementById("mAmount").value),
    date: document.getElementById("mDate").value,
    category: document.getElementById("mCategory").value,
    note: document.getElementById("mNote").value.trim(),
  };
  await fetch(`/api/expenses/${editingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  document.getElementById("modalOverlay").classList.remove("open");
  loadDashboard();
  loadExpenses();
});

/* ── INIT ── */
loadDashboard();
