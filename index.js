const startButton = document.getElementById("startButton");
const appContainer = document.getElementById("appContainer");

let profiles = [];
let currentPersonIndex = 0;
let totalPeople = 0;
let availableMinutes = 0;

startButton.addEventListener("click", () => {
  totalPeople = parseInt(document.getElementById("peopleCount").value);
  const timeText = document.getElementById("availableTime").value;
  availableMinutes = parseTimeToMinutes(timeText);

  currentPersonIndex = 0;
  profiles = [];
  renderPersonQuestions();
});

function parseTimeToMinutes(text) {
  const hoursMatch = text.match(/(\d+)\s*h/);
  const minutesMatch = text.match(/(\d+)\s*m/);
  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
  return hours * 60 + minutes;
}

function renderPersonQuestions() {
  const personNumber = currentPersonIndex + 1;
  const isLastPerson = personNumber === totalPeople;

  appContainer.innerHTML = `
    <div>
      <p>Person ${personNumber}</p>
            <label>What's your favorite movie?</label>
      <input type="text" id="favoriteMovie" placeholder="e.g. Knives Out" required />

      <label>Why do you love it? (optional)</label>
      <textarea id="favoriteMovieWhy" placeholder="e.g. I love a good twist ending"></textarea>

      <label>Are you in the mood for something new or a classic?</label>
      <div>
        <button type="button" data-value="New" class="newOrClassicBtn">New</button>
        <button type="button" data-value="Classic" class="newOrClassicBtn">Classic</button>
      </div>

            <label>What are you in the mood for?</label>
      <div>
        <button type="button" data-value="Comedy" class="moodBtn">Comedy</button>
        <button type="button" data-value="Drama" class="moodBtn">Drama</button>
        <button type="button" data-value="Mystery" class="moodBtn">Mystery</button>
        <button type="button" data-value="Horror" class="moodBtn">Horror</button>
        <button type="button" data-value="Thriller" class="moodBtn">Thriller</button>
        <button type="button" data-value="Romance" class="moodBtn">Romance</button>
        <button type="button" data-value="Action" class="moodBtn">Action</button>
        <button type="button" data-value="Sci-Fi" class="moodBtn">Sci-Fi</button>
        <button type="button" data-value="Fantasy" class="moodBtn">Fantasy</button>
        <button type="button" data-value="Documentary" class="moodBtn">Documentary</button>
        <button type="button" data-value="Animation" class="moodBtn">Animation</button>
      </div>

      <label>Any genre you'd rather avoid today? (optional)</label>
      <input type="text" id="genreToAvoid" placeholder="e.g. Horror" />

      <button id="nextButton">${isLastPerson ? "Get Movie" : "Next Person"}</button>
    </div>
  `;

  let selectedNewOrClassic = null;
  let selectedMood = null;

  document.querySelectorAll(".newOrClassicBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedNewOrClassic = btn.dataset.value;
    });
  });

  document.querySelectorAll(".moodBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedMood = btn.dataset.value;
    });
  });

  document.getElementById("nextButton").addEventListener("click", () => {
    const movieTitle = document.getElementById("favoriteMovie").value;
    const movieWhy = document.getElementById("favoriteMovieWhy").value.trim();

    const personProfile = {
      favoriteMovie: movieWhy ? `${movieTitle} — ${movieWhy}` : movieTitle,
      newOrClassic: selectedNewOrClassic,
      mood: selectedMood,
      genreToAvoid: document.getElementById("genreToAvoid").value.trim(),
    };

    profiles.push(personProfile);
    currentPersonIndex++;

    if (currentPersonIndex < totalPeople) {
      renderPersonQuestions();
    } else {
      submitProfiles();
    }
  });
}

async function submitProfiles() {
  appContainer.innerHTML = `<p>Finding your movies...</p>`;

  const response = await fetch("http://localhost:3000/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ people: profiles, availableMinutes }),
  });

  const data = await response.json();
  renderResults(data.picks);
}

let currentMovieIndex = 0;

function renderResults(picks) {
  currentMovieIndex = 0;
  renderMovieCard(picks);
}

function renderMovieCard(picks) {
  const movie = picks[currentMovieIndex];
  const isLastMovie = currentMovieIndex === picks.length - 1;

  appContainer.innerHTML = `
    <div>
      <h2>${movie.title} (${movie.releaseYear})</h2>
      <img src="${movie.posterUrl || "./images/no-poster.png"}" alt="${movie.title} poster" />
      <p>${movie.description}</p>
      <button id="nextMovieButton">${isLastMovie ? "Start Over" : "Next Movie"}</button>
    </div>
  `;

  document.getElementById("nextMovieButton").addEventListener("click", () => {
    if (isLastMovie) {
      location.reload();
    } else {
      currentMovieIndex++;
      renderMovieCard(picks);
    }
  });
}
