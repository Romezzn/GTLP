// === SISTEMA DE CONFIGURACIÓN Y UTILIDAD ===
let CONFIG = {};
async function loadConfig() {
  const resp = await fetch('config.json');
  CONFIG = await resp.json();
  if (!CONFIG.ticksPerTurn)
    CONFIG.ticksPerTurn = Math.round(CONFIG.turno / CONFIG.gameTick);
}
function getZona(x, y) {
  for (const z of CONFIG.zonas) {
    if (x >= z.fromX && x <= z.toX && y >= z.fromY && y <= z.toY) return z;
  }
  return { nombre: "Calle", emoji: "🚶", id: "calle", color: "#555" };
}
function getObjById(id) {
  return CONFIG.objetos.find(o => o.id === id);
}
function getEfectoById(id) {
  return CONFIG.efectos[id] || {};
}
function pad(n) { return n < 10 ? ("0" + n) : "" + n; }
function clamp(num, min, max) { return Math.min(Math.max(num, min), max); }
function randomInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function inBounds(x, y) { return x >= 0 && y >= 0 && x < CONFIG.gridWidth && y < CONFIG.gridHeight; }

// === ESTADO GLOBAL ===
let criaturas = [], turno = 0, currentTick = 0, eventLog = [];
let ultimaAccion = Date.now(), zoom = 1.0, tileWidth, tileHeight, selected = 0;
let canvas, ctx;
let eventLogScroll = 0;

// === ESTADO DE CRIS ===
let crisVisitDays = [];
let crisOnMap = false;
let crisTurnoFinaliza = -1;
let crisPos = null;
let crisLlamadaUltima = -1000;

// === FECHA Y TIEMPO DE JUEGO ===
const WEEK_DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
function getGameDateTime() {
  let start = new Date(2025, 0, 6, 8, 0, 0, 0);
  let now = start.getTime() + turno * 24 * 60 * 60 * 1000;
  let d = new Date(now);
  let dayOfWeek = d.getDay();
  let humanDay = WEEK_DAYS[dayOfWeek];
  return {
    str: `Día ${turno + 1} (${humanDay})`,
    day: turno + 1,
    weekDay: (dayOfWeek === 0 ? 7 : dayOfWeek),
    weekDayName: humanDay,
    date: d.getDate(),
    month: d.getMonth() + 1,
    jsDay: dayOfWeek
  };
}
function esFinDeSemana(weekDay) {
  return weekDay === 6 || weekDay === 7;
}

// === CRIS: GESTIÓN DE VISITAS ALEATORIAS ===
function planificarVisitasCris() {
  let daysInMonth = 30;
  let days = [];
  let min = CONFIG.cris.aparicionMin, max = CONFIG.cris.aparicionMax;
  while (days.length < min) {
    let r = randomInt(1, daysInMonth);
    if (!days.includes(r)) days.push(r);
  }
  days.sort((a, b) => a - b);
  crisVisitDays = days;
}
function iniciarVisitaCris() {
  crisOnMap = true;
  crisTurnoFinaliza = turno + CONFIG.cris.duracionVisitaDias;
  let t = criaturas[0].posicion;
  let opciones = [
    { x: t.x + 1, y: t.y }, { x: t.x - 1, y: t.y }, { x: t.x, y: t.y + 1 }, { x: t.x, y: t.y - 1 }
  ].filter(p => inBounds(p.x, p.y));
  crisPos = opciones.length ? opciones[randomInt(0, opciones.length - 1)] : { x: t.x, y: t.y };
  let c = criaturas[0];
  let efecto = getEfectoById("cris-visita");
  c.ansiedad = clamp(c.ansiedad + (efecto.ansiedad || 0), 0, 100);
  c.stats.saludMental = clamp(c.stats.saludMental + (efecto.saludMental || 0), 0, 100);
  logMsg("¡Cris te ha visitado! Pasan el día juntos, baja la ansiedad y aumenta la salud mental.", "good");
}
function finalizarVisitaCris() {
  crisOnMap = false;
  crisTurnoFinaliza = -1;
  crisPos = null;
}
function llamarACris() {
  if (turno === crisLlamadaUltima) {
    logMsg("¡Ya has llamado a Cris hoy!", "warn");
    return;
  }
  crisLlamadaUltima = turno;
  let c = criaturas[0];
  let efecto = getEfectoById("cris-llamada");
  c.ansiedad = clamp(c.ansiedad + (efecto.ansiedad || 0), 0, 100);
  c.stats.saludMental = clamp(c.stats.saludMental + (efecto.saludMental || 0), 0, 100);
  c.stats.felicidad = clamp(c.stats.felicidad + (efecto.felicidad || 0), 0, 100);
  logMsg("Has llamado a Cris. Conversaron y te sientes mejor.", "good");
  actualizarUI();
}

// === ESCUCHAR MÚSICA ===
let musicaCooldown = -1000;
function escucharMusica() {
  if (musicaCooldown === turno) {
    logMsg("Solo puedes escuchar música una vez por día.", "warn");
    return;
  }
  musicaCooldown = turno;
  let c = criaturas[0];
  let efecto = getEfectoById("musica");
  c.ansiedad = clamp(c.ansiedad + (efecto.ansiedad || 0), 0, 100);
  c.stats.felicidad = clamp(c.stats.felicidad + (efecto.felicidad || 0), 0, 100);
  c.stats.saludMental = clamp(c.stats.saludMental + (efecto.saludMental || 0), 0, 100);
  logMsg('Escuchando: Cuando me siento bien :)', "good");
  actualizarUI();
}

// === EMOJI SEGÚN ESTADO DE ÁNIMO ===
function getEstadoEmoji(c) {
  const f = c.stats.felicidad;
  const a = c.ansiedad;
  const m = c.stats.saludMental;
  if (c.estadoEmocional === 'enCrisis' || (a > 85 && m < 40)) return "🥵";
  if (m < 30 && a > 70) return "😱";
  if (a > 80) return "😰";
  if (a > 60) return "😟";
  if (f >= 70 && a < 30 && m > 60) return "😁";
  if (f >= 70 && m > 50) return "😊";
  if (f < 30 && m < 40) return "😢";
  if (f < 30) return "😞";
  if (m < 40) return "🥲";
  if (a > 50) return "😬";
  return "🙂";
}

// === CLASE CRIATURA ===
class Criatura {
  constructor(data) {
    Object.assign(this, data);
    this.cooldowns = {};
    this.lastPsicologoTurn = -1000;
    this.lastTrabajoTurn = -1000;
    this.ansiedad = 0;
    this.moving = false;
    this.moveAnim = { from: { ...this.posicion }, to: { ...this.posicion }, t: 1 };
    this.experiencia = 0;
    this.hitos = [];
    this.cuentaExp = {};
    this.generation = 1;
  }
  clampStats() {
    for (const stat in this.stats)
      this.stats[stat] = clamp(this.stats[stat], 0, 100);
    this.ansiedad = clamp(this.ansiedad, 0, 100);
  }
  actualizarEstadoProgresivo(dt) {
    // Modificadores globales
    for (const stat in CONFIG.modificadoresGlobales) {
      if (stat === "ansiedad") this.ansiedad += CONFIG.modificadoresGlobales[stat] * dt;
      else if (this.stats[stat] !== undefined)
        this.stats[stat] += CONFIG.modificadoresGlobales[stat] * dt;
    }
    let zona = getZona(this.posicion.x, this.posicion.y);
    let modZ = CONFIG.modificadoresZona[zona.id];
    if (modZ) for (const stat in modZ)
      if (stat === "ansiedad") this.ansiedad += modZ[stat] * dt;
      else if (this.stats[stat] !== undefined)
        this.stats[stat] += modZ[stat] * dt;
    this.clampStats();
  }
  actualizarEstadoTurno() {
    this.stats.confianza = clamp(this.stats.confianza + (CONFIG.turnoConfianza || 10), 0, 100);
    this.vinculo = clamp((this.vinculo || 0) + (CONFIG.turnoVinculo || 10), 0, 100);
    let mejora = Math.floor((this.stats.confianza + (this.vinculo || 0)) / 20);
    this.stats.saludMental = clamp(this.stats.saludMental + mejora, 0, 100);

    let fecha = getGameDateTime();
    if (
      fecha.weekDay >= 1 && fecha.weekDay <= 5 &&
      (!this.lastTrabajoTurn || this.lastTrabajoTurn !== turno - 1)
    ) {
      this.ansiedad = clamp((this.ansiedad || 0) + (CONFIG.trabajoNoHechoAnsiedad || 18), 0, 100);
      logMsg("¡Uy! Se te olvidó trabajar. ¡La ansiedad sube!", "warn");
    }
    if (this.ansiedad > 0) {
      let mentalPenalty = Math.floor(this.ansiedad / 10);
      this.stats.saludMental = clamp(this.stats.saludMental - mentalPenalty, 0, 100);
    }
    if (this.ansiedad > (CONFIG.felicidadAnsiedadUmbral ?? 50)) {
      this.stats.felicidad = clamp(
        this.stats.felicidad - (CONFIG.felicidadAnsiedadDecaimiento ?? 12),
        0, 100
      );
    }
    if (this.ansiedad > 0) this.ansiedad -= (CONFIG.turnoAnsiedadRebaja || 7);
    if (this.stats.felicidad > 70) this.estadoEmocional = 'feliz';
    else if (this.stats.felicidad < 30) this.estadoEmocional = 'triste';
    else this.estadoEmocional = 'feliz';
    if (this.ansiedad > 70 && this.stats.saludMental < 40) {
      this.estadoEmocional = 'enCrisis';
      this.tlpActivo = true;
    }
    for (const k in this.cooldowns) {
      if (this.cooldowns[k] > 0) this.cooldowns[k] -= CONFIG.turno;
      if (this.cooldowns[k] < 0) this.cooldowns[k] = 0;
    }
    this.clampStats();
  }
  puedeVisitarPsicologo() {
    return (turno - this.lastPsicologoTurn) >= CONFIG.psicologoMinDias;
  }
  visitarPsicologo() {
    if (!this.puedeVisitarPsicologo()) { logMsg("¡Debes esperar 20 días entre visitas al psicólogo!", "warn"); return false; }
    if (this.stats.saludMental >= 100 && this.stats.confianza >= 100) { logMsg("¡No necesitas al psicólogo ahora!", "warn"); return false; }
    let efecto = getEfectoById("psicologo");
    this.stats.saludMental = clamp(this.stats.saludMental + (efecto.saludMental || 0), 0, 100);
    this.stats.confianza = clamp(this.stats.confianza + (efecto.confianza || 0), 0, 100);
    this.ansiedad = clamp(this.ansiedad + (efecto.ansiedad || 0), 0, 100);
    this.lastPsicologoTurn = turno;
    this.cooldowns.psicologo = CONFIG.cooldowns.psicologo * CONFIG.turno;
    logMsg("¡Sesión con el psicólogo terminada!", "good");
    return true;
  }
  puedeVisitarTrabajo() {
    let fecha = getGameDateTime();
    return (fecha.weekDay >= 1 && fecha.weekDay <= 5) && (turno !== this.lastTrabajoTurn);
  }
  visitarTrabajo() {
    if (!this.puedeVisitarTrabajo()) return false;
    let efecto = getEfectoById("puesto-trabajo");
    this.ansiedad = clamp(this.ansiedad + (efecto.ansiedad || 0), 0, 100);
    this.stats.energia = clamp(this.stats.energia + (efecto.energia || -8), 0, 100);
    this.stats.saludMental = clamp(this.stats.saludMental + (efecto.saludMental || -6), 0, 100);
    this.stats.felicidad = clamp(this.stats.felicidad + (efecto.felicidad || 7), 0, 100);
    this.lastTrabajoTurn = turno;
    logMsg("¡Has ido a trabajar! ☕", "good");
    return true;
  }
  moverSiguienteAuto() {
    let dirs = [
      { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
      { x: 1, y: -1 }, { x: -1, y: 1 }
    ];
    dirs = dirs.filter(d => inBounds(this.posicion.x + d.x, this.posicion.y + d.y));
    let d = dirs[randomInt(0, dirs.length - 1)];
    let nx = clamp(this.posicion.x + d.x, 0, CONFIG.gridWidth - 1), ny = clamp(this.posicion.y + d.y, 0, CONFIG.gridHeight - 1);
    let obj = CONFIG.objetos.find(o => o.pos.x === nx && o.pos.y === ny);
    if (obj && (!this.cooldowns[obj.id] || this.cooldowns[obj.id] <= 0)) {
      if (usarObjeto(this, obj, false)) return;
    }
    this.moveToAnim({ x: nx, y: ny });
  }
  moveToAnim(target) {
    this.moving = true;
    this.moveAnim = {
      from: { ...this.posicion },
      to: { ...target },
      t: 0
    };
  }
  updateAnim(dt) {
    if (this.moving) {
      this.moveAnim.t += dt * 3.5;
      if (this.moveAnim.t >= 1) {
        this.moveAnim.t = 1; this.moving = false;
        this.posicion = { ...this.moveAnim.to };
      }
    }
  }
  getPosAnim() {
    if (!this.moving) return { ...this.posicion };
    let t = this.moveAnim.t;
    return {
      x: this.moveAnim.from.x * (1 - t) + this.moveAnim.to.x * t,
      y: this.moveAnim.from.y * (1 - t) + this.moveAnim.to.y * t
    };
  }
}

// === USO DE OBJETOS ===
function usarObjeto(c, obj, mostrarMsg = true) {
  let efecto = getEfectoById(obj.id);
  if (c.cooldowns[obj.id] > 0) { if (mostrarMsg) logMsg("¡Debes esperar para volver a usar " + obj.name + "!", "warn"); return false; }
  let saturado = false;
  for (let k in efecto) {
    if (k === "hambre" && efecto[k] < 0 && c.stats.hambre <= 0) saturado = true;
    else if (k === "hambre" && efecto[k] > 0 && c.stats.hambre >= 100) saturado = true;
    else if (k !== "hambre" && (c.stats[k] !== undefined) && efecto[k] > 0 && c.stats[k] >= 100) saturado = true;
    else if (k !== "hambre" && (c.stats[k] !== undefined) && efecto[k] < 0 && c.stats[k] <= 0) saturado = true;
  }
  if (saturado) { if (mostrarMsg) logMsg("¡Tus stats ya están al máximo, no necesitas " + obj.name + "!", "warn"); return false; }
  if (obj.id === "puesto-trabajo") {
    if (c.puedeVisitarTrabajo()) {
      c.visitarTrabajo();
      c.cooldowns["puesto-trabajo"] = CONFIG.cooldowns["puesto-trabajo"] * CONFIG.turno;
      return true;
    } else {
      if (mostrarMsg) logMsg("No es día laborable, o ya has trabajado hoy.", "warn");
      return false;
    }
  }
  if (obj.id === "gimnasio") {
    let e = getEfectoById("gimnasio");
    c.stats.saludFisica = clamp(c.stats.saludFisica + (e.saludFisica || 0), 0, 100);
    c.stats.saludMental = clamp(c.stats.saludMental + (e.saludMental || 0), 0, 100);
    c.ansiedad = clamp(c.ansiedad + (e.ansiedad || 0), 0, 100);
    c.stats.energia = clamp(c.stats.energia + (e.energia || 0), 0, 100);
    c.cooldowns.gimnasio = CONFIG.cooldowns.gimnasio * CONFIG.minuto;
    if (mostrarMsg) logMsg("Has entrenado en el gimnasio. 💪", "good");
    return true;
  }
  if (obj.id === "cama") {
    c.stats.energia = 100;
    c.cooldowns.cama = CONFIG.cooldowns.cama * CONFIG.minuto;
    if (mostrarMsg) logMsg("Has dormido profundamente. Energía al máximo.", "good");
    return true;
  }
  if (obj.id === "chocolate" && c.stats.felicidad < 50) {
    c.stats.felicidad = 50;
    c.cooldowns.chocolate = CONFIG.cooldowns.chocolate * CONFIG.minuto;
    if (mostrarMsg) logMsg("Has comido chocolate. ¡Ñom!", "good");
    return true;
  }
  for (let k in efecto) {
    if (k === "hambre") c.stats.hambre = clamp(c.stats.hambre + efecto[k], 0, 100);
    else if (k === "felicidad") c.stats.felicidad = clamp(c.stats.felicidad + efecto[k], 0, 100);
    else if (k === "energia") c.stats.energia = clamp(c.stats.energia + efecto[k], 0, 100);
    else if (k === "confianza") c.stats.confianza = clamp(c.stats.confianza + efecto[k], 0, 100);
    else if (k === "saludFisica") c.stats.saludFisica = clamp(c.stats.saludFisica + efecto[k], 0, 100);
    else if (k === "saludMental") c.stats.saludMental = clamp(c.stats.saludMental + efecto[k], 0, 100);
    else if (k === "ansiedad") c.ansiedad = clamp(c.ansiedad + efecto[k], 0, 100);
  }
  if (obj.id !== "puesto-trabajo" && obj.id !== "psicologo" && CONFIG.accionRebajaAnsiedad) {
    c.ansiedad = clamp(
      c.ansiedad - randomInt(CONFIG.accionRebajaAnsiedad.min, CONFIG.accionRebajaAnsiedad.max),
      0, 100
    );
  }
  c.cooldowns[obj.id] = (CONFIG.cooldowns[obj.id] || 5) * (["psicologo"].includes(obj.id) ? CONFIG.turno : CONFIG.minuto);
  if (mostrarMsg) logMsg("¡Has usado " + obj.name + "!", "good");
  return true;
}

// === LOGS Y PANEL VISUAL ===
function logMsg(msg, type = "") {
  eventLog.push({ msg, type, t: Date.now() });
  if (eventLog.length > 100) eventLog.shift();
  renderLog();
}
function renderLog() {
  let eventLogDiv = document.getElementById('event-log');
  if (!eventLogDiv) {
    eventLogDiv = document.createElement('div');
    eventLogDiv.id = 'event-log';
    eventLogDiv.style = `
      position:fixed;
      right:24px;
      bottom:180px;
      width:340px;
      max-height:65vh;
      min-height:54px;
      z-index:200;
      display:flex;
      flex-direction:column;
      overflow-y:auto;
      padding:0;
      pointer-events:auto;
      align-items:flex-end;
      background:transparent;
    `;
    eventLogDiv.tabIndex = 0;
    document.body.appendChild(eventLogDiv);

    eventLogDiv.addEventListener('wheel', (e) => {
      if (e.deltaY < 0) eventLogScroll = Math.min(eventLogScroll + 1, eventLog.length - 1);
      else eventLogScroll = Math.max(eventLogScroll - 1, 0);
      renderLog();
      e.preventDefault();
    }, { passive: false });
  }
  let visibleCount = 3;
  let logsToShow = eventLog.slice(-visibleCount - eventLogScroll, eventLog.length - eventLogScroll);
  eventLogDiv.innerHTML = logsToShow.map((e, idx) => {
    let alpha;
    if (idx === logsToShow.length - 1) alpha = 1;
    else alpha = Math.max(1 - 0.11 * (logsToShow.length - 1 - idx), 0.18);
    return `<div class="log-msg ${e.type || ''}" style="
      margin-bottom:2.5px; padding:8px 16px; border-radius:9px;
      font-size:1.17em; background:rgba(26,32,34,${alpha});
      color:rgba(255,255,255,${alpha + 0.13});
      box-shadow:0 2px 14px #0004; font-weight:${idx === logsToShow.length - 1 ? 'bold' : 'normal'};
      filter:blur(${idx === logsToShow.length - 1 ? '0px' : '0.1px'});
      transition:background 0.25s, color 0.3s, opacity 0.2s; opacity:1;">
      ${e.msg}
    </div>`;
  }).join('');
}

// === PANEL DE CRIATURA CON BARRAS ===
function renderCriaturasPanel() {
  const criaturasPanel = document.getElementById('criaturasPanel');
  if (!criaturasPanel) return;
  criaturasPanel.innerHTML = "";
  let c = criaturas[0];
  let div = document.createElement('div');
  div.className = "criatura selected";
  div.tabIndex = 0;
  div.innerHTML = `
    <b>${c.nombre} (${c.personalidad})</b>
    <span style="float:right;font-size:1.5em">${getEstadoEmoji(c)}</span>
    <pre class="ascii"></pre>
    ${renderStatBar('Hambre', c.stats.hambre, '#b3b703')}
    ${renderStatBar('Felicidad', c.stats.felicidad, '#f2c53d')}
    ${renderStatBar('Energía', c.stats.energia, '#19d5e4')}
    ${renderStatBar('Confianza', c.stats.confianza, '#b39ddb')}
    ${renderStatBar('Vínculo', c.vinculo, '#ec6')}
    ${renderStatBar('Salud Mental', c.stats.saludMental, '#21e27b')}
    ${renderStatBar('Salud Física', c.stats.saludFisica, '#f58f3b')}
    ${renderStatBar('Ansiedad', c.ansiedad || 0, '#e56')}
    <div>Turno: ${turno}</div>
  `;
  criaturasPanel.appendChild(div);
}
function renderStatBar(name, val, color) {
  return `<div class="stat-bar" title="${name}" style="position:relative; height:18px; background:#3335; border-radius:7px; margin:4px 0 3px 0;">
    <span class="stat-fill" style="position:absolute; left:0; top:0; height:18px; border-radius:7px; background:${color}; width:${clamp(val,0,100)}%;"></span>
    <span class="stat-text" style="position:absolute; left:10px; top:0; font-size:13px; color:#fff;">${name}: ${Math.round(val)}</span>
  </div>`;
}
function renderStatOverlay() {
  let overlay = document.getElementById('stat-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = "stat-overlay";
    overlay.style = `
      position:fixed; top:0; left:50%; transform:translateX(-50%);
      background:#23242aee; color:#fff; font-size:1.2em; border-radius:10px;
      padding:8px 42px 8px 42px; z-index:40;
      box-shadow:0 0 18px #0008; pointer-events:none;
    `;
    document.body.appendChild(overlay);
  }
  let c = criaturas[0];
  let fecha = getGameDateTime();
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:2.2em;">
      <b>${c.nombre}</b>
      <span>😋${Math.round(c.stats.hambre)}</span>
      <span>${getEstadoEmoji(c)}${Math.round(c.stats.felicidad)}</span>
      <span>⚡${Math.round(c.stats.energia)}</span>
      <span>🤝${Math.round(c.vinculo)}</span>
      <span>🧠${Math.round(c.stats.saludMental)}</span>
      <span>💪${Math.round(c.stats.saludFisica)}</span>
      <span>😰${Math.round(c.ansiedad)}</span>
      <span style="margin-left:24px;">${fecha.str}</span>
    </div>
  `;
}

// === ENTORNO Y ANIMACIÓN ===
function renderEntorno() {
  if (!canvas) return;
  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
  ctx.clearRect(0, 0, canvas.width / zoom, canvas.height / zoom);

  for (const z of CONFIG.zonas.concat([{ nombre: "Calle", emoji: "🚶", id: "calle", fromX: 0, fromY: 0, toX: CONFIG.gridWidth - 1, toY: CONFIG.gridHeight - 1, color: "#555" }])) {
    ctx.save();
    ctx.globalAlpha = z.id === "calle" ? 0.10 : 0.20;
    ctx.fillStyle = z.color;
    for (let x = z.fromX; x <= z.toX; x++) for (let y = z.fromY; y <= z.toY; y++) {
      let { x: sx, y: sy } = isoToScreen(x, y);
      ctx.beginPath();
      ctx.moveTo(sx, sy + tileHeight / 2);
      ctx.lineTo(sx + tileWidth / 2, sy);
      ctx.lineTo(sx + tileWidth, sy + tileHeight / 2);
      ctx.lineTo(sx + tileWidth / 2, sy + tileHeight);
      ctx.closePath();
      ctx.fill();
    }
    if (z.id !== "calle") {
      let cx = Math.floor((z.fromX + z.toX) / 2), cy = Math.floor((z.fromY + z.toY) / 2);
      let { x: nx, y: ny } = isoToScreen(cx, cy);
      ctx.globalAlpha = 0.8;
      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(`${z.emoji || ""} ${z.nombre}`, nx + tileWidth / 2, ny + tileHeight / 2 - 20);
      ctx.globalAlpha = 1.0;
    }
    ctx.restore();
  }
  ctx.strokeStyle = "#444";
  for (let x = 0; x < CONFIG.gridWidth; x++) for (let y = 0; y < CONFIG.gridHeight; y++) {
    let { x: sx, y: sy } = isoToScreen(x, y);
    ctx.beginPath();
    ctx.moveTo(sx, sy + tileHeight / 2);
    ctx.lineTo(sx + tileWidth / 2, sy);
    ctx.lineTo(sx + tileWidth, sy + tileHeight / 2);
    ctx.lineTo(sx + tileWidth / 2, sy + tileHeight);
    ctx.closePath();
    ctx.stroke();
  }
  CONFIG.objetos.forEach(obj => {
    let { x: sx, y: sy } = isoToScreen(obj.pos.x, obj.pos.y);
    ctx.font = "38px serif";
    ctx.textAlign = "center";
    ctx.globalAlpha = 0.94;
    ctx.fillText(obj.icon, sx + tileWidth / 2, sy + tileHeight / 2 + 14);
    ctx.font = "13px monospace";
    ctx.fillStyle = "#eee";
    ctx.fillText(obj.name, sx + tileWidth / 2, sy + tileHeight - 2);
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 1;
  });
  if (crisOnMap && crisPos) {
    let { x: sx, y: sy } = isoToScreen(crisPos.x, crisPos.y);
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx + tileWidth / 2, sy + tileHeight / 2, 18, 0, 2 * Math.PI);
    ctx.fillStyle = "#e5fe";
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#eac";
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.font = "19px monospace";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText("Cris", sx + tileWidth / 2, sy + tileHeight / 2 - 25);
    ctx.font = "28px serif";
    ctx.fillText(CONFIG.cris.emoji, sx + tileWidth / 2, sy + tileHeight / 2 + 8);
    ctx.restore();
  }
  let c = criaturas[0];
  let pos = c.getPosAnim ? c.getPosAnim() : c.posicion;
  let { x: sx, y: sy } = isoToScreen(pos.x, pos.y);
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx + tileWidth / 2, sy + tileHeight / 2, 18, 0, 2 * Math.PI);
  ctx.fillStyle = c.tlpActivo ? "#e10" : "#18e";
  ctx.globalAlpha = 0.82;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#2cf";
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = "19px monospace";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(c.nombre || "??", sx + tileWidth / 2, sy + tileHeight / 2 - 26);
  ctx.font = "28px serif";
  ctx.fillText(getEstadoEmoji(c), sx + tileWidth / 2, sy + tileHeight / 2 + 8);
  ctx.restore();
  ctx.restore();
}
// === VARIABLES DE DESPLAZAMIENTO (PANEO) ===
let panX = 0, panY = 0;
let isPanning = false;
let lastPanX = 0, lastPanY = 0;
let panStartX = 0, panStartY = 0;

// === isoToScreen centrado dinámico y con pan ===
function isoToScreen(x, y) {
  // Centra el mapa en el canvas y aplica pan
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const mapPixelWidth = CONFIG.gridWidth * tileWidth / 2 + CONFIG.gridHeight * tileWidth / 2;
  const mapPixelHeight = CONFIG.gridWidth * tileHeight / 2 + CONFIG.gridHeight * tileHeight / 2;
  const offsetX = centerX - mapPixelWidth / 2 + panX;
  const offsetY = centerY - mapPixelHeight / 2 + panY;
  return {
    x: (x - y) * tileWidth / 2 + offsetX,
    y: (x + y) * tileHeight / 2 + offsetY
  };
}

// === PANEADO: eventos de drag para mover el mapa ===
function setupPanning() {
  // Mouse
  canvas.addEventListener('mousedown', e => {
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    lastPanX = panX;
    lastPanY = panY;
    document.body.style.cursor = "grabbing";
  });
  window.addEventListener('mousemove', e => {
    if (isPanning) {
      panX = lastPanX + (e.clientX - panStartX);
      panY = lastPanY + (e.clientY - panStartY);
    }
  });
  window.addEventListener('mouseup', e => {
    if (isPanning) {
      isPanning = false;
      document.body.style.cursor = "";
    }
  });
  // Touch
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      isPanning = true;
      panStartX = e.touches[0].clientX;
      panStartY = e.touches[0].clientY;
      lastPanX = panX;
      lastPanY = panY;
    }
  }, { passive: false });
  window.addEventListener('touchmove', e => {
    if (isPanning && e.touches.length === 1) {
      panX = lastPanX + (e.touches[0].clientX - panStartX);
      panY = lastPanY + (e.touches[0].clientY - panStartY);
    }
  }, { passive: false });
  window.addEventListener('touchend', e => {
    if (isPanning) isPanning = false;
  });
}

// === RECALCULA PANEADO AL REDIMENSIONAR ===
function resetPan() {
  panX = 0;
  panY = 0;
}

// === REEMPLAZA resizeCanvas PARA RESETEAR PANEADO ===
window.addEventListener('resize', () => {
  resizeCanvas();
  resetPan();
});
window.addEventListener('DOMContentLoaded', () => {
  resizeCanvas();
  resetPan();
});

// === LOOP Y TICK ===
let lastTime = performance.now();
function gameLoop(ts) {
  let dt = ((ts - lastTime) / CONFIG.gameTick);
  lastTime = ts;
  let c = criaturas[0];
  if (c.updateAnim) c.updateAnim(dt * 0.5);
  if (c.actualizarEstadoProgresivo) c.actualizarEstadoProgresivo(dt);
  renderEntorno();
  renderStatOverlay();
  requestAnimationFrame(gameLoop);
}
function tickJuego() {
  currentTick++;
  let c = criaturas[0];
  if (!c.moving && c.moverSiguienteAuto) c.moverSiguienteAuto();

  let fecha = getGameDateTime();
  if (turno === 0 || fecha.date === 1) planificarVisitasCris();
  if (crisVisitDays.includes(fecha.date) && !crisOnMap) iniciarVisitaCris();
  if (crisOnMap && turno >= crisTurnoFinaliza) finalizarVisitaCris();

  if (currentTick >= CONFIG.ticksPerTurn) {
    turno++; currentTick = 0;
    if (c.actualizarEstadoTurno) c.actualizarEstadoTurno();
    let puestoTrabajoObj = getObjById("puesto-trabajo");
    if (c.puedeVisitarTrabajo && c.puedeVisitarTrabajo() && c.posicion.x === puestoTrabajoObj.pos.x && c.posicion.y === puestoTrabajoObj.pos.y) {
      usarObjeto(c, puestoTrabajoObj, true);
    }
    if (c.puedeVisitarPsicologo && c.puedeVisitarPsicologo() && c.posicion.x === getObjById('psicologo').pos.x && c.posicion.y === getObjById('psicologo').pos.y) {
      c.visitarPsicologo();
    }
    renderLog();
  }
  actualizarUI();
  setTimeout(tickJuego, CONFIG.gameTick);
}

// === INACTIVIDAD ===
function chequearInactividad() {
  let ahora = Date.now();
  if (ahora - ultimaAccion > CONFIG.inactividadMs) {
    let c = criaturas[0];
    c.stats.confianza = clamp(c.stats.confianza - 20, 0, 100);
    c.vinculo = clamp((c.vinculo || 0) - 20, 0, 100);
    c.stats.saludMental = clamp(c.stats.saludMental - 10, 0, 100);
    c.ansiedad = clamp(c.ansiedad + 15, 0, 100);
    logMsg("¡Te has descuidado! Baja la confianza y el vínculo!", "warn");
    ultimaAccion = Date.now();
    actualizarUI();
  }
  setTimeout(chequearInactividad, 500);
}
['click', 'keydown', 'touchstart'].forEach(evt =>
  window.addEventListener(evt, () => { ultimaAccion = Date.now(); }, true)
);

// === ZOOM ===
function setZoom(z) {
  zoom = clamp(z, CONFIG.zoomMin, CONFIG.zoomMax);
  tileWidth = CONFIG.tileWidth * zoom;
  tileHeight = CONFIG.tileHeight * zoom;
  actualizarUI();
}
function crearZoomUI() {
  let zoomUI = document.createElement('div');
  zoomUI.style = "position:fixed;top:60px;right:16px;z-index:99;background:#2333;backdrop-filter:blur(2px);border-radius:9px;padding:7px 11px;";
  let menos = document.createElement('button');
  menos.textContent = "➖";
  menos.onclick = () => { setZoom(zoom - CONFIG.zoomStep); };
  let mas = document.createElement('button');
  mas.textContent = "➕";
  mas.onclick = () => { setZoom(zoom + CONFIG.zoomStep); };
  [menos, mas].forEach(b => { b.style = "font-size:1.3em;border-radius:5px;margin:4px;padding:2px 8px;"; });
  zoomUI.appendChild(menos); zoomUI.appendChild(mas);
  document.body.appendChild(zoomUI);
}
document.addEventListener("DOMContentLoaded", crearZoomUI);

// === ACCIONES MANUALES ===
function handlePointerEvent(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  let mx, my;
  if (e.touches && e.touches.length) {
    mx = e.touches[0].clientX - rect.left;
    my = e.touches[0].clientY - rect.top;
  } else {
    mx = e.clientX - rect.left;
    my = e.clientY - rect.top;
  }
  let clickTile = null, minDist = 999;
  for (let x = 0; x < CONFIG.gridWidth; x++) for (let y = 0; y < CONFIG.gridHeight; y++) {
    let { x: sx, y: sy } = isoToScreen(x, y);
    let cx = sx + tileWidth / 2, cy = sy + tileHeight / 2;
    let dist = Math.hypot(mx - cx, my - cy);
    if (dist < minDist && dist < tileWidth / 2) { minDist = dist; clickTile = { x, y }; }
  }
  if (!clickTile) return;
  let sel = criaturas[0];
  if (sel.posicion.x === clickTile.x && sel.posicion.y === clickTile.y) return;
  if (!inBounds(clickTile.x, clickTile.y)) return;
  let obj = CONFIG.objetos.find(o => o.pos.x === clickTile.x && o.pos.y === clickTile.y);
  if (obj && sel.cooldowns[obj.id] > 0) {
    logMsg("¡Debes esperar para volver a usar " + obj.name + "!", "warn");
    sel.moveToAnim(clickTile);
    return;
  }
  if (obj && typeof getEfectoById === "function") {
    if (usarObjeto(sel, obj, true)) { sel.moveToAnim(clickTile); return; }
  }
  sel.moveToAnim(clickTile);
}

// === BOTÓN LLAMAR A CRIS Y ESCUCHAR MÚSICA ===
function crearBotonesExtra() {
  let btnCris = document.createElement('button');
  btnCris.id = "btn-cris";
  btnCris.textContent = "📞 Llamar a Cris";
  btnCris.style = `
    position:fixed; bottom:24px; right:24px;
    background:#3f3c6b; color:#fff; border:none; border-radius:12px;
    font-size:1.23em; padding:16px 22px; z-index:99;
    box-shadow: 0 3px 14px #0006;
    cursor:pointer;
  `;
  btnCris.onclick = llamarACris;
  document.body.appendChild(btnCris);

  let btnMusica = document.createElement('button');
  btnMusica.id = "btn-musica";
  btnMusica.textContent = "🎵 Escuchar Música";
  btnMusica.style = `
    position:fixed; bottom:90px; right:24px;
    background:#2196f3; color:#fff; border:none; border-radius:12px;
    font-size:1.14em; padding:14px 17px; z-index:99;
    box-shadow: 0 3px 14px #0006;
    cursor:pointer;
  `;
  btnMusica.onclick = escucharMusica;
  document.body.appendChild(btnMusica);
}
document.addEventListener("DOMContentLoaded", crearBotonesExtra);

// === INICIO ===
async function main() {
  await loadConfig();
  tileWidth = CONFIG.tileWidth;
  tileHeight = CONFIG.tileHeight;
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  criaturas = [new Criatura(JSON.parse(JSON.stringify(CONFIG.personaje)))];
  if (canvas) {
    canvas.addEventListener('click', handlePointerEvent);
    canvas.addEventListener('touchstart', handlePointerEvent, { passive: false });
    canvas.focus();
    setupPanning(); // <= Nuevo
  }
  requestAnimationFrame(gameLoop);
  tickJuego();
  chequearInactividad();
}
main();
