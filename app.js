// SUPABASE
const SUPABASE_URL = "https://ilfrtrfohdhoquemptmj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_s8LcKiFr_XOf_fg9O2ubBQ_8mElMJ6L";
let sbClient = null;
let isAuthenticated = false;
let realtimeSetupDone = false;
let subscriptions = [];

// LISTS
const mealPrepCategories = ["Carbs", "Veggies", "Proteins", "Fruits", "Others"];
const fridgeStockCategories = ["Fridge", "Freezer"];
let mealPrep = [];
let chores = [];
let changeLog = [];
let bills = [];
let plants = [];
let plantHistory = [];
let notes = [];
let currentFullList = null;
const panelState = {
    fridge_stock: { editingId: null, manualDate: false },
    chores: { editingId: null, manualDate: false },
    change_log: { editingId: null, manualDate: false },
    bills: { editingId: null, manualDate: false },
};

// LIST METADATA
const LIST_META_KEYS = [
    "fridge_stock",
    "chores",
    "change_log",
    "bills",
    "plants",
    "notes",
];
let listMetadata = {
    fridge_stock: null,
    chores: null,
    change_log: null,
    bills: null,
    plants: null,
    notes: null,
};
LIST_META_KEYS.forEach((key) => (listMetadata[key] = null));

// CONFIGS
const PANEL_CONFIGS = {
    meal_prep: {
        contentId: "mealPrepContent",
        buildFn: () => buildMealPrepHTML(false),
        fullBuildFn: () => buildMealPrepHTML(true),
        after: () => renderPanel("fridge_stock"),
        addAction: () => openDetailModal("fridge_stock"),
        fullListAddAction: () => openDetailModal("fridge_stock"),
    },

    fridge_stock: {
        key: "fridge_stock",
        renderKey: "meal_prep",
        stateKey: "fridge_stock",

        data: {
            table: "fridge_stock",
            store: (d) => {
                mealPrep = d;
            },
            orderCol: "item_name",
            extraOrder: {
                col: "last_updated",
                ascending: false,
                nullsLast: true,
            },
            label: "mealPrep",
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

        detailModal: {
            modalId: "mealPrepDetailModal",
            titleId: "mealPrepDetailTitle",
            editIdInput: "mealPrepEditId",
            deleteBtnId: "mealPrepDeleteBtn",
            addTitle: "ADD MEAL PREP ITEM",
            editTitle: "EDIT MEAL PREP ITEM",

            resetFields: () => {
                document.getElementById("mealPrepItemName").value = "";
                document.getElementById("mealPrepCategory").value = "Carbs";
                document.getElementById("mealPrepPortions").value = "1";
                document.getElementById("mealPrepShelfLife").value = "";
                document.getElementById("mealPrepCreatedAt").value =
                    getTodayHKT();
                document.getElementById("mealPrepExpiryDate").value = "";
                document.getElementById("mealPrepLastUpdated").textContent = "";
            },

            findItem: (id) => mealPrep.find((i) => i.id === id),

            populateFields: (item) => {
                document.getElementById("mealPrepItemName").value =
                    item.item_name;
                document.getElementById("mealPrepCategory").value =
                    item.category || "Carbs";
                document.getElementById("mealPrepPortions").value =
                    item.portions || 0;
                document.getElementById("mealPrepShelfLife").value =
                    item.shelf_life_days || "";
                document.getElementById("mealPrepCreatedAt").value =
                    formatDateInput(item.created_at);
                document.getElementById("mealPrepExpiryDate").value =
                    formatDateInput(item.expiry_date);
                document.getElementById("mealPrepLastUpdated").textContent =
                    item.last_updated ? formatShortDate(item.last_updated) : "";
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
            setManual: (v) => {
                panelState.fridge_stock.manualDate = v;
            },
            clearResult: () => {
                document.getElementById("mealPrepExpiryDate").value = "";
            },
        },

        form: {
            formId: "mealPrepForm",
            buildRecord: (isUpdate) => {
                const shelfLifeDays =
                    parseInt(
                        document.getElementById("mealPrepShelfLife").value,
                        10,
                    ) || null;
                const createdAt =
                    document.getElementById("mealPrepCreatedAt").value || null;
                const expiryDate = panelState.fridge_stock.manualDate
                    ? document.getElementById("mealPrepExpiryDate").value ||
                      null
                    : createdAt && shelfLifeDays
                      ? addDays(createdAt, shelfLifeDays)
                      : null;

                return {
                    id: isUpdate ? panelState.fridge_stock.editingId : null,
                    item_name: document
                        .getElementById("mealPrepItemName")
                        .value.trim(),
                    category: document.getElementById("mealPrepCategory").value,
                    portions:
                        parseInt(
                            document.getElementById("mealPrepPortions").value,
                            10,
                        ) || 0,
                    shelf_life_days: shelfLifeDays,
                    created_at: createdAt,
                    expiry_date: expiryDate,
                    last_updated: getTodayHKT(),
                };
            },
        },

        deleteConfig: {
            confirmMsg: "Delete this meal prep item permanently?",
        },
    },

    chores: {
        key: "chores",
        stateKey: "chores",

        data: {
            table: "chores",
            store: (d) => {
                chores = d;
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

        detailModal: {
            modalId: "choreDetailModal",
            titleId: "choreDetailTitle",
            editIdInput: "choreEditId",
            deleteBtnId: "choreDeleteBtn",
            addTitle: "ADD CHORE",
            editTitle: "EDIT CHORE",

            resetFields: () => {
                document.getElementById("choreTaskName").value = "";
                document.getElementById("choreLastDoneDate").value = "";
                document.getElementById("choreIntervalDays").value = "7";
                document.getElementById("choreNextDueDate").value = "";
            },

            findItem: (id) => chores.find((c) => c.id === id),

            populateFields: (item) => {
                document.getElementById("choreTaskName").value = item.task_name;
                document.getElementById("choreLastDoneDate").value =
                    formatDateInput(item.last_done_date);
                document.getElementById("choreIntervalDays").value =
                    item.interval_days || "7";
                document.getElementById("choreNextDueDate").value =
                    formatDateInput(item.next_due_date);
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
            setManual: (v) => {
                panelState.chores.manualDate = v;
            },
            clearResult: () => {
                document.getElementById("choreNextDueDate").value = "";
            },
        },

        form: {
            formId: "choreForm",
            buildRecord: (isUpdate) => {
                const lastDoneDate =
                    document.getElementById("choreLastDoneDate").value || null;
                const intervalDays =
                    parseInt(
                        document.getElementById("choreIntervalDays").value,
                        10,
                    ) || null;
                const nextDueDate = panelState.chores.manualDate
                    ? document.getElementById("choreNextDueDate").value || null
                    : lastDoneDate && intervalDays
                      ? addDays(lastDoneDate, intervalDays)
                      : null;

                return {
                    id: isUpdate ? panelState.chores.editingId : null,
                    task_name: document
                        .getElementById("choreTaskName")
                        .value.trim(),
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
                changeLog = d;
            },
            orderCol: "item_name",
            label: "changeLog",
        },

        render: {
            contentId: "changeLogContent",
            buildFn: buildChangeLogHTML,
            fullBuildFn: buildChangeLogHTML,
        },

        rowOpen: {
            enabled: true,
            open: (id) => openDetailModal("change_log", id),
        },

        detailModal: {
            modalId: "changeLogDetailModal",
            titleId: "changeLogDetailTitle",
            editIdInput: "changeLogEditId",
            deleteBtnId: "changeLogDeleteBtn",
            addTitle: "ADD CHANGE LOG",
            editTitle: "EDIT CHANGE LOG",

            resetFields: () => {
                document.getElementById("changeLogItemName").value = "";
                document.getElementById("changeLogLastChanged").value = "";
                document.getElementById("changeLogIntervalMonths").value = "3";
                document.getElementById("changeLogNextChangeDate").value = "";
            },

            findItem: (id) => changeLog.find((c) => c.id === id),

            populateFields: (item) => {
                document.getElementById("changeLogItemName").value =
                    item.item_name;
                document.getElementById("changeLogLastChanged").value =
                    formatDateInput(item.last_changed_date);
                document.getElementById("changeLogIntervalMonths").value =
                    item.interval_months || "6";
                document.getElementById("changeLogNextChangeDate").value =
                    formatDateInput(item.next_change_due);
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
            setManual: (v) => {
                panelState.change_log.manualDate = v;
            },
            clearResult: () => {
                document.getElementById("changeLogNextChangeDate").value = "";
            },
        },

        form: {
            formId: "changeLogForm",
            buildRecord: (isUpdate) => {
                const lastChangedDate =
                    document.getElementById("changeLogLastChanged").value ||
                    null;
                const intervalMonths =
                    parseInt(
                        document.getElementById("changeLogIntervalMonths")
                            .value,
                        10,
                    ) || null;
                const nextChangeDue = panelState.change_log.manualDate
                    ? document.getElementById("changeLogNextChangeDate")
                          .value || null
                    : lastChangedDate && intervalMonths
                      ? addMonths(lastChangedDate, intervalMonths)
                      : null;

                return {
                    id: isUpdate ? panelState.change_log.editingId : null,
                    item_name: document
                        .getElementById("changeLogItemName")
                        .value.trim(),
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
                bills = d;
            },
            orderCol: "bill_name",
            label: "bills",
        },

        render: {
            contentId: "billsContent",
            buildFn: buildBillsHTML,
            fullBuildFn: buildBillsHTML,
        },

        rowOpen: {
            enabled: true,
            open: (id) => openDetailModal("bills", id),
        },

        detailModal: {
            modalId: "billDetailModal",
            titleId: "billDetailTitle",
            editIdInput: "billEditId",
            deleteBtnId: "billDeleteBtn",
            addTitle: "ADD BILL",
            editTitle: "EDIT BILL",

            resetFields: () => {
                document.getElementById("billBillName").value = "";
                document.getElementById("billLastBillDate").value = "";
                document.getElementById("billIntervalMonths").value = "1";
                document.getElementById("billNextBillDate").value = "";
            },

            findItem: (id) => bills.find((b) => b.id === id),

            populateFields: (item) => {
                document.getElementById("billBillName").value = item.bill_name;
                document.getElementById("billLastBillDate").value =
                    formatDateInput(item.last_bill_date);
                document.getElementById("billIntervalMonths").value =
                    item.interval_months || "1";
                document.getElementById("billNextBillDate").value =
                    formatDateInput(item.next_bill_date);
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
            setManual: (v) => {
                panelState.bills.manualDate = v;
            },
            clearResult: () => {
                document.getElementById("billNextBillDate").value = "";
            },
        },

        form: {
            formId: "billForm",
            buildRecord: (isUpdate) => {
                const lastBillDate =
                    document.getElementById("billLastBillDate").value || null;
                const intervalMonths =
                    parseInt(
                        document.getElementById("billIntervalMonths").value,
                        10,
                    ) || null;
                const nextBillDate = panelState.bills.manualDate
                    ? document.getElementById("billNextBillDate").value || null
                    : lastBillDate && intervalMonths
                      ? addMonths(lastBillDate, intervalMonths)
                      : null;

                return {
                    id: isUpdate ? panelState.bills.editingId : null,
                    bill_name: document
                        .getElementById("billBillName")
                        .value.trim(),
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
                plants = d;
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
        fullListAddAction: () => openPlantAddModal(),
    },

    notes: {
        key: "notes",

        data: {
            table: "notes",
            store: (d) => {
                notes = d;
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
        fullListAddAction: () => openModal("noteAddModal"),
    },

    plant_history: {
        key: "plant_history",

        data: {
            table: "plant_history",
            store: (d) => {
                plantHistory = d;
            },
            orderCol: "event_date",
            orderAscending: false,
            orderNulls: { nullsLast: true },
            noUserFilter: true,
            label: "plantHistory",
        },
    },
};

// ─── SPOTIFY CONSTANTS ───────────────────────────────────────────────
const SPOTIFY_CLIENT_ID = "61214ea8d81b43a6bd94e5aaaa39ec38";
const SPOTIFY_REDIRECT_URI = "https://hhyleung.github.io/kf20d/";
const SPOTIFY_SCOPES = [
    "streaming",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-library-read",
].join(" ");

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

function getDataConfigs() {
    return Object.values(PANEL_CONFIGS)
        .map((cfg) => cfg.data)
        .filter(Boolean);
}

async function loadSupabaseData(configs = getDataConfigs()) {
    const sb = await ensureSupabaseReady();
    if (!sb) {
        console.error("Supabase not ready");
        return;
    }

    const {
        data: { user },
    } = await sb.auth.getUser();

    if (!user?.id) {
        console.error("Not authenticated");
        return;
    }

    await Promise.all([
        ...configs.map(async (cfg) => {
            try {
                let query = sb.from(cfg.table).select("*");

                if (!cfg.noUserFilter) {
                    if (!user?.id) {
                        cfg.store([]);
                        return;
                    }
                    query = query.eq("user_id", user.id);
                }

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
                console.log(`${cfg.label} loaded:`, (data || []).length);
            } catch (err) {
                console.error(`Load ${cfg.table} error:`, err);
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

                console.log("listMetadata loaded");
            } catch (err) {
                console.error("Load list_metadata error:", err);
            }
        })(),
    ]);

    console.log("All data loaded");
}

async function setupRealtime() {
    cleanupSubscriptions();

    const sb = await ensureSupabaseReady();
    if (!sb) {
        console.log("Skipping realtime - not ready");
        return;
    }

    const {
        data: { user },
    } = await sb.auth.getUser();
    if (!user?.id) {
        console.log("Skipping realtime - not authenticated");
        return;
    }

    const watchedTables = [
        "fridge_stock",
        "chores",
        "change_log",
        "bills",
        "plants",
        "plant_history",
        "notes",
    ];

    watchedTables.forEach((tableName) => {
        subscribeToTable(tableName, async () => {
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
    const blanker = document.getElementById("screenBlanker");
    if (blanker && !blanker.dataset.bound) {
        blanker.dataset.bound = "1";
        blanker.addEventListener("click", () => {
            blanker.classList.remove("active");
        });
    }

    document.getElementById("loginContainer").style.display = "none";
    const dash = document.querySelector(".dashboard");
    dash.style.removeProperty("display");
    dash.style.display = "flex";

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
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    setupPanelClicks();
    bindAllForms();

    Object.keys(panelState).forEach((key) => {
        panelState[key].editingId = null;
        panelState[key].manualDate = false;
    });

    await loadSupabaseData();

    ["meal_prep", "chores", "change_log", "bills", "plants", "notes"].forEach(
        renderPanel,
    );
    renderSpotify();

    startClock();

    bindSpotifyAuth();
    await initSpotify();
    await initSpotifyPlayer();

    if (!realtimeSetupDone) {
        realtimeSetupDone = true;
        setTimeout(setupRealtime, 500);
    }
}

let clockInterval = null;

function startClock() {
    const datetimeHeader = document.getElementById("datetimeHeader");
    if (datetimeHeader && !datetimeHeader.dataset.bound) {
        datetimeHeader.dataset.bound = "1";
        datetimeHeader.addEventListener("click", () =>
            document.getElementById("screenBlanker").classList.add("active"),
        );
    }

    function tick() {
        const el = document.getElementById("clockDisplay");
        if (!el) return;

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

        el.textContent = `${weekday}\u00A0\u00A0${day} ${month} ${year}\u00A0\u00A0${hour}:${minute}`;
    }

    if (clockInterval) clearInterval(clockInterval);
    setTimeout(() => {
        tick();
        clockInterval = setInterval(tick, 1000);
    }, 100);
}

// PANEL BUILDERS
function renderPanel(section) {
    const cfg = PANEL_CONFIGS[section];
    if (!cfg) return;

    const renderCfg = cfg.render || cfg;
    if (!renderCfg.contentId || !renderCfg.buildFn) return;

    const contentEl = document.getElementById(renderCfg.contentId);
    if (contentEl) {
        contentEl.innerHTML = renderCfg.buildFn();
    }

    if (currentFullList === section) {
        const fullListEl = document.getElementById("fullListContent");
        if (fullListEl && renderCfg.fullBuildFn) {
            fullListEl.innerHTML = renderCfg.fullBuildFn();
        }
    }

    if (cfg.after) cfg.after();
}

// MEAL PREP
function getVisibleItems(showZero = false) {
    return mealPrep.filter((item) => showZero || item.portions > 0);
}

function groupByCategory(items) {
    const grouped = {};
    mealPrepCategories.forEach((cat) => (grouped[cat] = []));
    items.forEach((item) => {
        const cat = mealPrepCategories.includes(item.category)
            ? item.category
            : "Others";
        grouped[cat].push(item);
    });
    return grouped;
}

function mealPrepItemRow(item, showZero = false) {
    const expiryClass = getUrgencyClass(item.expiry_date, 7);
    const portionsDisplay =
        item.portions === 0 && showZero
            ? `<span class="portion-zero">${item.portions}</span>`
            : `<span class="portion-number">${item.portions}</span>`;
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
    const items = getVisibleItems(showZero).filter(
        (i) => !fridgeStockCategories.includes(i.category),
    );
    const grouped = groupByCategory(items);
    const forceFullWidth = ["Proteins"];
    const alwaysHalfWidth = ["Carbs", "Veggies", "Fruits", "Others"];

    let html = '<div class="meal-prep-inner-grid">';
    mealPrepCategories.forEach((cat) => {
        const catItems = grouped[cat];
        const isAlwaysHalf = alwaysHalfWidth.includes(cat);
        const isForceFull = forceFullWidth.includes(cat);
        const wide = isForceFull || (!isAlwaysHalf && catItems.length >= 3);
        const cls = wide ? "col-full" : "col-half";
        const totalPortions = catItems.reduce(
            (sum, i) => sum + (i.portions || 0),
            0,
        );

        if (catItems.length === 0) {
            html += `<div class="meal-prep-group ${cls}">
                <div class="meal-prep-group-title">
                    <span>${cat}</span>
                    <span class="meal-prep-cat-total">${totalPortions}</span>
                </div>`;
        } else {
            html += `<div class="meal-prep-group ${cls}">
                <div class="meal-prep-group-title">
                    <span>${cat}</span>
                    <span class="meal-prep-cat-total">${totalPortions}</span>
                </div>
                <ul class="item-list ${wide ? "two-col-list" : ""}">`;
            catItems.forEach((item) => {
                html += mealPrepItemRow(item, showZero);
            });
            html += "</ul></div>";
        }
    });
    html += "</div>";
    return html;
}

function buildFridgeStockHTML(showZero = false) {
    const items = mealPrep
        .filter(
            (i) =>
                fridgeStockCategories.includes(i.category) &&
                (showZero || i.portions > 0),
        )
        .sort((a, b) => a.item_name.localeCompare(b.item_name));

    if (!items.length) return "";

    let html = '<ul class="item-list">';
    items.forEach((item) => {
        html += mealPrepItemRow(item, showZero);
    });
    html += "</ul>";
    return html;
}

// CHORES
function buildChoresHTML() {
    let html = '<ul class="item-list">';
    chores.forEach((chore) => {
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

// CHANGE LOG
function buildChangeLogHTML() {
    let html = '<ul class="item-list">';
    changeLog.forEach((cl) => {
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

// BILLS
function buildBillsHTML() {
    let html = '<ul class="item-list">';
    bills.forEach((bill) => {
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

// PLANTS
function buildPlantsHTML(showArchived = false) {
    const visible = showArchived ? plants : plants.filter((p) => !p.archived);
    if (!visible.length) {
        return "";
    }
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

// NOTES
function buildNotesHTML() {
    let html = '<ul class="item-list">';
    notes.forEach((note) => {
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
        <div class="spotify-schedule-header">
          <div class="spotify-schedule-title">NEXT SCHEDULE</div>
          <button class="spotify-schedule-action all" type="button" id="spotifySchedAllBtn">ALL</button>
        </div>
        <div class="spotify-schedule-row" id="spotifySchedRow">
          <span class="spotify-schedule-date" id="spotifySchedDate">—</span>
          <span class="spotify-schedule-time" id="spotifySchedTime"></span>
          <span class="spotify-schedule-playlist" id="spotifySchedPlaylist"></span>
        </div>
        <div class="spotify-schedule-actions">
          <button class="spotify-schedule-action add"  type="button" id="spotifySchedAddBtn">Add</button>
          <button class="spotify-schedule-action edit" type="button" id="spotifySchedEditBtn">Edit</button>
          <button class="spotify-schedule-action skip" type="button" id="spotifySchedSkipBtn">Skip</button>
        </div>
      </div>
    </div>
  `;

    bindPlaybackControls();
    bindVolButtons();
}

// ─── SPOTIFY AUTH ────────────────────────────────────────────────────

function generateCodeVerifier() {
    const array = new Uint8Array(64);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

async function startSpotifyAuth() {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem("spotify_code_verifier", verifier);

    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: "code",
        redirect_uri: SPOTIFY_REDIRECT_URI,
        scope: SPOTIFY_SCOPES,
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

    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
    const data = await res.json();
    sessionStorage.removeItem("spotify_code_verifier");
    return data;
}

async function saveSpotifyToken(tokenData) {
    const sb = await ensureSupabaseReady();
    const {
        data: { user },
    } = await sb.auth.getUser();
    if (!user) return;

    const expiresAt = new Date(
        Date.now() + tokenData.expires_in * 1000,
    ).toISOString();

    await sb.from("spotify_tokens").upsert(
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
}

async function loadSpotifyToken() {
    const sb = await ensureSupabaseReady();
    const {
        data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;

    const { data, error } = await sb
        .from("spotify_tokens")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("loadSpotifyToken error:", error);
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

    if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
    return await res.json();
}

async function getValidSpotifyToken() {
    const tokenRow = await loadSpotifyToken();
    if (!tokenRow) return null;

    const expiresAt = new Date(tokenRow.expires_at).getTime();
    const fiveMinutes = 5 * 60 * 1000;
    const needsRefresh = Date.now() > expiresAt - fiveMinutes;

    if (!needsRefresh) return tokenRow.access_token;

    try {
        const refreshed = await refreshSpotifyToken(tokenRow.refresh_token);
        await saveSpotifyToken({
            ...refreshed,
            refresh_token: refreshed.refresh_token ?? tokenRow.refresh_token,
        });
        return refreshed.access_token;
    } catch (err) {
        console.error("Spotify token refresh failed:", err);
        setSpotifyHeaderError(true);
        return null;
    }
}

function setSpotifyHeaderError(isError) {
    const panel = document.querySelector('[data-section="spotify"]');
    if (!panel) return;
    const header = panel.querySelector(".panel-header");
    if (!header) return;
    header.classList.toggle("spotify-header-error", isError);
}

async function initSpotify() {
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
            setSpotifyHeaderError(false);
        } catch (err) {
            console.error("Spotify auth callback failed:", err);
            setSpotifyHeaderError(true);
        }
        return;
    }

    const token = await getValidSpotifyToken();
    if (!token) {
        setSpotifyHeaderError(true);
    } else {
        setSpotifyHeaderError(false);
    }
}

function bindSpotifyAuth() {
    const authBtn = document.getElementById("spotifyAuthBtn");
    if (authBtn && !authBtn.dataset.bound) {
        authBtn.dataset.bound = "1";
        authBtn.addEventListener("click", startSpotifyAuth);
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

// ─── SPOTIFY WEB PLAYBACK SDK ────────────────────────────────────────

let spotifyPlayer = null;
let spotifyDeviceId = null;
let spotifyPlayerReady = false;

window.onSpotifyWebPlaybackSDKReady = function () {
    console.log("Spotify SDK loaded and ready");
    initSpotifyPlayer();
};

async function initSpotifyPlayer() {
    const token = await getValidSpotifyToken();
    if (!token) return;

    spotifyPlayer = new Spotify.Player({
        name: "kf20d",
        getOAuthToken: async (cb) => {
            const t = await getValidSpotifyToken();
            cb(t);
        },
        volume: 0.65,
    });

    spotifyPlayer.addListener("ready", ({ device_id }) => {
        spotifyDeviceId = device_id;
        spotifyPlayerReady = true;
        console.log("Spotify player ready, device:", device_id);
        transferPlaybackToDevice(device_id);
    });

    spotifyPlayer.addListener("not_ready", ({ device_id }) => {
        console.warn("Spotify player not ready:", device_id);
        spotifyPlayerReady = false;
    });

    spotifyPlayer.addListener("player_state_changed", (state) => {
        updateNowPlaying(state);
    });

    spotifyPlayer.addListener("initialization_error", ({ message }) => {
        console.error("SDK init error:", message);
        setSpotifyHeaderError(true);
    });

    spotifyPlayer.addListener("authentication_error", ({ message }) => {
        console.error("SDK auth error:", message);
        setSpotifyHeaderError(true);
    });

    spotifyPlayer.addListener("account_error", ({ message }) => {
        console.error("SDK account error:", message);
        setSpotifyHeaderError(true);
    });

    await spotifyPlayer.connect();
}

async function transferPlaybackToDevice(deviceId) {
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
        console.error("Transfer playback failed:", err);
    }
}

function updateNowPlaying(state) {
    const artEl = document.getElementById("spotifyArt");
    const titleEl = document.getElementById("spotifyTitle");
    const artistEl = document.getElementById("spotifyArtist");
    const playBtn = document.getElementById("spotifyPlayBtn");

    if (!state || !state.track_window?.current_track) {
        if (artEl) artEl.style.backgroundImage = "";
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
        // hide placeholder icon when art is loaded
        const placeholder = artEl.querySelector(".spotify-art-placeholder");
        if (placeholder) placeholder.style.display = img ? "none" : "flex";
    }

    if (titleEl) titleEl.textContent = track.name;
    if (artistEl)
        artistEl.textContent = track.artists.map((a) => a.name).join(", ");
    if (playBtn) playBtn.textContent = state.paused ? "▶" : "⏸";
}

// ─── PLAYBACK CONTROLS ───────────────────────────────────────────────

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

// ─── VOLUME CONTROL ──────────────────────────────────────────────────

let currentVolume = 65;

function bindVolButtons() {
    const volUp = document.getElementById("volUpBtn");
    const volDown = document.getElementById("volDownBtn");
    const volDisplay = document.getElementById("volDisplay");
    if (!volUp || !volDown || !volDisplay) return;
    if (volUp.dataset.bound) return;
    volUp.dataset.bound = "1";

    volUp.addEventListener("click", async (e) => {
        e.stopPropagation();
        currentVolume = Math.min(100, currentVolume + 5);
        volDisplay.textContent = currentVolume;
        if (spotifyPlayer) await spotifyPlayer.setVolume(currentVolume / 100);
    });

    volDown.addEventListener("click", async (e) => {
        e.stopPropagation();
        currentVolume = Math.max(0, currentVolume - 5);
        volDisplay.textContent = currentVolume;
        if (spotifyPlayer) await spotifyPlayer.setVolume(currentVolume / 100);
    });
}

// FULL LIST
function buildFullListHTML(list) {
    switch (list) {
        case "meal_prep":
            return buildMealPrepHTML(true);
        case "fridge_stock":
            return buildFridgeStockHTML(true);
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

function openRowItem(type, id) {
    const cfg = PANEL_CONFIGS[type];
    if (!cfg?.rowOpen?.open) return;
    cfg.rowOpen.open(id);
}

function openDetailModal(panelKey, itemId = null) {
    const panelCfg = PANEL_CONFIGS[panelKey];
    const cfg = panelCfg?.detailModal;
    if (!cfg) return;

    const isEditing = !!itemId;
    const stateKey = panelCfg.stateKey;
    const deleteBtn = cfg.deleteBtnId
        ? document.getElementById(cfg.deleteBtnId)
        : null;

    if (stateKey && panelState[stateKey]) {
        panelState[stateKey].editingId = itemId;
    }

    if (cfg.editIdInput) {
        const editInput = document.getElementById(cfg.editIdInput);
        if (editInput) editInput.value = itemId || "";
    }

    if (cfg.titleId) {
        const titleEl = document.getElementById(cfg.titleId);
        if (titleEl) {
            titleEl.textContent = isEditing ? cfg.editTitle : cfg.addTitle;
        }
    }

    if (deleteBtn) {
        deleteBtn.hidden = true;
        deleteBtn.style.display = "none";
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

    if (deleteBtn) {
        deleteBtn.hidden = !isEditing;
        deleteBtn.style.display = isEditing ? "" : "none";
    }

    if (panelCfg.autoDate) {
        refreshAutoDate(panelCfg.autoDate);
    }

    openModal(cfg.modalId);
}

// PLANTS
function openPlantAddModal() {
    document.getElementById("addPlantName").value = "";
    document.getElementById("addPlantStartingDate").value = getTodayHKT();
    document.getElementById("addPlantPotSize").value = "";
    openModal("plantAddModal");
}

function openPlantDetail(plantId) {
    const plant = plants.find((p) => p.id === plantId);
    if (!plant) return;

    document.getElementById("plantDetailTitle").textContent =
        plant.plant_name.toUpperCase();
    document.getElementById("pdPlantNameInput").value = plant.plant_name;
    document.getElementById("pdSaveNameBtn").dataset.id = plantId;
    document.getElementById("pdStartingDate").value = plant.starting_date
        ? formatDateInput(plant.starting_date)
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

    document.getElementById("pdLogEventBtn").dataset.id = plantId;
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
                  style="font-size: 0.9rem; width: 32px; height: 32px;">&times;</button>
        </td>
      </tr>
    `,
            )
            .join("");
    }

    const archiveBtn = document.getElementById("pdArchiveBtn");
    archiveBtn.dataset.id = plantId;
    archiveBtn.textContent = plant.archived ? "Unarchive" : "Archive";
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
    document.getElementById("plantEventDate").value = getTodayHKT();
    document.getElementById("wateredCheck").checked = false;
    document.getElementById("fertilisedCheck").checked = false;
    document.getElementById("fertiliserSelectWrap").style.display = "none";
    document.getElementById("fertiliserSelect").value = "20-20-20";
    document.getElementById("plantEventPotSize").value = plant.pot_size || "";
    document.getElementById("plantEventNotes").value = "";

    openModal("plantEventModal");
}

function setupPanelClicks() {
    if (setupPanelClicks.bound) return;
    setupPanelClicks.bound = true;
    document.querySelectorAll(".panel-header").forEach((header) => {
        header.addEventListener("click", (e) => {
            const panel = e.target.closest(".panel");
            const section = panel.dataset.section;
            const h3 = header.querySelector("h3");
            if (section && h3 && section !== "spotify") {
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
                case "meal_prep":
                case "fridge_stock":
                case "chores":
                case "change_log":
                case "bills":
                    openDetailModal(section);
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

    document.getElementById("fullListAddBtn")?.addEventListener("click", () => {
        switch (currentFullList) {
            case "fridge_stock":
            case "chores":
            case "change_log":
            case "bills":
                openDetailModal(currentFullList);
                break;
            case "plants":
                openPlantAddModal();
                break;
            case "notes":
                openModal("noteAddModal");
                break;
        }
    });
}

function refreshListLastUpdated() {
    if (!currentFullList) return;

    const el = document.getElementById("listLastUpdated");
    if (el) {
        el.textContent = formatMetaTimestamp(listMetadata[currentFullList]);
    }
}

// DATE HANDLERS
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

function formatDateInput(value) {
    if (!value) return "";
    const date = new Date(value + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
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

function getTodayHKT() {
    return new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Hong_Kong",
    });
}

function refreshAutoDate(cfg) {
    const fromEl = document.getElementById(cfg.fromId);
    const intervalEl = document.getElementById(cfg.intervalId);
    const resultEl = document.getElementById(cfg.resultId);
    const labelEl = cfg.autoLabelId
        ? document.getElementById(cfg.autoLabelId)
        : null;
    if (!fromEl || !intervalEl || !resultEl) return;

    const isManual = cfg.manualFlag();
    if (labelEl) labelEl.style.display = isManual ? "none" : "inline";
    if (isManual) return;

    const fromVal = fromEl.value;
    const intervalVal = parseFloat(intervalEl.value);
    if (!fromVal || !intervalVal) {
        if (cfg.clearResult) cfg.clearResult();
        else resultEl.value = "";
        return;
    }

    const computed =
        cfg.unit === "months"
            ? addMonths(fromVal, intervalVal)
            : addDays(fromVal, intervalVal);

    resultEl.value = computed || "";
}

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

// SUPABASE SYNCHRONISE
async function runMutation(label, fn) {
    try {
        const sb = await ensureSupabaseReady();
        if (!sb) throw new Error("Supabase not ready");
        const {
            data: { user },
        } = await sb.auth.getUser();
        if (!user?.id) throw new Error("Not authenticated");
        await fn(sb, user.id);
    } catch (err) {
        console.error(`${label} failed:`, err);
        alert(`${label} failed: ${err.message}`);
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
                throw new Error("Invalid item ID for update");
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
        touchMetadata(table);
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
        touchMetadata(table);
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
        touchMetadata("plants");
    });
}

async function savePlantHistory(historyItem) {
    await runMutation("Save plant_history", async (sb) => {
        const { error } = await sb.from("plant_history").insert({
            ...historyItem,
            plant_id: historyItem.plant_id,
        });
        if (error) throw error;
        const plantCfg = PANEL_CONFIGS.plants.data;
        const historyCfg = PANEL_CONFIGS.plant_history.data;
        await loadSupabaseData([plantCfg, historyCfg]);
        touchMetadata("plants");
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
        await loadSupabaseData();
        touchMetadata("plants");
        openPlantDetail(plantId);
    });
}

async function saveNote(content) {
    if (!content?.trim()) return;
    await runMutation("Save note", async (sb, userId) => {
        const { error } = await sb.from("notes").insert({
            content: content.trim(),
            user_id: userId,
            created_at: getTodayHKT(),
        });
        if (error) throw error;
        await loadSupabaseData([PANEL_CONFIGS.notes.data]);
        renderPanel("notes");
        touchMetadata("notes");
        document.getElementById("addNoteContent").value = "";
    });
}

async function deleteNote(id) {
    await deleteRecord("notes", "notes", id, "Delete this note?");
    renderPanel("notes");
    touchMetadata("notes");
}

// FULL LIST
async function touchMetadata(listName) {
    const ts = new Date().toISOString();
    listMetadata[listName] = ts;
    refreshListLastUpdated();

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
function bindAutoDate(cfg) {
    const fromEl = document.getElementById(cfg.fromId);
    const intervalEl = document.getElementById(cfg.intervalId);
    const resultEl = document.getElementById(cfg.resultId);
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

function bindAllForms() {
    if (bindAllForms.bound) return;
    bindAllForms.bound = true;

    Object.values(PANEL_CONFIGS)
        .filter((cfg) => cfg.autoDate)
        .forEach((cfg) => bindAutoDate(cfg.autoDate));

    Object.values(PANEL_CONFIGS)
        .filter((cfg) => cfg.form && cfg.detailModal)
        .forEach((panelCfg) => {
            const formCfg = panelCfg.form;
            const modalCfg = panelCfg.detailModal;
            const stateKey = panelCfg.stateKey;
            const renderKey = panelCfg.renderKey ?? panelCfg.key;

            const formEl = document.getElementById(formCfg.formId);
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

            const btn = document.getElementById(modalCfg.deleteBtnId);
            if (!btn) return;

            btn.addEventListener("click", async () => {
                if (!confirm(delCfg.confirmMsg)) return;

                const itemId = stateKey
                    ? panelState[stateKey]?.editingId
                    : null;
                if (!itemId) return;

                await runMutation(
                    `Delete ${panelCfg.data.table}`,
                    async (sb, userId) => {
                        const { error } = await sb
                            .from(panelCfg.data.table)
                            .delete()
                            .eq("id", itemId)
                            .eq("user_id", userId);
                        if (error) throw error;

                        closeModal(modalCfg.modalId);

                        if (stateKey && panelState[stateKey]) {
                            panelState[stateKey].editingId = null;
                            panelState[stateKey].manualDate = false;
                        }

                        const cfg = Object.values(PANEL_CONFIGS).find(
                            (c) => c.data?.table === panelCfg.data.table,
                        );
                        if (cfg?.data) await loadSupabaseData([cfg.data]);
                        renderPanel(panelKey);
                        touchMetadata(panelCfg.data.table);
                    },
                );
            });
        });

    const addPlantForm = document.getElementById("addPlantForm");
    if (addPlantForm) {
        addPlantForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("addPlantName").value.trim();
            const startingDate =
                document.getElementById("addPlantStartingDate").value || null;
            const potSize =
                parseInt(
                    document.getElementById("addPlantPotSize").value,
                    10,
                ) || null;
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

    const plantEventForm = document.getElementById("plantEventForm");
    if (plantEventForm && !plantEventForm.dataset.bound) {
        plantEventForm.dataset.bound = "1";

        const fertilisedCheck = document.getElementById("fertilisedCheck");
        const fertiliserWrap = document.getElementById("fertiliserSelectWrap");
        const fertiliserSelect = document.getElementById("fertiliserSelect");

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

            const plantId =
                document.getElementById("plantEventId")?.value || "";
            const eventDate =
                document.getElementById("plantEventDate")?.value || null;
            const watered = !!document.getElementById("wateredCheck")?.checked;
            const fertilised =
                !!document.getElementById("fertilisedCheck")?.checked;
            const fertiliserUsed = fertilised
                ? document.getElementById("fertiliserSelect")?.value || null
                : null;

            const potSizeRaw =
                document.getElementById("plantEventPotSize")?.value || "";
            const potSize = potSizeRaw === "" ? null : parseInt(potSizeRaw, 10);

            const notes =
                document.getElementById("plantEventNotes")?.value.trim() ||
                null;

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

    const noteForm = document.getElementById("addNoteForm");
    if (noteForm && !noteForm.dataset.bound) {
        noteForm.dataset.bound = "1";
        noteForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const content = document
                .getElementById("addNoteContent")
                .value.trim();
            if (!content) return;

            await saveRecord("notes", "notes", { content }, false);
            document.getElementById("addNoteContent").value = "";
            closeModal("noteAddModal");
        });
    }
}

const ACTION_HANDLERS = {
    "meal-prep-portions": async (btn) => {
        const id = btn.dataset.id;
        const delta = parseInt(btn.dataset.delta, 10) || 0;
        if (!id || !delta) return;

        const item = mealPrep.find((i) => i.id === id);
        if (!item) return;

        const newPortions = Math.max(0, (item.portions || 0) + delta);

        await saveRecord(
            "fridge_stock",
            "meal_prep",
            {
                id,
                item_name: item.item_name,
                category: item.category,
                portions: newPortions,
                shelf_life_days: item.shelf_life_days,
                created_at: item.created_at,
                expiry_date: item.expiry_date,
                last_updated: getTodayHKT(),
            },
            true,
        );
    },

    done: async (btn) => {
        const id = btn.dataset.id;
        if (!id) return;

        const chore = chores.find((c) => c.id === id);
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

        const cl = changeLog.find((c) => c.id === id);
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

        const bill = bills.find((b) => b.id === id);
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

        const plant = plants.find((p) => p.id === id);
        if (!plant) return;

        const newName = document
            .getElementById("pdPlantNameInput")
            .value.trim();
        const newStart =
            document.getElementById("pdStartingDate").value || null;

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

        const plant = plants.find((p) => p.id === id);
        if (!plant) return;

        const archiveNow = !plant.archived;
        const ok = confirm(
            archiveNow
                ? `Archive "${plant.plant_name}"?`
                : `Unarchive "${plant.plant_name}"?`,
        );
        if (!ok) return;

        await runMutation("Toggle plant archive", async (sb, userId) => {
            const { error } = await sb
                .from("plants")
                .update({ archived: archiveNow })
                .eq("id", id)
                .eq("user_id", userId);

            if (error) throw error;

            await loadSupabaseData([PANEL_CONFIGS.plants.data]);
            renderPanel("plants");
            touchMetadata("plants");
            openPlantDetail(id);
        });
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
        await deleteNote(id);
    },
};

// GLOBAL CLICK DELEGATION
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
});
