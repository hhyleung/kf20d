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

const PANEL_TABLES = [
    "fridge_stock",
    "chores",
    "change_log",
    "bills",
    "plants",
    "notes",
];
const MEAL_PREP_CATS = ["Carbs", "Veggies", "Proteins", "Fruits", "Others"];
const FRIDGE_STOCK_CATS = ["Fridge", "Freezer"];

const ICONS = [
    "♫", "☕\uFE0E", "☀", "♪", "☼", "☀", "☁", "☂", "♠", 
    "♥", "♦", "♣", "★", "▷", "◁", "♦", 
    "◈", "❖", "✦", "✧", "✵", "✶", "✷", "✸", "✹", "✺", "☀", "☁", "☂", 
    "☃", "☄", "★", "☆", "☼", "☽", "☾", "⚡", "❄", "❅", "❆", "✺", "☺", 
    "☻", "☹", "♡", "♥", "❤", "❥", "❣", "✉", "✆", "✂", "✁", "✃", "⌂", 
    "⌁", "⌀", "☎", "☏", "✆", "✏", "✐", "✑", "✒", "✓", "✔", "✗", "✘", 
    "⚑", "⚐", "⚙", "⚒", "⚓", "⚔", "⚖", "⚗", "♻", "♾", "♨",
];
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region STATES
// ============================================================
// SUPABASE
let supabaseClient = null;
let isAuthenticated = false;
let isRealtimeSetup = false;
let subscriptions = [];

const panelData = {
    fridgeStock: [],
    chores: [],
    changeLog: [],
    bills: [],
    plants: [],
    plantHistory: [],
    notes: [],
};
const panelState = {
    fridge_stock: { editingId: null, manualDate: false },
    chores: { editingId: null, manualDate: false },
    change_log: { editingId: null, manualDate: false },
    bills: { editingId: null, manualDate: false },
};
let listMetadata = Object.fromEntries(PANEL_TABLES.map((k) => [k, null]));
let activePanel = null;

let clockInterval = null;
let scheduleTickInterval = null;

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
    meal_prep: {
        contentId: "mealPrepContent",
        buildFn: () => buildMealPrepHTML(false),
        fullBuildFn: () => buildMealPrepHTML(true),
        after: () => renderPanel("fridge_stock"),
        addAction: () => openDetailModal("fridge_stock"),
    },

    fridge_stock: {
        key: "fridge_stock",
        renderKey: "meal_prep",
        stateKey: "fridge_stock",

        data: {
            table: "fridge_stock",
            store: (d) => {
                panelData.fridgeStock = d;
            },
            orderCol: "item_name",
            extraOrder: {
                col: "last_updated",
                ascending: false,
                nullsLast: true,
            },
            label: "fridgeStock",
        },

        render: {
            contentId: "fridgeStockContent",
            buildFn: () => buildFridgeStockHTML(false),
            fullBuildFn: () => buildFridgeStockHTML(true),
        },

        rowOpen: {
            enabled: true,
            open: (id) => openDetailModal("fridge_stock", id),
        },

        addAction: () => openDetailModal("fridge_stock"),

        detailModal: {
            modalId: "mealPrepDetailModal",
            titleId: "mealPrepDetailTitle",
            editIdInput: "mealPrepEditId",
            deleteBtnId: "mealPrepDeleteBtn",
            addTitle: "ADD MEAL PREP ITEM",
            editTitle: "EDIT MEAL PREP ITEM",

            resetFields: () => {
                setElementValue("mealPrepItemName", "");
                setElementValue("mealPrepCategory", "Carbs");
                setElementValue("mealPrepPortions", "1");
                setElementValue("mealPrepShelfLife", "");
                setElementValue("mealPrepCreatedAt", getTodayHKT());
                setElementValue("mealPrepExpiryDate", "");
                setElementText("mealPrepLastUpdated", "");
            },

            findItem: (id) => panelData.fridgeStock.find((i) => i.id === id),

            populateFields: (item) => {
                setElementValue("mealPrepItemName", item.item_name);
                setElementValue("mealPrepCategory", item.category || "Carbs");
                setElementValue("mealPrepPortions", item.portions || 0);
                setElementValue(
                    "mealPrepShelfLife",
                    item.shelf_life_days || "",
                );
                setElementValue(
                    "mealPrepCreatedAt",
                    formatDateInput(item.created_at),
                );
                setElementValue(
                    "mealPrepExpiryDate",
                    formatDateInput(item.expiry_date),
                );
                setElementText(
                    "mealPrepLastUpdated",
                    item.last_updated ? formatShortDate(item.last_updated) : "",
                );
            },

            getExpectedAutoDate: (item) =>
                item.created_at && item.shelf_life_days
                    ? addDays(item.created_at, item.shelf_life_days)
                    : null,

            getActualAutoDate: (item) => item.expiry_date || null,
        },

        autoDate: {
            fromId: "mealPrepCreatedAt",
            intervalId: "mealPrepShelfLife",
            resultId: "mealPrepExpiryDate",
            autoLabelId: "expiryAutoLabel",
            unit: "days",
            manualFlag: () => panelState.fridge_stock.manualDate,
            setManual: (v) => (panelState.fridge_stock.manualDate = v),
            clearResult: () => setElementValue("mealPrepExpiryDate", ""),
        },

        form: {
            formId: "mealPrepForm",
            buildRecord: (isUpdate) => {
                const shelfLifeDays =
                    parseInt(getElement("mealPrepShelfLife").value, 10) || null;
                const createdAt = getElement("mealPrepCreatedAt").value || null;
                const expiryDate = panelState.fridge_stock.manualDate
                    ? getElement("mealPrepExpiryDate").value || null
                    : createdAt && shelfLifeDays
                      ? addDays(createdAt, shelfLifeDays)
                      : null;

                return {
                    id: isUpdate ? panelState.fridge_stock.editingId : null,
                    item_name: getElement("mealPrepItemName").value.trim(),
                    category: getElement("mealPrepCategory").value,
                    portions:
                        parseInt(getElement("mealPrepPortions").value, 10) || 0,
                    shelf_life_days: shelfLifeDays,
                    created_at: createdAt,
                    expiry_date: expiryDate,
                    last_updated: getTodayHKT(),
                };
            },
        },

        deleteConfig: {
            confirmMsg: "Delete this fridge item permanently?",
        },
    },

    chores: {
        key: "chores",
        stateKey: "chores",

        data: {
            table: "chores",
            store: (d) => {
                panelData.chores = d;
            },
            orderCol: "task_name",
            label: "chores",
        },

        render: {
            contentId: "choresContent",
            buildFn: buildChoresHTML,
            fullBuildFn: buildChoresHTML,
        },

        rowOpen: {
            enabled: true,
            open: (id) => openDetailModal("chores", id),
        },

        addAction: () => openDetailModal("chores"),

        detailModal: {
            modalId: "choreDetailModal",
            titleId: "choreDetailTitle",
            editIdInput: "choreEditId",
            deleteBtnId: "choreDeleteBtn",
            addTitle: "ADD CHORE",
            editTitle: "EDIT CHORE",

            resetFields: () => {
                setElementValue("choreTaskName", "");
                setElementValue("choreLastDoneDate", "");
                setElementValue("choreIntervalDays", "7");
                setElementValue("choreNextDueDate", "");
            },

            findItem: (id) => panelData.chores.find((c) => c.id === id),

            populateFields: (item) => {
                setElementValue("choreTaskName", item.task_name);
                setElementValue(
                    "choreLastDoneDate",
                    formatDateInput(item.last_done_date),
                );
                setElementValue("choreIntervalDays", item.interval_days || "7");
                setElementValue(
                    "choreNextDueDate",
                    formatDateInput(item.next_due_date),
                );
            },

            getExpectedAutoDate: (item) =>
                item.last_done_date && item.interval_days
                    ? addDays(item.last_done_date, item.interval_days)
                    : null,

            getActualAutoDate: (item) => item.next_due_date || null,
        },

        autoDate: {
            fromId: "choreLastDoneDate",
            intervalId: "choreIntervalDays",
            resultId: "choreNextDueDate",
            autoLabelId: "nextDueAutoLabel",
            unit: "days",
            manualFlag: () => panelState.chores.manualDate,
            setManual: (v) => (panelState.chores.manualDate = v),
            clearResult: () => setElementValue("choreNextDueDate", ""),
        },

        form: {
            formId: "choreForm",
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
                    interval_days: intervalDays,
                    next_due_date: nextDueDate,
                };
            },
        },

        deleteConfig: {
            confirmMsg: "Delete this chore?",
        },
    },

    change_log: {
        key: "change_log",
        stateKey: "change_log",

        data: {
            table: "change_log",
            store: (d) => {
                panelData.changeLog = d;
            },
            orderCol: "item_name",
            label: "changeLog",
        },

        render: {
            contentId: "changeLogContent",
            buildFn: "",
            fullBuildFn: buildChangeLogHTML,
        },

        rowOpen: {
            enabled: true,
            open: (id) => openDetailModal("change_log", id),
        },

        addAction: () => openDetailModal("change_log"),

        detailModal: {
            modalId: "changeLogDetailModal",
            titleId: "changeLogDetailTitle",
            editIdInput: "changeLogEditId",
            deleteBtnId: "changeLogDeleteBtn",
            addTitle: "ADD CHANGE LOG",
            editTitle: "EDIT CHANGE LOG",

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
                    item.interval_months || "6",
                );
                setElementValue(
                    "changeLogNextChangeDate",
                    formatDateInput(item.next_change_due),
                );
            },

            getExpectedAutoDate: (item) =>
                item.last_changed_date && item.interval_months
                    ? addMonths(item.last_changed_date, item.interval_months)
                    : null,

            getActualAutoDate: (item) => item.next_change_due || null,
        },

        autoDate: {
            fromId: "changeLogLastChanged",
            intervalId: "changeLogIntervalMonths",
            resultId: "changeLogNextChangeDate",
            autoLabelId: "nextChangeAutoLabel",
            unit: "months",
            manualFlag: () => panelState.change_log.manualDate,
            setManual: (v) => (panelState.change_log.manualDate = v),
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
                const nextChangeDue = panelState.change_log.manualDate
                    ? getElement("changeLogNextChangeDate").value || null
                    : lastChangedDate && intervalMonths
                      ? addMonths(lastChangedDate, intervalMonths)
                      : null;

                return {
                    id: isUpdate ? panelState.change_log.editingId : null,
                    item_name: getElement("changeLogItemName").value.trim(),
                    last_changed_date: lastChangedDate,
                    interval_months: intervalMonths,
                    next_change_due: nextChangeDue,
                };
            },
        },

        deleteConfig: {
            confirmMsg: "Delete this change item?",
        },
    },

    bills: {
        key: "bills",
        stateKey: "bills",

        data: {
            table: "bills",
            store: (d) => {
                panelData.bills = d;
            },
            orderCol: "bill_name",
            label: "bills",
        },

        render: {
            contentId: "billsContent",
            buildFn: "",
            fullBuildFn: buildBillsHTML,
        },

        rowOpen: {
            enabled: true,
            open: (id) => openDetailModal("bills", id),
        },

        addAction: () => openDetailModal("bills"),

        detailModal: {
            modalId: "billDetailModal",
            titleId: "billDetailTitle",
            editIdInput: "billEditId",
            deleteBtnId: "billDeleteBtn",
            addTitle: "ADD BILL",
            editTitle: "EDIT BILL",

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
                    item.interval_months || "1",
                );
                setElementValue(
                    "billNextBillDate",
                    formatDateInput(item.next_bill_date),
                );
            },

            getExpectedAutoDate: (item) =>
                item.last_bill_date && item.interval_months
                    ? addMonths(item.last_bill_date, item.interval_months)
                    : null,

            getActualAutoDate: (item) => item.next_bill_date || null,
        },

        autoDate: {
            fromId: "billLastBillDate",
            intervalId: "billIntervalMonths",
            resultId: "billNextBillDate",
            autoLabelId: "nextBillAutoLabel",
            unit: "months",
            manualFlag: () => panelState.bills.manualDate,
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
                    interval_months: intervalMonths,
                    next_bill_date: nextBillDate,
                };
            },
        },

        deleteConfig: {
            confirmMsg: "Delete this bill?",
        },
    },

    plants: {
        key: "plants",

        data: {
            table: "plants",
            store: (d) => {
                panelData.plants = d;
            },
            orderCol: "plant_name",
            label: "plants",
        },

        render: {
            contentId: "plantsContent",
            buildFn: () => buildPlantsHTML(false),
            fullBuildFn: () => buildPlantsHTML(true),
        },

        rowOpen: {
            enabled: true,
            open: (id) => openPlantDetail(id),
        },

        addAction: () => openPlantAddModal(),
    },

    notes: {
        key: "notes",

        data: {
            table: "notes",
            store: (d) => {
                panelData.notes = d;
            },
            orderCol: "created_at",
            label: "notes",
        },

        render: {
            contentId: "notesContent",
            buildFn: buildNotesHTML,
            fullBuildFn: buildNotesHTML,
        },

        addAction: () => openModal("noteAddModal"),
    },

    plant_history: {
        key: "plant_history",

        data: {
            table: "plant_history",
            store: (d) => {
                panelData.plantHistory = d;
            },
            orderCol: "event_date",
            orderAscending: false,
            orderNulls: { nullsLast: true },
            noUserFilter: true,
            label: "plantHistory",
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
                        .from("list_metadata")
                        .select("list_name, last_updated")
                        .eq("user_id", user.id);
                    if (error) throw error;
                    data.forEach((row) => {
                        listMetadata[row.list_name] = row.last_updated;
                    });
                } catch (err) {
                    console.error("Load list_metadata error: ", err);
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
                    "meal_prep",
                    "chores",
                    "change_log",
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

async function updateListMetadata(listName) {
    const timestamp = new Date().toISOString();
    listMetadata[listName] = timestamp;
    refreshListMetadata();
    try {
        const { sb, user } = await getSupabaseContext();
        await sb.from("list_metadata").upsert(
            {
                list_name: listName,
                last_updated: timestamp,
                user_id: user.id,
            },
            { onConflict: "user_id,list_name" },
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
        updateListMetadata(table);
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
        updateListMetadata(table);
    });
}

async function deletePlant(plantId) {
    if (!confirm("Delete this plant and all its history permanently?")) return;
    await runMutation("Delete plant", async (sb, userId) => {
        const { error: e1 } = await sb
            .from("plant_history")
            .delete()
            .eq("plant_id", plantId);
        const { error: e2 } = await sb
            .from("plants")
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
        const { error } = await sb.from("plant_history").insert(historyItem);
        if (error) throw error;
        const plantCfg = PANEL_CONFIGS.plants.data;
        const historyCfg = PANEL_CONFIGS.plant_history.data;
        await loadSupabaseData([plantCfg, historyCfg]);
        updateListMetadata("plants");
    });
}

async function deletePlantHistory(id, plantId) {
    if (!confirm("Delete this history entry?")) return;
    await runMutation("Delete plant history", async (sb) => {
        const { error } = await sb.from("plant_history").delete().eq("id", id);
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
    const expiryClass = getUrgencyClass(item.expiry_date, 7);
    const portionClass =
        item.portions === 0 && showZero ? "portion-zero" : "portion-number";
    const portionsDisplay = `<span class="${portionClass}">${item.portions}</span>`;
    const zeroClass = item.portions === 0 ? " zero-portions" : "";
    return `<li class="item-row${zeroClass}" data-open-type="fridge_stock" data-id="${item.id}">
                <span class="item-key ${expiryClass}">${item.item_name}</span>
                <span class="item-value">
                    <button class="action-btn" data-action="meal-prep-portions" data-id="${item.id}" data-delta="1">+</button>
                    ${portionsDisplay}
                    <button class="action-btn" data-action="meal-prep-portions" data-id="${item.id}" data-delta="-1">-</button>
                </span>
            </li>`;
}

function buildMealPrepHTML(showZero) {
    const items = panelData.fridgeStock.filter(
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
    const forceFullWidth = ["Proteins"];
    const alwaysHalfWidth = ["Carbs", "Veggies", "Fruits", "Others"];
    let html = '<div class="meal-prep-inner-grid">';
    MEAL_PREP_CATS.forEach((cat) => {
        const catItems = grouped[cat];
        const isAlwaysHalf = alwaysHalfWidth.includes(cat);
        const isForceFull = forceFullWidth.includes(cat);
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
    const items = panelData.fridgeStock
        .filter(
            (i) =>
                (showZero || i.portions > 0) &&
                FRIDGE_STOCK_CATS.includes(i.category),
        )
        .sort((a, b) => a.item_name.localeCompare(b.item_name));
    if (!items.length) return "";
    let html = '<ul class="item-list">';
    items.forEach((item) => {
        html += fridgeItemRow(item, showZero);
    });
    html += "</ul>";
    return html;
}

function buildChoresHTML() {
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
                        <button class="action-btn" data-action="done" data-id="${chore.id}">✓</button>
                    </span>
                </li>`;
    });
    html += "</ul>";
    return html;
}

function buildChangeLogHTML() {
    let html = '<ul class="item-list">';
    panelData.changeLog.forEach((cl) => {
        const dueClass = getUrgencyClass(cl.next_change_due);
        const lastChangedText = cl.last_changed_date
            ? formatShortDate(cl.last_changed_date)
            : "Never";
        html += `<li class="item-row" data-open-type="change_log" data-id="${cl.id}">
                    <span class="item-key ${dueClass}">${cl.item_name}</span>
                    <span class="item-value">
                        <span class="item-meta">${lastChangedText}</span>
                        <button class="action-btn" data-action="changed" data-id="${cl.id}">✓</button>
                    </span>
                </li>`;
    });
    html += "</ul>";
    return html;
}

function buildBillsHTML() {
    let html = '<ul class="item-list">';
    panelData.bills.forEach((bill) => {
        const dueClass = getUrgencyClass(bill.next_bill_date);
        const nextDueText = bill.next_bill_date
            ? formatShortDate(bill.next_bill_date)
            : "";
        html += `<li class="item-row" data-open-type="bills" data-id="${bill.id}">
                    <span class="item-key ${dueClass}">${bill.bill_name}</span>
                    <span class="item-value">
                        <span class="item-meta">${nextDueText}</span>
                        <button class="action-btn" data-action="paid" data-id="${bill.id}">✓</button>
                    </span>
                </li>`;
    });
    html += "</ul>";
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
                        <button class="action-btn" data-action="plant-log" data-id="${p.id}">+</button>
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
                    <span class="item-key">${note.content}</span>
                    <span class="item-value">
                        <span class="item-meta">&nbsp;</span>
                        <button class="action-btn" data-action="note-delete" data-id="${note.id}" title="Delete note">&times;</button>
                    </span>
                </li>`;
    });
    html += "</ul>";
    return html;
}

function renderPanel(section) {
    const cfg = PANEL_CONFIGS[section];
    if (!cfg) return;
    const renderCfg = cfg.render ?? cfg;
    if (!renderCfg.contentId || !renderCfg.buildFn) return;
    setElementHTML(renderCfg.contentId, renderCfg.buildFn());
    if (activePanel === section && renderCfg.fullBuildFn) {
        setElementHTML("fullListContent", renderCfg.fullBuildFn());
    }
    if (cfg.after) cfg.after();
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
    if (!cfg?.rowOpen?.open) return;
    cfg.rowOpen.open(id);
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
        formatMetaTimestamp(listMetadata[activePanel]),
    );
}

function openDetailModal(panelKey, itemId = null) {
    const panelCfg = PANEL_CONFIGS[panelKey];
    const cfg = panelCfg?.detailModal;
    if (!cfg) return;

    const isEditing = !!itemId;
    const stateKey = panelCfg.stateKey;
    const deleteBtn = cfg.deleteBtnId ? getElement(cfg.deleteBtnId) : null;

    if (stateKey && panelState[stateKey]) {
        panelState[stateKey].editingId = itemId;
    }

    if (cfg.editIdInput) setElementValue(cfg.editIdInput, itemId || "");

    if (cfg.titleId) {
        setElementValue(cfg.titleId, isEditing ? cfg.editTitle : cfg.addTitle);
    }

    if (cfg.resetFields) cfg.resetFields();

    if (isEditing) {
        const item = cfg.findItem ? cfg.findItem(itemId) : null;
        if (!item) return;

        if (cfg.populateFields) cfg.populateFields(item);

        if (stateKey && panelState[stateKey]) {
            const actualDate = cfg.getActualAutoDate
                ? cfg.getActualAutoDate(item)
                : null;
            const expectedDate = cfg.getExpectedAutoDate
                ? cfg.getExpectedAutoDate(item)
                : null;
            panelState[stateKey].manualDate = !!(
                actualDate && actualDate !== expectedDate
            );
        }
    } else if (stateKey && panelState[stateKey]) {
        panelState[stateKey].manualDate = false;
    }

    if (deleteBtn) deleteBtn.hidden = !isEditing;

    if (panelCfg.autoDate) refreshAutoDate(panelCfg.autoDate);

    openModal(cfg.modalId);
}

function openPlantAddModal() {
    setElementValue("addPlantName", "");
    setElementValue("addPlantStartingDate", getTodayHKT());
    setElementValue("addPlantPotSize", "");
    openModal("plantAddModal");
}

function openPlantDetail(plantId) {
    const plant = plants.find((p) => p.id === plantId);
    if (!plant) return;
    setElementText("plantDetailTitle", plant.plant_name.toUpperCase());
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
    const history = plantHistory
        .filter((h) => h.plant_id === plantId)
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
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
                                <td>${formatShortDate(h.event_date)}</td>
                                <td>${h.pot_size ? `${h.pot_size}cm` : ""}</td>
                                <td class="${h.watered ? "check-yes" : "check-no"}">${h.watered ? "✓" : ""}</td>
                                <td class="${h.fertilised ? "check-yes" : "check-no"}">${h.fertilised ? "✓" : ""}</td>
                                <td>${h.fertiliser_used || ""}</td>
                                <td>${h.notes || ""}</td>
                                <td>
                                <button class="action-btn" data-action="plant-history-delete" 
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
    openModal("plantDetailModal");
}

function openPlantEventModal(plantId) {
    const plant = plants.find((p) => p.id === plantId);
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
    document.querySelectorAll(".panel-header").forEach((header) => {
        header.addEventListener("click", (e) => {
            const panel = e.target.closest(".panel");
            const section = panel.dataset.section;
            const h3 = header.querySelector("h3");
            if (!section || !h3 || section === "spotify") return;
            setElementText("listTitle", h3.textContent.toUpperCase());
            activePanel = section;
            setElementHTML(
                "fullListContent",
                PANEL_CONFIGS[section].render?.fullBuildFn?.() ?? "",
            );
            refreshListMetadata();
            openModal("fullListModal");
        });
    });

    document.querySelectorAll(".panel .add-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const section = btn.closest(".panel")?.dataset.section;
            const cfg = PANEL_CONFIGS[section];
            if (cfg?.addAction) cfg.addAction();
        });
    });

    getElement("fullListAddBtn")?.addEventListener("click", () => {
        const cfg = PANEL_CONFIGS[activePanel];
        if (cfg?.addAction) cfg.addAction();
    });
}

function setupAutoDateListeners(cfg) {
    const fromEl = getElement(cfg.fromId);
    const intervalEl = getElement(cfg.intervalId);
    const resultEl = getElement(cfg.resultId);
    if (!fromEl || !intervalEl || !resultEl) return;

    const onSourceChange = () => {
        if (!cfg.manualFlag()) {
            refreshAutoDate(cfg);
        }
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
        .filter((cfg) => cfg.autoDate)
        .forEach((cfg) => setupAutoDateListeners(cfg.autoDate));

    Object.values(PANEL_CONFIGS)
        .filter((cfg) => cfg.form && cfg.detailModal)
        .forEach((panelCfg) => {
            const formCfg = panelCfg.form;
            const modalCfg = panelCfg.detailModal;
            const stateKey = panelCfg.stateKey;
            const renderKey = panelCfg.renderKey ?? panelCfg.key;

            const formEl = getElement(formCfg.formId);
            if (!formEl) return;

            formEl.addEventListener("submit", async (e) => {
                e.preventDefault();
                const isUpdate = !!(
                    stateKey && panelState[stateKey]?.editingId
                );
                const record = formCfg.buildRecord(isUpdate);

                await saveRecord(
                    panelCfg.data.table,
                    renderKey,
                    record,
                    isUpdate,
                    () => {
                        if (stateKey && panelState[stateKey]) {
                            panelState[stateKey].manualDate = false;
                        }
                    },
                );

                closeModal(modalCfg.modalId);

                if (stateKey && panelState[stateKey]) {
                    panelState[stateKey].editingId = null;
                    panelState[stateKey].manualDate = false;
                }
            });
        });

    Object.values(PANEL_CONFIGS)
        .filter((cfg) => cfg.detailModal?.deleteBtnId && cfg.deleteConfig)
        .forEach((panelCfg) => {
            const modalCfg = panelCfg.detailModal;
            const delCfg = panelCfg.deleteConfig;
            const stateKey = panelCfg.stateKey;
            const panelKey = panelCfg.key;

            const btn = getElement(modalCfg.deleteBtnId);
            if (!btn) return;

            btn.addEventListener("click", async () => {
                if (!confirm(delCfg.confirmMsg)) return;

                const itemId = stateKey
                    ? panelState[stateKey]?.editingId
                    : null;
                if (!itemId) return;

                await deleteRecord(
                    panelCfg.data.table,
                    renderKey,
                    itemId,
                    delCfg.confirmMsg,
                );

                closeModal(modalCfg.modalId);

                if (stateKey && panelState[stateKey]) {
                    panelState[stateKey].editingId = null;
                    panelState[stateKey].manualDate = false;
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
                document.getElement("addPlantStartingDate").value || null;
            const potSize =
                parseInt(getElement("addPlantPotSize").value, 10) || null;
            if (!name) return;

            await saveRecord(
                "plants",
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

            const plant = plants.find((p) => p.id === plantId);
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

            await saveRecord("plants", "plants", plantUpdates, true);

            await savePlantHistory({
                plant_id: plantId,
                event_date: eventDate,
                watered,
                fertilised,
                fertiliser_used: fertiliserUsed,
                pot_size: potSize,
                notes,
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
            const content = getElement("addNoteContent").value.trim();
            if (!content) return;

            await saveRecord(
                "notes",
                "notes",
                { content, created_at: getTodayHKT() },
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
        const item = panelData.fridgeStock.find((i) => i.id === id);
        if (!item) return;
        const newPortions = Math.max(0, (item.portions || 0) + delta);
        await saveRecord(
            "fridge_stock",
            "meal_prep",
            {
                id,
                portions: newPortions,
                last_updated: getTodayHKT(),
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
            "chores",
            "chores",
            {
                id,
                task_name: chore.task_name,
                last_done_date: today,
                interval_days: chore.interval_days,
                next_due_date: chore.interval_days
                    ? addDays(today, chore.interval_days)
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
            "change_log",
            "change_log",
            {
                id,
                item_name: cl.item_name,
                last_changed_date: today,
                interval_months: cl.interval_months,
                next_change_due: cl.interval_months
                    ? addMonths(today, cl.interval_months)
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
        const today = getTodayHKT();
        await saveRecord(
            "bills",
            "bills",
            {
                id,
                bill_name: bill.bill_name,
                last_bill_date: today,
                interval_months: bill.interval_months,
                next_bill_date: bill.interval_months
                    ? addMonths(today, bill.interval_months)
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
            "plants",
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
            "plants",
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
        closeModal("plantDetailModal");
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
        await deleteRecord("notes", "notes", id, "Delete this note?");
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
            if (panelCfg?.rowOpen?.open) {
                panelCfg.rowOpen.open(id);
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
    const header = panel.querySelector(".panel-header");
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
    const tokenRow = await loadSpotifyToken();
    if (!tokenRow) return null;
    const expiresAt = new Date(tokenRow.expires_at).getTime();
    const needsRefresh = Date.now() > expiresAt - fiveMinutes;
    if (!needsRefresh) {
        spotifyToken = tokenRow.access_token;
        spotifyTokenExpiry = expiresAt;
        return tokenRow.access_token;
    }
    try {
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
    console.log(ua);
    const isFirefox = /Firefox\/\d+/i.test(ua);
    const isWindows81 = /Windows NT 6\.3/i.test(ua);
    console.log(isFirefox);
    console.log(isWindows81);
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
async function fetchPlaylists() {
    const token = await getValidSpotifyToken();
    if (!token) return [];
    let url = "https://api.spotify.com/v1/me/playlists?limit=50";
    const all = [];
    while (url) {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) break;
        const data = await res.json();
        all.push(...(data.items || []));
        url = data.next;
    }
    spotifyPlaylists = all;
    return all;
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

    spotifyPlayer.addListener("player_state_changed", updateNowPlaying);

    await spotifyPlayer.connect();
}

async function makeActiveDevice(deviceId) {
    const token = await getValidSpotifyToken();
    if (!token || !deviceId) return;
    try {
        await fetch("https://api.spotify.com/v1/me/player", {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ device_ids: [deviceId], play: false }),
        });
    } catch (err) {
        console.error("makeActiveDevice failed: ", err);
    }
}

async function playSpotifyPlaylist(playlistId) {
    if (!spotifyDeviceId) return;
    const token = await getValidSpotifyToken();
    if (!token) return;
    try {
        await makeActiveDevice(spotifyDeviceId);
        await new Promise((resolve) => setTimeout(resolve, 250));
        const playRes = await fetch(
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
        if (!playRes.ok) {
            console.error("Play failed", playRes.status, await playRes.text());
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
        await fetch(
            `https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=${encodeURIComponent(spotifyDeviceId)}`,
            {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}` },
            },
        );
    } catch (err) {
        console.error("playSpotifyPlaylist failed: ", err);
    }
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY SCHEDULER
// ============================================================
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
    const { sb } = await getSupabaseContext(false);
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
    if (lastPlaylistId) await playSpotifyPlaylist(lastPlaylistId);
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
// #region SPOTIFY UI
// ============================================================
function updateNowPlaying(state) {
    const artEl = document.getElementById("spotifyArt");
    const titleEl = document.getElementById("spotifyTitle");
    const artistEl = document.getElementById("spotifyArtist");
    const playBtn = document.getElementById("spotifyPlayBtn");

    if (!state || !state.track_window?.current_track) {
        if (artEl) {
            artEl.style.backgroundImage = "";
            artEl.style.backgroundSize = "";
            artEl.style.backgroundPosition = "";
            const placeholder = artEl.querySelector(".spotify-art-placeholder");
            if (placeholder) placeholder.style.display = "flex";
        }
        if (titleEl) titleEl.textContent = "—";
        if (artistEl) artistEl.textContent = "—";
        if (playBtn) playBtn.textContent = "▶";
        return;
    }

    const track = state.track_window.current_track;

    if (artEl) {
        const img = track.album?.images?.[0]?.url;
        artEl.style.backgroundImage = img ? `url(${img})` : "";
        artEl.style.backgroundSize = "cover";
        artEl.style.backgroundPosition = "center";
        const placeholder = artEl.querySelector(".spotify-art-placeholder");
        if (placeholder) placeholder.style.display = img ? "none" : "flex";
    }

    if (titleEl) titleEl.textContent = track.name;
    if (artistEl)
        artistEl.textContent = track.artists.map((a) => a.name).join(", ");
    if (playBtn) playBtn.textContent = state.paused ? "▶" : "❚❚■";
}

async function openSpotifyAddSchedule(dateStr) {
    spotifySelectedScheduleId = null;
    document.getElementById("spotifyScheduleFormTitle").textContent =
        "ADD SCHEDULE";
    document.getElementById("ssfDate").value = dateStr || getTodayHKT();
    document.getElementById("ssfTime").value = "";
    document.getElementById("ssfPlaylist").value = "";
    document.getElementById("ssfDeleteBtn").style.display = "none";
    await populatePlaylistDropdown("ssfPlaylist");
    openModal("spotifyScheduleFormModal");
}

async function openSpotifyEditSchedule(scheduleId) {
    const item = schedules.find((s) => s.id === scheduleId);
    if (!item) return;
    spotifySelectedScheduleId = scheduleId;
    document.getElementById("spotifyScheduleFormTitle").textContent =
        "EDIT SCHEDULE";
    document.getElementById("ssfDate").value = item.scheduled_date || "";
    document.getElementById("ssfTime").value =
        item.scheduled_time?.slice(0, 5) || "";
    document.getElementById("ssfDeleteBtn").style.display = "block";
    await populatePlaylistDropdown("ssfPlaylist", item.playlist_id);
    openModal("spotifyScheduleFormModal");
}

async function refreshSpotifyPlaylistSlots() {
    const rows = await loadPlaylists();
    playlistSlots = rows;

    document.querySelectorAll(".spotify-slot-btn").forEach((btn) => {
        const slot = Number(btn.dataset.slot);
        const row = rows.find((r) => r.slot_number === slot);
        const icon = ensureTextIcon(row?.playlist_icon);
        btn.textContent = icon;
        btn.dataset.playlistId = row?.playlist_id || "";
        btn.dataset.playlistName = row?.playlist_name || "";
    });

    document.querySelectorAll(".spotify-slot-pick-btn").forEach((btn) => {
        const slot = Number(btn.dataset.slot);
        const row = rows.find((r) => r.slot_number === slot);
        const icon = ensureTextIcon(row?.playlist_icon);
        btn.textContent = icon;
        btn.classList.toggle("has-playlist", !!row?.playlist_id);
    });
}

async function openSpotifyPlaylistModal() {
    openModal("spotifyPlaylistModal");

    const [playlists, slots] = await Promise.all([
        fetchPlaylists(),
        loadPlaylists(),
    ]);

    playlistSlots = slots;

    const slotPicker = document.getElementById("spotifySlotPicker");
    slotPicker.querySelectorAll(".spotify-slot-pick-btn").forEach((btn) => {
        const slot = Number(btn.dataset.slot);
        const row = slots.find((r) => r.slot_number === slot);
        btn.textContent = ensureTextIcon(row?.playlist_icon);
        btn.classList.toggle("has-playlist", !!row?.playlist_id);
        btn.classList.remove("active");
    });

    const select = document.getElementById("spotifySlotPlaylistSelect");
    select.innerHTML =
        '<option value="">— select —</option>' +
        playlists
            .map((pl) => `<option value="${pl.id}">${pl.name}</option>`)
            .join("");

    const iconPicker = document.getElementById("spotifyIconPicker");
    iconPicker.innerHTML = ICONS.map(
        (icon) =>
            `<button type="button" class="spotify-icon-option" data-icon="${icon}">${icon}</button>`,
    ).join("");

    iconPicker.querySelectorAll(".spotify-icon-option").forEach((el) => {
        el.addEventListener("click", () => {
            iconPicker
                .querySelectorAll(".spotify-icon-option")
                .forEach((x) => x.classList.remove("active"));
            el.classList.add("active");
        });
    });

    activeSlot = null;
    document.getElementById("spotifySlotEditor").style.display = "none";
    document.getElementById("spotifySlotEditorPrompt").style.display = "block";

    document.querySelectorAll(".spotify-slot-pick-btn").forEach((btn) => {
        btn.onclick = () => selectSlotForEdit(Number(btn.dataset.slot));
    });

    document.getElementById("spotifySlotSaveBtn").onclick = saveSlotFromModal;
}

function renderSpotify() {
    const content = document.getElementById("spotifyContent");
    if (!content) return;

    content.innerHTML = `
    <div class="spotify-panel">
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
          <button class="spotify-schedule-action add"  type="button" id="spotifySchedAddBtn">Add</button>
          <button class="spotify-schedule-action edit" type="button" id="spotifySchedEditBtn">Edit</button>
          <button class="spotify-schedule-action skip" type="button" id="spotifySchedSkipBtn">Skip</button>
          <button class="spotify-schedule-action all" type="button" id="spotifySchedAllBtn">ALL</button>
        </div>
      </div>
    </div>
  `;

    bindPlaybackControls();
    setupVolumeControls();
    bindSpotifyPlaylistUI();
    refreshSpotifyPlaylistSlots();
    bindSpotifySchedButtons();

    const allBtn = document.getElementById("spotifySchedAllBtn");
    if (allBtn && !allBtn.dataset.bound) {
        allBtn.dataset.bound = "1";
        allBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openSpotifyScheduleModal();
        });
    }
}

function renderNextSchedule() {
    const now = new Date();
    const todayStr = getTodayHKT();
    const currentTime = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Hong_Kong",
    });

    const next = schedules.find((s) => {
        if (s.triggered) return false;
        if (s.scheduled_date > todayStr) return true;
        if (
            s.scheduled_date === todayStr &&
            s.scheduled_time?.slice(0, 5) > currentTime
        )
            return true;
        return false;
    });

    const dateEl = document.getElementById("spotifySchedDate");
    const timeEl = document.getElementById("spotifySchedTime");
    const playlistEl = document.getElementById("spotifySchedPlaylist");

    if (!next) {
        if (dateEl) dateEl.textContent = "—";
        if (timeEl) timeEl.textContent = "";
        if (playlistEl) playlistEl.textContent = "No upcoming schedules";
        return;
    }

    if (dateEl) {
        const d = new Date(next.scheduled_date + "T00:00:00Z");
        dateEl.textContent = d
            .toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                timeZone: "Asia/Hong_Kong",
            })
            .toUpperCase();
    }
    if (timeEl) timeEl.textContent = next.scheduled_time?.slice(0, 5) || "";
    if (playlistEl) playlistEl.textContent = next.playlist_name || "Untitled";
}

async function openSpotifyScheduleModal() {
    openModal("spotifyScheduleModal");
    await loadSchedules();
    renderSpotifyCalendar();
    renderSpotifyDaySchedules(spotifySelectedDate);
    bindSpotifyScheduleModal();
    bindSpotifyTemplateLoader();
}

function renderSpotifyCalendar() {
    const grid = document.getElementById("spotifyCalendarGrid");
    const label = document.getElementById("spotifyCalMonthLabel");
    if (!grid || !label) return;

    const y = spotifyCalendarMonth.getFullYear();
    const m = spotifyCalendarMonth.getMonth();

    const monthName = spotifyCalendarMonth
        .toLocaleDateString("en-GB", {
            month: "short",
            year: "numeric",
        })
        .toUpperCase();
    label.textContent = monthName;

    const firstDay = new Date(y, m, 1);
    const startOffset = firstDay.getDay();
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

        html += `<button type="button" class="spotify-calendar-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-date="${dateStr}">${day}${dotsHtml}</button>`;
    }

    grid.innerHTML = html;

    grid.querySelectorAll(".spotify-calendar-cell[data-date]").forEach(
        (cell) => {
            cell.onclick = () => {
                spotifySelectedDate = cell.dataset.date;
                renderSpotifyCalendar();
                renderSpotifyDaySchedules(spotifySelectedDate);
            };
        },
    );
}

function renderSpotifyDaySchedules(dateStr) {
    const label = document.getElementById("spotifySelectedDateLabel");
    const list = document.getElementById("spotifyDaySchedules");
    if (!label || !list) return;

    label.textContent = dateStr;

    const items = schedules.filter((s) => s.scheduled_date === dateStr);

    if (!items.length) {
        list.innerHTML = `<div class="spotify-day-row">
      <div class="spotify-day-row-meta">No schedules for this day.</div>
    </div>`;
        spotifySelectedScheduleId = null;
        spotifySelectedSchedule = null;
        return;
    }

    list.innerHTML = items
        .map(
            (item) => `
    <div class="spotify-day-row ${spotifySelectedScheduleId === item.id ? "selected" : ""}"
         data-id="${item.id}">
      <div class="spotify-day-row-title">
        ${item.scheduled_time} · ${item.playlist_name || "Untitled"}
      </div>
      <div class="spotify-day-row-meta">
        ${item.schedule_type}
      </div>
    </div>
  `,
        )
        .join("");

    list.querySelectorAll(".spotify-day-row[data-id]").forEach((row) => {
        row.onclick = () => {
            const item = schedules.find((s) => String(s.id) === row.dataset.id);
            if (!item) return;
            spotifySelectedScheduleId = item.id;
            spotifySelectedSchedule = item;
            renderSpotifyDaySchedules(dateStr);
        };
    });
}

async function populatePlaylistDropdown(elementId, selectedId = "") {
    const sel = document.getElementById(elementId);
    if (!sel) return;

    sel.innerHTML = '<option value="">Loading...</option>';

    const playlists = spotifyPlaylists.length
        ? spotifyPlaylists
        : await fetchPlaylists();

    if (!playlists.length) {
        sel.innerHTML = '<option value="">— no playlists found —</option>';
        return;
    }

    sel.innerHTML =
        '<option value="">— select —</option>' +
        playlists
            .map((p) => `<option value="${p.id}">${p.name}</option>`)
            .join("");

    sel.value = selectedId || "";
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY ACTIONS
// ============================================================
function bindSpotifyAuth() {
    const authBtn = document.getElementById("spotifyAuthBtn");
    if (authBtn && !authBtn.dataset.bound) {
        authBtn.dataset.bound = "1";
        authBtn.addEventListener("click", spotifyAuth);
    }

    const panel = document.querySelector('[data-section="spotify"]');
    if (!panel) return;
    const header = panel.querySelector(".panel-header");
    if (!header || header.dataset.spotifyBound) return;
    header.dataset.spotifyBound = "1";

    header.addEventListener("click", (e) => {
        if (header.classList.contains("spotify-header-error")) {
            e.stopPropagation();
            openModal("spotifyAuthModal");
        }
    });
}

function bindPlaybackControls() {
    const prevBtn = document.getElementById("spotifyPrevBtn");
    const playBtn = document.getElementById("spotifyPlayBtn");
    const nextBtn = document.getElementById("spotifyNextBtn");

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
    const volUp = document.getElementById("volUpBtn");
    const volDown = document.getElementById("volDownBtn");
    const volDisplay = document.getElementById("volDisplay");
    if (!volUp || !volDown || !volDisplay || volUp.dataset.bound) return;
    volUp.dataset.bound = "1";

    volUp.addEventListener("click", async (e) => {
        e.stopPropagation();
        spotifyVolume = Math.min(100, spotifyVolume + 5);
        volDisplay.textContent = spotifyVolume;
        if (spotifyPlayer) await spotifyPlayer.setVolume(spotifyVolume / 100);
    });

    volDown.addEventListener("click", async (e) => {
        e.stopPropagation();
        spotifyVolume = Math.max(0, spotifyVolume - 5);
        volDisplay.textContent = spotifyVolume;
        if (spotifyPlayer) await spotifyPlayer.setVolume(spotifyVolume / 100);
    });
}

function ensureTextIcon(icon) {
    return icon || "♫";
}

function selectSlotForEdit(slotNumber) {
    activeSlot = slotNumber;

    document.querySelectorAll(".spotify-slot-pick-btn").forEach((btn) => {
        btn.classList.toggle("active", Number(btn.dataset.slot) === slotNumber);
    });

    document.getElementById("spotifySlotEditor").style.display = "block";
    document.getElementById("spotifySlotEditorPrompt").style.display = "none";
    document.getElementById("spotifySlotEditorLabel").textContent =
        `Editing Slot ${slotNumber}`;

    const existing = playlistSlots.find((r) => r.slot_number === slotNumber);
    const select = document.getElementById("spotifySlotPlaylistSelect");
    select.value = existing?.playlist_id || "";

    const iconPicker = document.getElementById("spotifyIconPicker");
    iconPicker.querySelectorAll(".spotify-icon-option").forEach((el) => {
        el.classList.toggle(
            "active",
            el.dataset.icon === ensureTextIcon(existing?.playlist_icon),
        );
    });
}

async function saveSlotFromModal() {
    if (!activeSlot) return;

    const select = document.getElementById("spotifySlotPlaylistSelect");
    const playlistId = select.value;
    const playlistName = select.options[select.selectedIndex]?.text || "";
    if (!playlistId) return;

    const activeIcon = document.querySelector(".spotify-icon-option.active");
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
        console.error("Save slot failed:", error);
        return;
    }

    await refreshSpotifyPlaylistSlots();
    closeModal("spotifyPlaylistModal");
}

function bindSpotifyPlaylistUI() {
    const label = document.getElementById("spotifyPlaylistsLabel");
    if (label && !label.dataset.bound) {
        label.dataset.bound = "1";
        label.addEventListener("click", (e) => {
            e.stopPropagation();
            openSpotifyPlaylistModal();
        });
    }

    document.querySelectorAll(".spotify-slot-btn").forEach((btn) => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = "1";
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const playlistId = btn.dataset.playlistId;
            if (!playlistId) return;
            await playSpotifyPlaylist(playlistId);
        });
    });
}

function bindSpotifyScheduleForm() {
    const form = document.getElementById("spotifyScheduleForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const isEdit = !!spotifySelectedScheduleId;
        const date = document.getElementById("ssfDate").value;
        const time = document.getElementById("ssfTime").value;
        const playlistSelect = document.getElementById("ssfPlaylist");
        const playlistId = playlistSelect.value;
        const playlistName =
            playlistSelect.options[playlistSelect.selectedIndex]?.text || "";

        if (!date || !time || !playlistId) return;

        const { sb, user } = await getSupabaseContext();
        if (!user) return;

        const record = {
            user_id: user.id,
            schedule_type: "once",
            scheduled_date: date,
            scheduled_time: time,
            playlist_id: playlistId,
            playlist_name: playlistName,
            triggered: false,
        };

        if (isEdit) {
            const { error } = await sb
                .from("spotify_schedules")
                .update({
                    scheduled_date: record.scheduled_date,
                    scheduled_time: record.scheduled_time,
                    playlist_id: record.playlist_id,
                    playlist_name: record.playlist_name,
                })
                .eq("id", spotifySelectedScheduleId);
            if (error) {
                console.error("Update schedule failed", error);
                return;
            }
        } else {
            const { error } = await sb.from("spotify_schedules").insert(record);
            if (error) {
                console.error("Insert schedule failed", error);
                return;
            }
        }

        closeModal("spotifyScheduleFormModal");
        await loadSchedules();
        renderNextSchedule();
        renderSpotifyCalendar();
        renderSpotifyDaySchedules(spotifySelectedDate);
    });

    // Delete button
    const deleteBtn = document.getElementById("ssfDeleteBtn");
    if (deleteBtn && !deleteBtn.dataset.bound) {
        deleteBtn.dataset.bound = "1";
        deleteBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!spotifySelectedScheduleId) return;
            if (!confirm("Delete this schedule?")) return;
            const { sb } = await getSupabaseContext(false);
            const { error } = await sb
                .from("spotify_schedules")
                .delete()
                .eq("id", spotifySelectedScheduleId);
            if (error) {
                console.error("Delete schedule failed", error);
                return;
            }
            closeModal("spotifyScheduleFormModal");
            await loadSchedules();
            renderNextSchedule();
            renderSpotifyCalendar();
            renderSpotifyDaySchedules(spotifySelectedDate);
        });
    }
}

function bindSpotifyScheduleModal() {
    const prevBtn = document.getElementById("spotifyCalPrevBtn");
    const nextBtn = document.getElementById("spotifyCalNextBtn");

    if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.dataset.bound = "1";
        prevBtn.addEventListener("click", () => {
            spotifyCalendarMonth = new Date(
                spotifyCalendarMonth.getFullYear(),
                spotifyCalendarMonth.getMonth() - 1,
                1,
            );
            renderSpotifyCalendar();
        });
    }

    if (nextBtn && !nextBtn.dataset.bound) {
        nextBtn.dataset.bound = "1";
        nextBtn.addEventListener("click", () => {
            spotifyCalendarMonth = new Date(
                spotifyCalendarMonth.getFullYear(),
                spotifyCalendarMonth.getMonth() + 1,
                1,
            );
            renderSpotifyCalendar();
        });
    }

    document.getElementById("spotifyLoadTemplateBtn").onclick = async () => {
        document.getElementById("spotifyTemplateLoader").style.display =
            "block";
        bindSpotifyTemplateLoader();
        await populatePlaylistDropdown("spotifyTemplatePlaylistSelect");
    };

    const addBtn = document.getElementById("spotifyAddScheduleBtn");
    const editBtn = document.getElementById("spotifyEditScheduleBtn");
    const delBtn = document.getElementById("spotifyDeleteScheduleBtn");

    if (addBtn && !addBtn.dataset.bound) {
        addBtn.dataset.bound = "1";
        addBtn.addEventListener("click", () => {
            bindSpotifyScheduleForm();
            openSpotifyAddSchedule();
        });
    }

    if (editBtn && !editBtn.dataset.bound) {
        editBtn.dataset.bound = "1";
        editBtn.addEventListener("click", async () => {
            if (!spotifySelectedSchedule) return;
            bindSpotifyScheduleForm();
            await openSpotifyEditSchedule(spotifySelectedScheduleId);
        });
    }

    if (delBtn && !delBtn.dataset.bound) {
        delBtn.dataset.bound = "1";
        delBtn.addEventListener("click", async () => {
            if (!spotifySelectedScheduleId) return;
            if (!confirm("Delete this schedule?")) return;
            const { sb } = await getSupabaseContext(false);
            const { error } = await sb
                .from("spotify_schedules")
                .delete()
                .eq("id", spotifySelectedScheduleId);
            if (error) {
                console.error(error);
                return;
            }
            spotifySelectedScheduleId = null;
            spotifySelectedSchedule = null;
            await loadSchedules();
            renderSpotifyCalendar();
            renderSpotifyDaySchedules(spotifySelectedDate);
        });
    }
}

function bindSpotifySchedButtons() {
    const skipBtn = document.getElementById("spotifySchedSkipBtn");
    if (skipBtn && !skipBtn.dataset.bound) {
        skipBtn.dataset.bound = "1";
        skipBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const todayStr = getTodayHKT();
            const currentTime = new Date().toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Hong_Kong",
            });
            const next = schedules.find((s) => {
                if (s.triggered) return false;
                if (s.scheduled_date > todayStr) return true;
                if (
                    s.scheduled_date === todayStr &&
                    s.scheduled_time > currentTime
                )
                    return true;
                return false;
            });
            if (!next) return;
            if (!confirm("Skip and delete this schedule?")) return;
            const { sb } = await getSupabaseContext(false);
            const { error } = await sb
                .from("spotify_schedules")
                .delete()
                .eq("id", next.id);
            if (error) {
                console.error("Skip schedule failed", error);
                return;
            }
            await loadSchedules();
            renderNextSchedule();
        });
    }

    const addBtn = document.getElementById("spotifySchedAddBtn");
    if (addBtn && !addBtn.dataset.bound) {
        addBtn.dataset.bound = "1";
        addBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            bindSpotifyScheduleForm();
            openSpotifyAddSchedule();
        });
    }

    const editBtn = document.getElementById("spotifySchedEditBtn");
    if (editBtn && !editBtn.dataset.bound) {
        editBtn.dataset.bound = "1";
        editBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const todayStr = getTodayHKT();
            const currentTime = new Date().toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Hong_Kong",
            });

            const next = schedules.find((s) => {
                if (s.triggered) return false;
                if (s.scheduled_date > todayStr) return true;
                if (
                    s.scheduled_date === todayStr &&
                    s.scheduled_time > currentTime
                )
                    return true;
                return false;
            });

            if (!next) return;
            spotifySelectedSchedule = next;
            spotifySelectedScheduleId = next.id;
            bindSpotifyScheduleForm();
            await openSpotifyEditSchedule(next.id);
        });
    }
}

function bindSpotifyTemplateLoader() {
    const toggleFields = () => {
        const type = document.getElementById("spotifyTemplateType")?.value;
        const weekly = document.getElementById("spotifyWeeklyFields");
        const shift = document.getElementById("spotifyShiftFields");
        if (weekly) weekly.style.display = type === "weekly" ? "block" : "none";
        if (shift) shift.style.display = type === "shift" ? "block" : "none";
    };

    const typeEl = document.getElementById("spotifyTemplateType");
    if (typeEl && !typeEl.dataset.bound) {
        typeEl.dataset.bound = "1";
        typeEl.addEventListener("change", toggleFields);
    }
    toggleFields();

    const cancelBtn = document.getElementById("spotifyTemplateCancelBtn");
    if (cancelBtn && !cancelBtn.dataset.bound) {
        cancelBtn.dataset.bound = "1";
        cancelBtn.addEventListener("click", () => {
            document.getElementById("spotifyTemplateLoader").style.display =
                "none";
        });
    }

    const generateBtn = document.getElementById("spotifyTemplateGenerateBtn");
    if (generateBtn && !generateBtn.dataset.bound) {
        generateBtn.dataset.bound = "1";
        generateBtn.addEventListener("click", generateSpotifyTemplateSchedules);
    }
}

async function generateSpotifyTemplateSchedules() {
    const type = document.getElementById("spotifyTemplateType").value;
    const startDateStr = document.getElementById(
        "spotifyTemplateStartDate",
    ).value;
    const endDateStr = document.getElementById("spotifyTemplateEndDate").value;
    const overrideMode =
        document.querySelector('input[name="spotifyOverride"]:checked')
            ?.value || "add";
    const playlistSelect = document.getElementById(
        "spotifyTemplatePlaylistSelect",
    );
    const playlistId = playlistSelect.value;
    const playlistName =
        playlistSelect.options[playlistSelect.selectedIndex]?.text || "";

    if (!startDateStr || !playlistId) {
        alert("Please set a start date and playlist.");
        return;
    }

    const { sb, user } = await getSupabaseContext();
    if (!user) return;

    // Resolve end date: default to 3 months from start
    let endDate;
    if (endDateStr) {
        endDate = new Date(endDateStr + "T00:00:00Z");
    } else {
        endDate = new Date(startDateStr + "T00:00:00Z");
        endDate.setMonth(endDate.getMonth() + 3);
    }
    const resolvedEndStr = endDate.toISOString().slice(0, 10);

    // Override: delete all untriggered future schedules in range
    if (overrideMode === "replace") {
        const { error: delError } = await sb
            .from("spotify_schedules")
            .delete()
            .eq("user_id", user.id)
            .eq("triggered", false)
            .gte("scheduled_date", startDateStr)
            .lte("scheduled_date", resolvedEndStr);
        if (delError) {
            console.error("Override delete failed", delError);
            return;
        }
    }

    // Generate rows with shared template_ref
    const templateRef = crypto.randomUUID();
    const rows = [];

    if (type === "weekly") {
        const checkedDays = [
            ...document.querySelectorAll(
                '#spotifyWeeklyFields input[type="checkbox"]:checked',
            ),
        ].map((cb) => parseInt(cb.value));
        const time = document.getElementById("spotifyWeeklyTime").value;
        if (!checkedDays.length || !time) {
            alert("Please select at least one weekday and a time.");
            return;
        }
        let cursor = new Date(startDateStr + "T00:00:00Z");
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
            document.getElementById("spotifyShiftDay1Index").value,
        );
        const times = {
            afternoon: document.getElementById("spotifyShiftAfternoonTime")
                .value,
            early: document.getElementById("spotifyShiftEarlyTime").value,
            overnight: document.getElementById("spotifyShiftOvernightTime")
                .value,
            off: document.getElementById("spotifyShiftOffTime").value,
        };
        // Shift pattern: which time each day in the 10-day cycle uses
        const shiftPattern = [
            times.afternoon, // Day 1
            times.afternoon, // Day 2
            times.off, // Day 3
            times.early, // Day 4
            times.early, // Day 5
            times.overnight, // Day 6
            times.overnight, // Day 7
            times.off, // Day 8
            times.off, // Day 9
            times.off, // Day 10
        ];
        // Calculate the cycle offset so today aligns to day1Index
        // day1Index = 1 means today is Day 1, so offset = 0
        // day1Index = 3 means today is Day 3, so cycle started 2 days ago
        const startDate = new Date(startDateStr + "T00:00:00Z");
        const cycleOffset = (day1Index - 1 + 10) % 10;
        let cursor = new Date(startDate);
        // Work out what cycle day the startDate falls on
        // cycleOffset days before startDate = Day 1
        // So startDate is cycle day = cycleOffset (0-indexed)
        let cycleDay = cycleOffset;

        while (cursor <= endDate) {
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
            cycleDay = (cycleDay + 1) % 10;
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }

    if (!rows.length) {
        alert("No schedules generated. Check your settings.");
        return;
    }

    // Insert in batches of 100 to avoid Supabase payload limits
    for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await sb.from("spotify_schedules").insert(batch);
        if (error) {
            console.error("Insert schedules failed", error);
            return;
        }
    }

    await loadSchedules();
    renderNextSchedule();
    renderSpotifyCalendar();
    if (spotifySelectedDate) renderSpotifyDaySchedules(spotifySelectedDate);

    // Hide template loader after success
    document.getElementById("spotifyTemplateLoader").style.display = "none";
    document.getElementById("spotifyLoadTemplateBtn").style.display = "block";
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
}

function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    setTimeout(() => {
        tickClock();
        clockInterval = setInterval(tickClock, 1000);
    }, 100);
}

async function showDashboard() {
    const blanker = getElement("screenBlanker");
    const clockHeader = getElement("datetimeHeader");
    if (clockHeader && !clockHeader.dataset.bound) {
        clockHeader.dataset.bound = "1";
        clockHeader.addEventListener("click", () =>
            blanker.classList.add("active"),
        );
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
        "mealPrepDetailModal",
        "choreDetailModal",
        "changeLogDetailModal",
        "billDetailModal",
        "plantDetailModal",
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
    ["meal_prep", "chores", "change_log", "bills", "plants", "notes"].forEach(
        renderPanel,
    );

    bindSpotifyAuth();
    await initSpotify();
    await initSpotifyPlayer();
    await refreshSpotifyPlaylistSlots();
    await loadSchedules();
    renderSpotify();
    renderNextSchedule();
    startScheduleTicker();

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
    document.querySelector(".dashboard").style.display = "none";
    document.getElementById("loginContainer").style.display = "flex";

    await checkSession();

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("loginEmail").value;
            const password = document.getElementById("loginPassword").value;
            await dashboardLogin(email, password);
        });
    }
});

// ============================================================
// #endregion
// ============================================================
