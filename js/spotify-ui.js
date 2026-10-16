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
                <div class="spotify-day-row-title">${item.scheduled_time?.slice(0, 5) ?? ""} ${escapeHTML(item.playlist_name || "Untitled")}</div>
                <div class="spotify-day-row-meta">${escapeHTML(item.schedule_type)}</div>
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
                .map(
                    (p) =>
                        `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`,
                )
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
            .map(
                (pl) =>
                    `<option value="${escapeHTML(pl.id)}">${escapeHTML(pl.name)}</option>`,
            )
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
            showToast("Invalid Spotify playlist URL / ID.", "error");
            return;
        }
        playlistId = resolved.playlistId;
        playlistName = resolved.playlistName;
    } else {
        playlistId = select.value;
        playlistName = select.options[select.selectedIndex]?.text || "Untitled";
    }
    if (!playlistId) {
        showToast("Select or enter playlist URL / ID", "error");
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
        showToast(`Save slot failed: ${error.message}`, "error");
        return;
    }
    if (manualInput) manualInput.value = "";
    await renderSlots();
    closeModal("spotifyPlaylistModal");
}

async function deleteSelectedSchedule() {
    if (!spotifySelectedScheduleId) return;

    const sel = spotifySelectedSchedule;
    const hasTemplate = !!sel?.template_ref;
    const today = getTodayHKT();

    const deleteMode = hasTemplate
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
    if (!deleteMode) return;
    const { sb, user } = await getSupabaseContext();
    let error;

    if (deleteMode === "template") {
        ({ error } = await sb
            .from("spotify_schedules")
            .delete()
            .eq("template_ref", sel.template_ref)
            .eq("user_id", user.id)
            .eq("triggered", false)
            .gte("scheduled_date", today));
    } else {
        ({ error } = await sb
            .from("spotify_schedules")
            .delete()
            .eq("id", spotifySelectedScheduleId)
            .eq("user_id", user.id));
    }

    if (error) {
        console.error("Delete schedule failed", error);
        showToast("Delete schedule failed: " + error.message, "error");
        return;
    }

    spotifySelectedScheduleId = null;
    spotifySelectedSchedule = null;
    closeModal("spotifyScheduleFormModal");
    await loadSchedules();
    renderNextSchedule();
    renderCalendar();
    renderSchedule(spotifySelectedDate);
    refreshScheduleActionState();
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
                showToast("Invalid Spotify playlist URL / ID.", "error");
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
            showToast("Please set date, time, and playlist.", "error");
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
            showToast(`Save schedule failed: ${error.message}`, "error");
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
        deleteBtn.addEventListener("click", deleteSelectedSchedule);
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
        delBtn.addEventListener("click", deleteSelectedSchedule);
    }

    refreshScheduleActionState();
}

function setupScheduleButtons() {
    const skipBtn = getElement("spotifySchedSkipBtn");
    if (skipBtn && !skipBtn.dataset.bound) {
        skipBtn.dataset.bound = "1";
        skipBtn.addEventListener("click", async (e) => {
            e.stopPropagation();

            const next = getNextSchedule();
            if (!next) return;

            const ok = await confirmDialog("Skip and delete this schedule?", {
                confirmText: "Skip",
                danger: true,
            });
            if (!ok) return;

            const { sb, user } = await getSupabaseContext();
            const { error } = await sb
                .from("spotify_schedules")
                .delete()
                .eq("id", next.id);

            if (error) {
                console.error("Skip schedule failed:", error);
                showToast(`Skip schedule failed: ${error.message}`, "error");
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
        selectElement('input[name="spotifyOverride"]:checked')?.value || "add";

    const playlistSelect = getElement("spotifyTemplatePlaylistSelect");
    const manualInput = getElement("spotifyTemplatePlaylistManual");

    let playlistId = "";
    let playlistName = "";

    if (manualInput?.value.trim()) {
        const resolved = await resolveManualPlaylist(manualInput.value);
        if (!resolved.ok) {
            showToast("Invalid Spotify playlist URL / ID.", "error");
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
        showToast("Please set a start date and playlist.", "error");
        return;
    }

    const { sb, user } = await getSupabaseContext();
    const rows = [];
    const startDate = new Date(startDateStr + "T00:00:00Z");
    const endDate = endDateStr
        ? new Date(endDateStr + "T00:00:00Z")
        : new Date(startDateStr + "T00:00:00Z");

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        showToast("Invalid date range.", "error");
        return;
    }

    if (endDate < startDate) {
        showToast("End date cannot be earlier than start date.", "error");
        return;
    }

    const templateRef = crypto.randomUUID();

    if (type === "weekly") {
        const checkedDays = selectAllElements(
            '#spotifyWeeklyFields input[type="checkbox"]:checked',
        ).map((cb) => parseInt(cb.value, 10));
        const time = getElement("spotifyWeeklyTime").value;

        if (!checkedDays.length || !time) {
            showToast(
                "Please select at least one weekday and a time.",
                "error",
            );
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
        showToast("No schedules generated. Check your settings.", "error");
        return;
    }

    if (overrideMode === "replace") {
        const { error } = await sb
            .from("spotify_schedules")
            .delete()
            .gte("scheduled_date", startDateStr)
            .lte("scheduled_date", endDate.toISOString().slice(0, 10))
            .eq("user_id", user.id);

        if (error) {
            console.error("Replace-range delete failed:", error);
            showToast(`Replace-range failed: ${error.message}`, "error");
            return;
        }
    }

    for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await sb.from("spotify_schedules").insert(batch);
        if (error) {
            console.error("Insert schedules failed:", error);
            showToast(`Insert schedules failed: ${error.message}`, "error");
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
