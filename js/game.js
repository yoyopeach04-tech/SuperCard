// ============================================================
// 🏛️ OOP CORE: ARCHITECTURE & HEADLESS STATE v8.0
// ✨ Upgrades: VFXEngine, EntityRegistry, RNG, ReplayLog
// ============================================================
var BOARD_SIZE = 7;
var HAND_LIMIT = 7;
var gameSpeed = 1;

// 🎲 1. DETERMINISTIC RNG ENGINE (For AI Sim & Replay)
class RNG {
  constructor(seed) { this.seed = seed; }
  // Mulberry32 algorithm
  next() {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// 🃏 2. CARD STATE
class CardState {
  constructor(data, uid, owner) {
    this.uid = uid;
    this.id = data.id || data.name;
    this.name = data.name;
    this.owner = owner; 
    this.image = data.image;
    this.stars = data.stars || 1;
    this.isUR = data.isUR || false;

    // ⚠️ [Fix #1] ใช้ Nullish Coalescing (??) ป้องกัน hp=0 กลายเป็น baseHP
    this.baseHP = data.baseHP ?? data.hp ?? 0;
    this.maxHP  = this.baseHP;
    this.hp     = data.hp ?? this.baseHP;
    
    this.baseATK = data.baseATK ?? data.atk ?? 0;
    this.atk     = data.atk ?? this.baseATK;
    
    this.waitTime = data.waitTime || 0;
    this.baseWait = data.baseWait ?? this.waitTime;

    this.skills = data.skills ? JSON.parse(JSON.stringify(data.skills)) : [];

    // ⚠️ [Fix #2] ใช้ skill.id เช็คแทน name.includes เพื่อความเสถียร
    const hasShadow = this.skills.some(s => s.id === "Shadow Protocol" || s.id === "101");

    this.status = { 
      burn: 0, corrupt: 0, stun: 0, 
      shadow: hasShadow ? 2 : 0, 
      immortal: 0, reviveBuff: 0, physShield: false 
    };

    this.runtime = {
      bloodStacks: 0, domainTurns: 0, domainUsed: false, fragments: 0,
      immortalTurns: 0, critChance: 0, airstrikeCharge: 0, sentinelStacks: 0,
      devourStacks: 0, hunterAuraActive: false, hunterAuraBonus: 0,
      shadowReady: false, tyrantEntryDone: false, parentATK: data.parentATK || 0
    };

    this.flags = { 
      isSummoned: data.isSummoned || false, isClone: data.isClone || false, 
      isDying: false, preventDeath: false, hasRevived: false, unrevivable: false, 
      isExecutingAttack: false, echoesUsed: false, graveContractUsed: false, 
      _initialized: true 
    };

    this.cooldowns = {};
    this._displayHP = this.hp;
    this._displayATK = this.atk;

    // 🚀 [Upgrade #1] ลงทะเบียนเข้า Entity Registry & CombatStats ทันทีที่เกิด
    if (window.engineState) {
      window.engineState.entities.set(this.uid, this);
      if (!window.engineState.combatStats[this.uid]) {
        window.engineState.combatStats[this.uid] = { 
          name: this.name, owner: this.owner, isClone: this.flags.isClone, dmg: 0, taken: 0, heal: 0 
        };
      }
    }
  }
}

class PlayerState {
  constructor(id, name, hp) {
    this.id = id; this.name = name; this.hp = hp; this.maxHP = hp;
    this.deck = []; this.hand = []; this.board = Array(BOARD_SIZE).fill(null); this.graveyard = [];
  }
}

class GameState {
  constructor(seed = Date.now()) {
    this.rng = new RNG(seed); // 🚀 [Upgrade #6]
    this.p1 = new PlayerState('p1', 'พีช', 30000);
    this.p2 = new PlayerState('p2', 'บอส', 100000);
    
    this.entities = new Map(); // 🚀 [Upgrade #1] O(1) Lookup
    this.actionLog = [];       // 🚀 [Upgrade #5] Replay System Base
    
    this.isGameOver = false; 
    this.turnCount = 0; 
    this.uidCounter = 0; 
    this.combatStats = {};
  }
  getPlayer(isP1) { return isP1 ? this.p1 : this.p2; }
  getOpp(isP1)    { return isP1 ? this.p2 : this.p1; }
  generateUID()   { return ++this.uidCounter; }
  logAction(action) { this.actionLog.push({ turn: this.turnCount, ...action }); }
}

// 🌐 3. GLOBAL STATE
window.engineState = null; 
window.gameEngine  = null;

// 🪄 4. ALIASES & BRIDGES
// ⚠️ [Fix #4] Guard Array Target แบบรัดกุม
const defineSafeAlias = (propName, getter, arrTargetFn) => {
  Object.defineProperty(window, propName, {
    get: getter,
    set: (v) => {
      if (!window.engineState) return;
      if (arrTargetFn) {
        const arr = arrTargetFn();
        if (!arr) return; // Guard against null target
        arr.length = 0; 
        if (Array.isArray(v)) arr.push(...v);
      }
    },
    configurable: true 
  });
};

Object.defineProperty(window, 'playerHP', { get: () => window.engineState?.p1.hp, set: (v) => { if(window.engineState) window.engineState.p1.hp = v; }, configurable: true });
Object.defineProperty(window, 'enemyHP', { get: () => window.engineState?.p2.hp, set: (v) => { if(window.engineState) window.engineState.p2.hp = v; }, configurable: true });
Object.defineProperty(window, 'combatStats', { get: () => window.engineState?.combatStats, set: (v) => { if(window.engineState) window.engineState.combatStats = v; }, configurable: true });
Object.defineProperty(window, 'isGameOver', { get: () => window.engineState?.isGameOver, set: (v) => { if(window.engineState) window.engineState.isGameOver = v; }, configurable: true });

defineSafeAlias('playerBoard', () => window.engineState?.p1.board, () => window.engineState?.p1.board);
defineSafeAlias('enemyBoard', () => window.engineState?.p2.board, () => window.engineState?.p2.board);
defineSafeAlias('hand', () => window.engineState?.p1.hand, () => window.engineState?.p1.hand);
defineSafeAlias('enemyHand', () => window.engineState?.p2.hand, () => window.engineState?.p2.hand);
defineSafeAlias('playerGraveyard', () => window.engineState?.p1.graveyard, () => window.engineState?.p1.graveyard);
defineSafeAlias('enemyGraveyard', () => window.engineState?.p2.graveyard, () => window.engineState?.p2.graveyard);
defineSafeAlias('playerDeck', () => window.engineState?.p1.deck, () => window.engineState?.p1.deck);
defineSafeAlias('enemyDeck', () => window.engineState?.p2.deck, () => window.engineState?.p2.deck);

// ⚠️ [Fix #5] สร้าง CardState ใหม่ทุกครั้งที่ Clone เพื่อรักษากลไกภายใน
window.cloneCardState = function(card, ownerOverride = null) {
  if (!card) return null;
  const newUid = window.engineState ? window.engineState.generateUID() : Math.floor(Math.random() * 100000);
  const rawData = JSON.parse(JSON.stringify(card)); 
  const newCard = new CardState(rawData, newUid, ownerOverride || card.owner);
  newCard.flags.isClone = true;
  newCard.runtime.parentATK = card.atk;
  return newCard;
};
window.cloneCard = window.cloneCardState; // Backward compat

window.getMyBoard = (isP1) => isP1 ? window.engineState?.p1.board : window.engineState?.p2.board;
window.getOppBoard = (isP1) => isP1 ? window.engineState?.p2.board : window.engineState?.p1.board;

var sleep = ms => new Promise(r => setTimeout(r, ms / gameSpeed));
var sd    = (fn, ms) => setTimeout(fn, ms / gameSpeed);
window.$  = id => document.getElementById(id);
window.hasSkill = (c, k) => c?.skills?.some(s => s.id === k || (s.name && s.name.includes(k)));

// 🎨 5. VFX ENGINE (รวบรวมตัวแปร Global ไว้ใน Class เดียว) ⚠️ [Fix #3]
class VFXEngine {
  constructor() {
    this.boardDirty = false;
    this.floatPool = [];
    this.floatQueue = [];
    this.activeFloats = [];
    this.rectCache = new Map();
    this.lastFloatTime = new WeakMap();
    this.globalFloatOrder = 0;
    this.lastTime = performance.now();
    this.initPool();
  }

  initPool() {
    for (let i = 0; i < 45; i++) {
      const el = document.createElement("div"); 
      el.className = "floating-text";
      el.style.cssText = "position:absolute;pointer-events:none;font-weight:bold;text-shadow:2px 2px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,4px 4px 10px rgba(0,0,0,0.8);will-change:transform,opacity;z-index:9999;";
      this.floatPool.push(el);
    }
  }

  markDirty() { this.boardDirty = true; }
  
  flushBoard() { 
    if (this.boardDirty && typeof realRenderBoard === 'function') { 
      realRenderBoard(); 
      this.boardDirty = false; 
    } 
  }

  showFloat(msg, cardEl, type="dmg", delayMS=0) {
    if (!cardEl) return;
    const data = { msg, type, cardEl, order: this.globalFloatOrder++ };
    if (delayMS > 0) setTimeout(() => this.floatQueue.push(data), delayMS / gameSpeed); 
    else this.floatQueue.push(data);
  }

  updateFloats(now) {
    const dt = now - this.lastTime; 
    this.lastTime = now;
    const duration = 900 / gameSpeed;
    const battlefieldEl = document.querySelector('.battlefield');
    
    if (!battlefieldEl) { requestAnimationFrame((n) => this.updateFloats(n)); return; }
    
    const battlefieldRect = battlefieldEl.getBoundingClientRect(); 
    this.rectCache.clear(); // ⚠️ [Note #6] Caching ไว้เคลียร์ตอน Move ในอนาคต
    
    let budget = 8; 
    const staggerTime = 500 / gameSpeed;
    if (this.floatQueue.length > 1) this.floatQueue.sort((a, b) => a.order - b.order);
    
    let i = 0;
    while (i < this.floatQueue.length && budget > 0) {
      const data = this.floatQueue[i]; const card = data.cardEl; const last = this.lastFloatTime.get(card) || 0;
      if (now - last > staggerTime) { 
          this.lastFloatTime.set(card, now); 
          const el = this.floatPool.length ? this.floatPool.pop() : null;
          if(el) {
              const rect = card.getBoundingClientRect();
              el.textContent = data.msg; 
              el.style.color = (t => t === 'heal' ? '#33ff33' : t === 'skill' ? '#ffcc00' : '#ff3333')(data.type);
              el.style.left = (rect.left - battlefieldRect.left + rect.width/2) + "px"; 
              el.style.top = (rect.top - battlefieldRect.top + rect.height/2) + "px";
              el.style.opacity = "1"; 
              battlefieldEl.appendChild(el); 
              this.activeFloats.push({ el, time: 0 });
          }
          this.floatQueue.splice(i, 1); budget--; 
      } else { i++; }
    }

    for (let j = this.activeFloats.length - 1; j >= 0; j--) {
      const f = this.activeFloats[j]; f.time += dt; const t = Math.min(f.time / duration, 1);
      if (t >= 1) { f.el.remove(); this.floatPool.push(f.el); this.activeFloats.splice(j, 1); continue; }
      f.el.style.transform = `translate(${Math.sin(t * Math.PI) * 8}px,${-65 * t}px)`; f.el.style.opacity = 1 - (t * t);
    }
    requestAnimationFrame((n) => this.updateFloats(n));
  }
}

// 🌐 Initialize VFX Engine & Bridge backward compatibility
window.vfxEngine = new VFXEngine();
window.markDirty = () => window.vfxEngine.markDirty();
window.flushBoard = () => window.vfxEngine.flushBoard();
window.showFloat = (msg, el, type, delay) => window.vfxEngine.showFloat(msg, el, type, delay);


// ── 6. DOM REFS & LOG ──
var handZone, enemyHandZone, playerBoardSlots, enemyBoardSlots;
var playerHeroText, enemyHeroText, playerHeroEl, enemyHeroEl;
var endTurnBtn, logContent, logToggle, logContainer, statsBtn, statsContainer;
var detailModal, detailClose, detailPlayBtn, graveBtn, graveModal, closeModal, graveList;

function addLog(msg) {
  if (!logContent) return;
  const e = document.createElement('div'); e.className = 'log-entry';
  e.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString('th-TH', { hour12: false })}]</span> ${msg}`;
  logContent.appendChild(e); logContent.scrollTop = logContent.scrollHeight;
}

// ── 7. STATS & INIT ──
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
  document.querySelectorAll('.battle-vfx').forEach(el => el.remove());
  
  window.engineState = new GameState(); // RNG Seed เริ่มต้นทำงาน
  window.gameEngine = new BattleEngine(window.engineState);
  
  window.gameEngine.initGame(buildDeck(true), buildDeck(false));
  
  if (window.gameEvents) window.gameEvents.emit(window.EVENTS.GAME_STARTED);
  if (typeof updateHeroHP === 'function') updateHeroHP();
  if (typeof renderHand === 'function') { renderHand(); renderEnemyHand(); }
  window.markDirty(); window.flushBoard();
  if (typeof updateDeckCount === 'function') updateDeckCount();
  addLog("⚔️ เริ่มการต่อสู้!");
  
  if (endTurnBtn) endTurnBtn.disabled = true;
  if (typeof startOfBattlePhase === "function") await startOfBattlePhase(); 
  if (endTurnBtn) endTurnBtn.disabled = false;
}

// ── 8. DOM READY & PLAY ──
document.addEventListener('DOMContentLoaded', () => {
  const btnX05 = $('speed-x05'), btnX1 = $('speed-x1'), btnX2 = $('speed-x2');
  const setSpeed = (s) => {
    gameSpeed = s; window.gameSpeed = s; document.documentElement.style.setProperty('--speed', s);
    [btnX05, btnX1, btnX2].forEach(b => { if(b) { b.style.background='#444'; b.style.borderColor='#777'; }});
    const active = s === 0.5 ? btnX05 : s === 1 ? btnX1 : btnX2;
    if (active) { active.style.background='#007bff'; active.style.borderColor='#fff'; }
  };
  if (btnX05) btnX05.onclick = () => setSpeed(0.5); if (btnX1) btnX1.onclick = () => setSpeed(1); if (btnX2) btnX2.onclick = () => setSpeed(1);
  setSpeed(1);

  handZone = $('player-hand'); enemyHandZone = $('enemy-hand');
  playerBoardSlots = document.querySelectorAll('.player-board .card-slot'); enemyBoardSlots = document.querySelectorAll('.enemy-board .card-slot');
  playerHeroText = document.querySelector('.player-hero p'); enemyHeroText = document.querySelector('.enemy-hero p');
  playerHeroEl = document.querySelector('.player-hero'); enemyHeroEl = document.querySelector('.enemy-hero');
  endTurnBtn = $('end-turn-btn'); logContent = $('battle-log-content');
  logToggle = $('battle-log-toggle'); logContainer = $('battle-log-container');

  detailModal = $('card-detail-modal'); detailClose = $('close-detail-modal'); detailPlayBtn = $('detail-play-btn'); 
  graveBtn = $('graveyard-btn'); graveModal = $('grave-modal'); closeModal = $('close-modal'); graveList = $('grave-list');
  
  if (logToggle) logToggle.onclick = () => logContainer.style.display = logContainer.style.display === 'none' ? 'flex' : 'none';
  if (graveBtn) graveBtn.onclick = () => { 
    graveModal.style.display = 'flex'; graveList.innerHTML = '';
    window.engineState.p1.graveyard.forEach((c, i) => { 
      let el = document.createElement('div'); el.className = 'card dead-card'; el.innerHTML = createCardHTML(c, 'grave'); 
      el.onclick = () => { if(typeof openDetail === 'function') openDetail(c, 'graveyard', i); }; graveList.appendChild(el); 
    });
  };
  if (closeModal) closeModal.onclick = () => graveModal.style.display = 'none';
  if (detailClose) detailClose.onclick = () => detailModal.style.display = 'none';

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') [detailModal, graveModal, statsContainer, logContainer].forEach(m => { if(m) m.style.display = 'none'; });
  });

  if (endTurnBtn && typeof endTurn === "function") endTurnBtn.onclick = endTurn; 
  
  // Start VFX Loop
  requestAnimationFrame((now) => window.vfxEngine.updateFloats(now));
  
  initGame().catch(console.error);
});

window.playCard = function(idx) {
  let st = window.engineState.p1;
  let e = st.board.indexOf(null);
  if (e !== -1 && !isGameOver) { 
    let card = st.hand[idx];
    addLog(`👉 <span class="log-player">พีช</span> ลงการ์ด <span class="log-player">${card.name}</span>`);
    
    // 🚀 [Upgrade #5] Log Action
    window.engineState.logAction({ type: "PLAY_CARD", player: "p1", cardUid: card.uid, slotIndex: e });
    
    st.board[e] = card; st.hand.splice(idx, 1); 
    window.markDirty(); window.flushBoard(); if(typeof renderHand === 'function') renderHand(); 
  } else if(e === -1) { alert("สนามเต็มแล้ว!"); }
};