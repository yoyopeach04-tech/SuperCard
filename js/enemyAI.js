// ============================================================
// 🤖 PHASE 8.3: OOP ENEMY AI & TURN CONTROL
// ============================================================

async function startOfBattlePhase() {
  const processRift = async (deck, hnd, isPlayer) => {
    let st = window.engineState;
    let player = st.getPlayer(isPlayer);
    let board = player.board;
    let slots = isPlayer ? playerBoardSlots : enemyBoardSlots;
    
    // หาการ์ดบอส (id 98 หรือชื่อ Chronovex)
    let ci = hnd.findIndex(c => c.id === 98 || c.name.includes("Chronovex"));
    let di = deck.findIndex(c => c.id === 98 || c.name.includes("Chronovex"));
    let cc = null;
    
    if (ci !== -1) cc = hnd.splice(ci, 1)[0]; 
    else if (di !== -1) cc = deck.splice(di, 1)[0];
    
    if (!cc || board.indexOf(null) === -1) return;
    
    let em = board.indexOf(null); 
    cc.flags._initialized = true; 
    board[em] = cc;

    // ── ✨ RIFT DEPLOYMENT visual effect ──
    (() => {
      const slotRect = getEffectRect(slots[em]);
      if (!slotRect) return;
      const cx = slotRect.left + slotRect.width / 2, cy = slotRect.top  + slotRect.height / 2;

      const ov = document.createElement('div'); ov.className = 'battle-vfx rift-overlay'; document.body.appendChild(ov);
      sd(() => ov.remove(), 2000);

      const sz = 140;
      const portal = document.createElement('div'); portal.className = 'battle-vfx rift-portal';
      portal.style.cssText = `width:${sz}px;height:${sz}px;left:${cx - sz/2}px;top:${cy - sz/2}px;`;
      document.body.appendChild(portal);
      sd(() => portal.remove(), 1900);

      [0, 0.18, 0.36].forEach((delay, idx) => {
        const ring = document.createElement('div'); ring.className = 'battle-vfx rift-ring';
        ring.style.cssText = `left:${cx}px;top:${cy}px;--ring-delay:${delay}s;--ring-dur:${1.1 + idx * 0.1}s;`;
        document.body.appendChild(ring); setTimeout(() => ring.remove(), (1.5 + delay) * 1000);
      });
      
      const ttl = document.createElement('div'); ttl.className = 'battle-vfx rift-title';
      ttl.innerHTML = `<span class="rt-main">🌀 RIFT WARP</span><span class="rt-sub">Chronovex · Deployed</span>`;
      document.body.appendChild(ttl); sd(() => ttl.remove(), 2200);

      battlefieldEl?.classList.add('anim-screen-shake');
      sd(() => battlefieldEl?.classList.remove('anim-screen-shake'), 700);
    })();

    addLog(`🌀 Chronovex วาร์ปลงสนาม!`);
    if (isPlayer) renderHand(); else renderEnemyHand(); markDirty(); flushBoard(); await sleep(800);
    
    let bi = -1, mw = -1;
    deck.forEach((c, i) => { if (c.waitTime > mw) { mw = c.waitTime; bi = i; } });
    
    if (bi !== -1) { 
      let sm = deck.splice(bi, 1)[0]; 
      sm.flags.isSummoned = true; sm.flags._initialized = true;
      let ne = board.indexOf(null);
      
      if (ne !== -1) { 
        board[ne] = sm; 
        showFloat("HASTE SUMMON!", slots[ne], "skill"); 
        addLog(`✨ Chronovex อัญเชิญ ${sm.name}`); 
        markDirty(); flushBoard(); updateDeckCount(); await sleep(500); 
      } 
    }
  };

  await processRift(window.engineState.p1.deck, window.engineState.p1.hand, true); 
  await processRift(window.engineState.p2.deck, window.engineState.p2.hand, false);
}

async function endTurn() {
  let st = window.engineState;
  
  if (st.isGameOver || endTurnBtn?.disabled) return;
  if (endTurnBtn) endTurnBtn.disabled = true;
  
  addLog("--- เทิร์น <span class='log-player'>พีช</span> ---");
  // 🟢 จุดที่ 1: เรียก processTurnPhase ผ่าน gameEngine
  await window.gameEngine.processTurnPhase(true); 
  if (st.isGameOver) return;

  addLog("--- เทิร์น <span class='log-enemy'>บอส</span> ---");
  st.p2.hand.forEach(c => { if (c.waitTime > 0) c.waitTime--; });
  
  if (st.p2.deck.length && st.p2.hand.length < HAND_LIMIT) {
    st.p2.hand.push(st.p2.deck.shift());
  }
  renderEnemyHand(); updateDeckCount();
  
  st.p2.hand.filter(c => c.waitTime <= 0).forEach(c => { 
    let e = st.p2.board.indexOf(null); 
    if (e !== -1) { 
      c.flags._initialized = true;
      st.p2.board[e] = c; 
      st.p2.hand.splice(st.p2.hand.indexOf(c), 1); 
      addLog(`👉 <span class="log-enemy">บอส</span> ลงการ์ด ${c.name}`); 
    } 
  });
  
  markDirty(); flushBoard(); renderEnemyHand(); await sleep(600);

  // 🟢 จุดที่ 2: เรียก processTurnPhase ผ่าน gameEngine
  await window.gameEngine.processTurnPhase(false); 
  if (st.isGameOver) return;
  
  st.p1.hand.forEach(c => { if (c.waitTime > 0) c.waitTime--; });
  if (st.p1.deck.length && st.p1.hand.length < HAND_LIMIT) {
     st.p1.hand.push(st.p1.deck.shift());
  }
  renderHand(); updateDeckCount();
  
  if (endTurnBtn) endTurnBtn.disabled = false;
}