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
        const { sb } = await getSupabaseContext();
        const watchedTables = getDataConfigs().map((cfg) => cfg.table);
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
