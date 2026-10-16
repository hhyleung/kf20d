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
        if (!supabaseClient) await sleep(100);
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

// Changes from other devices: reload just the changed table and re-render.
async function setupRealtime() {
    cleanupSubscriptions();
    try {
        const { sb } = await getSupabaseContext();
        getDataConfigs().forEach((cfg) => {
            subscribeToTable(sb, cfg.table, async () => {
                await loadSupabaseData([cfg]);
                renderAllPanels();
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
// Runs a write and reports failures in one place. On failure the local data is
// reloaded from Supabase so any optimistic UI change is reverted.
// Returns true on success so callers can e.g. keep a modal open on failure.
async function runMutation(label, fn) {
    try {
        const { sb, user } = await getSupabaseContext();
        await fn(sb, user.id);
        return true;
    } catch (err) {
        console.error(`${label} failed:`, err);
        showToast(`${label} failed: ${err?.message || err}`, "error");
        await resyncAllData();
        return false;
    }
}

async function resyncAllData() {
    await loadSupabaseData();
    renderAllPanels();
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

function configForTable(table) {
    return Object.values(PANEL_CONFIGS).find((c) => c.data?.table === table);
}

// Reload a table after a write, re-render its panel and bump its
// "last updated" stamp. Plants and their history are reloaded together.
async function refreshTable(table) {
    const cfg = configForTable(table);
    const isPlants = cfg.key === "plants";
    await loadSupabaseData(
        isPlants
            ? [PANEL_CONFIGS.plants.data, PANEL_CONFIGS.plantHistory.data]
            : [cfg.data],
    );
    renderPanel(cfg.key);
    if (isPlants) refreshOpenPlantDetail();
    updateListMetadata(cfg.key);
}

// Inserts `record`, or updates the row when it has an id.
async function saveRecord(table, record) {
    const userScoped = !configForTable(table).data.noUserFilter;
    return runMutation("Save", async (sb, userId) => {
        const { id, ...fields } = record;
        if (userScoped) fields.user_id = userId;
        let query = id
            ? sb.from(table).update(fields).eq("id", id)
            : sb.from(table).insert(fields);
        if (id && userScoped) query = query.eq("user_id", userId);
        const { error } = await query;
        if (error) throw error;
        await refreshTable(table);
    });
}

async function deleteRecord(table, id, confirmMsg) {
    const ok = await confirmDialog(confirmMsg, {
        confirmText: "Delete",
        danger: true,
    });
    if (!ok) return false;
    const userScoped = !configForTable(table).data.noUserFilter;
    return runMutation("Delete", async (sb, userId) => {
        let query = sb.from(table).delete().eq("id", id);
        if (userScoped) query = query.eq("user_id", userId);
        const { error } = await query;
        if (error) throw error;
        await refreshTable(table);
    });
}

async function deletePlant(plantId) {
    const ok = await confirmDialog(
        "Delete this plant and all its history permanently?",
        { confirmText: "Delete", danger: true },
    );
    if (!ok) return false;
    return runMutation("Delete plant", async (sb, userId) => {
        const { error: historyError } = await sb
            .from("plant_history_db")
            .delete()
            .eq("plant_id", plantId);
        if (historyError) throw historyError;
        const { error } = await sb
            .from("plants_db")
            .delete()
            .eq("id", plantId)
            .eq("user_id", userId);
        if (error) throw error;
        await refreshTable("plants_db");
    });
}
// ============================================================
// #endregion
// ============================================================
