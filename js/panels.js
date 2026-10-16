// ============================================================
// #region PANEL BUILDERS
// ============================================================
function getUrgencyClass(dateStr, warningDays = 3) {
    if (!dateStr) return "";
    const daysLeft = daysBetween(getToday(), dateStr.slice(0, 10));
    if (Number.isNaN(daysLeft)) return "";
    if (daysLeft < 0) return "danger";
    if (daysLeft <= warningDays) return "warning";
    return "";
}

// Colours a panel header by the most urgent of its items' due dates.
function applyHeaderUrgency(headerId, dates) {
    const header = getElement(headerId);
    if (!header) return;
    header.classList.remove("danger", "warning");
    const classes = dates.map((d) => getUrgencyClass(d));
    if (classes.includes("danger")) header.classList.add("danger");
    else if (classes.includes("warning")) header.classList.add("warning");
}

// `full` (full-list modal) also shows zero-portion items and the expiry date.
function pantryItemRow(item, full = false) {
    const expiryClass = getUrgencyClass(item.expiration_date, 7);
    const portionClass =
        item.portions === 0 && full ? "portion-zero" : "portion-number";
    const zeroClass = item.portions === 0 ? " zero-portions" : "";
    const portionBtn = (delta, label) =>
        `<button class="action-btn btn-grey" data-action="meal-prep-portions" data-id="${item.id}" data-delta="${delta}">${label}</button>`;
    return `<li class="item-row${zeroClass}" data-open-type="mealPrep" data-id="${item.id}">
                <span class="item-key ${expiryClass}">${escapeHTML(item.food_name)}</span>
                <span class="item-value">
                    ${full ? `<span class="item-meta expiry-meta ${expiryClass}" title="Expiry date">${formatShortDate(item.expiration_date) || "—"}</span>` : ""}
                    ${portionBtn(1, "+")}
                    <span class="${portionClass}">${item.portions}</span>
                    ${portionBtn(-1, "-")}
                </span>
            </li>`;
}

function pantryItems(isFridge, full) {
    return panelData.pantry.filter(
        (i) =>
            (full || i.portions > 0) &&
            FRIDGE_STOCK_CATS.includes(i.category) === isFridge,
    );
}

function buildMealPrepHTML(full) {
    const grouped = Object.fromEntries(MEAL_PREP_CATS.map((cat) => [cat, []]));
    pantryItems(false, full).forEach((item) => {
        const cat = MEAL_PREP_CATS.includes(item.category)
            ? item.category
            : "Others";
        grouped[cat].push(item);
    });
    const groups = MEAL_PREP_CATS.map((cat) => {
        const items = grouped[cat];
        const wide = FULL_WIDTH_CATS.includes(cat);
        const total = items.reduce((sum, i) => sum + (i.portions || 0), 0);
        const list = items.length
            ? `<ul class="item-list ${wide ? "two-col-list" : ""}">
                   ${items.map((item) => pantryItemRow(item, full)).join("")}
               </ul>`
            : "";
        return `<div class="meal-prep-group ${wide ? "col-full" : "col-half"}">
                    <div class="meal-prep-group-title">
                        <span>${cat}</span>
                        <span class="meal-prep-cat-total">${total}</span>
                    </div>
                    ${list}
                </div>`;
    });
    return `<div class="meal-prep-inner-grid">${groups.join("")}</div>`;
}

function buildFridgeStockHTML(full = false) {
    const items = pantryItems(true, full).sort((a, b) =>
        a.food_name.localeCompare(b.food_name),
    );
    if (!items.length) return "";
    return `<ul class="item-list">${items.map((item) => pantryItemRow(item, full)).join("")}</ul>`;
}

function markDoneButton(key, id) {
    const { doneTitle } = PANEL_CONFIGS[key].recurring;
    return `<button class="action-btn btn-green" data-action="mark-done" data-panel="${key}" data-id="${id}" title="${doneTitle}">✓</button>`;
}

function buildRecurringPanelHTML(key) {
    const { cols, showList } = PANEL_CONFIGS[key].recurring;
    const items = panelData[key];
    if (!showList) {
        applyHeaderUrgency(
            `${key}Header`,
            items.map((i) => i[cols.next]),
        );
        return "";
    }
    const rows = items.map(
        (
            item,
        ) => `<li class="item-row" data-open-type="${key}" data-id="${item.id}">
            <span class="item-key ${getUrgencyClass(item[cols.next])}">${escapeHTML(item[cols.name])}</span>
            <span class="item-value">
                <span class="item-meta">${formatShortDate(item[cols.last]) || "Never"}</span>
                ${markDoneButton(key, item.id)}
            </span>
        </li>`,
    );
    return `<ul class="item-list">${rows.join("")}</ul>`;
}

function buildPlantsHTML() {
    const rows = panelData.plants
        .filter((p) => !p.archived)
        .map((p) => {
            const lastEvent = p.last_watered_date || p.last_fertilised_date;
            return `<li class="item-row" data-open-type="plants" data-id="${p.id}">
                <span class="item-key">${escapeHTML(p.plant_name)}</span>
                <span class="item-value">
                    <span class="item-meta plant-meta">
                        ${p.pot_size ? `<span class="plant-meta-pot">${escapeHTML(p.pot_size)} cm</span>` : ""}
                        ${formatShortDate(lastEvent)}
                    </span>
                    <button class="action-btn btn-blue" data-action="plant-log" data-id="${p.id}">+</button>
                </span>
            </li>`;
        });
    return rows.length ? `<ul class="item-list">${rows.join("")}</ul>` : "";
}

function noteDeleteButton(id) {
    return `<button class="action-btn btn-red" data-action="note-delete" data-id="${id}" title="Delete note">×</button>`;
}

function buildNotesHTML() {
    const rows = panelData.notes.map(
        (
            note,
        ) => `<li class="item-row" data-open-type="notes" data-id="${note.id}">
            <span class="item-key">${escapeHTML(note.note)}</span>
            <span class="item-value">${noteDeleteButton(note.id)}</span>
        </li>`,
    );
    return `<ul class="item-list">${rows.join("")}</ul>`;
}

// ---- Full-list tables -------------------------------------------------
// The full-list modal shows a table per panel: name, extra columns, and the
// row's quick action. Columns marked `optional` are hidden on phones.
function buildDetailTable(columns, rows) {
    const colClass = (c) =>
        [c.cls, c.optional ? "col-optional" : ""].filter(Boolean).join(" ");
    const head = columns
        .map((c) => `<th class="${colClass(c)}">${c.label}</th>`)
        .join("");
    const body = rows
        .map(
            (
                r,
            ) => `<tr class="detail-row" data-open-type="${r.openType}" data-id="${r.id}">
                <td class="detail-name ${r.nameCls || ""}">${r.nameHTML}</td>
                ${r.cells.map((cell, i) => `<td class="${colClass(columns[i + 1])}">${cell}</td>`).join("")}
                <td class="detail-action">${r.action || ""}</td>
            </tr>`,
        )
        .join("");
    return `<table class="detail-table">
                <thead><tr>${head}<th class="detail-action"></th></tr></thead>
                <tbody>${body}</tbody>
            </table>`;
}

// "today", "in 3d", "3d ago" / "3d overdue" relative to today.
function formatRelativeDays(dateStr, pastLabel = "ago") {
    if (!dateStr) return "";
    const days = daysBetween(getToday(), dateStr.slice(0, 10));
    if (Number.isNaN(days)) return "";
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days > 0) return `in ${days}d`;
    if (days === -1 && pastLabel === "ago") return "yesterday";
    return `${-days}d ${pastLabel}`;
}

const EMPTY_CELL = '<span class="detail-empty">—</span>';

// Date on the first line, a secondary line (relative date by default) below.
function detailDateCell(dateStr, { pastLabel = "ago", empty, extra } = {}) {
    if (!dateStr) {
        return empty
            ? `<span class="detail-empty">${empty}</span>`
            : EMPTY_CELL;
    }
    const sub = [formatRelativeDays(dateStr, pastLabel), extra]
        .filter(Boolean)
        .join(" · ");
    return `<span class="detail-date">${formatShortDate(dateStr)}</span>
            <span class="detail-rel">${escapeHTML(sub)}</span>`;
}

function formatInterval(value, unit) {
    if (!value) return EMPTY_CELL;
    if (unit === "days") return value % 7 === 0 ? `${value / 7}w` : `${value}d`;
    return value % 12 === 0 ? `${value / 12}y` : `${value}mo`;
}

function buildRecurringFullHTML(key) {
    const { cols, labels, unit } = PANEL_CONFIGS[key].recurring;
    return buildDetailTable(
        [
            { label: labels.name },
            { label: "Every", optional: true },
            { label: labels.last, optional: true },
            { label: labels.next },
        ],
        panelData[key].map((item) => ({
            openType: key,
            id: item.id,
            nameHTML: escapeHTML(item[cols.name]),
            nameCls: getUrgencyClass(item[cols.next]),
            cells: [
                formatInterval(item[cols.interval], unit),
                detailDateCell(item[cols.last], { empty: "Never" }),
                detailDateCell(item[cols.next], { pastLabel: "overdue" }),
            ],
            action: markDoneButton(key, item.id),
        })),
    );
}

function buildPlantsFullHTML() {
    const plants = [...panelData.plants].sort(
        (a, b) => !!a.archived - !!b.archived,
    );
    return buildDetailTable(
        [
            { label: "Plant" },
            { label: "Pot", optional: true },
            { label: "Watered" },
            { label: "Fertilised", optional: true },
        ],
        plants.map((p) => ({
            openType: "plants",
            id: p.id,
            nameHTML: `${escapeHTML(p.plant_name)}${p.archived ? ' <span class="plant-archived-tag">archived</span>' : ""}`,
            nameCls: p.archived ? "detail-muted" : "",
            cells: [
                p.pot_size ? `${escapeHTML(p.pot_size)} cm` : EMPTY_CELL,
                detailDateCell(p.last_watered_date, { empty: "Never" }),
                detailDateCell(p.last_fertilised_date, {
                    empty: "Never",
                    extra: p.last_fertiliser_used,
                }),
            ],
            action: `<button class="action-btn btn-blue" data-action="plant-log" data-id="${p.id}" title="Log event">+</button>`,
        })),
    );
}

function buildNotesFullHTML() {
    return buildDetailTable(
        [{ label: "Note" }, { label: "Added", optional: true }],
        panelData.notes.map((note) => ({
            openType: "notes",
            id: note.id,
            nameHTML: escapeHTML(note.note),
            nameCls: "detail-wrap",
            cells: [detailDateCell(note.creation_date)],
            action: noteDeleteButton(note.id),
        })),
    );
}

function renderPanel(key) {
    const cfg = PANEL_CONFIGS[key];
    if (!cfg?.render) return;
    setElementHTML(cfg.render.contentId, cfg.render.panelHTML());
    if (activePanel === key) {
        setElementHTML("fullListContent", cfg.render.fullHTML());
    }
    cfg.after?.();
}

function renderAllPanels() {
    Object.values(PANEL_CONFIGS)
        .filter((cfg) => cfg.render && !cfg.renderKey)
        .forEach((cfg) => renderPanel(cfg.key));
    refreshOpenPlantDetail();
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region MODALS
// ============================================================
function openModal(id) {
    showElement(id, "flex");
}

function closeModal(id) {
    hideElement(id);
    if (id === "fullListModal") activePanel = null;
}

function openFullList(key) {
    const cfg = PANEL_CONFIGS[key];
    if (!cfg?.render) return;
    activePanel = key;
    const title = selectElement(`.panel[data-section="${key}"] h3`);
    setElementText("listTitle", title?.textContent.toUpperCase() ?? "");
    setElementHTML("fullListContent", cfg.render.fullHTML());
    refreshListMetadata();
    openModal("fullListModal");
}

function refreshListMetadata() {
    if (!activePanel) return;
    const owner = PANEL_CONFIGS[activePanel].renderKey ?? activePanel;
    setElementText(
        "listLastUpdated",
        formatMetaTimestamp(panelMetadata[owner]),
    );
}

// ---- Auto-calculated dates (next due / expiry) -------------------------
function expectedAutoDate(auto, from, interval) {
    return from && interval ? addInterval(from, interval, auto.unit) : "";
}

function computeAutoDate(auto) {
    return expectedAutoDate(
        auto,
        getElement(auto.fromId).value,
        parseInt(getElement(auto.intervalId).value, 10),
    );
}

function refreshAutoDate(key) {
    const auto = PANEL_CONFIGS[key].autoDate;
    const manual = panelState[key].manualDate;
    if (manual) hideElement(auto.autoLabelId);
    else showElement(auto.autoLabelId, "inline");
    if (!manual) setElementValue(auto.resultId, computeAutoDate(auto));
}

// The value to save: the user's override, or the calculated date.
function readAutoDate(key) {
    const auto = PANEL_CONFIGS[key].autoDate;
    const value = panelState[key].manualDate
        ? getElement(auto.resultId).value
        : computeAutoDate(auto);
    return value || null;
}

function setupAutoDateListeners(key) {
    const auto = PANEL_CONFIGS[key].autoDate;
    const fromEl = getElement(auto.fromId);
    const intervalEl = getElement(auto.intervalId);
    const resultEl = getElement(auto.resultId);

    const recalc = () => {
        if (!panelState[key].manualDate) refreshAutoDate(key);
    };
    fromEl.addEventListener("change", recalc);
    intervalEl.addEventListener("input", recalc);

    // Editing the result makes it manual unless it matches the calculation;
    // clearing it switches back to auto.
    resultEl.addEventListener("change", () => {
        panelState[key].manualDate =
            !!resultEl.value && resultEl.value !== computeAutoDate(auto);
        refreshAutoDate(key);
    });
    resultEl.addEventListener("input", () => {
        if (resultEl.value === "") {
            panelState[key].manualDate = false;
            refreshAutoDate(key);
        }
    });
}

// ---- Shared add / edit modal --------------------------------------------
function openItemModal(key, itemId = null) {
    const cfg = PANEL_CONFIGS[key];
    const modal = cfg.itemModal;
    const item = itemId ? modal.findItem(itemId) : null;
    if (itemId && !item) return;

    panelState[key].editingId = item ? item.id : null;
    setElementText(modal.titleId, item ? "Editing" : modal.addTitle);
    modal.resetFields();
    if (item) modal.populateFields(item);

    const auto = cfg.autoDate;
    if (auto) {
        // A stored date that differs from the calculation was set by hand.
        const stored = item?.[auto.resultCol];
        panelState[key].manualDate =
            !!stored &&
            stored !==
                expectedAutoDate(
                    auto,
                    item[auto.fromCol],
                    item[auto.intervalCol],
                );
        refreshAutoDate(key);
    }

    getElement(modal.deleteBtnId).hidden = !item;
    openModal(modal.modalId);
}

// ---- Plants ---------------------------------------------------------------
const DEFAULT_FERTILISER = "20-20-20";

function openPlantAddModal() {
    setElementValue("addPlantName", "");
    setElementValue("addPlantStartingDate", getToday());
    setElementValue("addPlantPotSize", "");
    openModal("plantAddModal");
}

function openPlantDetail(plantId) {
    const plant = panelData.plants.find((p) => p.id === plantId);
    if (!plant) return;
    setElementValue("pdPlantNameInput", plant.plant_name);
    setElementValue("pdStartingDate", formatDateInput(plant.starting_date));
    renderPlantDetail(plant);
    openModal("plantItemModal");
}

// Re-render the open plant detail modal from panelData (e.g. after a realtime
// change), leaving the name/start-date inputs alone so in-progress edits aren't lost.
function refreshOpenPlantDetail() {
    const modal = getElement("plantItemModal");
    const plantId = modal?.dataset.plantId;
    if (!plantId || modal.style.display === "none") return;
    const plant = panelData.plants.find((p) => p.id === plantId);
    if (plant) renderPlantDetail(plant);
    else closeModal("plantItemModal");
}

function plantHistoryRow(h) {
    const check = (yes) =>
        `<td class="${yes ? "check-yes" : "check-no"}">${yes ? "✓" : ""}</td>`;
    return `<tr>
        <td>${formatShortDate(h.event_timestamp)}</td>
        <td>${h.pot_size ? `${h.pot_size}cm` : ""}</td>
        ${check(h.watered)}
        ${check(h.fertilised)}
        <td>${escapeHTML(h.fertiliser_used)}</td>
        <td>${escapeHTML(h.event_notes)}</td>
        <td>
            <button class="action-btn btn-red plant-history-delete" data-action="plant-history-delete" data-id="${h.id}" title="Delete event">&times;</button>
        </td>
    </tr>`;
}

function renderPlantDetail(plant) {
    getElement("plantItemModal").dataset.plantId = plant.id;
    setElementText("plantItemTitle", plant.plant_name.toUpperCase());
    setElementText("pdPotSize", plant.pot_size ? `${plant.pot_size}cm` : "");
    setElementText("pdLastWatered", formatShortDate(plant.last_watered_date));
    setElementText(
        "pdLastFertilised",
        formatShortDate(plant.last_fertilised_date),
    );
    setElementText("pdFertiliserUsed", plant.last_fertiliser_used || "");

    const history = panelData.plantHistory
        .filter((h) => h.plant_id === plant.id)
        .sort(
            (a, b) => new Date(b.event_timestamp) - new Date(a.event_timestamp),
        );
    setElementHTML(
        "pdHistoryBody",
        history.length
            ? history.map(plantHistoryRow).join("")
            : '<tr><td colspan="7" class="plant-history-empty">No history yet</td></tr>',
    );

    ["pdSaveNameBtn", "pdLogEventBtn", "pdArchiveBtn", "pdDeleteBtn"].forEach(
        (id) => (getElement(id).dataset.id = plant.id),
    );
    const archiveBtn = getElement("pdArchiveBtn");
    archiveBtn.textContent = plant.archived ? "Unarchive" : "Archive";
    archiveBtn.classList.toggle("is-archived", !!plant.archived);
}

function openPlantEventModal(plantId) {
    const plant = panelData.plants.find((p) => p.id === plantId);
    if (!plant) return;
    setElementText("plantEventTitle", plant.plant_name.toUpperCase());
    setElementValue("plantEventId", plantId);
    setElementValue("plantEventDate", getToday());
    setElementChecked("wateredCheck", false);
    setElementChecked("fertilisedCheck", false);
    hideElement("fertiliserSelectWrap");
    setElementValue("fertiliserSelect", DEFAULT_FERTILISER);
    setElementValue("plantEventPotSize", plant.pot_size || "");
    setElementValue("plantEventNotes", "");
    openModal("plantEventModal");
}

// ---- Notes ----------------------------------------------------------------
function openNoteModal(note = null) {
    panelState.notes.editingId = note?.id ?? null;
    setElementText("noteModalTitle", note ? "Edit Note" : "Add New Note");
    setElementValue("addNoteContent", note?.note ?? "");
    openModal("noteAddModal");
}

function openNoteAddModal() {
    openNoteModal();
}

function openNoteEditModal(id) {
    const note = panelData.notes.find((n) => n.id === id);
    if (note) openNoteModal(note);
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region PANEL ACTIONS
// ============================================================
function setupPanelEvents() {
    selectAllElements(".panel-header").forEach((header) => {
        header.addEventListener("click", () => {
            const key = header.closest(".panel").dataset.section;
            if (PANEL_CONFIGS[key]) openFullList(key);
        });
    });

    selectAllElements(".panel .add-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const key = btn.closest(".panel").dataset.section;
            PANEL_CONFIGS[key]?.functions.addItem();
        });
    });

    getElement("fullListAddBtn").addEventListener("click", () => {
        PANEL_CONFIGS[activePanel]?.functions.addItem();
    });
}

// Wrap every <input type="date" data-today> with a "Today" quick-fill button.
// Fires input + change so auto-date listeners recalculate as if typed.
function setupTodayButtons() {
    selectAllElements("input[type='date'][data-today]").forEach((input) => {
        const wrap = document.createElement("div");
        wrap.className = "date-field";
        input.replaceWith(wrap);
        wrap.appendChild(input);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "today-btn btn-blue";
        btn.textContent = "Today";
        btn.addEventListener("click", () => {
            input.value = getToday();
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        wrap.appendChild(btn);
    });
}

// Save / delete for every panel that uses the shared item modal.
function setupItemForms() {
    Object.values(PANEL_CONFIGS)
        .filter((cfg) => cfg.form)
        .forEach((cfg) => {
            const { key, form, itemModal } = cfg;
            const table = cfg.data.table;
            const done = () => {
                closeModal(itemModal.modalId);
                panelState[key].editingId = null;
                panelState[key].manualDate = false;
            };

            if (cfg.autoDate) setupAutoDateListeners(key);

            getElement(form.formId).addEventListener("submit", async (e) => {
                e.preventDefault();
                const id = panelState[key].editingId;
                const record = { ...form.buildRecord(), ...(id && { id }) };
                const ok = await withBusy(e.submitter, () =>
                    saveRecord(table, record),
                );
                if (ok) done();
            });

            const deleteBtn = getElement(itemModal.deleteBtnId);
            deleteBtn.addEventListener("click", async () => {
                const id = panelState[key].editingId;
                if (!id) return;
                const ok = await withBusy(deleteBtn, () =>
                    deleteRecord(table, id, cfg.deleteMsg),
                );
                if (ok) done();
            });
        });
}

function setupPlantForms() {
    getElement("addPlantForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = getElement("addPlantName").value.trim();
        if (!name) return;
        const ok = await withBusy(e.submitter, () =>
            saveRecord("plants_db", {
                plant_name: name,
                starting_date: getElement("addPlantStartingDate").value || null,
                pot_size:
                    parseInt(getElement("addPlantPotSize").value, 10) || null,
                archived: false,
            }),
        );
        if (ok) closeModal("plantAddModal");
    });

    const fertilisedCheck = getElement("fertilisedCheck");
    fertilisedCheck.addEventListener("change", () => {
        const show = fertilisedCheck.checked;
        getElement("fertiliserSelectWrap").style.display = show ? "" : "none";
        if (!show) setElementValue("fertiliserSelect", DEFAULT_FERTILISER);
    });

    getElement("plantEventForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const plant = panelData.plants.find(
            (p) => p.id === getElement("plantEventId").value,
        );
        const eventDate = getElement("plantEventDate").value;
        const watered = getElement("wateredCheck").checked;
        const fertilised = fertilisedCheck.checked;
        const fertiliserUsed = fertilised
            ? getElement("fertiliserSelect").value || null
            : null;
        const potSizeRaw = getElement("plantEventPotSize").value;
        const potSize = potSizeRaw === "" ? null : parseInt(potSizeRaw, 10);
        const notes = getElement("plantEventNotes").value.trim() || null;

        if (!plant) return showToast("Plant not found", "error");
        if (!eventDate) {
            return showToast("Please choose an event date", "error");
        }
        // The pot size field is prefilled, so it only counts as an event
        // detail when it actually changed.
        const potChanged =
            potSize !== null && potSize !== (plant.pot_size ?? null);
        if (!watered && !fertilised && !potChanged && !notes) {
            return showToast("Please log at least one event detail", "error");
        }
        // plant_history_db.pot_size is NOT NULL
        const historyPotSize = potSize ?? plant.pot_size ?? null;
        if (historyPotSize === null) {
            return showToast("Please enter the pot size", "error");
        }

        // A backdated event must not overwrite a more recent "last" date.
        const isNewer = (prev) => !prev || eventDate >= prev.slice(0, 10);
        const plantUpdates = { id: plant.id, pot_size: historyPotSize };
        if (watered && isNewer(plant.last_watered_date)) {
            plantUpdates.last_watered_date = eventDate;
        }
        if (fertilised && isNewer(plant.last_fertilised_date)) {
            plantUpdates.last_fertilised_date = eventDate;
            plantUpdates.last_fertiliser_used = fertiliserUsed;
        }

        // History first: if it fails, the plant's "last" dates stay untouched.
        const ok = await withBusy(
            e.submitter,
            async () =>
                (await saveRecord("plant_history_db", {
                    plant_id: plant.id,
                    event_timestamp: eventDate,
                    watered,
                    fertilised,
                    fertiliser_used: fertiliserUsed,
                    pot_size: historyPotSize,
                    event_notes: notes,
                })) && saveRecord("plants_db", plantUpdates),
        );
        if (!ok) return;
        closeModal("plantEventModal");
        openPlantDetail(plant.id);
    });
}

function setupNoteForm() {
    getElement("addNoteForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const note = getElement("addNoteContent").value.trim();
        if (!note) return;
        const id = panelState.notes.editingId;
        const ok = await withBusy(e.submitter, () =>
            saveRecord("notes_db", {
                ...(id && { id }),
                note,
                creation_date: getToday(),
            }),
        );
        if (!ok) return;
        panelState.notes.editingId = null;
        closeModal("noteAddModal");
    });
}

function setupFormHandlers() {
    setupItemForms();
    setupPlantForms();
    setupNoteForm();
}

// Buttons with data-action="name" run ACTION_HANDLERS[name](button).
const ACTION_HANDLERS = {
    "meal-prep-portions": async (btn) => {
        const item = panelData.pantry.find((i) => i.id === btn.dataset.id);
        if (!item) return;
        const delta = parseInt(btn.dataset.delta, 10) || 0;
        const portions = Math.max(0, (item.portions || 0) + delta);
        if (portions === item.portions) return;
        // Optimistic: update immediately; runMutation resyncs if the write fails.
        item.portions = portions;
        renderPanel("mealPrep");
        await saveRecord("pantry_db", {
            id: item.id,
            portions,
            last_updated_date: getToday(),
        });
    },

    // ✓ on chores / bills / change log: set the last date and roll the next.
    "mark-done": async (btn) => {
        const cfg = PANEL_CONFIGS[btn.dataset.panel];
        const item = cfg?.itemModal.findItem(btn.dataset.id);
        if (!item) return;
        const { cols, unit, doneDate } = cfg.recurring;
        const last = doneDate(item);
        const interval = item[cols.interval];
        await saveRecord(cfg.data.table, {
            id: item.id,
            [cols.last]: last,
            [cols.next]: interval ? addInterval(last, interval, unit) : null,
        });
    },

    "plant-log": async (btn) => openPlantEventModal(btn.dataset.id),

    "plant-save-name": async (btn) => {
        const name = getElement("pdPlantNameInput").value.trim();
        if (!name) return showToast("Plant name cannot be empty", "error");
        const ok = await saveRecord("plants_db", {
            id: btn.dataset.id,
            plant_name: name,
            starting_date: getElement("pdStartingDate").value || null,
        });
        if (ok) showToast("Saved", "success");
    },

    "plant-archive": async (btn) => {
        const plant = panelData.plants.find((p) => p.id === btn.dataset.id);
        if (!plant) return;
        const archive = !plant.archived;
        const verb = archive ? "Archive" : "Unarchive";
        const ok = await confirmDialog(`${verb} "${plant.plant_name}"?`, {
            confirmText: verb,
        });
        if (ok)
            await saveRecord("plants_db", { id: plant.id, archived: archive });
    },

    "plant-delete": async (btn) => {
        if (await deletePlant(btn.dataset.id)) closeModal("plantItemModal");
    },

    "plant-history-delete": async (btn) => {
        await deleteRecord(
            "plant_history_db",
            btn.dataset.id,
            "Delete this event permanently?",
        );
    },

    "note-delete": async (btn) => {
        await deleteRecord(
            "notes_db",
            btn.dataset.id,
            PANEL_CONFIGS.notes.deleteMsg,
        );
    },
};

// One delegated listener: action buttons first, otherwise a click on a row
// opens that item.
document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    const handler = btn && ACTION_HANDLERS[btn.dataset.action];
    if (handler) {
        try {
            await withBusy(btn, () => handler(btn));
        } catch (err) {
            console.error(`Action "${btn.dataset.action}" failed:`, err);
            showToast(err.message || "Action failed", "error");
        }
        return;
    }

    const row = e.target.closest("[data-open-type][data-id]");
    if (row)
        PANEL_CONFIGS[row.dataset.openType]?.functions.editItem(row.dataset.id);
});
// ============================================================
// #endregion
// ============================================================
