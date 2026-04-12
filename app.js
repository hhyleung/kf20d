// SUPABASE
const SUPABASE_URL = "https://ilfrtrfohdhoquemptmj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_s8LcKiFr_XOf_fg9O2ubBQ_8mElMJ6L";
let sbClient = null;
let isAuthenticated = false;
let realtimeSetupDone = false;
let subscriptions = [];

// LISTS
const fridgeCategoryOrder = [
    "Carbs",
    "Veggies",
    "Proteins",
    "Fruits",
    "Others",
    "Raw Food",
];
let fridgeStock = [];
let chores = [];
let changeLog = [];
let bills = [];
let plants = [];
let plantHistory = [];
let notes = [];

// LIST METADATA
const LIST_META_KEYS = [
    "fridge_stock",
    "chores",
    "bills",
    "change_log",
    "plants",
    "notes",
];
let listMetadata = {};
LIST_META_KEYS.forEach((key) => (listMetadata[key] = null));

// STATE FLAGS
let editingFridgeStockId = null;
let fridgeStockExpiryManuallySet = false;
let editingChoreId = null;
let choreNextDueManuallySet = false;
let editingChangeLogId = null;
let changeLogNextDueManuallySet = false;
let editingBillId = null;
let billNextDateManuallySet = false;
let currentFullList = null;

// SUPABASE CONNECTION
async function initSupabase() {
    if (sbClient) return sbClient;
    try {
        sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
            },
        });
        console.log("Supabase initialised");
        return sbClient;
    } catch (error) {
        console.error("Supabase init failed:", error);
        sbClient = null;
        return null;
    }
}

async function ensureSupabaseReady() {
    while (!sbClient) {
        await initSupabase();
        if (!sbClient) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return sbClient;
}

function subscribeToTable(tableName, renderFunc) {
    ensureSupabaseReady()
        .then((sb) => {
            if (!sb) return;
            const channelName = `${tableName}_${Date.now()}`;
            const channel = sb.channel(channelName);
            channel
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: tableName,
                    },
                    renderFunc,
                )
                .subscribe((status) => {
                    console.log(`Realtime ${tableName}: ${status}`);
                });
            subscriptions.push(channel);
        })
        .catch(console.error);
}

async function setupRealtime() {
    cleanupSubscriptions();

    const sb = await ensureSupabaseReady();
    if (!sb || !sb.auth.getSession()) {
        console.log("Skipping realtime - not ready");
        return;
    }

    const {
        data: { user },
    } = await sb.auth.getUser();
    if (!user?.id) {
        console.log("Skipping realtime - no user");
        return;
    }

    subscribeToTable("fridge_stock", renderFridgeStock);
    subscribeToTable("chores", renderChores);
    subscribeToTable("change_log", renderChangeLog);
    subscribeToTable("bills", renderBills);
    subscribeToTable("plants", renderPlants);
    subscribeToTable("plant_history", () => {
        loadPlantHistory().then(renderPlants);
    });
    subscribeToTable("notes", renderNotes);
}

function cleanupSubscriptions() {
    subscriptions.forEach((sub) => {
        const sb = sbClient;
        if (sb) {
            sb.removeChannel(sub);
        }
    });
    subscriptions = [];
    console.log("Realtime subscriptions cleaned up");
}

async function checkSession() {
    try {
        const sb = await ensureSupabaseReady();
        if (!sb) {
            console.error("Supabase not ready for session check");
            showLogin();
            return;
        }

        const {
            data: { session },
        } = await sb.auth.getSession();
        console.log("Session check:", session ? "logged in" : "not logged in");

        if (session) {
            isAuthenticated = true;
            showDashboard();
        } else {
            isAuthenticated = false;
            showLogin();
        }
    } catch (err) {
        console.error("Session check error:", err);
        isAuthenticated = false;
        showLogin();
    }
}

async function login(email, password) {
    try {
        const sb = await ensureSupabaseReady();
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
        alert(`Login failed：${error.message}`);
    }
}

// PAGE INIT
function showLogin() {
    document.getElementById("loginContainer").style.display = "flex";
    document.querySelector(".dashboard").style.display = "none";
    cleanupSubscriptions();
    realtimeSetupDone = false;
}

async function showDashboard() {
    document.getElementById("loginContainer").style.display = "none";
    const dash = document.querySelector(".dashboard");
    dash.style.removeProperty("display");
    dash.style.display = "grid";

    setupPanelClicks();
    await loadAllData();

    renderFridgeStock();
    renderChores();
    renderChangeLog();
    renderBills();
    renderPlants();
    renderNotes();

    if (!realtimeSetupDone) {
        realtimeSetupDone = true;
        setTimeout(setupRealtime, 500);
    }
}

// DATA LOADERS
async function loadFridgeStock() {
    try {
        const sb = await ensureSupabaseReady();
        if (!sb) {
            console.error("Supabase not ready for loadFridgeStock");
            return;
        }
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) {
            console.error("No user for loadFridgeStock");
            fridgeStock = [];
            return;
        }

        const { data, error } = await sb
            .from("fridge_stock")
            .select("*")
            .eq("user_id", user.id)
            .order("item_name", { ascending: true, nullsFirst: true })
            .order("last_updated", { ascending: false, nullsLast: true });

        if (error) throw error;
        fridgeStock = data || [];
        console.log("Fridge stock loaded:", fridgeStock.length, "items");
    } catch (err) {
        console.error("Load fridge_stock error:", err);
        fridgeStock = [];
    }
}

async function loadChores() {
    try {
        const sb = await ensureSupabaseReady();
        if (!sb) {
            console.error("Supabase not ready for loadChores");
            return;
        }
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) {
            console.error("No user for loadChores");
            chores = [];
            return;
        }

        const { data, error } = await sb
            .from("chores")
            .select("*")
            .eq("user_id", user.id)
            .order("task_name", { ascending: true, nullsFirst: true });

        if (error) throw error;
        chores = data || [];
        console.log("Chores loaded:", chores.length);
    } catch (err) {
        console.error("Load chores error:", err);
        chores = [];
    }
}

async function loadChangeLog() {
    try {
        const sb = await ensureSupabaseReady();
        if (!sb) {
            console.error("Supabase not ready for loadChangeLog");
            return;
        }
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) {
            console.error("No user for loadChangeLog");
            changeLog = [];
            return;
        }

        const { data, error } = await sb
            .from("change_log")
            .select("*")
            .eq("user_id", user.id)
            .order("item_name", { ascending: true, nullsFirst: true });

        if (error) throw error;
        changeLog = data || [];
        console.log("Change Log loaded:", changeLog.length);
    } catch (err) {
        console.error("Load change_log error:", err);
        changeLog = [];
    }
}

async function loadBills() {
    try {
        const sb = await ensureSupabaseReady();
        if (!sb) {
            console.error("Supabase not ready for loadBills");
            return;
        }
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) {
            console.error("No user for loadBills");
            bills = [];
            return;
        }

        const { data, error } = await sb
            .from("bills")
            .select("*")
            .eq("user_id", user.id)
            .order("bill_name", { ascending: true, nullsFirst: true });

        if (error) throw error;
        bills = data || [];
        console.log("Bills loaded:", bills.length);
    } catch (err) {
        console.error("Load bills error:", err);
        bills = [];
    }
}

async function loadPlants() {
    try {
        const sb = await ensureSupabaseReady();
        if (!sb) {
            console.error("Supabase not ready for loadPlants");
            return;
        }
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) {
            console.error("No user for loadPlants");
            plants = [];
            return;
        }

        const { data, error } = await sb
            .from("plants")
            .select("*")
            .eq("user_id", user.id)
            .order("plant_name", { ascending: true, nullsFirst: true });

        if (error) throw error;
        plants = data || [];
        console.log("Plants loaded:", plants.length);
    } catch (err) {
        console.error("Load plants error:", err);
        plants = [];
    }
}

async function loadPlantHistory() {
    try {
        const sb = await ensureSupabaseReady();
        if (!sb) {
            console.error("Supabase not ready for loadPlantHistory");
            return;
        }

        const { data, error } = await sb
            .from("plant_history")
            .select("*")
            .order("event_date", { ascending: false, nullsLast: true });

        if (error) throw error;
        plantHistory = data || [];
        console.log("Plant history loaded:", plantHistory.length);
    } catch (err) {
        console.error("Load plant_history error:", err);
        plantHistory = [];
    }
}

async function loadNotes() {
    try {
        const sb = await ensureSupabaseReady();
        if (!sb) {
            console.error("Supabase not ready for loadNotes");
            return;
        }
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) {
            console.error("No user for loadNotes");
            notes = [];
            return;
        }

        const { data, error } = await sb
            .from("notes")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true, nullsFirst: true });

        if (error) throw error;
        notes = data || [];
        console.log("Notes loaded:", notes.length);
    } catch (err) {
        console.error("Load notes error:", err);
        notes = [];
    }
}

async function loadAllData() {
    try {
        await Promise.all([
            loadFridgeStock(),
            loadChores(),
            loadChangeLog(),
            loadBills(),
            loadPlants(),
            loadPlantHistory(),
            loadNotes(),
        ]);
        console.log("All data loaded");
    } catch (err) {
        console.error("loadAllData failed:", err);
    }
}

// PANEL BUILDERS
// FRIDGE STOCK
function getVisibleItems(showZero = false) {
    return fridgeStock.filter((item) => showZero || item.portions > 0);
}

function groupByCategory(items) {
    const grouped = {};
    fridgeCategoryOrder.forEach((cat) => (grouped[cat] = []));
    items.forEach((item) => {
        const cat = fridgeCategoryOrder.includes(item.category)
            ? item.category
            : "Others";
        grouped[cat].push(item);
    });
    return grouped;
}

function getExpiryClass(expiryDate) {
    if (!expiryDate) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate + "T00:00:00Z");
    const diffDays = Math.floor((expiry - today) / 86400000);
    if (diffDays < 0) return "expiry-danger";
    if (diffDays <= 7) return "expiry-warning";
    return "";
}

function fridgeItemRow(item, showZero = false) {
    const expiryClass = getExpiryClass(item.expiry_date);
    const isRaw = item.category === "Raw Food";
    const dateVal = isRaw ? item.expiry_date : item.created_at;
    const dateStr = dateVal
        ? `<span class="item-seps"></span><span class="fridge-date">${formatShortDate(dateVal)}</span>`
        : "";

    const portionsDisplay =
        item.portions === 0 && showZero
            ? `<span class="portion-zero">${item.portions}</span>`
            : `<span class="portion-number">${item.portions}</span>`;

    const zeroClass = item.portions === 0 ? " zero-portions" : "";

    return `<li class="item-row${zeroClass}" data-open-detail="${item.id}">
    <span class="item-key ${expiryClass}">${item.item_name}</span>
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
    const forceFullWidth = ["Proteins", "Raw Food"];

    let html = '<div class="fridge-inner-grid">';
    fridgeCategoryOrder.forEach((cat) => {
        const catItems = grouped[cat];
        const alwaysHalfWidth = ["Carbs", "Veggies", "Fruits", "Others"];
        const wide =
            !alwaysHalfWidth.includes(cat) ||
            catItems.length >= 3 ||
            forceFullWidth.includes(cat);
        const cls = wide ? "col-full" : "col-half";

        if (catItems.length === 0) {
            html += `<div class="fridge-group ${cls}">
        <div class="fridge-group-title">${cat}</div>
        <div class="fridge-empty">No items</div>
      </div>`;
        } else {
            html += `<div class="fridge-group ${cls}">
        <div class="fridge-group-title">${cat}</div>
        <ul class="item-list ${wide ? "two-col-list" : ""}">`;
            catItems.forEach((item) => {
                html += fridgeItemRow(item, showZero);
            });
            html += "</ul></div>";
        }
    });
    html += "</div>";
    return html;
}

function renderFridgeStock() {
    document.getElementById("fridgeStockContent").innerHTML =
        buildFridgeHTML(false);
    if (currentFullList === "fridge_stock") {
        document.getElementById("fullListContent").innerHTML =
            buildFridgeHTML(true);
    }
}

// CHORES
function getDueClass(nextDueDate) {
    if (!nextDueDate) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(nextDueDate + "T00:00:00Z");
    const diffDays = Math.floor((due - today) / 86400000);
    if (diffDays < 0) return "due-danger";
    if (diffDays <= 3) return "due-warning";
    return "";
}

function buildChoresHTML() {
    let html = '<ul class="item-list">';
    chores.forEach((chore) => {
        const dueClass = getDueClass(chore.next_due_date);
        const lastDoneText = chore.last_done_date
            ? formatShortDate(chore.last_done_date)
            : "Never";
        const nextDueText = chore.next_due_date
            ? formatShortDate(chore.next_due_date)
            : "";
        const intervalText = chore.interval_days
            ? `${chore.interval_days}d`
            : "";

        html += `<li class="item-row" data-open-chore="${chore.id}">
      <span class="item-key ${dueClass}">${chore.task_name}</span>
      <span class="item-value">
        <span class="item-meta">
          ${lastDoneText} → ${nextDueText} ${intervalText}
        </span>
        <button class="action-btn" data-action="done" data-id="${chore.id}" title="Mark done">✓</button>
      </span>
    </li>`;
    });
    html += "</ul>";
    return html;
}

function renderChores() {
    document.getElementById("choresContent").innerHTML = buildChoresHTML();
    if (currentFullList === "chores") {
        document.getElementById("fullListContent").innerHTML =
            buildChoresHTML();
    }
}

// CHANGE LOG
function buildChangeLogHTML() {
    let html = '<ul class="item-list">';
    changeLog.forEach((cl) => {
        const dueClass = getDueClass(cl.next_change_due);
        const lastChangedText = cl.last_changed_date
            ? formatShortDate(cl.last_changed_date)
            : "Never";
        const nextDueText = cl.next_change_due
            ? formatShortDate(cl.next_change_due)
            : "";
        const intervalText = cl.interval_months
            ? `${cl.interval_months}mo`
            : "";

        html += `<li class="item-row" data-open-changelog="${cl.id}">
      <span class="item-key ${dueClass}">${cl.item_name}</span>
      <span class="item-value">
        <span class="item-meta">
          ${lastChangedText} → ${nextDueText} ${intervalText}
        </span>
        <button class="action-btn" data-action="changed" data-id="${cl.id}" title="Mark changed">✓</button>
      </span>
    </li>`;
    });
    html += "</ul>";
    return html;
}

function renderChangeLog() {
    document.getElementById("changelogContent").innerHTML =
        buildChangeLogHTML();
    if (currentFullList === "change_log") {
        document.getElementById("fullListContent").innerHTML =
            buildChangeLogHTML();
    }
}

// BILLS
function buildBillsHTML() {
    let html = '<ul class="item-list">';
    bills.forEach((bill) => {
        const dueClass = getDueClass(bill.next_bill_date);
        const nextDueText = bill.next_bill_date
            ? formatShortDate(bill.next_bill_date)
            : "";
        const intervalText = bill.interval_months
            ? `${bill.interval_months}mo`
            : "";

        html += `<li class="item-row" data-open-bill="${bill.id}">
      <span class="item-key ${dueClass}">${bill.bill_name}</span> 
      <span class="item-value">
        <span class="item-meta">
          ${nextDueText} ${intervalText}
        </span>
        <button class="action-btn" data-action="paid" data-id="${bill.id}" title="Mark paid">✓</button>
      </span>
    </li>`;
    });
    html += "</ul>";
    return html;
}

function renderBills() {
    document.getElementById("billsContent").innerHTML = buildBillsHTML();
    if (currentFullList === "bills") {
        document.getElementById("fullListContent").innerHTML = buildBillsHTML();
    }
}

// PLANTS
function buildPlantsHTML(showArchived = false) {
    const visible = showArchived ? plants : plants.filter((p) => !p.archived);

    if (!visible.length) {
        return '<p style="color: var(--text-secondary); font-style: italic; font-size: var(--item-font); padding: 0.5rem 0;">No plants</p>';
    }

    let html = '<ul class="item-list">';
    visible.forEach((p) => {
        html += `<li class="item-row" data-open-plant="${p.id}">
      <span class="item-key">
        ${p.plant_name} ${p.archived ? '<span class="plant-archived-tag">archived</span>' : ""}
      </span>
      <span class="item-value">
        <span class="item-meta">
          ${p.pot_size ? `${p.pot_size}cm` : ""}
        </span>
        <button class="action-btn" data-action="plant-log" data-id="${p.id}" title="Log event">📝</button>
      </span>
    </li>`;
    });
    html += "</ul>";
    return html;
}

function renderPlants() {
    document.getElementById("plantsContent").innerHTML = buildPlantsHTML(false);
    if (currentFullList === "plants") {
        document.getElementById("fullListContent").innerHTML =
            buildPlantsHTML(true);
    }
}

// NOTES
function buildNotesHTML() {
    let html = '<ul class="item-list">';
    notes.forEach((note) => {
        html += `<li class="item-row">
      <span class="item-key">${note.content}</span>
      <span class="item-value">
        <button class="action-btn" data-action="note-delete" data-id="${note.id}" title="Delete note">×</button>
      </span>
    </li>`;
    });
    html += "</ul>";
    return html;
}

function renderNotes() {
    document.getElementById("notesContent").innerHTML = buildNotesHTML();
    if (currentFullList === "notes") {
        document.getElementById("fullListContent").innerHTML = buildNotesHTML();
    }
}

// FULL LIST
function buildFullListHTML(list) {
    switch (list) {
        case "fridge_stock":
            return buildFridgeHTML(true);
        case "chores":
            return buildChoresHTML();
        case "change_log":
            return buildChangeLogHTML();
        case "bills":
            return buildBillsHTML();
        case "plants":
            return buildPlantsHTML(true);
        case "notes":
            return buildNotesHTML();
        default:
            return "<p>List not found</p>";
    }
}

// MODAL BUILDERS
function openModal(id) {
    document.getElementById(id).style.display = "flex";
}

function closeModal(id) {
    document.getElementById(id).style.display = "none";
    if (id === "fullListModal") {
        currentFullList = null;
    }
}

// FRIDGE STOCK
function openFridgeStockDetail(itemId = null) {
    const isEditing = !!itemId;
    editingFridgeStockId = itemId;

    document.getElementById("fridgeStockEditId").value = itemId || "";
    document.getElementById("fridgeStockItemName").value = "";
    document.getElementById("fridgeStockCategory").value = "Carbs";
    document.getElementById("fridgeStockPortions").value = "1";
    document.getElementById("fridgeStockShelfLife").value = "";
    document.getElementById("fridgeStockCreatedAt").value = new Date()
        .toISOString()
        .slice(0, 10);
    document.getElementById("fridgeStockExpiryDate").value = "";

    document.getElementById("fridgeStockModalTitle").textContent = isEditing
        ? "EDIT FRIDGE ITEM"
        : "ADD FRIDGE ITEM";

    if (isEditing) {
        const item = fridgeStock.find((i) => i.id === itemId);
        if (!item) return;

        document.getElementById("fridgeStockItemName").value = item.item_name;
        document.getElementById("fridgeStockCategory").value =
            item.category || "Carbs";
        document.getElementById("fridgeStockPortions").value =
            item.portions || 0;
        document.getElementById("fridgeStockShelfLife").value =
            item.shelf_life_days || "";
        document.getElementById("fridgeStockCreatedAt").value = formatDateInput(
            item.created_at,
        );
        document.getElementById("fridgeStockExpiryDate").value =
            formatDateInput(item.expiry_date);

        const expectedExpiry =
            item.created_at && item.shelf_life_days
                ? addDays(item.created_at, item.shelf_life_days)
                : null;
        fridgeStockExpiryManuallySet = !!(
            item.expiry_date && item.expiry_date !== expectedExpiry
        );

        document.getElementById("fridgeStockLastUpdated").textContent =
            item.last_updated ? formatShortDate(item.last_updated) : "";
    } else {
        fridgeStockExpiryManuallySet = false;
    }

    document.getElementById("fridgeStockDeleteBtn").style.display = isEditing
        ? "block"
        : "none";
    calcFridgeStockExpiry();
    openModal("fridgeStockDetailModal");
}

// CHORES
function openChoreDetail(choreId = null) {
    const isEditing = !!choreId;
    editingChoreId = choreId;

    document.getElementById("choreEditId").value = choreId || "";
    document.getElementById("choreTaskName").value = "";
    document.getElementById("choreLastDoneDate").value = "";
    document.getElementById("choreIntervalDays").value = "7";
    document.getElementById("choreNextDueDate").value = "";

    document.getElementById("choreDetailTitle").textContent = isEditing
        ? "EDIT CHORE"
        : "ADD CHORE";

    if (isEditing) {
        const chore = chores.find((c) => c.id === choreId);
        if (!chore) return;

        document.getElementById("choreTaskName").value = chore.task_name;
        document.getElementById("choreLastDoneDate").value = formatDateInput(
            chore.last_done_date,
        );
        document.getElementById("choreIntervalDays").value =
            chore.interval_days || "7";
        document.getElementById("choreNextDueDate").value = formatDateInput(
            chore.next_due_date,
        );

        const expectedNextDue =
            chore.last_done_date && chore.interval_days
                ? calcNextDueByDays(chore.last_done_date, chore.interval_days)
                : null;
        choreNextDueManuallySet = !!(
            chore.next_due_date && chore.next_due_date !== expectedNextDue
        );
    } else {
        choreNextDueManuallySet = false;
    }

    document.getElementById("choreDeleteBtn").style.display = isEditing
        ? "block"
        : "none";

    if (!choreNextDueManuallySet) {
        refreshChoreNextDue();
    }

    openModal("choreDetailModal");
}

function refreshChoreNextDue() {
    if (choreNextDueManuallySet) return;

    const lastDoneEl = document.getElementById("choreLastDoneDate");
    const intervalEl = document.getElementById("choreIntervalDays");
    const nextDueEl = document.getElementById("choreNextDueDate");
    const autoLabelEl = document.getElementById("choreNextDueDateAutoLabel");

    const lastDone = lastDoneEl?.value;
    const interval = parseInt(intervalEl?.value || "0", 10);

    if (lastDone && interval > 0) {
        nextDueEl.value = calcNextDueByDays(lastDone, interval);
        if (autoLabelEl) autoLabelEl.style.display = "inline-block";
    } else {
        nextDueEl.value = "";
        if (autoLabelEl) autoLabelEl.style.display = "none";
    }
}

// CHANGE LOG
function openChangeLogDetail(clId = null) {
    const isEditing = !!clId;
    editingChangeLogId = clId;

    document.getElementById("changeLogEditId").value = clId || "";
    document.getElementById("changeLogItemName").value = "";
    document.getElementById("changeLogLastChanged").value = "";
    document.getElementById("changeLogIntervalMonths").value = "3";
    document.getElementById("changeLogNextDueDate").value = "";

    document.getElementById("changeLogDetailTitle").textContent = isEditing
        ? "EDIT CHANGE LOG"
        : "ADD CHANGE LOG";

    if (isEditing) {
        const cl = changeLog.find((c) => c.id === clId);
        if (!cl) return;

        document.getElementById("changeLogItemName").value = cl.item_name;
        document.getElementById("changeLogLastChanged").value = formatDateInput(
            cl.last_changed_date,
        );
        document.getElementById("changeLogIntervalMonths").value =
            cl.interval_months || "6";
        document.getElementById("changeLogNextDueDate").value = formatDateInput(
            cl.next_change_due,
        );

        const expectedNextDue =
            cl.last_changed_date && cl.interval_months
                ? calcNextDueByMonths(cl.last_changed_date, cl.interval_months)
                : null;
        changelogNextDueManuallySet = !!(
            cl.next_change_due && cl.next_change_due !== expectedNextDue
        );
    } else {
        changelogNextDueManuallySet = false;
    }

    document.getElementById("changeLogDeleteBtn").style.display = isEditing
        ? "block"
        : "none";

    if (!changelogNextDueManuallySet) {
        refreshChangeLogNextDue();
    }

    openModal("changeLogDetailModal");
}

function refreshChangeLogNextDue() {
    if (changelogNextDueManuallySet) return;

    const lastChangedEl = document.getElementById("changeLogLastChanged");
    const intervalEl = document.getElementById("changeLogIntervalMonths");
    const nextDueEl = document.getElementById("changeLogNextDueDate");
    const autoLabelEl = document.getElementById(
        "changeLogNextDueDateAutoLabel",
    );

    const lastChanged = lastChangedEl?.value;
    const intervalMonths = parseInt(intervalEl?.value || "0", 10);

    if (lastChanged && intervalMonths > 0) {
        nextDueEl.value = calcNextDueByMonths(lastChanged, intervalMonths);
        if (autoLabelEl) autoLabelEl.style.display = "inline-block";
    } else {
        nextDueEl.value = "";
        if (autoLabelEl) autoLabelEl.style.display = "none";
    }
}

// BILLS
function openBillDetail(billId = null) {
    const isEditing = !!billId;
    editingBillId = billId;

    document.getElementById("billEditId").value = billId || "";
    document.getElementById("billBillName").value = "";
    document.getElementById("billLastBillDate").value = "";
    document.getElementById("billIntervalMonths").value = "1";
    document.getElementById("billNextBillDate").value = "";

    document.getElementById("billDetailTitle").textContent = isEditing
        ? "EDIT BILL"
        : "ADD BILL";

    if (isEditing) {
        const bill = bills.find((b) => b.id === billId);
        if (!bill) return;

        document.getElementById("billBillName").value = bill.bill_name;
        document.getElementById("billLastBillDate").value = formatDateInput(
            bill.last_bill_date,
        );
        document.getElementById("billIntervalMonths").value =
            bill.interval_months || "1";
        document.getElementById("billNextBillDate").value = formatDateInput(
            bill.next_bill_date,
        );

        const expectedNextDate =
            bill.last_bill_date && bill.interval_months
                ? calcNextDueByMonths(bill.last_bill_date, bill.interval_months)
                : null;
        billNextDateManuallySet = !!(
            bill.next_bill_date && bill.next_bill_date !== expectedNextDate
        );
    } else {
        billNextDateManuallySet = false;
    }

    document.getElementById("billDeleteBtn").style.display = isEditing
        ? "block"
        : "none";

    if (!billNextDateManuallySet) {
        refreshBillNextDate();
    }

    openModal("billDetailModal");
}

function refreshBillNextDate() {
    if (billNextDateManuallySet) return;

    const lastDateEl = document.getElementById("billLastBillDate");
    const intervalEl = document.getElementById("billIntervalMonths");
    const nextDateEl = document.getElementById("billNextBillDate");
    const autoLabelEl = document.getElementById("billNextBillDateAutoLabel");

    const lastDate = lastDateEl?.value;
    const intervalMonths = parseInt(intervalEl?.value || "0", 10);

    if (lastDate && intervalMonths > 0) {
        nextDateEl.value = calcNextDueByMonths(lastDate, intervalMonths);
        if (autoLabelEl) autoLabelEl.style.display = "inline-block";
    } else {
        nextDateEl.value = "";
        if (autoLabelEl) autoLabelEl.style.display = "none";
    }
}

// PLANTS
function openPlantAddModal() {
    document.getElementById("addPlantName").value = "";
    document.getElementById("addPlantStartingDate").value = new Date()
        .toISOString()
        .slice(0, 10);
    openModal("plantAddModal");
}

function openPlantDetail(plantId) {
    const plant = plants.find((p) => p.id === plantId);
    if (!plant) return;

    document.getElementById("plantDetailTitle").textContent =
        plant.plant_name.toUpperCase();
    document.getElementById("pdPlantNameInput").value = plant.plant_name;
    document.getElementById("pdSaveNameBtn").dataset.id = plantId;

    document.getElementById("pdStartingDate").textContent = plant.starting_date
        ? formatShortDate(plant.starting_date)
        : "";
    document.getElementById("pdPotSize").textContent = plant.pot_size
        ? `${plant.pot_size}cm`
        : "";
    document.getElementById("pdLastWatered").textContent =
        plant.last_watered_date ? formatShortDate(plant.last_watered_date) : "";
    document.getElementById("pdLastFertilised").textContent =
        plant.last_fertilised_date
            ? formatShortDate(plant.last_fertilised_date)
            : "";
    document.getElementById("pdFertiliserUsed").textContent =
        plant.last_fertiliser_used || "";

    const history = plantHistory
        .filter((h) => h.plant_id === plantId)
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));

    const tbody = document.getElementById("pdHistoryBody");
    if (!history.length) {
        tbody.innerHTML =
            '<tr><td colspan="7" style="color: var(--text-secondary); font-style: italic; text-align: center; padding: 1.4rem;">No history yet</td></tr>';
    } else {
        tbody.innerHTML = history
            .map(
                (h) => `
      <tr>
        <td>${formatShortDate(h.event_date)}</td>
        <td>${h.pot_size ? `${h.pot_size}cm` : ""}</td>
        <td class="${h.watered ? "check-yes" : "check-no"}">${h.watered ? "✓" : ""}</td>
        <td class="${h.fertilised ? "check-yes" : "check-no"}">${h.fertilised ? "✓" : ""}</td>
        <td>${h.fertiliser_used || ""}</td>
        <td>${h.notes || ""}</td>
        <td>
          <button class="action-btn" data-action="plant-history-delete" 
                  data-id="${h.id}" data-plantid="${plantId}"
                  style="font-size: 0.9rem; width: 32px; height: 32px;">×</button>
        </td>
      </tr>
    `,
            )
            .join("");
    }

    const archiveBtn = document.getElementById("pdArchiveBtn");
    archiveBtn.dataset.id = plantId;
    archiveBtn.textContent = plant.archived
        ? "Unarchive Plant"
        : "Archive Plant";
    archiveBtn.classList.toggle("is-archived", !!plant.archived);

    document.getElementById("pdDeleteBtn").dataset.id = plantId;
    openModal("plantDetailModal");
}

function openPlantEventModal(plantId) {
    const plant = plants.find((p) => p.id === plantId);
    if (!plant) return;

    document.getElementById("plantEventTitle").textContent =
        plant.plant_name.toUpperCase();
    document.getElementById("plantEventId").value = plantId;
    document.getElementById("wateredCheck").checked = false;
    document.getElementById("fertilisedCheck").checked = false;
    document.getElementById("fertiliserSelectWrap").style.display = "none";
    document.getElementById("plantEventPotSize").value = plant.pot_size || "";
    document.getElementById("plantEventNotes").value = "";

    openModal("plantEventModal");
}

// FULL LIST
function setupPanelClicks() {
    const listMetaKeyMap = {
        fridge_stock: "fridge_stock",
        chores: "chores",
        bills: "bills",
        change_log: "change_log",
        plants: "plants",
        notes: "notes",
    };

    document.querySelectorAll(".panel-header h3").forEach((h3) => {
        h3.addEventListener("click", (e) => {
            const panel = e.target.closest(".panel");
            const section = panel.dataset.section;
            const metaKey = listMetaKeyMap[section];

            if (section) {
                document.getElementById("listTitle").textContent =
                    h3.textContent.toUpperCase();
                currentFullList = section;
                document.getElementById("fullListContent").innerHTML =
                    buildFullListHTML(section);
                refreshListLastUpdated();
                openModal("fullListModal");
            }
        });
    });

    document.querySelectorAll(".panel .add-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const section = btn.closest(".panel").dataset.section;
            switch (section) {
                case "fridge_stock":
                    openFridgeStockDetail();
                    break;
                case "chores":
                    openChoreDetail();
                    break;
                case "change_log":
                    openChangeLogDetail();
                    break;
                case "bills":
                    openBillDetail();
                    break;
                case "plants":
                    openPlantAddModal();
                    break;
                case "notes":
                    openModal("noteAddModal");
                    break;
            }
        });
    });
}

function refreshListLastUpdated() {
    if (!currentFullList) return;

    const metaToList = {
        fridge_stock: "fridge_stock",
        chores: "chores",
        bills: "bills",
        change_log: "change_log",
        plants: "plants",
        notes: "notes",
    };

    const listName = metaToList[currentFullList];
    if (!listName) return;

    const el = document.getElementById("listLastUpdated");
    if (el) {
        el.textContent = formatMetaTimestamp(listMetadata[listName]);
    }
}

// DATE HANDLERS
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

// DATE CALCULATORS
function calcFridgeStockExpiry() {
    if (fridgeStockExpiryManuallySet) return;

    const createdAtEl = document.getElementById("fridgeStockCreatedAt");
    const shelfLifeEl = document.getElementById("fridgeStockShelfLife");
    const expiryEl = document.getElementById("fridgeStockExpiryDate");
    const autoLabelEl = document.getElementById(
        "fridgeStockExpiryDateAutoLabel",
    );

    const createdAt = createdAtEl?.value;
    const shelfLifeDays = parseInt(shelfLifeEl?.value || "0", 10);

    if (createdAt && shelfLifeDays > 0) {
        expiryEl.value = addDays(createdAt, shelfLifeDays);
        if (autoLabelEl) autoLabelEl.style.display = "inline-block";
    } else {
        if (autoLabelEl) autoLabelEl.style.display = "none";
    }
}

function calcNextDueByDays(lastDate, intervalDays) {
    return addDays(lastDate, intervalDays);
}

function calcNextDueByMonths(lastDate, intervalMonths) {
    return addMonths(lastDate, intervalMonths);
}

function formatMetaTimestamp(iso) {
    if (!iso) return "No recent activity";
    return `Last updated ${new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })}`;
}

// BUTTON ACTIONS
// FRIDGE STOCK
async function saveFridgeItem(item, isUpdate = false) {
    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) throw new Error("Not authenticated");

        const data = {
            ...item,
            user_id: user.id,
        };

        let error;
        if (isUpdate) {
            ({ error } = await sb
                .from("fridge_stock")
                .update(data)
                .eq("id", item.id)
                .eq("user_id", user.id));
        } else {
            delete data.id;
            ({ error } = await sb.from("fridge_stock").insert(data));
        }

        if (error) throw error;

        await loadFridgeStock();
        renderFridgeStock();
        touchMetadata("fridge_stock");
    } catch (error) {
        console.error("Save fridge_stock failed:", error);
        alert(`Save failed: ${error.message}`);
    }
}

async function deleteFridgeItem(id) {
    if (!confirm("Delete this fridge item permanently?")) return;

    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) throw new Error("Not authenticated");

        const { error } = await sb
            .from("fridge_stock")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) throw error;

        await loadFridgeStock();
        renderFridgeStock();
        touchMetadata("fridge_stock");
    } catch (err) {
        console.error("Delete fridge_stock failed:", err);
        alert(`Delete failed: ${err.message}`);
    }
}

// CHORES
async function saveChore(chore, isUpdate = false) {
    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) throw new Error("Not authenticated");

        const data = {
            ...chore,
            user_id: user.id,
        };

        let error;
        if (isUpdate) {
            ({ error } = await sb
                .from("chores")
                .update(data)
                .eq("id", chore.id)
                .eq("user_id", user.id));
        } else {
            delete data.id;
            ({ error } = await sb.from("chores").insert(data));
        }

        if (error) throw error;

        await loadChores();
        renderChores();
        touchMetadata("chores");
    } catch (error) {
        console.error("Save chore failed:", error);
        alert(`Save failed: ${error.message}`);
    }
}

async function deleteChore(id) {
    if (!confirm("Delete this chore?")) return;

    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) throw new Error("Not authenticated");

        const { error } = await sb
            .from("chores")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) throw error;

        await loadChores();
        renderChores();
        touchMetadata("chores");
    } catch (err) {
        console.error("Delete chore failed:", err);
        alert(`Delete failed: ${err.message}`);
    }
}

// CHANGE LOG
async function saveChangeLog(cl, isUpdate = false) {
    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) throw new Error("Not authenticated");

        const data = {
            ...cl,
            user_id: user.id,
        };

        let error;
        if (isUpdate) {
            ({ error } = await sb
                .from("change_log")
                .update(data)
                .eq("id", cl.id)
                .eq("user_id", user.id));
        } else {
            delete data.id;
            ({ error } = await sb.from("change_log").insert(data));
        }

        if (error) throw error;

        await loadChangeLog();
        renderChangeLog();
        touchMetadata("change_log");
    } catch (error) {
        console.error("Save change_log failed:", error);
        alert(`Save failed: ${error.message}`);
    }
}

async function deleteChangeLog(id) {
    if (!confirm("Delete this item?")) return;

    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) throw new Error("Not authenticated");

        const { error } = await sb
            .from("change_log")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) throw error;

        await loadChangeLog();
        renderChangeLog();
        touchMetadata("change_log");
    } catch (err) {
        console.error("Delete change_log failed:", err);
        alert(`Delete failed: ${err.message}`);
    }
}

// BILLS
async function saveBill(bill, isUpdate = false) {
    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) throw new Error("Not authenticated");

        const data = {
            ...bill,
            user_id: user.id,
        };

        let error;
        if (isUpdate) {
            ({ error } = await sb
                .from("bills")
                .update(data)
                .eq("id", bill.id)
                .eq("user_id", user.id));
        } else {
            delete data.id;
            ({ error } = await sb.from("bills").insert(data));
        }

        if (error) throw error;

        await loadBills();
        renderBills();
        touchMetadata("bills");
    } catch (error) {
        console.error("Save bill failed:", error);
        alert(`Save failed: ${error.message}`);
    }
}

async function deleteBill(id) {
    if (!confirm("Delete this bill?")) return;

    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) throw new Error("Not authenticated");

        const { error } = await sb
            .from("bills")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) throw error;

        await loadBills();
        renderBills();
        touchMetadata("bills");
    } catch (err) {
        console.error("Delete bill failed:", err);
        alert(`Delete failed: ${err.message}`);
    }
}

// PLANTS
async function savePlant(plant) {
    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) throw new Error("Not authenticated");

        const data = {
            ...plant,
            user_id: user.id,
        };

        const { error } = await sb.from("plants").insert(data);
        if (error) throw error;

        await loadPlants();
        await loadPlantHistory();
        renderPlants();
        touchMetadata("plants");
    } catch (err) {
        console.error("Save plant failed:", err);
        alert(`Save failed: ${err.message}`);
    }
}

async function updatePlant(plantId, updates) {
    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) throw new Error("Not authenticated");

        const data = {
            ...updates,
            user_id: user.id,
        };

        const { error } = await sb
            .from("plants")
            .update(data)
            .eq("id", plantId)
            .eq("user_id", user.id);

        if (error) throw error;

        await loadPlants();
        await loadPlantHistory();
        renderPlants();
        touchMetadata("plants");
    } catch (err) {
        console.error("Update plant failed:", err);
        alert(`Update failed: ${err.message}`);
    }
}

async function deletePlant(plantId) {
    if (!confirm("Delete this plant and all its history permanently?")) return;

    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) throw new Error("Not authenticated");

        const { error: error1 } = await sb
            .from("plant_history")
            .delete()
            .eq("plant_id", plantId);

        const { error: error2 } = await sb
            .from("plants")
            .delete()
            .eq("id", plantId)
            .eq("user_id", user.id);

        if (error1 || error2) throw error1 || error2;

        await loadPlants();
        await loadPlantHistory();
        renderPlants();
        touchMetadata("plants");
    } catch (err) {
        console.error("Delete plant failed:", err);
        alert(`Delete failed: ${err.message}`);
    }
}

async function savePlantHistory(historyItem) {
    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const data = {
            ...historyItem,
            plant_id: historyItem.plant_id,
        };

        const { error } = await sb.from("plant_history").insert(data);
        if (error) throw error;

        await loadPlantHistory();
        touchMetadata("plants");
    } catch (err) {
        console.error("Save plant_history failed:", err);
        alert(`Save failed: ${err.message}`);
    }
}

async function deletePlantHistory(id, plantId) {
    if (!confirm("Delete this history entry?")) return;

    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const { error } = await sb.from("plant_history").delete().eq("id", id);

        if (error) throw error;

        await loadPlantHistory();
        touchMetadata("plants");
        openPlantDetail(plantId);
    } catch (err) {
        console.error("Delete plant_history failed:", err);
        alert(`Delete failed: ${err.message}`);
    }
}

// NOTES
async function saveNote(content) {
    const sb = await ensureSupabaseReady();
    if (!sb) {
        alert("Supabase not ready");
        return;
    }

    try {
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id || !content.trim()) return;

        const { error } = await sb.from("notes").insert({
            content: content.trim(),
            user_id: user.id,
            created_at: new Date().toISOString().slice(0, 10),
        });

        if (error) throw error;

        await loadNotes();
        renderNotes();
        touchMetadata("notes");
        document.getElementById("addNoteContent").value = "";
    } catch (err) {
        console.error("Save note failed:", err);
        alert(`Save failed: ${err.message}`);
    }
}

// FULL LIST
async function touchMetadata(listName) {
    const ts = new Date().toISOString();
    listMetadata[listName] = ts;

    try {
        const sb = await ensureSupabaseReady();
        if (!sb) return;

        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) return;

        await sb.from("list_metadata").upsert(
            {
                list_name: listName,
                last_updated: ts,
                user_id: user.id,
            },
            { onConflict: "user_id,list_name" },
        );
    } catch (err) {
        console.error("Metadata update failed:", err);
    }
}

// BINDERS
function bindAutoCalculations() {
    ["fridgeStockCreatedAt", "fridgeStockShelfLife"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", () => {
                fridgeStockExpiryManuallySet = false;
                calcFridgeStockExpiry();
            });
        }
    });
    const fridgeExpiryEl = document.getElementById("fridgeStockExpiryDate");
    if (fridgeExpiryEl) {
        fridgeExpiryEl.addEventListener("input", () => {
            fridgeStockExpiryManuallySet = true;
            const autoLabel = document.getElementById(
                "fridgeStockExpiryDateAutoLabel",
            );
            if (autoLabel) autoLabel.style.display = "none";
        });
    }

    ["choreLastDoneDate", "choreIntervalDays"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", () => {
                choreNextDueManuallySet = false;
                refreshChoreNextDue();
            });
        }
    });
    const choreNextDueEl = document.getElementById("choreNextDueDate");
    if (choreNextDueEl) {
        choreNextDueEl.addEventListener("input", () => {
            choreNextDueManuallySet = true;
            const autoLabel = document.getElementById(
                "choreNextDueDateAutoLabel",
            );
            if (autoLabel) autoLabel.style.display = "none";
        });
    }

    ["changeLogLastChanged", "changeLogIntervalMonths"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", () => {
                changeLogNextDueManuallySet = false;
                refreshChangeLogNextDue();
            });
        }
    });
    const changelogNextDueEl = document.getElementById("changeLogNextDueDate");
    if (changelogNextDueEl) {
        changelogNextDueEl.addEventListener("input", () => {
            changelogNextDueManuallySet = true;
            const autoLabel = document.getElementById(
                "changeLogNextDueDateAutoLabel",
            );
            if (autoLabel) autoLabel.style.display = "none";
        });
    }

    ["billLastBillDate", "billIntervalMonths"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", () => {
                billNextDateManuallySet = false;
                refreshBillNextDate();
            });
        }
    });
    const billNextDateEl = document.getElementById("billNextBillDate");
    if (billNextDateEl) {
        billNextDateEl.addEventListener("input", () => {
            billNextDateManuallySet = true;
            const autoLabel = document.getElementById(
                "billNextBillDateAutoLabel",
            );
            if (autoLabel) autoLabel.style.display = "none";
        });
    }

    const fertilisedCheck = document.getElementById("fertilisedCheck");
    if (fertilisedCheck) {
        fertilisedCheck.addEventListener("change", (e) => {
            document.getElementById("fertiliserSelectWrap").style.display = e
                .target.checked
                ? "block"
                : "none";
        });
    }
}

function bindAllForms() {
    document
        .getElementById("fridgeStockForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const shelfLifeDays =
                parseInt(
                    document.getElementById("fridgeStockShelfLife").value,
                    10,
                ) || null;
            const createdAt = document.getElementById(
                "fridgeStockCreatedAt",
            ).value;
            const expiryDate = fridgeStockExpiryManuallySet
                ? document.getElementById("fridgeStockExpiryDate").value
                : createdAt && shelfLifeDays
                  ? addDays(createdAt, shelfLifeDays)
                  : null;

            const item = {
                item_name: document
                    .getElementById("fridgeStockItemName")
                    .value.trim(),
                category: document.getElementById("fridgeStockCategory").value,
                portions:
                    parseInt(
                        document.getElementById("fridgeStockPortions").value,
                        10,
                    ) || 0,
                shelf_life_days: shelfLifeDays,
                created_at: createdAt,
                expiry_date: expiryDate,
                last_updated: new Date().toISOString().slice(0, 10),
            };

            await saveFridgeItem(item, !!editingFridgeStockId);
            closeModal("fridgeStockDetailModal");
            editingFridgeStockId = null;
            fridgeStockExpiryManuallySet = false;
        });

    document
        .getElementById("fridgeStockDeleteBtn")
        ?.addEventListener("click", async () => {
            await deleteFridgeItem(editingFridgeStockId);
            closeModal("fridgeStockDetailModal");
            editingFridgeStockId = null;
        });

    document
        .getElementById("choreForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const lastDoneDate =
                document.getElementById("choreLastDoneDate").value || null;
            const intervalDays =
                parseInt(
                    document.getElementById("choreIntervalDays").value,
                    10,
                ) || null;
            const nextDueDate = choreNextDueManuallySet
                ? document.getElementById("choreNextDueDate").value
                : lastDoneDate && intervalDays
                  ? calcNextDueByDays(lastDoneDate, intervalDays)
                  : null;

            const chore = {
                task_name: document
                    .getElementById("choreTaskName")
                    .value.trim(),
                last_done_date: lastDoneDate,
                interval_days: intervalDays,
                next_due_date: nextDueDate,
            };

            await saveChore(chore, !!editingChoreId);
            closeModal("choreDetailModal");
            editingChoreId = null;
            choreNextDueManuallySet = false;
        });

    document
        .getElementById("choreDeleteBtn")
        ?.addEventListener("click", async () => {
            await deleteChore(editingChoreId);
            closeModal("choreDetailModal");
            editingChoreId = null;
        });

    document
        .getElementById("changelogForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const lastChangedDate =
                document.getElementById("changeLogLastChanged").value || null;
            const intervalMonths =
                parseInt(
                    document.getElementById("changeLogIntervalMonths").value,
                    10,
                ) || null;
            const nextChangeDue = changeLogNextDueManuallySet
                ? document.getElementById("changeLogNextDueDate").value
                : lastChangedDate && intervalMonths
                  ? calcNextDueByMonths(lastChangedDate, intervalMonths)
                  : null;

            const cl = {
                item_name: document
                    .getElementById("changeLogItemName")
                    .value.trim(),
                last_changed_date: lastChangedDate,
                interval_months: intervalMonths,
                next_change_due: nextChangeDue,
            };

            await saveChangeLog(cl, !!editingChangeLogId);
            closeModal("changeLogDetailModal");
            editingChangeLogId = null;
            changeLogNextDueManuallySet = false;
        });

    document
        .getElementById("changeLogDeleteBtn")
        ?.addEventListener("click", async () => {
            await deleteChangeLog(editingChangeLogId);
            closeModal("changeLogDetailModal");
            editingChangeLogId = null;
        });

    document
        .getElementById("billForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const lastBillDate =
                document.getElementById("billLastBillDate").value || null;
            const intervalMonths =
                parseInt(
                    document.getElementById("billIntervalMonths").value,
                    10,
                ) || null;
            const nextBillDate = billNextDateManuallySet
                ? document.getElementById("billNextBillDate").value
                : lastBillDate && intervalMonths
                  ? calcNextDueByMonths(lastBillDate, intervalMonths)
                  : null;

            const bill = {
                bill_name: document.getElementById("billBillName").value.trim(),
                last_bill_date: lastBillDate,
                interval_months: intervalMonths,
                next_bill_date: nextBillDate,
            };

            await saveBill(bill, !!editingBillId);
            closeModal("billDetailModal");
            editingBillId = null;
            billNextDateManuallySet = false;
        });

    document
        .getElementById("billDeleteBtn")
        ?.addEventListener("click", async () => {
            await deleteBill(editingBillId);
            closeModal("billDetailModal");
            editingBillId = null;
        });

    document
        .getElementById("addPlantForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("addPlantName").value.trim();
            const startingDate = document.getElementById(
                "addPlantStartingDate",
            ).value;
            if (!name) return;

            await savePlant({
                plant_name: name,
                starting_date: startingDate,
                archived: false,
            });
            closeModal("plantAddModal");
        });

    document
        .getElementById("plantEventForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const plantId = document.getElementById("plantEventId").value;
            const watered = document.getElementById("wateredCheck").checked;
            const fertilised =
                document.getElementById("fertilisedCheck").checked;
            const fertiliserUsed = fertilised
                ? document.getElementById("fertiliserSelect")?.value || null
                : null;
            const potSizeVal = parseInt(
                document.getElementById("plantEventPotSize").value,
                10,
            );
            const notesVal =
                document.getElementById("plantEventNotes")?.value.trim() ||
                null;
            const resolvedPotSize =
                !isNaN(potSizeVal) && potSizeVal > 0 ? potSizeVal : null;

            await savePlantHistory({
                plant_id: plantId,
                event_date: new Date().toISOString(),
                pot_size: resolvedPotSize,
                watered,
                fertilised,
                fertiliser_used: fertiliserUsed,
                notes: notesVal,
            });

            const updates = {};
            if (watered)
                updates.last_watered_date = new Date()
                    .toISOString()
                    .slice(0, 10);
            if (fertilised) {
                updates.last_fertilised_date = new Date()
                    .toISOString()
                    .slice(0, 10);
                updates.last_fertiliser_used = fertiliserUsed;
            }
            if (resolvedPotSize) updates.pot_size = resolvedPotSize;
            if (Object.keys(updates).length > 0)
                await updatePlant(plantId, updates);

            closeModal("plantEventModal");
        });

    document
        .getElementById("addNoteForm")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const content = document
                .getElementById("addNoteContent")
                .value.trim();
            if (!content) return;
            await saveNote(content);
            closeModal("noteAddModal");
        });

    bindAutoCalculations();
}

// GLOBAL CLICK DELEGATION
document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (btn) {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        const sb = await ensureSupabaseReady();
        if (!sb) return;

        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) {
            alert("Not authenticated");
            return;
        }

        const today = new Date().toISOString().slice(0, 10);

        try {
            if (action === "fridge-portions") {
                const delta = parseInt(btn.dataset.delta, 10);
                const item = fridgeStock.find((item) => item.id === id);
                if (!item) return;

                const newPortions = Math.max(0, item.portions + delta);
                fridgeStock = fridgeStock.map((it) =>
                    it.id === id
                        ? { ...it, portions: newPortions, last_updated: today }
                        : it,
                );

                await sb
                    .from("fridge_stock")
                    .update({ portions: newPortions, last_updated: today })
                    .eq("id", id)
                    .eq("user_id", user.id);

                renderFridgeStock();
                touchMetadata("fridge_stock");
            } else if (action === "done") {
                const chore = chores.find((c) => c.id === id);
                if (!chore) return;
                const nextDue = calcNextDueByDays(today, chore.interval_days);

                await sb
                    .from("chores")
                    .update({ last_done_date: today, next_due_date: nextDue })
                    .eq("id", id)
                    .eq("user_id", user.id);

                chores = chores.map((c) =>
                    c.id === id
                        ? {
                              ...c,
                              last_done_date: today,
                              next_due_date: nextDue,
                          }
                        : c,
                );
                renderChores();
                touchMetadata("chores");
            } else if (action === "changed") {
                const cl = changeLog.find((c) => c.id === id);
                if (!cl) return;
                const nextDue = calcNextDueByMonths(today, cl.interval_months);

                await sb
                    .from("change_log")
                    .update({
                        last_changed_date: today,
                        next_change_due: nextDue,
                    })
                    .eq("id", id)
                    .eq("user_id", user.id);

                changeLog = changeLog.map((c) =>
                    c.id === id
                        ? {
                              ...c,
                              last_changed_date: today,
                              next_change_due: nextDue,
                          }
                        : c,
                );
                renderChangeLog();
                touchMetadata("change_log");
            } else if (action === "paid") {
                const bill = bills.find((b) => b.id === id);
                if (!bill) return;
                const newLast = bill.next_bill_date;
                const newNext = calcNextDueByMonths(
                    newLast,
                    bill.interval_months,
                );

                await sb
                    .from("bills")
                    .update({
                        last_bill_date: newLast,
                        next_bill_date: newNext,
                    })
                    .eq("id", id)
                    .eq("user_id", user.id);

                bills = bills.map((b) =>
                    b.id === id
                        ? {
                              ...b,
                              last_bill_date: newLast,
                              next_bill_date: newNext,
                          }
                        : b,
                );
                renderBills();
                touchMetadata("bills");
            } else if (action === "plant-log") {
                openPlantEventModal(id);
                return;
            } else if (action === "plant-save-name") {
                const newName = document
                    .getElementById("pdPlantNameInput")
                    .value.trim();
                if (!newName) return;
                await updatePlant(id, { plant_name: newName });
            } else if (action === "plant-archive") {
                const plant = plants.find((p) => p.id === id);
                const archived = !plant.archived;
                await sb
                    .from("plants")
                    .update({ archived })
                    .eq("id", id)
                    .eq("user_id", user.id);
                await loadPlants();
                touchMetadata("plants");
                closeModal("plantDetailModal");
            } else if (action === "plant-delete") {
                await deletePlant(id);
                closeModal("plantDetailModal");
            } else if (action === "plant-history-delete") {
                const plantId = btn.dataset.plantid;
                await deletePlantHistory(id, plantId);
            } else if (action === "note-delete") {
                await sb
                    .from("notes")
                    .delete()
                    .eq("id", id)
                    .eq("user_id", user.id);
                await loadNotes();
                renderNotes();
                touchMetadata("notes");
            }
        } catch (err) {
            console.error(`${action} failed:`, err);
            alert(`${action} failed: ${err.message}`);
        }
        return;
    }

    const detailRow = e.target.closest("[data-open-detail]");
    if (detailRow) {
        openFridgeStockModal(detailRow.dataset.openDetail);
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

    const plantRow = e.target.closest("[data-open-plant]");
    if (plantRow) {
        openPlantDetail(plantRow.dataset.openPlant);
        return;
    }
});

// DOMContentLoaded
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
        "fullListModal",
        "fridgeStockDetailModal",
        "choreDetailModal",
        "changeLogDetailModal",
        "billDetailModal",
        "plantDetailModal",
        "plantAddModal",
        "plantEventModal",
        "noteAddModal",
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    renderFridgeStock();
    renderChores();
    renderChangeLog();
    renderBills();
    renderPlants();
    renderNotes();

    setupPanelClicks();

    bindAllForms();

    setTimeout(setupRealtime, 500);
});
