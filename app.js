// ============================================================
// #region CONFIGS
// ============================================================
const DEV_MODE = false;

const SUPABASE_PROJECT_URL = "https://ilfrtrfohdhoquemptmj.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_s8LcKiFr_XOf_fg9O2ubBQ_8mElMJ6L";

const SPOTIFY_CLIENT_ID = "61214ea8d81b43a6bd94e5aaaa39ec38";
const SPOTIFY_REDIRECT_URI = "https://hhyleung.github.io/kf20d/";
const SPOTIFY_SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-library-read",
];

const PANELS = [
    "mealPrep",
    "fridgeStock",
    "chores",
    "bills",
    "changeLog",
    "plants",
    "notes",
];

const MEAL_PREP_CATS = ["Carbs", "Veggies", "Proteins", "Fruits", "Others"];
const FRIDGE_STOCK_CATS = ["Fridge", "Freezer"];
const FULL_WIDTH_CATS = ["Proteins"];

const ICONS = ["♫", "☼", "☁", "❄", "☆", "♡", "⚐", "⚓", "☕\uFE0E"];
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region STATES
// ============================================================
let supabaseClient = null;
let isAuthenticated = false;
let isRealtimeSetup = false;
let subscriptions = [];

const panelData = {
    pantry: [],
    chores: [],
    bills: [],
    changeLog: [],
    plants: [],
    plantHistory: [],
    notes: [],
};

const panelState = {
    pantry: { editingId: null, manualDate: false },
    chores: { editingId: null, manualDate: false },
    bills: { editingId: null, manualDate: false },
    changeLog: { editingId: null, manualDate: false },
};

let activePanel = null;
let panelMetadata = Object.fromEntries(PANELS.map((k) => [k, null]));

let lastKnownDate = getTodayHKT();
let clockInterval = null;
let scheduleTickInterval = null;

let nowPlayingInterval = null;
let spotifyPlaylists = [];
let playlistSlots = [];
let schedules = [];
let activeSlot = null;
let spotifyVolume = 75;
let spotifyPlayer = null;
let spotifyDeviceId = null;
let isSpotifyReady = false;
let spotifyToken = null;
let spotifyTokenExpiry = 0;
let spotifyCalendarMonth = new Date();
let spotifySelectedDate = getTodayHKT();
let spotifySelectedScheduleId = null;
let spotifySelectedSchedule = null;
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region PANEL CONFIGS
// ============================================================
const PANEL_CONFIGS = {
    mealPrep: {
        key: "mealPrep",
        after: () => renderPanel("fridgeStock"),
        deleteMsg: "Delete this pantry item permanently?",

        data: {
            table: "pantry_db",
            store: (d) => {
                panelData.pantry = d;
            },
            orderCol: "food_name",
        },

        render: {
            contentId: "mealPrepContent",
            panelHTML: () => buildMealPrepHTML(false),
            fullHTML: () => buildMealPrepHTML(true),
        },

        functions: {
            addItem: () => openItemModal("mealPrep"),
            editItem: (id) => openItemModal("mealPrep", id),
        },

        itemModal: {
            modalId: "mealPrepItemModal",
            titleId: "mealPrepItemTitle",
            editIdInput: "mealPrepEditId",
            deleteBtnId: "mealPrepDeleteBtn",
            addTitle: "Add new pantry item",

            resetFields: () => {
                setElementValue("mealPrepItemName", "");
                setElementValue("mealPrepCategory", "Carbs");
                setElementValue("mealPrepPortions", "1");
                setElementValue("mealPrepShelfLife", "");
                setElementValue("mealPrepCreatedAt", getTodayHKT());
                setElementValue("mealPrepExpiryDate", "");
                setElementText("mealPrepLastUpdated", "");
            },

            findItem: (id) => panelData.pantry.find((i) => i.id === id),

            populateFields: (item) => {
                setElementValue("mealPrepItemName", item.food_name);
                setElementValue("mealPrepCategory", item.category || "Carbs");
                setElementValue("mealPrepPortions", item.portions || 0);
                setElementValue(
                    "mealPrepShelfLife",
                    item.shelf_life_days || "",
                );
                setElementValue(
                    "mealPrepCreatedAt",
                    formatDateInput(item.creation_date),
                );
                setElementValue(
                    "mealPrepExpiryDate",
                    formatDateInput(item.expiration_date),
                );
                setElementText(
                    "mealPrepLastUpdated",
                    item.last_updated_date
                        ? formatShortDate(item.last_updated_date)
                        : "",
                );
            },

            getExpectedAutoDate: (item) =>
                item.creation_date && item.shelf_life_days
                    ? addDays(item.creation_date, item.shelf_life_days)
                    : null,

            getActualAutoDate: (item) => item.expiration_date || null,
        },

        autoDate: {
            fromId: "mealPrepCreatedAt",
            intervalId: "mealPrepShelfLife",
            resultId: "mealPrepExpiryDate",
            autoLabelId: "expiryAutoLabel",
            unit: "days",
            get manualFlag() {
                return panelState.pantry.manualDate;
            },
            setManual: (v) => (panelState.pantry.manualDate = v),
            clearResult: () => setElementValue("mealPrepExpiryDate", ""),
        },

        form: {
            formId: "mealPrepForm",
            buildRecord: (isUpdate) => {
                const shelfLifeDays =
                    parseInt(getElement("mealPrepShelfLife").value, 10) || null;
                const createdAt = getElement("mealPrepCreatedAt").value || null;
                const expiryDate = panelState.pantry.manualDate
                    ? getElement("mealPrepExpiryDate").value || null
                    : createdAt && shelfLifeDays
                      ? addDays(createdAt, shelfLifeDays)
                      : null;

                return {
                    id: isUpdate ? panelState.pantry.editingId : null,
                    food_name: getElement("mealPrepItemName").value.trim(),
                    category: getElement("mealPrepCategory").value,
                    portions:
                        parseInt(getElement("mealPrepPortions").value, 10) || 0,
                    shelf_life_days: shelfLifeDays,
                    creation_date: createdAt,
                    expiration_date: expiryDate,
                    last_updated_date: getTodayHKT(),
                };
            },
        },
    },

    fridgeStock: {
        key: "fridgeStock",
        renderKey: "mealPrep",

        render: {
            contentId: "fridgeStockContent",
            panelHTML: () => buildFridgeStockHTML(false),
            fullHTML: () => buildFridgeStockHTML(true),
        },

        functions: {
            addItem: () => openItemModal("mealPrep"),
            editItem: (id) => openItemModal("mealPrep", id),
        },
    },

    chores: {
        key: "chores",
        deleteMsg: "Delete this task permanently?",

        data: {
            table: "chores_db",
            store: (d) => {
                panelData.chores = d;
            },
            orderCol: "task_name",
        },

        render: {
            contentId: "choresContent",
            panelHTML: buildChoresPanel,
            fullHTML: buildChoresHTML,
        },

        functions: {
            addItem: () => openItemModal("chores"),
            editItem: (id) => openItemModal("chores", id),
        },

        itemModal: {
            // html element id
            modalId: "choreItemModal",
            titleId: "choreItemTitle",
            editIdInput: "choreEditId",
            deleteBtnId: "choreDeleteBtn",
            addTitle: "Add new task",

            // reset html input
            resetFields: () => {
                setElementValue("choreTaskName", "");
                setElementValue("choreLastDoneDate", "");
                setElementValue("choreIntervalDays", "7");
                setElementValue("choreNextDueDate", "");
            },

            // panelData
            findItem: (id) => panelData.chores.find((c) => c.id === id),

            // display panelData
            populateFields: (item) => {
                setElementValue("choreTaskName", item.task_name);
                setElementValue(
                    "choreLastDoneDate",
                    formatDateInput(item.last_done_date),
                );
                setElementValue(
                    "choreIntervalDays",
                    item.chore_interval_days || "7",
                );
                setElementValue(
                    "choreNextDueDate",
                    formatDateInput(item.next_due_date),
                );
            },

            // display auto date
            getExpectedAutoDate: (item) =>
                item.last_done_date && item.chore_interval_days
                    ? addDays(item.last_done_date, item.chore_interval_days)
                    : null,

            getActualAutoDate: (item) => item.next_due_date || null,
        },

        autoDate: {
            // html element id
            fromId: "choreLastDoneDate",
            intervalId: "choreIntervalDays",
            resultId: "choreNextDueDate",
            autoLabelId: "nextDueAutoLabel",
            // settings
            unit: "days",
            // functions
            get manualFlag() {
                return panelState.chores.manualDate;
            },
            setManual: (v) => (panelState.chores.manualDate = v),
            clearResult: () => setElementValue("choreNextDueDate", ""),
        },

        form: {
            // add / edit modal
            formId: "choreForm",
            // initial display?
            buildRecord: (isUpdate) => {
                const lastDoneDate =
                    getElement("choreLastDoneDate").value || null;
                const intervalDays =
                    parseInt(getElement("choreIntervalDays").value, 10) || null;
                const nextDueDate = panelState.chores.manualDate
                    ? getElement("choreNextDueDate").value || null
                    : lastDoneDate && intervalDays
                      ? addDays(lastDoneDate, intervalDays)
                      : null;

                return {
                    id: isUpdate ? panelState.chores.editingId : null,
                    task_name: getElement("choreTaskName").value.trim(),
                    last_done_date: lastDoneDate,
                    chore_interval_days: intervalDays,
                    next_due_date: nextDueDate,
                };
            },
        },
    },

    bills: {
        key: "bills",
        deleteMsg: "Delete this bill permanently?",

        data: {
            table: "bills_db",
            store: (d) => {
                panelData.bills = d;
            },
            orderCol: "bill_name",
        },

        render: {
            contentId: "billsContent",
            panelHTML: buildBillsPanel,
            fullHTML: buildBillsHTML,
        },

        functions: {
            addItem: () => openItemModal("bills"),
            editItem: (id) => openItemModal("bills", id),
        },

        itemModal: {
            modalId: "billItemModal",
            titleId: "billItemTitle",
            editIdInput: "billEditId",
            deleteBtnId: "billDeleteBtn",
            addTitle: "Add new bill",

            resetFields: () => {
                setElementValue("billBillName", "");
                setElementValue("billLastBillDate", "");
                setElementValue("billIntervalMonths", "1");
                setElementValue("billNextBillDate", "");
            },

            findItem: (id) => panelData.bills.find((b) => b.id === id),

            populateFields: (item) => {
                setElementValue("billBillName", item.bill_name);
                setElementValue(
                    "billLastBillDate",
                    formatDateInput(item.last_bill_date),
                );
                setElementValue(
                    "billIntervalMonths",
                    item.bill_interval_months || "1",
                );
                setElementValue(
                    "billNextBillDate",
                    formatDateInput(item.next_bill_date),
                );
            },

            getExpectedAutoDate: (item) =>
                item.last_bill_date && item.bill_interval_months
                    ? addMonths(item.last_bill_date, item.bill_interval_months)
                    : null,

            getActualAutoDate: (item) => item.next_bill_date || null,
        },

        autoDate: {
            fromId: "billLastBillDate",
            intervalId: "billIntervalMonths",
            resultId: "billNextBillDate",
            autoLabelId: "nextBillAutoLabel",
            unit: "months",
            get manualFlag() {
                return panelState.bills.manualDate;
            },
            setManual: (v) => (panelState.bills.manualDate = v),
            clearResult: () => setElementValue("billNextBillDate", ""),
        },

        form: {
            formId: "billForm",
            buildRecord: (isUpdate) => {
                const lastBillDate =
                    getElement("billLastBillDate").value || null;
                const intervalMonths =
                    parseInt(getElement("billIntervalMonths").value, 10) ||
                    null;
                const nextBillDate = panelState.bills.manualDate
                    ? getElement("billNextBillDate").value || null
                    : lastBillDate && intervalMonths
                      ? addMonths(lastBillDate, intervalMonths)
                      : null;

                return {
                    id: isUpdate ? panelState.bills.editingId : null,
                    bill_name: getElement("billBillName").value.trim(),
                    last_bill_date: lastBillDate,
                    bill_interval_months: intervalMonths,
                    next_bill_date: nextBillDate,
                };
            },
        },
    },

    changeLog: {
        key: "changeLog",
        deleteMsg: "Delete this change item permanently?",

        data: {
            table: "change_log_db",
            store: (d) => {
                panelData.changeLog = d;
            },
            orderCol: "item_name",
        },

        render: {
            contentId: "changeLogContent",
            panelHTML: buildChangeLogPanel,
            fullHTML: buildChangeLogHTML,
        },

        functions: {
            addItem: () => openItemModal("changeLog"),
            editItem: (id) => openItemModal("changeLog", id),
        },

        itemModal: {
            modalId: "changeLogItemModal",
            titleId: "changeLogItemTitle",
            editIdInput: "changeLogEditId",
            deleteBtnId: "changeLogDeleteBtn",
            addTitle: "Add new change item",

            resetFields: () => {
                setElementValue("changeLogItemName", "");
                setElementValue("changeLogLastChanged", "");
                setElementValue("changeLogIntervalMonths", "3");
                setElementValue("changeLogNextChangeDate", "");
            },

            findItem: (id) => panelData.changeLog.find((c) => c.id === id),

            populateFields: (item) => {
                setElementValue("changeLogItemName", item.item_name);
                setElementValue(
                    "changeLogLastChanged",
                    formatDateInput(item.last_changed_date),
                );
                setElementValue(
                    "changeLogIntervalMonths",
                    item.change_interval_months || "3",
                );
                setElementValue(
                    "changeLogNextChangeDate",
                    formatDateInput(item.next_change_date),
                );
            },

            getExpectedAutoDate: (item) =>
                item.last_changed_date && item.change_interval_months
                    ? addMonths(
                          item.last_changed_date,
                          item.change_interval_months,
                      )
                    : null,

            getActualAutoDate: (item) => item.next_change_date || null,
        },

        autoDate: {
            fromId: "changeLogLastChanged",
            intervalId: "changeLogIntervalMonths",
            resultId: "changeLogNextChangeDate",
            autoLabelId: "nextChangeAutoLabel",
            unit: "months",
            get manualFlag() {
                return panelState.changeLog.manualDate;
            },
            setManual: (v) => (panelState.changeLog.manualDate = v),
            clearResult: () => setElementValue("changeLogNextChangeDate", ""),
        },

        form: {
            formId: "changeLogForm",
            buildRecord: (isUpdate) => {
                const lastChangedDate =
                    getElement("changeLogLastChanged").value || null;
                const intervalMonths =
                    parseInt(getElement("changeLogIntervalMonths").value, 10) ||
                    null;
                const nextChangeDue = panelState.changeLog.manualDate
                    ? getElement("changeLogNextChangeDate").value || null
                    : lastChangedDate && intervalMonths
                      ? addMonths(lastChangedDate, intervalMonths)
                      : null;

                return {
                    id: isUpdate ? panelState.changeLog.editingId : null,
                    item_name: getElement("changeLogItemName").value.trim(),
                    last_changed_date: lastChangedDate,
                    change_interval_months: intervalMonths,
                    next_change_date: nextChangeDue,
                };
            },
        },
    },

    plants: {
        key: "plants",

        data: {
            table: "plants_db",
            store: (d) => {
                panelData.plants = d;
            },
            orderCol: "plant_name",
        },

        render: {
            contentId: "plantsContent",
            panelHTML: () => buildPlantsHTML(false),
            fullHTML: () => buildPlantsHTML(true),
        },

        functions: {
            addItem: () => openPlantAddModal(),
            editItem: (id) => openPlantDetail(id),
        },
    },

    plant_history: {
        key: "plant_history",

        data: {
            table: "plant_history_db",
            store: (d) => {
                panelData.plantHistory = d;
            },
            orderCol: "event_timestamp",
            orderAscending: false,
            orderNulls: { nullsLast: true },
            noUserFilter: true,
            label: "plantHistory",
        },
    },

    notes: {
        key: "notes",
        deleteMsg: "Delete this note permanently?",

        data: {
            table: "notes_db",
            store: (d) => {
                panelData.notes = d;
            },
            orderCol: "creation_date",
        },

        render: {
            contentId: "notesContent",
            panelHTML: buildNotesHTML,
            fullHTML: buildNotesHTML,
        },

        functions: {
            addItem: () => openModal("noteAddModal"),
        },
    },
};
// ============================================================
// #endregion
// ============================================================

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
    d.setUTCMonth(d.getUTCMonth() + parseInt(months, 10));
    return d.toISOString().slice(0, 10);
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

// ============================================================
// #region SUPABASE INIT
// ============================================================
async function initSupabase() {
    if (supabaseClient) return supabaseClient;
    try {
        supabaseClient = supabase.createClient(
            SUPABASE_PROJECT_URL,
            SUPABASE_PUBLIC_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: false,
                },
            },
        );
        return supabaseClient;
    } catch (err) {
        console.error("initSupabase failed: ", err);
        supabaseClient = null;
        return null;
    }
}

async function ensureSupabaseReady() {
    while (!supabaseClient) {
        await initSupabase();
        if (!supabaseClient)
            await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return supabaseClient;
}

async function getSupabaseContext(requireUser = true) {
    const sb = await ensureSupabaseReady();
    if (!sb) throw new Error("Supabase not ready");
    const {
        data: { user },
    } = await sb.auth.getUser();
    if (requireUser && !user?.id) {
        throw new Error("Supabase not authenticated");
    }
    return { sb, user };
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region DATA FETCH
// ============================================================
function getDataConfigs() {
    return Object.values(PANEL_CONFIGS)
        .map((cfg) => cfg.data)
        .filter(Boolean);
}

async function loadSupabaseData(configs = getDataConfigs()) {
    try {
        const { sb, user } = await getSupabaseContext();
        await Promise.all([
            ...configs.map(async (cfg) => {
                try {
                    let query = sb.from(cfg.table).select("*");
                    if (!cfg.noUserFilter) query = query.eq("user_id", user.id);
                    query = query.order(cfg.orderCol, {
                        ascending: cfg.orderAscending ?? true,
                        ...(cfg.orderNulls ?? { nullsFirst: true }),
                    });
                    if (cfg.extraOrder) {
                        query = query.order(cfg.extraOrder.col, {
                            ascending: cfg.extraOrder.ascending,
                            nullsLast: cfg.extraOrder.nullsLast,
                        });
                    }
                    const { data, error } = await query;
                    if (error) throw error;
                    cfg.store(data || []);
                } catch (err) {
                    console.error(`Load ${cfg.table} error: `, err);
                    cfg.store([]);
                }
            }),
            (async () => {
                try {
                    if (!user?.id) return;
                    const { data, error } = await sb
                        .from("panel_metadata")
                        .select("panel_name, last_updated_timestamp")
                        .eq("user_id", user.id);
                    if (error) throw error;
                    data.forEach((row) => {
                        panelMetadata[row.panel_name] =
                            row.last_updated_timestamp;
                    });
                } catch (err) {
                    console.error("Load panel_metadata error: ", err);
                }
            })(),
        ]);
    } catch (err) {
        console.error("loadSupabaseData failed: ", err);
    }
}

function subscribeToTable(sb, tableName, renderFunc) {
    const channel = sb.channel(`${tableName}_${Date.now()}`);
    channel
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: tableName },
            renderFunc,
        )
        .subscribe((status) => {
            if (status !== "SUBSCRIBED")
                console.log(`Realtime ${tableName}: ${status}`);
        });
    subscriptions.push(channel);
}

function cleanupSubscriptions() {
    subscriptions.forEach((sub) => {
        if (supabaseClient) supabaseClient.removeChannel(sub);
    });
    subscriptions = [];
}

async function setupRealtime() {
    cleanupSubscriptions();
    try {
        const { sb, user } = await getSupabaseContext();
        const watchedTables = getDataConfigs().map((cfg) => cfg.table);
        // const renderKeys = [
        //     ...new Set(
        //         Object.values(PANEL_CONFIGS)
        //             .filter((cfg) => cfg.render?.contentId)
        //             .map((cfg) => cfg.renderKey ?? cfg.key)
        //             .filter(Boolean),
        //     ),
        // ];
        watchedTables.forEach((tableName) => {
            subscribeToTable(sb, tableName, async () => {
                await loadSupabaseData();
                [
                    "mealPrep",
                    "chores",
                    "changeLog",
                    "bills",
                    "plants",
                    "notes",
                ].forEach(renderPanel);
            });
        });
    } catch (err) {
        console.error("setupRealtime failed: ", err);
    }
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region DATA MUTATIONS
// ============================================================
async function runMutation(label, fn) {
    try {
        const { sb, user } = await getSupabaseContext();
        await fn(sb, user.id);
    } catch (err) {
        console.error(`${label} failed:`, err);
        alert(`${label} failed: ${err.message}`);
    }
}

async function updateListMetadata(panel) {
    const timestamp = new Date().toISOString();
    panelMetadata[panel] = timestamp;
    refreshListMetadata();
    try {
        const { sb, user } = await getSupabaseContext();
        await sb.from("panel_metadata").upsert(
            {
                panel_name: panel,
                last_updated_timestamp: timestamp,
                user_id: user.id,
            },
            { onConflict: "user_id,panel_name" },
        );
    } catch (err) {
        console.error("updateListMetadata failed: ", err);
    }
}

async function saveRecord(
    table,
    render,
    record,
    isUpdate = false,
    resetFn = null,
) {
    await runMutation(`Save ${table}`, async (sb, userId) => {
        const data = { ...record, user_id: userId };
        let error;
        if (isUpdate) {
            if (!record.id || record.id === "undefined" || record.id === "")
                throw new Error("Invalid item ID for update Supabase");
            ({ error } = await sb
                .from(table)
                .update(data)
                .eq("id", record.id)
                .eq("user_id", userId));
        } else {
            delete data.id;
            ({ error } = await sb.from(table).insert(data));
        }
        if (error) throw error;
        if (resetFn) resetFn();
        const cfg = Object.values(PANEL_CONFIGS).find(
            (c) => c.data?.table === table,
        );
        if (cfg?.data) await loadSupabaseData([cfg.data]);
        renderPanel(render);
        updateListMetadata(cfg.key);
    });
}

async function deleteRecord(table, render, id, confirmMsg) {
    if (!confirm(confirmMsg)) return;
    await runMutation(`Delete ${table}`, async (sb, userId) => {
        const { error } = await sb
            .from(table)
            .delete()
            .eq("id", id)
            .eq("user_id", userId);
        if (error) throw error;
        const cfg = Object.values(PANEL_CONFIGS).find(
            (c) => c.data?.table === table,
        );
        if (cfg?.data) await loadSupabaseData([cfg.data]);
        renderPanel(render);
        updateListMetadata(cfg.key);
    });
}

async function deletePlant(plantId) {
    if (!confirm("Delete this plant and all its history permanently?")) return;
    await runMutation("Delete plant", async (sb, userId) => {
        const { error: e1 } = await sb
            .from("plant_history_db")
            .delete()
            .eq("plant_id", plantId);
        const { error: e2 } = await sb
            .from("plants_db")
            .delete()
            .eq("id", plantId)
            .eq("user_id", userId);
        if (e1 || e2) throw e1 || e2;
        const plantCfg = PANEL_CONFIGS.plants.data;
        const historyCfg = PANEL_CONFIGS.plant_history.data;
        await loadSupabaseData([plantCfg, historyCfg]);
        renderPanel("plants");
        updateListMetadata("plants");
    });
}

async function savePlantHistory(historyItem) {
    await runMutation("Save plant_history", async (sb) => {
        const { error } = await sb.from("plant_history_db").insert(historyItem);
        if (error) throw error;
        const plantCfg = PANEL_CONFIGS.plants.data;
        const historyCfg = PANEL_CONFIGS.plant_history.data;
        await loadSupabaseData([plantCfg, historyCfg]);
        updateListMetadata("plants");
    });
}

async function deletePlantHistory(id, plantId) {
    if (!confirm("Delete this event permanently?")) return;
    await runMutation("Delete plant history", async (sb) => {
        const { error } = await sb
            .from("plant_history_db")
            .delete()
            .eq("id", id);
        if (error) throw error;
        const plantCfg = PANEL_CONFIGS.plants.data;
        const historyCfg = PANEL_CONFIGS.plant_history.data;
        await loadSupabaseData([plantCfg, historyCfg]);
        updateListMetadata("plants");
        openPlantDetail(plantId);
    });
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region PANEL BUILDERS
// ============================================================
function getUrgencyClass(dateStr, warningDays = 3) {
    if (!dateStr) return "";
    const [todayY, todayM, todayD] = getTodayHKT().split("-").map(Number);
    const [dY, dM, dD] = dateStr.split("-").map(Number);
    const todayNum = todayY * 10000 + todayM * 100 + todayD;
    const dateNum = dY * 10000 + dM * 100 + dD;
    if (dateNum < todayNum) return "danger";
    if (dateNum - todayNum <= warningDays) return "warning";
    return "";
}

function fridgeItemRow(item, showZero = false) {
    const expiryClass = getUrgencyClass(item.expiration_date, 7);
    const portionClass =
        item.portions === 0 && showZero ? "portion-zero" : "portion-number";
    const portionsDisplay = `<span class="${portionClass}">${item.portions}</span>`;
    const zeroClass = item.portions === 0 ? " zero-portions" : "";
    return `<li class="item-row${zeroClass}" data-open-type="fridgeStock" data-id="${item.id}">
                <span class="item-key ${expiryClass}">${item.food_name}</span>
                <span class="item-value">
                    <button class="action-btn btn-grey" data-action="meal-prep-portions" data-id="${item.id}" data-delta="1">+</button>
                    ${portionsDisplay}
                    <button class="action-btn btn-grey" data-action="meal-prep-portions" data-id="${item.id}" data-delta="-1">-</button>
                </span>
            </li>`;
}

function buildMealPrepHTML(showZero) {
    const items = panelData.pantry.filter(
        (i) =>
            (showZero || i.portions > 0) &&
            !FRIDGE_STOCK_CATS.includes(i.category),
    );
    const grouped = Object.fromEntries(MEAL_PREP_CATS.map((cat) => [cat, []]));
    items.forEach((item) => {
        const cat = MEAL_PREP_CATS.includes(item.category)
            ? item.category
            : "Others";
        grouped[cat].push(item);
    });
    const alwaysHalfWidth = ["Carbs", "Veggies", "Fruits", "Others"];
    let html = '<div class="meal-prep-inner-grid">';
    MEAL_PREP_CATS.forEach((cat) => {
        const catItems = grouped[cat];
        const isAlwaysHalf = alwaysHalfWidth.includes(cat);
        const isForceFull = FULL_WIDTH_CATS.includes(cat);
        const wide = isForceFull || (!isAlwaysHalf && catItems.length >= 3);
        const cls = wide ? "col-full" : "col-half";
        const totalPortions = catItems.reduce(
            (sum, i) => sum + (i.portions || 0),
            0,
        );
        html += `<div class="meal-prep-group ${cls}">
                    <div class="meal-prep-group-title">
                        <span>${cat}</span>
                        <span class="meal-prep-cat-total">${totalPortions}</span>
                    </div>
                    ${
                        catItems.length
                            ? `<ul class="item-list ${wide ? "two-col-list" : ""}">
                        ${catItems.map((item) => fridgeItemRow(item, showZero)).join("")}
                    </ul>`
                            : ""
                    }
                </div>`;
    });
    html += "</div>";
    return html;
}

function buildFridgeStockHTML(showZero = false) {
    const items = panelData.pantry
        .filter(
            (i) =>
                (showZero || i.portions > 0) &&
                FRIDGE_STOCK_CATS.includes(i.category),
        )
        .sort((a, b) => a.food_name.localeCompare(b.food_name));
    if (!items.length) return "";
    let html = '<ul class="item-list">';
    items.forEach((item) => {
        html += fridgeItemRow(item, showZero);
    });
    html += "</ul>";
    return html;
}

function buildChoresPanel() {
    let html = '<ul class="item-list">';
    panelData.chores.forEach((chore) => {
        const dueClass = getUrgencyClass(chore.next_due_date);
        const lastDoneText = chore.last_done_date
            ? formatShortDate(chore.last_done_date)
            : "Never";
        html += `<li class="item-row" data-open-type="chores" data-id="${chore.id}">
                    <span class="item-key ${dueClass}">${chore.task_name}</span>
                    <span class="item-value">
                        <span class="item-meta">${lastDoneText}</span>
                        <button class="action-btn btn-green" data-action="done" data-id="${chore.id}">✓</button>
                    </span>
                </li>`;
    });
    html += "</ul>";
    return html;
}

function buildChoresHTML() {
    let html = `<ul class="item-list">
                    <li class="item-row">
                        <span class="item-key"></span>
                        <span class="item-value">
                            <span class="item-meta">LAST DONE</span>
                            <span class="item-meta">NEXT DUE</span>
                        </span>
                    </li>`;
    panelData.chores.forEach((chore) => {
        const dueClass = getUrgencyClass(chore.next_due_date);
        const lastDoneText = chore.last_done_date
            ? formatShortDate(chore.last_done_date)
            : "Never";
        const nextDueText = chore.next_due_date
            ? formatShortDate(chore.next_due_date)
            : "N/A";
        html += `<li class="item-row" data-open-type="chores" data-id="${chore.id}">
                    <span class="item-key ${dueClass}">${chore.task_name}</span>
                    <span class="item-value">
                        <span class="item-meta">${lastDoneText}</span>
                        <span class="item-meta">${nextDueText}</span>
                        <button class="action-btn btn-green" data-action="done" data-id="${chore.id}">✓</button>
                    </span>
                </li>`;
    });
    html += "</ul>";
    return html;
}

function buildBillsPanel() {
    let headerClass = "";
    const header = getElement("billsHeader");
    header.classList.remove("danger", "warning");
    panelData.bills.forEach((bill) => {
        const dueClass = getUrgencyClass(bill.next_bill_date);
        if (dueClass === "danger") headerClass = "danger";
        else if (dueClass === "warning" && headerClass !== "danger") {
            headerClass = "warning";
        }
    });
    if (headerClass) header.classList.add(headerClass);
    return "";
}

function buildBillsHTML() {
    let headerClass = "";
    const header = getElement("billsHeader");
    header.classList.remove("danger", "warning");
    let html = '<ul class="item-list">';
    panelData.bills.forEach((bill) => {
        const dueClass = getUrgencyClass(bill.next_bill_date);
        if (dueClass === "danger") headerClass = "danger";
        else if (dueClass === "warning" && headerClass !== "danger") {
            headerClass = "warning";
        }
        const nextDueText = bill.next_bill_date
            ? formatShortDate(bill.next_bill_date)
            : "";
        html += `<li class="item-row" data-open-type="bills" data-id="${bill.id}">
                    <span class="item-key ${dueClass}">${bill.bill_name}</span>
                    <span class="item-value">
                        <span class="item-meta">${nextDueText}</span>
                        <button class="action-btn btn-green" data-action="paid" data-id="${bill.id}">✓</button>
                    </span>
                </li>`;
    });
    html += "</ul>";
    if (headerClass) header.classList.add(headerClass);
    return html;
}

function buildChangeLogPanel() {
    let headerClass = "";
    const header = getElement("changeLogHeader");
    header.classList.remove("danger", "warning");
    panelData.changeLog.forEach((cl) => {
        const dueClass = getUrgencyClass(cl.next_change_date);
        if (dueClass === "danger") headerClass = "danger";
        else if (dueClass === "warning" && headerClass !== "danger") {
            headerClass = "warning";
        }
    });
    if (headerClass) header.classList.add(headerClass);
    return "";
}

function buildChangeLogHTML() {
    let headerClass = "";
    const header = getElement("changeLogHeader");
    header.classList.remove("danger", "warning");
    let html = '<ul class="item-list">';
    panelData.changeLog.forEach((cl) => {
        const dueClass = getUrgencyClass(cl.next_change_date);
        if (dueClass === "danger") headerClass = "danger";
        else if (dueClass === "warning" && headerClass !== "danger") {
            headerClass = "warning";
        }
        const lastChangedText = cl.last_changed_date
            ? formatShortDate(cl.last_changed_date)
            : "Never";
        html += `<li class="item-row" data-open-type="changeLog" data-id="${cl.id}">
                    <span class="item-key ${dueClass}">${cl.item_name}</span>
                    <span class="item-value">
                        <span class="item-meta">${lastChangedText}</span>
                        <button class="action-btn btn-green" data-action="changed" data-id="${cl.id}">✓</button>
                    </span>
                </li>`;
    });
    html += "</ul>";
    if (headerClass) header.classList.add(headerClass);
    return html;
}

function buildPlantsHTML(showArchived = false) {
    const visible = showArchived
        ? panelData.plants
        : panelData.plants.filter((p) => !p.archived);
    if (!visible.length) return "";
    let html = '<ul class="item-list">';
    visible.forEach((p) => {
        const lastEvent = p.last_watered_date || p.last_fertilised_date;
        const lastEventText = lastEvent ? formatShortDate(lastEvent) : "";
        html += `<li class="item-row" data-open-type="plants" data-id="${p.id}">
                    <span class="item-key">${p.plant_name}${p.archived ? ' <span class="plant-archived-tag">archived</span>' : ""}</span>
                    <span class="item-value">
                        <span class="item-meta plant-meta">
                            ${p.pot_size ? `<span class="plant-meta-pot">${p.pot_size} cm</span>` : ""}
                            ${lastEventText}
                        </span>
                        <button class="action-btn btn-blue" data-action="plant-log" data-id="${p.id}">+</button>
                    </span>
                </li>`;
    });
    html += "</ul>";
    return html;
}

function buildNotesHTML() {
    let html = '<ul class="item-list">';
    panelData.notes.forEach((note) => {
        html += `<li class="item-row">
                    <span class="item-key">${note.note}</span>
                    <span class="item-value">
                        <span class="item-meta">&nbsp;</span>
                        <button class="action-btn btn-red" data-action="note-delete" data-id="${note.id}" title="Delete note">&times;</button>
                    </span>
                </li>`;
    });
    html += "</ul>";
    return html;
}

function renderPanel(panel) {
    const panelCfg = PANEL_CONFIGS[panel];
    if (!panelCfg) return;
    const renderCfg = panelCfg.render ?? panelCfg;
    if (!renderCfg.contentId || !renderCfg.panelHTML) return;
    setElementHTML(renderCfg.contentId, renderCfg.panelHTML());
    const fullListOwner = panelCfg.renderKey ?? panelCfg.key ?? panel;
    if (activePanel === panel || activePanel === fullListOwner) {
        const activeCfg = PANEL_CONFIGS[activePanel];
        const activeRenderCfg = activeCfg?.render ?? activeCfg;
        if (activeRenderCfg?.fullHTML) {
            setElementHTML("fullListContent", activeRenderCfg.fullHTML());
        }
    }
    if (panelCfg.after) panelCfg.after();
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region MODAL OPENERS
// ============================================================
function openModal(id) {
    showElement(id, "flex");
}

function closeModal(id) {
    hideElement(id);
    if (id === "fullListModal") activePanel = null;
}

function openRowItem(type, id) {
    const cfg = PANEL_CONFIGS[type];
    if (!cfg?.details?.open) return;
    cfg.functions.editItem(id);
}

function refreshAutoDate(cfg) {
    const fromEl = getElement(cfg.fromId);
    const intervalEl = getElement(cfg.intervalId);
    const resultEl = getElement(cfg.resultId);
    if (!fromEl || !intervalEl || !resultEl) return;
    if (cfg.autoLabelId) {
        cfg.manualFlag
            ? hideElement(cfg.autoLabelId)
            : showElement(cfg.autoLabelId, "inline");
    }
    if (cfg.manualFlag) return;
    const fromValue = fromEl.value;
    const intervalValue = parseFloat(intervalEl.value);
    if (!fromValue || !intervalValue) {
        cfg.clearResult ? cfg.clearResult() : setElementValue(cfg.resultId, "");
        return;
    }
    setElementValue(
        cfg.resultId,
        cfg.unit === "months"
            ? addMonths(fromValue, intervalValue)
            : addDays(fromValue, intervalValue),
    );
}

function refreshListMetadata() {
    if (!activePanel) return;
    setElementText(
        "listLastUpdated",
        formatMetaTimestamp(panelMetadata[activePanel]),
    );
}

function openItemModal(panel, itemId = null) {
    const panelCfg = PANEL_CONFIGS[panel];
    const modalCfg = panelCfg?.itemModal;
    if (!panelCfg) return;

    const isEditing = !!itemId;
    const deleteBtn = modalCfg.deleteBtnId
        ? getElement(modalCfg.deleteBtnId)
        : null;

    if (panelState[panel]) panelState[panel].editingId = itemId;

    if (modalCfg.editIdInput)
        setElementValue(modalCfg.editIdInput, itemId || "");

    if (modalCfg.titleId) {
        setElementText(
            modalCfg.titleId,
            isEditing ? "Editing " : modalCfg.addTitle,
        );
    }

    if (modalCfg.resetFields) modalCfg.resetFields();

    if (isEditing) {
        const item = modalCfg.findItem ? modalCfg.findItem(itemId) : null;
        if (!item) return;

        if (modalCfg.populateFields) modalCfg.populateFields(item);

        if (panelState[panel]) {
            const actualDate = modalCfg.getActualAutoDate
                ? modalCfg.getActualAutoDate(item)
                : null;
            const expectedDate = modalCfg.getExpectedAutoDate
                ? modalCfg.getExpectedAutoDate(item)
                : null;
            panelState[panel].manualDate = !!(
                actualDate && actualDate !== expectedDate
            );
        }
    } else if (panelState[panel]) {
        panelState[panel].manualDate = false;
    }

    if (deleteBtn) deleteBtn.hidden = !isEditing;

    if (panelCfg.autoDate) {
        setupAutoDateListeners(panelCfg.autoDate);
        refreshAutoDate(panelCfg.autoDate);
    }

    openModal(modalCfg.modalId);
}

function openPlantAddModal() {
    setElementValue("addPlantName", "");
    setElementValue("addPlantStartingDate", getTodayHKT());
    setElementValue("addPlantPotSize", "");
    openModal("plantAddModal");
}

function openPlantDetail(plantId) {
    const plant = panelData.plants.find((p) => p.id === plantId);
    if (!plant) return;
    setElementText("plantItemTitle", plant.plant_name.toUpperCase());
    setElementValue("pdPlantNameInput", plant.plant_name);
    getElement("pdSaveNameBtn").dataset.id = plantId;
    setElementValue(
        "pdStartingDate",
        plant.starting_date ? formatDateInput(plant.starting_date) : "",
    );
    setElementText("pdPotSize", plant.pot_size ? `${plant.pot_size}cm` : "");
    setElementText(
        "pdLastWatered",
        plant.last_watered_date ? formatShortDate(plant.last_watered_date) : "",
    );
    setElementText(
        "pdLastFertilised",
        plant.last_fertilised_date
            ? formatShortDate(plant.last_fertilised_date)
            : "",
    );
    setElementText("pdFertiliserUsed", plant.last_fertiliser_used || "");
    getElement("pdLogEventBtn").dataset.id = plantId;
    const history = panelData.plantHistory
        .filter((h) => h.plant_id === plantId)
        .sort(
            (a, b) => new Date(b.event_timestamp) - new Date(a.event_timestamp),
        );
    if (!history.length) {
        setElementHTML(
            "pdHistoryBody",
            '<tr><td colspan="7" style="color: var(--text-secondary); font-style: italic; text-align: center; padding: 1.4rem;">No history yet</td></tr>',
        );
    } else {
        setElementHTML(
            "pdHistoryBody",
            history
                .map(
                    (h) => `<tr>
                                <td>${formatShortDate(h.event_timestamp)}</td>
                                <td>${h.pot_size ? `${h.pot_size}cm` : ""}</td>
                                <td class="${h.watered ? "check-yes" : "check-no"}">${h.watered ? "✓" : ""}</td>
                                <td class="${h.fertilised ? "check-yes" : "check-no"}">${h.fertilised ? "✓" : ""}</td>
                                <td>${h.fertiliser_used || ""}</td>
                                <td>${h.event_notes || ""}</td>
                                <td>
                                <button class="action-btn btn-red" data-action="plant-history-delete" 
                                        data-id="${h.id}" data-plantid="${plantId}"
                                        style="font-size: 0.9rem; width: 32px; height: 32px;">&times;</button>
                                </td>
                            </tr>`,
                )
                .join(""),
        );
    }
    const archiveBtn = getElement("pdArchiveBtn");
    archiveBtn.dataset.id = plantId;
    setElementText("pdArchiveBtn", plant.archived ? "Unarchive" : "Archive");
    archiveBtn.classList.toggle("is-archived", !!plant.archived);
    getElement("pdDeleteBtn").dataset.id = plantId;
    openModal("plantItemModal");
}

function openPlantEventModal(plantId) {
    const plant = panelData.plants.find((p) => p.id === plantId);
    if (!plant) return;
    setElementText("plantEventTitle", plant.plant_name.toUpperCase());
    setElementValue("plantEventId", plantId);
    setElementValue("plantEventDate", getTodayHKT());
    setElementChecked("wateredCheck", false);
    setElementChecked("fertilisedCheck", false);
    hideElement("fertiliserSelectWrap");
    setElementValue("fertiliserSelect", "20-20-20");
    setElementValue("plantEventPotSize", plant.pot_size || "");
    setElementValue("plantEventNotes", "");
    openModal("plantEventModal");
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region PANEL ACTIONS
// ============================================================
function setupPanelEvents() {
    if (setupPanelEvents.bound) return;
    setupPanelEvents.bound = true;
    selectAllElements(".panel-header").forEach((header) => {
        header.addEventListener("click", (e) => {
            const panel = e.target.closest(".panel");
            const section = panel.dataset.section;
            const h3 = selectElement("h3", header);
            if (!section || !h3 || section === "spotify") return;
            setElementText("listTitle", h3.textContent.toUpperCase());
            activePanel = section;
            const cfg = PANEL_CONFIGS[section];
            const renderCfg = cfg.render ?? cfg;
            setElementHTML("fullListContent", renderCfg.fullHTML?.() ?? "");
            refreshListMetadata();
            openModal("fullListModal");
        });
    });

    selectAllElements(".panel .add-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const section = btn.closest(".panel")?.dataset.section;
            const cfg = PANEL_CONFIGS[section];
            if (cfg?.functions.addItem) cfg.functions.addItem();
        });
    });

    getElement("fullListAddBtn")?.addEventListener("click", () => {
        const cfg = PANEL_CONFIGS[activePanel];
        if (cfg?.functions.addItem) cfg.functions.addItem();
    });
}

function setupAutoDateListeners(cfg) {
    const fromEl = getElement(cfg.fromId);
    const intervalEl = getElement(cfg.intervalId);
    const resultEl = getElement(cfg.resultId);
    if (!fromEl || !intervalEl || !resultEl) return;

    if (fromEl.dataset.autoDateBound) return;
    fromEl.dataset.autoDateBound = "1";

    const onSourceChange = () => {
        if (!cfg.manualFlag) refreshAutoDate(cfg);
    };
    fromEl.addEventListener("change", onSourceChange);
    intervalEl.addEventListener("input", onSourceChange);

    resultEl.addEventListener("change", (e) => {
        const fromVal = fromEl.value;
        const intervalVal = parseFloat(intervalEl.value);
        const expected =
            fromVal && intervalVal
                ? cfg.unit === "months"
                    ? addMonths(fromVal, intervalVal)
                    : addDays(fromVal, intervalVal)
                : null;
        const isNowManual = !!(e.target.value && e.target.value !== expected);
        cfg.setManual(isNowManual);
        refreshAutoDate(cfg);
    });

    resultEl.addEventListener("input", (e) => {
        if (e.target.value === "") {
            cfg.setManual(false);
            refreshAutoDate(cfg);
        }
    });
}

function setupFormHandlers() {
    if (setupFormHandlers.bound) return;
    setupFormHandlers.bound = true;

    Object.values(PANEL_CONFIGS)
        .filter((cfg) => cfg.form && cfg.itemModal)
        .forEach((panelCfg) => {
            const panel = panelCfg.key;
            const formCfg = panelCfg.form;
            const modalCfg = panelCfg.itemModal;
            const renderKey = panelCfg.renderKey ?? panel;

            const formEl = getElement(formCfg.formId);
            if (!formEl) return;

            formEl.addEventListener("submit", async (e) => {
                e.preventDefault();
                const isUpdate = !!(panel && panelState[panel]?.editingId);
                const record = formCfg.buildRecord(isUpdate);

                await saveRecord(
                    panelCfg.data.table,
                    renderKey,
                    record,
                    isUpdate,
                    () => {
                        if (panel && panelState[panel]) {
                            panelState[panel].manualDate = false;
                        }
                    },
                );

                closeModal(modalCfg.modalId);

                if (panel && panelState[panel]) {
                    panelState[panel].editingId = null;
                    panelState[panel].manualDate = false;
                }
            });
        });

    Object.values(PANEL_CONFIGS)
        .filter((cfg) => cfg.itemModal?.deleteBtnId && cfg.deleteMsg)
        .forEach((panelCfg) => {
            const panel = panelCfg.key;
            const modalCfg = panelCfg.itemModal;
            const renderKey = panelCfg.renderKey ?? panel;
            const btn = getElement(modalCfg.deleteBtnId);
            if (!btn) return;

            btn.addEventListener("click", async () => {
                const itemId = panel ? panelState[panel]?.editingId : null;
                if (!itemId) return;

                await deleteRecord(
                    panelCfg.data.table,
                    renderKey,
                    itemId,
                    panelCfg.deleteMsg,
                );

                closeModal(modalCfg.modalId);

                if (panel && panelState[panel]) {
                    panelState[panel].editingId = null;
                    panelState[panel].manualDate = false;
                }
            });
        });

    const addPlantForm = getElement("addPlantForm");
    if (addPlantForm && !addPlantForm.dataset.bound) {
        addPlantForm.dataset.bound = "1";
        addPlantForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = getElement("addPlantName").value.trim();
            const startingDate =
                getElement("addPlantStartingDate").value || null;
            const potSize =
                parseInt(getElement("addPlantPotSize").value, 10) || null;
            if (!name) return;

            await saveRecord(
                "plants_db",
                "plants",
                {
                    plant_name: name,
                    starting_date: startingDate,
                    pot_size: potSize,
                    archived: false,
                },
                false,
            );
            closeModal("plantAddModal");
        });
    }

    const plantEventForm = getElement("plantEventForm");
    if (plantEventForm && !plantEventForm.dataset.bound) {
        plantEventForm.dataset.bound = "1";

        const fertilisedCheck = getElement("fertilisedCheck");
        const fertiliserWrap = getElement("fertiliserSelectWrap");
        const fertiliserSelect = getElement("fertiliserSelect");

        if (fertilisedCheck && fertiliserWrap) {
            fertilisedCheck.addEventListener("change", () => {
                const show = fertilisedCheck.checked;
                fertiliserWrap.style.display = show ? "" : "none";
                if (!show && fertiliserSelect) {
                    fertiliserSelect.value = "20-20-20";
                }
            });
        }

        plantEventForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const plantId = getElement("plantEventId")?.value || "";
            const eventDate = getElement("plantEventDate")?.value || null;
            const watered = !!getElement("wateredCheck")?.checked;
            const fertilised = !!getElement("fertilisedCheck")?.checked;
            const fertiliserUsed = fertilised
                ? getElement("fertiliserSelect")?.value || null
                : null;
            const potSizeRaw = getElement("plantEventPotSize")?.value || "";
            const potSize = potSizeRaw === "" ? null : parseInt(potSizeRaw, 10);
            const notes = getElement("plantEventNotes")?.value.trim() || null;

            if (!plantId) {
                alert("Missing plant id");
                return;
            }

            if (!eventDate) {
                alert("Please choose an event date");
                return;
            }

            if (!watered && !fertilised && potSize === null && !notes) {
                alert("Please log at least one event detail");
                return;
            }

            const plant = panelData.plants.find((p) => p.id === plantId);
            if (!plant) {
                alert("Plant not found");
                return;
            }

            const plantUpdates = {
                id: plantId,
                plant_name: plant.plant_name,
                starting_date: plant.starting_date,
                archived: !!plant.archived,
                pot_size: potSize !== null ? potSize : (plant.pot_size ?? null),
            };

            if (watered) {
                plantUpdates.last_watered_date = eventDate;
            } else {
                plantUpdates.last_watered_date =
                    plant.last_watered_date || null;
            }

            if (fertilised) {
                plantUpdates.last_fertilised_date = eventDate;
                plantUpdates.last_fertiliser_used = fertiliserUsed;
            } else {
                plantUpdates.last_fertilised_date =
                    plant.last_fertilised_date || null;
                plantUpdates.last_fertiliser_used =
                    plant.last_fertiliser_used || null;
            }

            await saveRecord("plants_db", "plants", plantUpdates, true);

            await savePlantHistory({
                plant_id: plantId,
                event_timestamp: eventDate,
                watered,
                fertilised,
                fertiliser_used: fertiliserUsed,
                pot_size: potSize,
                event_notes: notes,
            });

            closeModal("plantEventModal");
            renderPanel("plants");
            openPlantDetail(plantId);
        });
    }

    const noteForm = getElement("addNoteForm");
    if (noteForm && !noteForm.dataset.bound) {
        noteForm.dataset.bound = "1";
        noteForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const noteContent = getElement("addNoteContent").value.trim();
            if (!noteContent) return;

            await saveRecord(
                "notes_db",
                "notes",
                {
                    note: noteContent,
                    creation_date: getTodayHKT(),
                },
                false,
            );
            setElementValue("addNoteContent", "");
            closeModal("noteAddModal");
        });
    }
}

const ACTION_HANDLERS = {
    "meal-prep-portions": async (btn) => {
        const id = btn.dataset.id;
        const delta = parseInt(btn.dataset.delta, 10) || 0;
        if (!id || !delta) return;
        const item = panelData.pantry.find((i) => i.id === id);
        if (!item) return;
        const newPortions = Math.max(0, (item.portions || 0) + delta);
        await saveRecord(
            "pantry_db",
            "mealPrep",
            {
                id,
                portions: newPortions,
                last_updated_date: getTodayHKT(),
            },
            true,
        );
    },

    // might merge done / changed / paid
    done: async (btn) => {
        const id = btn.dataset.id;
        if (!id) return;
        const chore = panelData.chores.find((c) => c.id === id);
        if (!chore) return;
        const today = getTodayHKT();
        await saveRecord(
            "chores_db",
            "chores",
            {
                id,
                task_name: chore.task_name,
                last_done_date: today,
                chore_interval_days: chore.chore_interval_days,
                next_due_date: chore.chore_interval_days
                    ? addDays(today, chore.chore_interval_days)
                    : null,
            },
            true,
        );
    },

    changed: async (btn) => {
        const id = btn.dataset.id;
        if (!id) return;
        const cl = panelData.changeLog.find((c) => c.id === id);
        if (!cl) return;
        const today = getTodayHKT();
        await saveRecord(
            "change_log_db",
            "changeLog",
            {
                id,
                item_name: cl.item_name,
                last_changed_date: today,
                change_interval_months: cl.change_interval_months,
                next_change_date: cl.change_interval_months
                    ? addMonths(today, cl.change_interval_months)
                    : null,
            },
            true,
        );
    },

    paid: async (btn) => {
        const id = btn.dataset.id;
        if (!id) return;
        const bill = panelData.bills.find((b) => b.id === id);
        if (!bill) return;
        await saveRecord(
            "bills_db",
            "bills",
            {
                id,
                bill_name: bill.bill_name,
                last_bill_date: bill.next_bill_date,
                bill_interval_months: bill.bill_interval_months,
                next_bill_date: bill.bill_interval_months
                    ? addMonths(bill.next_bill_date, bill.bill_interval_months)
                    : null,
            },
            true,
        );
    },

    "plant-log": async (btn) => {
        const id = btn.dataset.id;
        if (!id) return;
        openPlantEventModal(id);
    },

    "plant-save-name": async (btn) => {
        const id = btn.dataset.id;
        if (!id) return;
        const plant = panelData.plants.find((p) => p.id === id);
        if (!plant) return;
        const newName = getElement("pdPlantNameInput").value.trim();
        const newStart = getElement("pdStartingDate").value || null;
        if (!newName) {
            alert("Plant name cannot be empty");
            return;
        }
        await saveRecord(
            "plants_db",
            "plants",
            {
                id,
                plant_name: newName,
                starting_date: newStart,
            },
            true,
        );
        openPlantDetail(id);
    },

    "plant-archive": async (btn) => {
        const id = btn.dataset.id;
        if (!id) return;
        const plant = panelData.plants.find((p) => p.id === id);
        if (!plant) return;
        const archiveNow = !plant.archived;
        const ok = confirm(
            archiveNow
                ? `Archive "${plant.plant_name}"?`
                : `Unarchive "${plant.plant_name}"?`,
        );
        if (!ok) return;
        await saveRecord(
            "plants_db",
            "plants",
            { id, archived: archiveNow },
            true,
        );
        openPlantDetail(id);
    },

    "plant-delete": async (btn) => {
        const id = btn.dataset.id;
        if (!id) return;
        await deletePlant(id);
        closeModal("plantItemModal");
    },

    "plant-history-delete": async (btn) => {
        const id = btn.dataset.id;
        const plantId = btn.dataset.plantid;
        if (!id) return;
        await deletePlantHistory(id, plantId);
    },

    "note-delete": async (btn) => {
        const id = btn.dataset.id;
        if (!id) return;
        await deleteRecord(
            "notes_db",
            "notes",
            id,
            "Delete this note permanently?",
        );
    },
};

document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (btn) {
        const action = btn.dataset.action;
        const handler = ACTION_HANDLERS[action];
        if (handler) {
            try {
                await handler(btn);
            } catch (err) {
                console.error(`Action "${action}" failed:`, err);
                alert(err.message || "Action failed");
            }
            return;
        }
    }

    const row = e.target.closest("[data-open-type][data-id]");
    if (row) {
        const openType = row.dataset.openType;
        const id = row.dataset.id;
        if (openType && id) {
            const panelCfg = PANEL_CONFIGS[openType];
            if (panelCfg?.functions?.editItem) {
                panelCfg.functions.editItem(id);
            }
        }
    }
});
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY TOKEN
// ============================================================
function activateSpotifyHeader(activate = true) {
    const panel = selectElement('[data-section="spotify"]');
    if (!panel) return;
    const header = selectElement(".panel-header", panel);
    if (!header) return;
    header.classList.toggle("spotify-header-error", activate);
}

async function saveSpotifyToken(tokenData) {
    const { sb, user } = await getSupabaseContext();
    const expiresAt = new Date(
        Date.now() + tokenData.expires_in * 1000,
    ).toISOString();
    const { error } = await sb.from("spotify_tokens").upsert(
        {
            user_id: user.id,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token ?? null,
            expires_at: expiresAt,
            scope: tokenData.scope ?? null,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
    );
    if (error) throw error;
    spotifyToken = tokenData.access_token;
    spotifyTokenExpiry = new Date(expiresAt).getTime();
}

async function loadSpotifyToken() {
    const { sb, user } = await getSupabaseContext();
    const { data, error } = await sb
        .from("spotify_tokens")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
    if (error) {
        console.error("loadSpotifyToken failed: ", error);
        return null;
    }
    return data;
}

async function refreshSpotifyToken(refreshToken) {
    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });
    if (!res.ok) throw new Error(`refreshSpotifyToken failed: ${res.status}`);
    return await res.json();
}

async function getValidSpotifyToken(forceRefresh = false) {
    const fiveMinutes = 5 * 60 * 1000;
    if (
        !forceRefresh &&
        spotifyToken &&
        Date.now() < spotifyTokenExpiry - fiveMinutes
    ) {
        return spotifyToken;
    }
    try {
        const tokenRow = await loadSpotifyToken();
        if (!tokenRow) return null;
        const expiresAt = new Date(tokenRow.expires_at).getTime();
        const needsRefresh = Date.now() > expiresAt - fiveMinutes;
        if (!needsRefresh) {
            spotifyToken = tokenRow.access_token;
            spotifyTokenExpiry = expiresAt;
            return tokenRow.access_token;
        }
        const refreshed = await refreshSpotifyToken(tokenRow.refresh_token);
        await saveSpotifyToken({
            ...refreshed,
            refresh_token: refreshed.refresh_token ?? tokenRow.refresh_token,
        });
        return spotifyToken;
    } catch (err) {
        console.error("getValidSpotifyToken failed: ", err);
        activateSpotifyHeader();
        return null;
    }
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY INIT
// ============================================================
function isTablet() {
    if (DEV_MODE) return true;
    const ua = navigator.userAgent || "";
    const isFirefox = /Firefox\/\d+/i.test(ua);
    const isWindows81 = /Windows NT 6\.3/i.test(ua);
    return isFirefox && isWindows81;
}

async function spotifyAuth() {
    const verifier = (() => {
        const array = new Uint8Array(64);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");
    })();
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(verifier),
    );
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
    sessionStorage.setItem("spotify_code_verifier", verifier);
    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: "code",
        redirect_uri: SPOTIFY_REDIRECT_URI,
        scope: SPOTIFY_SCOPES.join(" "),
        code_challenge_method: "S256",
        code_challenge: challenge,
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function exchangeCodeForToken(code) {
    const verifier = sessionStorage.getItem("spotify_code_verifier");
    if (!verifier) throw new Error("No code verifier found");
    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: "authorization_code",
            code,
            redirect_uri: SPOTIFY_REDIRECT_URI,
            code_verifier: verifier,
        }),
    });
    if (!res.ok) throw new Error(`exchangeCodeForToken failed: ${res.status}`);
    const data = await res.json();
    sessionStorage.removeItem("spotify_code_verifier");
    return data;
}

async function initSpotify() {
    if (!isTablet()) {
        activateSpotifyHeader(false);
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
        );
        try {
            const tokenData = await exchangeCodeForToken(code);
            await saveSpotifyToken(tokenData);
            activateSpotifyHeader(false);
        } catch (err) {
            console.error("initSpotify failed: ", err);
            activateSpotifyHeader();
        }
        return;
    }
    const token = await getValidSpotifyToken();
    activateSpotifyHeader(!token);
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY DATA
// ============================================================
function fetchNowPlaying() {
    if (nowPlayingInterval) return;
    nowPlayingInterval = setInterval(async () => {
        const token = await getValidSpotifyToken();
        if (!token) return;
        try {
            const res = await fetch("https://api.spotify.com/v1/me/player", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.status === 204 || !res.ok) {
                renderNowPlaying(null);
                return;
            }
            const data = await res.json();
            if (!data?.item) {
                renderNowPlaying(null);
                return;
            }
            renderNowPlaying({
                paused: !data.is_playing,
                track_window: {
                    current_track: {
                        name: data.item.name,
                        artists: data.item.artists,
                        album: { images: data.item.album.images },
                    },
                },
            });
        } catch (err) {
            console.error("fetchNowPlaying failed: ", err);
        }
    }, 5000);
}

function parseSpotifyPlaylistInput(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";
    if (/^[A-Za-z0-9]{22}$/.test(raw)) return raw;
    const urlMatch = raw.match(/spotify\.com\/playlist\/([A-Za-z0-9]{22})/i);
    if (urlMatch) return urlMatch[1];
    const uriMatch = raw.match(/^spotify:playlist:([A-Za-z0-9]{22})$/i);
    if (uriMatch) return uriMatch[1];
    return "";
}

async function fetchPlaylistById(playlistId) {
    const token = await getValidSpotifyToken();
    if (!token || !playlistId) return null;
    try {
        const res = await fetch(
            `https://api.spotify.com/v1/playlists/${playlistId}`,
            {
                headers: { Authorization: `Bearer ${token}` },
            },
        );
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        console.error("fetchPlaylistById failed:", err);
        return null;
    }
}

async function resolveManualPlaylist(input) {
    const playlistId = parseSpotifyPlaylistInput(input);
    if (!playlistId) {
        return { ok: false, reason: "invalid_format" };
    }
    const playlist = await fetchPlaylistById(playlistId);
    if (playlist?.id) {
        return {
            ok: true,
            playlistId: playlist.id,
            playlistName: playlist.name || playlist.id,
            fetched: true,
        };
    }
    return {
        ok: true,
        playlistId,
        playlistName: playlistId,
        fetched: false,
    };
}

async function fetchPlaylists() {
    const token = await getValidSpotifyToken();
    if (!token) {
        spotifyPlaylists = [];
        return [];
    }
    const all = [];
    let url = "https://api.spotify.com/v1/me/playlists?limit=50";
    try {
        while (url) {
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) break;
            const data = await res.json();
            all.push(...(data.items || []).filter(Boolean));
            url = data.next;
        }
        let likedTotal = 0;
        try {
            const likedRes = await fetch(
                "https://api.spotify.com/v1/me/tracks?limit=1",
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (likedRes.ok) {
                const likedData = await likedRes.json();
                likedTotal = likedData.total || 0;
            }
        } catch (_) {}
        spotifyPlaylists = [
            {
                id: "__liked_songs__",
                name: "Liked Songs",
                uri: "spotify:collection:tracks",
                owner: { display_name: "You" },
                tracks: { total: likedTotal },
                images: [],
                isVirtualLikedSongs: true,
            },
            ...all,
        ];
        return spotifyPlaylists;
    } catch (err) {
        console.error("fetchPlaylists failed: ", err);
        spotifyPlaylists = [];
        return [];
    }
}

async function loadPlaylists() {
    const { sb, user } = await getSupabaseContext();
    const { data, error } = await sb
        .from("spotify_playlists")
        .select("*")
        .eq("user_id", user.id)
        .order("slot_number", { ascending: true });
    if (error) {
        console.error("loadPlaylists: ", error);
        return [];
    }
    return data || [];
}

async function loadSchedules() {
    const { sb, user } = await getSupabaseContext();
    const { data, error } = await sb
        .from("spotify_schedules")
        .select("*")
        .eq("user_id", user.id)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });
    if (error) {
        console.error("loadSchedules failed: ", error);
        return [];
    }
    schedules = data || [];
    return schedules;
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY PLAYER
// ============================================================
window.onSpotifyWebPlaybackSDKReady = function () {
    initSpotifyPlayer();
};

async function initSpotifyPlayer() {
    if (!isTablet()) return;
    let token = null;
    for (let i = 0; i < 10; i++) {
        token = await getValidSpotifyToken();
        if (token) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!token) return;

    spotifyPlayer = new Spotify.Player({
        name: "kf20d",
        getOAuthToken: (cb) => {
            getValidSpotifyToken().then((t) => {
                if (t) cb(t);
            });
        },
        volume: spotifyVolume / 100,
    });

    spotifyPlayer.addListener("ready", ({ device_id }) => {
        spotifyDeviceId = device_id;
        isSpotifyReady = true;
    });

    spotifyPlayer.addListener("authentication_error", async ({ message }) => {
        console.error("SDK auth error: ", message);
        const fresh = await getValidSpotifyToken(true);
        if (fresh && spotifyPlayer) {
            await spotifyPlayer.connect();
            activateSpotifyHeader(false);
        } else {
            activateSpotifyHeader();
        }
    });

    spotifyPlayer.addListener("account_error", ({ message }) => {
        console.error("SDK account error: ", message);
        activateSpotifyHeader();
    });

    spotifyPlayer.addListener("player_state_changed", renderNowPlaying);

    await spotifyPlayer.connect();
}

async function getDeviceId() {
    const token = await getValidSpotifyToken();
    if (!token) return null;
    try {
        const res = await fetch(
            "https://api.spotify.com/v1/me/player/devices",
            {
                headers: { Authorization: `Bearer ${token}` },
            },
        );
        if (!res.ok) {
            console.error("getDeviceId failed", res.status, await res.text());
            return null;
        }
        const data = await res.json();
        const device = (data.devices || []).find((d) => d.name === "kf20d");
        return device?.id || null;
    } catch (err) {
        console.error("getDeviceId failed: ", err);
        return null;
    }
}

async function playPlaylist(playlistId) {
    const token = await getValidSpotifyToken();
    const targetDeviceId = await getDeviceId();
    if (!targetDeviceId) {
        console.error("Could not find Spotify device kf20d");
        return;
    }
    spotifyDeviceId = targetDeviceId;
    const body =
        playlistId === "__liked_songs__"
            ? { context_uri: "spotify:collection:tracks" }
            : { context_uri: `spotify:playlist:${playlistId}` };

    if (!token || !spotifyDeviceId || !playlistId) return false;
    try {
        const res = await fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId)}`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    context_uri: `spotify:playlist:${playlistId}`,
                }),
            },
        );
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("playPlaylist failed:", res.status, text);
            return false;
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
        await fetch("https://api.spotify.com/v1/me/player/shuffle?state=true", {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` },
        });
        await new Promise((resolve) => setTimeout(resolve, 400));
        await fetch(
            "https://api.spotify.com/v1/me/player/repeat?state=context",
            {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}` },
            },
        );
        return true;
    } catch (err) {
        console.error("playPlaylist failed: ", err);
        return false;
    }
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY SCHEDULER
// ============================================================
function getNextSchedule() {
    const todayStr = getTodayHKT();
    const currentTime = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Hong_Kong",
    });
    return (
        schedules.find((s) => {
            if (!s || s.triggered) return false;
            if (s.scheduled_date > todayStr) return true;
            if (
                s.scheduled_date === todayStr &&
                s.scheduled_time?.slice(0, 5) > currentTime
            )
                return true;
            return false;
        }) ?? null
    );
}

async function checkAndTriggerSchedule() {
    if (!isSpotifyReady || !spotifyDeviceId) return;
    const todayStr = getTodayHKT();
    const nowHKT = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Hong_Kong",
    });
    const due = schedules.filter(
        (s) =>
            !s.triggered &&
            s.scheduled_date === todayStr &&
            s.scheduled_time?.slice(0, 5) === nowHKT,
    );
    if (!due.length) return;
    const { sb, user } = await getSupabaseContext();
    let lastPlaylistId = null;
    for (const entry of due) {
        const { error } = await sb
            .from("spotify_schedules")
            .update({ triggered: true })
            .eq("id", entry.id);
        if (error) {
            console.error("Trigger schedule failed", error);
            continue;
        }
        if (entry.playlist_id) lastPlaylistId = entry.playlist_id;
    }
    if (lastPlaylistId) await playPlaylist(lastPlaylistId);
    await loadSchedules();
    renderNextSchedule();
}

function startScheduleTicker() {
    if (scheduleTickInterval) clearInterval(scheduleTickInterval);
    scheduleTickInterval = setInterval(checkAndTriggerSchedule, 60000);
    checkAndTriggerSchedule();
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY RENDERERS
// ============================================================
function ensureTextIcon(icon) {
    return icon || "♫";
}

function renderNowPlaying(state) {
    const artEl = getElement("spotifyArt");
    if (!state || !state.track_window?.current_track) {
        if (artEl) {
            artEl.style.backgroundImage = "";
            artEl.style.backgroundSize = "";
            artEl.style.backgroundPosition = "";
            const placeholder = selectElement(
                ".spotify-art-placeholder",
                artEl,
            );
            if (placeholder) placeholder.style.display = "flex";
        }
        setElementText("spotifyTitle", "—");
        setElementText("spotifyArtist", "—");
        setElementText("spotifyPlayBtn", "▶");
        return;
    }
    const track = state.track_window.current_track;
    if (artEl) {
        const img = track.album?.images?.[0]?.url;
        artEl.style.backgroundImage = img ? `url(${img})` : "";
        artEl.style.backgroundSize = "cover";
        artEl.style.backgroundPosition = "center";
        const placeholder = selectElement(".spotify-art-placeholder", artEl);
        if (placeholder) placeholder.style.display = img ? "none" : "flex";
    }

    setElementText("spotifyTitle", track.name);
    setElementText(
        "spotifyArtist",
        track.artists.map((a) => a.name).join(", "),
    );
    setElementText("spotifyPlayBtn", state.paused ? "▶" : "❚❚");
}

async function renderSlots() {
    const rows = await loadPlaylists();
    playlistSlots = rows;
    selectAllElements(".spotify-slot-btn").forEach((btn) => {
        const slot = Number(btn.dataset.slot);
        const row = rows.find((r) => r.slot_number === slot);
        const icon = ensureTextIcon(row?.playlist_icon);
        btn.textContent = icon;
        btn.dataset.playlistId = row?.playlist_id || "";
        btn.dataset.playlistName = row?.playlist_name || "";
    });
    selectAllElements(".spotify-slot-pick-btn").forEach((btn) => {
        const slot = Number(btn.dataset.slot);
        const row = rows.find((r) => r.slot_number === slot);
        const icon = ensureTextIcon(row?.playlist_icon);
        btn.textContent = icon;
        btn.classList.toggle("has-playlist", !!row?.playlist_id);
    });
}

function renderNextSchedule() {
    const next = getNextSchedule();
    if (!next) {
        setElementText("spotifySchedDate", "");
        setElementText("spotifySchedTime", "");
        setElementText("spotifySchedPlaylist", "No upcoming schedules");
        return;
    }
    setElementText(
        "spotifySchedDate",
        new Date(`${next.scheduled_date}T00:00:00Z`)
            .toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                timeZone: "Asia/Hong_Kong",
            })
            .toUpperCase(),
    );
    setElementText("spotifySchedTime", next.scheduled_time?.slice(0, 5) ?? "");
    setElementText("spotifySchedPlaylist", next.playlist_name || "Untitled");
}

function renderCalendar() {
    setElementText(
        "spotifyCalMonthLabel",
        spotifyCalendarMonth
            .toLocaleDateString("en-GB", { month: "short", year: "numeric" })
            .toUpperCase(),
    );

    const y = spotifyCalendarMonth.getFullYear();
    const m = spotifyCalendarMonth.getMonth();
    const firstDay = new Date(y, m, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = getTodayHKT();

    let html = "";

    for (let i = 0; i < startOffset; i++) {
        html += `<div class="spotify-calendar-cell empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayEntries = schedules.filter(
            (s) => s.scheduled_date === dateStr && !s.triggered,
        );
        const isToday = dateStr === today;
        const isSelected = dateStr === spotifySelectedDate;

        let dotsHtml = "";
        if (dayEntries.length) {
            const types = new Set(dayEntries.map((s) => s.schedule_type));
            const dotSpans = ["weekly", "shift", "once"]
                .filter((t) => types.has(t))
                .map((t) => `<span class="cal-dot dot-${t}"></span>`)
                .join("");
            dotsHtml = `<div class="cal-dots">${dotSpans}</div>`;
        }

        html += `
            <button type="button" class="spotify-calendar-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-date="${dateStr}">
                ${day}
                ${dotsHtml}
            </button>
        `;
    }

    setElementHTML("spotifyCalendarGrid", html);

    selectAllElements(
        ".spotify-calendar-cell[data-date]",
        getElement("spotifyCalendarGrid"),
    ).forEach((cell) => {
        cell.onclick = () => {
            spotifySelectedDate = cell.dataset.date;
            renderCalendar();
            renderSchedule(spotifySelectedDate);
        };
    });
}

function refreshScheduleActionState() {
    const delBtn = getElement("spotifyDeleteScheduleBtn");
    if (delBtn) {
        delBtn.disabled = !spotifySelectedScheduleId;
    }
}

function renderSchedule(dateStr) {
    setElementText("spotifySelectedDateLabel", dateStr);

    const items = schedules.filter((s) => s.scheduled_date === dateStr);

    if (!items.length) {
        setElementHTML(
            "spotifyDaySchedules",
            `<div class="spotify-day-row">
                <div class="spotify-day-row-meta">No schedules for this day.</div>
            </div>`,
        );
        spotifySelectedScheduleId = null;
        spotifySelectedSchedule = null;
        refreshScheduleActionState?.();
        return;
    }

    setElementHTML(
        "spotifyDaySchedules",
        items
            .map(
                (item) => `
            <div class="spotify-day-row ${spotifySelectedScheduleId === item.id ? "selected" : ""}" data-id="${item.id}">
                <div class="spotify-day-row-title">${item.scheduled_time} ${item.playlist_name || "Untitled"}</div>
                <div class="spotify-day-row-meta">${item.schedule_type}</div>
            </div>
        `,
            )
            .join(""),
    );

    selectAllElements(
        ".spotify-day-row[data-id]",
        getElement("spotifyDaySchedules"),
    ).forEach((row) => {
        row.onclick = async () => {
            const item = schedules.find((s) => String(s.id) === row.dataset.id);
            if (!item) return;
            spotifySelectedScheduleId = item.id;
            spotifySelectedSchedule = item;
            refreshScheduleActionState?.();
            setupScheduleForm();
            await openSpotifyEditSchedule(item.id);
        };
    });

    refreshScheduleActionState?.();
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY MODALS
// ============================================================
async function populatePlaylistDropdown(elementId, selectedId = "") {
    setElementHTML(elementId, '<option value="">Loading...</option>');
    const playlists = spotifyPlaylists.length
        ? spotifyPlaylists
        : await fetchPlaylists();
    if (!playlists.length) {
        setElementHTML(
            elementId,
            '<option value="">— no playlists found —</option>',
        );
        return;
    }
    setElementHTML(
        elementId,
        '<option value="">— select —</option>' +
            playlists
                .map((p) => `<option value="${p.id}">${p.name}</option>`)
                .join(""),
    );
    setElementValue(elementId, selectedId || "");
}

async function openPlaylistModal() {
    openModal("spotifyPlaylistModal");
    const [playlists, slots] = await Promise.all([
        fetchPlaylists(),
        loadPlaylists(),
    ]);
    setElementValue("spotifySlotPlaylistManual", "");
    playlistSlots = slots;
    selectAllElements(
        ".spotify-slot-pick-btn",
        getElement("spotifySlotPicker"),
    ).forEach((btn) => {
        const slot = Number(btn.dataset.slot);
        const row = slots.find((r) => r.slot_number === slot);
        btn.textContent = ensureTextIcon(row?.playlist_icon);
        btn.classList.toggle("has-playlist", !!row?.playlist_id);
        btn.classList.remove("active");
    });
    setElementHTML(
        "spotifySlotPlaylistSelect",
        `<option value="">select</option>${playlists
            .map((pl) => `<option value="${pl.id}">${pl.name}</option>`)
            .join("")}`,
    );
    setElementHTML(
        "spotifyIconPicker",
        ICONS.map(
            (icon) =>
                `<button type="button" class="spotify-icon-option" data-icon="${icon}">${icon}</button>`,
        ).join(""),
    );
    selectAllElements(
        ".spotify-icon-option",
        getElement("spotifyIconPicker"),
    ).forEach((el) =>
        el.addEventListener("click", () => {
            selectAllElements(
                ".spotify-icon-option",
                getElement("spotifyIconPicker"),
            ).forEach((x) => x.classList.remove("active"));
            el.classList.add("active");
        }),
    );
    activeSlot = null;
    hideElement("spotifySlotEditor");
    showElement("spotifySlotEditorPrompt", "block");
    selectAllElements(".spotify-slot-pick-btn").forEach((btn) => {
        btn.onclick = () => selectSlotForEdit(Number(btn.dataset.slot));
    });
    getElement("spotifySlotSaveBtn").onclick = saveSlotFromModal;
}

async function openSpotifyAddSchedule(dateStr) {
    spotifySelectedScheduleId = null;
    spotifySelectedSchedule = null;
    setElementText("spotifyScheduleFormTitle", "Add new schedule");
    setElementValue("ssfDate", dateStr || getTodayHKT());
    setElementValue("ssfTime", "");
    setElementValue("ssfPlaylist", "");
    setElementValue("ssfPlaylistManual", "");
    hideElement("ssfDeleteBtn");
    await populatePlaylistDropdown("ssfPlaylist");
    openModal("spotifyScheduleFormModal");
}

async function openSpotifyEditSchedule(scheduleId) {
    const item = schedules.find((s) => s.id === scheduleId);
    if (!item) return;
    spotifySelectedScheduleId = scheduleId;
    spotifySelectedSchedule = item;
    setElementText("spotifyScheduleFormTitle", "EDIT SCHEDULE");
    setElementValue("ssfDate", item.scheduled_date);
    setElementValue("ssfTime", item.scheduled_time?.slice(0, 5) || "");
    setElementValue("ssfPlaylistManual", "");
    showElement("ssfDeleteBtn", "block");
    await populatePlaylistDropdown("ssfPlaylist", item.playlist_id);
    openModal("spotifyScheduleFormModal");
}

async function openSpotifyScheduleModal() {
    openModal("spotifyScheduleModal");
    await loadSchedules();
    renderCalendar();
    renderSchedule(spotifySelectedDate);
    setupScheduleModal();
    setupTemplates();
    refreshScheduleActionState?.();
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY ACTIONS
// ============================================================
function setupSpotifyAuth() {
    const authBtn = getElement("spotifyAuthBtn");
    if (authBtn && !authBtn.dataset.bound) {
        authBtn.dataset.bound = "1";
        authBtn.addEventListener("click", spotifyAuth);
    }
    const panel = selectElement('[data-section="spotify"]');
    if (!panel) return;
    const header = selectElement(".panel-header", panel);
    if (!header || header.dataset.spotifyBound) return;
    header.dataset.spotifyBound = "1";
    header.addEventListener("click", (e) => {
        if (header.classList.contains("spotify-header-error")) {
            e.stopPropagation();
            openModal("spotifyAuthModal");
        }
    });
}

function setupPlaybackControls() {
    const prevBtn = getElement("spotifyPrevBtn");
    const playBtn = getElement("spotifyPlayBtn");
    const nextBtn = getElement("spotifyNextBtn");
    if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.dataset.bound = "1";
        prevBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (spotifyPlayer) await spotifyPlayer.previousTrack();
        });
    }
    if (playBtn && !playBtn.dataset.bound) {
        playBtn.dataset.bound = "1";
        playBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (spotifyPlayer) await spotifyPlayer.togglePlay();
        });
    }
    if (nextBtn && !nextBtn.dataset.bound) {
        nextBtn.dataset.bound = "1";
        nextBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (spotifyPlayer) await spotifyPlayer.nextTrack();
        });
    }
}

function setupVolumeControls() {
    const volUp = getElement("volUpBtn");
    const volDown = getElement("volDownBtn");
    if (!volUp || !volDown || volUp.dataset.bound) return;
    volUp.dataset.bound = "1";
    volUp.addEventListener("click", async (e) => {
        e.stopPropagation();
        spotifyVolume = Math.min(100, spotifyVolume + 25);
        setElementText("volDisplay", spotifyVolume);
        if (spotifyPlayer) await spotifyPlayer.setVolume(spotifyVolume / 100);
    });
    volDown.addEventListener("click", async (e) => {
        e.stopPropagation();
        spotifyVolume = Math.max(0, spotifyVolume - 25);
        setElementText("volDisplay", spotifyVolume);
        if (spotifyPlayer) await spotifyPlayer.setVolume(spotifyVolume / 100);
    });
}

function setupSlots() {
    const label = getElement("spotifyPlaylistsLabel");
    if (label && !label.dataset.bound) {
        label.dataset.bound = "1";
        label.addEventListener("click", (e) => {
            e.stopPropagation();
            openPlaylistModal();
        });
    }
    selectAllElements(".spotify-slot-btn").forEach((btn) => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = "1";
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const playlistId = btn.dataset.playlistId;
            if (!playlistId) return;
            await playPlaylist(playlistId);
        });
    });
}

function selectSlotForEdit(slotNumber) {
    activeSlot = slotNumber;
    selectAllElements(".spotify-slot-pick-btn").forEach((btn) =>
        btn.classList.toggle("active", Number(btn.dataset.slot) === slotNumber),
    );
    showElement("spotifySlotEditor", "block");
    hideElement("spotifySlotEditorPrompt");
    setElementText("spotifySlotEditorLabel", `Editing Slot ${slotNumber}`);
    const existing = playlistSlots.find((r) => r.slot_number === slotNumber);
    setElementValue("spotifySlotPlaylistSelect", existing?.playlist_id || "");
    setElementValue("spotifySlotPlaylistManual", "");
    selectAllElements(
        ".spotify-icon-option",
        getElement("spotifyIconPicker"),
    ).forEach((el) =>
        el.classList.toggle(
            "active",
            el.dataset.icon === ensureTextIcon(existing?.playlist_icon),
        ),
    );
}

async function saveSlotFromModal() {
    if (!activeSlot) return;
    const select = getElement("spotifySlotPlaylistSelect");
    const manualInput = getElement("spotifySlotPlaylistManual");
    let playlistId = "";
    let playlistName = "";
    if (manualInput?.value.trim()) {
        const resolved = await resolveManualPlaylist(manualInput.value);
        if (!resolved.ok) {
            alert("Invalid Spotify playlist URL / ID.");
            return;
        }
        playlistId = resolved.playlistId;
        playlistName = resolved.playlistName;
    } else {
        playlistId = select.value;
        playlistName = select.options[select.selectedIndex]?.text || "Untitled";
    }
    if (!playlistId) {
        alert("Select or enter playlist URL / ID");
        return;
    }
    const activeIcon = selectElement(".spotify-icon-option.active");
    const icon = ensureTextIcon(activeIcon?.dataset.icon);
    const { sb, user } = await getSupabaseContext();
    const { error } = await sb.from("spotify_playlists").upsert(
        {
            user_id: user.id,
            slot_number: activeSlot,
            playlist_id: playlistId,
            playlist_name: playlistName,
            playlist_icon: icon,
        },
        { onConflict: "user_id,slot_number" },
    );
    if (error) {
        console.error("saveSlotFromModal failed: ", error);
        alert(`Save slot failed: ${error.message}`);
        return;
    }
    if (manualInput) manualInput.value = "";
    await renderSlots();
    closeModal("spotifyPlaylistModal");
}

function setupScheduleForm() {
    const form = getElement("spotifyScheduleForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const isEdit = !!spotifySelectedScheduleId;
        const date = getElement("ssfDate").value;
        const time = getElement("ssfTime").value;
        const playlistSelect = getElement("ssfPlaylist");
        const manualInput = getElement("ssfPlaylistManual");

        let playlistId = "";
        let playlistName = "";

        if (manualInput?.value.trim()) {
            const resolved = await resolveManualPlaylist(manualInput.value);
            if (!resolved.ok) {
                alert("Invalid Spotify playlist URL / ID.");
                return;
            }
            playlistId = resolved.playlistId;
            playlistName = resolved.playlistName;
        } else {
            playlistId = playlistSelect.value;
            playlistName =
                playlistSelect.options[playlistSelect.selectedIndex]?.text ||
                "Untitled";
        }

        if (!date || !time || !playlistId) {
            alert("Please set date, time, and playlist.");
            return;
        }

        const { sb, user } = await getSupabaseContext();
        const record = {
            user_id: user.id,
            schedule_type: "once",
            scheduled_date: date,
            scheduled_time: time,
            playlist_id: playlistId,
            playlist_name: playlistName,
            triggered: false,
        };

        let error = null;

        if (isEdit) {
            ({ error } = await sb
                .from("spotify_schedules")
                .update({
                    scheduled_date: record.scheduled_date,
                    scheduled_time: record.scheduled_time,
                    playlist_id: record.playlist_id,
                    playlist_name: record.playlist_name,
                })
                .eq("id", spotifySelectedScheduleId)
                .eq("user_id", user.id));
        } else {
            ({ error } = await sb.from("spotify_schedules").insert(record));
        }

        if (error) {
            console.error("Save schedule failed:", error);
            alert(`Save schedule failed: ${error.message}`);
            return;
        }

        if (manualInput) manualInput.value = "";
        closeModal("spotifyScheduleFormModal");
        await loadSchedules();
        renderNextSchedule();
        renderCalendar();
        renderSchedule(spotifySelectedDate);
        refreshScheduleActionState();
    });

    const deleteBtn = getElement("ssfDeleteBtn");
    if (deleteBtn && !deleteBtn.dataset.bound) {
        deleteBtn.dataset.bound = "1";
        deleteBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!spotifySelectedScheduleId) return;
            if (!confirm("Delete this schedule?")) return;

            const { sb, user } = await getSupabaseContext();
            const { error } = await sb
                .from("spotify_schedules")
                .delete()
                .eq("id", spotifySelectedScheduleId)
                .eq("user_id", user.id);

            if (error) {
                console.error("Delete schedule failed:", error);
                alert(`Delete schedule failed: ${error.message}`);
                return;
            }

            closeModal("spotifyScheduleFormModal");
            spotifySelectedScheduleId = null;
            spotifySelectedSchedule = null;
            await loadSchedules();
            renderNextSchedule();
            renderCalendar();
            renderSchedule(spotifySelectedDate);
            refreshScheduleActionState();
        });
    }
}

function setupTemplates() {
    const toggleFields = () => {
        const type = getElement("spotifyTemplateType")?.value;
        const weekly = getElement("spotifyWeeklyFields");
        const shift = getElement("spotifyShiftFields");
        if (weekly) weekly.style.display = type === "weekly" ? "block" : "none";
        if (shift) shift.style.display = type === "shift" ? "block" : "none";
    };

    const typeEl = getElement("spotifyTemplateType");
    if (typeEl && !typeEl.dataset.bound) {
        typeEl.dataset.bound = "1";
        typeEl.addEventListener("change", toggleFields);
    }
    toggleFields();

    const cancelBtn = getElement("spotifyTemplateCancelBtn");
    if (cancelBtn && !cancelBtn.dataset.bound) {
        cancelBtn.dataset.bound = "1";
        cancelBtn.addEventListener("click", () =>
            hideElement("spotifyTemplateLoader"),
        );
    }

    const generateBtn = getElement("spotifyTemplateGenerateBtn");
    if (generateBtn && !generateBtn.dataset.bound) {
        generateBtn.dataset.bound = "1";
        generateBtn.addEventListener("click", generateSchedules);
    }
}

function setupScheduleModal() {
    const prevBtn = getElement("spotifyCalPrevBtn");
    const nextBtn = getElement("spotifyCalNextBtn");

    if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.dataset.bound = 1;
        prevBtn.addEventListener("click", async () => {
            spotifyCalendarMonth = new Date(
                spotifyCalendarMonth.getFullYear(),
                spotifyCalendarMonth.getMonth() - 1,
                1,
            );
            renderCalendar();
        });
    }

    if (nextBtn && !nextBtn.dataset.bound) {
        nextBtn.dataset.bound = 1;
        nextBtn.addEventListener("click", async () => {
            spotifyCalendarMonth = new Date(
                spotifyCalendarMonth.getFullYear(),
                spotifyCalendarMonth.getMonth() + 1,
                1,
            );
            renderCalendar();
        });
    }

    getElement("spotifyLoadTemplateBtn").onclick = async () => {
        showElement("spotifyTemplateLoader", "block");
        setupTemplates();
        await populatePlaylistDropdown("spotifyTemplatePlaylistSelect");
        setElementValue("spotifyTemplatePlaylistManual", "");
    };

    const addBtn = getElement("spotifyAddScheduleBtn");
    const delBtn = getElement("spotifyDeleteScheduleBtn");

    if (addBtn && !addBtn.dataset.bound) {
        addBtn.dataset.bound = 1;
        addBtn.addEventListener("click", async () => {
            setupScheduleForm();
            await openSpotifyAddSchedule(spotifySelectedDate || getTodayHKT());
        });
    }

    if (delBtn && !delBtn.dataset.bound) {
        delBtn.dataset.bound = 1;
        delBtn.addEventListener("click", async () => {
            if (!spotifySelectedScheduleId) return;
            if (!confirm("Delete this schedule?")) return;

            const { sb, user } = await getSupabaseContext();
            const { error } = await sb
                .from("spotify_schedules")
                .delete()
                .eq("id", spotifySelectedScheduleId)
                .eq("user_id", user.id);

            if (error) {
                console.error("Delete schedule failed:", error);
                alert(`Delete schedule failed: ${error.message}`);
                return;
            }

            spotifySelectedScheduleId = null;
            spotifySelectedSchedule = null;

            await loadSchedules();
            renderNextSchedule();
            renderCalendar();
            renderSchedule(spotifySelectedDate);
            refreshScheduleActionState();
        });
    }

    refreshScheduleActionState();

    const schedRow = getElement("spotifySchedRow");
    if (schedRow && !schedRow.dataset.bound) {
        schedRow.dataset.bound = 1;
        schedRow.addEventListener("click", async (e) => {
            e.stopPropagation();
            const next = getNextSchedule();
            if (!next) return;
            spotifySelectedScheduleId = next.id;
            spotifySelectedSchedule = next;
            setupScheduleForm();
            await openSpotifyEditSchedule(next.id);
        });
    }
}

function setupScheduleButtons() {
    const skipBtn = getElement("spotifySchedSkipBtn");
    if (skipBtn && !skipBtn.dataset.bound) {
        skipBtn.dataset.bound = "1";
        skipBtn.addEventListener("click", async (e) => {
            e.stopPropagation();

            const next = getNextSchedule();
            if (!next) return;

            if (!confirm("Skip and delete this schedule?")) return;

            const { sb, user } = await getSupabaseContext();
            const { error } = await sb
                .from("spotify_schedules")
                .delete()
                .eq("id", next.id);

            if (error) {
                console.error("Skip schedule failed:", error);
                return;
            }

            if (spotifySelectedScheduleId === next.id) {
                spotifySelectedScheduleId = null;
                spotifySelectedSchedule = null;
            }

            await loadSchedules();
            renderNextSchedule();
            renderCalendar();
            renderSchedule(spotifySelectedDate);
            refreshScheduleActionState();
        });
    }

    const addBtn = getElement("spotifySchedAddBtn");
    if (addBtn && !addBtn.dataset.bound) {
        addBtn.dataset.bound = 1;
        addBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            setupScheduleForm();
            await openSpotifyAddSchedule(spotifySelectedDate || getTodayHKT());
        });
    }

    const schedRow = getElement("spotifySchedRow");
    if (schedRow && !schedRow.dataset.bound) {
        schedRow.dataset.bound = 1;
        schedRow.addEventListener("click", async (e) => {
            e.stopPropagation();
            const next = getNextSchedule();
            if (!next) return;

            spotifySelectedSchedule = next;
            spotifySelectedScheduleId = next.id;
            refreshScheduleActionState();
            setupScheduleForm();
            await openSpotifyEditSchedule(next.id);
        });
    }
}

async function generateSchedules() {
    const type = getElement("spotifyTemplateType").value;
    const startDateStr = getElement("spotifyTemplateStartDate").value;
    const endDateStr = getElement("spotifyTemplateEndDate").value;
    const overrideMode =
        selectElement('input[name="spotifyOverrideMode"]:checked')?.value ||
        "add";

    const playlistSelect = getElement("spotifyTemplatePlaylistSelect");
    const manualInput = getElement("spotifyTemplatePlaylistManual");

    let playlistId = "";
    let playlistName = "";

    if (manualInput?.value.trim()) {
        const resolved = await resolveManualPlaylist(manualInput.value);
        if (!resolved.ok) {
            alert("Invalid Spotify playlist URL / ID.");
            return;
        }
        playlistId = resolved.playlistId;
        playlistName = resolved.playlistName;
    } else {
        playlistId = playlistSelect.value;
        playlistName =
            playlistSelect.options[playlistSelect.selectedIndex]?.text ||
            "Untitled";
    }

    if (!startDateStr || !playlistId) {
        alert("Please set a start date and playlist.");
        return;
    }

    const { sb, user } = await getSupabaseContext();
    const rows = [];
    const startDate = new Date(startDateStr + "T00:00:00Z");
    const endDate = endDateStr
        ? new Date(endDateStr + "T00:00:00Z")
        : new Date(startDateStr + "T00:00:00Z");

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        alert("Invalid date range.");
        return;
    }

    if (endDate < startDate) {
        alert("End date cannot be earlier than start date.");
        return;
    }

    const templateRef = crypto.randomUUID();

    if (overrideMode === "replace-range") {
        const { error } = await sb
            .from("spotify_schedules")
            .delete()
            .gte("scheduled_date", startDateStr)
            .lte("scheduled_date", endDate.toISOString().slice(0, 10))
            .eq("user_id", user.id);

        if (error) {
            console.error("Replace-range delete failed:", error);
            alert(`Replace-range failed: ${error.message}`);
            return;
        }
    }

    if (type === "weekly") {
        const checkedDays = selectAllElements(
            '#spotifyWeeklyFields input[type="checkbox"]:checked',
        ).map((cb) => parseInt(cb.value, 10));
        const time = getElement("spotifyWeeklyTime").value;

        if (!checkedDays.length || !time) {
            alert("Please select at least one weekday and a time.");
            return;
        }

        const cursor = new Date(startDate);
        while (cursor <= endDate) {
            if (checkedDays.includes(cursor.getUTCDay())) {
                rows.push({
                    user_id: user.id,
                    schedule_type: "weekly",
                    template_ref: templateRef,
                    scheduled_date: cursor.toISOString().slice(0, 10),
                    scheduled_time: time,
                    playlist_id: playlistId,
                    playlist_name: playlistName,
                    triggered: false,
                });
            }
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    } else if (type === "shift") {
        const day1Index = parseInt(
            getElement("spotifyShiftDay1Index").value,
            10,
        );
        const times = {
            afternoon: getElement("spotifyShiftAfternoonTime").value,
            early: getElement("spotifyShiftEarlyTime").value,
            overnight: getElement("spotifyShiftOvernightTime").value,
            off: getElement("spotifyShiftOffTime").value,
        };

        const shiftPattern = [
            times.afternoon,
            times.afternoon,
            times.off,
            times.early,
            times.early,
            times.overnight,
            times.overnight,
            times.off,
            times.off,
            times.off,
        ];

        const cursor = new Date(startDate);
        while (cursor <= endDate) {
            const daysSinceStart = Math.floor(
                (cursor - startDate) / (1000 * 60 * 60 * 24),
            );
            const cycleDay =
                (((day1Index - 1 + daysSinceStart) % 10) + 10) % 10;
            const time = shiftPattern[cycleDay];

            if (time) {
                rows.push({
                    user_id: user.id,
                    schedule_type: "shift",
                    template_ref: templateRef,
                    scheduled_date: cursor.toISOString().slice(0, 10),
                    scheduled_time: time,
                    playlist_id: playlistId,
                    playlist_name: playlistName,
                    triggered: false,
                });
            }

            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }

    if (!rows.length) {
        alert("No schedules generated. Check your settings.");
        return;
    }

    for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await sb.from("spotify_schedules").insert(batch);
        if (error) {
            console.error("Insert schedules failed:", error);
            alert(`Insert schedules failed: ${error.message}`);
            return;
        }
    }

    if (manualInput) manualInput.value = "";
    await loadSchedules();
    renderNextSchedule();
    renderCalendar();
    renderSchedule(spotifySelectedDate);
    refreshScheduleActionState();
    hideElement("spotifyTemplateLoader");
    showElement("spotifyLoadTemplateBtn", "block");
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region DASHBOARD INIT
// ============================================================
function showLogin() {
    showElement("loginContainer");
    selectElement(".dashboard").style.display = "none";
    cleanupSubscriptions();
    isRealtimeSetup = false;
    if (scheduleTickInterval) {
        clearInterval(scheduleTickInterval);
        scheduleTickInterval = null;
    }
    if (nowPlayingInterval) {
        clearInterval(nowPlayingInterval);
        nowPlayingInterval = null;
    }
}

function tickClock() {
    const now = new Date();
    const hkt = new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Hong_Kong",
    }).formatToParts(now);
    const get = (type) => hkt.find((p) => p.type === type)?.value ?? "";
    const weekday = get("weekday").toUpperCase();
    const day = get("day");
    const month = get("month").toUpperCase();
    const year = get("year");
    const hour = get("hour");
    const minute = get("minute");
    setElementText(
        "clockDisplay",
        `${weekday}\u00A0\u00A0${day} ${month} ${year}\u00A0\u00A0${hour}:${minute}`,
    );

    const todayHKT = getTodayHKT();
    if (todayHKT !== lastKnownDate) {
        lastKnownDate = todayHKT;
        PANELS.forEach(renderPanel);
    }
}

function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    setTimeout(() => {
        tickClock();
        clockInterval = setInterval(tickClock, 1000);
    }, 100);
}

function renderSpotify() {
    setElementHTML(
        "spotifyContent",
        `<div class="spotify-panel">
            <div class="spotify-nowplaying">
                <div class="spotify-art" id="spotifyArt">
                    <div class="spotify-art-placeholder">♪</div>
                </div>
                <div class="spotify-track">
                    <div class="spotify-track-title" id="spotifyTitle">—</div>
                    <div class="spotify-track-artist" id="spotifyArtist">—</div>
                    <div class="spotify-playback-row">
                        <button class="spotify-btn" id="spotifyPrevBtn" type="button">⏮</button>
                        <button class="spotify-btn spotify-btn-play" id="spotifyPlayBtn" type="button">▶</button>
                        <button class="spotify-btn" id="spotifyNextBtn" type="button">⏭</button>
                    </div>
                </div>
            </div>

            <div class="spotify-shortcuts">
                <span id="spotifyPlaylistsLabel">Playlists</span>
                <button class="spotify-slot-btn" data-slot="1" type="button">1</button>
                <button class="spotify-slot-btn" data-slot="2" type="button">2</button>
                <button class="spotify-slot-btn" data-slot="3" type="button">3</button>
                <button class="spotify-slot-btn" data-slot="4" type="button">4</button>
                <button class="spotify-slot-btn" data-slot="5" type="button">5</button>
            </div>

            <div class="spotify-schedule">
                <div class="spotify-schedule-title">NEXT SCHEDULE</div>
                <div class="spotify-schedule-row" id="spotifySchedRow">
                    <span class="spotify-schedule-date" id="spotifySchedDate">—</span>
                    <span class="spotify-schedule-time" id="spotifySchedTime"></span>
                    <span class="spotify-schedule-playlist" id="spotifySchedPlaylist"></span>
                </div>
                <div class="spotify-schedule-actions">
                    <button class="spotify-schedule-action btn-green"  type="button" id="spotifySchedAddBtn">Add</button>
                    <button class="spotify-schedule-action btn-red" type="button" id="spotifySchedSkipBtn">Skip</button>
                    <button class="spotify-schedule-action btn-blue" type="button" id="spotifySchedAllBtn">ALL</button>
                </div>
            </div>
        </div>`,
    );

    setupPlaybackControls();
    setupVolumeControls();
    setupSlots();
    setupScheduleButtons();

    const allBtn = getElement("spotifySchedAllBtn");
    if (allBtn && !allBtn.dataset.bound) {
        allBtn.dataset.bound = 1;
        allBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openSpotifyScheduleModal();
        });
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.warn("Fullscreen request failed:", err);
        });
    } else {
        document.exitFullscreen();
    }
}

async function showDashboard() {
    const blanker = getElement("screenBlanker");
    const clockHeader = getElement("datetimeHeader");
    if (clockHeader && !clockHeader.dataset.bound) {
        clockHeader.dataset.bound = "1";

        let pressTimer = null;
        let longPressFired = false;

        clockHeader.addEventListener("pointerdown", () => {
            longPressFired = false;
            pressTimer = setTimeout(() => {
                longPressFired = true;
                toggleFullscreen();
            }, 600);
        });

        clockHeader.addEventListener("click", () =>
            blanker.classList.add("active"),
        );

        clockHeader.addEventListener("pointerup", () => {
            clearTimeout(pressTimer);
            if (!longPressFired) blanker.classList.add("active");
        });

        clockHeader.addEventListener("pointercancel", () => {
            clearTimeout(pressTimer);
        });

        clockHeader.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    if (blanker && !blanker.dataset.bound) {
        blanker.dataset.bound = "1";
        blanker.addEventListener("click", () => {
            blanker.classList.remove("active");
        });
    }

    hideElement("loginContainer");
    selectElement(".dashboard").style.display = "flex";
    [
        "fullListModal",
        "mealPrepItemModal",
        "choreItemModal",
        "changeLogItemModal",
        "billItemModal",
        "plantItemModal",
        "plantAddModal",
        "plantEventModal",
        "noteAddModal",
    ].forEach((id) => hideElement(id));

    Object.keys(panelState).forEach((key) => {
        panelState[key].editingId = null;
        panelState[key].manualDate = false;
    });

    setupPanelEvents();
    setupFormHandlers();
    startClock();

    await loadSupabaseData();
    ["mealPrep", "chores", "changeLog", "bills", "plants", "notes"].forEach(
        renderPanel,
    );

    setupSpotifyAuth();
    await initSpotify();
    renderSpotify();
    await renderSlots();
    await loadSchedules();
    renderNextSchedule();

    if (isTablet()) {
        await initSpotifyPlayer();
        await fetchNowPlaying();
        startScheduleTicker();
    }

    if (!isRealtimeSetup) {
        isRealtimeSetup = true;
        setTimeout(setupRealtime, 500);
    }
}

async function checkSession() {
    try {
        const { sb } = await getSupabaseContext(false);
        if (!sb) {
            showLogin();
            return;
        }
        const {
            data: { session },
        } = await sb.auth.getSession();
        if (session) {
            isAuthenticated = true;
            showDashboard();
        } else {
            showLogin();
        }
    } catch (err) {
        console.error("checkSession failed: ", err);
        showLogin();
    }
}

async function dashboardLogin(email, password) {
    try {
        const { sb } = await getSupabaseContext(false);
        if (!sb) throw new Error("Supabase not ready");
        const { data, error } = await sb.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        isAuthenticated = true;
        showDashboard();
    } catch (err) {
        console.error("dashboardLogin: ", err);
        alert(`Login failed：${err.message}`);
    }
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region INITIALISATION
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
    selectElement(".dashboard").style.display = "none";
    showElement("loginContainer");

    await checkSession();

    const loginForm = getElement("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = getElement("loginEmail").value;
            const password = getElement("loginPassword").value;
            await dashboardLogin(email, password);
        });
    }
});

// ============================================================
// #endregion
// ============================================================
