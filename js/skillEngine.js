// ==========================================
// ⚙️ SKILL ENGINE (EVENT-DRIVEN SYSTEM) vPRO_HARDENED
// ==========================================

// 💡 Constants & Helpers สำหรับ Skill Engine
const FLOAT_STAGGER_MS = 80;
const delayRemove = (typeof sd !== 'undefined') ? sd : (fn, ms) => setTimeout(fn, ms / gameSpeed); 

// 🎯 TARGET RESOLVER SYSTEM (อัปเกรดความฉลาด)
const TargetResolver = {
  resolve(board, slots, criteria, count = 0, excludeIdx = -1) {
    let valid = board.map((c, i) => ({ card: c, index: i, slot: slots[i] }))
                     .filter(t => t.card && t.card.hp > 0);
    
    // กรองตัวเองออกถ้าจำเป็น
    if (criteria === "ally_except_self" || excludeIdx !== -1) {
      valid = valid.filter(t => t.index !== excludeIdx);
    }

    if (valid.length === 0) return [];

    switch(criteria) {
      case "lowest_atk":         valid.sort((a,b) => a.card.atk - b.card.atk); break;
      case "highest_atk":        valid.sort((a,b) => b.card.atk - a.card.atk); break;
      case "lowest_hp":          valid.sort((a,b) => a.card.hp - b.card.hp); break;
      case "highest_hp":         valid.sort((a,b) => b.card.hp - a.card.hp); break;
      case "highest_missing_hp": valid.sort((a,b) => ((b.card.maxHP||b.card.hp)-b.card.hp) - ((a.card.maxHP||a.card.hp)-a.card.hp)); break;
      case "lowest_wait":        valid.sort((a,b) => (a.card.waitTime||0) - (b.card.waitTime||0)); break;
      case "highest_wait":       valid.sort((a,b) => (b.card.waitTime||0) - (a.card.waitTime||0)); break;
      case "front_enemy":        valid = [valid[0]]; break; // ตัวแรกสุด
      case "back_enemy":         valid = [valid[valid.length - 1]]; break; // ตัวท้ายสุด
      case "random":             valid.sort(() => Math.random() - 0.5); break;
      case "all": case "ally_except_self": break;
    }

    // 🐞 Fix: ป้องกัน count = -1 กลายเป็นตัดตัวสุดท้ายออก
    return count > 0 ? valid.slice(0, count) : valid;
  },
  
  getAdjacent(board, slots, index) {
    let res = [];
    if (index > 0 && board[index - 1] && board[index - 1].hp > 0) res.push({ card: board[index - 1], index: index - 1, slot: slots[index - 1] });
    if (index < board.length - 1 && board[index + 1] && board[index + 1].hp > 0) res.push({ card: board[index + 1], index: index + 1, slot: slots[index + 1] });
    return res;
  }
};

const SKILL_REGISTRY = {

  "หลบหลีก": {
    priority: 100,
    onBeforeDefend: async (ctx) => {
      if (Math.random() > 0.5) { 
        showFloat("Miss!", ctx.defenderSlot, "skill"); 
        addLog(`💨 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.attacker.name}</span> ตีวืด!`); 
        ctx.attackMissed = true;
      }
    }
  },
  "พ่นไฟ": {
    priority: 50,
    onBeforeAttack: async (ctx) => {
      let fb = document.createElement('div'); fb.className = `fireball anim-fireball-${ctx.isPlayer ? 'up' : 'down'}`; ctx.attackerSlot.appendChild(fb); await sleep(400);
      if (ctx.defender && ctx.defender.hp > 0 && !(ctx.defender.shadowTurns || 0)) { applyDamage(ctx.defender, 100, ctx.defenderSlot, !ctx.isPlayer, "skill", ctx.attacker); }
      else { if (ctx.isPlayer) enemyHP -= 100; else playerHP -= 100; showFloat("-100 🔥", ctx.targetHero, "dmg"); if (ctx.attacker?.uid && combatStats[ctx.attacker.uid]) combatStats[ctx.attacker.uid].dmg += 100; }
      updateHeroHP(); fb.remove(); await sleep(400); 
    }
  },
  "คลุ้มคลั่ง": {
    priority: 50,
    onAttackSwing: async (ctx) => {
      ctx.attacker.atk = Number(ctx.attacker.atk) + 50; ctx.damage += 50; 
      showFloat("ATK +50", ctx.attackerSlot, "skill"); markDirty(); flushBoard();
    }
  },
  "เจาะเกราะ": {
    priority: 50,
    onAttackHit: async (ctx) => {
      if (ctx.actualDmg > 0) {
        ctx.spawnImpactClaw(ctx.targetHero); let p = Math.floor(ctx.attacker.atk / 2); 
        if (ctx.isPlayer) enemyHP -= p; else playerHP -= p;
        showFloat(`-${p} (เจาะ)`, ctx.targetHero, "dmg"); if (ctx.attacker?.uid && combatStats[ctx.attacker.uid]) combatStats[ctx.attacker.uid].dmg += p;
      }
    }
  },
  "สตัน": {
    priority: 50,
    onAttackHit: async (ctx) => {
      if (ctx.actualDmg > 0 && ctx.defender && ctx.defender.hp > 0) { ctx.defender.atk = Math.max(0, Number(ctx.defender.atk) - 50); showFloat("ATK -50", ctx.defenderSlot, "skill"); }
    }
  },
  "ตีกระจาย": {
    priority: 40,
    onAttackHit: async (ctx) => {
      if (ctx.actualDmg > 0) {
        let sp = Math.floor(ctx.actualDmg / 2);
        let targets = TargetResolver.getAdjacent(ctx.oppBoard, ctx.oppSlots, ctx.idx);
        for (let t of targets) {
          ctx.spawnImpactClaw(t.slot); 
          applyDamage(t.card, sp, t.slot, !ctx.isPlayer, "splash", ctx.attacker);
        }
      }
    }
  },
  "สะท้อน": {
    priority: 80,
    onTakeDamage: async (ctx) => {
      if (ctx.actualDmg > 0) { let dName = `<span class="${!ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.defender.name}</span>`; addLog(`🛡️ ${dName} สะท้อน!`); applyDamage(ctx.attacker, Math.floor(ctx.actualDmg / 2), ctx.attackerSlot, ctx.isPlayer, "reflect", ctx.defender); }
    }
  },
  "Iron Sentinel": {
    priority: 80,
    onTakeDamage: async (ctx) => {
      if (ctx.actualDmg > 0 && ctx.defender.hp > 0) { let cd = Math.floor(ctx.actualDmg * 0.4); if (cd > 0) { let dName = `<span class="${!ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.defender.name}</span>`; showFloat(`🛡️↩${cd}`, ctx.defenderSlot, "skill"); addLog(`🛡️ ${dName} Counterstrike <span class="log-dmg">${cd}</span>`); applyDamage(ctx.attacker, cd, ctx.attackerSlot, ctx.isPlayer, "counterstrike", ctx.defender); } }
    }
  },
  "Temporal Summon": {
    priority: 60,
    onBeforeAttack: async (ctx) => {
      let th = ctx.isPlayer ? hand : enemyHand, tb = ctx.myBoard, ts = ctx.mySlots; let em = tb.indexOf(null);
      if (em !== -1 && th.length > 0) {
        let maxW = -1, maxIdx = -1; th.forEach((c, i) => { if (c.waitTime > maxW) { maxW = c.waitTime; maxIdx = i; } });
        if (maxIdx !== -1) {
          let sc = th.splice(maxIdx, 1)[0]; sc.isSummoned = true; sc.waitTime = 0; tb[em] = sc; initCard(tb[em]); tb[em].physShield = true;
          showFloat("⏳ TEMPORAL SUMMON!", ctx.attackerSlot, "skill"); showFloat("🛡️ SHIELD", ts[em], "skill");
          addLog(`⏳ <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.attacker.name}</span> <span class="log-skill">Temporal Summon</span> ดึง ${sc.name} ลงสนาม!`);
          
          const sRect = getEffectRect(ctx.attackerSlot), dRect = getEffectRect(ts[em]);
          const sx = sRect.left + sRect.width/2, sy = sRect.top + sRect.height/2, dx = dRect.left + dRect.width/2, dy = dRect.top + dRect.height/2;
          const len = Math.hypot(dx - sx, dy - sy), ang = Math.atan2(dy - sy, dx - sx) * 180 / Math.PI;
          const beam = document.createElement('div'); beam.className = 'battle-vfx temporal-beam'; beam.style.cssText = `left:${sx}px;top:${sy}px;height:${len}px;transform:rotate(${ang - 90}deg);--tb-dur:0.65s;`; document.body.appendChild(beam); setTimeout(() => beam.remove(), 750);
          for (let g = 0; g < 4; g++) { const p = document.createElement('div'); p.className = 'battle-vfx temporal-gear'; p.textContent = ['⚙️','⏳','🔵'][g%3]; p.style.cssText = `left:${dx + (Math.random()-0.5)*30}px;top:${dy}px;--gx:${(Math.random()-0.5)*70}px;--gy:${-(30+Math.random()*40)}px;--gear-delay:${g*0.07}s;--gear-dur:${1.0+Math.random()*0.3}s;`; document.body.appendChild(p); setTimeout(() => p.remove(), 1500); }
          ts[em].style.position = 'relative'; const shield = document.createElement('div'); shield.className = 'battle-vfx shield-burst'; ts[em].appendChild(shield); setTimeout(() => shield.remove(), 1300);
          
          if (ctx.isPlayer) renderHand(); else renderEnemyHand(); markDirty(); flushBoard(); await sleep(600);
        }
      }
    }
  },
  "Shadow Protocol": {
    priority: 90,
    onTurnStart: async (ctx) => {
      if ((ctx.card.shadowTurns || 0) > 0) {
        ctx.card.shadowTurns--;
        if (ctx.card.shadowTurns > 0) { showFloat(`👻 STEALTH(${ctx.card.shadowTurns})`, ctx.cardSlot, "skill"); addLog(`👻 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.card.name}</span> ซ่อนตัว (${ctx.card.shadowTurns} เทิร์น)`); ctx.skipAttack = true; }
        else { ctx.card.shadowReady = true; showFloat("💥 SHADOW BREAK!", ctx.cardSlot, "skill"); addLog(`💥 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.card.name}</span> ออกซ่อน! โจมตีถัดไป ×2.5`); }
        markDirty(); flushBoard();
      }
    },
    onAttackSwing: async (ctx) => {
      if (ctx.attacker.shadowReady) { ctx.attacker.shadowReady = false; ctx.damage = Math.floor(ctx.damage * 2.5); ctx.shadowStrike = true; showFloat("💥 SHADOW STRIKE!", ctx.attackerSlot, "skill"); }
    }
  },
  "Crimson Frenzy": {
    priority: 85,
    onTakeDamage: async (ctx) => {
      if (ctx.actualDmg > 0 && ctx.defender.hp > 0) {
        let da = Math.floor((ctx.attacker.atk || 0) * 0.1), dh = Math.floor((ctx.attacker.maxHP || ctx.attacker.hp) * 0.1);
        if (da > 0) { ctx.attacker._displayATK = ctx.attacker.atk; ctx.attacker.atk = Math.max(0, ctx.attacker.atk - da); }
        if (dh > 0) { ctx.attacker._displayHP = ctx.attacker.hp; ctx.attacker.hp = Math.max(0, ctx.attacker.hp - dh); }
        ctx.defender._displayATK = ctx.defender.atk; ctx.defender._displayHP = ctx.defender.hp;
        ctx.defender.atk = Number(ctx.defender.atk) + da; ctx.defender.hp += dh; 
        if (ctx.defender?.uid && combatStats[ctx.defender.uid]) combatStats[ctx.defender.uid].heal += dh;
        if (ctx.attacker?.uid && combatStats[ctx.attacker.uid]) combatStats[ctx.attacker.uid].taken += dh; 
        showFloat(`🩸-${da}A/-${dh}H`, ctx.attackerSlot, "drain"); showFloat(`+${da}A/+${dh}H`, ctx.defenderSlot, "drain");
        ctx.defender.bloodStacks = Math.min(3, (ctx.defender.bloodStacks || 0) + 1);
        addLog(`🩸 <span class="${!ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.defender.name}</span> Blood Stack (${ctx.defender.bloodStacks}/3)`);
      }
    },
    onAfterAttack: async (ctx) => {
      if (ctx.isLastAttack && (ctx.attacker.bloodStacks || 0) >= 3) {
        if (!ctx.oppBoard.some(Boolean)) return;
        ctx.attacker.bloodStacks = 0;
        addLog(`🩸 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.attacker.name}</span> <span class="log-skill">💥 BLOOD NOVA!</span> <span class="log-dmg">${ctx.attacker.atk} AOE</span>`);
        await triggerBloodNovaEffect(ctx.attackerSlot, ctx.oppSlots, ctx.oppBoard, ctx.attacker.atk, ctx.isPlayer, ctx.attacker); updateHeroHP();
      }
    }
  },
  "Restoration Pulse": {
    priority: 30,
    onAfterAttack: async (ctx) => {
      let targets = TargetResolver.resolve(ctx.myBoard, ctx.mySlots, "highest_missing_hp", 1);
      if (targets.length > 0) {
        let t = targets[0];
        let mHP = (t.card.maxHP || t.card.hp) - t.card.hp;
        if (mHP > 0) {
          let heal = Math.floor(ctx.attacker.atk * 1.5);
          t.card._displayHP = t.card.hp; t.card.hp = Math.min(t.card.maxHP ?? t.card.hp, t.card.hp + heal);
          if (ctx.attacker?.uid && combatStats[ctx.attacker.uid]) combatStats[ctx.attacker.uid].heal += heal;
          
          (() => {
            const sRect = getEffectRect(ctx.attackerSlot), dRect = getEffectRect(t.slot);
            const sx = sRect.left + sRect.width/2, sy = sRect.top + sRect.height/2, dx = dRect.left + dRect.width/2, dy = dRect.top + dRect.height/2;
            [0, 0.15, 0.30].forEach((delay) => { const ring = document.createElement('div'); ring.className = 'battle-vfx restore-ring'; ring.style.cssText = `left:${sx}px;top:${sy}px;--rr-delay:${delay}s;--rr-dur:0.9s;`; document.body.appendChild(ring); delayRemove(() => ring.remove(), 1100); });
            if (t.index !== ctx.idx) { const len = Math.hypot(dx - sx, dy - sy), ang = Math.atan2(dy - sy, dx - sx) * 180 / Math.PI; const beam = document.createElement('div'); beam.className = 'battle-vfx restore-beam'; beam.style.cssText = `left:${sx}px;top:${sy}px;width:${len}px;transform:rotate(${ang}deg);--rb-dur:0.55s;`; document.body.appendChild(beam); delayRemove(() => beam.remove(), 700); }
            for (let h = 0; h < 5; h++) { const p = document.createElement('div'); p.className = 'battle-vfx heart-particle'; p.textContent = h % 2 === 0 ? '💖' : '✨'; p.style.cssText = `left:${dx + (Math.random()-0.5)*30}px;top:${dy}px;--hx:${(Math.random()-0.5)*60}px;--hy:${-(55+Math.random()*50)}px;--hp-delay:${h*0.09}s;--hp-dur:${1.0+Math.random()*0.3}s;`; document.body.appendChild(p); delayRemove(() => p.remove(), 1600); }
          })();

          showFloat(`💖 +${heal}`, t.slot, "heal"); addLog(`💖 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.attacker.name}</span> <span class="log-skill">Restoration Pulse</span> ฮีล ${t.card.name} ${heal} HP`);
          updateHeroHP(); markDirty(); flushBoard(); await sleep(400);
        }
      }
    }
  },

  "ฟื้นฟู": {
    priority: 50,
    onTurnStart: async (ctx) => {
      ctx.card.hp = Math.min(ctx.card.maxHP, ctx.card.hp + 100);
      if (ctx.card?.uid && combatStats[ctx.card.uid]) combatStats[ctx.card.uid].heal += 100; 
      showFloat("+100", ctx.cardSlot, "heal"); ctx.usedSkill = true;
    }
  },
  "Grave Domain": {
    priority: 60,
    onTurnStart: async (ctx) => {
      if ((ctx.card.domainTurns || 0) <= 0 && !ctx.card.domainUsed) { 
        ctx.card.domainTurns = 3; ctx.card.domainUsed = true; showFloat("GRAVE DOMAIN", ctx.cardSlot, "skill"); ctx.usedSkill = true; 
      } else if ((ctx.card.domainTurns || 0) > 0) { 
        ctx.card.domainTurns--; 
        let targets = TargetResolver.resolve(ctx.myBoard, ctx.mySlots, "all", 0);
        for (let t of targets) {
          let h = Math.floor(t.card.maxHP * 0.08); t.card.hp += h; 
          if (ctx.card?.uid && combatStats[ctx.card.uid]) combatStats[ctx.card.uid].heal += h; 
          showFloat(`+${h}`, t.slot, "heal");
        }
        ctx.usedSkill = true; 
      }
    }
  },
  "Hunter's Aura": {
    priority: 90,
    onTurnStart: async (ctx) => {
      const hasWeak = ctx.oppBoard.some(c => c && c.hp > 0 && (c.baseWait || 0) < 3);
      if (hasWeak && !ctx.card.hunterAuraActive) {
        ctx.card.hunterAuraActive = true; ctx.card.hunterAuraBonus = Math.floor(ctx.card.baseATK * 0.3);
        ctx.card._displayATK = ctx.card.atk; ctx.card.atk = Number(ctx.card.atk) + ctx.card.hunterAuraBonus;
        showFloat("🦁 HUNTER +30%", ctx.cardSlot, "skill"); markDirty();
      } else if (!hasWeak && ctx.card.hunterAuraActive) {
        ctx.card.hunterAuraActive = false; ctx.card._displayATK = ctx.card.atk;
        ctx.card.atk = Math.max(ctx.card.baseATK, Number(ctx.card.atk) - (ctx.card.hunterAuraBonus || 0)); 
        ctx.card.hunterAuraBonus = 0; markDirty();
      }
    }
  },
  "Soul Rip": {
    priority: 40,
    onTurnStart: async (ctx) => {
      // 🐞 Fix 5: ป้องกันโคลนล้นกระดาน
      if (ctx.card.soulRipUsed) return;
      
      let targets = TargetResolver.resolve(ctx.oppBoard, ctx.oppSlots, "random", 1);
      let empties = ctx.myBoard.map((c, i) => !c ? i : -1).filter(i => i !== -1);
      
      if (targets.length > 0 && empties.length > 0) {
        ctx.card.soulRipUsed = true; // ล็อคไว้ไม่ให้เสกซ้ำ
        let tgt = targets[0].card;
        let esIdx = empties[0];
        let cln = { uid: ++cardUidCounter, owner: ctx.card.owner, name: "Shadow of " + tgt.name.replace(/Shadow of /g, ""),
          hp: Math.floor((tgt.maxHP || tgt.hp) * 0.5), maxHP: Math.floor((tgt.maxHP || tgt.hp) * 0.5), baseHP: Math.floor((tgt.maxHP || tgt.hp) * 0.5),
          atk: Math.floor((tgt.baseATK || tgt.atk) * 1.5), baseATK: Math.floor((tgt.baseATK || tgt.atk) * 1.5),
          stars: 0, image: tgt.image, skills: [{ id: "Soul Nova", name: "💥 Soul Nova", desc: "โคลนระเบิดเป้าเดี่ยว" }], parentATK: ctx.card.atk, isClone: true, waitTime: 0, baseWait: 0, isSummoned: true, _initialized: true };
        Object.assign(cln, getCombatStateDefaults(cln), { burnTurns: 0, corruptTurns: 0 });
        ctx.myBoard[esIdx] = cln; initCard(cln); showFloat("Summon!", ctx.mySlots[esIdx], "skill"); 
        addLog(`💀 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.card.name}</span> Soul Rip → ${cln.name}`); ctx.usedSkill = true;
      }
    }
  },
  "Temporal Acceleration": {
    priority: 50,
    onTurnStart: async (ctx) => {
      addLog(`⏳ <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.card.name}</span> <span class="log-skill">Temporal Acceleration</span>`);
      showFloat("⏳ TIME ACCEL!", ctx.cardSlot, "skill"); await sleep(400);

      (() => {
        const sweep = document.createElement('div'); sweep.className = 'time-accel-sweep'; document.body.appendChild(sweep); delayRemove(() => sweep.remove(), 950);
        for (let ci = 0; ci < 6; ci++) { const sRect = getEffectRect(ctx.cardSlot); const p = document.createElement('div'); p.className = 'time-clock-particle'; p.textContent = ['⏳','⌛','🕐','⏱️'][ci%4]; p.style.cssText = `left:${sRect.left+sRect.width/2+(Math.random()-0.5)*60}px;top:${sRect.top}px;--clk-x:${(Math.random()-0.5)*160}px;--clk-y:${-(60+Math.random()*80)}px;--clk-dur:${1.1+Math.random()*0.4}s;--clk-delay:${ci*0.08}s;`; document.body.appendChild(p); delayRemove(() => p.remove(), 1800); }
      })();

      let th = ctx.isPlayer ? hand : enemyHand, tz = ctx.isPlayer ? handZone : enemyHandZone;
      th.forEach(c => c.waitTime = Math.max(0, c.waitTime - 1));
      if (tz) { tz.classList.add('anim-hand-twinkle'); showFloat("CD -1", ctx.cardSlot, "heal"); if (ctx.isPlayer) renderHand(); else renderEnemyHand(); await sleep(800); tz.classList.remove('anim-hand-twinkle'); }
      
      let has6 = ctx.myBoard.some(c => c && c.baseWait >= 6);
      let targets = TargetResolver.resolve(ctx.myBoard, ctx.mySlots, "all", 0);
      for (let t of targets) {
        let au = document.createElement('div'); au.className = 'buff-aura'; t.slot.appendChild(au);
        let hb = Math.floor(t.card.maxHP * 0.3), ab = Math.floor(t.card.baseATK * 0.3);
        t.card._displayHP = t.card.hp; t.card._displayATK = t.card.atk; t.card.maxHP += hb; t.card.hp += hb; t.card.atk = Number(t.card.atk) + ab; 
        if (t.card.isSummoned || t.card.isClone) t.card.critChance = (t.card.critChance || 0) + 35;
        showFloat(`ATK+${ab}/HP+${hb}`, t.slot, "skill"); markDirty(); 
        if (has6) { let h = Math.floor(t.card.maxHP * 0.1); t.card.hp += h; if (ctx.card?.uid && combatStats[ctx.card.uid]) combatStats[ctx.card.uid].heal += h; showFloat(`+${h}HP`, t.slot, "heal"); markDirty(); } 
        await sleep(200); delayRemove(() => au.remove(), 300);
      }
      ctx.usedSkill = true;
    }
  },
  "Void Breath": {
    priority: 30,
    onTurnStart: async (ctx) => {
      const vbDmg = Math.floor(ctx.card.atk * 1.4);
      let targets = TargetResolver.resolve(ctx.oppBoard, ctx.oppSlots, "all", 0);
      if (targets.length > 0) {
        addLog(`🌌 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.card.name}</span> <span class="log-skill">Void Breath!</span> <span class="log-dmg">AOE ${vbDmg} + Corrupt</span>`);
        (() => {
          battlefieldEl?.classList.add('anim-screen-shake'); delayRemove(() => battlefieldEl?.classList.remove('anim-screen-shake'), 700);
          const ov = document.createElement('div'); ov.className = 'void-overlay'; document.body.appendChild(ov); delayRemove(() => ov.remove(), 2100);
          const ttl = document.createElement('div'); ttl.className = 'void-breath-title'; ttl.innerHTML = `<span class="vt-main">🌌 VOID BREATH</span><span class="vt-sub">— Corrupt —</span>`; document.body.appendChild(ttl); delayRemove(() => ttl.remove(), 2300);
          const sRect = getEffectRect(ctx.cardSlot); if(sRect) { const cx = sRect.left + sRect.width/2, cy = sRect.top + sRect.height/2; [0, 0.18, 0.36].forEach((d, idx) => { const sw = document.createElement('div'); sw.className = 'void-shockwave'; sw.style.cssText = `left:${cx}px;top:${cy}px;--vs-delay:${d}s;--vs-dur:${1.1+idx*0.1}s;`; document.body.appendChild(sw); delayRemove(() => sw.remove(), (1.6+d)*1000); }); }
        })();
        await sleep(400);
        for (let t of targets) {
          const fl = document.createElement('div'); fl.className = 'void-hit-flash'; t.slot.style.position = 'relative'; t.slot.appendChild(fl);
          const st = document.createElement('div'); st.className = 'corrupt-stain'; t.slot.appendChild(st);
          applyDamage(t.card, vbDmg, t.slot, !ctx.isPlayer, "void_breath", ctx.card);
          t.card.corruptTurns = (t.card.corruptTurns || 0) + 2; showFloat("🌌 CORRUPT", t.slot, "skill", t.index * FLOAT_STAGGER_MS);
          delayRemove(() => fl?.remove(), 900); delayRemove(() => st?.remove(), 3000); await sleep(80);
        }
        ctx.usedSkill = true;
      }
    }
  },
  "Airstrike Omega": {
    priority: 25,
    onTurnStart: async (ctx) => {
      if (!ctx.skipAttack) {
        ctx.card.airstrikeCharge = (ctx.card.airstrikeCharge || 0) + 1;
        showFloat(`🚀 ${ctx.card.airstrikeCharge}/3`, ctx.cardSlot, "skill"); markDirty(); flushBoard();
        if (ctx.card.airstrikeCharge >= 3) {
          let targets = TargetResolver.resolve(ctx.oppBoard, ctx.oppSlots, "all", 0);
          if (targets.length === 0) return;
          ctx.card.airstrikeCharge = 0; let aoeDmg = Math.floor(ctx.card.atk * 1.6);
          let fl = document.createElement('div'); fl.className = 'airstrike-flash'; document.body.appendChild(fl); delayRemove(() => fl.remove(), 1500);
          battlefieldEl?.classList.add('anim-screen-shake'); delayRemove(() => battlefieldEl?.classList.remove('anim-screen-shake'), 700);
          let ttl = document.createElement('div'); ttl.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99995;pointer-events:none;text-align:center;animation:bloodTitleAnim 2s ease-out forwards"; ttl.innerHTML = `<span style="display:block;font-size:3.5rem;font-weight:900;font-family:Georgia,serif;color:#fff;text-shadow:0 0 20px #ff6600,0 0 50px #ff3300,4px 4px 0 #661100;-webkit-text-stroke:2px #ff4400">🚀 AIRSTRIKE OMEGA</span>`; document.body.appendChild(ttl); delayRemove(() => ttl.remove(), 2000);
          addLog(`🚀 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.card.name}</span> <span class="log-skill">Airstrike Omega!</span> <span class="log-dmg">${aoeDmg} AOE ทะลุเกราะ + Burn</span>`);
          await sleep(400);
          for (let t of targets) {
             applyDamage(t.card, aoeDmg, t.slot, !ctx.isPlayer, "airstrike", ctx.card); 
             t.card.burnTurns = (t.card.burnTurns || 0) + 2; showFloat("🔥 BURN", t.slot, "skill", t.index * FLOAT_STAGGER_MS); await sleep(100); 
          }
        }
      }
    }
  },
  "Devour the Weak": {
    priority: 85,
    onTurnStart: async (ctx) => {
      if (!ctx.card.tyrantEntryDone) {
        ctx.card.tyrantEntryDone = true; 
        let targets = TargetResolver.resolve(ctx.oppBoard, ctx.oppSlots, "lowest_atk", 1);
        
        if (targets.length > 0) {
          const victim = targets[0].card; 
          const tSlot = targets[0].slot;
          const atkGain = Math.floor(victim.atk * 2.0); const hpGain = Math.floor(victim.maxHP * 2.0);
          addLog(`💀 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.card.name}</span> <span class="log-skill">Devour the Weak</span> → ${victim.name} (ATK ${victim.atk})`);
          
          battlefieldEl?.classList.add('anim-tyrant-shake'); delayRemove(() => battlefieldEl?.classList.remove('anim-tyrant-shake'), 900);
          const ov2 = document.createElement('div'); ov2.className = 'tyrant-overlay'; document.body.appendChild(ov2);
          const dt = document.createElement('div'); dt.className = 'devour-title'; document.body.appendChild(dt);
          dt.innerHTML = `<span class="title-main">💀 DEVOURED</span><span class="title-sub">${victim.name} — Consumed</span><div class="title-skulls">💀⚔️💀</div>`;
          delayRemove(() => ov2.remove(), 2100); delayRemove(() => dt.remove(), 2300); await sleep(500);

          applyDamage(victim, victim.hp, tSlot, !ctx.isPlayer, "skill"); await checkDeaths(); markDirty(); flushBoard(); await sleep(300);

          ctx.card._displayATK = ctx.card.atk; ctx.card._displayHP = ctx.card.hp;
          ctx.card.atk = Number(ctx.card.atk) + atkGain; ctx.card.maxHP += hpGain; ctx.card.hp = Math.min(ctx.card.maxHP, ctx.card.hp + hpGain);
          const au = document.createElement('div'); au.className = 'buff-aura'; ctx.cardSlot.appendChild(au); delayRemove(() => au.remove(), 700);
          showFloat(`💀 ATK+${atkGain}/HP+${hpGain}`, ctx.cardSlot, "skill"); markDirty(); flushBoard(); await sleep(600);

          // 🐞 Fix 6: ป้องกัน Infinite Loop เวลามี Chain Skills เรียก executeAttack
          if (ctx.card && ctx.card.hp > 0 && !ctx.card.isExecutingAttack) {
            try {
              ctx.card.isExecutingAttack = true;
              showFloat("⚡ INSTANT ATTACK!", ctx.cardSlot, "skill");
              await executeAttack(ctx.card, getMyBoard(!ctx.isPlayer)[ctx.idx], ctx.idx, ctx.isPlayer);
              await checkDeaths(); markDirty(); flushBoard(); await sleep(300);
            } finally {
              ctx.card.isExecutingAttack = false;
            }
          }
        }
      }
    }
  },

  // ── 🪦 สกิลหมวดความตาย (Death Resolution Hooks) ──
  "Ashen Rebirth": {
    priority: 100, 
    onDeath: async (ctx) => {
      if (ctx.card.hasRevived || ctx.card.unrevivable) return;
      ctx.card.hasRevived = true; ctx.card.isDying = false; ctx.preventDeath = true; 
      ctx.card._displayHP = ctx.card.hp; ctx.card._displayATK = ctx.card.atk; 
      ctx.card.hp = Math.floor(ctx.card.maxHP * 0.45); ctx.card.atk = Number(ctx.card.atk) + Math.floor(ctx.card.baseATK * 0.2); ctx.card.reviveBuffTurns = 2;
      if (combatStats[ctx.card.uid]) combatStats[ctx.card.uid].heal += ctx.card.hp;
      showFloat("REBIRTH!", ctx.mySlots[ctx.idx], "skill"); 
      addLog(`🔥 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.card.name}</span> คืนชีพ!`);
    }
  },
  "Grave Contract": {
    priority: 80,
    onDeath: async (ctx) => {
      if (ctx.card.graveContractUsed) return;
      ctx.card.graveContractUsed = true;
      addLog(`📜 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.card.name}</span> <span class="log-skill">Grave Contract</span>`);
      let grave = ctx.isPlayer ? playerGraveyard : enemyGraveyard;

      let targets = TargetResolver.resolve(ctx.myBoard, ctx.mySlots, "ally_except_self", 0, ctx.idx);
      for (let t of targets) {
        t.card.hp += 500; if (combatStats[ctx.card.uid]) combatStats[ctx.card.uid].heal += 500;
        showFloat("+500", t.slot, "heal");
        const sr = getEffectRect(t.slot);
        const pillar = document.createElement('div'); pillar.className = 'battle-vfx grave-contract-pillar';
        pillar.style.cssText = `left:${sr.left + sr.width/2 - 35}px;bottom:${window.innerHeight - sr.bottom}px;height:${180 + Math.random()*60}px;--pillar-delay:${t.index * 0.1}s;`;
        document.body.appendChild(pillar); delayRemove(() => pillar.remove(), 1700);
        for (let so = 0; so < 3; so++) {
          const orb = document.createElement('div'); orb.className = 'battle-vfx grave-soul-orb';
          orb.style.cssText = `width:${10+Math.random()*8}px;height:${10+Math.random()*8}px;left:${sr.left + sr.width/2 + (Math.random()-0.5)*40}px;top:${sr.top + sr.height/2}px;--gs-x:${(Math.random()-0.5)*80}px;--gs-y:${-(100+Math.random()*80)}px;--gs-dur:${1.2+Math.random()*0.4}s;--gs-delay:${t.index*0.1+so*0.1}s;`;
          document.body.appendChild(orb); delayRemove(() => orb.remove(), 2000);
        }
      }

      let validGrave = grave.filter(g => !g.name.includes("Chronovex") && !g.unrevivable);
      if (validGrave.length > 0) {
        validGrave.sort((a, b) => b.baseATK - a.baseATK);
        let rv = validGrave[0];
        grave.splice(grave.indexOf(rv), 1);
        
        rv.hp = rv.maxHP; rv.atk = Math.floor(rv.baseATK * 1.2); rv.isSummoned = true;
        Object.assign(rv, getCombatStateDefaults(rv), { burnTurns: 0, corruptTurns: 0 }); rv._initialized = true; 
        let em = ctx.myBoard.indexOf(null);
        if (em !== -1) { ctx.myBoard[em] = rv; if (combatStats[ctx.card.uid]) combatStats[ctx.card.uid].heal += rv.maxHP; showFloat("REVIVED!", ctx.mySlots[em], "skill"); addLog(`✨ ชุบชีวิต ${rv.name}`); }
      }
    }
  },
  "Echoes of Oblivion": {
    priority: 50,
    onDeath: async (ctx) => {
      let targets = TargetResolver.resolve(ctx.oppBoard, ctx.oppSlots, "all", 0);
      if (ctx.card.echoesUsed || targets.length === 0) return;
      ctx.card.echoesUsed = true;
      
      let cnt = (playerGraveyard.length + enemyGraveyard.length) * 0.12;
      let gCopy = [...playerGraveyard, ...enemyGraveyard]; 
      let wDmg = 0;
      for (let w = 0; w < 3 && gCopy.length > 0; w++) { let ri = Math.floor(Math.random() * gCopy.length); wDmg += gCopy[ri].baseATK * 0.5; gCopy.splice(ri, 1); }
      let vDmg = Math.min(Math.floor(ctx.card.baseATK * cnt + wDmg), 500);
      addLog(`🌌 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.card.name}</span> <span class="log-skill">Echoes of Oblivion</span> <span class="log-dmg">${vDmg} AOE</span>`);
      
      for (let t of targets) { 
        applyDamage(t.card, vDmg, t.slot, !ctx.isPlayer, "echoes", ctx.card); 
        if (t.card.hp > 0 && t.card.hp < t.card.maxHP * 0.2) { 
           applyDamage(t.card, t.card.hp, t.slot, !ctx.isPlayer, "skill"); 
           showFloat("INSTANT KILL!", t.slot, "skill", t.index * FLOAT_STAGGER_MS); 
        } 
      }
    }
  },
  "Cataclysm Singularity": {
    priority: 40,
    onDeath: async (ctx) => {
      let targets = TargetResolver.resolve(ctx.oppBoard, ctx.oppSlots, "all", 0);
      if (targets.length === 0) return;
      const cataDmg = Math.floor((ctx.card.baseATK || ctx.card.atk) * 2.0);
      addLog(`☄️ <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.card.name}</span> <span class="log-skill">Cataclysm Singularity!</span> <span class="log-dmg">AOE ${cataDmg} + Decay MaxHP -20%</span>`);
      (() => {
        battlefieldEl?.classList.add('anim-screen-shake'); delayRemove(() => battlefieldEl?.classList.remove('anim-screen-shake'), 900);
        const ov = document.createElement('div'); ov.className = 'battle-vfx singularity-overlay'; document.body.appendChild(ov); delayRemove(() => ov.remove(), 3100);
        const ttl = document.createElement('div'); ttl.className = 'battle-vfx singularity-title'; ttl.innerHTML = `<span class="st-main">☄️ CATACLYSM SINGULARITY</span><span class="st-sub">— Void Gate Opened —</span>`; document.body.appendChild(ttl); delayRemove(() => ttl.remove(), 3200);
        const sRect = getEffectRect(ctx.mySlots[ctx.idx]);
        if (sRect) {
          const cx = sRect.left + sRect.width / 2, cy = sRect.top + sRect.height / 2;
          const core = document.createElement('div'); core.className = 'battle-vfx singularity-core'; core.style.cssText = `width:120px;height:120px;left:${cx - 60}px;top:${cy - 60}px;`; document.body.appendChild(core); delayRemove(() => core.remove(), 2900);
          [0, 0.2, 0.4].forEach((d, idx) => { const ring = document.createElement('div'); ring.className = 'battle-vfx singularity-ring'; ring.style.cssText = `left:${cx}px;top:${cy}px;--sr-delay:${d}s;--sr-dur:${1.4 + idx*0.15}s;`; document.body.appendChild(ring); delayRemove(() => ring.remove(), (2.0 + d) * 1000); });
        }
      })();
      for (let t of targets) {
        const fl = document.createElement('div'); fl.className = 'battle-vfx singularity-decay-flash'; t.slot.style.position = 'relative'; t.slot.appendChild(fl);
        applyDamage(t.card, cataDmg, t.slot, !ctx.isPlayer, "singularity", ctx.card);
        const decay = Math.floor(t.card.maxHP * 0.2); t.card.maxHP = Math.max(1, t.card.maxHP - decay); t.card.hp = Math.min(t.card.hp, t.card.maxHP);
        showFloat(`💀 MaxHP -${decay}`, t.slot, "skill", t.index * 100); delayRemove(() => fl?.remove(), 1300);
      }
    }
  },
  "Final Judgement": {
    priority: 30,
    onDeath: async (ctx) => {
      let targets = TargetResolver.resolve(ctx.oppBoard, ctx.oppSlots, "highest_atk", 1);
      if (targets.length > 0) {
        let tgt = targets[0].card; let tSlot = targets[0].slot;
        tgt.unrevivable = true; tgt.immortalTurns = 0; applyDamage(tgt, tgt.hp, tSlot, !ctx.isPlayer, "skill");
        tSlot.style.position = 'relative'; let cardEl = tSlot.querySelector('.card');
        battlefieldEl?.classList.add('anim-screen-shake'); delayRemove(() => battlefieldEl?.classList.remove('anim-screen-shake'), 600);
        const fjOverlay = document.createElement('div'); fjOverlay.className = 'battle-vfx fj-overlay'; document.body.appendChild(fjOverlay); delayRemove(() => fjOverlay.remove(), 1900);
        const fjTitle = document.createElement('div'); fjTitle.className = 'battle-vfx fj-title'; fjTitle.innerHTML = `<span class="fjt-main">⚰️ FINAL JUDGEMENT</span><span class="fjt-sub">— Void Sentence —</span>`; document.body.appendChild(fjTitle); delayRemove(() => fjTitle.remove(), 2300);
        let vortex = document.createElement('div'); vortex.className = 'blackhole-vortex'; tSlot.appendChild(vortex);
        let particles = document.createElement('div'); particles.className = 'blackhole-particles'; tSlot.appendChild(particles);
        if (cardEl) cardEl.classList.add('anim-sucked-in');
        setTimeout(() => { vortex.remove(); particles.remove(); if (cardEl) cardEl.classList.remove('anim-sucked-in'); }, 1500);
        showFloat("🌀 VOIDED!", tSlot, "skill"); showFloat("❌ UNREVIVABLE", tSlot, "dmg", 300); 
        addLog(`⚰️ <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ctx.card.name}</span> <span class="log-skill">Final Judgement</span> ดูด ${tgt.name} หายไปในหลุมดำมิติ! (ชุบไม่ได้)`);
      }
    }
  },
  "Soul Nova": {  
    priority: 20,
    onDeath: async (ctx) => {
      let xd = Math.floor(ctx.card.parentATK * 0.5);
      let targets = TargetResolver.resolve(ctx.oppBoard, ctx.oppSlots, "highest_hp", 1);
      if (targets.length > 0) {
         let t = targets[0];
         addLog(`💥 โคลนระเบิดใส่ ${t.card.name}`); 
         applyDamage(t.card, xd, t.slot, !ctx.isPlayer, "soul_nova", ctx.card); 
      }
    }
  },
  "Abyss Devour": {
    priority: 80,
    onAllyDeath: async (ctx) => {
      let ally = ctx.card;
      if ((ally.devourStacks || 0) >= 8) return;
      ally.devourStacks = (ally.devourStacks || 0) + 1;
      const healAmt = Math.floor(ally.maxHP * 0.1);
      ally._displayHP = ally.hp; ally._displayATK = ally.atk; 
      ally.hp = Math.min(ally.maxHP, ally.hp + healAmt);
      ally.baseATK = ally.baseATK || ally.atk; ally.atk = Number(ally.atk) + 40;
      if (combatStats[ally?.uid]) combatStats[ally?.uid].heal += healAmt;
      
      const dRect = getEffectRect(ctx.observerSlot); const deadSRect = getEffectRect(ctx.deadSlot);
      if (deadSRect && dRect) {
        const orb = document.createElement('div'); orb.className = 'battle-vfx devour-orb';
        const sz = 14; const tx = dRect.left + dRect.width/2 - (deadSRect.left + deadSRect.width/2); const ty = dRect.top  + dRect.height/2 - (deadSRect.top  + deadSRect.height/2);
        orb.style.cssText = `width:${sz}px;height:${sz}px;left:${deadSRect.left + deadSRect.width/2 - sz/2}px;top:${deadSRect.top + deadSRect.height/2 - sz/2}px;--do-tx:${tx}px;--do-ty:${ty}px;--do-delay:0s;--do-dur:0.75s;`;
        document.body.appendChild(orb); delayRemove(() => orb.remove(), 900);
      }
      showFloat(`🕳 +${healAmt}HP / ATK+40`, ctx.observerSlot, "heal");
      addLog(`🕳 <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${ally.name}</span> <span class="log-skill">Abyss Devour</span> (${ally.devourStacks}/8) ฮีล +${healAmt} ATK→${ally.atk}`);
    }
  },
  "Power from the Fallen": {
    priority: 80,
    onEnemyDeath: async (ctx) => {
      let killer = ctx.card;
      killer._displayATK = killer.atk; killer._displayHP = killer.hp;
      const atkBonus = Math.floor(Number(killer.atk) * 0.2); const healAmt  = Math.floor(killer.maxHP * 0.15);
      killer.atk = Number(killer.atk) + atkBonus; killer.hp  = Math.min(killer.maxHP, killer.hp + healAmt);
      if (combatStats[killer?.uid]) combatStats[killer?.uid].heal += healAmt;
      showFloat(`⚡ ATK+${atkBonus}/+${healAmt}HP`, ctx.observerSlot, "skill");
      addLog(`⚡ <span class="${ctx.isPlayer ? 'log-player' : 'log-enemy'}">${killer.name}</span> <span class="log-skill">Power from the Fallen</span>: ATK→${killer.atk}`);
    }
  }
};

async function triggerSkillEvent(eventName, entity, context) {
  if (!entity || !entity.skills) return;
  
  // 🐞 Fix 1: อนุญาตให้ event ทำงานได้ถ้ามีการ์ดป้องกันความตาย (preventDeath) หรือ มีสถานะอมตะ (immortalTurns) 
  if (eventName !== 'onDeath' && eventName !== 'onAllyDeath' && eventName !== 'onEnemyDeath') {
    if (entity.hp <= 0 && !context.preventDeath && !(entity.immortalTurns > 0)) return;
  }
  
  let skillDefs = entity.skills
    .map(s => SKILL_REGISTRY[s.id] || SKILL_REGISTRY[s.name])
    .filter(Boolean)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (let skillDef of skillDefs) {
    if (typeof skillDef[eventName] === "function") {
      // 🛡️ Error Boundary: ถ้าสกิลนี้เขียนพัง จะไม่ทำเกมค้าง!
      try {
        await skillDef[eventName](context);
      } catch (err) {
        console.error(`[SkillEngine Error] สกิลพังที่การ์ด: ${entity.name}, Event: ${eventName}`, err);
      }
      
      if (context.preventDeath && eventName === 'onDeath') break;
    }
  }
}