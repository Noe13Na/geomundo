"use strict";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const number = value => new Intl.NumberFormat("pt-BR").format(value || 0);
const density = item => item.population && item.area ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(item.population / item.area)} hab./km²` : "Não disponível";

let countries = [];
let states = [];
let geojson = null;
let map = null;
let mapLayer = null;
let mapFeatures = new Map();
let selectedContinent = "Todos";
let selectedRegion = "Todas";
let showAllCountries = false;
let compareType = "countries";
const profile = JSON.parse(localStorage.getItem("geomundo-profile") || "null") || { name: "Explorador(a)", favorites: [] };

function saveProfile() {
  localStorage.setItem("geomundo-profile", JSON.stringify(profile));
}

function countryMatches(country, query) {
  return normalize([country.name, country.capital, country.continent, country.subregion, country.currency, country.languages].join(" ")).includes(query);
}

function renderCountries() {
  const query = normalize($("#countrySearch").value);
  const filtered = countries.filter(country => (selectedContinent === "Todos" || country.continent === selectedContinent) && countryMatches(country, query));
  const visible = showAllCountries || query || selectedContinent !== "Todos" ? filtered : filtered.slice(0, 12);
  $("#countryCount").textContent = `${filtered.length} ${filtered.length === 1 ? "país encontrado" : "países encontrados"}`;
  $("#countryGrid").innerHTML = visible.length ? visible.map(country => `
    <article class="country-card" data-country="${country.code}" tabindex="0">
      <button class="favorite-button" data-favorite="${country.code}" aria-label="${profile.favorites.includes(country.code) ? "Remover" : "Adicionar"} ${country.name} dos favoritos">${profile.favorites.includes(country.code) ? "★" : "☆"}</button>
      <span class="flag" aria-hidden="true">${country.flag}</span>
      <h3>${country.name}</h3>
      <p>${country.continent} · ${country.capital}</p>
      <p>${number(country.population)} habitantes</p>
    </article>`).join("") : '<p class="empty">Nenhum país corresponde à busca.</p>';
}

function renderStates() {
  const query = normalize($("#stateSearch").value);
  const filtered = states.filter(state => (selectedRegion === "Todas" || state.region === selectedRegion) && normalize([state.name, state.code, state.capital, state.region].join(" ")).includes(query));
  $("#stateGrid").innerHTML = filtered.length ? filtered.map(state => `
    <button class="state-card" data-state="${state.code}">
      <span class="state-code">${state.code}</span><span><h3>${state.name}</h3><p>${state.capital} · ${state.region}</p></span>
    </button>`).join("") : '<p class="empty">Nenhum estado corresponde à busca.</p>';
}

function detailItems(item, type) {
  const common = [
    ["População", `${number(item.population)} habitantes`], ["Área", `${number(item.area)} km²`], ["Densidade", density(item)],
    ["Clima", item.climate], ["Relevo", item.relief], ["Biomas", item.biomes]
  ];
  return type === "country" ? [["Continente", item.continent], ["Capital", item.capital], ["Moeda", item.currency], ["Idiomas", item.languages], ...common] : [["Região", item.region], ["Capital", item.capital], ...common];
}

function openDetail(item, type) {
  if (!item) return;
  const isCountry = type === "country";
  $("#detailContent").innerHTML = `<div class="detail-body">
    <div class="detail-hero"><span class="detail-flag" aria-hidden="true">${isCountry ? item.flag : "🇧🇷"}</span><div><p>${isCountry ? item.continent : item.region}</p><h2>${item.name}</h2></div></div>
    <div class="detail-grid">${detailItems(item, type).map(([label, value]) => `<div class="detail-item"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>
    <p class="curiosity"><strong>Curiosidade</strong><br>${item.curiosity}</p>
    ${isCountry ? `<div class="country-live-actions"><a class="button secondary" href="https://www.frontpages.com/world-newspapers/" target="_blank" rel="noopener noreferrer">📰 Ver jornais</a><a class="button secondary" href="https://radio.garden/" target="_blank" rel="noopener noreferrer">📻 Ouvir rádios</a><small>Recursos externos: precisam de internet.</small></div>` : ""}
  </div>`;
  $("#detailDialog").showModal();
}

function renderFavorites() {
  const items = profile.favorites.map(code => countries.find(country => country.code === code)).filter(Boolean);
  $("#favoriteCount").textContent = items.length;
  $("#favoriteList").innerHTML = items.length ? items.map(country => `<button class="favorite-pill" data-open-favorite="${country.code}">${country.flag} ${country.name}</button>`).join("") : '<p class="empty">Use a estrela nos cards para guardar países aqui.</p>';
}

function toggleFavorite(code) {
  profile.favorites = profile.favorites.includes(code) ? profile.favorites.filter(item => item !== code) : [...profile.favorites, code];
  saveProfile();
  renderCountries();
  renderFavorites();
}

function mapStyle(feature) {
  const favorite = profile.favorites.includes(feature.properties.code);
  return { color: "#f5faf7", weight: 0.7, fillColor: favorite ? "#f4bb43" : "#168b74", fillOpacity: favorite ? 0.92 : 0.72 };
}

function initializeMap() {
  $("#worldMap").innerHTML = "";
  map = L.map("worldMap", { minZoom: 1, maxZoom: 8, worldCopyJump: true, zoomControl: true, attributionControl: false }).setView([18, 0], 2);
  map.createPane("ocean");
  $("#worldMap").style.background = document.documentElement.dataset.theme === "dark" ? "#17332f" : "#cce8e2";
  mapLayer = L.geoJSON(geojson, {
    style: mapStyle,
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 6, color: "#fff", weight: 1, fillColor: "#168b74", fillOpacity: 1 }),
    onEachFeature: (feature, layer) => {
      mapFeatures.set(feature.properties.code, layer);
      layer.bindTooltip(feature.properties.name, { sticky: true, className: "country-tooltip" });
      layer.on({
        click: () => openDetail(countries.find(country => country.code === feature.properties.code), "country"),
        mouseover: event => event.target.setStyle?.({ fillColor: "#f4bb43", fillOpacity: 0.95 }),
        mouseout: event => mapLayer.resetStyle?.(event.target)
      });
    }
  }).addTo(map);
  map.fitBounds(mapLayer.getBounds(), { padding: [8, 8] });
}

function locateCountry(value) {
  const query = normalize(value);
  const country = countries.find(item => normalize(item.name).includes(query) || normalize(item.capital).includes(query));
  if (!country) return false;
  const layer = mapFeatures.get(country.code);
  if (layer) {
    if (layer.getBounds) map.fitBounds(layer.getBounds(), { maxZoom: 5, padding: [30, 30] });
    else map.setView(layer.getLatLng(), 6);
    layer.openTooltip();
  }
  return true;
}

function populateCompare() {
  const list = compareType === "countries" ? countries : states;
  const options = list.map((item, index) => `<option value="${item.code}" ${index === 0 ? "selected" : ""}>${item.name}</option>`).join("");
  $("#compareA").innerHTML = options;
  $("#compareB").innerHTML = list.map((item, index) => `<option value="${item.code}" ${index === 1 ? "selected" : ""}>${item.name}</option>`).join("");
  renderComparison();
}

function renderComparison() {
  const list = compareType === "countries" ? countries : states;
  const a = list.find(item => item.code === $("#compareA").value);
  const b = list.find(item => item.code === $("#compareB").value);
  if (!a || !b) return;
  const rows = item => [["Capital", item.capital], ["População", number(item.population)], ["Área", `${number(item.area)} km²`], ["Densidade", density(item)], ["Clima", item.climate], ["Biomas", item.biomes]];
  const column = item => `<article class="compare-column"><h3><span>${compareType === "countries" ? item.flag : "🇧🇷"}</span>${item.name}</h3><div class="data-list">${rows(item).map(([label, value]) => `<div class="data-row"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div></article>`;
  $("#compareResult").innerHTML = column(a) + column(b);
}

function bindEvents() {
  $("#countrySearch").addEventListener("input", renderCountries);
  $("#stateSearch").addEventListener("input", renderStates);
  $("#toggleCountries").addEventListener("click", () => { showAllCountries = !showAllCountries; $("#toggleCountries").textContent = showAllCountries ? "Mostrar destaques" : "Ver todos"; renderCountries(); });
  $("#continentFilters").addEventListener("click", event => { const button = event.target.closest("[data-continent]"); if (!button) return; selectedContinent = button.dataset.continent; $$("[data-continent]").forEach(item => item.classList.toggle("active", item === button)); renderCountries(); });
  $("#regionFilters").addEventListener("click", event => { const button = event.target.closest("[data-region]"); if (!button) return; selectedRegion = button.dataset.region; $$("[data-region]").forEach(item => item.classList.toggle("active", item === button)); renderStates(); });
  $("#countryGrid").addEventListener("click", event => { const favorite = event.target.closest("[data-favorite]"); if (favorite) { event.stopPropagation(); toggleFavorite(favorite.dataset.favorite); return; } const card = event.target.closest("[data-country]"); if (card) openDetail(countries.find(item => item.code === card.dataset.country), "country"); });
  $("#countryGrid").addEventListener("keydown", event => { if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-country]")) { event.preventDefault(); openDetail(countries.find(item => item.code === event.target.dataset.country), "country"); } });
  $("#stateGrid").addEventListener("click", event => { const card = event.target.closest("[data-state]"); if (card) openDetail(states.find(item => item.code === card.dataset.state), "state"); });
  $("#favoriteList").addEventListener("click", event => { const button = event.target.closest("[data-open-favorite]"); if (button) openDetail(countries.find(item => item.code === button.dataset.openFavorite), "country"); });
  $$("[data-type]").forEach(tab => tab.addEventListener("click", () => { compareType = tab.dataset.type; $$("[data-type]").forEach(item => item.classList.toggle("active", item === tab)); populateCompare(); }));
  $("#compareA").addEventListener("change", renderComparison); $("#compareB").addEventListener("change", renderComparison);
  $("#mapSearch").addEventListener("change", event => { if (!locateCountry(event.target.value)) event.target.setCustomValidity("País não encontrado"); else event.target.setCustomValidity(""); event.target.reportValidity(); });
  $("#mapSearch").addEventListener("input", event => event.target.setCustomValidity(""));
  $("#resetMap").addEventListener("click", () => map.fitBounds(mapLayer.getBounds(), { padding: [8, 8] }));
  $("#closeDialog").addEventListener("click", () => $("#detailDialog").close());
  $("#detailDialog").addEventListener("click", event => { if (event.target === $("#detailDialog")) event.target.close(); });
  $("#profileName").value = profile.name; $("#profileName").addEventListener("change", event => { profile.name = event.target.value.trim() || "Explorador(a)"; event.target.value = profile.name; saveProfile(); });
  const nav = $("#mainNav"), menuButton = $("#menuButton"); menuButton.addEventListener("click", () => { const open = nav.classList.toggle("open"); menuButton.setAttribute("aria-expanded", String(open)); }); $$("#mainNav a").forEach(link => link.addEventListener("click", () => nav.classList.remove("open")));
}

function initializeTheme() {
  const saved = localStorage.getItem("geomundo-theme");
  const theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  $("#themeButton").textContent = theme === "dark" ? "☀️" : "🌙";
  $("#themeButton").addEventListener("click", () => { const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; localStorage.setItem("geomundo-theme", next); $("#themeButton").textContent = next === "dark" ? "☀️" : "🌙"; $("#worldMap").style.background = next === "dark" ? "#17332f" : "#cce8e2"; });
}

async function loadData() {
  const responses = await Promise.all([fetch("./data/countries.json"), fetch("./data/states.json"), fetch("./data/world.geojson")]);
  if (responses.some(response => !response.ok)) throw new Error("Não foi possível carregar os dados locais.");
  [countries, states, geojson] = await Promise.all(responses.map(response => response.json()));
}

let installPrompt = null;
window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; $("#installButton").hidden = false; });
$("#installButton").addEventListener("click", async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $("#installButton").hidden = true; });
window.addEventListener("appinstalled", () => { $("#installButton").hidden = true; });

async function start() {
  initializeTheme();
  $("#year").textContent = new Date().getFullYear();
  try {
    await loadData();
    renderCountries(); renderStates(); renderFavorites(); populateCompare(); initializeMap(); bindEvents();
  } catch (error) {
    console.error(error);
    $("#worldMap").innerHTML = '<div class="map-loading">Dados indisponíveis. Recarregue a página ou verifique a conexão.</div>';
    $("#countryGrid").innerHTML = '<p class="empty">Não foi possível carregar o atlas.</p>';
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(error => console.error("Falha ao registrar o modo offline:", error));
}

start();
