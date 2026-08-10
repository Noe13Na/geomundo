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

  function initSolarSystem() {
    const canvas = byId("solarCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const bodies = [
      { id:"sun", name:"Sol", icon:"☀️", color:["#fff6a6","#ffb21a","#ef6419"], radius:42, orbit:0, period:1, phase:0, type:"Estrela anã amarela", measure:"Diâmetro: cerca de 1,4 milhão de km", description:"A estrela no centro do Sistema Solar. Sua gravidade mantém planetas, asteroides e cometas em órbita." },
      { id:"mercury", name:"Mercúrio", icon:"☿", color:["#e6e0d7","#9d968c","#57534f"], radius:7, orbit:78, period:88, phase:.5, type:"Planeta rochoso", measure:"Ano: 88 dias terrestres", description:"O menor planeta e o mais próximo do Sol, marcado por crateras e grandes variações de temperatura." },
      { id:"venus", name:"Vênus", icon:"♀", color:["#fff0a8","#d69a45","#8a5628"], radius:11, orbit:112, period:225, phase:2.2, type:"Planeta rochoso", measure:"Ano: 225 dias terrestres", description:"Coberto por nuvens densas, é o planeta mais quente do Sistema Solar por causa do intenso efeito estufa." },
      { id:"earth", name:"Terra", icon:"🌍", color:["#c6f4ff","#208dcc","#155d66"], radius:12, orbit:150, period:365, phase:4.1, type:"Planeta rochoso", measure:"Ano: cerca de 365 dias", description:"Nosso planeta, com água líquida abundante, atmosfera rica em nitrogênio e oxigênio e vida conhecida." },
      { id:"mars", name:"Marte", icon:"♂", color:["#ffc09c","#c45732","#713020"], radius:9, orbit:190, period:687, phase:1.3, type:"Planeta rochoso", measure:"Ano: 687 dias terrestres", description:"O planeta vermelho possui vulcões gigantes, cânions profundos, calotas polares e sinais de água no passado." },
      { id:"jupiter", name:"Júpiter", icon:"♃", color:["#fff0d0","#c98653","#79503d"], radius:27, orbit:245, period:4333, phase:3.3, type:"Gigante gasoso", measure:"Ano: quase 12 anos terrestres", description:"O maior planeta, com faixas de nuvens, dezenas de luas e a Grande Mancha Vermelha, uma tempestade duradoura." },
      { id:"saturn", name:"Saturno", icon:"♄", color:["#fff1b8","#d2aa59","#77663f"], radius:23, orbit:305, period:10759, phase:5.2, type:"Gigante gasoso", measure:"Ano: cerca de 29 anos terrestres", description:"Famoso pelo amplo sistema de anéis formado principalmente por partículas de gelo, poeira e rocha." },
      { id:"uranus", name:"Urano", icon:"♅", color:["#d6ffff","#6fc5cd","#367b87"], radius:17, orbit:360, period:30687, phase:2.7, type:"Gigante de gelo", measure:"Ano: cerca de 84 anos terrestres", description:"Um mundo azul-esverdeado que gira praticamente de lado devido à grande inclinação de seu eixo." },
      { id:"neptune", name:"Netuno", icon:"♆", color:["#aac9ff","#3267c8","#182c76"], radius:16, orbit:414, period:60190, phase:.1, type:"Gigante de gelo", measure:"Ano: cerca de 165 anos terrestres", description:"O planeta mais distante do Sol, com atmosfera azul e alguns dos ventos mais rápidos do Sistema Solar." }
    ];
    const stars = Array.from({ length:190 }, (_, index) => ({ x:(index * 73 % 1097) / 1097, y:(index * 191 % 677) / 677, size:.45 + (index % 5) * .28, alpha:.28 + (index % 7) * .09 }));
    let running = true, speed = 1, elapsed = 0, previous = 0, viewAngle = -.2, tilt = .38, dragging = false, moved = false, startX = 0, startY = 0, hitTargets = [];

    const selectBody = body => {
      byId("solarPlanetIcon").textContent = body.icon;
      byId("solarPlanetName").textContent = body.name;
      byId("solarPlanetDescription").textContent = body.description;
      byId("solarPlanetFacts").innerHTML = `<div><dt>Tipo</dt><dd>${body.type}</dd></div><div><dt>Informação</dt><dd>${body.measure}</dd></div>`;
      byId("solarPlanetButtons").querySelectorAll("button").forEach(button => button.classList.toggle("active", button.dataset.solarBody === body.id));
    };

    byId("solarPlanetButtons").innerHTML = bodies.map(body => `<button type="button" class="solar-planet-button${body.id === "sun" ? " active" : ""}" data-solar-body="${body.id}"><span>${body.icon}</span>${body.name}</button>`).join("");
    byId("solarPlanetButtons").addEventListener("click", event => { const button = event.target.closest("[data-solar-body]"); if (button) selectBody(bodies.find(body => body.id === button.dataset.solarBody)); });

    const drawSphere = (x, y, radius, colors, body) => {
      ctx.save();
      if (body.id === "saturn") { ctx.translate(x, y); ctx.rotate(-.18); ctx.strokeStyle = "rgba(232,205,137,.72)"; ctx.lineWidth = Math.max(3, radius * .28); ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.75, radius * .52, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); ctx.save(); }
      if (body.id === "sun") { const glow = ctx.createRadialGradient(x,y,radius*.3,x,y,radius*2.2); glow.addColorStop(0,"rgba(255,221,86,.45)"); glow.addColorStop(1,"rgba(255,154,22,0)"); ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(x,y,radius*2.2,0,Math.PI*2); ctx.fill(); }
      const gradient = ctx.createRadialGradient(x-radius*.32,y-radius*.35,radius*.08,x,y,radius); gradient.addColorStop(0,colors[0]); gradient.addColorStop(.58,colors[1]); gradient.addColorStop(1,colors[2]); ctx.fillStyle=gradient; ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fill();
      if (["earth","jupiter","saturn","neptune"].includes(body.id)) { ctx.globalAlpha=.26; ctx.strokeStyle="#fff"; ctx.lineWidth=Math.max(1,radius*.12); ctx.beginPath(); ctx.arc(x,y,radius*.72,.15,2.75); ctx.stroke(); }
      ctx.restore();
    };

    const draw = timestamp => {
      const delta = Math.min(40, timestamp - previous || 0); previous = timestamp; if (running) elapsed += delta * speed;
      const width = canvas.width, height = canvas.height, cx = width * .5, cy = height * .52, scale = Math.min(width / 1100, height / 680);
      const dark = document.documentElement.dataset.theme === "dark";
      const background = ctx.createRadialGradient(cx,cy,20,cx,cy,width*.72); background.addColorStop(0,dark ? "#132d46" : "#183e62"); background.addColorStop(.55,dark ? "#081421" : "#0b2037"); background.addColorStop(1,"#03070d"); ctx.fillStyle=background; ctx.fillRect(0,0,width,height);
      stars.forEach(star => { ctx.globalAlpha=star.alpha; ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(star.x*width,star.y*height,star.size*scale,0,Math.PI*2); ctx.fill(); }); ctx.globalAlpha=1;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(viewAngle);
      bodies.slice(1).forEach(body => { ctx.strokeStyle="rgba(185,218,238,.18)"; ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(0,0,body.orbit*scale,body.orbit*tilt*scale,0,0,Math.PI*2); ctx.stroke(); });
      hitTargets = [];
      const visualPeriods = [0,4.2,6.4,8.5,11,17,22,28,34];
      const positioned = bodies.map((body,index) => { if (!index) return {body,x:0,y:0,depth:0}; const angle=body.phase+elapsed/(visualPeriods[index]*1000); return {body,x:Math.cos(angle)*body.orbit*scale,y:Math.sin(angle)*body.orbit*tilt*scale,depth:Math.sin(angle)}; });
      positioned.sort((a,b)=>a.depth-b.depth).forEach(item => { const radius=item.body.radius*scale*(.9+item.depth*.1); drawSphere(item.x,item.y,radius,item.body.color,item.body); hitTargets.push({ body:item.body, x:cx + item.x*Math.cos(viewAngle)-item.y*Math.sin(viewAngle), y:cy + item.x*Math.sin(viewAngle)+item.y*Math.cos(viewAngle), radius:Math.max(14,radius*1.35) }); });
      ctx.restore(); requestAnimationFrame(draw);
    };

    canvas.addEventListener("pointerdown", event => { dragging=true; moved=false; startX=event.clientX; startY=event.clientY; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener("pointermove", event => { if(!dragging) return; const dx=event.clientX-startX,dy=event.clientY-startY; if(Math.abs(dx)+Math.abs(dy)>3)moved=true; viewAngle+=dx*.006; tilt=Math.max(.2,Math.min(.62,tilt+dy*.002)); startX=event.clientX; startY=event.clientY; });
    canvas.addEventListener("pointerup", event => { dragging=false; if(moved)return; const box=canvas.getBoundingClientRect(),x=(event.clientX-box.left)*canvas.width/box.width,y=(event.clientY-box.top)*canvas.height/box.height; const hit=[...hitTargets].reverse().find(item=>Math.hypot(x-item.x,y-item.y)<=item.radius); if(hit)selectBody(hit.body); });
    byId("toggleSolarRotation").addEventListener("click", event => { running=!running; event.currentTarget.textContent=running?"Pausar animação":"Continuar animação"; });
    byId("solarSlower").addEventListener("click",()=>{speed=Math.max(.25,speed/1.5);});
    byId("solarFaster").addEventListener("click",()=>{speed=Math.min(4,speed*1.5);});
    byId("resetSolar").addEventListener("click",()=>{elapsed=0;viewAngle=-.2;tilt=.38;speed=1;});
    requestAnimationFrame(draw);
  }

  async function initScaleComparisons() {
    const section = byId("escala-real");
    if (!section) return;
    byId("sistema-solar")?.after(section);
    if (location.hash === "#escala-real") requestAnimationFrame(() => section.scrollIntoView());
    const data = await fetch("./data/scale-comparisons.json").then(response => {
      if (!response.ok) throw new Error("Não foi possível carregar as comparações.");
      return response.json();
    });
    const countryByCode = new Map(countries.map(country => [country.code, country]));
    const polygonsOf = geometry => geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    const featuresFor = selector => {
      if (selector === "africa") return geojson.features.filter(feature => norm(countryByCode.get(feature.properties.code)?.continent) === "africa");
      if (selector === "south-america") return geojson.features.filter(feature => norm(countryByCode.get(feature.properties.code)?.subregion).includes("south america"));
      return geojson.features.filter(feature => feature.properties.code === selector);
    };
    const projectedRings = selector => featuresFor(selector).flatMap(feature => polygonsOf(feature.geometry).flatMap(polygon => polygon.map(ring => ring.map(([lon, lat]) => [lon * Math.PI / 180, Math.sin(lat * Math.PI / 180)]))));
    const boundsOf = rings => {
      const points = rings.flat();
      return { minX:Math.min(...points.map(point => point[0])), maxX:Math.max(...points.map(point => point[0])), minY:Math.min(...points.map(point => point[1])), maxY:Math.max(...points.map(point => point[1])) };
    };
    const drawComparison = (canvas, comparison) => {
      const ctx = canvas.getContext("2d"), width = canvas.width, height = canvas.height;
      const groups = [comparison.first, comparison.second].map(item => ({ item, rings:projectedRings(item.selector) }));
      groups.forEach(group => { group.bounds = boundsOf(group.rings); });
      const maxWidth = Math.max(...groups.map(group => group.bounds.maxX - group.bounds.minX));
      const maxHeight = Math.max(...groups.map(group => group.bounds.maxY - group.bounds.minY));
      const scale = Math.min(width * .39 / maxWidth, height * .59 / maxHeight);
      ctx.clearRect(0, 0, width, height);
      groups.forEach((group, index) => {
        const centerX = width * (index ? .75 : .25), centerY = height * .48;
        const shapeWidth = (group.bounds.maxX - group.bounds.minX) * scale;
        const shapeHeight = (group.bounds.maxY - group.bounds.minY) * scale;
        const offsetX = centerX - shapeWidth / 2 - group.bounds.minX * scale;
        const offsetY = centerY - shapeHeight / 2 + group.bounds.maxY * scale;
        ctx.beginPath();
        group.rings.forEach(ring => ring.forEach(([x,y], pointIndex) => pointIndex ? ctx.lineTo(offsetX+x*scale,offsetY-y*scale) : ctx.moveTo(offsetX+x*scale,offsetY-y*scale)));
        ctx.fillStyle = group.item.color; ctx.shadowColor = "rgba(10,45,38,.18)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 7; ctx.fill("evenodd");
        ctx.shadowColor = "transparent"; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#17342d"; ctx.font = "800 25px system-ui"; ctx.textAlign = "center"; ctx.fillText(group.item.label, centerX, height - 38);
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#627871"; ctx.font = "600 18px system-ui"; ctx.fillText(`${(group.item.area/1000000).toLocaleString("pt-BR",{maximumFractionDigits:1})} milhões km²`, centerX, height - 12);
      });
      ctx.fillStyle = "rgba(100,125,118,.35)"; ctx.fillRect(width/2-.5,30,1,height-80);
    };
    const grid = byId("scaleComparisonGrid");
    grid.innerHTML = data.comparisons.map(item => `<article class="scale-card"><div class="scale-card-visual"><canvas width="900" height="400" data-scale-id="${item.id}" role="img" aria-label="Comparação na mesma escala entre ${item.first.label} e ${item.second.label}"></canvas></div><div class="scale-card-body"><h3>${item.title}</h3><strong class="scale-headline">${item.headline}</strong><p>${item.text}</p><a href="${item.source.url}" target="_blank" rel="noopener noreferrer">Fonte: ${item.source.name} ↗</a></div></article>`).join("");
    data.comparisons.forEach(item => drawComparison(grid.querySelector(`[data-scale-id="${item.id}"]`), item));
    const spotlight = document.createElement("aside");
    spotlight.className = "scale-spotlight";
    spotlight.innerHTML = `<span class="scale-spotlight-icon" aria-hidden="true">${data.spotlight.icon}</span><div><h3>${data.spotlight.title}</h3><strong>${data.spotlight.headline}</strong><p>${data.spotlight.text}</p></div><a href="${data.spotlight.source.url}" target="_blank" rel="noopener noreferrer">Fonte: ${data.spotlight.source.name} ↗</a>`;
    grid.after(spotlight);
    byId("scaleInsights").innerHTML = data.insights.map(item => `<article class="scale-insight"><span class="scale-insight-icon" aria-hidden="true">${item.icon}</span><h3>${item.title}</h3><p>${item.text}</p><a href="${item.source.url}" target="_blank" rel="noopener noreferrer">Fonte: ${item.source.name} ↗</a></article>`).join("");
    window.addEventListener("geomundo-theme-change", () => data.comparisons.forEach(item => drawComparison(grid.querySelector(`[data-scale-id="${item.id}"]`), item)));
  }

  async function initAstronomyCalendar() {
    const events = await fetch("./data/astronomy-events-2026.json").then(response => response.json());
    const monthNames = {8:"Agosto",9:"Setembro",10:"Outubro",11:"Novembro",12:"Dezembro"};
    let selected = "Todos";
    const render = () => {
      const filtered = selected === "Todos" ? events : events.filter(event => String(event.month) === selected);
      byId("astronomyCalendar").innerHTML = filtered.map(event => `<article class="astronomy-event"><div class="astronomy-date"><span>${event.icon}</span><strong>${event.date}</strong><small>${monthNames[event.month]} · ${event.type}</small></div><div><h3>${event.title}</h3><p>${event.description}</p><p class="astronomy-visibility"><strong>Visibilidade:</strong> ${event.visibility}</p><a href="${event.source.url}" target="_blank" rel="noopener noreferrer">Fonte: ${event.source.name} ↗</a></div></article>`).join("");
    };
    byId("astronomyFilters").addEventListener("click", event => { const button=event.target.closest("[data-astro-month]"); if(!button)return; selected=button.dataset.astroMonth; byId("astronomyFilters").querySelectorAll("button").forEach(item=>item.classList.toggle("active",item===button)); render(); });
    render();
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

  waitForAtlas().then(() => { initGlobe(); initSolarSystem(); initScaleComparisons(); initAstronomyCalendar(); initBrazilMap(); initGallery(); initKnowledge(); initGlossary(); initPhysicalMaps(); initUpdates(); }).catch(console.error);
})();
