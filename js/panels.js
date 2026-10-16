// ============================================================
// #region PANEL BUILDERS
// ============================================================
function getUrgencyClass(dateStr, warningDays = 3) {
    if (!dateStr) return "";
    const daysLeft = daysBetween(getTodayHKT(), dateStr.slice(0, 10));
    if (Number.isNaN(daysLeft)) return "";
    if (daysLeft < 0) return "danger";
    if (daysLeft <= warningDays) return "warning";
    return "";
}

// `full` (full-list modal) also shows zero-portion items and the expiry date.
function fridgeItemRow(item, full = false) {
    const showZero = full;
    const expiryClass = getUrgencyClass(item.expiration_date, 7);
    const portionClass =
        item.portions === 0 && showZero ? "portion-zero" : "portion-number";
    const portionsDisplay = `<span class="${portionClass}">${item.portions}</span>`;
    const zeroClass = item.portions === 0 ? " zero-portions" : "";
    return `<li class="item-row${zeroClass}" data-open-type="fridgeStock" data-id="${item.id}">
                <span class="item-key ${expiryClass}">${escapeHTML(item.food_name)}</span>
                <span class="item-value">
                    ${full ? `<span class="item-meta expiry-meta ${expiryClass}" title="Expiry date">${item.expiration_date ? formatShortDate(item.expiration_date) : "—"}</span>` : ""}
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
                    <span class="item-key ${dueClass}">${escapeHTML(chore.task_name)}</span>
                    <span class="item-value">
                        <span class="item-meta">${lastDoneText}</span>
                        <button class="action-btn btn-green" data-action="done" data-id="${chore.id}">✓</button>
                    </span>
                </li>`;
    });
    html += "</ul>";
    return html;
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

// "today", "in 3d", "3d ago" / "3d overdue" relative to today (UTC+8).
function formatRelativeDays(dateStr, pastLabel = "ago") {
    if (!dateStr) return "";
    const days = daysBetween(getTodayHKT(), dateStr.slice(0, 10));
    if (Number.isNaN(days)) return "";
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days > 0) return `in ${days}d`;
    if (days === -1 && pastLabel === "ago") return "yesterday";
    return `${-days}d ${pastLabel}`;
}

function detailDateCell(dateStr, pastLabel = "ago", emptyText = "—") {
    if (!dateStr) return `<span class="detail-empty">${emptyText}</span>`;
    return `<span class="detail-date">${formatShortDate(dateStr)}</span>
            <span class="detail-rel">${formatRelativeDays(dateStr, pastLabel)}</span>`;
}

function formatInterval(value, unit) {
    if (!value) return '<span class="detail-empty">—</span>';
    if (unit === "days") return value % 7 === 0 ? `${value / 7}w` : `${value}d`;
    return value % 12 === 0 ? `${value / 12}y` : `${value}mo`;
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

function buildChoresHTML() {
    return buildDetailTable(
        [
            { label: "Task" },
            { label: "Every", optional: true },
            { label: "Last done", optional: true },
            { label: "Next due" },
        ],
        panelData.chores.map((chore) => ({
            openType: "chores",
            id: chore.id,
            nameHTML: escapeHTML(chore.task_name),
            nameCls: getUrgencyClass(chore.next_due_date),
            cells: [
                formatInterval(chore.chore_interval_days, "days"),
                detailDateCell(chore.last_done_date, "ago", "Never"),
                detailDateCell(chore.next_due_date, "overdue"),
            ],
            action: `<button class="action-btn btn-green" data-action="done" data-id="${chore.id}" title="Mark done">✓</button>`,
        })),
    );
}

function buildBillsPanel() {
    applyHeaderUrgency(
        "billsHeader",
        panelData.bills.map((b) => b.next_bill_date),
    );
    return "";
}

function buildBillsHTML() {
    buildBillsPanel();
    return buildDetailTable(
        [
            { label: "Bill" },
            { label: "Every", optional: true },
            { label: "Last bill", optional: true },
            { label: "Next bill" },
        ],
        panelData.bills.map((bill) => ({
            openType: "bills",
            id: bill.id,
            nameHTML: escapeHTML(bill.bill_name),
            nameCls: getUrgencyClass(bill.next_bill_date),
            cells: [
                formatInterval(bill.bill_interval_months, "months"),
                detailDateCell(bill.last_bill_date),
                detailDateCell(bill.next_bill_date, "overdue"),
            ],
            action: `<button class="action-btn btn-green" data-action="paid" data-id="${bill.id}" title="Mark paid">✓</button>`,
        })),
    );
}

function buildChangeLogPanel() {
    applyHeaderUrgency(
        "changeLogHeader",
        panelData.changeLog.map((c) => c.next_change_date),
    );
    return "";
}

function buildChangeLogHTML() {
    buildChangeLogPanel();
    return buildDetailTable(
        [
            { label: "Item" },
            { label: "Every", optional: true },
            { label: "Last changed", optional: true },
            { label: "Next change" },
        ],
        panelData.changeLog.map((cl) => ({
            openType: "changeLog",
            id: cl.id,
            nameHTML: escapeHTML(cl.item_name),
            nameCls: getUrgencyClass(cl.next_change_date),
            cells: [
                formatInterval(cl.change_interval_months, "months"),
                detailDateCell(cl.last_changed_date, "ago", "Never"),
                detailDateCell(cl.next_change_date, "overdue"),
            ],
            action: `<button class="action-btn btn-green" data-action="changed" data-id="${cl.id}" title="Mark changed">✓</button>`,
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
                p.pot_size
                    ? `${escapeHTML(p.pot_size)} cm`
                    : '<span class="detail-empty">—</span>',
                detailDateCell(p.last_watered_date, "ago", "Never"),
                p.last_fertilised_date
                    ? `<span class="detail-date">${formatShortDate(p.last_fertilised_date)}</span>
                       <span class="detail-rel">${[formatRelativeDays(p.last_fertilised_date), escapeHTML(p.last_fertiliser_used)].filter(Boolean).join(" · ")}</span>`
                    : '<span class="detail-empty">Never</span>',
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
            action: `<button class="action-btn btn-red" data-action="note-delete" data-id="${note.id}" title="Delete note">×</button>`,
        })),
    );
}

function buildPlantsHTML() {
    const visible = panelData.plants.filter((p) => !p.archived);
    if (!visible.length) return "";
    let html = '<ul class="item-list">';
    visible.forEach((p) => {
        const lastEvent = p.last_watered_date || p.last_fertilised_date;
        const lastEventText = lastEvent ? formatShortDate(lastEvent) : "";
        html += `<li class="item-row" data-open-type="plants" data-id="${p.id}">
                    <span class="item-key">${escapeHTML(p.plant_name)}${p.archived ? ' <span class="plant-archived-tag">archived</span>' : ""}</span>
                    <span class="item-value">
                        <span class="item-meta plant-meta">
                            ${p.pot_size ? `<span class="plant-meta-pot">${escapeHTML(p.pot_size)} cm</span>` : ""}
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
        html += `<li class="item-row" data-open-type="notes" data-id="${note.id}">
                    <span class="item-key">${escapeHTML(note.note)}</span>
                    <span class="item-value">
                    <span class="item-meta">&nbsp;</span>
                    <button class="action-btn btn-red" data-action="note-delete" data-id="${note.id}" title="Delete note">×</button>
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

function renderAllPanels() {
    ["mealPrep", "chores", "changeLog", "bills", "plants", "notes"].forEach(
        renderPanel,
    );
    refreshOpenPlantDetail();
}

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
    setElementValue("pdPlantNameInput", plant.plant_name);
    setElementValue(
        "pdStartingDate",
        plant.starting_date ? formatDateInput(plant.starting_date) : "",
    );
    renderPlantDetail(plantId);
    openModal("plantItemModal");
}

// Re-render the open plant detail modal from panelData (e.g. after a realtime
// change), leaving the name/start-date inputs alone so in-progress edits aren't lost.
function refreshOpenPlantDetail() {
    const modal = getElement("plantItemModal");
    const plantId = modal?.dataset.plantId;
    if (!plantId || modal.style.display === "none") return;
    if (!panelData.plants.some((p) => p.id === plantId)) {
        closeModal("plantItemModal");
        return;
    }
    renderPlantDetail(plantId);
}

function renderPlantDetail(plantId) {
    const plant = panelData.plants.find((p) => p.id === plantId);
    if (!plant) return;
    getElement("plantItemModal").dataset.plantId = plantId;
    setElementText("plantItemTitle", plant.plant_name.toUpperCase());
    getElement("pdSaveNameBtn").dataset.id = plantId;
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
                                <td>${escapeHTML(h.fertiliser_used)}</td>
                                <td>${escapeHTML(h.event_notes)}</td>
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

function openNoteAddModal() {
    panelState.notes.editingId = null;
    setElementText("noteModalTitle", "Add New Note");
    setElementValue("addNoteContent", "");
    openModal("noteAddModal");
}

function openNoteEditModal(id) {
    const note = panelData.notes.find((n) => n.id === id);
    if (!note) return;
    panelState.notes.editingId = id;
    setElementText("noteModalTitle", "Edit Note");
    setElementValue("addNoteContent", note.note);
    openModal("noteAddModal");
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

// Wrap every <input type="date" data-today> with a "Today" quick-fill button.
// Fires input + change so auto-date listeners recalculate as if typed.
function setupTodayButtons() {
    selectAllElements("input[type='date'][data-today]").forEach((input) => {
        if (input.parentElement.classList.contains("date-field")) return;
        const wrap = document.createElement("div");
        wrap.className = "date-field";
        input.replaceWith(wrap);
        wrap.appendChild(input);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "today-btn btn-blue";
        btn.textContent = "Today";
        btn.addEventListener("click", () => {
            input.value = getTodayHKT();
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        wrap.appendChild(btn);
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

                const ok = await withBusy(e.submitter, () =>
                    saveRecord(
                        panelCfg.data.table,
                        renderKey,
                        record,
                        isUpdate,
                        () => {
                            if (panel && panelState[panel]) {
                                panelState[panel].manualDate = false;
                            }
                        },
                    ),
                );
                if (!ok) return;

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

                const ok = await withBusy(btn, () =>
                    deleteRecord(
                        panelCfg.data.table,
                        renderKey,
                        itemId,
                        panelCfg.deleteMsg,
                    ),
                );
                if (!ok) return;

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

            const ok = await withBusy(e.submitter, () =>
                saveRecord(
                    "plants_db",
                    "plants",
                    {
                        plant_name: name,
                        starting_date: startingDate,
                        pot_size: potSize,
                        archived: false,
                    },
                    false,
                ),
            );
            if (ok) closeModal("plantAddModal");
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
                showToast("Missing plant id", "error");
                return;
            }

            if (!eventDate) {
                showToast("Please choose an event date", "error");
                return;
            }

            const plant = panelData.plants.find((p) => p.id === plantId);
            if (!plant) {
                showToast("Plant not found", "error");
                return;
            }

            // The pot size field is prefilled, so it only counts as an event
            // detail when it actually changed.
            const potChanged =
                potSize !== null && potSize !== (plant.pot_size ?? null);
            if (!watered && !fertilised && !potChanged && !notes) {
                showToast("Please log at least one event detail", "error");
                return;
            }

            // plant_history_db.pot_size is NOT NULL
            const historyPotSize = potSize ?? plant.pot_size ?? null;
            if (historyPotSize === null) {
                showToast("Please enter the pot size", "error");
                return;
            }

            const plantUpdates = {
                id: plantId,
                plant_name: plant.plant_name,
                starting_date: plant.starting_date,
                archived: !!plant.archived,
                pot_size: potSize !== null ? potSize : (plant.pot_size ?? null),
            };

            // A backdated event must not overwrite a more recent "last" date.
            const isNewer = (prev) => !prev || eventDate >= prev.slice(0, 10);

            plantUpdates.last_watered_date =
                watered && isNewer(plant.last_watered_date)
                    ? eventDate
                    : plant.last_watered_date || null;

            if (fertilised && isNewer(plant.last_fertilised_date)) {
                plantUpdates.last_fertilised_date = eventDate;
                plantUpdates.last_fertiliser_used = fertiliserUsed;
            } else {
                plantUpdates.last_fertilised_date =
                    plant.last_fertilised_date || null;
                plantUpdates.last_fertiliser_used =
                    plant.last_fertiliser_used || null;
            }

            const ok = await withBusy(e.submitter, async () => {
                // History first: if it fails, the plant's "last" dates stay untouched.
                const saved = await savePlantHistory({
                    plant_id: plantId,
                    event_timestamp: eventDate,
                    watered,
                    fertilised,
                    fertiliser_used: fertiliserUsed,
                    pot_size: historyPotSize,
                    event_notes: notes,
                });
                return (
                    saved &&
                    saveRecord("plants_db", "plants", plantUpdates, true)
                );
            });
            if (!ok) return;

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
            const editingId = panelState.notes?.editingId;
            const record = { note: noteContent, creation_date: getTodayHKT() };
            if (editingId) record.id = editingId;
            const ok = await withBusy(e.submitter, () =>
                saveRecord("notes_db", "notes", record, !!editingId),
            );
            if (!ok) return;
            panelState.notes.editingId = null;
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
        if (newPortions === item.portions) return;
        // Optimistic: update immediately; runMutation resyncs if the write fails.
        item.portions = newPortions;
        renderPanel("mealPrep");
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
        const paidDate = bill.next_bill_date || getTodayHKT();
        await saveRecord(
            "bills_db",
            "bills",
            {
                id,
                bill_name: bill.bill_name,
                last_bill_date: paidDate,
                bill_interval_months: bill.bill_interval_months,
                next_bill_date: bill.bill_interval_months
                    ? addMonths(paidDate, bill.bill_interval_months)
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
            showToast("Plant name cannot be empty", "error");
            return;
        }
        const ok = await saveRecord(
            "plants_db",
            "plants",
            {
                id,
                plant_name: newName,
                starting_date: newStart,
            },
            true,
        );
        if (ok) {
            openPlantDetail(id);
            showToast("Saved", "success");
        }
    },

    "plant-archive": async (btn) => {
        const id = btn.dataset.id;
        if (!id) return;
        const plant = panelData.plants.find((p) => p.id === id);
        if (!plant) return;
        const archiveNow = !plant.archived;
        const ok = await confirmDialog(
            archiveNow
                ? `Archive "${plant.plant_name}"?`
                : `Unarchive "${plant.plant_name}"?`,
            { confirmText: archiveNow ? "Archive" : "Unarchive" },
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
        if (await deletePlant(id)) closeModal("plantItemModal");
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
                await withBusy(btn, () => handler(btn));
            } catch (err) {
                console.error(`Action "${action}" failed:`, err);
                showToast(err.message || "Action failed", "error");
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
