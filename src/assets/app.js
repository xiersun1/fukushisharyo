const DEFAULT_DATA = {
  updatedAt: "2026-07-10",
  sources: []
};

let sources = DEFAULT_DATA.sources;

const rows = document.querySelector("#sourceRows");
const totalCount = document.querySelector("#totalCount");
const watchCount = document.querySelector("#watchCount");
const regionalCount = document.querySelector("#regionalCount");
const resultCount = document.querySelector("#resultCount");
const checkedDate = document.querySelector("#checkedDate");
const dataStatus = document.querySelector("#dataStatus");
const regionFilter = document.querySelector("#regionFilter");
const statusFilter = document.querySelector("#statusFilter");
const keywordFilter = document.querySelector("#keywordFilter");
const resetFilters = document.querySelector("#resetFilters");
const downloadCsv = document.querySelector("#downloadCsv");
const alertForm = document.querySelector("#alertForm");
const formMessage = document.querySelector("#formMessage");

function normalize(value = "") {
  return String(value).toLowerCase().trim();
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function displayDate(value) {
  return String(value || "").replaceAll("-", ".");
}

function statusText(source) {
  return `<span class="status ${escapeHtml(source.status)}">${escapeHtml(source.statusLabel)}</span>`;
}

function rowTemplate(source) {
  const tags = Array.isArray(source.tags) ? source.tags : [];
  const searchText = [
    source.title,
    source.org,
    source.statusLabel,
    source.regionLabel,
    source.period,
    source.target,
    source.summary,
    source.evidence,
    tags.join(" ")
  ].join(" ");

  return `
    <tr data-region="${escapeHtml(source.region)}" data-status="${escapeHtml(source.status)}" data-search="${escapeHtml(normalize(searchText))}">
      <td>
        <strong>${escapeHtml(source.title)}</strong>
        <br><small>${escapeHtml(source.summary)}</small>
        <br><small class="evidence">確認: ${escapeHtml(displayDate(source.lastChecked))} / ${escapeHtml(source.evidence)}</small>
      </td>
      <td>${escapeHtml(source.org)}</td>
      <td>${statusText(source)}</td>
      <td>${escapeHtml(source.regionLabel)}</td>
      <td>${escapeHtml(source.period)}</td>
      <td>${escapeHtml(source.target)}</td>
      <td><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">開く</a></td>
    </tr>
  `;
}

function updateCounts(updatedAt) {
  totalCount.textContent = String(sources.length);
  watchCount.textContent = String(sources.filter((source) => source.status === "watch").length);
  regionalCount.textContent = String(sources.filter((source) => source.region === "regional").length);
  checkedDate.textContent = displayDate(updatedAt || DEFAULT_DATA.updatedAt);
}

function renderRows(updatedAt) {
  rows.innerHTML = sources.map(rowTemplate).join("");
  updateCounts(updatedAt);
  applyFilters();
}

function applyFilters() {
  const region = regionFilter.value;
  const status = statusFilter.value;
  const keyword = normalize(keywordFilter.value);
  let visible = 0;

  rows.querySelectorAll("tr").forEach((row) => {
    const regionMatch = region === "all" || row.dataset.region === region;
    const statusMatch = status === "all" || row.dataset.status === status;
    const keywordMatch = keyword === "" || row.dataset.search.includes(keyword);
    const shouldShow = regionMatch && statusMatch && keywordMatch;
    row.hidden = !shouldShow;
    if (shouldShow) visible += 1;
  });

  resultCount.textContent = String(visible);
}

function downloadSourcesCsv() {
  const header = ["制度名", "団体", "状態", "地域", "受付時期", "対象", "公式URL", "確認日", "根拠"];
  const csvRows = sources.map((source) => [
    source.title,
    source.org,
    source.statusLabel,
    source.regionLabel,
    source.period,
    source.target,
    source.url,
    source.lastChecked,
    source.evidence
  ]);
  const csv = [header, ...csvRows]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fukushi-sharyo-alert-sources.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function loadSources() {
  try {
    const response = await fetch("data/sources.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`data/sources.json: ${response.status}`);
    }
    const data = await response.json();
    sources = Array.isArray(data) ? data : data.sources;
    if (!Array.isArray(sources)) {
      throw new Error("sources is not an array");
    }
    dataStatus.textContent = "data/sources.jsonから読込済み";
    renderRows(data.updatedAt);
  } catch (error) {
    sources = DEFAULT_DATA.sources;
    dataStatus.textContent = "データを読み込めませんでした。公開設定を確認してください。";
    renderRows(DEFAULT_DATA.updatedAt);
  }
}

[regionFilter, statusFilter, keywordFilter].forEach((element) => {
  element.addEventListener("input", applyFilters);
});

resetFilters.addEventListener("click", () => {
  regionFilter.value = "all";
  statusFilter.value = "all";
  keywordFilter.value = "";
  applyFilters();
  keywordFilter.focus();
});

downloadCsv.addEventListener("click", downloadSourcesCsv);

alertForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formMessage.textContent = "登録デモを確認しました。本番ではここから通知登録に接続します。";
});

loadSources();
