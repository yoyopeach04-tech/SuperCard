// ── 10. VISUAL EFFECTS (Optimized) ────────────────────────
async function triggerBloodNovaEffect(cSlot, tSlots, tBoard, dmg, isPlayer, cCard) {
  battlefieldEl?.classList.add('anim-screen-shake'); sd(() => battlefieldEl?.classList.remove('anim-screen-shake'), 700);
  const ov = document.createElement('div'); ov.className = 'battle-vfx blood-nova-overlay'; document.body.appendChild(ov);
  const tt = document.createElement('div'); tt.className = 'battle-vfx blood-nova-title';
  tt.innerHTML = `<span class="title-main">💀 BLOOD NOVA</span><span class="title-sub">— CRIMSON FRENZY —</span>`; document.body.appendChild(tt);
  const cr = getEffectRect(cSlot), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
  for (let w = 0; w < 3; w++) { let wv = document.createElement('div'); wv.className = 'battle-vfx blood-shockwave'; wv.style.cssText = `left:${cx}px;top:${cy}px;animation-delay:${w * 0.15}s`; document.body.appendChild(wv); setTimeout(() => wv.remove(), 1400); }
  
  await sleep(500);
  
  for (let i = 0; i < tBoard.length; i++) {
    if (!tBoard[i]) continue; 
    let s = tSlots[i];
    let fl = document.createElement('div'); fl.className = 'battle-vfx blood-hit-flash'; s.style.position = 'relative'; s.appendChild(fl);
    let st = document.createElement('div'); st.className = 'battle-vfx blood-stain'; s.appendChild(st);
    applyDamage(tBoard[i], dmg, s, !isPlayer, "blood_nova", cCard); 
    showFloat(`💀 ${dmg}`, s, "dmg", i * 80); 
    sd(() => fl?.remove(), 800); setTimeout(() => st?.remove(), 3000);
  }
  
  await sleep(300);
  sd(() => ov?.remove(), 400); sd(() => tt?.remove(), 500); await sleep(200);
}

async function triggerTyrantEffect(cSlot, tSlots, tBoard, dmg, isPlayer, cCard) {
  battlefieldEl?.classList.add('anim-tyrant-shake'); sd(() => battlefieldEl?.classList.remove('anim-tyrant-shake'), 900);
  const ov = document.createElement('div'); ov.className = 'battle-vfx tyrant-overlay'; document.body.appendChild(ov);
  const tt = document.createElement('div'); tt.className = 'battle-vfx tyrant-title';
  tt.innerHTML = `<span class="title-main">IMMORTAL TYRANT</span><span class="title-sub">— Soul Dominion —</span><div class="title-souls">💀💀💀💀</div>`; document.body.appendChild(tt);
  
  await sleep(500);
  
  for (let i = 0; i < tBoard.length; i++) {
    if (!tBoard[i]) continue; 
    let s = tSlots[i];
    let fl = document.createElement('div'); fl.className = 'battle-vfx tyrant-hit-flash'; s.style.position = 'relative'; s.appendChild(fl);
    applyDamage(tBoard[i], dmg, s, !isPlayer, "tyrant", cCard);
    showFloat(`👑 ${dmg}`, s, "skill", i * 80); 
    sd(() => fl?.remove(), 1000);
  }
  
  await sleep(300);
  sd(() => ov?.remove(), 300); sd(() => tt?.remove(), 500); await sleep(200);
}

// ── 11. COMBAT CORE ────────────────────────────────────────
function applyDamage(target, dmg, targetEl, isTargetPlayer, sourceType = "normal", attackerCard = null) {
  if (!target || isNaN(dmg)) return 0;
  let tN = `<span class="${isTargetPlayer ? 'log-player' : 'log-enemy'}">${target.name}</span>`;

  if (target.physShield && sourceType === "normal") {
    target.physShield = false;
    showFloat("BLOCKED!", targetEl, "skill");
    addLog(`🛡️ ${tN} ใช้โล่ Physical Shield ป้องกันดาเมจกายภาพ!`);
    markDirty(); flushBoard();
    return 0; 
  }

  if (target.immortalTurns > 0 && target.hp - dmg <= 0) { dmg = Math.max(0, target.hp - 1);
    if (target.hp <= 1) { showFloat("IMMORTAL!", targetEl, "skill"); return 0; } }

  if ((target.corruptTurns || 0) > 0 && dmg > 0) {
    dmg = Math.floor(dmg * 1.2);
    showFloat("🌌 CORRUPT +20%", targetEl, "skill");
  }

  for (let [key, fn] of Object.entries(ARMOR_TABLE)) {
    if (hasSkill(target, key)) {
      let newDmg = fn(dmg, sourceType);
      if (newDmg < dmg) { showFloat(key === "Crimson Frenzy" ? "BLOOD ARMOR" : "🛡️ SHIELD", targetEl, "skill"); dmg = newDmg; break; }
    }
  }

  let effective = Math.min(dmg, target.hp);
  target.hp -= dmg;
  if (attackerCard && combatStats[attackerCard?.uid]) combatStats[attackerCard?.uid].dmg += dmg;
  if (combatStats[target?.uid]) combatStats[target?.uid].taken += dmg;
  if (dmg > 0 && !["tyrant", "blood_nova"].includes(sourceType)) showFloat(`-${dmg}`, targetEl, "dmg");

  const skipSources = ["tyrant", "blood_nova", "reflect", "echoes", "soul_nova", "counterstrike", "burn", "domain"];
  if (hasSkill(target, "Immortal Tyrant") && effective > 0 && !skipSources.includes(sourceType)) {
    target.hpLostAccum = (target.hpLostAccum || 0) + effective;
    while (target.hpLostAccum >= target.maxHP * 0.25) {
      target.fragments = (target.fragments || 0) + 1;
      target.hpLostAccum -= target.maxHP * 0.25;
      showFloat(`Fragment ${target.fragments}/4`, targetEl, "skill"); addLog(`🔮 ${tN} Soul Fragment (${target.fragments}/4)`);
      if (target.fragments >= 4) {
        target.fragments = 0; target.hpLostAccum = 0;
        let heal = Math.floor(target.maxHP * 0.5); target._displayHP = target.hp; target.hp += heal; target.immortalTurns = (target.immortalTurns || 0) + 1;
        if (combatStats[target?.uid]) combatStats[target?.uid].heal += heal;
        showFloat("TYRANT AWOKEN!", targetEl, "skill"); showFloat(`+${heal}`, targetEl, "heal");
        let eb = isTargetPlayer ? enemyBoard : playerBoard, es = isTargetPlayer ? enemyBoardSlots : playerBoardSlots;
        let cs = isTargetPlayer ? playerBoardSlots[playerBoard.indexOf(target)] : enemyBoardSlots[enemyBoard.indexOf(target)];
        addLog(`👑 ${tN} <span class="log-skill">Immortal Tyrant!</span>`);
        triggerTyrantEffect(cs || targetEl, es, eb, target.atk * 2, isTargetPlayer, target);
        break;
      }
    }
  }

  if (hasSkill(target, "Iron Sentinel") && dmg > 0 && ["normal", "splash", "domain", "burn"].includes(sourceType)) {
    target.sentinelStacks = Math.min(10, (target.sentinelStacks || 0) + 1);
    target.atk = (target.baseATK || target.atk) + target.sentinelStacks * 35;
    addLog(`🛡️ ${tN} Battle Hardened (${target.sentinelStacks}/10) ATK→${target.atk}`);
    showFloat(`⚔️+35(${target.sentinelStacks})`, targetEl, "skill");
  }

  return dmg;
}

function shatterCard(slotEl) {
  if (!slotEl) return;
  const rect = slotEl.getBoundingClientRect();
  const cardEl = slotEl.querySelector('.card');
  const imgUrl = cardEl
    ? (cardEl.querySelector('.card-image-bg')?.style.backgroundImage || 'none')
    : 'none';

  const shards = [
    { clip: "polygon(0% 0%, 48% 0%, 32% 42%, 0% 28%)",       ox: -65, oy: -85, rot: -38 },
    { clip: "polygon(48% 0%, 100% 0%, 100% 22%, 62% 36%)",    ox:  75, oy: -72, rot:  30 },
    { clip: "polygon(0% 28%, 32% 42%, 18% 68%, 0% 58%)",      ox: -82, oy:  18, rot: -52 },
    { clip: "polygon(32% 42%, 62% 36%, 58% 74%, 18% 68%)",    ox: -18, oy:  95, rot:  14 },
    { clip: "polygon(62% 36%, 100% 22%, 100% 68%, 58% 74%)",  ox:  78, oy:  52, rot:  42 },
    { clip: "polygon(18% 68%, 58% 74%, 46% 100%, 0% 100%)",   ox: -58, oy: 112, rot: -26 },
    { clip: "polygon(58% 74%, 100% 68%, 100% 100%, 46% 100%)",ox:  62, oy: 105, rot:  32 },
  ];

  shards.forEach((s, idx) => {
    const shard = document.createElement('div');
    shard.className = 'battle-vfx card-shard';
    shard.style.cssText = `
      width:${rect.width}px; height:${rect.height}px;
      left:${rect.left}px; top:${rect.top}px;
      background-image:${imgUrl};
      clip-path:${s.clip};
      --ex:${s.ox}px; --ey:${s.oy + 55}px; --er:${s.rot}deg;
      animation-delay:${idx * 0.028}s;
    `;
    document.body.appendChild(shard);
    setTimeout(() => shard.remove(), 900 + idx * 30);
  });

  const flash = document.createElement('div');
  flash.className = 'battle-vfx card-shatter-flash';
  flash.style.cssText = `left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; height:${rect.height}px;`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 280);
}

async function checkDeaths() {
  let changed = false, loop = true;
  while (loop) {
    loop = false;
    [playerBoard, enemyBoard].forEach((board, bIdx) => {
      let slots = bIdx === 0 ? playerBoardSlots : enemyBoardSlots;
      let grave  = bIdx === 0 ? playerGraveyard  : enemyGraveyard;
      for (let i = 0; i < BOARD_SIZE; i++) {
        let c = board[i]; if (!c || c.hp > 0 || c.isDying) continue;
        c.isDying = true;
        for (let [key, fn] of Object.entries(DEATH_TABLE)) {
          if (hasSkill(c, key)) {
            let blocked = fn(c, board, grave, slots, i, bIdx);
            if (blocked) { c.isDying = false; break; }
          }
        }
      }
    });
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (const [board, grave, oBoard, oSlots, isP] of [[enemyBoard, enemyGraveyard, playerBoard, playerBoardSlots, false], [playerBoard, playerGraveyard, enemyBoard, enemyBoardSlots, true]]) {
        if (board[i] && board[i].hp <= 0) {
          if (board[i].isClone) {
            let xd = Math.floor(board[i].parentATK * 0.5), ti = -1, mh = -1;
            oBoard.forEach((e, idx) => { if (e && e.hp > mh) { mh = e.hp; ti = idx; } });
            if (ti !== -1) { addLog(`💥 โคลนระเบิดใส่ ${oBoard[ti].name}`); applyDamage(oBoard[ti], xd, oSlots[ti], isP, "soul_nova", board[i]); }
          }
          addLog(`💀 <span class="${isP ? 'log-enemy' : 'log-player'}">${board[i].name}</span> ตาย`);

          const devourBoard = isP ? enemyBoard : playerBoard;
          const devourSlots = isP ? enemyBoardSlots : playerBoardSlots;
          const deadSlots  = board === playerBoard ? playerBoardSlots : enemyBoardSlots;
          const deadSRect  = getEffectRect(deadSlots?.[i]);
          devourBoard.forEach((ally, ai) => {
            if (!ally || ally === board[i] || ally.hp <= 0) return;
            if (!hasSkill(ally, "Abyss Devour")) return;
            if ((ally.devourStacks || 0) >= 8) return;
            ally.devourStacks = (ally.devourStacks || 0) + 1;
            const healAmt = Math.floor(ally.maxHP * 0.1);
            ally._displayHP = ally.hp; ally._displayATK = ally.atk; 
            ally.hp = Math.min(ally.maxHP, ally.hp + healAmt);
            ally.baseATK = ally.baseATK || ally.atk;
            ally.atk = Number(ally.atk) + 40;
            if (combatStats[ally?.uid]) combatStats[ally?.uid].heal += healAmt;
            const dRect = getEffectRect(devourSlots[ai]);
            if (deadSRect) {
              const orb = document.createElement('div'); orb.className = 'battle-vfx devour-orb';
              const sz = 14;
              const tx = dRect.left + dRect.width/2 - (deadSRect.left + deadSRect.width/2);
              const ty = dRect.top  + dRect.height/2 - (deadSRect.top  + deadSRect.height/2);
              orb.style.cssText = `width:${sz}px;height:${sz}px;left:${deadSRect.left + deadSRect.width/2 - sz/2}px;top:${deadSRect.top + deadSRect.height/2 - sz/2}px;--do-tx:${tx}px;--do-ty:${ty}px;--do-delay:0s;--do-dur:0.75s;`;
              document.body.appendChild(orb);
              setTimeout(() => orb.remove(), 900);
            }
            showFloat(`🕳 +${healAmt}HP / ATK+40`, devourSlots[ai], "heal");
            addLog(`🕳 ${ally.name} <span class="log-skill">Abyss Devour</span> (${ally.devourStacks}/8) ฮีล +${healAmt} ATK→${ally.atk}`);
          });

          oBoard.forEach((killer, ki) => {
            if (!killer || killer.hp <= 0 || !hasSkill(killer, "Power from the Fallen")) return;
            killer._displayATK = killer.atk; killer._displayHP = killer.hp;
            const atkBonus = Math.floor(Number(killer.atk) * 0.2);
            const healAmt  = Math.floor(killer.maxHP * 0.15);
            killer.atk = Number(killer.atk) + atkBonus;
            killer.hp  = Math.min(killer.maxHP, killer.hp + healAmt);
            if (combatStats[killer?.uid]) combatStats[killer?.uid].heal += healAmt;
            showFloat(`⚡ ATK+${atkBonus}/+${healAmt}HP`, oSlots[ki], "skill");
            addLog(`⚡ ${killer.name} <span class="log-skill">Power from the Fallen</span>: ATK→${killer.atk}`);
          });

          shatterCard(deadSlots[i]); 
          await sleep(200);          
          grave.push(board[i]); board[i] = null; changed = true; loop = true;
        }
      } 
    }
  }
  if (changed) { updateHeroHP(); updateGrave(); markDirty(); flushBoard(); }
}

async function shiftBoards() {
  let np = [...playerBoard.filter(Boolean), ...Array(BOARD_SIZE).fill(null)].slice(0, BOARD_SIZE);
  let ne = [...enemyBoard.filter(Boolean),  ...Array(BOARD_SIZE).fill(null)].slice(0, BOARD_SIZE);
  if (playerBoard.some((c, i) => c !== np[i]) || enemyBoard.some((c, i) => c !== ne[i])) {
    playerBoard = np; enemyBoard = ne; addLog(`➡️ <span style="color:#aaa">กระดานเลื่อน...</span>`); markDirty(); flushBoard(); await sleep(250);
  }
}

// ── 12. EXECUTE ATTACK (PURE EVENT-DRIVEN CORE + PERFECT STATE) ─────────────────
const LOA_IMPACT_MS = 175;
const LOA_RECOIL_MS = 175;

async function executeAttack(attacker, defender, idx, isPlayer) {
  if (!attacker || isGameOver) return;
  const tHero   = isPlayer ? enemyHeroEl : playerHeroEl;
  const tSlots  = isPlayer ? enemyBoardSlots : playerBoardSlots;
  const aSlots  = isPlayer ? playerBoardSlots : enemyBoardSlots;
  const anim    = isPlayer ? 'anim-loa-attack-up' : 'anim-loa-attack-down';

  const addStat = (entity, type, amount) => {
    if (entity?.uid && combatStats[entity.uid]) combatStats[entity.uid][type] += amount;
  };

  const spawnImpactClaw = (targetEl) => {
    if (!targetEl || targetEl.offsetWidth === 0) return; 
    targetEl.style.position = 'relative';
    const cx = targetEl.offsetWidth / 2, cy = targetEl.offsetHeight / 2;
    for (let i = 0; i < 3; i++) {
      const slash = document.createElement('div'); slash.className = 'claw-slash';
      slash.style.left = (cx + (Math.random() - 0.5) * 50 - 40) + 'px';
      slash.style.top  = (cy + (Math.random() - 0.5) * 30) + 'px';
      targetEl.appendChild(slash);
      setTimeout(() => slash.remove(), 350);
    }
    targetEl.classList.add('hit-shake');
    sd(() => targetEl.classList.remove('hit-shake'), 200);
  };

  let context = {
    attacker: attacker, defender: defender, idx: idx, isPlayer: isPlayer,
    attackerSlot: aSlots[idx], defenderSlot: tSlots[idx], targetHero: tHero,
    damage: attacker.atk, actualDmg: 0, attackMissed: false, spawnImpactClaw: spawnImpactClaw,
    shadowStrike: false, isCrit: false, isLastAttack: false
  };

  let oppBoard = [], myBoard = [];
  const refreshState = () => {
    oppBoard = getMyBoard(!isPlayer);
    myBoard  = getMyBoard(isPlayer);
    attacker = myBoard[idx] && myBoard[idx].hp > 0 ? myBoard[idx] : null;
    context.attacker = attacker;
    context.attackerSlot = attacker ? aSlots[idx] : null;
    defender = oppBoard[idx] && oppBoard[idx].hp > 0 ? oppBoard[idx] : null;
    context.defender = defender;
    context.defenderSlot = defender ? tSlots[idx] : null;
    context.myBoard = myBoard;
    context.oppBoard = oppBoard;
    context.mySlots = isPlayer ? playerBoardSlots : enemyBoardSlots;
    context.oppSlots = isPlayer ? enemyBoardSlots : playerBoardSlots;
  };

  refreshState(); 
  if (!attacker) return;

  await triggerSkillEvent('onBeforeAttack', attacker, context);
  refreshState(); 
  if (!attacker) return; 

  const aName = `<span class="${isPlayer ? 'log-player' : 'log-enemy'}">${attacker.name}</span>`;
  let attacks = hasSkill(attacker, "ยิงแฝด") ? 2 : 1; 

  for (let a = 0; a < attacks; a++) {
    refreshState();
    if (!attacker || isGameOver) break;

    context.shadowStrike = false;
    context.isCrit = false;
    context.attackMissed = false;
    context.isLastAttack = (a === attacks - 1);

    let cardEl = context.attackerSlot?.querySelector('.card');
    const breakAndCleanup = () => { cardEl?.classList.remove(anim); };
    
    let hasDomain = oppBoard.some(c => c && c.hp > 0 && (c.domainTurns || 0) > 0);
    if (hasDomain) { 
      applyDamage(attacker, Math.floor((attacker.maxHP || attacker.hp) * 0.05), context.attackerSlot, isPlayer, "domain"); 
      await sleep(200); 
      if (attacker.hp <= 0) { breakAndCleanup(); break; }
    }

    context.damage = attacker.atk;
    if (hasDomain) context.damage = Math.floor(context.damage * 0.8);

    if (cardEl) { cardEl.classList.remove(anim); void cardEl.offsetWidth; cardEl.classList.add(anim); }
    
    await triggerSkillEvent('onAttackSwing', attacker, context);
    await sleep(LOA_IMPACT_MS);

    refreshState(); 
    if (!attacker) { breakAndCleanup(); break; }

    if (!context.shadowStrike) {
      context.isCrit = Math.random() * 100 < (attacker.critChance || 0);
      if (context.isCrit) context.damage = Math.floor(context.damage * 2); 
    }

    if (context.defender && (context.defender.shadowTurns || 0) > 0) {
      showFloat("👻 STEALTH", context.defenderSlot, "skill");
      addLog(`👻 ${context.defender.name} ซ่อนตัว — ดาเมจทะลุฮีโร่`);
      spawnImpactClaw(tHero); 
      if (isPlayer) enemyHP -= context.damage; else playerHP -= context.damage;
      showFloat(`-${context.damage}`, tHero, "dmg"); 
      addStat(attacker, 'dmg', context.damage);
      updateHeroHP();
      await sleep(LOA_RECOIL_MS); cardEl?.classList.remove(anim); await sleep(100); continue;
    }

    if (context.defender) {
      await triggerSkillEvent('onBeforeDefend', context.defender, context);
      refreshState(); 

      if (!context.attackMissed && context.defender) {
        let dName = `<span class="${!isPlayer ? 'log-player' : 'log-enemy'}">${context.defender.name}</span>`;
        
        spawnImpactClaw(context.defenderSlot); 
        
        let logMsg = `⚔️ ${aName} → ${dName} `;
        if (context.shadowStrike) logMsg += `(💥 Shadow) `; 
        else if (context.isCrit) { showFloat("CRITICAL!", context.attackerSlot, "skill"); logMsg += `(💥 คริ!) `; }
        addLog(logMsg + `<span class="log-dmg">${context.damage}</span>`);
        
        let actual = applyDamage(context.defender, context.damage, context.defenderSlot, !isPlayer, "normal", attacker);
        context.actualDmg = actual; 

        await triggerSkillEvent('onTakeDamage', context.defender, context);
        if (attacker.hp <= 0) { breakAndCleanup(); break; }
        
        refreshState(); 
        if (context.defender) { 
          await triggerSkillEvent('onAttackHit', attacker, context);
          refreshState(); 
          if (!attacker) { breakAndCleanup(); break; }
        }
      }
    } else {
      spawnImpactClaw(tHero); 
      if (context.shadowStrike) addLog(`💥 ${aName} Shadow Strike ×2.5 ตรงฮีโร่!`);
      if (isPlayer) enemyHP -= context.damage; else playerHP -= context.damage; 
      showFloat(`-${context.damage}`, tHero, "dmg");
      
      let logMsg = `⚔️ ${aName} → ฮีโร่ `;
      if (context.shadowStrike) logMsg += `(💥 Shadow) `; 
      else if (context.isCrit) { showFloat("CRITICAL!", context.attackerSlot, "skill"); logMsg += `(💥 คริ!) `; }
      addLog(logMsg + `(<span class="log-dmg">${context.damage}</span>)`);
      addStat(attacker, 'dmg', context.damage);
    }
    
    updateHeroHP();
    await sleep(LOA_RECOIL_MS);
    cardEl?.classList.remove(anim);
    await sleep(60); 

    refreshState();
    if (!attacker) break;
    await triggerSkillEvent('onAfterAttack', attacker, context);
  } 
}