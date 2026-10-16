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
    const { weekday, day, month, year, hour, minute } = getDateParts();
    setElementText(
        "clockDisplay",
        `${weekday}\u00A0\u00A0${day} ${month} ${year}\u00A0\u00A0${hour}:${minute}`,
    );

    // Urgency colours depend on today's date; re-render at midnight.
    const today = getToday();
    if (today !== lastKnownDate) {
        lastKnownDate = today;
        renderAllPanels();
    }
}

function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    setTimeout(() => {
        tickClock();
        clockInterval = setInterval(tickClock, 1000);
    }, 100);
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

// Clock header: tap blanks the screen (tap again to wake), double-tap
// toggles fullscreen.
function setupClockHeader() {
    const blanker = getElement("screenBlanker");
    const clockHeader = getElement("datetimeHeader");
    let clickTimer = null;
    clockHeader.addEventListener("click", () => {
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => blanker.classList.add("active"), 250);
    });
    clockHeader.addEventListener("dblclick", () => {
        clearTimeout(clickTimer);
        toggleFullscreen();
    });
    clockHeader.addEventListener("contextmenu", (e) => e.preventDefault());
    blanker.addEventListener("click", () => blanker.classList.remove("active"));
}

// Event listeners are bound once, however many times the dashboard is shown.
let dashboardBound = false;

async function showDashboard() {
    if (!dashboardBound) {
        dashboardBound = true;
        setupClockHeader();
        setupPanelEvents();
        setupFormHandlers();
        setupTodayButtons();
        setupSpotifyAuth();
        setupSpotifyModals();
    }

    hideElement("loginContainer");
    selectElement(".dashboard").style.display = "flex";
    selectAllElements(".modal").forEach((m) => (m.style.display = "none"));
    activePanel = null;
    Object.values(panelState).forEach((state) => {
        state.editingId = null;
        state.manualDate = false;
    });

    startClock();
    await loadSupabaseData();
    renderAllPanels();

    await initSpotify();
    await renderSlots();
    await loadSchedules();
    renderNextSchedule();

    if (isTablet()) {
        await initSpotifyPlayer();
        fetchNowPlaying();
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
        const { error } = await sb.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
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
