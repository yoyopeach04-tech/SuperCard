// ============================================================
//  ⚔️ CARD BATTLE ENGINE — HYBRID v4.5.2 (EVENT-DRIVEN READY)
// ============================================================

// ── 1. CONFIG & HELPERS ────────────────────────────────────
function cloneCard(c) {
  try { return structuredClone(c); } 
  catch { return { ...c, skills: c.skills ? c.skills.map(s => ({ ...s })) : [] }; }
}

const BOARD_SIZE = 7;
const HAND_LIMIT = 7;
let gameSpeed = 1;

const sleep = ms => new Promise(r => setTimeout(r, ms / gameSpeed));
const sd    = (fn, ms) => setTimeout(fn, ms / gameSpeed);
const $      = id => document.getElementById(id);
const hasSkill  = (c, k) => c?.skills?.some(s => s.id ? s.id === k : s.name.includes(k));
const getMyBoard = p => p ? playerBoard : enemyBoard;
const markDirty  = () => { boardDirty = true; };
const flushBoard = () => { if (boardDirty) { realRenderBoard(); boardDirty = false; } };

// ── 4. STATE ───────────────────────────────────────────────
let playerHP = 30000, enemyHP = 100000, isGameOver = false, cardUidCounter = 0, combatStats = {};
let playerDeck = [], enemyDeck = [], hand = [], enemyHand = [];
let playerBoard = Array(BOARD_SIZE).fill(null), enemyBoard = Array(BOARD_SIZE).fill(null);
let playerGraveyard = [], enemyGraveyard = [], boardDirty = false;

// ── 5. DOM REFS ────────────────────────────────────────────
let handZone, enemyHandZone;
let playerBoardSlots, enemyBoardSlots;
let playerHeroText, enemyHeroText, playerHeroEl, enemyHeroEl;
let endTurnBtn, logContent, logToggle, logContainer;
let statsBtn, statsContainer;

function addLog(msg) {
  if (!logContent) return;
  const e = document.createElement('div'); e.className = 'log-entry';
  e.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString('th-TH', { hour12: false })}]</span> ${msg}`;
  logContent.appendChild(e);
  logContent.scrollTop = logContent.scrollHeight;
}

// ── 6. BATTLE ENGINE (RAF + POOL) ──────────────────────────
let battlefieldEl;
const lastFloatTime = new WeakMap();
let globalFloatOrder = 0;

const FLOAT_CFG = {
  dmg:   { color:"#ff3333", size:"2.2rem" },
  heal:  { color:"#33ff33", size:"2.2rem" },
  skill: { color:"#ffcc00", size:"1.6rem" },
  drain: { color:"#ffd700", size:"2.2rem" } 
};

const FLOAT_DURATION = 900;
const FLOAT_POOL_SIZE = 40; 
const MAX_SPAWN_PER_FRAME = 8;

const floatPool  = [];
const floatQueue = [];
const activeFloats = [];

let battlefieldRect = null;
let rectCache = new Map();

for (let i = 0; i < FLOAT_POOL_SIZE; i++){
  const el = document.createElement("div");
  el.className = "floating-text";
  el.style.cssText = "position:absolute;pointer-events:none;font-weight:bold;text-shadow:2px 2px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,4px 4px 10px rgba(0,0,0,0.8);will-change:transform,opacity;z-index:9999;";
  floatPool.push(el);
}

function showFloat(msg, cardEl, type="dmg", delayMS=0) {
  if (!cardEl) return;
  const data = { msg, type, cardEl, order: globalFloatOrder++ };
  if (delayMS > 0) setTimeout(() => floatQueue.push(data), delayMS / gameSpeed);
  else floatQueue.push(data);
}

function acquireFloat() {
  if (floatPool.length) return floatPool.pop();
  if (activeFloats.length) {
    const oldest = activeFloats.shift();
    releaseFloat(oldest.el);
    return floatPool.pop();
  }
  return null;
}

function releaseFloat(el) {
  el.remove();
  floatPool.push(el);
}

function getCardRect(el) {
  if (rectCache.has(el)) return rectCache.get(el);
  const r = el.getBoundingClientRect();
  rectCache.set(el, r);
  return r;
}

const getEffectRect = (el) => {
  if (!el) return null;
  if (rectCache.has(el)) return rectCache.get(el);
  const r = el.getBoundingClientRect();
  rectCache.set(el, r);
  return r;
};

function spawnFloat(data) {
  if (!battlefieldEl) return; // 🟡 Guard: ป้องกัน DOM ยังไม่พร้อม
  const el = acquireFloat();
  if (!el) return;
  const cfg = FLOAT_CFG[data.type] ?? FLOAT_CFG.dmg;
  const rect = getCardRect(data.cardEl);
  const startX = rect.left - battlefieldRect.left + rect.width/2 + (Math.random()-0.5)*22;
  const startY = rect.top - battlefieldRect.top + rect.height/2 - 10;
  el.textContent = data.msg;
  el.style.color = cfg.color;
  el.style.fontSize = cfg.size;
  el.style.left = startX + "px";
  el.style.top  = startY + "px";
  el.style.opacity = "1";
  el.style.transform = "translate(0,0)";
  battlefieldEl.appendChild(el);
  activeFloats.push({ el, time: 0 });
}

let lastTime = performance.now();

function updateFloats(now) {
  const dt = now - lastTime;
  lastTime = now;
  const duration = FLOAT_DURATION / gameSpeed;
  
  if (!battlefieldEl) { requestAnimationFrame(updateFloats); return; }

  // 🐞 Fix 1: ดึง Rect ตรงๆ ไม่ผ่าน Cache และล้างเฉพาะ Cache การ์ด
  battlefieldRect = battlefieldEl.getBoundingClientRect(); 
  rectCache.clear(); 

  let budget = MAX_SPAWN_PER_FRAME;
  const staggerTime = 500 / gameSpeed;

  // 🐞 Fix 2: Sort ASC (จากน้อยไปมาก - เก่าสุดอยู่หน้าสุด)
  if (floatQueue.length > 1) floatQueue.sort((a, b) => a.order - b.order);

  let i = 0;
  while (i < floatQueue.length && budget > 0) {
    const data = floatQueue[i];
    const card = data.cardEl;
    const last = lastFloatTime.get(card) || 0;

    if (now - last > staggerTime) {
      lastFloatTime.set(card, now);
      spawnFloat(data);
      floatQueue.splice(i, 1); // ลบตัวที่โชว์แล้วออก
      budget--;
    } else {
      i++; // ถ้าติด Stagger ให้ข้ามไปเช็คคิวของใบอื่นแทน
    }
  }

  for (let j = activeFloats.length - 1; j >= 0; j--) {
    const f = activeFloats[j];
    f.time += dt;
    const t = Math.min(f.time / duration, 1);
    if (t >= 1) { releaseFloat(f.el); activeFloats.splice(j, 1); continue; }
    const moveY = -65 * t, moveX = Math.sin(t * Math.PI) * 8, opacity = 1 - (t * t);
    f.el.style.transform = `translate(${moveX}px,${moveY}px)`;
    f.el.style.opacity = opacity;
  }
  requestAnimationFrame(updateFloats);
}

function cleanupAllEffects() {
  document.querySelectorAll('.battle-vfx').forEach(el => el.remove());
}

function renderStatsUI() {
  let sorted = Object.values(combatStats).sort((a, b) => (b.dmg + b.taken + b.heal) - (a.dmg + a.taken + a.heal));
  let mD = Math.max(...sorted.map(s => s.dmg), 1), mT = Math.max(...sorted.map(s => s.taken), 1), mH = Math.max(...sorted.map(s => s.heal), 1);
  $('stats-content').innerHTML = sorted.filter(s => s.dmg || s.taken || s.heal).map(s => `
    <div class="stat-card-row">
      <div class="stat-name"><span class="${s.owner === 'พีช' ? 'log-player' : 'log-enemy'}">${s.owner}</span> — ${s.name}${s.isClone ? ' (โคลน)' : ''}</div>
      ${s.dmg   ? `<div class="stat-bar-bg"><div class="stat-bar-fill fill-dmg"  style="width:${s.dmg/mD*100}%">⚔️ ${s.dmg}</div></div>`   : ''}
      ${s.taken ? `<div class="stat-bar-bg"><div class="stat-bar-fill fill-tank" style="width:${s.taken/mT*100}%;color:#fff">🛡️ ${s.taken}</div></div>` : ''}
      ${s.heal  ? `<div class="stat-bar-bg"><div class="stat-bar-fill fill-heal" style="width:${s.heal/mH*100}%">💚 ${s.heal}</div></div>`  : ''}
    </div>`).join('') || "<div style='text-align:center;color:#888'>ยังไม่มีสถิติ</div>";
}

// ── 13. TURN PHASE (EVENT-DRIVEN + PERFECT SYNC + LIFECYCLE HOOKS) ───────────────────
async function processTurnPhase(isPlayer) {
  const slots = isPlayer ? playerBoardSlots : enemyBoardSlots;
  
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (isGameOver) return;
    
    let myBoard = getMyBoard(isPlayer);
    let pCard = myBoard[i];
    
    if (!pCard || pCard.hp <= 0) continue;
    
    if (!pCard._initialized) initCard(pCard);

    const pN = `<span class="${isPlayer ? 'log-player' : 'log-enemy'}">${pCard.name}</span>`;

    if (pCard.immortalTurns > 0) pCard.immortalTurns--;
    if (pCard.reviveBuffTurns > 0) { 
      pCard.reviveBuffTurns--; 
      if (!pCard.reviveBuffTurns) pCard.atk -= Math.floor(pCard.baseATK * 0.2); 
    }
    if ((pCard.corruptTurns || 0) > 0) { pCard.corruptTurns--; markDirty(); }
    
    if ((pCard.burnTurns || 0) > 0) {
      let bd = Math.floor((pCard.maxHP || pCard.hp) * 0.05);
      let burnRemain = pCard.burnTurns - 1; 
      
      applyDamage(pCard, bd, slots[i], isPlayer, "burn");
      addLog(`🔥 ${pN} ติดไฟ! ดาเมจ ${bd} (เหลือ ${burnRemain} เทิร์น)`);
      pCard.burnTurns = burnRemain;
      
      await checkDeaths();
      myBoard = getMyBoard(isPlayer); pCard = myBoard[i];
      if (!pCard || pCard.hp <= 0) continue;
    }

    let context = {
      get card() { return getMyBoard(isPlayer)[i]; }, 
      idx: i,
      isPlayer: isPlayer,
      cardSlot: slots[i],
      get myBoard() { return getMyBoard(isPlayer); },
      get oppBoard() { return getMyBoard(!isPlayer); },
      get mySlots() { return isPlayer ? playerBoardSlots : enemyBoardSlots; }, // 🟢 เพิ่มบรรทัดนี้!
      get oppSlots() { return isPlayer ? enemyBoardSlots : playerBoardSlots; },
      skipAttack: false 
    };

    await triggerSkillEvent('onTurnStart', pCard, context);
    
    markDirty(); flushBoard(); updateHeroHP(); await sleep(50); 
    await checkDeaths(); 
    
    myBoard = getMyBoard(isPlayer); pCard = myBoard[i]; 
    if (!pCard || pCard.hp <= 0) continue;

    if (!context.skipAttack) { 
      let defender = getMyBoard(!isPlayer)[i]; 
      await executeAttack(pCard, defender, i, isPlayer); 
      await checkDeaths(); 
      markDirty(); flushBoard(); await sleep(200); 
    }
    
    myBoard = getMyBoard(isPlayer); pCard = myBoard[i]; 
    if (pCard && pCard.hp > 0) {
      await triggerSkillEvent('onTurnEnd', pCard, context);
      await checkDeaths();
      markDirty(); flushBoard();
    }
  }
  
  await checkDeaths();
  if (!isGameOver) await shiftBoards();
}

// ── 15. INIT ───────────────────────────────────────────────
async function initGame() {
  cleanupAllEffects();
  
  // 🐞 Fix 4: Reset ขยะจากเกมรอบก่อนให้หมดจด
  combatStats = {}; 
  cardUidCounter = 0; 
  isGameOver = false;
  playerGraveyard = []; 
  enemyGraveyard = [];

  playerDeck = buildDeck(true); enemyDeck = buildDeck(false); updateHeroHP();
  for (let i = 0; i < 3; i++) {
    if (playerDeck.length) hand.push(cloneCard(playerDeck.splice(0, 1)[0]));
    if (enemyDeck.length)  enemyHand.push(cloneCard(enemyDeck.splice(0, 1)[0]));
  }
  renderHand(); renderEnemyHand(); markDirty(); flushBoard(); updateDeckCount();
  addLog("⚔️ เริ่มการต่อสู้!");
  if (endTurnBtn) endTurnBtn.disabled = true;
  await startOfBattlePhase();
  if (endTurnBtn) endTurnBtn.disabled = false;
}

// ── DOMContentLoaded ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  const btnX05 = $('speed-x05'), btnX1 = $('speed-x1'), btnX2 = $('speed-x2');
  const setSpeed = (s) => {
    gameSpeed = s;
    document.documentElement.style.setProperty('--speed', s);
    [btnX05, btnX1, btnX2].forEach(b => { if(b) { b.style.background='#444'; b.style.borderColor='#777'; }});
    const active = s === 0.5 ? btnX05 : s === 1 ? btnX1 : btnX2;
    if (active) { active.style.background='#007bff'; active.style.borderColor='#fff'; }
  };
  if (btnX05) btnX05.onclick = () => setSpeed(0.5);
  if (btnX1)  btnX1.onclick  = () => setSpeed(1);
  if (btnX2)  btnX2.onclick  = () => setSpeed(2);
  setSpeed(2);

  handZone        = $('player-hand');
  enemyHandZone   = $('enemy-hand');
  playerBoardSlots = document.querySelectorAll('.player-board .card-slot');
  enemyBoardSlots  = document.querySelectorAll('.enemy-board .card-slot');
  playerHeroText   = document.querySelector('.player-hero p');
  enemyHeroText    = document.querySelector('.enemy-hero p');
  playerHeroEl     = document.querySelector('.player-hero');
  enemyHeroEl      = document.querySelector('.enemy-hero');
  endTurnBtn       = $('end-turn-btn');
  logContent       = $('battle-log-content');
  logToggle        = $('battle-log-toggle');
  logContainer     = $('battle-log-container');
  battlefieldEl    = document.querySelector('.battlefield');

  if (logToggle) logToggle.onclick = () => logContainer.style.display = logContainer.style.display === 'none' ? 'flex' : 'none';
  const logClose = $('close-log-btn');
  if (logClose) logClose.onclick = () => logContainer.style.display = 'none';
  const logCopy  = $('copy-log-btn');
  if (logCopy)  logCopy.onclick  = () => navigator.clipboard.writeText(logContent.innerText).then(() => { let o = logCopy.innerText; logCopy.innerText = "✅ Copied!"; setTimeout(() => logCopy.innerText = o, 2000); });

  statsBtn = document.createElement('button'); statsBtn.className = 'stats-toggle-btn'; statsBtn.innerText = '📊 สถิติ'; document.body.appendChild(statsBtn);
  statsContainer = document.createElement('div');
  statsContainer.className = 'stats-container';
  statsContainer.innerHTML = `<div class="stats-header"><span>🏆 สรุปผลงานบอร์ด</span><button id="close-stats-btn" class="log-btn">❌</button></div><div id="stats-content" class="stats-content"></div>`;
  document.body.appendChild(statsContainer);
  statsBtn.onclick = () => { statsContainer.style.display = statsContainer.style.display === 'none' ? 'flex' : 'none'; if (statsContainer.style.display === 'flex') renderStatsUI(); };
  document.getElementById('close-stats-btn').onclick = () => statsContainer.style.display = 'none';

  detailModal    = $('card-detail-modal');
  detailClose    = $('close-detail-modal');
  detailPlayBtn  = $('detail-play-btn');
  if (detailClose) detailClose.onclick = () => detailModal.style.display = 'none';

  graveBtn   = $('graveyard-btn');
  graveModal = $('grave-modal');
  closeModal = $('close-modal');
  graveList  = $('grave-list');
  if (graveBtn) graveBtn.onclick = () => { graveModal.style.display = 'flex'; graveList.innerHTML = '';
    playerGraveyard.forEach((c, i) => { let el = document.createElement('div'); el.className = 'card dead-card'; el.innerHTML = createCardHTML(c, 'grave'); el.onclick = () => openDetail(c, 'graveyard', i); graveList.appendChild(el); });
  };
  if (closeModal) closeModal.onclick = () => graveModal.style.display = 'none';

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (detailModal)    detailModal.style.display    = 'none';
    if (graveModal)     graveModal.style.display     = 'none';
    if (statsContainer) statsContainer.style.display  = 'none';
    if (logContainer)   logContainer.style.display    = 'none';
  });

  if (endTurnBtn) endTurnBtn.onclick = endTurn;

  requestAnimationFrame(updateFloats);

  initGame();
});