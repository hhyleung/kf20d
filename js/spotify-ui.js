// ============================================================
// #region SPOTIFY RENDERERS
// ============================================================
const DEFAULT_SLOT_ICON = ICONS[0];

function renderNowPlaying(state) {
    const track = state?.track_window?.current_track;
    const img = track?.album?.images?.[0]?.url;
    const artEl = getElement("spotifyArt");
    artEl.style.backgroundImage = img ? `url(${img})` : "";
    selectElement(".spotify-art-placeholder", artEl).style.display = img
        ? "none"
        : "flex";
    setElementText("spotifyTitle", track?.name ?? "—");
    setElementText(
        "spotifyArtist",
        track ? track.artists.map((a) => a.name).join(", ") : "—",
    );
    setElementText("spotifyPlayBtn", track && !state.paused ? "❚❚" : "▶");
}

// Shortcut buttons on the panel and the slot picker in the playlist modal.
async function renderSlots() {
    playlistSlots = await loadPlaylists();
    const slotRow = (btn) =>
        playlistSlots.find((r) => r.slot_number === Number(btn.dataset.slot));
    selectAllElements(".spotify-slot-btn").forEach((btn) => {
        const row = slotRow(btn);
        btn.textContent = row?.playlist_icon || DEFAULT_SLOT_ICON;
        btn.dataset.playlistId = row?.playlist_id || "";
    });
    selectAllElements(".spotify-slot-pick-btn").forEach((btn) => {
        const row = slotRow(btn);
        btn.textContent = row?.playlist_icon || DEFAULT_SLOT_ICON;
        btn.classList.toggle("has-playlist", !!row?.playlist_id);
    });
}

function renderNextSchedule() {
    const next = getNextSchedule();
    setElementText("spotifySchedDate", formatShortDate(next?.scheduled_date));
    setElementText("spotifySchedTime", next?.scheduled_time?.slice(0, 5) ?? "");
    setElementText(
        "spotifySchedPlaylist",
        next ? next.playlist_name || "Untitled" : "No upcoming schedules",
    );
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
    const startOffset = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = getToday();

    let html = '<div class="spotify-calendar-cell empty"></div>'.repeat(
        startOffset,
    );
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const types = new Set(
            schedules
                .filter((s) => s.scheduled_date === dateStr && !s.triggered)
                .map((s) => s.schedule_type),
        );
        const dots = ["weekly", "shift", "once"]
            .filter((t) => types.has(t))
            .map((t) => `<span class="cal-dot dot-${t}"></span>`)
            .join("");
        const cls = [
            dateStr === today && "today",
            dateStr === spotifySelectedDate && "selected",
        ]
            .filter(Boolean)
            .join(" ");
        html += `<button type="button" class="spotify-calendar-cell ${cls}" data-date="${dateStr}">
                ${day}
                ${dots ? `<div class="cal-dots">${dots}</div>` : ""}
            </button>`;
    }
    setElementHTML("spotifyCalendarGrid", html);
}

function renderSchedule(dateStr) {
    setElementText("spotifySelectedDateLabel", dateStr);
    const items = schedules.filter((s) => s.scheduled_date === dateStr);
    if (!items.some((s) => s.id === spotifySelectedSchedule?.id)) {
        spotifySelectedSchedule = null;
    }
    setElementHTML(
        "spotifyDaySchedules",
        items.length
            ? items
                  .map(
                      (item) => `
            <div class="spotify-day-row ${spotifySelectedSchedule?.id === item.id ? "selected" : ""}" data-id="${item.id}">
                <div class="spotify-day-row-title">${item.scheduled_time?.slice(0, 5) ?? ""} ${escapeHTML(item.playlist_name || "Untitled")}</div>
                <div class="spotify-day-row-meta">${escapeHTML(item.schedule_type)}</div>
            </div>`,
                  )
                  .join("")
            : `<div class="spotify-day-row">
                <div class="spotify-day-row-meta">No schedules for this day.</div>
            </div>`,
    );
    getElement("spotifyDeleteScheduleBtn").disabled = !spotifySelectedSchedule;
}

// Reload schedules and redraw everything that shows them.
async function refreshSchedules() {
    await loadSchedules();
    renderNextSchedule();
    renderCalendar();
    renderSchedule(spotifySelectedDate);
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY MODALS
// ============================================================
function playlistOptionsHTML(playlists, placeholder) {
    return (
        `<option value="">${placeholder}</option>` +
        playlists
            .map(
                (p) =>
                    `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`,
            )
            .join("")
    );
}

async function populatePlaylistDropdown(elementId, selectedId = "") {
    setElementHTML(elementId, '<option value="">Loading...</option>');
    const playlists = spotifyPlaylists.length
        ? spotifyPlaylists
        : await fetchPlaylists();
    setElementHTML(
        elementId,
        playlists.length
            ? playlistOptionsHTML(playlists, "— select —")
            : '<option value="">— no playlists found —</option>',
    );
    setElementValue(elementId, selectedId);
}

// Playlist chosen in a form: a pasted URL / ID wins over the dropdown.
// Returns { playlistId, playlistName }, or null after showing a toast.
async function readPlaylistChoice(selectId, manualId) {
    const manual = getElement(manualId).value.trim();
    if (manual) {
        const resolved = await resolveManualPlaylist(manual);
        if (resolved.ok) return resolved;
        showToast("Invalid Spotify playlist URL / ID.", "error");
        return null;
    }
    const select = getElement(selectId);
    if (!select.value) {
        showToast("Select a playlist or enter its URL / ID.", "error");
        return null;
    }
    return {
        playlistId: select.value,
        playlistName: select.options[select.selectedIndex]?.text || "Untitled",
    };
}

async function openPlaylistModal() {
    activeSlot = null;
    selectAllElements(".spotify-slot-pick-btn").forEach((btn) =>
        btn.classList.remove("active"),
    );
    hideElement("spotifySlotEditor");
    showElement("spotifySlotEditorPrompt", "block");
    setElementValue("spotifySlotPlaylistManual", "");
    openModal("spotifyPlaylistModal");

    const [playlists] = await Promise.all([fetchPlaylists(), renderSlots()]);
    setElementHTML(
        "spotifySlotPlaylistSelect",
        playlistOptionsHTML(playlists, "select"),
    );
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
    const icon = existing?.playlist_icon || DEFAULT_SLOT_ICON;
    selectAllElements(".spotify-icon-option").forEach((el) =>
        el.classList.toggle("active", el.dataset.icon === icon),
    );
}

async function saveSlotFromModal() {
    if (!activeSlot) return;
    const choice = await readPlaylistChoice(
        "spotifySlotPlaylistSelect",
        "spotifySlotPlaylistManual",
    );
    if (!choice) return;
    const icon =
        selectElement(".spotify-icon-option.active")?.dataset.icon ||
        DEFAULT_SLOT_ICON;
    const ok = await runMutation("Save slot", async (sb, userId) => {
        const { error } = await sb.from("spotify_playlists").upsert(
            {
                user_id: userId,
                slot_number: activeSlot,
                playlist_id: choice.playlistId,
                playlist_name: choice.playlistName,
                playlist_icon: icon,
            },
            { onConflict: "user_id,slot_number" },
        );
        if (error) throw error;
    });
    if (!ok) return;
    await renderSlots();
    closeModal("spotifyPlaylistModal");
}

async function openScheduleForm(schedule = null) {
    spotifySelectedSchedule = schedule;
    setElementText(
        "spotifyScheduleFormTitle",
        schedule ? "Edit schedule" : "Add new schedule",
    );
    setElementValue(
        "ssfDate",
        schedule?.scheduled_date ?? (spotifySelectedDate || getToday()),
    );
    setElementValue("ssfTime", schedule?.scheduled_time?.slice(0, 5) ?? "");
    setElementValue("ssfPlaylistManual", "");
    getElement("ssfDeleteBtn").hidden = !schedule;
    await populatePlaylistDropdown("ssfPlaylist", schedule?.playlist_id);
    openModal("spotifyScheduleFormModal");
}

async function openSpotifyScheduleModal() {
    openModal("spotifyScheduleModal");
    hideElement("spotifyTemplateLoader");
    await refreshSchedules();
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY ACTIONS
// ============================================================
async function saveScheduleForm() {
    const date = getElement("ssfDate").value;
    const time = getElement("ssfTime").value;
    if (!date || !time) {
        return showToast("Please set a date and time.", "error");
    }
    const choice = await readPlaylistChoice("ssfPlaylist", "ssfPlaylistManual");
    if (!choice) return;

    const editing = spotifySelectedSchedule;
    const fields = {
        scheduled_date: date,
        scheduled_time: time,
        playlist_id: choice.playlistId,
        playlist_name: choice.playlistName,
    };
    const ok = await runMutation("Save schedule", async (sb, userId) => {
        const { error } = editing
            ? await sb
                  .from("spotify_schedules")
                  .update(fields)
                  .eq("id", editing.id)
                  .eq("user_id", userId)
            : await sb.from("spotify_schedules").insert({
                  ...fields,
                  user_id: userId,
                  schedule_type: "once",
                  triggered: false,
              });
        if (error) throw error;
    });
    if (!ok) return;
    closeModal("spotifyScheduleFormModal");
    await refreshSchedules();
}

async function deleteSelectedSchedule() {
    const sel = spotifySelectedSchedule;
    if (!sel) return;

    const mode = sel.template_ref
        ? await chooseDialog(
              "This schedule is part of a recurring template. Delete only this one, or all future schedules in the template?",
              [
                  { label: "This one", value: "single", className: "btn-red" },
                  {
                      label: "All future",
                      value: "template",
                      className: "btn-red",
                  },
              ],
          )
        : (await confirmDialog("Delete this schedule?", {
              confirmText: "Delete",
              danger: true,
          })) && "single";
    if (!mode) return;

    const ok = await runMutation("Delete schedule", async (sb, userId) => {
        let query = sb.from("spotify_schedules").delete().eq("user_id", userId);
        query =
            mode === "template"
                ? query
                      .eq("template_ref", sel.template_ref)
                      .eq("triggered", false)
                      .gte("scheduled_date", getToday())
                : query.eq("id", sel.id);
        const { error } = await query;
        if (error) throw error;
    });
    if (!ok) return;
    spotifySelectedSchedule = null;
    closeModal("spotifyScheduleFormModal");
    await refreshSchedules();
}

async function skipNextSchedule() {
    const next = getNextSchedule();
    if (!next) return;
    const confirmed = await confirmDialog("Skip and delete this schedule?", {
        confirmText: "Skip",
        danger: true,
    });
    if (!confirmed) return;
    const ok = await runMutation("Skip schedule", async (sb, userId) => {
        const { error } = await sb
            .from("spotify_schedules")
            .delete()
            .eq("id", next.id)
            .eq("user_id", userId);
        if (error) throw error;
    });
    if (ok) await refreshSchedules();
}

// The 10-day shift rotation; day 1 is the first afternoon shift.
const SHIFT_PATTERN = [
    "afternoon",
    "afternoon",
    "off",
    "early",
    "early",
    "overnight",
    "overnight",
    "off",
    "off",
    "off",
];

// Returns the alarm time for `dateStr` under the chosen template, or "".
function templateTimeFor(type, dateStr, startDateStr) {
    if (type === "weekly") {
        const weekday = new Date(dateStr + "T00:00:00Z").getUTCDay();
        const days = selectAllElements(
            '#spotifyWeeklyFields input[type="checkbox"]:checked',
        ).map((cb) => parseInt(cb.value, 10));
        return days.includes(weekday)
            ? getElement("spotifyWeeklyTime").value
            : "";
    }
    const day1Index = parseInt(getElement("spotifyShiftDay1Index").value, 10);
    const offset = day1Index - 1 + daysBetween(startDateStr, dateStr);
    const shift = SHIFT_PATTERN[((offset % 10) + 10) % 10];
    const timeInput = {
        afternoon: "spotifyShiftAfternoonTime",
        early: "spotifyShiftEarlyTime",
        overnight: "spotifyShiftOvernightTime",
        off: "spotifyShiftOffTime",
    }[shift];
    return getElement(timeInput).value;
}

async function generateSchedules() {
    const type = getElement("spotifyTemplateType").value;
    const startDate = getElement("spotifyTemplateStartDate").value;
    const endDate = getElement("spotifyTemplateEndDate").value || startDate;
    const replace =
        selectElement('input[name="spotifyOverride"]:checked')?.value ===
        "replace";

    if (!startDate) return showToast("Please set a start date.", "error");
    if (endDate < startDate) {
        return showToast(
            "End date cannot be earlier than start date.",
            "error",
        );
    }
    if (
        type === "weekly" &&
        (!getElement("spotifyWeeklyTime").value ||
            !selectElement(
                '#spotifyWeeklyFields input[type="checkbox"]:checked',
            ))
    ) {
        return showToast(
            "Please select at least one weekday and a time.",
            "error",
        );
    }
    const choice = await readPlaylistChoice(
        "spotifyTemplatePlaylistSelect",
        "spotifyTemplatePlaylistManual",
    );
    if (!choice) return;

    const templateRef = crypto.randomUUID();
    const rows = [];
    for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
        const time = templateTimeFor(type, date, startDate);
        if (!time) continue;
        rows.push({
            schedule_type: type,
            template_ref: templateRef,
            scheduled_date: date,
            scheduled_time: time,
            playlist_id: choice.playlistId,
            playlist_name: choice.playlistName,
            triggered: false,
        });
    }
    if (!rows.length) {
        return showToast(
            "No schedules generated. Check your settings.",
            "error",
        );
    }

    const ok = await runMutation("Generate schedules", async (sb, userId) => {
        // Rows are built before anything is deleted, so bad input never
        // wipes the existing schedules.
        if (replace) {
            const { error } = await sb
                .from("spotify_schedules")
                .delete()
                .eq("user_id", userId)
                .gte("scheduled_date", startDate)
                .lte("scheduled_date", endDate);
            if (error) throw error;
        }
        for (let i = 0; i < rows.length; i += 100) {
            const batch = rows
                .slice(i, i + 100)
                .map((row) => ({ ...row, user_id: userId }));
            const { error } = await sb.from("spotify_schedules").insert(batch);
            if (error) throw error;
        }
    });
    if (!ok) return;
    setElementValue("spotifyTemplatePlaylistManual", "");
    hideElement("spotifyTemplateLoader");
    await refreshSchedules();
}

// Spotify header turns red when not connected; tapping it then offers login.
function setupSpotifyAuth() {
    getElement("spotifyAuthBtn").addEventListener("click", spotifyAuth);
    const header = selectElement('[data-section="spotify"] .panel-header');
    header.addEventListener("click", (e) => {
        if (header.classList.contains("spotify-header-error")) {
            e.stopPropagation();
            openModal("spotifyAuthModal");
        }
    });
}

// Binds a click handler that doesn't bubble to the panel header.
function onClick(id, handler) {
    getElement(id).addEventListener("click", (e) => {
        e.stopPropagation();
        handler(e);
    });
}

function setupSpotifyPanel() {
    onClick("spotifyPrevBtn", () => spotifyPlayer?.previousTrack());
    onClick("spotifyPlayBtn", () => spotifyPlayer?.togglePlay());
    onClick("spotifyNextBtn", () => spotifyPlayer?.nextTrack());

    const changeVolume = (delta) => {
        spotifyVolume = Math.min(100, Math.max(0, spotifyVolume + delta));
        setElementText("volDisplay", spotifyVolume);
        spotifyPlayer?.setVolume(spotifyVolume / 100);
    };
    onClick("volUpBtn", () => changeVolume(25));
    onClick("volDownBtn", () => changeVolume(-25));

    onClick("spotifyPlaylistsLabel", openPlaylistModal);
    selectAllElements(".spotify-slot-btn").forEach((btn) =>
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (btn.dataset.playlistId) playPlaylist(btn.dataset.playlistId);
        }),
    );

    onClick("spotifySchedAddBtn", () => openScheduleForm());
    onClick("spotifySchedSkipBtn", skipNextSchedule);
    onClick("spotifySchedAllBtn", openSpotifyScheduleModal);
    onClick("spotifySchedRow", () => {
        const next = getNextSchedule();
        if (next) openScheduleForm(next);
    });
}

function setupSpotifyModals() {
    setupSpotifyPanel();

    // Playlist shortcut slots
    setElementHTML(
        "spotifyIconPicker",
        ICONS.map(
            (icon) =>
                `<button type="button" class="spotify-icon-option" data-icon="${icon}">${icon}</button>`,
        ).join(""),
    );
    selectAllElements(".spotify-icon-option").forEach((el) =>
        el.addEventListener("click", () => {
            selectAllElements(".spotify-icon-option").forEach((x) =>
                x.classList.toggle("active", x === el),
            );
        }),
    );
    selectAllElements(".spotify-slot-pick-btn").forEach((btn) =>
        btn.addEventListener("click", () =>
            selectSlotForEdit(Number(btn.dataset.slot)),
        ),
    );
    onClick("spotifySlotSaveBtn", saveSlotFromModal);

    // Schedule calendar
    getElement("spotifyCalendarGrid").addEventListener("click", (e) => {
        const cell = e.target.closest(".spotify-calendar-cell[data-date]");
        if (!cell) return;
        spotifySelectedDate = cell.dataset.date;
        renderCalendar();
        renderSchedule(spotifySelectedDate);
    });
    const moveMonth = (delta) => {
        spotifyCalendarMonth = new Date(
            spotifyCalendarMonth.getFullYear(),
            spotifyCalendarMonth.getMonth() + delta,
            1,
        );
        renderCalendar();
    };
    onClick("spotifyCalPrevBtn", () => moveMonth(-1));
    onClick("spotifyCalNextBtn", () => moveMonth(1));
    getElement("spotifyDaySchedules").addEventListener("click", (e) => {
        const row = e.target.closest(".spotify-day-row[data-id]");
        const item = row && schedules.find((s) => s.id === row.dataset.id);
        if (item) openScheduleForm(item);
    });
    onClick("spotifyAddScheduleBtn", () => openScheduleForm());
    onClick("spotifyDeleteScheduleBtn", deleteSelectedSchedule);

    // Single schedule form
    getElement("spotifyScheduleForm").addEventListener("submit", (e) => {
        e.preventDefault();
        withBusy(e.submitter, saveScheduleForm);
    });
    onClick("ssfDeleteBtn", deleteSelectedSchedule);

    // Recurring templates
    const toggleTemplateFields = () => {
        const type = getElement("spotifyTemplateType").value;
        getElement("spotifyWeeklyFields").style.display =
            type === "weekly" ? "block" : "none";
        getElement("spotifyShiftFields").style.display =
            type === "shift" ? "block" : "none";
    };
    getElement("spotifyTemplateType").addEventListener(
        "change",
        toggleTemplateFields,
    );
    onClick("spotifyLoadTemplateBtn", async () => {
        toggleTemplateFields();
        showElement("spotifyTemplateLoader", "block");
        setElementValue("spotifyTemplatePlaylistManual", "");
        await populatePlaylistDropdown("spotifyTemplatePlaylistSelect");
    });
    onClick("spotifyTemplateCancelBtn", () =>
        hideElement("spotifyTemplateLoader"),
    );
    getElement("spotifyTemplateGenerateBtn").addEventListener("click", (e) =>
        withBusy(e.currentTarget, generateSchedules),
    );
}
// ============================================================
// #endregion
// ============================================================
