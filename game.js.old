// version robusta: objetos clicables, path prioritario, acción segura y estados visuales

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
function clamp(num, min, max) { return Math.min(Math.max(num, min), max); }
function randomInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function inBounds(x, y) { return x >= 0 && y >= 0 && x < CONFIG.gridWidth && y < CONFIG.gridHeight; }
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

let criaturas = [], turno = 0, currentTick = 0, eventLog = [];
let ultimaAccion = Date.now(), zoom = 1.0, tileWidth, tileHeight;
let canvas, ctx;
let eventLogScroll = 0;

let crisVisitDays = [];
let crisOnMap = false;
let crisTurnoFinaliza = -1;
let crisPos = null;
let crisLlamadaUltima = -1000;

// --- Pathfinding ---
function findPath(from, to) {
  if (from.x === to.x && from.y === to.y) return [];
  let queue = [{ x: from.x, y: from.y, path: [] }];
  let visited = Array(CONFIG.gridWidth).fill(0).map(() => Array(CONFIG.gridHeight).fill(false));
  visited[from.x][from.y] = true;
  let dirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
  ];
  while (queue.length) {
    let { x, y, path } = queue.shift();
    for (let d of dirs) {
      let nx = x + d.x, ny = y + d.y;
      if (inBounds(nx, ny) && !visited[nx][ny]) {
        let newPath = path.concat([{ x: nx, y: ny }]);
        if (nx === to.x && ny === to.y) return newPath;
        visited[nx][ny] = true;
        queue.push({ x: nx, y: ny, path: newPath });
      }
    }
  }
  return [];
}

// --- FECHA Y TIEMPO ---
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

// --- EVENTOS ALEATORIOS ---
function triggerRandomEvent(zonaId, c) {
  if (!CONFIG.enableRandomEvents) return false;
  let triggered = false;
  for (let k in CONFIG.eventos) {
    let ev = CONFIG.eventos[k];
    if (ev.zonas.includes(zonaId) && Math.random() < ev.prob) {
      let ef = getEfectoById(ev.efecto);
      for (let st in ef) {
        if (st in c.stats) c.stats[st] = clamp(c.stats[st] + ef[st], 0, 100);
        else if (st === "ansiedad") c.ansiedad = clamp(c.ansiedad + ef[st], 0, 100);
      }
      logMsg(ev.msg, "warn");
      triggered = true;
    }
  }
  return triggered;
}

// --- MUERTE / GAME OVER ---
function checkMuerte(c) {
  if (!CONFIG.enableNormalEvents) return false;
  if (c.stats.hambre >= 100) { logMsg("¡Has muerto de hambre! 💀", "warn"); endGame("hambre"); return true; }
  if (c.stats.depresion >= 100) { logMsg("¡Has muerto por suicidio (depresión)! 💀", "warn"); endGame("suicidio"); return true; }
  if (c.stats.saludFisica <= 0) { logMsg("¡Has muerto por salud física muy baja! 💀", "warn"); endGame("saludFisica"); return true; }
  if (getZona(c.posicion.x, c.posicion.y).id === "calle" && c.ansiedad > 90 && Math.random() < 0.06) {
    logMsg("¡Has muerto atropellado! 💀", "warn"); endGame("atropello"); return true;
  }
  return false;
}
function endGame(tipo) {
  setTimeout(() => {
    alert("Juego terminado por: " + tipo + ". Recarga la página para volver a empezar.");
    window.location.reload();
  }, 900);
}

// --- CRIS ---
function planificarVisitasCris() {
  let daysInMonth = 30;
  let days = [];
  let min = CONFIG.cris.aparicionMin;
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
  if (turno === crisLlamadaUltima) { logMsg("¡Ya has llamado a Cris hoy!", "warn"); return; }
  crisLlamadaUltima = turno;
  let c = criaturas[0];
  let efecto = getEfectoById("cris-llamada");
  c.ansiedad = clamp(c.ansiedad + (efecto.ansiedad || 0), 0, 100);
  c.stats.saludMental = clamp(c.stats.saludMental + (efecto.saludMental || 0), 0, 100);
  c.stats.felicidad = clamp(c.stats.felicidad + (efecto.felicidad || 0), 0, 100);
  logMsg("Has llamado a Cris. Conversaron y te sientes mejor.", "good");
  actualizarUI();
}

// --- ESCUCHAR MÚSICA ---
let musicaCooldown = -1000;
function escucharMusica() {
  if (musicaCooldown === turno) { logMsg("Solo puedes escuchar música una vez por día.", "warn"); return; }
  musicaCooldown = turno;
  let c = criaturas[0];
  let efecto = getEfectoById("musica");
  c.ansiedad = clamp(c.ansiedad + (efecto.ansiedad || 0), 0, 100);
  c.stats.felicidad = clamp(c.stats.felicidad + (efecto.felicidad || 0), 0, 100);
  c.stats.saludMental = clamp(c.stats.saludMental + (efecto.saludMental || 0), 0, 100);
  logMsg('Escuchando: Cuando me siento bien :)', "good");
  actualizarUI();
}

// --- EMOJI SEGÚN ESTADO DE ÁNIMO ---
function getEstadoEmoji(c) {
  const f = c.stats.felicidad, a = c.ansiedad, m = c.stats.saludMental, d = c.stats.depresion;
  if (c.estadoEmocional === 'enCrisis' || (a > 85 && m < 40)) return "🥵";
  if (m < 30 && a > 70) return "😱";
  if (d > 60) return "🫀";
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

// --- CLASE CRIATURA ---
class Criatura {
  constructor(data) {
    Object.assign(this, data);
    this.cooldowns = {};
    this.lastPsicologoTurn = -1000;
    this.lastTrabajoTurn = -1000;
    this.ansiedad = 0;
    this.moving = false;
    this.moveAnim = { from: { ...this.posicion }, to: { ...this.posicion }, t: 1 };
    this.path = [];
    this.pathObjTarget = undefined;
    this.depresionActivo = false;
  }
  clampStats() {
    for (const stat in this.stats)
      this.stats[stat] = clamp(this.stats[stat], 0, 100);
    this.ansiedad = clamp(this.ansiedad, 0, 100);
  }
  actualizarEstadoProgresivo(dt) {
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
    if (!CONFIG.enableNormalEvents) return;
    this.stats.confianza = clamp(this.stats.confianza + (CONFIG.turnoConfianza || 10), 0, 100);
    this.vinculo = clamp((this.vinculo || 0) + (CONFIG.turnoVinculo || 10), 0, 100);
    let mejora = Math.floor((this.stats.confianza + (this.vinculo || 0)) / 20);
    this.stats.saludMental = clamp(this.stats.saludMental + mejora, 0, 100);

    let fecha = getGameDateTime();
    if (fecha.weekDay >= 1 && fecha.weekDay <= 5 && (!this.lastTrabajoTurn || this.lastTrabajoTurn !== turno - 1)) {
      this.ansiedad = clamp((this.ansiedad || 0) + (CONFIG.trabajoNoHechoAnsiedad || 8), 0, 100);
      logMsg("¡Uy! Se te olvidó trabajar. ¡La ansiedad sube!", "warn");
    }
    if (this.ansiedad > 0) {
      let mentalPenalty = Math.floor(this.ansiedad / 10);
      this.stats.saludMental = clamp(this.stats.saludMental - mentalPenalty, 0, 100);
    }
    if (this.ansiedad > (CONFIG.felicidadAnsiedadUmbral ?? 60)) {
      this.stats.felicidad = clamp(this.stats.felicidad - (CONFIG.felicidadAnsiedadDecaimiento ?? 8), 0, 100);
    }
    if (this.ansiedad > 0) this.ansiedad -= (CONFIG.turnoAnsiedadRebaja || 5);

    // Depresión activa: si ansiedad > 70 y felicidad < 35, depresión está activa
    if (this.ansiedad > 70 && this.stats.felicidad < 35) {
      if (!this.depresionActivo) {
        logMsg("¡Cuidado! Estás entrando en depresión.", "warn");
      }
      this.depresionActivo = true;
    } else {
      this.depresionActivo = false;
    }

    // Subida diaria de depresión si está activa
    if (this.depresionActivo) {
      // Sube la depresión según config
      this.stats.depresion = clamp(this.stats.depresion + (CONFIG.turnoDepresionSubida || 20), 0, 100);
      let ef = getEfectoById("depresion");
      for (let k in ef) {
        if (k in this.stats) this.stats[k] = clamp(this.stats[k] + ef[k], 0, 100);
        else if (k === "ansiedad") this.ansiedad = clamp(this.ansiedad + ef[k], 0, 100);
      }
    } else {
      if (this.stats.depresion > 0) this.stats.depresion = clamp(this.stats.depresion - 8, 0, 100);
    }

    if (this.stats.hambre > 80) {
      this.stats.saludFisica = clamp(this.stats.saludFisica - 7, 0, 100);
    }
    for (const k in this.cooldowns) {
      if (this.cooldowns[k] > 0) this.cooldowns[k] -= CONFIG.turno;
      if (this.cooldowns[k] < 0) this.cooldowns[k] = 0;
    }
    this.clampStats();
    checkMuerte(this);
  }
  puedeVisitarPsicologo() {
    return (turno - this.lastPsicologoTurn) >= CONFIG.psicologoMinDias;
  }
  visitarPsicologo() {
    if (!this.puedeVisitarPsicologo()) { logMsg("¡Debes esperar para volver al psicólogo!", "warn"); return false; }
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
    this.stats.energia = clamp(this.stats.energia + (efecto.energia || -5), 0, 100);
    this.stats.saludMental = clamp(this.stats.saludMental + (efecto.saludMental || -4), 0, 100);
    this.stats.felicidad = clamp(this.stats.felicidad + (efecto.felicidad || 4), 0, 100);
    this.lastTrabajoTurn = turno;
    logMsg("¡Has ido a trabajar! ☕", "good");
    return true;
  }
  // --- Movimiento prioritario hacia objetos ---
  moverSiguienteAuto() {
    if (this.path && this.path.length > 0) {
      let next = this.path.shift();
      this.moveToAnim(next);
      return;
    }
    // Si hay un objetivo de objeto y NO hay path, permanece quieto para ejecutar acción en tickJuego
    if (this.pathObjTarget) return;
    // Si no, moverse aleatorio
    let dirs = [
      { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
      { x: 1, y: -1 }, { x: -1, y: 1 }
    ];
    dirs = shuffle(dirs).filter(d => inBounds(this.posicion.x + d.x, this.posicion.y + d.y));
    let d = dirs[0];
    let nx = clamp(this.posicion.x + d.x, 0, CONFIG.gridWidth - 1), ny = clamp(this.posicion.y + d.y, 0, CONFIG.gridHeight - 1);
    this.moveToAnim({ x: nx, y: ny });
  }
  moveToAnim(target) {
    this.moving = true;
    this.moveAnim = { from: { ...this.posicion }, to: { ...target }, t: 0 };
    let zona = getZona(target.x, target.y);
    triggerRandomEvent(zona.id, this);
  }
  updateAnim(dt) {
    if (this.moving) {
      this.moveAnim.t += dt * 2.5;
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

// --- USO DE OBJETOS ---
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
    else if (k === "depresion") c.stats.depresion = clamp(c.stats.depresion + efecto[k], 0, 100);
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

let objetoEstado = {}; // { id: "idle"/"inprogress"/"done"/"cooldown"/"blocked" }

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
    ${renderStatBar('Depresión', c.stats.depresion || 0, '#5a34a3')}
    <div>Turno: ${turno}</div>
  `;
  criaturasPanel.appendChild(div);
  renderObjetosInteractivos();
}

function renderObjetosInteractivos() {
  let panel = document.getElementById('objetosPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = "objetosPanel";
    panel.className = "panel-section";
    panel.style.marginTop = "18px";
    document.getElementById('sidepanel').appendChild(panel);
  }
  panel.innerHTML = "<b>Objetos:</b><br>";

  CONFIG.objetos.forEach(obj => {
    let c = criaturas[0];
    let estado = "idle";
    let cooldown = c.cooldowns[obj.id] || 0;
    if (cooldown > 0) {
      estado = "cooldown";
    } else if (objetoEstado[obj.id] === "inprogress") {
      estado = "inprogress";
    } else if (objetoEstado[obj.id] === "done") {
      estado = "done";
    } else {
      if (!puedeUsarObjeto(c, obj)) {
        estado = "blocked";
      }
    }
    let button = document.createElement('button');
    button.className = "objeto-boton";
    button.innerHTML = `<span style="font-size:1.4em;">${obj.icon}</span> ${obj.name}`;
    button.style.margin = "4px 7px 4px 0";
    button.style.borderRadius = "9px";
    button.style.padding = "8px 12px";
    button.style.fontWeight = "bold";
    button.style.fontFamily = "inherit";
    button.style.fontSize = "1em";
    button.style.border = "none";
    button.style.boxShadow = "0 6px 0 0 #a00";
    button.style.transition = "all 0.15s";
    button.style.filter = "drop-shadow(0 2px 2px #211c)";
    button.style.cursor = "pointer";
    button.disabled = false;

    if (estado === "idle") {
      button.style.background = "#222";
      button.style.color = "#fff";
      button.style.boxShadow = "0 6px 0 0 #e44";
    } else if (estado === "inprogress") {
      button.style.background = "#ffe066";
      button.style.color = "#222";
      button.style.boxShadow = "0 6px 0 0 #bfa900";
      button.disabled = true;
    } else if (estado === "done") {
      button.style.background = "#1fc73a";
      button.style.color = "#fff";
      button.style.boxShadow = "0 6px 0 0 #0b5c1e";
      button.disabled = true;
    } else if (estado === "cooldown") {
      button.style.background = "#d6d6d6";
      button.style.color = "#aaa";
      button.style.boxShadow = "0 6px 0 0 #555";
      button.disabled = true;
      button.title = "En cooldown";
    } else if (estado === "blocked") {
      button.style.background = "#111";
      button.style.color = "#888";
      button.style.boxShadow = "0 6px 0 0 #000";
      button.disabled = true;
      button.title = "No se puede usar ahora";
    }

    button.onclick = () => {
      if (estado !== "idle") return;
      let c = criaturas[0];
      if (c.posicion.x === obj.pos.x && c.posicion.y === obj.pos.y) {
        objetoEstado[obj.id] = "inprogress";
        renderObjetosInteractivos();
        setTimeout(() => {
          if (puedeUsarObjeto(c, obj)) {
            let ok = usarObjeto(c, obj, true);
            if (ok) {
              objetoEstado[obj.id] = "done";
              renderObjetosInteractivos();
              setTimeout(() => {
                objetoEstado[obj.id] = undefined;
                renderObjetosInteractivos();
              }, 2000);
            } else {
              objetoEstado[obj.id] = "blocked";
              renderObjetosInteractivos();
              setTimeout(() => {
                objetoEstado[obj.id] = undefined;
                renderObjetosInteractivos();
              }, 1500);
            }
          } else {
            objetoEstado[obj.id] = "blocked";
            renderObjetosInteractivos();
            setTimeout(() => {
              objetoEstado[obj.id] = undefined;
              renderObjetosInteractivos();
            }, 1500);
          }
        }, 350);
        return;
      }
      objetoEstado[obj.id] = "inprogress";
      renderObjetosInteractivos();
      c.path = findPath(c.posicion, obj.pos);
      c.pathObjTarget = obj;
    };

    panel.appendChild(button);
  });
}

function puedeUsarObjeto(c, obj) {
  let efecto = getEfectoById(obj.id);
  if ((c.cooldowns[obj.id] || 0) > 0) return false;
  let saturado = false;
  for (let k in efecto) {
    if (k === "hambre" && efecto[k] < 0 && c.stats.hambre <= 0) saturado = true;
    else if (k === "hambre" && efecto[k] > 0 && c.stats.hambre >= 100) saturado = true;
    else if (k !== "hambre" && (c.stats[k] !== undefined) && efecto[k] > 0 && c.stats[k] >= 100) saturado = true;
    else if (k !== "hambre" && (c.stats[k] !== undefined) && efecto[k] < 0 && c.stats[k] <= 0) saturado = true;
  }
  if (saturado) return false;
  if (obj.id === "puesto-trabajo" && !c.puedeVisitarTrabajo()) return false;
  if (obj.id === "psicologo" && !c.puedeVisitarPsicologo()) return false;
  return true;
}

// --- ACCIONES MANUALES CON PATHFINDING (mejorado para objetos) ---
function handlePointerEvent(e) {
  if (isPanning) return;
  e.preventDefault();
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  let mx, my;
  if (e.touches && e.touches.length) {
    mx = e.touches[0].clientX - rect.left;
    my = e.touches[0].clientY - rect.top;
  } else {
    mx = e.clientX - rect.left;
    my = e.clientY - rect.top;
  }
  mx = mx / dpr;
  my = my / dpr;

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
  if (obj && puedeUsarObjeto(sel, obj)) {
    objetoEstado[obj.id] = "inprogress";
    renderObjetosInteractivos();
    sel.path = findPath(sel.posicion, obj.pos);
    sel.pathObjTarget = obj;
    return;
  }
  sel.path = findPath(sel.posicion, clickTile);
  sel.pathObjTarget = undefined;
}

// --- LOGICA DE EJECUCIÓN DE OBJETOS AL LLEGAR ---
function tickJuego() {
  currentTick++;
  let c = criaturas[0];

  // Prioridad: si hay path o pathObjTarget, NO moverse aleatorio.
  if (!c.moving && (c.path && c.path.length > 0 || c.pathObjTarget)) {
    c.moverSiguienteAuto();
  } else if (!c.moving && !c.pathObjTarget) {
    // Solo moverse aleatorio si no hay ninguna acción pendiente
    c.moverSiguienteAuto();
  }

  // Si el personaje llegó a un objeto marcado como destino
  if (!c.moving && c.pathObjTarget) {
    let obj = c.pathObjTarget;
    if (c.posicion.x === obj.pos.x && c.posicion.y === obj.pos.y) {
      if (puedeUsarObjeto(c, obj)) {
        let ok = usarObjeto(c, obj, true);
        if (ok) {
          objetoEstado[obj.id] = "done";
          renderObjetosInteractivos();
          setTimeout(() => {
            objetoEstado[obj.id] = undefined;
            renderObjetosInteractivos();
          }, 2000);
        } else {
          objetoEstado[obj.id] = "blocked";
          renderObjetosInteractivos();
          setTimeout(() => {
            objetoEstado[obj.id] = undefined;
            renderObjetosInteractivos();
          }, 1500);
        }
      } else {
        objetoEstado[obj.id] = "blocked";
        renderObjetosInteractivos();
        setTimeout(() => {
          objetoEstado[obj.id] = undefined;
          renderObjetosInteractivos();
        }, 1500);
      }
      c.pathObjTarget = undefined;
    }
  }

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

// --- LOGS Y PANEL VISUAL ---
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

// --- ESTILO Y UI ---
function renderStatBar(name, val, color) {
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  if (!isMobile) {
    return `<div class="stat-bar" title="${name}" style="position:relative; height:18px; background:#3335; border-radius:7px; margin:4px 0 3px 0;">
      <span class="stat-fill" style="position:absolute; left:0; top:0; height:18px; border-radius:7px; background:${color}; width:${clamp(val,0,100)}%;"></span>
      <span class="stat-text" style="position:absolute; left:10px; top:0; font-size:13px; color:#fff;">${name}: ${Math.round(val)}</span>
    </div>`;
  } else {
    return `<div class="stat-bar-vert" title="${name}" style="position:relative; width:28px; height:90px; background:#3335; border-radius:9px; margin:5px 5px 5px 5px; display:flex; flex-direction:column; align-items:center;">
      <span class="stat-fill-vert" style="position:absolute; left:0; bottom:0; width:100%; border-radius:9px; background:${color}; height:${clamp(val,0,100)}%; transition:height 0.3s;"></span>
      <span class="stat-icon" style="position:relative; z-index:2; margin-top:4px; font-size:1.1em;">${getEmojiForStat(name)}</span>
      <span class="stat-value" style="position:relative; z-index:2; margin-bottom:4px; font-size:0.93em; color:#fff; font-weight:bold;">${Math.round(val)}</span>
      <span class="stat-label" style="position:relative; z-index:2; margin-bottom:3px; font-size:0.81em; color:#cdf;">${nameShort(name)}</span>
    </div>`;
  }
}
function getEmojiForStat(name) {
  switch (name.toLowerCase()) {
    case "hambre": return "😋";
    case "felicidad": return "😊";
    case "energía": case "energia": return "⚡";
    case "confianza": return "🫝";
    case "vínculo": case "vinculo": return "💞";
    case "salud mental": return "🧠";
    case "salud física": case "salud fisica": return "💪";
    case "ansiedad": return "😰";
    case "depresión": case "depresion": return "🫀";
    default: return "🔹";
  }
}
function nameShort(name) {
  switch (name.toLowerCase()) {
    case "hambre": return "Ham";
    case "felicidad": return "Feli";
    case "energía": case "energia": return "En";
    case "confianza": return "Con";
    case "vínculo": case "vinculo": return "Vín";
    case "salud mental": return "Ment";
    case "salud física": case "salud fisica": return "Fís";
    case "ansiedad": return "Ans";
    case "depresión": case "depresion": return "Dep";
    default: return name.slice(0,3);
  }
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
  const diasLetras = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  if (!isMobile) {
    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;gap:2.2em;">
        <b>${c.nombre}</b>
        <span>😋${Math.round(c.stats.hambre)}</span>
        <span>${getEstadoEmoji(c)}${Math.round(c.stats.felicidad)}</span>
        <span>⚡${Math.round(c.stats.energia)}</span>
        <span>🫝${Math.round(c.vinculo)}</span>
        <span>🧠${Math.round(c.stats.saludMental)}</span>
        <span>💪${Math.round(c.stats.saludFisica)}</span>
        <span>😰${Math.round(c.ansiedad)}</span>
        <span>🫀${Math.round(c.stats.depresion)}</span>
        <span style="margin-left:24px;">${fecha.str}</span>
      </div>
    `;
  } else {
    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;gap:1.1em;">
        <b>${c.nombre}</b>
        <span>😋${Math.round(c.stats.hambre)}</span>
        <span>${getEstadoEmoji(c)}${Math.round(c.stats.felicidad)}</span>
        <span>⚡${Math.round(c.stats.energia)}</span>
        <span>🫝${Math.round(c.vinculo)}</span>
        <span>🧠${Math.round(c.stats.saludMental)}</span>
        <span>💪${Math.round(c.stats.saludFisica)}</span>
        <span>😰${Math.round(c.ansiedad)}</span>
        <span>🫀${Math.round(c.stats.depresion)}</span>
      </div>
      <div style="margin-top:6px;font-size:1.2em;text-align:center;">
        📅 <span style="font-size:1.13em;letter-spacing:.23em;">${diasLetras[fecha.jsDay]}</span>
      </div>
    `;
  }
}

// --- ENTORNO Y ANIMACIÓN ---
function renderEntorno() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

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

// --- PANEADO Y ZOOM ---
let panX = 0, panY = 0;
let isPanning = false;
let lastPanX = 0, lastPanY = 0;
let panStartX = 0, panStartY = 0;

function isoToScreen(x, y) {
  const centerX = (canvas.width / (window.devicePixelRatio || 1)) / 2;
  const centerY = (canvas.height / (window.devicePixelRatio || 1)) / 2;
  const mapPixelWidth = (CONFIG.gridWidth + CONFIG.gridHeight) * tileWidth / 2;
  const mapPixelHeight = (CONFIG.gridWidth + CONFIG.gridHeight) * tileHeight / 2;
  const offsetX = centerX - mapPixelWidth / 2 + panX;
  const offsetY = centerY - mapPixelHeight / 2 + panY;
  return {
    x: (x - y) * tileWidth / 2 + offsetX,
    y: (x + y) * tileHeight / 2 + offsetY
  };
}

function setupPanning() {
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

function resetPan() { panX = 0; panY = 0; }
window.addEventListener('resize', () => { resizeCanvas(); resetPan(); });
window.addEventListener('DOMContentLoaded', () => { resizeCanvas(); resetPan(); });

// --- LOOP Y TICK ---
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
function actualizarUI() {
  renderCriaturasPanel();
  renderStatOverlay();

  // Para integración móvil (NO BORRA NADA DE TU LÓGICA)
  window.criaturas = criaturas;
  window.CONFIG = CONFIG;
  window.puedeUsarObjeto = puedeUsarObjeto;
  window.usarObjeto = usarObjeto;

  if (window.innerWidth <= 800) {
    if (window.renderStatVertical) window.renderStatVertical();
    if (window.renderMobileObjetos) window.renderMobileObjetos();
  }
}

// --- INACTIVIDAD ---
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

// --- ZOOM ---
function setZoom(z) {
  zoom = clamp(z, CONFIG.zoomMin, CONFIG.zoomMax);
  tileWidth = CONFIG.tileWidth * zoom;
  tileHeight = CONFIG.tileHeight * zoom;
  actualizarUI();
}
function crearZoomUI() {
  let zoomUI = document.createElement('div');
  zoomUI.className = "zoom-ui";
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

// --- BOTONES EXTRAS ---
function crearBotonesExtra() {
  // Agrupamos los tres botones en una caja si es móvil
  const isMobile = window.innerWidth <= 800;
  let prevCont = document.getElementById('mobile-btns-group');
  if (prevCont) prevCont.remove(); // Limpieza
  if (isMobile) {
    let cont = document.createElement('div');
    cont.id = 'mobile-btns-group';
    cont.style.position = "fixed";
    cont.style.right = "14px";
    cont.style.bottom = "18px";
    cont.style.zIndex = 222;
    cont.style.display = "flex";
    cont.style.flexDirection = "column";
    cont.style.alignItems = "flex-end";
    cont.style.gap = "16px";
    document.body.appendChild(cont);

    // Botón Mochila (primero)
    let btnMochila = document.createElement('button');
    btnMochila.id = "mobile-obj-btn";
    btnMochila.className = "floating-btn";
    btnMochila.innerHTML = "🎒 Mochila";
    btnMochila.onclick = function() {
      document.getElementById('mobile-obj-panel').classList.add('active');
      if (window.renderMobileObjetos) window.renderMobileObjetos();
    };
    cont.appendChild(btnMochila);

    // Botón Llamar a Cris
    let btnCris = document.createElement('button');
    btnCris.id = "btn-cris";
    btnCris.className = "floating-btn";
    btnCris.textContent = "📞 Cris";
    btnCris.style.background = "#3f3c6b";
    btnCris.onclick = llamarACris;
    cont.appendChild(btnCris);

    // Botón Música
    let btnMusica = document.createElement('button');
    btnMusica.id = "btn-musica";
    btnMusica.className = "floating-btn";
    btnMusica.textContent = "🎵 Música";
    btnMusica.style.background = "#2196f3";
    btnMusica.onclick = escucharMusica;
    cont.appendChild(btnMusica);
  } else {
    // Escritorio: igual que antes, pero evita duplicados
    if (!document.getElementById('btn-cris')) {
      let btnCris = document.createElement('button');
      btnCris.id = "btn-cris";
      btnCris.className = "floating-btn";
      btnCris.textContent = "📞 Llamar a Cris";
      btnCris.onclick = llamarACris;
      document.body.appendChild(btnCris);
    }

    if (!document.getElementById('btn-musica')) {
      let btnMusica = document.createElement('button');
      btnMusica.id = "btn-musica";
      btnMusica.className = "floating-btn";
      btnMusica.textContent = "🎵 Escuchar Música";
      btnMusica.style.bottom = "90px";
      btnMusica.onclick = escucharMusica;
      document.body.appendChild(btnMusica);
    }
  }
}
document.addEventListener("DOMContentLoaded", crearBotonesExtra);
window.addEventListener('resize', crearBotonesExtra);

// --- INICIO ---
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
    setupPanning();
  }
  requestAnimationFrame(gameLoop);
  tickJuego();
  chequearInactividad();
}
main();
