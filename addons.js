"use strict";

(() => {
  const byId = id => document.getElementById(id);
  const norm = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  async function waitForAtlas() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (typeof countries !== "undefined" && countries.length && typeof geojson !== "undefined" && geojson) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("Atlas local não ficou disponível.");
  }

  function initGlobe() {
    const canvas = byId("globeCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let longitude = -20, latitude = -12, zoom = 1, rotating = true, dragging = false;
    let startX = 0, startY = 0, moved = false, paths = [];

    const project = ([lon, lat]) => {
      const lambda = (lon - longitude) * Math.PI / 180;
      const phi = lat * Math.PI / 180;
      const phi0 = -latitude * Math.PI / 180;
      const visible = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda);
      const r = canvas.width * .43 * zoom;
      return [canvas.width / 2 + r * Math.cos(phi) * Math.sin(lambda), canvas.height / 2 - r * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda)), visible];
    };

    const polygonsOf = geometry => geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    function draw() {
      const dark = document.documentElement.dataset.theme === "dark";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const radius = canvas.width * .43 * zoom;
      const gradient = ctx.createRadialGradient(canvas.width * .38, canvas.height * .32, radius * .08, canvas.width / 2, canvas.height / 2, radius);
      gradient.addColorStop(0, dark ? "#4bb8d2" : "#69d7ef"); gradient.addColorStop(.72, dark ? "#126184" : "#168fc1"); gradient.addColorStop(1, dark ? "#082c43" : "#075b8b");
      ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2); ctx.fillStyle = gradient; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2); ctx.clip();
      paths = [];
      geojson.features.forEach(feature => polygonsOf(feature.geometry).forEach(polygon => {
        polygon.forEach((ring, ringIndex) => {
          const path = new Path2D(); let started = false; let frontPoints = 0;
          ring.forEach(point => { const [x, y, front] = project(point); if (front > -.04) { started ? path.lineTo(x, y) : path.moveTo(x, y); started = true; if (front > 0) frontPoints += 1; } });
          if (!started || frontPoints < 2) return;
          path.closePath();
          if (ringIndex === 0) { ctx.fillStyle = dark ? "#44a979" : "#4fc78b"; ctx.fill(path); paths.push({ path, feature }); }
          ctx.strokeStyle = dark ? "#c7ead8" : "#eafff5"; ctx.lineWidth = .8; ctx.stroke(path);
        });
      }));
      ctx.restore();
      ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2); ctx.strokeStyle = dark ? "#6bb8bf" : "#bde7e4"; ctx.lineWidth = 3; ctx.stroke();
    }

    function frame() { if (rotating && !dragging) longitude = (longitude + .035) % 360; draw(); requestAnimationFrame(frame); }
    const pointer = event => { const box = canvas.getBoundingClientRect(); return [(event.clientX - box.left) * canvas.width / box.width, (event.clientY - box.top) * canvas.height / box.height]; };
    canvas.addEventListener("pointerdown", event => { dragging = true; moved = false; startX = event.clientX; startY = event.clientY; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener("pointermove", event => { if (!dragging) return; const dx = event.clientX - startX, dy = event.clientY - startY; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; longitude -= dx * .35; latitude = Math.max(-75, Math.min(75, latitude + dy * .25)); startX = event.clientX; startY = event.clientY; });
    canvas.addEventListener("pointerup", event => { dragging = false; if (moved) return; const [x, y] = pointer(event); const hit = [...paths].reverse().find(item => ctx.isPointInPath(item.path, x, y)); if (!hit) return; const country = countries.find(item => item.code === hit.feature.properties.code); if (country) { byId("globeCountry").textContent = `${country.flag} ${country.name}`; byId("globeCountryHint").textContent = country.capital; openDetail(country, "country"); } });
    canvas.addEventListener("wheel", event => { event.preventDefault(); zoom = Math.max(.72, Math.min(1.12, zoom - Math.sign(event.deltaY) * .06)); }, { passive: false });
    byId("toggleGlobeRotation").addEventListener("click", event => { rotating = !rotating; event.currentTarget.textContent = rotating ? "Pausar rotação" : "Continuar rotação"; });
    byId("resetGlobe").addEventListener("click", () => { longitude = -20; latitude = -12; zoom = 1; });
    frame();
  }

  function initBrazilMap() {
    const positions = { RR:[2,3],AP:[2,5],AM:[3,2],PA:[3,4],AC:[4,1],RO:[4,2],TO:[4,4],MA:[4,5],PI:[4,6],CE:[4,7],RN:[4,8],PB:[5,8],PE:[5,7],AL:[6,8],SE:[7,8],BA:[6,6],MT:[5,3],GO:[6,4],DF:[6,5],MS:[7,3],MG:[7,5],ES:[7,6],RJ:[8,6],SP:[8,4],PR:[9,4],SC:[10,4],RS:[11,3] };
    const mapEl = byId("brazilMap");
    states.forEach(state => { const button = document.createElement("button"); const pos = positions[state.code] || [1,1]; button.className = `uf-tile region-${norm(state.region).replace("-", "")}`; button.style.gridRow = pos[0]; button.style.gridColumn = pos[1]; button.innerHTML = `<strong>${state.code}</strong><span>${state.name}</span>`; button.title = `${state.name} — capital: ${state.capital}`; button.addEventListener("click", () => openDetail(state, "state")); mapEl.appendChild(button); });
  }

  const gallery = [
    ["Floresta tropical","🌳","Quente, úmida e estratificada, abriga enorme variedade de espécies.","#176b4c"],
    ["Savana","🦒","Gramíneas, arbustos e árvores espaçadas adaptadas à alternância entre chuva e seca.","#b37a28"],
    ["Deserto","🏜️","Ambiente de baixa precipitação, grande amplitude térmica e organismos especializados.","#c8893b"],
    ["Tundra","❄️","Vegetação rasteira de regiões muito frias, com solo congelado durante longos períodos.","#6a8ca1"],
    ["Montanhas","🏔️","Grandes elevações onde altitude, inclinação e orientação alteram clima e vegetação.","#667a78"],
    ["Manguezal","🦀","Ecossistema costeiro entre rios e mar, berçário natural de inúmeras espécies.","#306c63"]
  ];
  function initGallery() { byId("galleryGrid").innerHTML = gallery.map(([name, icon, text, color]) => `<article class="gallery-card" style="--gallery-color:${color}"><div class="gallery-art" aria-hidden="true"><span>${icon}</span></div><div><h3>${name}</h3><p>${text}</p></div></article>`).join(""); }

  async function initGlossary() {
    const response = await fetch("./data/glossary.json"); const entries = await response.json(); let letter = "Todos"; let expanded = false;
    const letters = ["Todos", ...new Set(entries.map(item => item.term[0].toUpperCase()))];
    byId("glossaryLetters").innerHTML = letters.map(item => `<button class="chip${item === "Todos" ? " active" : ""}" data-letter="${item}">${item}</button>`).join("");
    const render = () => { const query = norm(byId("glossarySearch").value); const filtered = entries.filter(item => (letter === "Todos" || item.term.startsWith(letter)) && norm(`${item.term} ${item.definition} ${item.example} ${item.related} ${item.category}`).includes(query)); const visible = expanded ? filtered : filtered.slice(0, 4); byId("glossaryCount").textContent = filtered.length ? `Mostrando ${visible.length} de ${filtered.length} conceitos` : "Nenhum conceito encontrado"; byId("glossaryGrid").innerHTML = visible.map(item => `<article class="glossary-card"><div><span>${item.category}</span><h3>${item.term}</h3></div><p>${item.definition}</p><p class="glossary-example"><strong>Exemplo:</strong> ${item.example}</p><small><strong>Veja também:</strong> ${item.related}</small></article>`).join("") || `<p class="empty">Nenhum conceito encontrado.</p>`; const more = byId("glossaryMore"); more.hidden = filtered.length <= 4; more.textContent = expanded ? "Mostrar menos" : "Ver glossário completo"; more.setAttribute("aria-expanded", String(expanded)); };
    byId("glossarySearch").addEventListener("input", () => { expanded = false; render(); }); byId("glossaryLetters").addEventListener("click", event => { const button = event.target.closest("[data-letter]"); if (!button) return; letter = button.dataset.letter; expanded = false; byId("glossaryLetters").querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button)); render(); }); byId("glossaryMore").addEventListener("click", () => { expanded = !expanded; render(); if (!expanded) byId("glossario").scrollIntoView({ behavior: "smooth" }); }); render();
  }

  async function initKnowledge() {
    const response = await fetch("./data/knowledge.json");
    const entries = await response.json();
    const dialog = byId("knowledgeDialog");
    let selectedType = "Todos";
    let expanded = false;
    let favorites = JSON.parse(localStorage.getItem("geomundo-knowledge-favorites") || "[]");
    const featured = entries[Math.floor(Date.now() / 86400000) % entries.length];

    const isFavorite = id => favorites.includes(id);
    const saveFavorites = () => localStorage.setItem("geomundo-knowledge-favorites", JSON.stringify(favorites));
    const openKnowledge = entry => {
      if (!entry) return;
      byId("knowledgeContent").innerHTML = `<div class="knowledge-article-head"><span class="knowledge-article-icon">${entry.icon}</span><div><p class="eyebrow">${entry.type} · ${entry.category}</p><h2>${entry.title}</h2><p>${entry.summary}</p></div></div><div class="knowledge-article-body"><p class="knowledge-lead">${entry.intro}</p>${entry.sections.map(section => `<section><h3>${section.title}</h3><p>${section.text}</p></section>`).join("")}<section class="knowledge-facts"><h3>Em poucas palavras</h3><ul>${entry.facts.map(fact => `<li>${fact}</li>`).join("")}</ul></section><div class="knowledge-source"><span>Fonte recomendada</span><a href="${entry.source.url}" target="_blank" rel="noopener noreferrer">${entry.source.name} ↗</a><small>Conteúdo revisado para fins educativos · agosto de 2026</small></div></div>`;
      dialog.showModal();
    };

    const render = () => {
      const query = norm(byId("knowledgeSearch").value);
      const filtered = entries.filter(entry => (selectedType === "Todos" || entry.type === selectedType) && norm(`${entry.title} ${entry.summary} ${entry.intro} ${entry.category} ${entry.type} ${entry.facts.join(" ")}`).includes(query));
      const visible = expanded ? filtered : filtered.slice(0, 6);
      byId("knowledgeCount").textContent = filtered.length ? `Mostrando ${visible.length} de ${filtered.length} conteúdos` : "Nenhum conteúdo encontrado";
      byId("knowledgeGrid").innerHTML = visible.map(entry => `<article class="knowledge-card" data-knowledge-id="${entry.id}"><div class="knowledge-card-top"><span>${entry.icon}</span><button class="knowledge-favorite${isFavorite(entry.id) ? " active" : ""}" data-knowledge-favorite="${entry.id}" aria-label="${isFavorite(entry.id) ? "Remover" : "Adicionar"} ${entry.title} dos favoritos">${isFavorite(entry.id) ? "★" : "☆"}</button></div><p class="eyebrow">${entry.type} · ${entry.category}</p><h3>${entry.title}</h3><p>${entry.summary}</p><button class="text-button" data-open-knowledge="${entry.id}">Leia mais →</button></article>`).join("") || '<p class="empty">Nenhum conteúdo corresponde à busca.</p>';
      const more = byId("knowledgeMore"); more.hidden = filtered.length <= 6; more.textContent = expanded ? "Mostrar menos" : "Ver todos os conteúdos"; more.setAttribute("aria-expanded", String(expanded));
    };

    byId("knowledgeFeaturedIcon").textContent = featured.icon;
    byId("knowledgeFeaturedTitle").textContent = featured.title;
    byId("knowledgeFeaturedSummary").textContent = featured.summary;
    byId("knowledgeFeaturedButton").addEventListener("click", () => openKnowledge(featured));
    byId("knowledgeSearch").addEventListener("input", () => { expanded = false; render(); });
    byId("knowledgeFilters").addEventListener("click", event => {
      const button = event.target.closest("[data-knowledge-filter]"); if (!button) return;
      selectedType = button.dataset.knowledgeFilter; expanded = false;
      byId("knowledgeFilters").querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button)); render();
    });
    byId("knowledgeMore").addEventListener("click", () => { expanded = !expanded; render(); if (!expanded) byId("aprender").scrollIntoView({ behavior: "smooth" }); });
    byId("knowledgeGrid").addEventListener("click", event => {
      const favorite = event.target.closest("[data-knowledge-favorite]");
      if (favorite) { const id = favorite.dataset.knowledgeFavorite; favorites = isFavorite(id) ? favorites.filter(item => item !== id) : [...favorites, id]; saveFavorites(); render(); return; }
      const opener = event.target.closest("[data-open-knowledge]") || event.target.closest("[data-knowledge-id]");
      const id = opener?.dataset.openKnowledge || opener?.dataset.knowledgeId; if (id) openKnowledge(entries.find(item => item.id === id));
    });
    byId("closeKnowledgeDialog").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    render();
  }

  function baseThematicMap(elementId, landColor, oceanColor) {
    const element = byId(elementId); element.innerHTML = "";
    const thematicMap = L.map(elementId, { minZoom:1, maxZoom:6, worldCopyJump:true, attributionControl:false }).setView([18,0], 1);
    element.style.background = oceanColor;
    L.geoJSON(geojson, { interactive:false, style:{ color:"rgba(255,255,255,.72)", weight:.55, fillColor:landColor, fillOpacity:1 } }).addTo(thematicMap);
    return thematicMap;
  }

  async function buildHydroMap() {
    const rivers = await fetch("./data/hydrography.json").then(response => response.json());
    const hydro = baseThematicMap("hydroMap", "#d8ecdf", "#b8dfe8");
    rivers.forEach(river => {
      const line = L.polyline(river.coordinates.map(([lon,lat]) => [lat,lon]), { color:"#1679b8", weight:3.2, opacity:.9 }).addTo(hydro);
      line.bindPopup(`<div class="thematic-popup"><strong>💧 ${river.name}</strong><span>${river.continent}</span><p><b>Extensão aproximada:</b> ${number(river.length)} km</p><p><b>Foz:</b> ${river.mouth}</p><p>${river.fact}</p></div>`);
      line.bindTooltip(river.name, { sticky:true });
    });
  }

  async function buildReliefMap() {
    const forms = await fetch("./data/relief.json").then(response => response.json());
    const relief = baseThematicMap("reliefMap", "#d4dfb6", "#b9d8dc");
    forms.forEach(form => {
      let layer;
      if (form.coordinates) {
        layer = L.polyline(form.coordinates.map(([lon,lat]) => [lat,lon]), { color:"#8a4f2c", weight:9, opacity:.72, lineCap:"round" });
      } else {
        const [[south,west],[north,east]] = form.bounds;
        const color = form.type.includes("Planície") ? "#87ad6b" : form.type.includes("Depressão") ? "#74a884" : "#ba8545";
        layer = L.rectangle([[south,west],[north,east]], { color, fillColor:color, fillOpacity:.38, weight:1.2, dashArray:"4 4" });
      }
      layer.addTo(relief).bindPopup(`<div class="thematic-popup"><strong>⛰️ ${form.name}</strong><span>${form.type} · ${form.continent}</span><p><b>Altitude:</b> ${form.elevation}</p><p>${form.fact}</p></div>`).bindTooltip(form.name, { sticky:true });
    });
  }

  function initPhysicalMaps() {
    if (typeof L === "undefined") return;
    const targets = [byId("hydroMap"), byId("reliefMap")];
    const loaded = new Set();
    const load = async element => {
      if (loaded.has(element.id)) return; loaded.add(element.id);
      try { element.id === "hydroMap" ? await buildHydroMap() : await buildReliefMap(); }
      catch (error) { console.error(error); element.innerHTML = '<div class="map-loading">Não foi possível carregar este mapa.</div>'; }
    };
    if (!("IntersectionObserver" in window)) { targets.forEach(load); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { load(entry.target); observer.unobserve(entry.target); } }), { rootMargin:"300px" });
    targets.forEach(element => observer.observe(element));
  }

  async function initUpdates() {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration(); if (!registration) return;
    const show = worker => { const notice = byId("updateNotice"); notice.hidden = false; byId("updateButton").onclick = () => worker.postMessage({ type:"SKIP_WAITING" }); };
    if (registration.waiting) show(registration.waiting);
    registration.addEventListener("updatefound", () => { const worker = registration.installing; worker.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) show(worker); }); });
    let refreshing = false; navigator.serviceWorker.addEventListener("controllerchange", () => { if (!refreshing) { refreshing = true; location.reload(); } });
    byId("dismissUpdate").addEventListener("click", () => { byId("updateNotice").hidden = true; });
  }

  waitForAtlas().then(() => { initGlobe(); initBrazilMap(); initGallery(); initKnowledge(); initGlossary(); initPhysicalMaps(); initUpdates(); }).catch(console.error);
})();
