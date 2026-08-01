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
    const response = await fetch("./data/glossary.json"); const entries = await response.json(); let letter = "Todos";
    const letters = ["Todos", ...new Set(entries.map(item => item.term[0].toUpperCase()))];
    byId("glossaryLetters").innerHTML = letters.map(item => `<button class="chip${item === "Todos" ? " active" : ""}" data-letter="${item}">${item}</button>`).join("");
    const render = () => { const query = norm(byId("glossarySearch").value); const filtered = entries.filter(item => (letter === "Todos" || item.term.startsWith(letter)) && norm(`${item.term} ${item.definition} ${item.example} ${item.related} ${item.category}`).includes(query)); byId("glossaryCount").textContent = `${filtered.length} ${filtered.length === 1 ? "conceito encontrado" : "conceitos encontrados"}`; byId("glossaryGrid").innerHTML = filtered.map(item => `<article class="glossary-card"><div><span>${item.category}</span><h3>${item.term}</h3></div><p>${item.definition}</p><p class="glossary-example"><strong>Exemplo:</strong> ${item.example}</p><small><strong>Veja também:</strong> ${item.related}</small></article>`).join("") || `<p class="empty">Nenhum conceito encontrado.</p>`; };
    byId("glossarySearch").addEventListener("input", render); byId("glossaryLetters").addEventListener("click", event => { const button = event.target.closest("[data-letter]"); if (!button) return; letter = button.dataset.letter; byId("glossaryLetters").querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button)); render(); }); render();
  }

  function initLayers() {
    if (typeof L === "undefined" || !map) return;
    const groups = {};
    const riverLines = [[[-72,-4],[-67,-3],[-60,-2],[-53,-1],[-49,-1]],[[-5,13],[2,12],[8,10],[12,7]],[ [30,-2],[31,-6],[32,-12],[34,-18] ],[[91,31],[98,25],[105,18],[106,10]]];
    groups.rivers = L.layerGroup(riverLines.map(coords => L.polyline(coords.map(([lon,lat]) => [lat,lon]), { color:"#38a7e0", weight:3, opacity:.85 })));
    const biomeZones = [[[-75,-12],[-47,-12],[-47,6],[-75,6]],[[12,-5],[32,-5],[32,5],[12,5]],[[95,-8],[125,-8],[125,8],[95,8]],[[15,8],[35,8],[35,18],[15,18]]];
    groups.biomes = L.layerGroup(biomeZones.map(coords => L.polygon(coords.map(([lon,lat]) => [lat,lon]), { color:"#2f8f5b", fillColor:"#49b96f", fillOpacity:.22, weight:1 })));
    const reliefLines = [[[-78,-10],[-75,-20],[-72,-30],[-70,-42]], [[72,35],[82,30],[92,28]], [[-125,50],[-115,38],[-105,28]], [[5,46],[12,46],[18,45]]];
    groups.relief = L.layerGroup(reliefLines.map(coords => L.polyline(coords.map(([lon,lat]) => [lat,lon]), { color:"#9c6b42", weight:7, opacity:.45, dashArray:"3 7" })));
    document.querySelectorAll("[data-map-layer]").forEach(button => button.addEventListener("click", () => { const name = button.dataset.mapLayer; const active = map.hasLayer(groups[name]); active ? map.removeLayer(groups[name]) : groups[name].addTo(map); button.classList.toggle("active", !active); button.setAttribute("aria-pressed", String(!active)); document.querySelector("#mapa").scrollIntoView({ behavior:"smooth" }); }));
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

  waitForAtlas().then(() => { initGlobe(); initBrazilMap(); initGallery(); initGlossary(); initLayers(); initUpdates(); }).catch(console.error);
})();
