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
                return panelState.mealPrep.manualDate;
            },
            setManual: (v) => (panelState.mealPrep.manualDate = v),
            clearResult: () => setElementValue("mealPrepExpiryDate", ""),
        },

        form: {
            formId: "mealPrepForm",
            buildRecord: (isUpdate) => {
                const shelfLifeDays =
                    parseInt(getElement("mealPrepShelfLife").value, 10) || null;
                const createdAt = getElement("mealPrepCreatedAt").value || null;
                const expiryDate = panelState.mealPrep.manualDate
                    ? getElement("mealPrepExpiryDate").value || null
                    : createdAt && shelfLifeDays
                      ? addDays(createdAt, shelfLifeDays)
                      : null;

                return {
                    id: isUpdate ? panelState.mealPrep.editingId : null,
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
            panelHTML: buildPlantsHTML,
            fullHTML: buildPlantsFullHTML,
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
            fullHTML: buildNotesFullHTML,
        },

        functions: {
            addItem: openNoteAddModal,
            editItem: (id) => openNoteEditModal(id),
        },
    },
};
// ============================================================
// #endregion
// ============================================================
