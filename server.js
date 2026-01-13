require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from /client
app.use(express.static(path.join(__dirname, "../client")));

// -----------------------
// Helpers
// -----------------------
function fetchWithTimeout(url, options = {}, ms = 9000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}

function msSince(start) {
  return Date.now() - start;
}

// -----------------------
// Spotify token caching
// -----------------------
let spotifyToken = null;
let tokenExpiresAt = 0;

async function getSpotifyAccessToken() {
  const now = Date.now();
  if (spotifyToken && now < tokenExpiresAt) return spotifyToken;

  const resp = await fetchWithTimeout(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET
          ).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    },
    8000
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Spotify token error (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  spotifyToken = data.access_token;

  // buffer 60s so it doesn't expire mid-call
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;
  return spotifyToken;
}

// -----------------------
// Simple in-memory cache
// -----------------------
const songCache = new Map();
// key: moodLower -> { value: {...}, expiresAt }
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(mood) {
  const key = mood.toLowerCase();
  const entry = songCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    songCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(mood, value) {
  const key = mood.toLowerCase();
  songCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// -----------------------
// Main route: one call does all
// -----------------------
app.post("/api/song", async (req, res) => {
  const t0 = Date.now();
  const { mood } = req.body;

  if (!mood || !mood.trim()) {
    return res.status(400).json({ error: "Mood is required" });
  }

  const moodTrimmed = mood.trim();

  // cache hit
  const cached = getCached(moodTrimmed);
  if (cached) {
    console.log(`⚡ Cache hit for "${moodTrimmed}" (${msSince(t0)}ms)`);
    return res.json(cached);
  }

  try {
    console.log(`🎛️ /api/song mood="${moodTrimmed}"`);

    // 1) OpenAI (strict JSON)
    const tOpenAI = Date.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'Return ONLY valid JSON: {"title":"...","artist":"..."} (no extra keys, no markdown). Use real songs.'
        },
        {
          role: "user",
          content: `Recommend 1 song that matches this mood: ${moodTrimmed}`
        }
      ],
      max_tokens: 80,
      temperature: 0.8
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`OpenAI returned invalid JSON: ${raw}`);
    }

    const title = (parsed.title || "").trim();
    const artist = (parsed.artist || "").trim();
    if (!title || !artist) {
      throw new Error("OpenAI did not return a valid title/artist.");
    }

    console.log(`🤖 OpenAI: ${title} — ${artist} (${msSince(tOpenAI)}ms)`);

    // 2) Spotify search
    const tSpotify = Date.now();
    const token = await getSpotifyAccessToken();
    const q = encodeURIComponent(`${title} ${artist}`);

    const spotifyResp = await fetchWithTimeout(
      `https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
      8000
    );

    if (!spotifyResp.ok) {
      const text = await spotifyResp.text();
      throw new Error(`Spotify search error (${spotifyResp.status}): ${text}`);
    }

    const spotifyData = await spotifyResp.json();
    const track = spotifyData.tracks?.items?.[0];

    if (!track) {
      return res.status(404).json({ error: "No track found on Spotify." });
    }

    const payload = {
      title: track.name,
      artist: track.artists?.[0]?.name || artist,
      image: track.album?.images?.[0]?.url || "",
      spotifyUrl: track.external_urls?.spotify || ""
    };

    console.log(`🎧 Spotify ok (${msSince(tSpotify)}ms)`);
    console.log(`✅ Total ${msSince(t0)}ms`);

    setCached(moodTrimmed, payload);
    return res.json(payload);
  } catch (err) {
    console.error("❌ /api/song error:", err);

    // nicer timeout message
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Upstream request timed out. Try again." });
    }

    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// Health route (optional)
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
