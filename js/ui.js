// ── 8. CARD HTML & RENDER ──────────────────────────────────
function createCardHTML(card, ctx) {
  const isEH = ctx === 'enemyHand', isG = ctx === 'grave', isB = ctx === 'board';
  const si = (cond, style, title, txt) => cond ? `<div class="status-icon" style="${style}" title="${title}">${txt}</div>` : '';
  let statusHTML = (!isEH && !isG) ? [
    si(card.domainTurns    > 0, "background:#8a2be2;",                             "Grave Domain",    "🪦"),
    si(card.immortalTurns  > 0, "background:#ffff00;color:#000;",                  "Immortal",        "👑"),
    si(card.fragments      > 0, "background:#ff0000;",                             "Soul Fragments",  card.fragments),
    si(card.critChance     > 0, "background:#ff4500;",                             "Crit Up",         "💥"),
    si(card.bloodStacks    > 0, "background:#8b0000;border-color:#ff4c4c;",        "Blood Stacks",    `🩸${card.bloodStacks}`),
    si((card.shadowTurns   ||0)>0,"background:#0a0a2e;border-color:#00f5ff;color:#00f5ff;","Shadow",  `👻${card.shadowTurns}`),
    si((card.airstrikeCharge||0)>0,"background:#2a1500;border-color:#ff6600;color:#ff6600;","Airstrike",`🚀${card.airstrikeCharge}`),
    si((card.sentinelStacks||0)>0,"background:#0a2a0a;border-color:#00ff88;color:#00ff88;","Battle Hardened",`🛡️${card.sentinelStacks}`),
    si((card.burnTurns     ||0)>0,"background:#2a0a00;border-color:#ff4500;color:#ff6600;","Burn",    `🔥${card.burnTurns}`),
    si(card.physShield, "background:#e0e0e0;border-color:#fff;color:#000;", "Physical Shield", "🛡️"),
    si((card.corruptTurns||0)>0,"background:#1a0030;border-color:#9b00ff;color:#cc66ff;","Corrupt",`🌌${card.corruptTurns}`),
  ].join('') : '';
  
  let eb = card.domainTurns > 0 ? "domain-active" : (card.immortalTurns > 0 ? "immortal-active" : "");
  if ((card.shadowTurns || 0) > 0) eb = "shadow-stealth";
  if ((card.corruptTurns || 0) > 0) eb += " corrupt-active";

  let ac = card.baseATK !== undefined ? 
    (card.atk > card.baseATK ? "#4fc3ff" : card.atk < card.baseATK ? "#ff4c4c" : "#eee") : "#eee";
  
  let hc = card.baseHP !== undefined ? 
    (card.hp > card.baseHP ? "#4cff4c" : card.hp < card.baseHP ? "#ff4c4c" : "#eee") : "#eee";
  let filt = isEH ? "filter:brightness(0.6);" : (isG ? "filter:grayscale(100%) opacity(70%);" : "");

  return `
    ${isB ? '' : `<div class="wait-time ${card.waitTime <= 0 ? 'ready' : ''}">${card.waitTime <= 0 ? '🔥 0' : '⏱️ ' + card.waitTime}</div>`}
    <div class="card-stars">${'⭐'.repeat(card.stars || 0)}</div>
    <div class="status-icons">${statusHTML}</div>
    <div class="card ${card.isUR ? 'card-ur' : ''} ${eb}" style="width:100%;height:100%;border:none;margin:0;position:static;">
      <div class="card-image-bg" style="background-image:url('${card.image}');${filt}${(card.shadowTurns || 0) > 0 ? 'opacity:.4;' : ''}"></div>
      <div class="card-data-overlay" style="${isB ? 'background:rgba(0,0,0,.85);padding-top:5px;' : ''}">
        ${isB ? '' : `<div style="font-size:.8rem">${card.name}</div>`}
        ${isG ? `<div style="font-size:.7rem;color:#aaa;margin-top:3px">💀 วิญญาณ</div>` : !isEH ? `
          <div style="font-size:.7rem;text-align:left;padding:${isB?'4px':'2px'};margin-top:${isB?'0':'5px'}">
            <div style="color:${ac};font-weight:bold;display:flex;justify-content:space-between"><span>⚔️ATK</span><span class="card-atk-val">${card.atk}</span></div>
            <hr style="border:0;border-top:1px solid #777;margin:3px 0">
            <div style="color:${hc};font-weight:bold;display:flex;justify-content:space-between"><span>❤️HP</span><span class="card-hp-val">${card.hp}</span></div>
          </div>` : ''}
      </div>
    </div>`;
}

function renderHand() {
  if (!handZone) return;
  const frag = document.createDocumentFragment();
  hand.forEach((c, i) => {
    const el = document.createElement('div'); el.className = 'card';
    el.innerHTML = createCardHTML(c, 'playerHand');
    el.onclick = () => openDetail(c, 'playerHand', i);
    if (c.waitTime > 0) el.style.opacity = '.7';
    frag.appendChild(el);
  });
  handZone.innerHTML = ''; handZone.appendChild(frag);
}

function renderEnemyHand() {
  if (!enemyHandZone) return;
  const frag = document.createDocumentFragment();
  enemyHand.forEach((c, i) => {
    const el = document.createElement('div'); el.className = 'card';
    el.style.margin = '0 -10px';
    el.innerHTML = createCardHTML(c, 'enemyHand');
    el.onclick = () => openDetail(c, 'enemyHand', i);
    frag.appendChild(el);
  });
  enemyHandZone.innerHTML = ''; enemyHandZone.appendChild(frag);
}

function realRenderBoard() {
  if (!playerBoardSlots || !enemyBoardSlots) return;

  const animateCardHP = (slot, card) => {
    const hpEl = slot.querySelector('.card-hp-val');
    if (!hpEl) return;
    const prev = card._displayHP ?? card.hp;
    if (prev !== card.hp) animateHP(hpEl, prev, card.hp, '');
    card._displayHP = card.hp;
  };
  const animateCardATK = (slot, card) => {
    const atkEl = slot.querySelector('.card-atk-val');
    if (!atkEl) return;
    const prev = card._displayATK ?? card.atk;
    const base = card.baseATK ?? card.atk;
    const cur  = card.atk;
    atkEl.parentElement.style.color = cur > base ? '#4fc3ff' : cur < base ? '#ff4c4c' : '#eee';
    if (prev !== cur) animateHP(atkEl, prev, cur, '');
    card._displayATK = cur;
  };

  // ✅ ใส่ try-catch ครอบไว้ ป้องกันการ Render พังแล้วพาหายทั้งกระดาน
  playerBoardSlots.forEach((s, i) => { 
    try {
      s.innerHTML = ''; 
      if (playerBoard[i]) { 
        let el = document.createElement('div'); el.className = 'card'; 
        el.style.cssText = "width:100%;height:100%;margin:0;border:2px solid #4cff4c;position:relative;"; 
        el.innerHTML = createCardHTML(playerBoard[i], 'board'); 
        el.onclick = () => openDetail(playerBoard[i], 'playerBoard', i); 
        s.appendChild(el); 
        animateCardHP(s, playerBoard[i]); animateCardATK(s, playerBoard[i]); 
      } 
    } catch(e) { console.error("Player Board Render Error Slot", i, e); }
  });

  enemyBoardSlots.forEach((s, i)  => { 
    try {
      s.innerHTML = ''; 
      if (enemyBoard[i])  { 
        let el = document.createElement('div'); el.className = 'card'; 
        el.style.cssText = "width:100%;height:100%;margin:0;border:2px solid #ff4c4c;position:relative;"; 
        el.innerHTML = createCardHTML(enemyBoard[i], 'board'); 
        el.onclick = () => openDetail(enemyBoard[i], 'enemyBoard', i); 
        s.appendChild(el); 
        animateCardHP(s, enemyBoard[i]); animateCardATK(s, enemyBoard[i]); 
      }
    } catch(e) { console.error("Enemy Board Render Error Slot", i, e); }
  });
}

function updateDeckCount() { let p = $('player-deck-count'), e = $('enemy-deck-count'); if(p) p.innerText = `🎴 กองการ์ดเรา: ${playerDeck.length}`; if(e) e.innerText = `🎴 กองการ์ดศัตรู: ${enemyDeck.length}`; }

let _pHPDisplay = -1, _eHPDisplay = -1;
const _hpTimers = new WeakMap(); 

function animateHP(el, fromVal, toVal, prefix = 'HP: ') {
  if (!el) return;
  if (_hpTimers.has(el)) clearInterval(_hpTimers.get(el));

  const isHit = toVal < fromVal;
  el.classList.remove('hp-hit', 'hp-heal');
  void el.offsetWidth; 
  el.classList.add(isHit ? 'hp-hit' : 'hp-heal');
  if (typeof sd !== 'undefined') sd(() => el.classList.remove('hp-hit', 'hp-heal'), 350); 
  else setTimeout(() => el.classList.remove('hp-hit', 'hp-heal'), 350);

  let current = fromVal;
  const BASE_SPEED = 16; 
  const timer = setInterval(() => {
    const remaining = Math.abs(toVal - current);
    const step = Math.max(1, Math.round(remaining * 0.2));
    current += (toVal > current ? 1 : -1) * step;
    if ((toVal > fromVal && current >= toVal) || (toVal < fromVal && current <= toVal)) { current = toVal; }
    el.innerText = `${prefix}${current}`;
    if (current === toVal) { clearInterval(timer); _hpTimers.delete(el); }
  }, BASE_SPEED);
  _hpTimers.set(el, timer);
}

function updateHeroHP() {
  if (!playerHeroText) return;
  if (playerHP !== _pHPDisplay) { animateHP(playerHeroText, _pHPDisplay, playerHP); _pHPDisplay = playerHP; }
  if (enemyHP  !== _eHPDisplay) { animateHP(enemyHeroText,  _eHPDisplay, enemyHP);  _eHPDisplay = enemyHP; }
  let pOut = !playerDeck.length && !hand.length && playerBoard.every(c => !c);
  let eOut = !enemyDeck.length && !enemyHand.length && enemyBoard.every(c => !c);
  
  if ((playerHP <= 0 || pOut) && !isGameOver) { 
      isGameOver = true; let r = pOut ? "ไพ่หมด!" : "HP หมด!"; addLog(`💀 <span class='log-player'>พีช</span> แพ้ (${r})`); 
      setTimeout(() => { alert(`แพ้: ${r}`); if (typeof renderStatsUI === 'function') renderStatsUI(); if(statsContainer) statsContainer.style.display = 'flex'; }, 500);
  } else if ((enemyHP <= 0 || eOut) && !isGameOver) { 
      isGameOver = true; let r = eOut ? "ไพ่หมด!" : "HP หมด!"; addLog(`🎉 <span class='log-player'>พีช</span> ชนะ (${r})`); 
      setTimeout(() => { alert(`ชนะ: ${r}`); if (typeof renderStatsUI === 'function') renderStatsUI(); if(statsContainer) statsContainer.style.display = 'flex'; }, 500);
  }
}

function updateGrave() { let g = $('grave-count'); if(g) g.innerText = playerGraveyard.length; }

function openDetail(card, src, idx) {
  if (!card || !detailModal) return;
  $('detail-card-name').innerText = card.name; $('detail-card-stars').innerText = '⭐'.repeat(card.stars || 0);
  $('detail-card-atk').innerText = `⚔️ ${card.atk}`; $('detail-card-hp').innerText = `❤️ ${card.hp}`; $('detail-card-wait').innerText = `⏱️ ${card.waitTime}`;
  $('detail-card-image').style.backgroundImage = `url('${card.image}')`;
  $('detail-card-skills').innerHTML = card.skills?.length ?
    card.skills.map(s => `<div class="detail-skill-item"><div class="detail-skill-title">${s.name}</div><div class="detail-skill-desc">${s.desc}</div></div>`).join('') : `<div style="color:#aaa">ไม่มีทักษะ</div>`;
  if (src === 'playerHand' && card.waitTime <= 0 && !isGameOver) { detailPlayBtn.style.display = 'block';
    detailPlayBtn.onclick = () => { if(typeof window.playCard === 'function') window.playCard(idx); detailModal.style.display = 'none'; }; }
  else detailPlayBtn.style.display = 'none';
  detailModal.style.display = 'flex';
}