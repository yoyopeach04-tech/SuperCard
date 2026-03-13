// ============================================================
// ⚙️ SKILL ENGINE (UNIVERSAL API ARCHITECTURE) v6.0
// ============================================================

const FLOAT_STAGGER_MS = 80;
const delayRemove = (typeof sd !== 'undefined') ? sd : (fn, ms) => setTimeout(fn, ms / gameSpeed); 

// 🎬 1. EFFECT ENGINE (VFX Manager รวมศูนย์)
const EffectEngine = {
  play(className, parent, duration, cssText = '') {
    if (!parent) return null;
    const el = document.createElement('div');
    el.className = `battle-vfx ${className}`;
    if (cssText) el.style.cssText = cssText;
    parent.appendChild(el);
    if (duration) delayRemove(() => el.remove(), duration);
    return el;
  },
  shake(type = 'anim-screen-shake', duration = 700) {
    if (typeof battlefieldEl !== 'undefined' && battlefieldEl) {
      battlefieldEl.classList.add(type);
      delayRemove(() => battlefieldEl.classList.remove(type), duration);
    }
  },
  title(main, sub, duration = 2000) {
    const ttl = document.createElement('div');
    ttl.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99995;pointer-events:none;text-align:center;animation:bloodTitleAnim 2s ease-out forwards;";
    ttl.innerHTML = `<span style="display:block;font-size:3.5rem;font-weight:900;color:#fff;text-shadow:0 0 20px #ff0000,0 0 50px #ff0000,4px 4px 0 #660000;-webkit-text-stroke:2px #ff4400">${main}</span><span style="display:block;font-size:1.5rem;color:#ddd;margin-top:10px;">${sub}</span>`;
    document.body.appendChild(ttl);
    delayRemove(() => ttl.remove(), duration);
  },
  beam(srcSlot, dstSlot, className, duration = 700) {
    // 🐛 [Fix] ป้องกันการช็อตถ้าไม่มีช่องการ์ดให้วาดแสง
    if (!srcSlot || !dstSlot) return; 
    try {
      const sr = typeof getEffectRect === 'function' ? getEffectRect(srcSlot) : srcSlot.getBoundingClientRect();
      const dr = typeof getEffectRect === 'function' ? getEffectRect(dstSlot) : dstSlot.getBoundingClientRect();
      if (!sr || !dr) return;
      const sx = sr.left + sr.width/2, sy = sr.top + sr.height/2;
      const dx = dr.left + dr.width/2, dy = dr.top + dr.height/2;
      const len = Math.hypot(dx - sx, dy - sy), ang = Math.atan2(dy - sy, dx - sx) * 180 / Math.PI;
      this.play(className, document.body, duration, `left:${sx}px;top:${sy}px;width:${len}px;transform:rotate(${ang}deg);transform-origin:0 50%;position:fixed;z-index:9999;`);
    } catch(err) { console.error("Beam Effect Error", err); }
  }
};

// 🧩 2. SKILL API (ตัวกลางจัดการ Logic เกม)
const SkillAPI = {
  damage(target, amount, slot, isTargetPlayer, sourceType, attacker) {
    if (!target || target.hp <= 0) return 0;
    
    // ✅ ตัด slot ออก เพื่อส่งแค่ 5 Params ให้ตรงกับ applyDamage
    let actualDmg = window.gameEngine.applyDamage(target, amount, isTargetPlayer, sourceType, attacker);
    
    // ✅ นำ showFloat มาทำตรงนี้แทน เพื่อไม่ให้บัคตัวเลขลอยหาย
    if (actualDmg > 0 && slot && !["blood_nova", "tyrant", "burn", "echoes", "singularity"].includes(sourceType)) {
        showFloat(`-${actualDmg}`, slot, "dmg");
    }
    return actualDmg;
  },
  // ... (ฟังก์ชันอื่นๆ คงเดิม)
  heal(target, amount, slot, healer, showMsg = true) {
    if (!target || target.hp <= 0) return 0;
    let mHP = (target.maxHP || target.hp) - target.hp;
    if (mHP <= 0) return 0;
    let actual = Math.min(mHP, amount);
    target._displayHP = target.hp; target.hp += actual;
    if (healer?.uid && combatStats[healer.uid]) combatStats[healer.uid].heal += actual;
    if (showMsg && slot) showFloat(`+${actual}`, slot, "heal");
    markDirty(); return actual;
  },
  buff(target, stat, amount, slot, showMsg = true) {
    if (!target || target.hp <= 0) return;
    target[`_display${stat.toUpperCase()}`] = target[stat];
    target[stat] = Number(target[stat]) + amount;
    let prefix = amount >= 0 ? '+' : '';
    if (showMsg && slot) showFloat(`${stat.toUpperCase()}${prefix}${amount}`, slot, amount >= 0 ? "skill" : "dmg");
    markDirty();
  },
  addStatus(target, status, turns, slot, floatMsg = null) {
    if (!target || target.hp <= 0) return;
    target.status[status] = (target.status[status] || 0) + turns;
    if (floatMsg && slot) showFloat(floatMsg, slot, "skill");
    markDirty();
  },
  log(msg) { addLog(msg); },
  getName(card, isPlayer) { return `<span class="${isPlayer ? 'log-player' : 'log-enemy'}">${card.name}</span>`; }
};

// 🎯 3. TARGET RESOLVER (เรดาร์ค้นหาเป้าหมาย)
const TargetResolver = {
  getSlots(board) {
    if (board === window.engineState.p1.board) return document.querySelectorAll('.player-board .card-slot');
    if (board === window.engineState.p2.board) return document.querySelectorAll('.enemy-board .card-slot');
    return [];
  },
  resolve(board, slots, criteria, count = 0, excludeIdx = -1) {
    const actualSlots = (slots && slots.length > 0) ? slots : this.getSlots(board);
    let valid = board.map((c, i) => ({ card: c, index: i, slot: actualSlots[i] })).filter(t => t.card && t.card.hp > 0);
    if (criteria === "ally_except_self" || excludeIdx !== -1) valid = valid.filter(t => t.index !== excludeIdx);
    if (valid.length === 0) return [];

    switch(criteria) {
      case "lowest_atk":         valid.sort((a,b) => a.card.atk - b.card.atk); break;
      case "highest_atk":        valid.sort((a,b) => b.card.atk - a.card.atk); break;
      case "lowest_hp":          valid.sort((a,b) => a.card.hp - b.card.hp); break;
      case "highest_hp":         valid.sort((a,b) => b.card.hp - a.card.hp); break;
      case "highest_missing_hp": valid.sort((a,b) => ((b.card.maxHP||b.card.hp)-b.card.hp) - ((a.card.maxHP||a.card.hp)-a.card.hp)); break;
      case "random":             valid.sort(() => Math.random() - 0.5); break;
    }
    return count > 0 ? valid.slice(0, count) : valid;
  },
  getAdjacent(board, slots, index) {
    const actualSlots = (slots && slots.length > 0) ? slots : this.getSlots(board);
    let res = [];
    if (index > 0 && board[index - 1] && board[index - 1].hp > 0) res.push({ card: board[index - 1], index: index - 1, slot: actualSlots[index - 1] });
    if (index < board.length - 1 && board[index + 1] && board[index + 1].hp > 0) res.push({ card: board[index + 1], index: index + 1, slot: actualSlots[index + 1] });
    return res;
  }
};

// 📦 4. SKILL REGISTRY (ฐานข้อมูลสกิลที่สะอาดกริ๊บ! ตัดขาดจากบัค UI 100%)
const SKILL_REGISTRY = {
  "หลบหลีก": {
    priority: 100,
    onBeforeDefend: async (ctx) => {
      if (Math.random() > 0.5) { 
        let dSlot = TargetResolver.getSlots(ctx.oppBoard)[ctx.idx];
        if (window.showFloat) window.showFloat("Miss!", dSlot, "skill"); 
        SkillAPI.log(`💨 ${SkillAPI.getName(ctx.attacker, ctx.isPlayer)} ตีวืด!`); 
        ctx.attackMissed = true;
      }
    }
  },
  "พ่นไฟ": {
    priority: 50,
    onBeforeAttack: async (ctx) => {
      let aSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      let dSlot = TargetResolver.getSlots(ctx.oppBoard)[ctx.idx];
      EffectEngine.play(`fireball anim-fireball-${ctx.isPlayer ? 'up' : 'down'}`, aSlot, 400); await sleep(400);
      if (ctx.defender && ctx.defender.hp > 0 && !(ctx.defender.status?.shadow > 0)) { 
        SkillAPI.damage(ctx.defender, 100, dSlot, !ctx.isPlayer, "skill", ctx.attacker); 
      } else { 
        SkillAPI.damageHero(!ctx.isPlayer, 100, ctx.attacker); 
      }
      await sleep(400); 
    }
  },
  "คลุ้มคลั่ง": {
    priority: 50,
    onAttackSwing: async (ctx) => {
      let aSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      SkillAPI.buff(ctx.attacker, 'atk', 50, aSlot, "ATK +50");
      ctx.damage += 50; 
    }
  },
  "เจาะเกราะ": {
    priority: 50,
    onAttackHit: async (ctx) => {
      if (ctx.actualDmg > 0) {
        if (typeof ctx.spawnImpactClaw === 'function') ctx.spawnImpactClaw(ctx.targetHero); 
        SkillAPI.damageHero(!ctx.isPlayer, Math.floor(ctx.attacker.atk / 2), ctx.attacker);
      }
    }
  },
  "สตัน": {
    priority: 50,
    onAttackHit: async (ctx) => {
      // ✅ เช็คก่อนว่า defender มีตัวตน (ไม่ได้กำลังตีหน้าฮีโร่)
      if (ctx.actualDmg > 0 && ctx.defender && ctx.defender.hp > 0) {
        ctx.defender.atk = Math.max(0, Number(ctx.defender.atk) - 50); 
        showFloat("ATK -50", ctx.defenderSlot, "skill"); 
      }
    }
  },
  "ตีกระจาย": {
    priority: 40,
    onAttackHit: async (ctx) => {
      if (ctx.actualDmg > 0) {
        let sp = Math.floor(ctx.actualDmg / 2);
        let targets = TargetResolver.getAdjacent(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), ctx.idx);
        for (let t of targets) {
          if (window.spawnImpactClaw) window.spawnImpactClaw(t.slot); 
          SkillAPI.damage(t.card, sp, t.slot, !ctx.isPlayer, "splash", ctx.attacker);
        }
      }
    }
  },
  "สะท้อน": {
    priority: 80,
    onTakeDamage: async (ctx) => {
      // ✅ เช็คก่อนว่าคนตี (attacker) ยังมีชีวิตอยู่ค่อยสะท้อนกลับ
      if (ctx.actualDmg > 0 && ctx.attacker && ctx.attacker.hp > 0) { 
        SkillAPI.log(`🛡️ ${SkillAPI.getName(ctx.defender, !ctx.isPlayer)} สะท้อน!`); 
        SkillAPI.damage(ctx.attacker, Math.floor(ctx.actualDmg / 2), ctx.attackerSlot, ctx.isPlayer, "reflect", ctx.defender); 
      }
    }
  },
  "Iron Sentinel": {
    priority: 80,
    onTakeDamage: async (ctx) => {
      if (ctx.actualDmg > 0 && ctx.defender.hp > 0) { 
        let cd = Math.floor(ctx.actualDmg * 0.4); 
        if (cd > 0) { 
          let dSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
          let aSlot = TargetResolver.getSlots(ctx.oppBoard)[ctx.idx];
          if (window.showFloat) window.showFloat(`🛡️↩${cd}`, dSlot, "skill"); 
          SkillAPI.log(`🛡️ ${SkillAPI.getName(ctx.defender, !ctx.isPlayer)} Counterstrike <span class="log-dmg">${cd}</span>`); 
          SkillAPI.damage(ctx.attacker, cd, aSlot, ctx.isPlayer, "counterstrike", ctx.defender); 
        } 
      }
    }
  },
  "Temporal Summon": {
    priority: 60,
    onBeforeAttack: async (ctx) => {
      let th = ctx.isPlayer ? window.engineState.p1.hand : window.engineState.p2.hand;
      let tb = ctx.myBoard, ts = TargetResolver.getSlots(tb); let em = tb.indexOf(null);
      let aSlot = ts[ctx.idx];
      if (em !== -1 && th.length > 0) {
        let maxW = -1, maxIdx = -1; th.forEach((c, i) => { if (c.waitTime > maxW) { maxW = c.waitTime; maxIdx = i; } });
        if (maxIdx !== -1) {
          let sc = th.splice(maxIdx, 1)[0]; 
          sc.flags = sc.flags || {}; sc.flags.isSummoned = true; sc.waitTime = 0; tb[em] = sc;
          if (window.initCard) window.initCard(tb[em]);
          tb[em].status = tb[em].status || {}; tb[em].status.physShield = true;
          
          if (window.showFloat) { window.showFloat("⏳ TEMPORAL SUMMON!", aSlot, "skill"); window.showFloat("🛡️ SHIELD", ts[em], "skill"); }
          SkillAPI.log(`⏳ ${SkillAPI.getName(ctx.attacker, ctx.isPlayer)} <span class="log-skill">Temporal Summon</span> ดึง ${sc.name} ลงสนาม!`);
          
          EffectEngine.beam(aSlot, ts[em], 'temporal-beam', 750);
          EffectEngine.play('shield-burst', ts[em], 1300, 'position:absolute;inset:0;');
          window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED); await sleep(600);
        }
      }
    }
  },
  "Shadow Protocol": {
    priority: 90,
    onTurnStart: async (ctx) => {
      let cSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      if ((ctx.card.status?.shadow || 0) > 0) {
        ctx.card.status.shadow--;
        if (ctx.card.status.shadow > 0) { 
          if (window.showFloat) window.showFloat(`👻 STEALTH(${ctx.card.status.shadow})`, cSlot, "skill"); 
          SkillAPI.log(`👻 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} ซ่อนตัว (${ctx.card.status.shadow} เทิร์น)`); 
          ctx.skipAttack = true; 
        } else { 
          ctx.card.shadowReady = true; 
          if (window.showFloat) window.showFloat("💥 SHADOW BREAK!", cSlot, "skill"); 
          SkillAPI.log(`💥 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} ออกซ่อน! โจมตีถัดไป ×2.5`); 
        }
        window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
      }
    },
    onAttackSwing: async (ctx) => {
      if (ctx.attacker.shadowReady) { 
        ctx.attacker.shadowReady = false; ctx.damage = Math.floor(ctx.damage * 2.5); ctx.shadowStrike = true; 
        let aSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
        if (window.showFloat) window.showFloat("💥 SHADOW STRIKE!", aSlot, "skill"); 
      }
    }
  },
  "Crimson Frenzy": {
    priority: 85,
    onTakeDamage: async (ctx) => {
      if (ctx.actualDmg > 0 && ctx.defender.hp > 0) {
        let aSlot = TargetResolver.getSlots(ctx.oppBoard)[ctx.idx];
        let dSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
        let da = Math.floor((ctx.attacker.atk || 0) * 0.1), dh = Math.floor((ctx.attacker.maxHP || ctx.attacker.hp) * 0.1);
        if (da > 0) SkillAPI.buff(ctx.attacker, 'atk', -da, null, false);
        if (dh > 0) SkillAPI.heal(ctx.attacker, -dh, null, null, false);
        
        SkillAPI.buff(ctx.defender, 'atk', da, null, false);
        SkillAPI.heal(ctx.defender, dh, null, null, false);
        
        if (window.showFloat) { window.showFloat(`🩸-${da}A/-${dh}H`, aSlot, "drain"); window.showFloat(`+${da}A/+${dh}H`, dSlot, "drain"); }
        ctx.defender.bloodStacks = Math.min(3, (ctx.defender.bloodStacks || 0) + 1);
        SkillAPI.log(`🩸 ${SkillAPI.getName(ctx.defender, !ctx.isPlayer)} Blood Stack (${ctx.defender.bloodStacks}/3)`);
      }
    },
    onAfterAttack: async (ctx) => {
      if (ctx.isLastAttack && (ctx.attacker.bloodStacks || 0) >= 3) {
        let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "all", 0);
        if (targets.length === 0) return;
        ctx.attacker.bloodStacks = 0;
        SkillAPI.log(`🩸 ${SkillAPI.getName(ctx.attacker, ctx.isPlayer)} <span class="log-skill">💥 BLOOD NOVA!</span> <span class="log-dmg">${ctx.attacker.atk} AOE</span>`);
        
        EffectEngine.shake(); EffectEngine.play('blood-nova-overlay', document.body, 700);
        
        for (let t of targets) {
          EffectEngine.play('blood-hit-flash', t.slot, 800, 'position:absolute;inset:0;');
          SkillAPI.damage(t.card, ctx.attacker.atk, t.slot, !ctx.isPlayer, "blood_nova", ctx.attacker);
          if (window.showFloat) window.showFloat(`💀 ${ctx.attacker.atk}`, t.slot, "dmg", t.index * FLOAT_STAGGER_MS);
        }
      }
    }
  },
  "Restoration Pulse": {
    priority: 30,
    onAfterAttack: async (ctx) => {
      let targets = TargetResolver.resolve(ctx.myBoard, TargetResolver.getSlots(ctx.myBoard), "highest_missing_hp", 1);
      if (targets.length > 0) {
        let t = targets[0], healAmt = Math.floor(ctx.attacker.atk * 1.5);
        let actual = SkillAPI.heal(t.card, healAmt, t.slot, ctx.attacker, true);
        if (actual > 0) {
          let aSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
          EffectEngine.beam(aSlot, t.slot, 'restore-beam'); EffectEngine.play('restore-ring', t.slot, 1100);
          SkillAPI.log(`💖 ${SkillAPI.getName(ctx.attacker, ctx.isPlayer)} <span class="log-skill">Restoration Pulse</span> ฮีล ${t.card.name} ${actual} HP`);
          await sleep(400);
        }
      }
    }
  },
  "ฟื้นฟู": {
    priority: 50,
    onTurnStart: async (ctx) => {
      let cSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      SkillAPI.heal(ctx.card, 100, cSlot, ctx.card, true);
    }
  },
  "Grave Domain": {
    priority: 60,
    onTurnStart: async (ctx) => {
      let cSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      if ((ctx.card.domainTurns || 0) <= 0 && !ctx.card.domainUsed) { 
        ctx.card.domainTurns = 3; ctx.card.domainUsed = true; 
        if (window.showFloat) window.showFloat("GRAVE DOMAIN", cSlot, "skill"); 
      } else if ((ctx.card.domainTurns || 0) > 0) { 
        ctx.card.domainTurns--; 
        let targets = TargetResolver.resolve(ctx.myBoard, TargetResolver.getSlots(ctx.myBoard), "all", 0);
        for (let t of targets) SkillAPI.heal(t.card, Math.floor(t.card.maxHP * 0.08), t.slot, ctx.card, true);
      }
    }
  },
  "Hunter's Aura": {
    priority: 90,
    onTurnStart: async (ctx) => {
      let cSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      const hasWeak = ctx.oppBoard.some(c => c && c.hp > 0 && (c.baseWait || 0) < 3);
      if (hasWeak && !ctx.card.hunterAuraActive) {
        ctx.card.hunterAuraActive = true; ctx.card.hunterAuraBonus = Math.floor(ctx.card.baseATK * 0.3);
        SkillAPI.buff(ctx.card, 'atk', ctx.card.hunterAuraBonus, cSlot, "🦁 HUNTER +30%");
      } else if (!hasWeak && ctx.card.hunterAuraActive) {
        ctx.card.hunterAuraActive = false; SkillAPI.buff(ctx.card, 'atk', -(ctx.card.hunterAuraBonus || 0), null, false);
        ctx.card.hunterAuraBonus = 0; 
      }
    }
  },
  "Soul Rip": {
    priority: 40,
    onTurnStart: async (ctx) => {
      if (ctx.card.soulRipUsed) return;
      let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "random", 1);
      let empties = ctx.myBoard.map((c, i) => !c ? i : -1).filter(i => i !== -1);
      
      if (targets.length > 0 && empties.length > 0) {
        ctx.card.soulRipUsed = true; let tgt = targets[0].card; let esIdx = empties[0];
        let cln = { uid: window.engineState.generateUID(), owner: ctx.card.owner, name: "Shadow of " + tgt.name.replace(/Shadow of /g, ""),
          hp: Math.floor((tgt.maxHP || tgt.hp) * 0.5), maxHP: Math.floor((tgt.maxHP || tgt.hp) * 0.5), baseHP: Math.floor((tgt.maxHP || tgt.hp) * 0.5),
          atk: Math.floor((tgt.baseATK || tgt.atk) * 1.5), baseATK: Math.floor((tgt.baseATK || tgt.atk) * 1.5),
          stars: 0, image: tgt.image, skills: [{ id: "Soul Nova", name: "💥 Soul Nova", desc: "โคลนระเบิดเป้าเดี่ยว" }], parentATK: ctx.card.atk, isClone: true, waitTime: 0, baseWait: 0, isSummoned: true, _initialized: true, status: {}, flags: {} };
        
        ctx.myBoard[esIdx] = cln; 
        if (window.showFloat) window.showFloat("Summon!", TargetResolver.getSlots(ctx.myBoard)[esIdx], "skill"); 
        SkillAPI.log(`💀 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} Soul Rip → ${cln.name}`);
      }
    }
  },
  "Temporal Acceleration": {
    priority: 50,
    onTurnStart: async (ctx) => {
      let cSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      SkillAPI.log(`⏳ ${SkillAPI.getName(ctx.card, ctx.isPlayer)} <span class="log-skill">Temporal Acceleration</span>`);
      if (window.showFloat) window.showFloat("⏳ TIME ACCEL!", cSlot, "skill"); await sleep(400);

      EffectEngine.play('time-accel-sweep', document.body, 950);
      let th = ctx.isPlayer ? window.engineState.p1.hand : window.engineState.p2.hand;
      th.forEach(c => c.waitTime = Math.max(0, c.waitTime - 1));
      window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED); await sleep(800);
      
      let has6 = ctx.myBoard.some(c => c && c.baseWait >= 6);
      let targets = TargetResolver.resolve(ctx.myBoard, TargetResolver.getSlots(ctx.myBoard), "all", 0);
      for (let t of targets) {
        EffectEngine.play('buff-aura', t.slot, 300);
        let hb = Math.floor(t.card.maxHP * 0.3), ab = Math.floor(t.card.baseATK * 0.3);
        t.card.maxHP += hb; SkillAPI.heal(t.card, hb, null, null, false);
        SkillAPI.buff(t.card, 'atk', ab, t.slot, `ATK+${ab}/HP+${hb}`);
        if (t.card.isSummoned || t.card.isClone) t.card.critChance = (t.card.critChance || 0) + 35;
        if (has6) SkillAPI.heal(t.card, Math.floor(t.card.maxHP * 0.1), t.slot, ctx.card, true); 
        await sleep(100);
      }
    }
  },
  "Void Breath": {
    priority: 30,
    onTurnStart: async (ctx) => {
      let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "all", 0);
      if (targets.length > 0) {
        const vbDmg = Math.floor(ctx.card.atk * 1.4);
        SkillAPI.log(`🌌 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} <span class="log-skill">Void Breath!</span> <span class="log-dmg">AOE ${vbDmg} + Corrupt</span>`);
        
        EffectEngine.shake(); EffectEngine.play('void-overlay', document.body, 2100);
        EffectEngine.title('🌌 VOID BREATH', '— Corrupt —', 2300); await sleep(400);

        for (let t of targets) {
          EffectEngine.play('void-hit-flash', t.slot, 900, 'position:absolute;inset:0;');
          EffectEngine.play('corrupt-stain', t.slot, 3000);
          SkillAPI.damage(t.card, vbDmg, t.slot, !ctx.isPlayer, "void_breath", ctx.card);
          SkillAPI.addStatus(t.card, "corrupt", 2, t.slot, "🌌 CORRUPT");
          await sleep(FLOAT_STAGGER_MS);
        }
      }
    }
  },
  "Airstrike Omega": {
    priority: 25,
    onTurnStart: async (ctx) => {
      if (ctx.skipAttack) return;
      let cSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      ctx.card.airstrikeCharge = (ctx.card.airstrikeCharge || 0) + 1;
      if (window.showFloat) window.showFloat(`🚀 ${ctx.card.airstrikeCharge}/3`, cSlot, "skill"); 
      window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
      
      if (ctx.card.airstrikeCharge >= 3) {
        let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "all", 0);
        if (targets.length === 0) return;
        ctx.card.airstrikeCharge = 0; 
        
        let aoeDmg = Math.floor(ctx.card.atk * 1.6);
        EffectEngine.shake(); EffectEngine.play('airstrike-flash', document.body, 1500);
        EffectEngine.title('🚀 AIRSTRIKE OMEGA', '— AOE Annihilation —');
        SkillAPI.log(`🚀 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} Airstrike Omega! <span class="log-dmg">${aoeDmg} AOE ทะลุเกราะ + Burn</span>`);
        await sleep(400);
        
        for (let t of targets) {
           SkillAPI.damage(t.card, aoeDmg, t.slot, !ctx.isPlayer, "airstrike", ctx.card); 
           SkillAPI.addStatus(t.card, "burn", 2, t.slot, "🔥 BURN");
           await sleep(FLOAT_STAGGER_MS); 
        }
      }
    }
  },
  "Devour the Weak": {
    priority: 85,
    onTurnStart: async (ctx) => {
      if (ctx.card.tyrantEntryDone) return;
      ctx.card.tyrantEntryDone = true; 
      let targets = TargetResolver.resolve(ctx.oppBoard, ctx.oppSlots, "lowest_atk", 1);
      
      if (targets.length > 0) {
        const victim = targets[0].card; const tSlot = targets[0].slot;
        const atkGain = Math.floor(victim.atk * 2.0); const hpGain = Math.floor(victim.maxHP * 2.0);
        SkillAPI.log(`💀 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} <span class="log-skill">Devour the Weak</span> → ${victim.name} (ATK ${victim.atk})`);
        
        EffectEngine.shake('anim-tyrant-shake');
        EffectEngine.play('tyrant-overlay', document.body, 2100);
        EffectEngine.title('💀 DEVOURED', `${victim.name} — Consumed`, 2300);
        await sleep(500);

        SkillAPI.damage(victim, victim.hp, tSlot, !ctx.isPlayer, "skill", ctx.card); 
        await window.gameEngine.checkDeaths(); await sleep(300); // ✅ เติม window.gameEngine

        ctx.card.maxHP += hpGain; 
        SkillAPI.heal(ctx.card, hpGain, null, null, false);
        SkillAPI.buff(ctx.card, 'atk', atkGain, ctx.cardSlot, `💀 ATK+${atkGain}/HP+${hpGain}`);
        EffectEngine.play('buff-aura', ctx.cardSlot, 700);
        await sleep(600);

        if (ctx.card && ctx.card.hp > 0 && !ctx.card.isExecutingAttack) {
          try {
            ctx.card.isExecutingAttack = true;
            showFloat("⚡ INSTANT ATTACK!", ctx.cardSlot, "skill");
            // ✅ เติม window.gameEngine
            await window.gameEngine.executeAttack(ctx.card, getOppBoard(ctx.isPlayer)[ctx.idx], ctx.idx, ctx.isPlayer);
            await window.gameEngine.checkDeaths(); // ✅ เติม window.gameEngine
          } finally { ctx.card.isExecutingAttack = false; }
        }
      }
    }
  },
  // ── 🪦 สกิลหมวดความตาย ──
  "Ashen Rebirth": {
    priority: 100, 
    onDeath: async (ctx) => {
      if (ctx.card.flags?.hasRevived || ctx.card.flags?.unrevivable) return;
      ctx.card.flags = ctx.card.flags || {}; ctx.card.flags.hasRevived = true; ctx.card.flags.isDying = false; ctx.preventDeath = true; 
      
      let reviveHP = Math.floor(ctx.card.maxHP * 0.45);
      SkillAPI.heal(ctx.card, reviveHP, null, ctx.card, false);
      
      let cSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      SkillAPI.buff(ctx.card, 'atk', Math.floor(ctx.card.baseATK * 0.2), cSlot, "REBIRTH!");
      ctx.card.status = ctx.card.status || {}; ctx.card.status.reviveBuff = 2;
      
      SkillAPI.log(`🔥 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} คืนชีพ!`);
    }
  },
  "Grave Contract": {
    priority: 80,
    onDeath: async (ctx) => {
      if (ctx.card.flags?.graveContractUsed) return;
      ctx.card.flags = ctx.card.flags || {}; ctx.card.flags.graveContractUsed = true;
      SkillAPI.log(`📜 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} <span class="log-skill">Grave Contract</span>`);
      
      let targets = TargetResolver.resolve(ctx.myBoard, TargetResolver.getSlots(ctx.myBoard), "ally_except_self", 0, ctx.idx);
      for (let t of targets) SkillAPI.heal(t.card, 500, t.slot, ctx.card, true);

      let grave = ctx.isPlayer ? window.engineState.p1.graveyard : window.engineState.p2.graveyard;
      let validGrave = grave.filter(g => !g.name.includes("Chronovex") && !g.flags?.unrevivable);
      if (validGrave.length > 0) {
        validGrave.sort((a, b) => b.baseATK - a.baseATK); let rv = validGrave[0]; grave.splice(grave.indexOf(rv), 1);
        
        rv.hp = rv.maxHP; rv.atk = Math.floor(rv.baseATK * 1.2); 
        rv.flags = rv.flags || {}; rv.flags.isSummoned = true;
        rv.status = rv.status || {}; rv.status.burn = 0; rv.status.corrupt = 0; rv.flags._initialized = true; 
        
        let em = ctx.myBoard.indexOf(null);
        if (em !== -1) { 
          ctx.myBoard[em] = rv; let cSlot = TargetResolver.getSlots(ctx.myBoard)[em];
          if (window.showFloat) window.showFloat("REVIVED!", cSlot, "skill"); 
          SkillAPI.log(`✨ ชุบชีวิต ${rv.name}`); 
        }
      }
    }
  },
  "Echoes of Oblivion": {
    priority: 50,
    onDeath: async (ctx) => {
      let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "all", 0);
      if (ctx.card.flags?.echoesUsed || targets.length === 0) return;
      ctx.card.flags = ctx.card.flags || {}; ctx.card.flags.echoesUsed = true;
      
      let p1Grave = window.engineState.p1.graveyard, p2Grave = window.engineState.p2.graveyard;
      let cnt = (p1Grave.length + p2Grave.length) * 0.12, gCopy = [...p1Grave, ...p2Grave], wDmg = 0;
      for (let w = 0; w < 3 && gCopy.length > 0; w++) { let ri = Math.floor(Math.random() * gCopy.length); wDmg += gCopy[ri].baseATK * 0.5; gCopy.splice(ri, 1); }
      let vDmg = Math.min(Math.floor(ctx.card.baseATK * cnt + wDmg), 500);
      SkillAPI.log(`🌌 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} Echoes of Oblivion <span class="log-dmg">${vDmg} AOE</span>`);
      
      for (let t of targets) { 
        SkillAPI.damage(t.card, vDmg, t.slot, !ctx.isPlayer, "echoes", ctx.card); 
        if (t.card.hp > 0 && t.card.hp < t.card.maxHP * 0.2) { 
           SkillAPI.damage(t.card, t.card.hp, t.slot, !ctx.isPlayer, "skill", ctx.card); 
           if (window.showFloat) window.showFloat("INSTANT KILL!", t.slot, "skill", t.index * FLOAT_STAGGER_MS); 
        } 
      }
    }
  },
  "Cataclysm Singularity": {
    priority: 40,
    onDeath: async (ctx) => {
      let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "all", 0);
      if (targets.length === 0) return;
      const cataDmg = Math.floor((ctx.card.baseATK || ctx.card.atk) * 2.0);
      SkillAPI.log(`☄️ ${SkillAPI.getName(ctx.card, ctx.isPlayer)} Cataclysm Singularity! AOE ${cataDmg} + MaxHP -20%`);
      
      EffectEngine.shake(); EffectEngine.play('singularity-overlay', document.body, 3100);
      EffectEngine.title('☄️ CATACLYSM SINGULARITY', '— Void Gate Opened —', 3200);

      for (let t of targets) {
        EffectEngine.play('singularity-decay-flash', t.slot, 1300, 'position:absolute;inset:0;');
        SkillAPI.damage(t.card, cataDmg, t.slot, !ctx.isPlayer, "singularity", ctx.card);
        const decay = Math.floor(t.card.maxHP * 0.2); 
        t.card.maxHP = Math.max(1, t.card.maxHP - decay); t.card.hp = Math.min(t.card.hp, t.card.maxHP);
        if (window.showFloat) window.showFloat(`💀 MaxHP -${decay}`, t.slot, "skill", t.index * 100);
      }
    }
  },
  "Final Judgement": {
    priority: 30,
    onDeath: async (ctx) => {
      let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "highest_atk", 1);
      if (targets.length > 0) {
        let tgt = targets[0].card; let tSlot = targets[0].slot;
        tgt.flags = tgt.flags || {}; tgt.flags.unrevivable = true; 
        tgt.status = tgt.status || {}; tgt.status.immortal = 0; 
        SkillAPI.damage(tgt, tgt.hp, tSlot, !ctx.isPlayer, "skill", ctx.card);
        
        EffectEngine.shake(); EffectEngine.play('fj-overlay', document.body, 1900);
        EffectEngine.title('⚰️ FINAL JUDGEMENT', '— Void Sentence —', 2300);
        
        if (window.showFloat) { window.showFloat("🌀 VOIDED!", tSlot, "skill"); window.showFloat("❌ UNREVIVABLE", tSlot, "dmg", 300); }
        SkillAPI.log(`⚰️ ${SkillAPI.getName(ctx.card, ctx.isPlayer)} Final Judgement ดูด ${tgt.name} หายไปในหลุมดำมิติ!`);
      }
    }
  },
  "Soul Nova": {  
    priority: 20,
    onDeath: async (ctx) => {
      let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "highest_hp", 1);
      if (targets.length > 0) {
         let t = targets[0];
         SkillAPI.log(`💥 โคลนระเบิดใส่ ${t.card.name}`); 
         SkillAPI.damage(t.card, Math.floor(ctx.card.parentATK * 0.5), t.slot, !ctx.isPlayer, "soul_nova", ctx.card); 
      }
    }
  },
  "Abyss Devour": {
    priority: 80,
    onAllyDeath: async (ctx) => {
      let ally = ctx.card;
      if ((ally.status?.devourStacks || 0) >= 8) return;
      ally.status = ally.status || {}; ally.status.devourStacks = (ally.status.devourStacks || 0) + 1;
      
      const healAmt = Math.floor(ally.maxHP * 0.1);
      let oSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      SkillAPI.heal(ally, healAmt, null, ally, false);
      SkillAPI.buff(ally, 'atk', 40, oSlot, `🕳 +${healAmt}HP / ATK+40`);
      
      SkillAPI.log(`🕳 ${SkillAPI.getName(ally, ctx.isPlayer)} Abyss Devour (${ally.status.devourStacks}/8) ฮีล +${healAmt} ATK→${ally.atk}`);
    }
  },
  "Power from the Fallen": {
    priority: 80,
    onEnemyDeath: async (ctx) => {
      let killer = ctx.card;
      const atkBonus = Math.floor(Number(killer.atk) * 0.2); const healAmt  = Math.floor(killer.maxHP * 0.15);
      let oSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      
      SkillAPI.heal(killer, healAmt, null, killer, false);
      SkillAPI.buff(killer, 'atk', atkBonus, oSlot, `⚡ ATK+${atkBonus}/+${healAmt}HP`);
      SkillAPI.log(`⚡ ${SkillAPI.getName(killer, ctx.isPlayer)} Power from the Fallen: ATK→${killer.atk}`);
    }
  }
};

// 🧮 1. DSL FORMULA COMPILER (Compile Once, Run Fast!)
const DSLFormulaCache = {};

const DSLEvaluator = {
  calc(formula, sourceCard) {
    if (typeof formula === "number") return formula;
    if (!formula) return 0;
    
    if (!DSLFormulaCache[formula]) {
      // 🐞 Fix: ใช้ \b (Word Boundary) ป้องกันการ replace ทับคำที่คล้ายกัน
      let compiled = formula
        .replace(/\batk\b/g, "Number(card.atk || 0)")
        .replace(/\bhp\b/g, "Number(card.hp || 0)")
        .replace(/\bmaxHP\b/g, "Number(card.maxHP || 0)");
      
      // สร้าง Function Object แค่ครั้งเดียว (เหมือน JIT Compiler)
      DSLFormulaCache[formula] = new Function("card", `"use strict"; return Math.floor(${compiled});`);
    }
    
    try { return DSLFormulaCache[formula](sourceCard); } 
    catch(e) { console.error("DSL Eval Error:", formula, e); return 0; }
  },
  
  checkCondition(condition, sourceCard) {
    if (!condition) return true;
    if (!DSLFormulaCache[condition]) {
      let compiled = condition
        .replace(/\batk\b/g, "Number(card.atk || 0)")
        .replace(/\bhp\b/g, "Number(card.hp || 0)")
        .replace(/\bmaxHP\b/g, "Number(card.maxHP || 0)");
      DSLFormulaCache[condition] = new Function("card", `"use strict"; return !!(${compiled});`);
    }
    try { return DSLFormulaCache[condition](sourceCard); } 
    catch(e) { return false; }
  }
};

// 🎯 2. DSL TARGET MAP (แปลความหมาย Target เป็น Logic)
const DSL_TARGET_MAP = {
  "enemy": ["front_enemy", 1],
  "random_enemy": ["random", 1],
  "enemy_all": ["all", 0],
  "ally_lowest_hp": ["lowest_hp", 1],
  "ally_highest_atk": ["highest_atk", 1],
  "ally_all": ["all", 0],
  "self": ["self", 1] 
};

// ⚙️ 3. DSL INTERPRETER ENGINE (หัวใจของการรันแบบ Data-Driven)
const DSLEngine = {
  async run(skillDef, ctx) {
    let dsl = skillDef.dsl;
    let sourceCard = ctx.card || ctx.attacker || ctx.defender; 
    let sourceSlot = ctx.cardSlot || ctx.attackerSlot || ctx.defenderSlot;
    if (!sourceCard) return;

    // ── 1. ตรวจสอบ Condition & Chance ──
    if (dsl.chance && Math.random() > dsl.chance) return;
    if (dsl.condition && !DSLEvaluator.checkCondition(dsl.condition, sourceCard)) return;

    // ── 2. ระบบ Cooldown ──
    let sId = skillDef.id || skillDef.name || "unknown"; // Fallback ID
    if (dsl.cooldown) {
      sourceCard.skillCD = sourceCard.skillCD || {};
      if (sourceCard.skillCD[sId] > 0) return; 
      sourceCard.skillCD[sId] = dsl.cooldown; 
    }

    // ── 3. ค้นหาเป้าหมาย ──
    let isEnemyTarget = dsl.target.includes("enemy");
    let boardToSearch = isEnemyTarget ? ctx.oppBoard : ctx.myBoard;
    let slotsToSearch = isEnemyTarget ? ctx.oppSlots : ctx.mySlots;
    
    let targets = [];
    if (dsl.target === "self") {
      targets = [{ card: sourceCard, index: ctx.idx, slot: sourceSlot }];
    } else {
      let [criteria, count] = DSL_TARGET_MAP[dsl.target] || ["all", 0];
      targets = TargetResolver.resolve(boardToSearch, slotsToSearch, criteria, count);
    }
    if (targets.length === 0) return;

    // ── 4. แสดง Log / VFX กลาง ──
    if (skillDef.displayName) {
       SkillAPI.log(`✨ ${SkillAPI.getName(sourceCard, ctx.isPlayer)} ร่าย <span class="log-skill">${skillDef.displayName}</span>`);
    }
    if (dsl.vfx_global) EffectEngine.play(dsl.vfx_global, document.body, 1500);
    if (dsl.delay) await sleep(dsl.delay); // Animation Wait

    // ── 5. วนลูปประมวลผลผลลัพธ์ใส่เป้าหมาย (Multi-Target Execution) ──
    for (let t of targets) {
      // 5.1 VFX เฉพาะเป้าหมาย
      if (dsl.vfx_target) EffectEngine.play(dsl.vfx_target, t.slot, 800, 'position:absolute;inset:0;');

      // 5.2 Damage & Critical
      if (dsl.damage) {
        let dmg = DSLEvaluator.calc(dsl.damage, sourceCard);
        if (dsl.crit && Math.random() <= dsl.crit) {
          dmg = Math.floor(dmg * (dsl.critMultiplier || 2));
          showFloat("CRITICAL!", t.slot, "skill");
        }
        SkillAPI.damage(t.card, dmg, t.slot, !ctx.isPlayer, "dsl", sourceCard);
      }
      
      // 5.3 Heal
      if (dsl.heal) {
        let heal = DSLEvaluator.calc(dsl.heal, sourceCard);
        SkillAPI.heal(t.card, heal, t.slot, sourceCard);
      }
      
      // 5.4 Multi-Effects (Burn, Corrupt, etc.)
      if (dsl.effect) {
        let effects = Array.isArray(dsl.effect) ? dsl.effect : [dsl.effect];
        for (let eff of effects) {
          if (eff === "none") continue;
          let [status, turns] = eff.split(":");
          SkillAPI.addStatus(t.card, status, Number(turns), t.slot, `${status.toUpperCase()}!`);
        }
      }

      // หน่วงเวลาเล็กน้อยถ้ามีเป้าหมายหลายตัว (Stagger Effect)
      if (targets.length > 1) await sleep(FLOAT_STAGGER_MS);
    }
  }
};
// 🏁 TRIGGER CORE (มี Error Boundary ป้องกันเกมล่ม)
async function triggerSkillEvent(eventName, entity, context) {
  if (!entity || !entity.skills) return;
  if (eventName !== 'onDeath' && eventName !== 'onAllyDeath' && eventName !== 'onEnemyDeath') {
    if (entity.hp <= 0 && !context.preventDeath && !(entity.immortalTurns > 0)) return;
  }
  
  let skillDefs = entity.skills
    .map(s => SKILL_REGISTRY[s.id] || SKILL_REGISTRY[s.name])
    .filter(Boolean)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (let skillDef of skillDefs) {
    if (typeof skillDef[eventName] === "function") {
      try {
        await skillDef[eventName](context);
      } catch (err) {
        console.error(`[SkillEngine Error] พังที่การ์ด: ${entity.name}, ท่า: ${eventName}`, err);
      }
      if (context.preventDeath && eventName === 'onDeath') break;
    }
  }
}