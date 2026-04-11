// Supabase connection
const SUPABASE_URL = "https://ilfrtrfohdhoquemptmj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_s8LcKiFr_XOf_fg9O2ubBQ_8mElMJ6L";
let sbClient = null;
let subscriptions = [];

let fridgeItems = [];
let chores = [];
let changeLogs = [];
let bills = [];
let plants = [];
let plantHistory = [];
let notes = [];

async function loadFridgeStock() {
    try {
        const { data, error } = await sb
            .from("fridge_stock")
            .select("*")
            .order("last_updated", { ascending: false });
        if (error) throw error;
        fridgeItems = data || [];
    } catch (err) {
        console.error("Load fridge_stock error:", err);
        fridgeItems = [];
    }
}

async function loadChores() {
    try {
        const { data, error } = await sb
            .from("chores")
            .select("*")
            .order("next_due_date");
        if (error) throw error;
        chores = data || [];
    } catch (err) {
        console.error("Load chores error:", err);
        chores = [];
    }
}

async function loadChangeLogs() {
    try {
        const { data, error } = await sb
            .from("change_log")
            .select("*")
            .order("next_change_due");
        if (error) throw error;
        changeLogs = data || [];
    } catch (err) {
        console.error("Load change_log error:", err);
        changeLogs = [];
    }
}

async function loadBills() {
    try {
        const { data, error } = await sb
            .from("bills")
            .select("*")
            .order("next_bill_date");
        if (error) throw error;
        bills = data || [];
    } catch (err) {
        console.error("Load bills error:", err);
        bills = [];
    }
}

async function loadPlants() {
    try {
        const { data, error } = await sb
            .from("plants")
            .select("*")
            .order("plant_name");
        if (error) throw error;
        plants = data || [];
    } catch (err) {
        console.error("Load plants error:", err);
        plants = [];
    }
}

async function loadPlantHistory() {
    try {
        const { data, error } = await sb
            .from("plant_history")
            .select("*")
            .order("event_date", { ascending: false });
        if (error) throw error;
        plantHistory = data || [];
    } catch (err) {
        console.error("Load plant_history error:", err);
        plantHistory = [];
    }
}

async function loadNotes() {
    try {
        const { data, error } = await sb
            .from("notes")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        notes = data || [];
    } catch (err) {
        console.error("Load notes error:", err);
        notes = [];
    }
}

async function loadAllData() {
    await Promise.all([
        loadFridgeStock(),
        loadChores(),
        loadChangeLogs(),
        loadBills(),
        loadPlants(),
        loadPlantHistory(),
        loadNotes(),
    ]);
}

function subscribeToTable(tableName, renderFunc) {
    ensureSupabaseReady()
        .then((sb) => {
            if (!sb) return;

            const channel = sb.channel(`realtime:${tableName}`);
            channel
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: tableName,
                    },
                    () => renderFunc(),
                )
                .subscribe();

            subscriptions.push(channel);
        })
        .catch(console.error);
}

async function setupRealtime() {
    const sb = await ensureSupabaseReady();
    if (!sb || !sb.auth.getSession()) {
        console.log("Skipping realtime: not ready");
        return;
    }

    const userId = (await sb.auth.getUser()).data.user?.id;
    if (!userId) return;

    subscribeToTable("fridgestock", renderFridgeStock);
    subscribeToTable("chores", renderChores);
    subscribeToTable("changelog", renderChangeLogs);
    subscribeToTable("bills", renderBills);
    subscribeToTable("plants", renderPlants);
    subscribeToTable("planthistory", () =>
        loadPlantHistory().then(renderPlants),
    );
    subscribeToTable("notes", renderNotes);
}

function cleanupSubscriptions() {
    subscriptions.forEach((sub) => sb.removeChannel(sub));
    subscriptions = [];
}

async function initSupabase() {
    if (sbClient) return sbClient;

    try {
        sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase initialised");
        return sbClient;
    } catch (error) {
        console.error("Supabase init failed:", error);
        return null;
    }
}

async function ensureSupabaseReady() {
    while (!sbClient) {
        await initSupabase();
        if (!sbClient) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
    return sbClient;
}

let isAuthenticated = false;

async function checkSession() {
    try {
        await initSupabase();
        const {
            data: { session },
        } = await sbClient.auth.getSession();

        console.log("Session:", session ? "logged in" : "not logged in");

        if (session) {
            isAuthenticated = true;
            showDashboard();
        } else {
            showLogin();
        }
    } catch (err) {
        console.error("Session check error:", err);
        showLogin();
    }
}

async function login(email, password) {
    try {
        const sb = await initSupabase();
        if (!sb) throw new Error("Supabase not initialised");
        const { data, error } = await sb.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        console.log("Login successful:", data.user.email);
        isAuthenticated = true;
        showDashboard();
    } catch (error) {
        console.error("Login failed:", error.message);
        alert("Login failed: " + error.message);
    }
}

function showLogin() {
    document.getElementById("loginContainer").style.display = "flex";
    document.querySelector(".dashboard").style.display = "none";
}

function showDashboard() {
    document.getElementById("loginContainer").style.display = "none";
    const dash = document.querySelector(".dashboard");
    dash.style.removeProperty("display");
    dash.style.display = "grid";
    renderFridgeStock();
    renderChores();
    renderChangeLogs();
    renderBills();
    renderPlants();
    renderNotes();
    setupPanelClicks();
    setTimeout(setupRealtime, 500);
}

async function saveFridgeItem(item, isUpdate = false) {
    const sb = await ensureSupabaseReady();
    if (!sb) return;
    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const data = { ...item, userid: user.id };
        const { error } = isUpdate
            ? await sb.from("fridgestock").update(data).eq("id", item.id)
            : await sb.from("fridgestock").insert([data]);
        if (error) throw error;
        await loadFridgeStock();
    } catch (error) {
        alert("Save failed: " + error.message);
    }
}

async function deleteFridgeItem(id) {
    if (confirm("Delete this item permanently?")) {
        try {
            await sb.from("fridgestock").delete().eq("id", id);
            await loadFridgeStock();
        } catch (err) {
            alert("Delete failed: " + err.message);
        }
    }
}

async function saveChore(chore, isUpdate = false) {
    const sb = await ensureSupabaseReady();
    if (!sb) return;
    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const data = { ...chore, userid: user.id };
        const { error } = isUpdate
            ? await sb.from("chores").update(data).eq("id", chore.id)
            : await sb.from("chores").insert([data]);
        if (error) throw error;
        await loadChores();
    } catch (error) {
        alert("Save failed: " + error.message);
    }
}

async function deleteChore(id) {
    const sb = await initSupabase();
    const { error } = await sb.from("chores").delete().eq("id", id);
    if (error) throw error;
    await loadChores();
}

async function saveBill(bill, isUpdate = false) {
    const sb = await initSupabase();
    const data = { ...bill, userid: sb.auth.getUser().data.user.id };
    delete data.id;
    const { error } = isUpdate
        ? await sb.from("bills").update(data).eq("id", bill.id)
        : await sb.from("bills").insert([data]);
    if (error) throw error;
    await loadBills();
}

async function deleteBill(id) {
    const sb = await initSupabase();
    const { error } = await sb.from("bills").delete().eq("id", id);
    if (error) throw error;
    await loadBills();
}

async function saveChangeLog(cl, isUpdate = false) {
    const sb = await initSupabase();
    const data = { ...cl, userid: sb.auth.getUser().data.user.id };
    delete data.id;
    const { error } = isUpdate
        ? await sb.from("changelog").update(data).eq("id", cl.id)
        : await sb.from("changelog").insert([data]);
    if (error) throw error;
    await loadChangeLogs();
}

async function deleteChangeLog(id) {
    const sb = await initSupabase();
    const { error } = await sb.from("changelog").delete().eq("id", id);
    if (error) throw error;
    await loadChangeLogs();
}

async function savePlant(plant) {
    const sb = await initSupabase();
    const data = { ...plant, userid: sb.auth.getUser().data.user.id };
    const { error } = await sb.from("plants").insert([data]);
    if (error) throw error;
    await loadPlants();
    await loadPlantHistory();
}

async function updatePlant(plantId, updates) {
    const sb = await initSupabase();
    const { error } = await sb.from("plants").update(updates).eq("id", plantId);
    if (error) throw error;
    await loadPlants();
    await loadPlantHistory();
}

async function deletePlant(plantId) {
    const sb = await initSupabase();
    const { error: error1 } = await sb
        .from("planthistory")
        .delete()
        .eq("plantid", plantId);
    const { error: error2 } = await sb
        .from("plants")
        .delete()
        .eq("id", plantId);
    if (error1 || error2) throw error1 || error2;
    await loadPlants();
    await loadPlantHistory();
}

async function savePlantHistory(historyItem) {
    const sb = await initSupabase();
    const data = { ...historyItem, plantid: historyItem.plantid };
    const { error } = await sb.from("planthistory").insert([data]);
    if (error) throw error;
    await loadPlantHistory();
}

async function deletePlantHistory(id) {
    const sb = await initSupabase();
    const { error } = await sb.from("planthistory").delete().eq("id", id);
    if (error) throw error;
    await loadPlantHistory();
}

async function saveNote(content) {
    const sb = await initSupabase();
    const { error } = await sb.from("notes").insert([
        {
            content,
            userid: sb.auth.getUser().data.user.id,
            createdat: new Date().toISOString().slice(0, 10),
        },
    ]);
    if (error) throw error;
    await loadNotes();
}

const fridgeCategoryOrder = [
    "Carbs",
    "Veg",
    "Protein",
    "Fruits",
    "Others",
    "Raw",
];

// State flags
let expiryManuallySet = false;
let addExpiryManuallySet = false;
let currentFullSection = null;
let editingChoreId = null;
let choreNextDueManuallySet = false;
let editingChangeLogId = null;
let changelogNextDueManuallySet = false;
let editingBillId = null;
let billNextDateManuallySet = false;

// ============================================================
// List Metadata (last activity timestamp per list)
// ============================================================
const LIST_META_KEYS = [
    "fridge_stock",
    "chores",
    "bills",
    "change_log",
    "plants",
    "notes",
];
let listMetadata = {};
LIST_META_KEYS.forEach((k) => {
    listMetadata[k] = null;
});

async function touchMetadata(listName) {
    const ts = new Date().toISOString();
    listMetadata[listName] = ts;
    try {
        const sb = await initSupabase();
        await sb
            .from("listmetadata")
            .upsert({
                listname: listName,
                lastupdated: ts,
                userid: sb.auth.getUser().data.user.id,
            });
    } catch (err) {
        console.error("Metadata update failed", err);
    }
}

function refreshSectionLastUpdated() {
    if (!currentFullSection) return;

    const metaToSection = {
        fridgestock: "fridgestock",
        chores: "chores",
        bills: "bills",
        changelog: "changelog",
        plants: "plants",
        notes: "notes",
    };

    const listName = metaToSection[currentFullSection];
    if (!listName) return;

    const el = document.getElementById("sectionLastUpdated");
    if (el) el.textContent = formatMetaTimestamp(listMetadata[listName]);
}

function formatMetaTimestamp(iso) {
    if (!iso) return "No recent activity";
    return (
        "Last updated " +
        new Date(iso).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    );
}

// ============================================================
// Modal helpers
// ============================================================
function openModal(id) {
    document.getElementById(id).style.display = "flex";
}
function closeModal(id) {
    document.getElementById(id).style.display = "none";
    if (id === "fullSectionModal") currentFullSection = null;
}

// ============================================================
// Date helpers
// ============================================================
function formatShortDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
    });
}

function formatDateInput(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
}

function parseDisplayDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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
    d.setUTCMonth(d.getUTCMonth() + parseInt(months, 10));
    return d.toISOString().slice(0, 10);
}

function calcChoreNextDue(lastdone, interval) {
    return addDays(lastdone, interval);
}
function calcChangeLogNextDue(lastchanged, interval) {
    return addMonths(lastchanged, interval);
}
function calcBillNextDate(lastbilldate, interval) {
    return addMonths(lastbilldate, interval);
}

function getExpiryClass(expirydate) {
    if (!expirydate) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expirydate + "T00:00:00Z");
    const diffDays = Math.floor((expiry - today) / 86400000);
    if (diffDays <= 0) return "expiry-danger";
    if (diffDays <= 7) return "expiry-warning";
    return "";
}

function getDueClass(nextDueDate) {
    if (!nextDueDate) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(nextDueDate + "T00:00:00Z");
    const diffDays = Math.floor((due - today) / 86400000);
    if (diffDays <= 0) return "due-danger";
    if (diffDays <= 3) return "due-warning";
    return "";
}

// ============================================================
// Fridge Stock
// ============================================================
function getVisibleItems(showZero = false) {
    return fridgeItems.filter((item) => showZero || item.portions > 0);
}

function groupByCategory(items) {
    const grouped = {};
    fridgeCategoryOrder.forEach((c) => {
        grouped[c] = [];
    });
    items.forEach((item) => {
        grouped[
            fridgeCategoryOrder.includes(item.category)
                ? item.category
                : "Others"
        ].push(item);
    });
    return grouped;
}

function fridgeItemRow(item, showZero = false) {
    const expiryClass = getExpiryClass(item.expirydate);
    const isRaw = item.category === "Raw";
    const dateVal = isRaw ? item.expirydate : item.createdat;
    const dateStr = dateVal
        ? `<span class="item-sep">•</span><span class="fridge-date">${formatShortDate(dateVal)}</span>`
        : "";
    const portionsDisplay =
        item.portions === 0 && showZero
            ? `<span class="portion-zero">${item.portions}</span>`
            : `<span class="portion-number">${item.portions}</span>`;
    return `
    <li class="item-row ${item.portions === 0 && showZero ? "zero-portions" : ""}" data-open-detail="${item.id}">
      <span class="item-key ${expiryClass}">${item.itemname}</span>
      <span class="item-value">
        ${dateStr}
        <button class="action-btn" data-action="fridge-portions" data-id="${item.id}" data-delta="1" title="Add portion">+</button>
        ${portionsDisplay}
        <button class="action-btn" data-action="fridge-portions" data-id="${item.id}" data-delta="-1" title="Remove portion">-</button>
      </span>
    </li>`;
}

function buildFridgeHTML(showZero) {
    const items = getVisibleItems(showZero);
    const grouped = groupByCategory(items);
    const forceFullWidth = ["Protein", "Raw"];
    let html = '<div class="fridge-inner-grid">';
    fridgeCategoryOrder.forEach((cat) => {
        const catItems = grouped[cat];
        const alwaysHalfWidth = ["Carbs", "Veg", "Fruits", "Others"];
        const wide =
            !alwaysHalfWidth.includes(cat) &&
            (catItems.length >= 3 || forceFullWidth.includes(cat));
        const cls = wide ? "col-full" : "col-half";
        html +=
            catItems.length === 0
                ? `<div class="fridge-group ${cls}"><div class="fridge-group-title">${cat}</div><div class="fridge-empty">No items</div></div>`
                : `<div class="fridge-group ${cls}"><div class="fridge-group-title">${cat}</div><ul class="item-list ${wide ? "two-col-list" : ""}">${catItems.map((i) => fridgeItemRow(i, showZero)).join("")}</ul></div>`;
    });
    html += "</div>";
    return html;
}

function renderFridgeStock() {
    document.getElementById("fridgeContent").innerHTML = buildFridgeHTML(false);
    if (currentFullSection === "fridgestock") {
        document.getElementById("fullSectionContent").innerHTML =
            buildFridgeHTML(true);
    }
}

function recalcExpiry() {
    if (expiryManuallySet) return;
    const createdVal = document.getElementById("editCreatedAt")?.value;
    const shelfVal = document.getElementById("editShelflife")?.value;
    const expiryInput = document.getElementById("editExpiry");
    const autoLabel = document.getElementById("expiryAutoLabel");
    const hint = document.getElementById("expiryHint");
    if (createdVal && shelfVal && expiryInput) {
        expiryInput.value = addDays(createdVal, parseInt(shelfVal, 10));
        if (autoLabel) autoLabel.style.display = "inline-block";
        if (hint) hint.style.display = "block";
    } else {
        if (autoLabel) autoLabel.style.display = "none";
        if (hint) hint.style.display = "none";
    }
}

function recalcAddExpiry() {
    if (addExpiryManuallySet) return;
    const createdVal = document.getElementById("addCreatedAt")?.value;
    const shelfVal = document.getElementById("addShelflife")?.value;
    const expiryInput = document.getElementById("addExpiry");
    const autoLabel = document.getElementById("addExpiryAutoLabel");
    const hint = document.getElementById("addExpiryHint");
    if (createdVal && shelfVal && expiryInput) {
        expiryInput.value = addDays(createdVal, parseInt(shelfVal, 10));
        if (autoLabel) autoLabel.style.display = "inline-block";
        if (hint) hint.style.display = "block";
    } else {
        if (autoLabel) autoLabel.style.display = "none";
        if (hint) hint.style.display = "none";
    }
}

function openDetail(itemId) {
    const item = fridgeItems.find((i) => i.id === itemId);
    if (!item) return;

    expiryManuallySet = false;
    document.getElementById("editId").value = item.id;
    document.getElementById("editItemname").value = item.itemname;
    document.getElementById("editCategory").value = item.category;
    document.getElementById("editPortions").value = item.portions;
    document.getElementById("editShelflife").value = item.shelflifedays;
    document.getElementById("editCreatedAt").value = item.createdat;
    document.getElementById("editExpiry").value = formatDateInput(
        item.expirydate,
    );
    document.getElementById("editLastUpdated").textContent = item.lastupdated
        ? formatShortDate(item.lastupdated)
        : "";
    document.getElementById("detailTitle").textContent =
        item.itemname.toUpperCase();

    const expectedAuto =
        item.createdat && item.shelflifedays
            ? addDays(item.createdat, item.shelflifedays)
            : null;
    expiryManuallySet = !!item.expirydate && item.expirydate !== expectedAuto;

    openModal("detailModal");

    if (!expiryManuallySet) {
        recalcExpiry();
    }
}

function openAddModal() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById("addItemname").value = "";
    document.getElementById("addCategory").value = "Carbs";
    document.getElementById("addPortions").value = 1;
    document.getElementById("addShelflife").value = "";
    document.getElementById("addCreatedAt").value = today;
    document.getElementById("addExpiry").value = "";
    addExpiryManuallySet = false;
    document.getElementById("addTitle").textContent = "Add New Fridge Item";
    openModal("addModal");
    recalcAddExpiry();
}

function deleteFridgeItem(itemId) {
    if (confirm("Delete this item permanently?")) {
        fridgeItems = fridgeItems.filter((item) => item.id !== itemId);
        touchMetadata("fridgestock");
        renderFridgeStock();
        closeModal("detailModal");
    }
}

// ============================================================
// Chores
// ============================================================
function buildChoresHTML() {
    return (
        '<ul class="item-list">' +
        chores
            .map((c) => {
                const dueClass = getDueClass(c.nextdue);
                return `
    <li class="item-row" data-open-chore="${c.id}">
      <span class="item-key ${dueClass}">${c.taskname}</span>
      <span class="item-value">
        <span class="item-meta">${c.lastdone ? formatShortDate(c.lastdone) : "Never"} • ${c.nextdue ? formatShortDate(c.nextdue) : ""}${c.interval ? ` (${c.interval}d)` : ""}</span>
        <button class="action-btn" data-action="done" data-id="${c.id}" title="Mark done">✓</button>
      </span>
    </li>`;
            })
            .join("") +
        "</ul>"
    );
}

function renderChores() {
    document.getElementById("choresContent").innerHTML = buildChoresHTML();
    if (currentFullSection === "chores") {
        document.getElementById("fullSectionContent").innerHTML =
            buildChoresHTML();
    }
}

function openChoreDetail(choreId) {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore) return;

    editingChoreId = choreId;

    document.getElementById("choreEditId").value = choreId;
    document.getElementById("choreTaskname").value = chore.taskname;
    document.getElementById("choreLastdone").value = formatDateInput(
        chore.lastdone,
    );
    document.getElementById("choreInterval").value = chore.interval;
    document.getElementById("choreNextdue").value = formatDateInput(
        chore.nextdue,
    );

    const expectedAuto =
        chore.lastdone && chore.interval
            ? calcChoreNextDue(chore.lastdone, chore.interval)
            : null;
    choreNextDueManuallySet = !!chore.nextdue && chore.nextdue !== expectedAuto;

    document.getElementById("choreDetailTitle").textContent =
        chore.taskname.toUpperCase();
    document.getElementById("choreDeleteBtn").style.display = "block";

    openModal("choreDetailModal");

    if (!choreNextDueManuallySet) {
        refreshChoreNextDueIfNeeded();
    }
}

function refreshChoreNextDueIfNeeded() {
    if (choreNextDueManuallySet) return;
    const lastdone = document.getElementById("choreLastdone").value;
    const interval = document.getElementById("choreInterval").value;
    const autoLabel = document.getElementById("choreNextdueAutoLabel");
    if (lastdone && interval) {
        document.getElementById("choreNextdue").value = calcChoreNextDue(
            lastdone,
            interval,
        );
        if (autoLabel) autoLabel.style.display = "inline-block";
    } else {
        if (autoLabel) autoLabel.style.display = "none";
    }
}

// ============================================================
// Change Log
// ============================================================
function buildChangeLogsHTML() {
    return (
        '<ul class="item-list">' +
        changeLogs
            .map((c) => {
                const dueClass = getDueClass(c.nextdue);
                return `
    <li class="item-row" data-open-changelog="${c.id}">
      <span class="item-key ${dueClass}">${c.itemname}</span>
      <span class="item-value">
        <span class="item-meta">${c.lastchanged ? formatShortDate(c.lastchanged) : "Never"} • ${c.nextdue ? formatShortDate(c.nextdue) : ""}${c.interval ? ` (${c.interval}mo)` : ""}</span>
        <button class="action-btn" data-action="changelog-done" data-id="${c.id}" title="Mark changed">✓</button>
      </span>
    </li>`;
            })
            .join("") +
        "</ul>"
    );
}

function renderChangeLogs() {
    document.getElementById("changelogContent").innerHTML =
        buildChangeLogsHTML();
    if (currentFullSection === "changelog") {
        document.getElementById("fullSectionContent").innerHTML =
            buildChangeLogsHTML();
    }
}

function openChangeLogDetail(clId) {
    const cl = changeLogs.find((c) => c.id === clId);
    if (!cl) return;

    editingChangeLogId = clId;
    changelogNextDueManuallySet = false;

    document.getElementById("changelogEditId").value = clId;
    document.getElementById("changelogItemname").value = cl.itemname;
    document.getElementById("changelogLastchanged").value = formatDateInput(
        cl.lastchanged,
    );
    document.getElementById("changelogInterval").value = cl.interval;
    document.getElementById("changelogNextdue").value = formatDateInput(
        cl.nextdue,
    );

    const expectedAuto =
        cl.lastchanged && cl.interval
            ? calcChangeLogNextDue(cl.lastchanged, cl.interval)
            : null;
    changelogNextDueManuallySet = !!cl.nextdue && cl.nextdue !== expectedAuto;

    document.getElementById("changelogDetailTitle").textContent =
        cl.itemname.toUpperCase();
    document.getElementById("changelogDeleteBtn").style.display = "block";

    openModal("changelogDetailModal");

    if (!changelogNextDueManuallySet) {
        refreshChangelogNextDue();
    }
}

function refreshChangelogNextDue() {
    if (changelogNextDueManuallySet) return;
    const lastchanged = document.getElementById("changelogLastchanged").value;
    const interval = document.getElementById("changelogInterval").value;
    const autoLabel = document.getElementById("changelogNextdueAutoLabel");
    if (lastchanged && interval) {
        document.getElementById("changelogNextdue").value =
            calcChangeLogNextDue(lastchanged, interval);
        if (autoLabel) autoLabel.style.display = "inline-block";
    } else {
        if (autoLabel) autoLabel.style.display = "none";
    }
}

// ============================================================
// Bills
// ============================================================
function buildBillsHTML() {
    return (
        '<ul class="item-list">' +
        bills
            .map((b) => {
                const dueClass = getDueClass(b.nextbilldate);
                return `
    <li class="item-row" data-open-bill="${b.id}">
      <span class="item-key ${dueClass}">${b.billname}</span>
      <span class="item-value">
        <span class="item-meta">${b.nextbilldate ? formatShortDate(b.nextbilldate) : ""}${b.interval ? ` (${b.interval}mo)` : ""}</span>
        <button class="action-btn" data-action="paid" data-id="${b.id}" title="Mark paid">✓</button>
      </span>
    </li>`;
            })
            .join("") +
        "</ul>"
    );
}

function renderBills() {
    document.getElementById("billsContent").innerHTML = buildBillsHTML();
    if (currentFullSection === "bills") {
        document.getElementById("fullSectionContent").innerHTML =
            buildBillsHTML();
    }
}

function openBillDetail(billId) {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;

    editingBillId = billId;
    billNextDateManuallySet = false;

    document.getElementById("billEditId").value = billId;
    document.getElementById("billBillname").value = bill.billname;
    document.getElementById("billLastbilldate").value = formatDateInput(
        bill.lastbilldate,
    );
    document.getElementById("billInterval").value = bill.interval;
    document.getElementById("billNextbilldate").value = formatDateInput(
        bill.nextbilldate,
    );

    const expectedAuto =
        bill.lastbilldate && bill.interval
            ? calcBillNextDate(bill.lastbilldate, bill.interval)
            : null;
    billNextDateManuallySet =
        !!bill.nextbilldate && bill.nextbilldate !== expectedAuto;

    document.getElementById("billDetailTitle").textContent =
        bill.billname.toUpperCase();
    document.getElementById("billDeleteBtn").style.display = "block";

    openModal("billDetailModal");

    if (!billNextDateManuallySet) {
        refreshBillNextDate();
    }
}

function refreshBillNextDate() {
    if (billNextDateManuallySet) return;
    const lastdate = document.getElementById("billLastbilldate").value;
    const interval = document.getElementById("billInterval").value;
    const autoLabel = document.getElementById("billNextbilldateAutoLabel");
    if (lastdate && interval) {
        document.getElementById("billNextbilldate").value = calcBillNextDate(
            lastdate,
            interval,
        );
        if (autoLabel) autoLabel.style.display = "inline-block";
    } else {
        if (autoLabel) autoLabel.style.display = "none";
    }
}

// ============================================================
// Plants
// ============================================================
function buildPlantsHTML(showArchived = false) {
    const visible = showArchived ? plants : plants.filter((p) => !p.archived);
    if (!visible.length) {
        return '<p style="color:var(--text-secondary);font-style:italic;font-size:var(--item-font);padding:0.5rem 0;">No plants</p>';
    }
    return (
        '<ul class="item-list">' +
        visible
            .map(
                (p) => `
    <li class="item-row" data-open-plant="${p.id}">
      <span class="item-key">
        ${p.plantname}
        ${p.archived ? '<span class="plant-archived-tag">(archived)</span>' : ""}
      </span>
      <span class="item-value">
        <span class="item-meta">${p.potsize ? p.potsize + "cm" : ""}</span>
        <button class="action-btn" data-action="plant-log" data-id="${p.id}" title="Log event">📝</button>
      </span>
    </li>`,
            )
            .join("") +
        "</ul>"
    );
}

function renderPlants() {
    document.getElementById("plantsContent").innerHTML = buildPlantsHTML(false);
    if (currentFullSection === "plants") {
        document.getElementById("fullSectionContent").innerHTML =
            buildPlantsHTML(true);
    }
}

function openPlantDetail(plantId) {
    const plant = plants.find((p) => p.id === plantId);
    if (!plant) return;

    document.getElementById("plantDetailTitle").textContent =
        plant.plantname.toUpperCase();
    document.getElementById("pdPlantNameInput").value = plant.plantname;
    document.getElementById("pdSaveNameBtn").dataset.id = plantId;
    document.getElementById("pdStartDate").textContent = plant.startingdate
        ? formatShortDate(plant.startingdate)
        : "—";
    document.getElementById("pdPotSize").textContent = plant.potsize
        ? plant.potsize + " cm"
        : "—";
    document.getElementById("pdLastWatered").textContent = plant.lastwatered
        ? formatShortDate(plant.lastwatered)
        : "—";
    document.getElementById("pdLastFertilised").textContent =
        plant.lastfertilised ? formatShortDate(plant.lastfertilised) : "—";
    document.getElementById("pdFertiliserUsed").textContent =
        plant.lastfertiliser || "—";

    const history = plantHistory
        .filter((h) => h.plantid === plantId)
        .sort((a, b) => new Date(b.eventdate) - new Date(a.eventdate));

    const noteText = plant.notes || history.find((h) => h.notes)?.notes || "";
    document.getElementById("pdLatestNote").textContent =
        noteText || "No notes";

    const archiveBtn = document.getElementById("pdArchiveBtn");
    archiveBtn.dataset.id = plantId;
    archiveBtn.textContent = plant.archived
        ? "Unarchive Plant"
        : "Archive Plant";
    archiveBtn.classList.toggle("is-archived", !!plant.archived);

    document.getElementById("pdDeleteBtn").dataset.id = plantId;

    const tbody = document.getElementById("pdHistoryBody");
    if (!history.length) {
        tbody.innerHTML =
            '<tr><td colspan="7" style="color:var(--text-secondary);font-style:italic;text-align:center;padding:1.4rem;">No history yet</td></tr>';
    } else {
        tbody.innerHTML = history
            .map(
                (h) => `
      <tr>
        <td>${formatShortDate(h.eventdate)}</td>
        <td>${h.potsize ? h.potsize + " cm" : "—"}</td>
        <td class="${h.watered ? "check-yes" : "check-no"}">${h.watered ? "✓" : "—"}</td>
        <td class="${h.fertilised ? "check-yes" : "check-no"}">${h.fertilised ? "✓" : "—"}</td>
        <td>${h.fertiliserused || "—"}</td>
        <td>${h.notes || "—"}</td>
        <td>
          <button class="action-btn" data-action="plant-history-delete" data-id="${h.id}" data-plantid="${plantId}" style="font-size:0.9rem;width:32px;height:32px;">✕</button>
        </td>
      </tr>`,
            )
            .join("");
    }

    openModal("plantDetailModal");
}

function openAddPlantModal() {
    document.getElementById("addPlantName").value = "";
    document.getElementById("addPlantStartDate").value = new Date()
        .toISOString()
        .slice(0, 10);
    openModal("addPlantModal");
}

function openPlantEventModal(plantId) {
    const plant = plants.find((p) => p.id === plantId);
    if (!plant) return;
    document.getElementById("plantEventTitle").textContent =
        plant.plantname.toUpperCase();
    document.getElementById("plantEventId").value = plantId;
    document.getElementById("wateredCheck").checked = false;
    document.getElementById("fertilisedCheck").checked = false;
    document.getElementById("fertiliserSelectWrap").style.display = "none";
    document.getElementById("plantEventPotsize").value = plant.potsize || "";
    openModal("plantEventModal");
}

// ============================================================
// Notes
// ============================================================
function buildNotesHTML() {
    return (
        '<ul class="item-list">' +
        notes
            .map(
                (n) => `
    <li class="item-row">
      <span class="item-key">${n.content}</span>
      <span class="item-value">
        <button class="action-btn" data-action="note-delete" data-id="${n.id}" title="Delete note">×</button>
      </span>
    </li>`,
            )
            .join("") +
        "</ul>"
    );
}

function renderNotes() {
    document.getElementById("notesContent").innerHTML = buildNotesHTML();
    if (currentFullSection === "notes") {
        document.getElementById("fullSectionContent").innerHTML =
            buildNotesHTML();
    }
}

// ============================================================
// Full Section Modal
// ============================================================
function buildFullSectionHTML(section) {
    switch (section) {
        case "fridgestock":
            return buildFridgeHTML(true);
        case "chores":
            return buildChoresHTML();
        case "changelog":
            return buildChangeLogsHTML();
        case "bills":
            return buildBillsHTML();
        case "plants":
            return buildPlantsHTML(true);
        case "notes":
            return buildNotesHTML();
        default:
            return "";
    }
}

function setupPanelClicks() {
    const sectionMetaKeyMap = {
        fridgestock: "fridge_stock",
        chores: "chores",
        bills: "bills",
        changelog: "change_log",
        plants: "plants",
        notes: "notes",
    };
    document.querySelectorAll(".panel-header h3").forEach((h3) => {
        h3.addEventListener("click", (e) => {
            const section = e.target.closest(".panel").dataset.section;
            const metaKey = sectionMetaKeyMap[section] || section;
            document.getElementById("sectionTitle").textContent =
                h3.textContent.toUpperCase();
            currentFullSection = section;
            document.getElementById("fullSectionContent").innerHTML =
                buildFullSectionHTML(section);
            refreshSectionLastUpdated();
            openModal("fullSectionModal");
        });
    });
}

// ============================================================
// Global click delegation
// ============================================================
document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    e.stopPropagation();
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const sb = await initSupabase();

    if (action === "fridge-portions") {
        const id = btn.dataset.id;
        const delta = parseInt(btn.dataset.delta, 10);
        const item = fridgeItems.find((item) => item.id === id);
        if (!item) return;

        const newPortions = Math.max(0, item.portions + delta);
        const today = new Date().toISOString().slice(0, 10);
        fridgeItems = fridgeItems.map((it) =>
            it.id === id
                ? { ...it, portions: newPortions, lastupdated: today }
                : it,
        );
        touchMetadata("fridgestock");
        renderFridgeStock();

        try {
            await sb
                .from("fridgestock")
                .update({ portions: newPortions, lastupdated: today })
                .eq("id", id);
            await loadFridgeStock();
        } catch (err) {
            console.error("Update failed:", err);
        }
        return;
    }

    if (action === "done") {
        const today = new Date().toISOString().slice(0, 10);
        const chore = chores.find((c) => c.id === id);
        if (!chore) return;
        const nextdue = calcChoreNextDue(today, chore.interval);

        chores = chores.map((c) =>
            c.id !== id ? c : { ...c, lastdone: today, nextdue },
        );
        touchMetadata("chores");
        renderChores();

        try {
            await sb
                .from("chores")
                .update({ lastdone: today, nextdue })
                .eq("id", id);
        } catch (err) {
            console.error(err);
            loadChores();
        }
        return;
    }

    if (action === "changelog-done") {
        const today = new Date().toISOString().slice(0, 10);
        const cl = changeLogs.find((c) => c.id === id);
        if (!cl) return;
        const nextdue = calcChangeLogNextDue(today, cl.interval);

        changeLogs = changeLogs.map((c) =>
            c.id !== id ? c : { ...c, lastchanged: today, nextdue },
        );
        touchMetadata("changelog");
        renderChangeLogs();

        try {
            await sb
                .from("changelog")
                .update({ lastchanged: today, nextdue })
                .eq("id", id);
        } catch (err) {
            console.error(err);
            loadChangeLogs();
        }
        return;
    }

    if (action === "paid") {
        const bill = bills.find((b) => b.id === id);
        if (!bill) return;
        const newLast = bill.nextbilldate;
        const newNext = calcBillNextDate(bill.nextbilldate, bill.interval);

        bills = bills.map((b) =>
            b.id !== id
                ? b
                : { ...b, lastbilldate: newLast, nextbilldate: newNext },
        );
        touchMetadata("bills");
        renderBills();

        try {
            await sb
                .from("bills")
                .update({ lastbilldate: newLast, nextbilldate: newNext })
                .eq("id", id);
        } catch (err) {
            console.error(err);
            loadBills();
        }
        return;
    }

    if (action === "plant-log") {
        openPlantEventModal(id);
        return;
    }

    if (action === "plant-save-name") {
        const newName = document
            .getElementById("pdPlantNameInput")
            .value.trim();
        if (!newName) return;
        try {
            await sb.from("plants").update({ plantname: newName }).eq("id", id);
            document.getElementById("plantDetailTitle").textContent =
                newName.toUpperCase();
            touchMetadata("plants");
            renderPlants();
        } catch (err) {
            console.error(err);
            loadPlants();
        }
        return;
    }

    if (action === "plant-archive") {
        const plant = plants.find((p) => p.id === id);
        const archived = !plant.archived;
        try {
            await sb.from("plants").update({ archived }).eq("id", id);
            touchMetadata("plants");
            renderPlants();
            closeModal("plantDetailModal");
        } catch (err) {
            console.error(err);
            loadPlants();
        }
        return;
    }

    if (action === "plant-delete") {
        const plantId = id;
        if (
            confirm(
                "Delete this plant and all its history permanently? This cannot be undone.",
            )
        ) {
            try {
                await sb.from("planthistory").delete().eq("plantid", plantId);
                await sb.from("plants").delete().eq("id", plantId);
                touchMetadata("plants");
                renderPlants();
                closeModal("plantDetailModal");
            } catch (err) {
                console.error("Plant delete failed:", err);
                loadPlants();
                loadPlantHistory();
            }
        }
        return;
    }

    if (action === "plant-history-delete") {
        const plantId = btn.dataset.plantid;
        if (confirm("Delete this history entry?")) {
            try {
                await sb.from("planthistory").delete().eq("id", id);
                touchMetadata("plants");
                openPlantDetail(plantId);
            } catch (err) {
                console.error(err);
                loadPlantHistory();
            }
        }
        return;
    }

    if (action === "note-delete") {
        try {
            await sb.from("notes").delete().eq("id", id);
            touchMetadata("notes");
            renderNotes();
        } catch (err) {
            console.error(err);
            loadNotes();
        }
        return;
    }

    if (e.target.closest("[data-action]")) return;

    const detailRow = e.target.closest("[data-open-detail]");
    if (detailRow) {
        openDetail(detailRow.dataset.openDetail);
        return;
    }

    const choreRow = e.target.closest("[data-open-chore]");
    if (choreRow) {
        openChoreDetail(choreRow.dataset.openChore);
        return;
    }

    const changelogRow = e.target.closest("[data-open-changelog]");
    if (changelogRow) {
        openChangeLogDetail(changelogRow.dataset.openChangelog);
        return;
    }

    const billRow = e.target.closest("[data-open-bill]");
    if (billRow) {
        openBillDetail(billRow.dataset.openBill);
        return;
    }

    const openPlantEl = e.target.closest("[data-open-plant]");
    if (openPlantEl) {
        openPlantDetail(openPlantEl.dataset.openPlant);
        return;
    }
});

// ============================================================
// DOMContentLoaded — wire up all forms and add buttons
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
    document.querySelector(".dashboard").style.display = "none";
    document.getElementById("loginContainer").style.display = "flex";

    await checkSession();

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("loginEmail").value;
            const password = document.getElementById("loginPassword").value;
            await login(email, password);
        });
    }

    [
        "fullSectionModal",
        "detailModal",
        "addModal",
        "plantEventModal",
        "plantDetailModal",
        "addPlantModal",
        "choreDetailModal",
        "changelogDetailModal",
        "billDetailModal",
        "addNoteModal",
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    renderFridgeStock();
    renderChores();
    renderChangeLogs();
    renderBills();
    renderPlants();
    renderNotes();
    setupPanelClicks();

    // --- Fridge: add button ---
    document
        .querySelectorAll('.panel[data-section="fridgestock"] .add-btn')
        .forEach((btn) =>
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                openAddModal();
            }),
        );

    document
        .getElementById("deleteItemBtn")
        ?.addEventListener("click", () =>
            deleteFridgeItem(document.getElementById("editId").value),
        );

    ["editCreatedAt", "editShelflife"].forEach((id) =>
        document.getElementById(id)?.addEventListener("change", () => {
            expiryManuallySet = false;
            recalcExpiry();
        }),
    );
    document.getElementById("editExpiry")?.addEventListener("input", () => {
        expiryManuallySet = true;
        document.getElementById("expiryAutoLabel").style.display = "none";
        document.getElementById("expiryHint").style.display = "none";
    });

    ["addCreatedAt", "addShelflife"].forEach((id) =>
        document.getElementById(id)?.addEventListener("change", () => {
            addExpiryManuallySet = false;
            recalcAddExpiry();
        }),
    );
    document.getElementById("addExpiry")?.addEventListener("input", () => {
        addExpiryManuallySet = true;
        document.getElementById("addExpiryAutoLabel").style.display = "none";
        document.getElementById("addExpiryHint").style.display = "none";
    });

    // Fridge edit form
    document
        .getElementById("editForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const today = new Date().toISOString().slice(0, 10);
            const createdVal = fd.get("createdat");
            const shelfVal = fd.get("shelflifedays")
                ? parseInt(fd.get("shelflifedays"), 10)
                : null;
            const expirydate = expiryManuallySet
                ? fd.get("expirydate")
                : createdVal && shelfVal
                  ? addDays(createdVal, shelfVal)
                  : null;

            const item = {
                id: fd.get("id"),
                itemname: fd.get("itemname"),
                category: fd.get("category"),
                portions: parseInt(fd.get("portions"), 10) || 0,
                shelflifedays: shelfVal,
                createdat: createdVal,
                expirydate,
                lastupdated: today,
            };
            try {
                await saveFridgeItem(item, true);
                closeModal("detailModal");
                expiryManuallySet = false;
            } catch (err) {
                alert("Save failed: " + err.message);
            }
        });

    // Fridge add form
    document
        .getElementById("addForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const today = new Date().toISOString().slice(0, 10);
            const createdVal = fd.get("createdat");
            const shelfVal = fd.get("shelflifedays")
                ? parseInt(fd.get("shelflifedays"), 10)
                : null;
            const expirydate = addExpiryManuallySet
                ? fd.get("expirydate")
                : createdVal && shelfVal
                  ? addDays(createdVal, shelfVal)
                  : null;

            const item = {
                itemname: fd.get("itemname"),
                category: fd.get("category"),
                portions: parseInt(fd.get("portions"), 10) || 1,
                shelflifedays: shelfVal,
                createdat: createdVal || today,
                expirydate,
                lastupdated: today,
            };
            try {
                await saveFridgeItem(item, false);
                closeModal("addModal");
                addExpiryManuallySet = false;
            } catch (err) {
                alert("Add failed: " + err.message);
            }
        });

    // Fridge delete
    document
        .getElementById("deleteItemBtn")
        ?.addEventListener("click", async () => {
            const id = document.getElementById("editId").value;
            if (confirm("Delete this item permanently?")) {
                try {
                    await deleteFridgeItem(id);
                    closeModal("detailModal");
                } catch (err) {
                    alert("Delete failed: " + err.message);
                }
            }
        });

    // --- Chores: add button ---
    document
        .querySelectorAll('.panel[data-section="chores"] .add-btn')
        .forEach((btn) =>
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                editingChoreId = null;
                choreNextDueManuallySet = false;
                document.getElementById("choreEditId").value = "";
                document.getElementById("choreTaskname").value = "";
                document.getElementById("choreLastdone").value = "";
                document.getElementById("choreInterval").value = "7";
                document.getElementById("choreNextdue").value = "";
                document.getElementById("choreDetailTitle").textContent =
                    "ADD CHORE";
                document.getElementById("choreDeleteBtn").style.display =
                    "none";
                openModal("choreDetailModal");
            }),
        );

    ["choreLastdone", "choreInterval"].forEach((id) =>
        document.getElementById(id)?.addEventListener("change", () => {
            choreNextDueManuallySet = false;
            refreshChoreNextDueIfNeeded();
        }),
    );
    document.getElementById("choreNextdue")?.addEventListener("input", () => {
        choreNextDueManuallySet = true;
        document.getElementById("choreNextdueAutoLabel").style.display = "none";
    });

    // Chores form (add/edit shared)
    document
        .getElementById("choreForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const taskname = document
                .getElementById("choreTaskname")
                .value.trim();
            const lastdone =
                document.getElementById("choreLastdone").value || null;
            const interval =
                parseInt(document.getElementById("choreInterval").value, 10) ||
                null;
            const nextdue = choreNextDueManuallySet
                ? document.getElementById("choreNextdue").value
                : lastdone && interval
                  ? calcChoreNextDue(lastdone, interval)
                  : null;

            const chore = {
                id: editingChoreId || undefined,
                taskname,
                lastdone,
                interval,
                nextdue,
            };
            try {
                await saveChore(chore, !!editingChoreId);
                closeModal("choreDetailModal");
                editingChoreId = null;
                choreNextDueManuallySet = false;
            } catch (err) {
                alert("Save failed: " + err.message);
            }
        });

    // Chore delete
    document
        .getElementById("choreDeleteBtn")
        ?.addEventListener("click", async () => {
            if (confirm("Delete this chore?")) {
                try {
                    await deleteChore(editingChoreId);
                    closeModal("choreDetailModal");
                    editingChoreId = null;
                } catch (err) {
                    alert("Delete failed: " + err.message);
                }
            }
        });

    // --- Change Log: add button ---
    document
        .querySelectorAll('.panel[data-section="changelog"] .add-btn')
        .forEach((btn) =>
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                editingChangeLogId = null;
                changelogNextDueManuallySet = false;
                document.getElementById("changelogEditId").value = "";
                document.getElementById("changelogItemname").value = "";
                document.getElementById("changelogLastchanged").value = "";
                document.getElementById("changelogInterval").value = "3";
                document.getElementById("changelogNextdue").value = "";
                document.getElementById(
                    "changelogNextdueAutoLabel",
                ).style.display = "none";
                document.getElementById("changelogDetailTitle").textContent =
                    "ADD CHANGE LOG";
                document.getElementById("changelogDeleteBtn").style.display =
                    "none";
                openModal("changelogDetailModal");
            }),
        );

    ["changelogLastchanged", "changelogInterval"].forEach((id) =>
        document.getElementById(id)?.addEventListener("change", () => {
            changelogNextDueManuallySet = false;
            refreshChangelogNextDue();
        }),
    );
    document
        .getElementById("changelogNextdue")
        ?.addEventListener("input", () => {
            changelogNextDueManuallySet = true;
            document.getElementById("changelogNextdueAutoLabel").style.display =
                "none";
        });

    // Change Log form shared add/edit
    document
        .getElementById("changelogForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const itemname = document
                .getElementById("changelogItemname")
                .value.trim();
            const lastchanged =
                document.getElementById("changelogLastchanged").value || null;
            const interval =
                parseInt(
                    document.getElementById("changelogInterval").value,
                    10,
                ) || null;
            const nextdue = changelogNextDueManuallySet
                ? document.getElementById("changelogNextdue").value
                : lastchanged && interval
                  ? calcChangeLogNextDue(lastchanged, interval)
                  : null;

            const cl = {
                id: editingChangeLogId || undefined,
                itemname,
                lastchanged,
                interval,
                nextdue,
            };
            try {
                await saveChangeLog(cl, !!editingChangeLogId);
                closeModal("changelogDetailModal");
                editingChangeLogId = null;
                changelogNextDueManuallySet = false;
            } catch (err) {
                alert("Save failed: " + err.message);
            }
        });

    // Change Log delete
    document
        .getElementById("changelogDeleteBtn")
        ?.addEventListener("click", async () => {
            if (confirm("Delete this item?")) {
                try {
                    await deleteChangeLog(editingChangeLogId);
                    closeModal("changelogDetailModal");
                    editingChangeLogId = null;
                } catch (err) {
                    alert("Delete failed: " + err.message);
                }
            }
        });

    // --- Bills: add button ---
    document
        .querySelectorAll('.panel[data-section="bills"] .add-btn')
        .forEach((btn) =>
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                editingBillId = null;
                billNextDateManuallySet = false;
                document.getElementById("billEditId").value = "";
                document.getElementById("billBillname").value = "";
                document.getElementById("billLastbilldate").value = "";
                document.getElementById("billInterval").value = "1";
                document.getElementById("billNextbilldate").value = "";
                document.getElementById(
                    "billNextbilldateAutoLabel",
                ).style.display = "none";
                document.getElementById("billDetailTitle").textContent =
                    "ADD BILL";
                document.getElementById("billDeleteBtn").style.display = "none";
                openModal("billDetailModal");
            }),
        );

    ["billLastbilldate", "billInterval"].forEach((id) =>
        document.getElementById(id)?.addEventListener("change", () => {
            billNextDateManuallySet = false;
            refreshBillNextDate();
        }),
    );
    document
        .getElementById("billNextbilldate")
        ?.addEventListener("input", () => {
            billNextDateManuallySet = true;
            document.getElementById("billNextbilldateAutoLabel").style.display =
                "none";
        });

    // Bills form shared add/edit
    document
        .getElementById("billForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const billname = document
                .getElementById("billBillname")
                .value.trim();
            const lastbilldate =
                document.getElementById("billLastbilldate").value || null;
            const interval =
                parseInt(document.getElementById("billInterval").value, 10) ||
                null;
            const nextbilldate = billNextDateManuallySet
                ? document.getElementById("billNextbilldate").value
                : lastbilldate && interval
                  ? calcBillNextDate(lastbilldate, interval)
                  : null;

            const bill = {
                id: editingBillId || undefined,
                billname,
                lastbilldate,
                interval,
                nextbilldate,
            };
            try {
                await saveBill(bill, !!editingBillId);
                closeModal("billDetailModal");
                editingBillId = null;
                billNextDateManuallySet = false;
            } catch (err) {
                alert("Save failed: " + err.message);
            }
        });

    // Bill delete
    document
        .getElementById("billDeleteBtn")
        ?.addEventListener("click", async () => {
            if (confirm("Delete this bill?")) {
                try {
                    await deleteBill(editingBillId);
                    closeModal("billDetailModal");
                    editingBillId = null;
                } catch (err) {
                    alert("Delete failed: " + err.message);
                }
            }
        });

    // --- Plants: add button ---
    document
        .querySelectorAll('.panel[data-section="plants"] .add-btn')
        .forEach((btn) =>
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                openAddPlantModal();
            }),
        );

    // Plants add
    document
        .getElementById("addPlantForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("addPlantName").value.trim();
            const startDate =
                document.getElementById("addPlantStartDate").value;
            if (!name) return;
            const plant = {
                plantname: name,
                startingdate: startDate,
                archived: false,
            };
            try {
                const sb = await initSupabase();
                await sb
                    .from("plants")
                    .insert([
                        { ...plant, userid: sb.auth.getUser().data.user.id },
                    ]);
                await loadPlants();
                loadPlantHistory();
                closeModal("addPlantModal");
            } catch (err) {
                alert("Add failed: " + err.message);
            }
        });

    // --- Plants: fertilised checkbox toggle ---
    document
        .getElementById("fertilisedCheck")
        ?.addEventListener("change", (e) => {
            document.getElementById("fertiliserSelectWrap").style.display = e
                .target.checked
                ? "block"
                : "none";
        });

    // Plants event form
    document
        .getElementById("plantEventForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const plantId = fd.get("plantId");
            const watered = document.getElementById("wateredCheck").checked;
            const fertilised =
                document.getElementById("fertilisedCheck").checked;
            const fertiliserUsed = fertilised ? fd.get("fertiliser") : null;
            const potsizeVal = parseInt(fd.get("potsize"), 10);
            const notesVal = fd.get("notes").trim();

            const now = new Date();
            const today = now.toISOString().slice(0, 10);
            const resolvedPotsize =
                !isNaN(potsizeVal) && potsizeVal > 0 ? potsizeVal : null;

            try {
                await savePlantHistory({
                    plantid: plantId,
                    eventdate: now.toISOString(),
                    potsize: resolvedPotsize,
                    watered,
                    fertilised,
                    fertiliserused: fertiliserUsed,
                    notes: notesVal,
                });

                await updatePlant(plantId, {
                    potsize: resolvedPotsize,
                    ...(watered && { lastwatered: today }),
                    ...(fertilised && {
                        lastfertilised: today,
                        lastfertiliser: fertiliserUsed,
                    }),
                    ...(notesVal && { notes: notesVal }),
                });

                closeModal("plantEventModal");
            } catch (err) {
                alert("Record failed: " + err.message);
            }
        });

    // --- Notes: add button ---
    document
        .querySelectorAll('.panel[data-section="notes"] .add-btn')
        .forEach((btn) =>
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                document.getElementById("addNoteContent").value = "";
                openModal("addNoteModal");
            }),
        );

    // Notes add
    document
        .getElementById("addNoteForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const content = document
                .getElementById("addNoteContent")
                .value.trim();
            if (!content) return;
            try {
                const sb = await initSupabase();
                await sb
                    .from("notes")
                    .insert([
                        { content, userid: sb.auth.getUser().data.user.id },
                    ]);
                await loadNotes();
                closeModal("addNoteModal");
            } catch (err) {
                alert("Add failed: " + err.message);
            }
        });
});
