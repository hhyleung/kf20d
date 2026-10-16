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
    if (nowPlayingInterval) {
        clearInterval(nowPlayingInterval);
        nowPlayingInterval = null;
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

    const todayHKT = getTodayHKT();
    if (todayHKT !== lastKnownDate) {
        lastKnownDate = todayHKT;
        PANELS.forEach(renderPanel);
    }
}

function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    setTimeout(() => {
        tickClock();
        clockInterval = setInterval(tickClock, 1000);
    }, 100);
}

function renderSpotify() {
    setElementHTML(
        "spotifyContent",
        `<div class="spotify-panel">
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
                    <button class="spotify-schedule-action btn-green"  type="button" id="spotifySchedAddBtn">Add</button>
                    <button class="spotify-schedule-action btn-red" type="button" id="spotifySchedSkipBtn">Skip</button>
                    <button class="spotify-schedule-action btn-blue" type="button" id="spotifySchedAllBtn">ALL</button>
                </div>
            </div>
        </div>`,
    );

    setupPlaybackControls();
    setupVolumeControls();
    setupSlots();
    setupScheduleButtons();

    const allBtn = getElement("spotifySchedAllBtn");
    if (allBtn && !allBtn.dataset.bound) {
        allBtn.dataset.bound = 1;
        allBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openSpotifyScheduleModal();
        });
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.warn("Fullscreen request failed:", err);
        });
    } else {
        document.exitFullscreen();
    }
}

async function showDashboard() {
    const blanker = getElement("screenBlanker");
    const clockHeader = getElement("datetimeHeader");
    if (clockHeader && !clockHeader.dataset.bound) {
        let clickTimer = null;

        clockHeader.addEventListener("click", () => {
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                blanker.classList.add("active");
            }, 250);
        });

        clockHeader.addEventListener("dblclick", () => {
            clearTimeout(clickTimer);
            toggleFullscreen();
        });

        clockHeader.addEventListener("contextmenu", (e) => e.preventDefault());
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
        "mealPrepItemModal",
        "choreItemModal",
        "changeLogItemModal",
        "billItemModal",
        "plantItemModal",
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
    setupTodayButtons();
    startClock();

    await loadSupabaseData();
    renderAllPanels();

    setupSpotifyAuth();
    await initSpotify();
    renderSpotify();
    await renderSlots();
    await loadSchedules();
    renderNextSchedule();

    if (isTablet()) {
        await initSpotifyPlayer();
        await fetchNowPlaying();
        startScheduleTicker();
    }

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
        showToast(`Login failed: ${err.message}`, "error");
    }
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region INITIALISATION
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
    selectElement(".dashboard").style.display = "none";
    showElement("loginContainer");

    await checkSession();

    const loginForm = getElement("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = getElement("loginEmail").value;
            const password = getElement("loginPassword").value;
            await dashboardLogin(email, password);
        });
    }
});

// ============================================================
// #endregion
// ============================================================
