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

const MEAL_PREP_CATS = ["Carbs", "Veggies", "Proteins", "Fruits", "Others"];
const FRIDGE_STOCK_CATS = ["Fridge", "Freezer"];
// Meal prep categories that span both columns of the panel.
const FULL_WIDTH_CATS = ["Proteins"];

// The scheduler still plays a schedule this many minutes late (e.g. after
// the tablet wakes from sleep).

const SCHEDULE_GRACE_MINUTES = 5;

// Icons offered for the Spotify playlist shortcut buttons.
const ICONS = ["♫", "☼", "☁", "❄", "☆", "♡", "⚐", "⚓", "☕\uFE0E"];
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region STATES
// ============================================================
let supabaseClient = null;
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

// Per-panel modal state: the row being edited, and whether its auto-calculated
// date was overridden by hand.
const panelState = {
    mealPrep: { editingId: null, manualDate: false },
    chores: { editingId: null, manualDate: false },
    bills: { editingId: null, manualDate: false },
    changeLog: { editingId: null, manualDate: false },
    notes: { editingId: null },
};

let activePanel = null; // panel shown in the full-list modal
let panelMetadata = {}; // panel key -> last updated timestamp

let lastKnownDate = getToday();
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
let spotifySelectedDate = getToday();
let spotifySelectedSchedule = null;
// ============================================================
// #endregion
// ============================================================
