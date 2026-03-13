// ============================================================
// 🏛️ OOP CORE: DATA MODELS (Headless State)
// ============================================================
var BOARD_SIZE = 7;
var HAND_LIMIT = 7;
var gameSpeed = 1;

class CardState {
  constructor(data, uid, owner) {
    this.uid = uid; this.id = data.id || data.name; this.name = data.name;
    this.owner = owner; this.image = data.image;
    this.baseHP = data.baseHP || data.hp || 0;
    this.maxHP = this.baseHP; this.hp = data.hp || this.baseHP;
    this.baseATK = data.baseATK || data.atk || 0; this.atk = data.atk || this.baseATK;
    this.waitTime = data.waitTime || 0; this.baseWait = data.baseWait || this.waitTime;
    this.skills = data.skills ? data.skills.map(s => ({ ...s })) : [];
    
    // 🐛 [Fix] ซิงก์ค่า Shadow เข้า status โดยตรงตั้งแต่เกิด
    this.status = { 
      burn: 0, corrupt: 0, stun: 0, 
      shadow: this.skills.some(s => s.name && s.name.includes("Shadow Protocol")) ? 2 : 0, 
      immortal: 0, reviveBuff: 0 
    };
    this.flags = { isSummoned: data.isSummoned || false, isClone: data.isClone || false, isDying: false, preventDeath: false, hasRevived: false, unrevivable: false, isExecutingAttack: false, _initialized: false };
    this.cooldowns = {};
  }
}

class PlayerState {
  constructor(id, name, hp) {
    this.id = id; this.name = name; this.hp = hp; this.maxHP = hp;
    this.deck = []; this.hand = []; this.board = Array(BOARD_SIZE).fill(null); this.graveyard = [];
  }
}

class GameState {
  constructor() {
    this.p1 = new PlayerState('p1', 'พีช', 30000); this.p2 = new PlayerState('p2', 'บอส', 100000);
    this.isGameOver = false; this.turnCount = 0; this.uidCounter = 0; this.combatStats = {};
  }
  getPlayer(isP1) { return isP1 ? this.p1 : this.p2; }
  getOpp(isP1)    { return isP1 ? this.p2 : this.p1; }
  generateUID()   { return ++this.uidCounter; }
}

window.engineState = null;
window.gameEngine = null;

var defineSafeAlias = (propName, getter, arrTargetFn) => {
  Object.defineProperty(window, propName, {
    get: getter,
    set: (v) => { if (!window.engineState) return; if (arrTargetFn) { const arr = arrTargetFn(); if(arr) { arr.length = 0; if (Array.isArray(v)) arr.push(...v); } } },
    configurable: true
  });
};

Object.defineProperty(window, 'playerHP', { get: () => window.engineState?.p1.hp, set: (v) => { if(window.engineState) window.engineState.p1.hp = v; }, configurable: true });
Object.defineProperty(window, 'enemyHP', { get: () => window.engineState?.p2.hp, set: (v) => { if(window.engineState) window.engineState.p2.hp = v; }, configurable: true });
Object.defineProperty(window, 'combatStats', { get: () => window.engineState?.combatStats, set: (v) => { if(window.engineState) window.engineState.combatStats = v; }, configurable: true });
Object.defineProperty(window, 'isGameOver', { get: () => window.engineState?.isGameOver, set: (v) => { if(window.engineState) window.engineState.isGameOver = v; }, configurable: true });
Object.defineProperty(window, 'cardUidCounter', { get: () => window.engineState?.uidCounter, set: (v) => { if(window.engineState) window.engineState.uidCounter = v; }, configurable: true });

defineSafeAlias('playerBoard', () => window.engineState?.p1.board, () => window.engineState?.p1.board);
defineSafeAlias('enemyBoard', () => window.engineState?.p2.board, () => window.engineState?.p2.board);
defineSafeAlias('hand', () => window.engineState?.p1.hand, () => window.engineState?.p1.hand);
defineSafeAlias('enemyHand', () => window.engineState?.p2.hand, () => window.engineState?.p2.hand);
defineSafeAlias('playerGraveyard', () => window.engineState?.p1.graveyard, () => window.engineState?.p1.graveyard);
defineSafeAlias('enemyGraveyard', () => window.engineState?.p2.graveyard, () => window.engineState?.p2.graveyard);
defineSafeAlias('playerDeck', () => window.engineState?.p1.deck, () => window.engineState?.p1.deck);
defineSafeAlias('enemyDeck', () => window.engineState?.p2.deck, () => window.engineState?.p2.deck);

function cloneCard(c) { try { return structuredClone(c); } catch { return JSON.parse(JSON.stringify(c)); } }

var boardDirty = false;
var sleep = ms => new Promise(r => setTimeout(r, ms / gameSpeed));
var sd    = (fn, ms) => setTimeout(fn, ms / gameSpeed);
window.$  = id => document.getElementById(id);
var hasSkill = (c, k) => c?.skills?.some(s => s.id ? s.id === k : s.name.includes(k));
var markDirty = () => { boardDirty = true; };
var flushBoard = () => { if (boardDirty) { if(typeof realRenderBoard === 'function') realRenderBoard(); boardDirty = false; } };

window.getMyBoard = (isP1) => isP1 ? window.engineState?.p1.board : window.engineState?.p2.board;
window.getOppBoard = (isP1) => isP1 ? window.engineState?.p2.board : window.engineState?.p1.board;

var handZone, enemyHandZone, playerBoardSlots, enemyBoardSlots;
var playerHeroText, enemyHeroText, playerHeroEl, enemyHeroEl;
var endTurnBtn, logContent, logToggle, logContainer, statsBtn, statsContainer;
var detailModal, detailClose, detailPlayBtn, graveBtn, graveModal, closeModal, graveList, battlefieldEl;
var globalFloatOrder = 0;

function addLog(msg) {
  if (!logContent) return;
  const e = document.createElement('div'); e.className = 'log-entry';
  e.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString('th-TH', { hour12: false })}]</span> ${msg}`;
  logContent.appendChild(e); logContent.scrollTop = logContent.scrollHeight;
}

var lastFloatTime = window.lastFloatTime || new WeakMap();
var FLOAT_CFG = { dmg: { color:"#ff3333", size:"2.2rem" }, heal: { color:"#33ff33", size:"2.2rem" }, skill: { color:"#ffcc00", size:"1.6rem" }, drain: { color:"#ffd700", size:"2.2rem" } };
var floatPool = window.floatPool || []; 
var floatQueue = window.floatQueue || []; 
var activeFloats = window.activeFloats || [];
var battlefieldRect = null; 
var rectCache = window.rectCache || new Map();

if (floatPool.length === 0) {
  for (let i = 0; i < 40; i++) {
    const el = document.createElement("div"); el.className = "floating-text";
    el.style.cssText = "position:absolute;pointer-events:none;font-weight:bold;text-shadow:2px 2px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,4px 4px 10px rgba(0,0,0,0.8);will-change:transform,opacity;z-index:9999;";
    floatPool.push(el);
  }
}

function showFloat(msg, cardEl, type="dmg", delayMS=0) {
  if (!cardEl) return;
  const data = { msg, type, cardEl, order: globalFloatOrder++ };
  if (delayMS > 0) setTimeout(() => floatQueue.push(data), delayMS / gameSpeed); else floatQueue.push(data);
}
function acquireFloat() {
  if (floatPool.length) return floatPool.pop();
  if (activeFloats.length) { const oldest = activeFloats.shift(); releaseFloat(oldest.el); return floatPool.pop(); } return null;
}
function releaseFloat(el) { el.remove(); floatPool.push(el); }
function getCardRect(el) {
  if (rectCache.has(el)) return rectCache.get(el);
  const r = el.getBoundingClientRect(); rectCache.set(el, r); return r;
}
window.getEffectRect = getCardRect;

function spawnFloat(data) {
  if (!battlefieldEl) return; 
  const el = acquireFloat(); if (!el) return;
  const cfg = FLOAT_CFG[data.type] ?? FLOAT_CFG.dmg; const rect = getCardRect(data.cardEl);
  const startX = rect.left - battlefieldRect.left + rect.width/2 + (Math.random()-0.5)*22;
  const startY = rect.top - battlefieldRect.top + rect.height/2 - 10;
  el.textContent = data.msg; el.style.color = cfg.color; el.style.fontSize = cfg.size;
  el.style.left = startX + "px"; el.style.top = startY + "px"; el.style.opacity = "1"; el.style.transform = "translate(0,0)";
  battlefieldEl.appendChild(el); activeFloats.push({ el, time: 0 });
}

var lastTime = performance.now();
function updateFloats(now) {
  const dt = now - lastTime; lastTime = now; const duration = 900 / gameSpeed;
  if (!battlefieldEl) { requestAnimationFrame(updateFloats); return; }
  battlefieldRect = battlefieldEl.getBoundingClientRect(); rectCache.clear();
  let budget = 8; const staggerTime = 500 / gameSpeed;
  if (floatQueue.length > 1) floatQueue.sort((a, b) => a.order - b.order);
  let i = 0;
  while (i < floatQueue.length && budget > 0) {
    const data = floatQueue[i]; const card = data.cardEl; const last = lastFloatTime.get(card) || 0;
    if (now - last > staggerTime) { lastFloatTime.set(card, now); spawnFloat(data); floatQueue.splice(i, 1); budget--; } else { i++; }
  }
  for (let j = activeFloats.length - 1; j >= 0; j--) {
    const f = activeFloats[j]; f.time += dt; const t = Math.min(f.time / duration, 1);
    if (t >= 1) { releaseFloat(f.el); activeFloats.splice(j, 1); continue; }
    f.el.style.transform = `translate(${Math.sin(t * Math.PI) * 8}px,${-65 * t}px)`; f.el.style.opacity = 1 - (t * t);
  }
  requestAnimationFrame(updateFloats);
}

function cleanupAllEffects() { document.querySelectorAll('.battle-vfx').forEach(el => el.remove()); }

window.renderStatsUI = function() {
  if (!window.engineState) return;
  let sorted = Object.values(window.engineState.combatStats).sort((a, b) => (b.dmg + b.taken + b.heal) - (a.dmg + a.taken + a.heal));
  const filtered = sorted.filter(s => s.dmg || s.taken || s.heal);
  let mD = Math.max(...filtered.map(s => s.dmg), 1), mT = Math.max(...filtered.map(s => s.taken), 1), mH = Math.max(...filtered.map(s => s.heal), 1);
  let content = document.getElementById('stats-content'); if (!content) return;
  content.innerHTML = filtered.map(s => `
    <div class="stat-card-row">
      <div class="stat-name"><span class="${s.owner === 'p1' ? 'log-player' : 'log-enemy'}">${s.owner === 'p1' ? 'พีช' : 'บอส'}</span> — ${s.name}${s.isClone ? ' (โคลน)' : ''}</div>
      ${s.dmg ? `<div class="stat-bar-bg"><div class="stat-bar-fill fill-dmg" style="width:${s.dmg/mD*100}%">⚔️ ${s.dmg}</div></div>` : ''}
      ${s.taken ? `<div class="stat-bar-bg"><div class="stat-bar-fill fill-tank" style="width:${s.taken/mT*100}%;color:#fff">🛡️ ${s.taken}</div></div>` : ''}
      ${s.heal ? `<div class="stat-bar-bg"><div class="stat-bar-fill fill-heal" style="width:${s.heal/mH*100}%">💚 ${s.heal}</div></div>` : ''}
    </div>`).join('') || "<div style='text-align:center;color:#888'>ยังไม่มีสถิติ</div>";
};

async function initGame() {
  cleanupAllEffects();
  window.engineState = new GameState();
  window.gameEngine = new BattleEngine(window.engineState);
  window.gameEngine.initGame(buildDeck(true), buildDeck(false));
  if (typeof updateHeroHP === 'function') updateHeroHP();
  if (typeof renderHand === 'function') { renderHand(); renderEnemyHand(); }
  if (typeof markDirty === 'function') { markDirty(); flushBoard(); }
  if (typeof updateDeckCount === 'function') updateDeckCount();
  addLog("⚔️ เริ่มการต่อสู้!");
  if (endTurnBtn) endTurnBtn.disabled = true;
  if (typeof startOfBattlePhase === "function") await startOfBattlePhase(); 
  if (endTurnBtn) endTurnBtn.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  const btnX05 = $('speed-x05'), btnX1 = $('speed-x1'), btnX2 = $('speed-x2');
  const setSpeed = (s) => {
    gameSpeed = s; document.documentElement.style.setProperty('--speed', s);
    [btnX05, btnX1, btnX2].forEach(b => { if(b) { b.style.background='#444'; b.style.borderColor='#777'; }});
    const active = s === 0.5 ? btnX05 : s === 1 ? btnX1 : btnX2;
    if (active) { active.style.background='#007bff'; active.style.borderColor='#fff'; }
  };
  if (btnX05) btnX05.onclick = () => setSpeed(0.5); if (btnX1) btnX1.onclick = () => setSpeed(1); if (btnX2) btnX2.onclick = () => setSpeed(2);
  setSpeed(2);

  handZone = $('player-hand'); enemyHandZone = $('enemy-hand');
  playerBoardSlots = document.querySelectorAll('.player-board .card-slot'); enemyBoardSlots = document.querySelectorAll('.enemy-board .card-slot');
  playerHeroText = document.querySelector('.player-hero p'); enemyHeroText = document.querySelector('.enemy-hero p');
  playerHeroEl = document.querySelector('.player-hero'); enemyHeroEl = document.querySelector('.enemy-hero');
  endTurnBtn = $('end-turn-btn'); logContent = $('battle-log-content');
  logToggle = $('battle-log-toggle'); logContainer = $('battle-log-container');
  battlefieldEl = document.querySelector('.battlefield');

  if (logToggle) logToggle.onclick = () => logContainer.style.display = logContainer.style.display === 'none' ? 'flex' : 'none';
  const logClose = $('close-log-btn'); if (logClose) logClose.onclick = () => logContainer.style.display = 'none';
  const logCopy = $('copy-log-btn'); if (logCopy) logCopy.onclick = () => navigator.clipboard.writeText(logContent.innerText).then(() => { let o = logCopy.innerText; logCopy.innerText = "✅ Copied!"; setTimeout(() => logCopy.innerText = o, 2000); });

  if (!document.querySelector('.stats-container')) {
    statsBtn = document.createElement('button'); statsBtn.className = 'stats-toggle-btn'; statsBtn.innerText = '📊 สถิติ'; document.body.appendChild(statsBtn);
    statsContainer = document.createElement('div'); statsContainer.className = 'stats-container';
    statsContainer.innerHTML = `<div class="stats-header"><span>🏆 สรุปผลงานบอร์ด</span><button id="close-stats-btn" class="log-btn">❌</button></div><div id="stats-content" class="stats-content"></div>`;
    document.body.appendChild(statsContainer);
    statsBtn.onclick = () => { statsContainer.style.display = statsContainer.style.display === 'none' ? 'flex' : 'none'; if (statsContainer.style.display === 'flex') renderStatsUI(); };
    document.getElementById('close-stats-btn').onclick = () => statsContainer.style.display = 'none';
  }

  detailModal = $('card-detail-modal'); detailClose = $('close-detail-modal'); detailPlayBtn = $('detail-play-btn'); 
  if (detailClose) detailClose.onclick = () => detailModal.style.display = 'none';

  graveBtn = $('graveyard-btn'); graveModal = $('grave-modal'); closeModal = $('close-modal'); graveList = $('grave-list');
  
  if (graveBtn) graveBtn.onclick = () => { 
    graveModal.style.display = 'flex'; graveList.innerHTML = '';
    window.engineState.p1.graveyard.forEach((c, i) => { 
      let el = document.createElement('div'); el.className = 'card dead-card'; el.innerHTML = createCardHTML(c, 'grave'); 
      el.onclick = () => { if(typeof openDetail === 'function') openDetail(c, 'graveyard', i); }; graveList.appendChild(el); 
    });
  };
  if (closeModal) closeModal.onclick = () => graveModal.style.display = 'none';

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (detailModal) detailModal.style.display = 'none';
    if (graveModal) graveModal.style.display = 'none';
    if (statsContainer) statsContainer.style.display = 'none';
    if (logContainer) logContainer.style.display = 'none';
  });

  if (endTurnBtn && typeof endTurn === "function") endTurnBtn.onclick = endTurn; 
  requestAnimationFrame(updateFloats);
  initGame().catch(console.error);
});

window.playCard = function(idx) {
  let st = window.engineState.p1;
  let e = st.board.indexOf(null);
  if (e !== -1) { 
    let card = st.hand[idx];
    addLog(`👉 <span class="log-player">พีช</span> ลงการ์ด <span class="log-player">${card.name}</span>`);
    card.flags._initialized = true; 
    st.board[e] = card; st.hand.splice(idx, 1); 
    markDirty(); flushBoard(); renderHand(); 
  } else { alert("สนามเต็มแล้ว!"); }
}