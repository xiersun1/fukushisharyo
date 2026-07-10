const DEFAULT_DATA = {
  updatedAt: "2026-07-10",
  notices: []
};

const noticeList = document.querySelector("#noticeList");
const dataStatus = document.querySelector("#dataStatus");
const alertForm = document.querySelector("#alertForm");
const emailInput = document.querySelector("#emailInput");
const formMessage = document.querySelector("#formMessage");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function displayDate(value = "") {
  return String(value).replaceAll("-", ".");
}

function normalizeData(data) {
  if (Array.isArray(data?.notices)) return data.notices;
  if (Array.isArray(data?.sources)) {
    return data.sources.map((source) => ({
      id: source.id || source.url || source.title,
      publishedAt: source.lastChecked || data.updatedAt || DEFAULT_DATA.updatedAt,
      title: source.title,
      org: source.org,
      statusCode: source.status,
      statusLabel: source.statusLabel,
      period: source.period,
      summary: source.summary,
      detailUrl: source.url,
      checkedAt: source.lastChecked,
      sourceNote: source.evidence
    }));
  }
  return DEFAULT_DATA.notices;
}

function sortByNewest(notices) {
  return [...notices].sort((a, b) => {
    const left = Date.parse(a.publishedAt || "") || 0;
    const right = Date.parse(b.publishedAt || "") || 0;
    return right - left;
  });
}

function noticeTemplate(notice) {
  const statusCode = escapeHtml(notice.statusCode || "watch");
  const statusLabel = escapeHtml(notice.statusLabel || "確認中");
  const detailUrl = escapeHtml(notice.detailUrl || "#");

  return `
    <article class="notice ${statusCode}">
      <div class="notice-meta">
        <time datetime="${escapeHtml(notice.publishedAt || "")}">${escapeHtml(displayDate(notice.publishedAt || ""))}</time>
        <span class="status ${statusCode}">${statusLabel}</span>
      </div>
      <h2>${escapeHtml(notice.title)}</h2>
      <p class="org">${escapeHtml(notice.org)}</p>
      <dl class="period">
        <dt>応募期間</dt>
        <dd>${escapeHtml(notice.period)}</dd>
      </dl>
      <p>${escapeHtml(notice.summary)}</p>
      <div class="detail-row">
        <a href="${detailUrl}" target="_blank" rel="noopener">詳細リンク</a>
        <span>確認日: ${escapeHtml(displayDate(notice.checkedAt || DEFAULT_DATA.updatedAt))}</span>
      </div>
    </article>
  `;
}

function renderNotices(notices, updatedAt) {
  const sorted = sortByNewest(notices);
  noticeList.innerHTML = sorted.map(noticeTemplate).join("");
  dataStatus.textContent = `${displayDate(updatedAt || DEFAULT_DATA.updatedAt)} 更新 / ${sorted.length}件`;
}

async function loadNotices() {
  try {
    const response = await fetch("data/sources.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`data/sources.json: ${response.status}`);
    }
    const data = await response.json();
    renderNotices(normalizeData(data), data.updatedAt);
  } catch (error) {
    renderNotices(DEFAULT_DATA.notices, DEFAULT_DATA.updatedAt);
    dataStatus.textContent = "お知らせを読み込めませんでした。";
  }
}

alertForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  if (!email) return;
  localStorage.setItem("fukushi-sharyo-alert-email", email);
  formMessage.textContent = "登録内容を保存しました。メール配信の接続後、このアドレスに通知します。";
});

loadNotices();
