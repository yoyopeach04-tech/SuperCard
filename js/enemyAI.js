// ── 14. BATTLE PHASE & TURN CONTROL ───────────────────────
async function startOfBattlePhase() {
  const processRift = async (deck, hnd, isPlayer) => {
    let board = getMyBoard(isPlayer), slots = isPlayer ? playerBoardSlots : enemyBoardSlots;
    let ci = hnd.findIndex(c => c.id === 98), di = deck.findIndex(c => c.id === 98), cc = null;
    if (ci !== -1) cc = hnd.splice(ci, 1)[0]; else if (di !== -1) cc = deck.splice(di, 1)[0];
    if (!cc || board.indexOf(null) === -1) return;
    let em = board.indexOf(null); initCard(cc); board[em] = cc;

    // ── ✨ RIFT DEPLOYMENT visual effect ──
    (() => {
      const slotRect = getEffectRect(slots[em]);
      const cx = slotRect.left + slotRect.width / 2;
      const cy = slotRect.top  + slotRect.height / 2;

      // Overlay dim
      const ov = document.createElement('div'); ov.className = 'battle-vfx rift-overlay'; document.body.appendChild(ov);
      sd(() => ov.remove(), 2000);

      // Portal circle
      const sz = 140;
      const portal = document.createElement('div'); portal.className = 'battle-vfx rift-portal';
      portal.style.cssText = `width:${sz}px;height:${sz}px;left:${cx - sz/2}px;top:${cy - sz/2}px;`;
      document.body.appendChild(portal);
      sd(() => portal.remove(), 1900);

      // Expanding rings
      [0, 0.18, 0.36].forEach((delay, idx) => {
        const ring = document.createElement('div'); ring.className = 'battle-vfx rift-ring';
        ring.style.cssText = `left:${cx}px;top:${cy}px;--ring-delay:${delay}s;--ring-dur:${1.1 + idx * 0.1}s;`;
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), (1.5 + delay) * 1000);
      });

      // Title
      const ttl = document.createElement('div'); ttl.className = 'battle-vfx rift-title';
      ttl.innerHTML = `<span class="rt-main">🌀 RIFT WARP</span><span class="rt-sub">Chronovex · Deployed</span>`;
      document.body.appendChild(ttl);
      sd(() => ttl.remove(), 2200);

      // Screen shake
      battlefieldEl?.classList.add('anim-screen-shake');
      sd(() => battlefieldEl?.classList.remove('anim-screen-shake'), 700);
    })();
    // ──────────────────────────────────────

    addLog(`🌀 Chronovex วาร์ปลงสนาม!`);
    if (isPlayer) renderHand(); else renderEnemyHand(); markDirty(); flushBoard(); await sleep(800);
    let bi = -1, mw = -1;
    deck.forEach((c, i) => { if (c.waitTime > mw) { mw = c.waitTime; bi = i; } });
    if (bi !== -1) { let sm = cloneCard(deck.splice(bi, 1)[0]); sm.isSummoned = true; let ne = board.indexOf(null);
      if (ne !== -1) { initCard(sm); board[ne] = sm; showFloat("HASTE SUMMON!", slots[ne], "skill"); addLog(`✨ Chronovex อัญเชิญ ${sm.name}`); markDirty(); flushBoard(); updateDeckCount(); await sleep(500); } }
  };
  await processRift(playerDeck, hand, true); await processRift(enemyDeck, enemyHand, false);
}

async function endTurn() {
  if (isGameOver || endTurnBtn?.disabled) return;
  if (endTurnBtn) endTurnBtn.disabled = true;
  addLog("--- เทิร์น <span class='log-player'>พีช</span> ---");
  await processTurnPhase(true); if (isGameOver) return;

  addLog("--- เทิร์น <span class='log-enemy'>บอส</span> ---");
  enemyHand.forEach(c => { if (c.waitTime > 0) c.waitTime--; });
  if (enemyDeck.length && enemyHand.length < HAND_LIMIT) enemyHand.push(cloneCard(enemyDeck.splice(0, 1)[0]));
  renderEnemyHand(); updateDeckCount();
  enemyHand.filter(c => c.waitTime <= 0).forEach(c => { let e = enemyBoard.indexOf(null); if (e !== -1) { enemyBoard[e] = c; initCard(enemyBoard[e]); enemyHand.splice(enemyHand.indexOf(c), 1); addLog(`👉 <span class="log-enemy">บอส</span> ลงการ์ด ${c.name}`); } });
  markDirty(); flushBoard(); renderEnemyHand(); await sleep(600);

  await processTurnPhase(false); if (isGameOver) return;
  hand.forEach(c => { if (c.waitTime > 0) c.waitTime--; });
  if (playerDeck.length && hand.length < HAND_LIMIT) hand.push(cloneCard(playerDeck.splice(0, 1)[0]));
  renderHand(); updateDeckCount();
  if (endTurnBtn) endTurnBtn.disabled = false;
}
// endTurnBtn.onclick is wired inside DOMContentLoaded below