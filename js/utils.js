// ============================================================
// #region DATE HELPERS
// ============================================================
// All dates are shown and compared in the household's time zone (UTC+8).
const TIME_ZONE = "Asia/Hong_Kong";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
});

// { weekday, day, month, year, hour, minute, second } in TIME_ZONE, with
// upper-case 3-letter weekday/month (ICU may return "Sept").
function getDateParts(date = new Date()) {
    const parts = Object.fromEntries(
        dateTimeFormatter.formatToParts(date).map((p) => [p.type, p.value]),
    );
    parts.weekday = parts.weekday.slice(0, 3).toUpperCase();
    parts.month = parts.month.slice(0, 3).toUpperCase();
    return parts;
}

// Accepts "YYYY-MM-DD" (a calendar date) or a full ISO timestamp.
function parseDateValue(value) {
    return String(value).length > 10
        ? new Date(value)
        : new Date(value + "T00:00:00Z");
}

// Today as "YYYY-MM-DD".
function getToday() {
    return new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

// Current time as "HH:MM".
function getNowTime() {
    const { hour, minute } = getDateParts();
    return `${hour}:${minute}`;
}

function addDays(dateStr, days) {
    if (!dateStr || !days) return "";
    const d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + parseInt(days, 10));
    return d.toISOString().slice(0, 10);
}

// Clamps to the end of the month (31 Jan + 1 month = 28/29 Feb).
function addMonths(dateStr, months) {
    if (!dateStr || !months) return "";
    const d = new Date(dateStr + "T00:00:00Z");
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + parseInt(months, 10));
    const lastDay = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, lastDay));
    return d.toISOString().slice(0, 10);
}

function addInterval(dateStr, amount, unit) {
    return unit === "months"
        ? addMonths(dateStr, amount)
        : addDays(dateStr, amount);
}

function daysBetween(fromStr, toStr) {
    const from = Date.parse(fromStr + "T00:00:00Z");
    const to = Date.parse(toStr + "T00:00:00Z");
    return Math.round((to - from) / 86400000);
}

// Value for <input type="date">.
function formatDateInput(value) {
    return value ? String(value).slice(0, 10) : "";
}

// "16 OCT"
function formatShortDate(value) {
    if (!value) return "";
    const { day, month } = getDateParts(parseDateValue(value));
    return `${day} ${month}`;
}

function formatMetaTimestamp(iso) {
    if (!iso) return "No recent activity";
    const { day, month, year, hour, minute, second } = getDateParts(
        new Date(iso),
    );
    return `Last updated ${day} ${month} ${year}, ${hour}:${minute}:${second}`;
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region DOM HELPERS
// ============================================================
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getElement(id) {
    return document.getElementById(id);
}

function selectElement(selector, root = document) {
    return root.querySelector(selector);
}

function selectAllElements(selector, root = document) {
    return [...root.querySelectorAll(selector)];
}

function showElement(id, display = "flex") {
    const el = getElement(id);
    if (el) el.style.display = display;
    return el;
}

function hideElement(id) {
    const el = getElement(id);
    if (el) el.style.display = "none";
    return el;
}

function setElementText(id, value = "") {
    const el = getElement(id);
    if (el) el.textContent = value ?? "";
    return el;
}

function setElementValue(id, value = "") {
    const el = getElement(id);
    if (el) el.value = value ?? "";
    return el;
}

function setElementHTML(id, html = "") {
    const el = getElement(id);
    if (el) el.innerHTML = html ?? "";
    return el;
}

function setElementChecked(id, checked = false) {
    const el = getElement(id);
    if (el) el.checked = !!checked;
    return el;
}
// ============================================================
// #endregion
// ============================================================
