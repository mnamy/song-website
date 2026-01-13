document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ script.js loaded");

  const input = document.querySelector(".mood-input");
  const svgIcon = document.querySelector(".svg-icon");
  const result = document.getElementById("result");

  console.log("input found?", !!input, "svg found?", !!svgIcon, "result found?", !!result);

document.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector('.mood-input');
  const svgIcon = document.querySelector('.svg-icon');
  const result = document.getElementById('result');

  async function getSongOfTheDay() {
    const mood = input.value.trim();
    if (!mood) return;

    result.textContent = 'Thinking...';
    result.style.display = 'block';

    try {
      // 🔮 Step 1: Get song from OpenAI
      const openaiRes = await fetch('https://song-website-63ex.onrender.com/api/openai-song', {
document.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector(".mood-input");
  const svgIcon = document.querySelector(".svg-icon");
  const result = document.getElementById("result");

  let isLoading = false;

  function setLoading(loading, message = "Finding a song...") {
    isLoading = loading;

    if (svgIcon) svgIcon.style.pointerEvents = loading ? "none" : "auto";
    if (input) input.disabled = loading;

    result.style.display = "block";
    result.textContent = loading ? message : "";
  }

  async function postJSON(url, body, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error || `Request failed (${res.status})`;
        throw new Error(msg);
      }

      return data;
    } catch (err) {
      if (err.name === "AbortError") throw new Error("Timed out. Try again.");
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function getSongOfTheDay() {
    if (isLoading) return;

    const mood = input.value.trim();
    if (!mood) return;

    setLoading(true, "Finding a song...");

    try {
      const data = await postJSON(
        "https://song-website-63ex.onrender.com/api/song",
        { mood },
        12000
      );

      const { title, artist, image, spotifyUrl } = data;

      if (!title || !artist || !spotifyUrl) {
        throw new Error("Missing song data. Try again.");
      }

      // Redirect
      const query = new URLSearchParams({
        title,
        artist,
        image: image || "",
        spotifyUrl
      }).toString();

      result.style.display = "none";
      window.location.replace(`result.html?${query}`);
    } catch (err) {
      console.error("⚠️ Error:", err);
      result.style.display = "block";
      result.innerHTML = `
        <p style="color:white;font-family:'Helvetica Neue',sans-serif;">
          Something went wrong 😢<br>${err.message}
        </p>
      `;
    } finally {
      setLoading(false);
      input.disabled = false;
      if (svgIcon) svgIcon.style.pointerEvents = "auto";
    }
  }

  svgIcon.addEventListener("click", getSongOfTheDay);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") getSongOfTheDay();
  });
});

        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood })
      });

      const openaiData = await openaiRes.json();
      if (!openaiData.song) throw new Error('OpenAI did not return a song.');

      const song = openaiData.song.trim();
      console.log("🎤 OpenAI response:", song);

      // 🎼 Step 2: Parse song and artist
      let title = '', artist = '';

      if (song.includes(' - ')) {
        [title, artist] = song.split(' - ').map(str => str.trim());
      }

      if (!title || !artist) {
        const match = song.match(/^(.+?)\s+by\s+(.+)$/i);
        if (match) {
          title = match[1].trim();
          artist = match[2].trim();
        }
      }

      if (!title || !artist) {
        const lines = song.split('\n');
        const titleLine = lines.find(line => line.toLowerCase().includes('song'));
        const artistLine = lines.find(line => line.toLowerCase().includes('artist'));
        title = titleLine?.split(':')[1]?.trim() || '';
        artist = artistLine?.split(':')[1]?.trim() || '';
      }

      if (!title || !artist) {
        throw new Error('Could not parse song or artist.');
      }

      // 🔍 Step 3: Get Spotify info
      const spotifyRes = await fetch(`https://song-website-63ex.onrender.com/api/spotify-search?q=${encodeURIComponent(title + ' ' + artist)}`);
      const spotifyData = await spotifyRes.json();
      if (spotifyData.error) throw new Error(spotifyData.error);

      const { image, spotifyUrl } = spotifyData;

      // ✅ Step 4: Redirect and exit before catch can fire
      const query = new URLSearchParams({ title, artist, image, spotifyUrl }).toString();
      result.style.display = 'none';
      window.location.replace(`result.html?${query}`);
      return;

    } catch (err) {
      console.error("⚠️ Error:", err.message);
      result.style.display = 'block';
      result.innerHTML = `<p style="color: white; font-family: 'Helvetica Neue', sans-serif;">Something went wrong 😢<br>${err.message}</p>`;
    }
  }

  svgIcon.addEventListener('click', getSongOfTheDay);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') getSongOfTheDay();
  });
});
