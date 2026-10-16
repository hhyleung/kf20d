// ============================================================
// #region DATE HELPERS
// ============================================================
function getTodayHKT() {
    return new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Hong_Kong",
    });
}

function addDays(dateStr, days) {
    if (!dateStr || !days) return "";
    const d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + parseInt(days, 10));
    return d.toISOString().slice(0, 10);
}

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

function daysBetween(fromStr, toStr) {
    const from = Date.parse(fromStr + "T00:00:00Z");
    const to = Date.parse(toStr + "T00:00:00Z");
    return Math.round((to - from) / 86400000);
}

function formatDateInput(value) {
    if (!value) return "";
    const date = new Date(value + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function formatShortDate(value) {
    if (!value) return "";
    const date =
        value.length > 10 ? new Date(value) : new Date(value + "T00:00:00Z");
    const day = date.toLocaleDateString("en-GB", {
        day: "2-digit",
        timeZone: "Asia/Hong_Kong",
    });
    const month = date
        .toLocaleDateString("en-GB", {
            month: "short",
            timeZone: "Asia/Hong_Kong",
        })
        .toUpperCase();
    return `${day} ${month}`;
}

function formatMetaTimestamp(iso) {
    if (!iso) return "No recent activity";
    const date = new Date(iso);
    const d = date.toLocaleDateString("en-GB", {
        day: "2-digit",
        timeZone: "Asia/Hong_Kong",
    });
    const m = date
        .toLocaleDateString("en-GB", {
            month: "short",
            timeZone: "Asia/Hong_Kong",
        })
        .toUpperCase();
    const y = date.toLocaleDateString("en-GB", {
        year: "numeric",
        timeZone: "Asia/Hong_Kong",
    });
    const t = date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Hong_Kong",
    });
    return `Last updated ${d} ${m} ${y}, ${t}`;
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
