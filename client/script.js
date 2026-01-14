document.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector(".mood-input");
  const svgIcon = document.querySelector(".svg-icon");
  const result = document.getElementById("result");

  const showError = (message) => {
    result.style.display = "block";
    result.innerHTML = `
      <p style="color: white; font-family: 'Helvetica Neue', sans-serif;">
        Something went wrong 😢<br>${message}
      </p>
    `;
  };

  const setLoading = (isLoading) => {
    if (isLoading) {
      result.textContent = "Thinking...";
      result.style.display = "block";
      svgIcon.style.pointerEvents = "none";
      svgIcon.style.opacity = "0.7";
    } else {
      svgIcon.style.pointerEvents = "auto";
      svgIcon.style.opacity = "1";
    }
  };

  // Parses "Song Title - Artist Name" OR "Song Title by Artist"
  const parseSongArtist = (raw) => {
    const song = (raw || "").trim();

    // Remove wrapping quotes if any
    const cleaned = song.replace(/^"+|"+$/g, "").trim();

    // Format: Title - Artist
    if (cleaned.includes(" - ")) {
      const [title, artist] = cleaned.split(" - ").map((s) => s.trim());
      return { title, artist };
    }

    // Format: Title by Artist
    const byMatch = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
    if (byMatch) {
      return { title: byMatch[1].trim(), artist: byMatch[2].trim() };
    }

    return { title: "", artist: "" };
  };

  async function getSongOfTheDay() {
    const mood = input.value.trim();
    if (!mood) return;

    setLoading(true);

    try {
      // 1) Get song string from your server (OpenAI)
      const openaiRes = await fetch("/api/openai-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood })
      });

      const openaiData = await openaiRes.json();
      if (!openaiRes.ok) {
        throw new Error(openaiData?.error || "OpenAI request failed.");
      }

      const rawSong = openaiData.song;
      if (!rawSong) throw new Error("No song returned from OpenAI.");

      const { title, artist } = parseSongArtist(rawSong);

      if (!title || !artist) {
        throw new Error(`Could not parse song/artist from: ${rawSong}`);
      }

      // 2) Search Spotify using your server
      const spotifyQuery = encodeURIComponent(`${title} ${artist}`);
      const spotifyRes = await fetch(`/api/spotify-search?q=${spotifyQuery}`);

      const spotifyData = await spotifyRes.json();
      if (!spotifyRes.ok) {
        throw new Error(spotifyData?.error || "Spotify request failed.");
      }

      const { image, spotifyUrl } = spotifyData;
      if (!spotifyUrl) throw new Error("Spotify did not return a track link.");

      // 3) Redirect to result page with URL-safe params
      const query = new URLSearchParams({
        title,
        artist,
        image: image || "",
        spotifyUrl
      }).toString();

      result.style.display = "none";
      window.location.href = `result.html?${query}`;
    } catch (err) {
      console.error("⚠️ Error:", err);
      showError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Click submit
  svgIcon.addEventListener("click", getSongOfTheDay);

  // Keyboard submit
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") getSongOfTheDay();
  });

  // Accessibility: press Enter/Space when SVG is focused
  svgIcon.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") getSongOfTheDay();
  });
});
