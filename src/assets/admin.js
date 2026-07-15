const loginSection = document.querySelector("#loginSection");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#loginForm");
const passwordInput = document.querySelector("#passwordInput");
const loginMessage = document.querySelector("#loginMessage");
const logoutButton = document.querySelector("#logoutButton");
const refreshButton = document.querySelector("#refreshButton");
const exportButton = document.querySelector("#exportButton");
const noticeSelect = document.querySelector("#noticeSelect");
const sendButton = document.querySelector("#sendButton");
const sendMessage = document.querySelector("#sendMessage");

const counts = {
  pageViews: document.querySelector("#pageViewCount"),
  active: document.querySelector("#activeCount"),
  pending: document.querySelector("#pendingCount"),
  unsubscribed: document.querySelector("#unsubscribedCount")
};

const subscriberRows = document.querySelector("#subscriberRows");
const pageViewRows = document.querySelector("#pageViewRows");
const campaignRows = document.querySelector("#campaignRows");
const mailStatus = document.querySelector("#mailStatus");

function setMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle("error", isError);
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").replace(/\.\d{3}Z$/u, "");
}

function appendCell(row, value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = value ?? "-";
  if (className) cell.className = className;
  row.append(cell);
}

function statusLabel(status) {
  return ({ active: "登録中", pending: "確認待ち", unsubscribed: "解除済み" })[status] || status;
}

function renderSubscribers(items) {
  subscriberRows.replaceChildren();
  for (const item of items) {
    const row = document.createElement("tr");
    appendCell(row, item.email);
    appendCell(row, statusLabel(item.status), `status-${item.status}`);
    appendCell(row, formatDate(item.created_at));
    appendCell(row, formatDate(item.confirmed_at));
    appendCell(row, formatDate(item.unsubscribed_at));
    subscriberRows.append(row);
  }
}

function renderPageViews(items) {
  pageViewRows.replaceChildren();
  for (const item of items) {
    const row = document.createElement("tr");
    appendCell(row, item.day);
    appendCell(row, String(item.views));
    pageViewRows.append(row);
  }
}

function renderCampaigns(items) {
  campaignRows.replaceChildren();
  for (const item of items) {
    const row = document.createElement("tr");
    appendCell(row, item.title);
    appendCell(row, `${item.sent_count}/${item.recipient_count}`);
    appendCell(row, String(item.failed_count));
    appendCell(row, formatDate(item.completed_at));
    campaignRows.append(row);
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "処理できませんでした。");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function loadNoticeOptions() {
  const response = await fetch("/data/sources.json", { cache: "no-store" });
  const data = await response.json();
  noticeSelect.replaceChildren();
  for (const notice of data.notices || []) {
    const option = document.createElement("option");
    option.value = notice.id;
    option.textContent = `${notice.publishedAt} / ${notice.title}`;
    noticeSelect.append(option);
  }
}

async function loadDashboard() {
  try {
    const data = await requestJson("/api/admin/subscribers", { cache: "no-store" });
    loginSection.hidden = true;
    dashboard.hidden = false;
    logoutButton.hidden = false;
    counts.pageViews.textContent = String(data.pageViews30Days);
    counts.active.textContent = String(data.counts.active);
    counts.pending.textContent = String(data.counts.pending);
    counts.unsubscribed.textContent = String(data.counts.unsubscribed);
    renderSubscribers(data.subscribers);
    renderPageViews(data.dailyViews);
    renderCampaigns(data.campaigns);
    mailStatus.textContent = data.configuration.ready
      ? `メール送信: 接続済み / 送信元: ${data.configuration.from}`
      : "メール送信: 未接続";
    await loadNoticeOptions();
  } catch (error) {
    if (error.status === 401) {
      loginSection.hidden = false;
      dashboard.hidden = true;
      logoutButton.hidden = true;
      return;
    }
    setMessage(loginMessage, error.message, true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(loginMessage, "ログインしています。");
  try {
    await requestJson("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: passwordInput.value })
    });
    loginForm.reset();
    setMessage(loginMessage, "");
    await loadDashboard();
  } catch (error) {
    setMessage(loginMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  await requestJson("/api/admin/logout", { method: "POST" });
  await loadDashboard();
});

refreshButton.addEventListener("click", loadDashboard);
exportButton.addEventListener("click", () => window.location.assign("/api/admin/export"));

sendButton.addEventListener("click", async () => {
  const selected = noticeSelect.options[noticeSelect.selectedIndex];
  if (!selected || !window.confirm(`次のお知らせを登録者へ配信します。\n\n${selected.textContent}`)) return;
  sendButton.disabled = true;
  setMessage(sendMessage, "送信しています。");
  try {
    const data = await requestJson("/api/admin/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ noticeId: selected.value })
    });
    const result = data.results[0];
    setMessage(sendMessage, `${result.batchSent}件を送信しました。累計 ${result.sentCount}/${result.recipientCount}件です。`);
    await loadDashboard();
  } catch (error) {
    setMessage(sendMessage, error.message, true);
  } finally {
    sendButton.disabled = false;
  }
});

loadDashboard();

