document.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector('.mood-input');
  const svgIcon = document.querySelector('.svg-icon');
  const result = document.getElementById('result');

  async function getSongOfTheDay() {
    const mood = input.value.trim();
    if (!mood) return;

    result.textContent = 'Thinking...';

    try {
      // 1. Get song suggestion from OpenAI
      const openaiRes = await fetch('http://localhost:3000/api/openai-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood })
      });

      const openaiData = await openaiRes.json();
      if (!openaiData.song) throw new Error('OpenAI did not return a song.');

      const song = openaiData.song;
      console.log("OpenAI response:", song);

      // 2. Parse song + artist
      let title = '', artist = '';
      const match = song.match(/^(.+?)\s+by\s+(.+)$/i);
      if (match) {
        title = match[1].trim();
        artist = match[2].trim();
      } else {
        const lines = song.split('\n');
        const titleLine = lines.find(line => line.toLowerCase().includes('song'));
        const artistLine = lines.find(line => line.toLowerCase().includes('artist'));
        title = titleLine?.split(':')[1]?.trim() || '';
        artist = artistLine?.split(':')[1]?.trim() || '';
        if (!title || !artist) throw new Error('Could not parse song or artist.');
      }

      // 3. Get track info from Spotify
      const spotifyRes = await fetch(`http://localhost:3000/api/spotify-search?q=${encodeURIComponent(title + ' ' + artist)}`);
      const spotifyData = await spotifyRes.json();
      if (spotifyData.error) throw new Error(spotifyData.error);

      const { image, spotifyUrl } = spotifyData;

      // ✅ 4. Redirect — hard stop
      const query = new URLSearchParams({ title, artist, image, spotifyUrl }).toString();
      window.location.replace(`result.html?${query}`);
      return; // 💯 STOP function — no catch will fire

    } catch (err) {
      console.error("⚠️ Error:", err);
      result.innerHTML = `<p style="color: white; font-family: 'Helvetica Neue', sans-serif;">Something went wrong 😢<br>${err.message}</p>`;
    }
  }

  svgIcon.addEventListener('click', getSongOfTheDay);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') getSongOfTheDay();
  });
});
