// ============================================================
// #region PANEL CONFIGS
// ============================================================
// Each panel config may define:
//   data      – Supabase table to load and where to store the rows
//   render    – content element + builders for the panel and full-list views
//   functions – what the panel's "+" button and a row click open
//   itemModal – the shared add/edit modal (see openItemModal)
//   autoDate  – a date field auto-calculated as `from + interval`; the user can
//               override it, tracked in panelState[key].manualDate
//   form      – form id + buildRecord() for saving the modal

// Chores, bills and the change log share one shape: a name, a last date, an
// interval and a next date auto-calculated from the other two.
function recurringPanel(spec) {
    const { key, prefix, cols, ids } = spec;
    return {
        key,
        deleteMsg: spec.deleteMsg,
        recurring: spec,

        data: {
            table: spec.table,
            store: (rows) => {
                panelData[key] = rows;
            },
            orderCol: cols.name,
        },

        render: {
            contentId: `${key}Content`,
            panelHTML: () => buildRecurringPanelHTML(key),
            fullHTML: () => buildRecurringFullHTML(key),
        },

        functions: {
            addItem: () => openItemModal(key),
            editItem: (id) => openItemModal(key, id),
        },

        itemModal: {
            modalId: `${prefix}ItemModal`,
            titleId: `${prefix}ItemTitle`,
            deleteBtnId: `${prefix}DeleteBtn`,
            addTitle: spec.addTitle,
            resetFields: () => {
                setElementValue(ids.name, "");
                setElementValue(ids.last, "");
                setElementValue(ids.interval, String(spec.defaultInterval));
                setElementValue(ids.next, "");
            },
            findItem: (id) => panelData[key].find((i) => i.id === id),
            populateFields: (item) => {
                setElementValue(ids.name, item[cols.name]);
                setElementValue(ids.last, formatDateInput(item[cols.last]));
                setElementValue(
                    ids.interval,
                    item[cols.interval] || spec.defaultInterval,
                );
                setElementValue(ids.next, formatDateInput(item[cols.next]));
            },
        },

        autoDate: {
            fromId: ids.last,
            intervalId: ids.interval,
            resultId: ids.next,
            autoLabelId: spec.autoLabelId,
            unit: spec.unit,
            fromCol: cols.last,
            intervalCol: cols.interval,
            resultCol: cols.next,
        },

        form: {
            formId: `${prefix}Form`,
            buildRecord: () => ({
                [cols.name]: getElement(ids.name).value.trim(),
                [cols.last]: getElement(ids.last).value || null,
                [cols.interval]:
                    parseInt(getElement(ids.interval).value, 10) || null,
                [cols.next]: readAutoDate(key),
            }),
        },
    };
}

const PANEL_CONFIGS = {
    mealPrep: {
        key: "mealPrep",
        after: () => renderPanel("fridgeStock"),
        deleteMsg: "Delete this pantry item permanently?",

        data: {
            table: "pantry_db",
            store: (rows) => {
                panelData.pantry = rows;
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
            deleteBtnId: "mealPrepDeleteBtn",
            addTitle: "Add new pantry item",
            resetFields: () => {
                setElementValue("mealPrepItemName", "");
                setElementValue("mealPrepCategory", "Carbs");
                setElementValue("mealPrepPortions", "1");
                setElementValue("mealPrepShelfLife", "");
                setElementValue("mealPrepCreatedAt", getToday());
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
                    formatShortDate(item.last_updated_date),
                );
            },
        },

        autoDate: {
            fromId: "mealPrepCreatedAt",
            intervalId: "mealPrepShelfLife",
            resultId: "mealPrepExpiryDate",
            autoLabelId: "expiryAutoLabel",
            unit: "days",
            fromCol: "creation_date",
            intervalCol: "shelf_life_days",
            resultCol: "expiration_date",
        },

        form: {
            formId: "mealPrepForm",
            buildRecord: () => ({
                food_name: getElement("mealPrepItemName").value.trim(),
                category: getElement("mealPrepCategory").value,
                portions:
                    parseInt(getElement("mealPrepPortions").value, 10) || 0,
                shelf_life_days:
                    parseInt(getElement("mealPrepShelfLife").value, 10) || null,
                creation_date: getElement("mealPrepCreatedAt").value || null,
                expiration_date: readAutoDate("mealPrep"),
                last_updated_date: getToday(),
            }),
        },
    },

    // Same pantry_db rows as meal prep, filtered to the fridge categories.
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

    chores: recurringPanel({
        key: "chores",
        prefix: "chore",
        table: "chores_db",
        unit: "days",
        defaultInterval: 7,
        cols: {
            name: "task_name",
            last: "last_done_date",
            interval: "chore_interval_days",
            next: "next_due_date",
        },
        ids: {
            name: "choreTaskName",
            last: "choreLastDoneDate",
            interval: "choreIntervalDays",
            next: "choreNextDueDate",
        },
        autoLabelId: "nextDueAutoLabel",
        labels: { name: "Task", last: "Last done", next: "Next due" },
        addTitle: "Add new task",
        deleteMsg: "Delete this task permanently?",
        doneTitle: "Mark done",
        // Chores list their items on the dashboard; the others only colour
        // their header by urgency.
        showList: true,
        doneDate: () => getToday(),
    }),

    bills: recurringPanel({
        key: "bills",
        prefix: "bill",
        table: "bills_db",
        unit: "months",
        defaultInterval: 1,
        cols: {
            name: "bill_name",
            last: "last_bill_date",
            interval: "bill_interval_months",
            next: "next_bill_date",
        },
        ids: {
            name: "billBillName",
            last: "billLastBillDate",
            interval: "billIntervalMonths",
            next: "billNextBillDate",
        },
        autoLabelId: "nextBillAutoLabel",
        labels: { name: "Bill", last: "Last bill", next: "Next bill" },
        addTitle: "Add new bill",
        deleteMsg: "Delete this bill permanently?",
        doneTitle: "Mark paid",
        // A bill is paid for its due date, so paying early or late keeps the
        // billing cycle on the same day of the month.
        doneDate: (bill) => bill.next_bill_date || getToday(),
    }),

    changeLog: recurringPanel({
        key: "changeLog",
        prefix: "changeLog",
        table: "change_log_db",
        unit: "months",
        defaultInterval: 3,
        cols: {
            name: "item_name",
            last: "last_changed_date",
            interval: "change_interval_months",
            next: "next_change_date",
        },
        ids: {
            name: "changeLogItemName",
            last: "changeLogLastChanged",
            interval: "changeLogIntervalMonths",
            next: "changeLogNextChangeDate",
        },
        autoLabelId: "nextChangeAutoLabel",
        labels: { name: "Item", last: "Last changed", next: "Next change" },
        addTitle: "Add new change item",
        deleteMsg: "Delete this change item permanently?",
        doneTitle: "Mark changed",
        doneDate: () => getToday(),
    }),

    plants: {
        key: "plants",

        data: {
            table: "plants_db",
            store: (rows) => {
                panelData.plants = rows;
            },
            orderCol: "plant_name",
        },

        render: {
            contentId: "plantsContent",
            panelHTML: buildPlantsHTML,
            fullHTML: buildPlantsFullHTML,
        },

        functions: {
            addItem: openPlantAddModal,
            editItem: openPlantDetail,
        },
    },

    // Loaded alongside plants; has no panel of its own.
    plantHistory: {
        key: "plants",

        data: {
            table: "plant_history_db",
            store: (rows) => {
                panelData.plantHistory = rows;
            },
            orderCol: "event_timestamp",
            orderAscending: false,
            orderNulls: { nullsLast: true },
            // No user_id column; RLS scopes rows through plants_db.
            noUserFilter: true,
        },
    },

    notes: {
        key: "notes",
        deleteMsg: "Delete this note permanently?",

        data: {
            table: "notes_db",
            store: (rows) => {
                panelData.notes = rows;
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
            editItem: openNoteEditModal,
        },
    },
};
// ============================================================
// #endregion
// ============================================================
