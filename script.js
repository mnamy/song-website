document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ script loaded");

  var input = document.querySelector(".mood-input");
  var svgIcon = document.querySelector(".svg-icon");
  var result = document.getElementById("result");

  console.log("input?", !!input, "icon?", !!svgIcon, "result?", !!result);

  if (!input || !svgIcon || !result) return;

  var loading = false;

  function showError(msg) {
    result.style.display = "block";
    result.innerHTML =
      "<p style=\"color:white;font-family:'Helvetica Neue',sans-serif;\">Something went wrong 😢<br>" +
      msg +
      "</p>";
  }

  function setLoading(on, text) {
    loading = on;
    input.disabled = on;
    svgIcon.style.pointerEvents = on ? "none" : "auto";
    result.style.display = "block";
    result.textContent = on ? (text || "Finding a song...") : "";
  }

  function postJSON(url, body, timeoutMs) {
    timeoutMs = timeoutMs || 12000;

    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () { return {}; })
          .then(function (data) {
            if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
            return data;
          });
      })
      .finally(function () {
        clearTimeout(timeoutId);
      });
  }

  function getSongOfTheDay() {
    if (loading) return;

    var mood = input.value.trim();
    if (!mood) return;

    setLoading(true, "Finding a song...");

    postJSON("https://song-website-63ex.onrender.com/api/song", { mood: mood }, 12000)
      .then(function (data) {
        if (!data.title || !data.artist || !data.spotifyUrl) {
          throw new Error("Missing song data. Try again.");
        }

        var params = new URLSearchParams({
          title: data.title,
          artist: data.artist,
          image: data.image || "",
          spotifyUrl: data.spotifyUrl
        });

        result.style.display = "none";
        window.location.replace("result.html?" + params.toString());
      })
      .catch(function (err) {
        console.error("⚠️", err);
        if (err.name === "AbortError") showError("Timed out. Try again.");
        else showError(err.message || "Unknown error");
      })
      .finally(function () {
        setLoading(false);
      });
  }

  svgIcon.addEventListener("click", getSongOfTheDay);

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") getSongOfTheDay();
  });
});
