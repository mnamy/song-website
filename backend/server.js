require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// ✅ OpenAI v4
const { OpenAI } = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ✅ Fetch for Spotify (works in Node v16+)
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ Serve static frontend files from ../client
app.use(express.static(path.join(__dirname, '../client')));

// 🔮 OpenAI Route
app.post('/api/openai-song', async (req, res) => {
  const { mood } = req.body;
  if (!mood) return res.status(400).json({ error: 'Mood is required' });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful music bot. Switch up the songs too so they are not always similar. Respond with one song title and artist only, formatted exactly like this: Song Title - Artist Name"},
        { role: "user", content: `Recommend one song for this mood: ${mood}` }
      ],
      max_tokens: 50,
      temperature: 0.7
    });

    const song = completion.choices[0].message.content;
    res.json({ song });
  } catch (error) {
    console.error("OpenAI Error:", error);
    res.status(500).json({ error: 'OpenAI request failed' });
  }
});

// 🎧 Spotify Route
let spotifyToken = null;
let tokenExpires = 0;

async function getSpotifyAccessToken() {
  const now = Date.now();
  if (spotifyToken && now < tokenExpires) return spotifyToken;

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(
        process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
      ).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  spotifyToken = data.access_token;
  tokenExpires = now + data.expires_in * 1000;
  return spotifyToken;
}

app.get('/api/spotify-search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing search query' });

  try {
    const token = await getSpotifyAccessToken();
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    const track = data.tracks?.items?.[0];

    if (!track) return res.status(404).json({ error: 'No track found' });

    res.json({
      title: track.name,
      artist: track.artists[0].name,
      image: track.album.images[0].url,
      spotifyUrl: track.external_urls.spotify,
      trackId: track.id
    });

  } catch (error) {
    console.error("Spotify Error:", error);
    res.status(500).json({ error: 'Spotify request failed' });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
