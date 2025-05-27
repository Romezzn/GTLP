// UI móvil para Tamagotchi TLP, usando la lógica de game.js
// game.js ya debe estar cargado en la página

// --- Inicialización y helpers ---
function statList(c) {
  // Devuelve array de stats para la barra vertical
  return [
    {k:'hambre', em:'😋', col:'#b3b703', lbl:'Ham', v:c.stats?.hambre||0},
    {k:'felicidad',em:'😊',col:'#f2c53d',lbl:'Feli',v:c.stats?.felicidad||0},
    {k:'energia',em:'⚡',col:'#19d5e4',lbl:'En',v:c.stats?.energia||0},
    {k:'confianza',em:'🤝',col:'#b39ddb',lbl:'Con',v:c.stats?.confianza||0},
    {k:'vinculo',em:'💞',col:'#ec6',lbl:'Vín',v:c.vinculo||0},
    {k:'saludMental',em:'🧠',col:'#21e27b',lbl:'Ment',v:c.stats?.saludMental||0},
    {k:'saludFisica',em:'💪',col:'#f58f3b',lbl:'Fís',v:c.stats?.saludFisica||0},
    {k:'ansiedad',em:'😰',col:'#e56',lbl:'Ans',v:c.ansiedad||0},
    {k:'depresion',em:'🥀',col:'#5a34a3',lbl:'Dep',v:c.stats?.depresion||0}
  ];
}
function renderMobileStats() {
  const c = window.criaturas?.[0] || (window.CONFIG && window.CONFIG.personaje);
  const el = document.getElementById('mobile-stats');
  if (!el) return;
  if (!c || !c.stats) {
    el.innerHTML = '<div style="margin-top:2em;color:#fff;font-size:1.1em;">Cargando…</div>';
    return;
  }
  el.innerHTML = statList(c).map(stat =>
    `<div class="stat-icon-block" style="color:${stat.col}">
      <span class="em">${stat.em}</span>
      <span class="val">${Math.round(stat.v)}</span>
      <span class="lbl">${stat.lbl}</span>
    </div>`).join('');
}

function renderCreatureInfo() {
  const c = window.criaturas?.[0];
  const el = document.getElementById('creature-info');
  if (!el || !c) return;
  el.innerHTML = `
    <span><span class="emoji">${getEstadoEmoji(c)}</span> <b>${c.nombre}</b> (${c.personalidad})</span>
    <span class="turn-box">Turno: ${window.turno || 0}</span>
  `;
}
function renderObjectsPanel() {
  const c = window.criaturas?.[0];
  const el = document.getElementById('mobile-objects');
  if (!el || !c) return;
  el.innerHTML = '';
  window.CONFIG.objetos.forEach(obj => {
    let cooldown = c.cooldowns?.[obj.id] || 0;
    let blocked = !puedeUsarObjeto ? false : !puedeUsarObjeto(c, obj);
    let disabled = cooldown > 0 || blocked;
    let btn = document.createElement('button');
    btn.className = "object-btn";
    btn.innerHTML = `<span class="icon">${obj.icon}</span><span class="lbl">${obj.name}</span>`;
    btn.disabled = disabled;
    btn.onclick = () => {
      if (disabled) return;
      usarObjeto(c, obj, true);
      renderObjectsPanel();
      renderMobileStats();
      renderCreatureInfo();
    };
    el.appendChild(btn);
  });
}
function renderLogPanel() {
  const el = document.getElementById('mobile-log');
  if (!el) return;
  let logs = window.eventLog || [];
  if (!logs.length) {
    el.innerHTML = '<div style="color:#fff;font-size:1em;">Sin mensajes todavía.</div>';
    return;
  }
  let visibleCount = 7;
  let logsToShow = logs.slice(-visibleCount);
  el.innerHTML = logsToShow.map(e =>
    `<div class="log-msg ${e.type || ''}">${e.msg}</div>`
  ).join('');
}

// --- Tab navigation ---
function showTab(tab) {
  document.getElementById('canvas').style.display = (tab === 'game') ? '' : 'none';
  document.getElementById('creature-info').style.display = (tab === 'game') ? '' : 'none';
  document.getElementById('mobile-objects').style.display = (tab === 'objects') ? '' : 'none';
  document.getElementById('mobile-log').style.display = (tab === 'log') ? '' : 'none';
  Array.from(document.getElementsByClassName('footer-btn')).forEach(btn => btn.classList.remove('selected'));
  document.getElementById('tab-game').classList.toggle('selected', tab === 'game');
  document.getElementById('tab-objects').classList.toggle('selected', tab === 'objects');
  document.getElementById('tab-log').classList.toggle('selected', tab === 'log');
}
document.getElementById('tab-game').onclick = () => showTab('game');
document.getElementById('tab-objects').onclick = () => { showTab('objects'); renderObjectsPanel(); };
document.getElementById('tab-log').onclick = () => { showTab('log'); renderLogPanel(); };
showTab('game');

// --- Reemplaza hooks de UI del game.js por los nuestros ---
function mobileActualizarUI() {
  renderMobileStats();
  renderCreatureInfo();
  renderObjectsPanel();
}
window.actualizarUI = mobileActualizarUI;
// Además, actualiza el log panel cuando haya logs nuevos
const origLogMsg = window.logMsg;
window.logMsg = function(msg, type) {
  origLogMsg(msg, type);
  renderLogPanel();
};

// --- Hook al resize ---
window.addEventListener('resize', () => {
  setTimeout(() => {
    renderMobileStats();
    renderCreatureInfo();
    renderObjectsPanel();
    renderLogPanel();
  }, 5);
});

// --- Inicia UI cuando cargue game.js ---
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    renderMobileStats();
    renderCreatureInfo();
    renderObjectsPanel();
    renderLogPanel();
  }, 200);
});