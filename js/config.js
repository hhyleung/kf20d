// ============================================================
// #region CONFIGS
// ============================================================
const DEV_MODE = false;

const SUPABASE_PROJECT_URL = "https://ilfrtrfohdhoquemptmj.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_s8LcKiFr_XOf_fg9O2ubBQ_8mElMJ6L";

const SPOTIFY_CLIENT_ID = "61214ea8d81b43a6bd94e5aaaa39ec38";
const SPOTIFY_REDIRECT_URI = "https://hhyleung.github.io/kf20d/";
const SPOTIFY_SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-library-read",
];

const PANELS = [
    "mealPrep",
    "fridgeStock",
    "chores",
    "bills",
    "changeLog",
    "plants",
    "notes",
];

const MEAL_PREP_CATS = ["Carbs", "Veggies", "Proteins", "Fruits", "Others"];
const FRIDGE_STOCK_CATS = ["Fridge", "Freezer"];
const FULL_WIDTH_CATS = ["Proteins"];

const SCHEDULE_GRACE_MINUTES = 5;

// Night dimming for the wall display (UTC+8 times). Browsers can't change the
// backlight, so this lays a black overlay over the page; it stays usable.
// Not applied on phones. Set to null to disable.
const NIGHT_DIM = { from: "22:00", to: "07:00", opacity: 0.6 };

const ICONS = ["♫", "☼", "☁", "❄", "☆", "♡", "⚐", "⚓", "☕\uFE0E"];
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region STATES
// ============================================================
let supabaseClient = null;
let isAuthenticated = false;
let isRealtimeSetup = false;
let subscriptions = [];

const panelData = {
    pantry: [],
    chores: [],
    bills: [],
    changeLog: [],
    plants: [],
    plantHistory: [],
    notes: [],
};

const panelState = {
    mealPrep: { editingId: null, manualDate: false },
    fridgeStock: { editingId: null, manualDate: false },
    chores: { editingId: null, manualDate: false },
    bills: { editingId: null, manualDate: false },
    changeLog: { editingId: null, manualDate: false },
    notes: { editingId: null },
};

let activePanel = null;
let panelMetadata = Object.fromEntries(PANELS.map((k) => [k, null]));

let lastKnownDate = getTodayHKT();
let clockInterval = null;
let scheduleTickInterval = null;

let nowPlayingInterval = null;
let spotifyPlaylists = [];
let playlistSlots = [];
let schedules = [];
let activeSlot = null;
let spotifyVolume = 50;
let spotifyPlayer = null;
let spotifyDeviceId = null;
let isSpotifyReady = false;
let spotifyToken = null;
let spotifyTokenExpiry = 0;
let spotifyCalendarMonth = new Date();
let spotifySelectedDate = getTodayHKT();
let spotifySelectedScheduleId = null;
let spotifySelectedSchedule = null;
// ============================================================
// #endregion
// ============================================================
