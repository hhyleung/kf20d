// ============================================================
// #region SPOTIFY TOKEN
// ============================================================
function activateSpotifyHeader(activate = true) {
    const panel = selectElement('[data-section="spotify"]');
    if (!panel) return;
    const header = selectElement(".panel-header", panel);
    if (!header) return;
    header.classList.toggle("spotify-header-error", activate);
}

async function saveSpotifyToken(tokenData) {
    const { sb, user } = await getSupabaseContext();
    const expiresAt = new Date(
        Date.now() + tokenData.expires_in * 1000,
    ).toISOString();
    const { error } = await sb.from("spotify_tokens").upsert(
        {
            user_id: user.id,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token ?? null,
            expires_at: expiresAt,
            scope: tokenData.scope ?? null,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
    );
    if (error) throw error;
    spotifyToken = tokenData.access_token;
    spotifyTokenExpiry = new Date(expiresAt).getTime();
}

async function loadSpotifyToken() {
    const { sb, user } = await getSupabaseContext();
    const { data, error } = await sb
        .from("spotify_tokens")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
    if (error) {
        console.error("loadSpotifyToken failed: ", error);
        return null;
    }
    return data;
}

async function refreshSpotifyToken(refreshToken) {
    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });
    if (!res.ok) throw new Error(`refreshSpotifyToken failed: ${res.status}`);
    return await res.json();
}

async function getValidSpotifyToken(forceRefresh = false) {
    const fiveMinutes = 5 * 60 * 1000;
    if (
        !forceRefresh &&
        spotifyToken &&
        Date.now() < spotifyTokenExpiry - fiveMinutes
    ) {
        return spotifyToken;
    }
    try {
        const tokenRow = await loadSpotifyToken();
        if (!tokenRow) return null;
        const expiresAt = new Date(tokenRow.expires_at).getTime();
        const needsRefresh = Date.now() > expiresAt - fiveMinutes;
        if (!needsRefresh) {
            spotifyToken = tokenRow.access_token;
            spotifyTokenExpiry = expiresAt;
            return tokenRow.access_token;
        }
        const refreshed = await refreshSpotifyToken(tokenRow.refresh_token);
        await saveSpotifyToken({
            ...refreshed,
            refresh_token: refreshed.refresh_token ?? tokenRow.refresh_token,
        });
        return spotifyToken;
    } catch (err) {
        console.error("getValidSpotifyToken failed: ", err);
        activateSpotifyHeader();
        return null;
    }
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY INIT
// ============================================================
function isTablet() {
    if (DEV_MODE) return true;
    const ua = navigator.userAgent || "";
    const isFirefox = /Firefox\/\d+/i.test(ua);
    const isWindows81 = /Windows NT 6\.3/i.test(ua);
    return isFirefox && isWindows81;
}

async function spotifyAuth() {
    const verifier = (() => {
        const array = new Uint8Array(64);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");
    })();
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(verifier),
    );
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
    sessionStorage.setItem("spotify_code_verifier", verifier);
    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: "code",
        redirect_uri: SPOTIFY_REDIRECT_URI,
        scope: SPOTIFY_SCOPES.join(" "),
        code_challenge_method: "S256",
        code_challenge: challenge,
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function exchangeCodeForToken(code) {
    const verifier = sessionStorage.getItem("spotify_code_verifier");
    if (!verifier) throw new Error("No code verifier found");
    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: "authorization_code",
            code,
            redirect_uri: SPOTIFY_REDIRECT_URI,
            code_verifier: verifier,
        }),
    });
    if (!res.ok) throw new Error(`exchangeCodeForToken failed: ${res.status}`);
    const data = await res.json();
    sessionStorage.removeItem("spotify_code_verifier");
    return data;
}

async function initSpotify() {
    if (!isTablet()) {
        activateSpotifyHeader(false);
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
        );
        try {
            const tokenData = await exchangeCodeForToken(code);
            await saveSpotifyToken(tokenData);
            activateSpotifyHeader(false);
        } catch (err) {
            console.error("initSpotify failed: ", err);
            activateSpotifyHeader();
        }
        return;
    }
    const token = await getValidSpotifyToken();
    activateSpotifyHeader(!token);
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY DATA
// ============================================================
function fetchNowPlaying() {
    if (nowPlayingInterval) return;
    nowPlayingInterval = setInterval(async () => {
        const token = await getValidSpotifyToken();
        if (!token) return;
        try {
            const res = await fetch("https://api.spotify.com/v1/me/player", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.status === 204 || !res.ok) {
                renderNowPlaying(null);
                return;
            }
            const data = await res.json();
            if (!data?.item) {
                renderNowPlaying(null);
                return;
            }
            renderNowPlaying({
                paused: !data.is_playing,
                track_window: {
                    current_track: {
                        name: data.item.name,
                        artists: data.item.artists,
                        album: { images: data.item.album.images },
                    },
                },
            });
            if (data?.device?.volume_percent != null) {
                const remoteVol = data.device.volume_percent;
                if (remoteVol !== spotifyVolume) {
                    spotifyVolume = remoteVol;
                    setElementText("volDisplay", String(remoteVol));
                }
            }
        } catch (err) {
            console.error("fetchNowPlaying failed: ", err);
        }
    }, 5000);
}

function parseSpotifyPlaylistInput(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";
    if (/^[A-Za-z0-9]{22}$/.test(raw)) return raw;
    const urlMatch = raw.match(/spotify\.com\/playlist\/([A-Za-z0-9]{22})/i);
    if (urlMatch) return urlMatch[1];
    const uriMatch = raw.match(/^spotify:playlist:([A-Za-z0-9]{22})$/i);
    if (uriMatch) return uriMatch[1];
    return "";
}

async function fetchPlaylistById(playlistId) {
    const token = await getValidSpotifyToken();
    if (!token || !playlistId) return null;
    try {
        const res = await fetch(
            `https://api.spotify.com/v1/playlists/${playlistId}`,
            {
                headers: { Authorization: `Bearer ${token}` },
            },
        );
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        console.error("fetchPlaylistById failed:", err);
        return null;
    }
}

async function resolveManualPlaylist(input) {
    const playlistId = parseSpotifyPlaylistInput(input);
    if (!playlistId) {
        return { ok: false, reason: "invalid_format" };
    }
    const playlist = await fetchPlaylistById(playlistId);
    if (playlist?.id) {
        return {
            ok: true,
            playlistId: playlist.id,
            playlistName: playlist.name || playlist.id,
            fetched: true,
        };
    }
    return {
        ok: true,
        playlistId,
        playlistName: playlistId,
        fetched: false,
    };
}

async function fetchPlaylists() {
    const token = await getValidSpotifyToken();
    if (!token) {
        spotifyPlaylists = [];
        return [];
    }
    const all = [];
    let url = "https://api.spotify.com/v1/me/playlists?limit=50";
    try {
        while (url) {
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) break;
            const data = await res.json();
            all.push(...(data.items || []).filter(Boolean));
            url = data.next;
        }
        let likedTotal = 0;
        try {
            const likedRes = await fetch(
                "https://api.spotify.com/v1/me/tracks?limit=1",
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (likedRes.ok) {
                const likedData = await likedRes.json();
                likedTotal = likedData.total || 0;
            }
        } catch (_) {}
        spotifyPlaylists = [
            {
                id: "__liked_songs__",
                name: "Liked Songs",
                uri: "spotify:collection:tracks",
                owner: { display_name: "You" },
                tracks: { total: likedTotal },
                images: [],
                isVirtualLikedSongs: true,
            },
            ...all,
        ];
        return spotifyPlaylists;
    } catch (err) {
        console.error("fetchPlaylists failed: ", err);
        spotifyPlaylists = [];
        return [];
    }
}

async function loadPlaylists() {
    const { sb, user } = await getSupabaseContext();
    const { data, error } = await sb
        .from("spotify_playlists")
        .select("*")
        .eq("user_id", user.id)
        .order("slot_number", { ascending: true });
    if (error) {
        console.error("loadPlaylists: ", error);
        return [];
    }
    return data || [];
}

async function loadSchedules() {
    const { sb, user } = await getSupabaseContext();
    const { data, error } = await sb
        .from("spotify_schedules")
        .select("*")
        .eq("user_id", user.id)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });
    if (error) {
        console.error("loadSchedules failed: ", error);
        return [];
    }
    schedules = data || [];
    return schedules;
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY PLAYER
// ============================================================
window.onSpotifyWebPlaybackSDKReady = function () {
    initSpotifyPlayer();
};

async function initSpotifyPlayer() {
    if (!isTablet()) return;
    let token = null;
    for (let i = 0; i < 10; i++) {
        token = await getValidSpotifyToken();
        if (token) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!token) return;

    spotifyPlayer = new Spotify.Player({
        name: "kf20d",
        getOAuthToken: (cb) => {
            getValidSpotifyToken().then((t) => {
                if (t) cb(t);
            });
        },
        volume: spotifyVolume / 100,
    });

    spotifyPlayer.addListener("ready", ({ device_id }) => {
        spotifyDeviceId = device_id;
        isSpotifyReady = true;
    });

    spotifyPlayer.addListener("authentication_error", async ({ message }) => {
        console.error("SDK auth error: ", message);
        const fresh = await getValidSpotifyToken(true);
        if (fresh && spotifyPlayer) {
            await spotifyPlayer.connect();
            activateSpotifyHeader(false);
        } else {
            activateSpotifyHeader();
        }
    });

    spotifyPlayer.addListener("account_error", ({ message }) => {
        console.error("SDK account error: ", message);
        activateSpotifyHeader();
    });

    spotifyPlayer.addListener("player_state_changed", renderNowPlaying);

    await spotifyPlayer.connect();
}

async function getDeviceId() {
    const token = await getValidSpotifyToken();
    if (!token) return null;
    try {
        const res = await fetch(
            "https://api.spotify.com/v1/me/player/devices",
            {
                headers: { Authorization: `Bearer ${token}` },
            },
        );
        if (!res.ok) {
            console.error("getDeviceId failed", res.status, await res.text());
            return null;
        }
        const data = await res.json();
        const device = (data.devices || []).find((d) => d.name === "kf20d");
        return device?.id || null;
    } catch (err) {
        console.error("getDeviceId failed: ", err);
        return null;
    }
}

async function playLikedSongs(token, deviceId) {
    const meRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
    });
    const { id: userId } = await meRes.json();

    await fetch(
        `https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=${encodeURIComponent(deviceId)}`,
        { method: "PUT", headers: { Authorization: `Bearer ${token}` } },
    );

    await new Promise((resolve) => setTimeout(resolve, 400));
    await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                context_uri: `spotify:user:${userId}:collection`,
            }),
        },
    );

    await new Promise((resolve) => setTimeout(resolve, 400));
    await fetch(
        `https://api.spotify.com/v1/me/player/volume?volume_percent=50&device_id=${encodeURIComponent(spotifyDeviceId)}`,
        { method: "PUT", headers: { Authorization: `Bearer ${token}` } },
    );
    spotifyVolume = 50;
    setElementText("volDisplay", spotifyVolume);
}

async function playPlaylist(playlistId) {
    const token = await getValidSpotifyToken();
    if (!token || !playlistId) return false;
    const targetDeviceId = await getDeviceId();
    if (!targetDeviceId) {
        console.error("Could not find Spotify device kf20d");
        return;
    }
    spotifyDeviceId = targetDeviceId;

    if (playlistId === "__liked_songs__") {
        await playLikedSongs(token, spotifyDeviceId);
        return;
    }

    try {
        const res = await fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId)}`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    context_uri: `spotify:playlist:${playlistId}`,
                }),
            },
        );
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("playPlaylist failed:", res.status, text);
            return false;
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
        await fetch(
            `https://api.spotify.com/v1/me/player/volume?volume_percent=50&device_id=${encodeURIComponent(spotifyDeviceId)}`,
            { method: "PUT", headers: { Authorization: `Bearer ${token}` } },
        );
        spotifyVolume = 50;
        setElementText("volDisplay", spotifyVolume);
        await new Promise((resolve) => setTimeout(resolve, 400));
        await fetch("https://api.spotify.com/v1/me/player/shuffle?state=true", {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` },
        });
        await new Promise((resolve) => setTimeout(resolve, 400));
        await fetch(
            "https://api.spotify.com/v1/me/player/repeat?state=context",
            {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}` },
            },
        );
        return true;
    } catch (err) {
        console.error("playPlaylist failed: ", err);
        return false;
    }
}
// ============================================================
// #endregion
// ============================================================

// ============================================================
// #region SPOTIFY SCHEDULER
// ============================================================
function getNextSchedule() {
    const todayStr = getTodayHKT();
    const currentTime = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Hong_Kong",
    });
    return (
        schedules.find((s) => {
            if (!s || s.triggered) return false;
            if (s.scheduled_date > todayStr) return true;
            if (
                s.scheduled_date === todayStr &&
                s.scheduled_time?.slice(0, 5) > currentTime
            )
                return true;
            return false;
        }) ?? null
    );
}

async function checkAndTriggerSchedule() {
    if (!isSpotifyReady || !spotifyDeviceId) return;
    const todayStr = getTodayHKT();
    const nowHKT = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Hong_Kong",
    });
    const toMinutes = (hhmm) => {
        const [h, m] = hhmm.split(":").map(Number);
        return h * 60 + m;
    };
    const nowMinutes = toMinutes(nowHKT);
    const due = schedules.filter((s) => {
        if (s.triggered || s.scheduled_date !== todayStr) return false;
        if (!s.scheduled_time) return false;
        const lateBy = nowMinutes - toMinutes(s.scheduled_time.slice(0, 5));
        return lateBy >= 0 && lateBy <= SCHEDULE_GRACE_MINUTES;
    });
    if (!due.length) return;
    const { sb, user } = await getSupabaseContext();
    let lastPlaylistId = null;
    for (const entry of due) {
        const { error } = await sb
            .from("spotify_schedules")
            .update({ triggered: true })
            .eq("id", entry.id);
        if (error) {
            console.error("Trigger schedule failed", error);
            continue;
        }
        if (entry.playlist_id) lastPlaylistId = entry.playlist_id;
    }
    if (lastPlaylistId) await playPlaylist(lastPlaylistId);
    await loadSchedules();
    renderNextSchedule();
}

function startScheduleTicker() {
    if (scheduleTickInterval) clearInterval(scheduleTickInterval);
    scheduleTickInterval = setInterval(checkAndTriggerSchedule, 60000);
    checkAndTriggerSchedule();
}
// ============================================================
// #endregion
// ============================================================
