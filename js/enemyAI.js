// ============================================================
// 🤖 PHASE 8.3: OOP ENEMY AI & TURN CONTROL (Event-Driven)
// ============================================================

async function startOfBattlePhase() {
  const processRift = async (deck, hnd, isPlayer) => {
    let st = window.engineState;
    let player = st.getPlayer(isPlayer);
    let board = player.board;
    
    // 🐛 [Fix] ค้นหา Element สดๆ ผ่าน DOM แทนการเรียกตัวแปร Global ที่ถูกลบไปแล้ว
    let slots = isPlayer 
      ? document.querySelectorAll('.player-board .card-slot') 
      : document.querySelectorAll('.enemy-board .card-slot');
    
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
      // ป้องกันบัค getEffectRect หาย
      const getRect = typeof getEffectRect === 'function' ? getEffectRect : (el) => el.getBoundingClientRect();
      const slotRect = getRect(slots[em]);
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

      // 🐛 [Fix] ค้นหา battlefield สดๆ แทนตัวแปรเดิม
      const battlefieldEl = document.querySelector('.battlefield');
      battlefieldEl?.classList.add('anim-screen-shake');
      sd(() => battlefieldEl?.classList.remove('anim-screen-shake'), 700);
    })();

    // 📢 ประกาศ Log และสั่งอัปเดตหน้าจอผ่าน Event
    window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, `🌀 Chronovex วาร์ปลงสนาม!`);
    window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
    await sleep(800);
    
    let bi = -1, mw = -1;
    deck.forEach((c, i) => { if (c.waitTime > mw) { mw = c.waitTime; bi = i; } });
    
    if (bi !== -1) { 
      let sm = deck.splice(bi, 1)[0]; 
      sm.flags.isSummoned = true; sm.flags._initialized = true;
      let ne = board.indexOf(null);
      
      if (ne !== -1) { 
        board[ne] = sm; 
        if (typeof showFloat === 'function') showFloat("HASTE SUMMON!", slots[ne], "skill"); 
        
        window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, `✨ Chronovex อัญเชิญ ${sm.name}`); 
        window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
        await sleep(500); 
      } 
    }
  };

  await processRift(window.engineState.p1.deck, window.engineState.p1.hand, true); 
  await processRift(window.engineState.p2.deck, window.engineState.p2.hand, false);
}

async function endTurn() {
  let st = window.engineState;
  const endTurnBtn = document.getElementById('end-turn-btn');
  
  if (st.isGameOver || (endTurnBtn && endTurnBtn.disabled)) return;
  if (endTurnBtn) endTurnBtn.disabled = true;
  
  // 📢 เปลี่ยนจาก addLog ตรงๆ เป็นการยิง Event
  window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, "--- เทิร์น <span class='log-player'>พีช</span> ---");
  await window.gameEngine.processTurnPhase(true); 
  if (st.isGameOver) return;

  window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, "--- เทิร์น <span class='log-enemy'>บอส</span> ---");
  st.p2.hand.forEach(c => { if (c.waitTime > 0) c.waitTime--; });
  
  if (st.p2.deck.length && st.p2.hand.length < HAND_LIMIT) {
    st.p2.hand.push(st.p2.deck.shift());
  }
  
  // 📢 สั่งอัปเดตบอร์ดแทน renderEnemyHand, updateDeckCount
  window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
  
  st.p2.hand.filter(c => c.waitTime <= 0).forEach(c => { 
    let e = st.p2.board.indexOf(null); 
    if (e !== -1) { 
      c.flags._initialized = true;
      st.p2.board[e] = c; 
      st.p2.hand.splice(st.p2.hand.indexOf(c), 1); 
      window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, `👉 <span class="log-enemy">บอส</span> ลงการ์ด ${c.name}`); 
    } 
  });
  
  window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
  await sleep(600);

  await window.gameEngine.processTurnPhase(false); 
  if (st.isGameOver) return;
  
  st.p1.hand.forEach(c => { if (c.waitTime > 0) c.waitTime--; });
  if (st.p1.deck.length && st.p1.hand.length < HAND_LIMIT) {
     st.p1.hand.push(st.p1.deck.shift());
  }
  window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
  
  if (endTurnBtn) endTurnBtn.disabled = false;
}