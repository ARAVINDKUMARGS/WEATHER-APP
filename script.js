// SpireX Weather uses Open-Meteo, so no API key or backend is required.
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const state = {
  location: null,
  weather: null,
  unit: localStorage.getItem("weather-unit") || "metric"
};
const $ = selector => document.querySelector(selector);

const WEATHER_CODES = {
  0: ["Clear sky", "☀️", "clear"],
  1: ["Mainly clear", "🌤️", "clear"], 2: ["Partly cloudy", "⛅", "clouds"], 3: ["Overcast", "☁️", "clouds"],
  45: ["Fog", "🌫️", "fog"], 48: ["Depositing rime fog", "🌫️", "fog"],
  51: ["Light drizzle", "🌦️", "rain"], 53: ["Drizzle", "🌦️", "rain"], 55: ["Dense drizzle", "🌧️", "rain"],
  56: ["Freezing drizzle", "🌧️", "rain"], 57: ["Freezing drizzle", "🌧️", "rain"],
  61: ["Slight rain", "🌦️", "rain"], 63: ["Rain", "🌧️", "rain"], 65: ["Heavy rain", "🌧️", "rain"],
  66: ["Freezing rain", "🌧️", "rain"], 67: ["Heavy freezing rain", "🌧️", "rain"],
  71: ["Slight snow", "🌨️", "snow"], 73: ["Snow", "❄️", "snow"], 75: ["Heavy snow", "❄️", "snow"], 77: ["Snow grains", "🌨️", "snow"],
  80: ["Rain showers", "🌦️", "rain"], 81: ["Rain showers", "🌧️", "rain"], 82: ["Heavy rain showers", "⛈️", "rain"],
  85: ["Snow showers", "🌨️", "snow"], 86: ["Heavy snow showers", "❄️", "snow"],
  95: ["Thunderstorm", "⛈️", "thunderstorm"], 96: ["Thunderstorm with hail", "⛈️", "thunderstorm"], 99: ["Thunderstorm with hail", "⛈️", "thunderstorm"]
};

function setHidden(selector, hidden) { $(selector).hidden = hidden; }
function setMessage(message = "") { $("#form-message").textContent = message; }
function getCondition(code) { return WEATHER_CODES[code] || ["Unknown conditions", "🌤️", "clouds"]; }
function getUnitLabel() { return state.unit === "metric" ? "°C" : "°F"; }
function displayTemperature(value) { return `${Math.round(value)}°`; }
function displayTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function displayDate(value) {
  return new Intl.DateTimeFormat([], { weekday: "long", month: "short", day: "numeric" }).format(new Date(value));
}
function directionName(degrees) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];
}
function createUrl(base, parameters) {
  return `${base}?${new URLSearchParams(parameters)}`;
}
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Weather service returned ${response.status}.`);
  return response.json();
}
async function searchCity(city) {
  const data = await fetchJson(createUrl(GEOCODING_URL, { name: city, count: 1, language: "en", format: "json" }));
  if (!data.results?.length) throw new Error(`No city matched “${city}”. Try a nearby city or check the spelling.`);
  const result = data.results[0];
  return { latitude: result.latitude, longitude: result.longitude, name: result.name, country: result.country_code || result.country || "" };
}
async function getWeather(location) {
  const units = state.unit === "metric"
    ? { temperature_unit: "celsius", wind_speed_unit: "kmh", precipitation_unit: "mm" }
    : { temperature_unit: "fahrenheit", wind_speed_unit: "mph", precipitation_unit: "inch" };
  return fetchJson(createUrl(FORECAST_URL, {
    latitude: location.latitude, longitude: location.longitude, timezone: "auto",
    forecast_days: 5, current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,visibility",
    hourly: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset", ...units
  }));
}
async function loadWeather(location) {
  setLoading(true);
  setMessage("");
  try {
    const weather = await getWeather(location);
    state.location = location;
    state.weather = weather;
    saveRecent(location);
    renderWeather();
  } catch (error) {
    showError(error.message || "Unable to load weather right now.");
  } finally {
    setLoading(false);
  }
}
function setLoading(loading) {
  setHidden("#loading-state", !loading);
  if (loading) { setHidden("#weather-content", true); setHidden("#error-state", true); }
}
function showError(message) {
  $("#error-message").textContent = message;
  setHidden("#error-state", false);
  setHidden("#weather-content", true);
}
function renderWeather() {
  const { current, daily } = state.weather;
  const condition = getCondition(current.weather_code);
  const unit = getUnitLabel();
  $("#location-name").textContent = `${state.location.name}${state.location.country ? `, ${state.location.country}` : ""}`;
  $("#current-date").textContent = displayDate(new Date());
  $("#last-updated").textContent = `Updated ${displayTime(new Date())}`;
  $("#weather-description").textContent = condition[0];
  $("#temperature").textContent = Math.round(current.temperature_2m);
  $("#temperature-unit").textContent = unit;
  $("#feels-like").textContent = Math.round(current.apparent_temperature);
  $("#feels-unit").textContent = unit;
  $("#weather-icon").textContent = condition[1];
  $("#weather-icon").setAttribute("aria-label", condition[0]);
  $("#humidity").textContent = `${Math.round(current.relative_humidity_2m)}%`;
  $("#humidity-bar").style.width = `${current.relative_humidity_2m}%`;
  $("#wind").textContent = `${Math.round(current.wind_speed_10m)} ${state.unit === "metric" ? "km/h" : "mph"}`;
  $("#wind-direction").textContent = `${directionName(current.wind_direction_10m)} ${Math.round(current.wind_direction_10m)}°`;
  $("#pressure").textContent = Math.round(current.surface_pressure);
  $("#visibility").textContent = current.visibility == null ? "—" : (current.visibility / 1000).toFixed(1);
  $("#sunrise").textContent = displayTime(daily.sunrise[0]);
  $("#sunset").textContent = displayTime(daily.sunset[0]);
  document.body.dataset.weather = condition[2];
  renderForecast();
  renderHourly();
  updateUnitButtons();
  setHidden("#weather-content", false);
  setHidden("#error-state", true);
}
function renderForecast() {
  const { daily } = state.weather;
  $("#forecast-list").innerHTML = daily.time.map((date, index) => {
    const condition = getCondition(daily.weather_code[index]);
    const day = new Date(`${date}T12:00:00`);
    return `<article class="forecast-day glass-card ${index === 0 ? "today" : ""}">
      <small>${index === 0 ? "Today" : new Intl.DateTimeFormat([], { weekday: "short" }).format(day)}</small>
      <span class="forecast-icon" role="img" aria-label="${condition[0]}">${condition[1]}</span>
      <span class="day-temp">${displayTemperature(daily.temperature_2m_max[index])}</span>
      <span class="low-temp">${displayTemperature(daily.temperature_2m_min[index])}</span>
      <p>${condition[0]}</p>
    </article>`;
  }).join("");
}
function renderHourly() {
  const { hourly } = state.weather;
  const start = hourly.time.findIndex(time => new Date(time) >= new Date());
  const first = start < 0 ? 0 : start;
  $("#hourly-list").innerHTML = hourly.time.slice(first, first + 8).map((time, index) => {
    const sourceIndex = first + index;
    const condition = getCondition(hourly.weather_code[sourceIndex]);
    return `<article class="hour glass-card ${index === 0 ? "now" : ""}">
      <small>${index === 0 ? "Now" : displayTime(time)}</small>
      <span class="hour-icon" role="img" aria-label="${condition[0]}">${condition[1]}</span>
      <strong>${displayTemperature(hourly.temperature_2m[sourceIndex])}</strong>
      <p>${condition[0]}</p>
    </article>`;
  }).join("");
}
function saveRecent(location) {
  const recent = JSON.parse(localStorage.getItem("weather-recent") || "[]")
    .filter(item => item.name.toLowerCase() !== location.name.toLowerCase());
  recent.unshift(location);
  localStorage.setItem("weather-recent", JSON.stringify(recent.slice(0, 5)));
  renderRecent();
}
function renderRecent() {
  const recent = JSON.parse(localStorage.getItem("weather-recent") || "[]");
  $("#recent-menu").innerHTML = recent.length
    ? recent.map((item, index) => `<button type="button" data-index="${index}">${item.name}, ${item.country}</button>`).join("")
    : "<span class='stat-note'>No recent searches</span>";
  $("#recent-menu").querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    $("#recent-menu").hidden = true;
    loadWeather(recent[Number(button.dataset.index)]);
  }));
}
function updateUnitButtons() {
  document.querySelectorAll(".unit-button").forEach(button => button.classList.toggle("active", button.dataset.unit === state.unit));
}
function toggleTheme() {
  const light = document.documentElement.dataset.theme === "light";
  document.documentElement.dataset.theme = light ? "dark" : "light";
  localStorage.setItem("weather-theme", light ? "dark" : "light");
  $("#theme-toggle").setAttribute("aria-label", light ? "Switch to light mode" : "Switch to dark mode");
}

$("#search-form").addEventListener("submit", async event => {
  event.preventDefault();
  const city = $("#city-input").value.trim();
  if (city.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(city)) {
    setMessage("Enter a valid city name.");
    return;
  }
  try {
    setLoading(true);
    const location = await searchCity(city);
    await loadWeather(location);
  } catch (error) {
    showError(error.message || "Unable to find that city.");
    setLoading(false);
  }
});
$("#location-button").addEventListener("click", () => {
  if (!navigator.geolocation) { setMessage("Geolocation is not supported by this browser."); return; }
  setMessage("Requesting your location...");
  navigator.geolocation.getCurrentPosition(
    position => loadWeather({ latitude: position.coords.latitude, longitude: position.coords.longitude, name: "Current location", country: "" }),
    () => setMessage("Location access was unavailable. Search for a city instead."),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});
$("#refresh-button").addEventListener("click", () => state.location && loadWeather(state.location));
$("#retry-button").addEventListener("click", () => state.location && loadWeather(state.location));
$("#theme-toggle").addEventListener("click", toggleTheme);
$("#recent-toggle").addEventListener("click", () => {
  const menu = $("#recent-menu");
  menu.hidden = !menu.hidden;
  $("#recent-toggle").setAttribute("aria-expanded", String(!menu.hidden));
});
document.querySelectorAll(".unit-button").forEach(button => button.addEventListener("click", () => {
  if (button.dataset.unit === state.unit) return;
  state.unit = button.dataset.unit;
  localStorage.setItem("weather-unit", state.unit);
  if (state.location) loadWeather(state.location);
}));
document.documentElement.dataset.theme = localStorage.getItem("weather-theme") || "dark";
$("#footer-year").textContent = new Date().getFullYear();
updateUnitButtons();
renderRecent();
