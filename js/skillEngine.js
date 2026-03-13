// ============================================================
// ⚙️ SKILL ENGINE (UNIVERSAL API ARCHITECTURE) v8.0
// ✨ The Architect Edition: Secure DSL, Async Queue, O(1) Lookups
// ============================================================

const FLOAT_STAGGER_MS = 80;
const delayRemove = (typeof sd !== 'undefined') ? sd : (fn, ms) => setTimeout(fn, ms / (window.gameSpeed || 1)); 

// 🎬 1. EFFECT ENGINE (VFX Manager)
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
    const battlefieldEl = document.querySelector('.battlefield');
    if (battlefieldEl) {
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
    if (!srcSlot || !dstSlot) return; 
    try {
      const getRect = window.getEffectRect || ((el) => el.getBoundingClientRect());
      const sr = getRect(srcSlot);
      const dr = getRect(dstSlot);
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
  damage(target, amount, isTargetPlayer, sourceType, attacker) {
    if (!target || target.hp <= 0 || !window.gameEngine) return 0;
    return window.gameEngine.applyDamage(target, amount, isTargetPlayer, sourceType, attacker); 
  },
  damageHero(isTargetPlayer, amount, attacker) {
    if (window.gameEngine) window.gameEngine.damageHero(isTargetPlayer, amount, attacker);
  },
  heal(target, amount, slot, healer, showMsg = true) {
    if (!target || target.hp <= 0) return 0;
    let mHP = (target.maxHP || target.hp) - target.hp;
    if (mHP <= 0) return 0;
    let actual = Math.min(mHP, amount);
    target._displayHP = target.hp; target.hp += actual;
    if (healer?.uid && window.engineState?.combatStats?.[healer.uid]) {
      window.engineState.combatStats[healer.uid].heal += actual;
    }
    if (showMsg && slot && typeof window.showFloat === 'function') window.showFloat(`+${actual}`, slot, "heal");
    if (typeof window.markDirty === 'function') window.markDirty(); 
    return actual;
  },
  buff(target, stat, amount, slot, showMsg = true) {
    if (!target || target.hp <= 0) return;
    target[`_display${stat.toUpperCase()}`] = target[stat];
    target[stat] = Number(target[stat]) + amount;
    let prefix = amount >= 0 ? '+' : '';
    if (showMsg && slot && typeof window.showFloat === 'function') window.showFloat(`${stat.toUpperCase()}${prefix}${amount}`, slot, amount >= 0 ? "skill" : "dmg");
    if (typeof window.markDirty === 'function') window.markDirty();
  },
  addStatus(target, status, turns, slot, floatMsg = null) {
    if (!target || target.hp <= 0) return;
    target.status = target.status || {};
    target.status[status] = (target.status[status] || 0) + turns;
    if (floatMsg && slot && typeof window.showFloat === 'function') window.showFloat(floatMsg, slot, "skill");
    if (typeof window.markDirty === 'function') window.markDirty();
  },
  log(msg) { if(typeof window.addLog === 'function') window.addLog(msg); },
  getName(card, isPlayer) { return `<span class="${isPlayer ? 'log-player' : 'log-enemy'}">${card.name}</span>`; }
};

// 🎯 3. TARGET RESOLVER (เรดาร์ค้นหาเป้าหมาย)
const TargetResolver = {
  getSlots(board) {
    if (!window.engineState) return [];
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
      case "random":             
        // ⚠️ [Fix] Fisher-Yates Shuffle เร็วกว่าและปลอดภัยกว่า
        for (let i = valid.length - 1; i > 0; i--) {
          const j = Math.floor((window.engineState?.rng?.next() || Math.random()) * (i + 1));
          [valid[i], valid[j]] = [valid[j], valid[i]];
        }
        break;
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

// 🧮 4. DSL FORMULA COMPILER (ปลอดภัย 100%)
const DSLFormulaCache = {};
const DSLEvaluator = {
  calc(formula, ctx) {
    if (typeof formula === "number") return formula;
    if (!formula) return 0;
    
    if (!DSLFormulaCache[formula]) {
      // ⚠️ [Fix] Security Guard: ป้องกัน Code Injection
      const safeCheck = formula.replace(/\b(source|target|atk|hp|maxHP|parentATK)\b/g, '').replace(/[0-9\.\+\-\*\/\(\)\s]/g, '');
      if (safeCheck.length > 0) {
        console.error("🚨 SECURITY ALERT: Invalid DSL Code Detected!", formula);
        return 0; 
      }

      let compiled = formula
        .replace(/\bsource\.atk\b/g, "Number(ctx.source.atk || 0)")
        .replace(/\bsource\.hp\b/g, "Number(ctx.source.hp || 0)")
        .replace(/\bsource\.maxHP\b/g, "Number(ctx.source.maxHP || 0)")
        .replace(/\btarget\.atk\b/g, "Number(ctx.target.atk || 0)")
        .replace(/\btarget\.hp\b/g, "Number(ctx.target.hp || 0)")
        .replace(/\btarget\.maxHP\b/g, "Number(ctx.target.maxHP || 0)")
        .replace(/\bsource\.parentATK\b/g, "Number(ctx.source.parentATK || 0)");
        
      DSLFormulaCache[formula] = new Function("ctx", `"use strict"; return Math.floor(${compiled});`);
    }
    try { return DSLFormulaCache[formula](ctx); } catch(e) { return 0; }
  }
};

// 🎯 5. DSL TARGET MAP (พจนานุกรมเป้าหมาย)
const DSL_TARGET_MAP = {
  "enemy_front": ["front", 1],
  "enemy_random": ["random", 1],
  "enemy_all": ["all", 0],
  "enemy_lowest_atk": ["lowest_atk", 1],
  "enemy_highest_atk": ["highest_atk", 1],
  "enemy_lowest_hp": ["lowest_hp", 1],
  "enemy_highest_hp": ["highest_hp", 1],
  "ally_lowest_hp": ["lowest_hp", 1],
  "ally_highest_atk": ["highest_atk", 1],
  "ally_all": ["all", 0],
  "self": ["self", 1] 
};

// ⚙️ 6. DSL INTERPRETER ENGINE (V2.0 Action Sequence)
const DSLEngine = {
  async run(skillDef, ctx) {
    let dsl = skillDef.dsl;
    let sourceCard = ctx.card || ctx.attacker || ctx.defender; 
    let sourceSlot = ctx.cardSlot || ctx.attackerSlot || ctx.defenderSlot;
    if (!sourceCard || !dsl) return;

    if (dsl.chance && Math.random() * 100 > dsl.chance) return;

    let [criteria, count] = (DSL_TARGET_MAP[dsl.target] || ["self", 1]);
    let isEnemyTarget = dsl.target && dsl.target.includes("enemy");
    let boardToSearch = isEnemyTarget ? ctx.oppBoard : ctx.myBoard;
    let slotsToSearch = isEnemyTarget ? (ctx.oppSlots || TargetResolver.getSlots(ctx.oppBoard)) : (ctx.mySlots || TargetResolver.getSlots(ctx.myBoard));
    
    let targets = [];
    if (criteria === "self") targets = [{ card: sourceCard, index: ctx.idx, slot: sourceSlot }];
    else if (criteria === "front") {
      let opp = boardToSearch[ctx.idx];
      if (opp && opp.hp > 0) targets = [{ card: opp, index: ctx.idx, slot: slotsToSearch[ctx.idx] }];
    } 
    else targets = TargetResolver.resolve(boardToSearch, slotsToSearch, criteria, count, isEnemyTarget ? -1 : ctx.idx);
    
    if (targets.length === 0) return;

    if (skillDef.name || skillDef.displayName) {
       SkillAPI.log(`✨ ${SkillAPI.getName(sourceCard, ctx.isPlayer)} ร่าย <span class="log-skill">${skillDef.displayName || skillDef.name}</span>`);
    }
    if (dsl.vfx_global && typeof EffectEngine !== 'undefined') EffectEngine.play(dsl.vfx_global, document.body, 1500);

    let actions = Array.isArray(dsl.actions) ? dsl.actions : [];
    
    // ⚠️ [Fix] ประมวลผล Data แบบ Parallel & Stagger Delay
    let actionPromises = targets.map(async (t, i) => {
      if (i > 0 && window.sleep) await window.sleep(i * FLOAT_STAGGER_MS);
      let evalCtx = { source: sourceCard, target: t.card };

      for (let act of actions) {
        let actIsTargetSelf = act.target === "self" || act.target === "ally";
        let actTargetCard = actIsTargetSelf ? sourceCard : t.card;
        let actTargetSlot = actIsTargetSelf ? sourceSlot : t.slot;

        // ⚠️ [Fix] คำนวณฝั่ง (Side) ให้ถูกต้อง 100%
        let actIsTargetPlayer;
        if (act.target === "self" || act.target?.includes("ally")) actIsTargetPlayer = ctx.isPlayer;
        else if (act.target?.includes("enemy")) actIsTargetPlayer = !ctx.isPlayer;
        else actIsTargetPlayer = isEnemyTarget ? !ctx.isPlayer : ctx.isPlayer;

        if (act.vfx && typeof EffectEngine !== 'undefined') EffectEngine.play(act.vfx, actTargetSlot, 800, 'position:absolute;inset:0;');

        switch (act.type) {
          case "damage":
            let dmg = DSLEvaluator.calc(act.value, evalCtx);
            let actualDmg = SkillAPI.damage(actTargetCard, dmg, actIsTargetPlayer, act.sourceType || "dsl", sourceCard);
            if (actualDmg > 0 && actTargetSlot && typeof window.showFloat === 'function') window.showFloat(`-${actualDmg}`, actTargetSlot, "dmg");
            break;
          case "heal":
            let heal = DSLEvaluator.calc(act.value, evalCtx);
            SkillAPI.heal(actTargetCard, heal, actTargetSlot, sourceCard, true);
            break;
          case "buff":
            let buffAmt = DSLEvaluator.calc(act.value, evalCtx);
            SkillAPI.buff(actTargetCard, act.stat || 'atk', buffAmt, actTargetSlot);
            break;
          case "status":
            SkillAPI.addStatus(actTargetCard, act.status, act.turns || 1, actTargetSlot, `${act.status.toUpperCase()}!`);
            break;
          case "instant_kill":
            SkillAPI.damage(actTargetCard, actTargetCard.hp, actIsTargetPlayer, "skill", sourceCard);
            if (actTargetSlot && typeof window.showFloat === 'function') window.showFloat("INSTANT KILL!", actTargetSlot, "skill");
            break;
          case "extra_attack":
            try {
              sourceCard.flags.isExecutingAttack = true;
              if (window.gameEngine) {
                await window.gameEngine.executeAttack(sourceCard, actTargetCard, ctx.idx, ctx.isPlayer);
                await window.gameEngine.checkDeaths();
              }
            } finally { sourceCard.flags.isExecutingAttack = false; }
            break;
        }
      }
    });

    await Promise.all(actionPromises);
  }
};

// 📦 7. SKILL REGISTRY (Hardcoded Fallback - สำหรับสกิลที่ยังไม่แปลงเป็น JSON)
const SKILL_REGISTRY = {
  "หลบหลีก": {
    priority: 100,
    onBeforeDefend: async (ctx) => {
      if (Math.random() > 0.5) { 
        let dSlot = TargetResolver.getSlots(ctx.oppBoard)[ctx.idx];
        if (typeof window.showFloat === 'function') window.showFloat("Miss!", dSlot, "skill"); 
        SkillAPI.log(`💨 ${SkillAPI.getName(ctx.attacker, ctx.isPlayer)} ตีวืด!`); 
        ctx.attackMissed = true;
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
          if (typeof window.spawnImpactClaw === 'function') window.spawnImpactClaw(t.slot); 
          let actualDmg = SkillAPI.damage(t.card, sp, !ctx.isPlayer, "splash", ctx.attacker);
          if (actualDmg > 0 && typeof window.showFloat === 'function') window.showFloat(`-${actualDmg}`, t.slot, "dmg");
        }
      }
    }
  },
  "สะท้อน": {
    priority: 80,
    onTakeDamage: async (ctx) => {
      if (ctx.actualDmg > 0 && ctx.attacker && ctx.attacker.hp > 0) { 
        SkillAPI.log(`🛡️ ${SkillAPI.getName(ctx.defender, !ctx.isPlayer)} สะท้อน!`); 
        let actualDmg = SkillAPI.damage(ctx.attacker, Math.floor(ctx.actualDmg / 2), ctx.isPlayer, "reflect", ctx.defender); 
        if (actualDmg > 0 && typeof window.showFloat === 'function') window.showFloat(`-${actualDmg}`, ctx.attackerSlot, "dmg");
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
          if (typeof window.showFloat === 'function') window.showFloat(`🛡️↩${cd}`, dSlot, "skill"); 
          SkillAPI.log(`🛡️ ${SkillAPI.getName(ctx.defender, !ctx.isPlayer)} Counterstrike <span class="log-dmg">${cd}</span>`); 
          let actualDmg = SkillAPI.damage(ctx.attacker, cd, ctx.isPlayer, "counterstrike", ctx.defender); 
          if (actualDmg > 0 && typeof window.showFloat === 'function') window.showFloat(`-${actualDmg}`, aSlot, "dmg");
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
          if (typeof window.initCard === 'function') window.initCard(tb[em]);
          tb[em].status = tb[em].status || {}; tb[em].status.physShield = true;
          
          if (typeof window.showFloat === 'function') { window.showFloat("⏳ TEMPORAL SUMMON!", aSlot, "skill"); window.showFloat("🛡️ SHIELD", ts[em], "skill"); }
          SkillAPI.log(`⏳ ${SkillAPI.getName(ctx.attacker, ctx.isPlayer)} <span class="log-skill">Temporal Summon</span> ดึง ${sc.name} ลงสนาม!`);
          
          EffectEngine.beam(aSlot, ts[em], 'temporal-beam', 750);
          EffectEngine.play('shield-burst', ts[em], 1300, 'position:absolute;inset:0;');
          if (window.gameEvents) window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED); 
          if (window.sleep) await window.sleep(600);
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
          if (typeof window.showFloat === 'function') window.showFloat(`👻 STEALTH(${ctx.card.status.shadow})`, cSlot, "skill"); 
          SkillAPI.log(`👻 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} ซ่อนตัว (${ctx.card.status.shadow} เทิร์น)`); 
          ctx.skipAttack = true; 
        } else { 
          ctx.card.runtime.shadowReady = true; 
          if (typeof window.showFloat === 'function') window.showFloat("💥 SHADOW BREAK!", cSlot, "skill"); 
          SkillAPI.log(`💥 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} ออกซ่อน! โจมตีถัดไป ×2.5`); 
        }
        if (window.gameEvents) window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
      }
    },
    onAttackSwing: async (ctx) => {
      if (ctx.attacker.runtime?.shadowReady) { 
        ctx.attacker.runtime.shadowReady = false; ctx.damage = Math.floor(ctx.damage * 2.5); ctx.shadowStrike = true; 
        let aSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
        if (typeof window.showFloat === 'function') window.showFloat("💥 SHADOW STRIKE!", aSlot, "skill"); 
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
        
        if (da > 0) {
          ctx.attacker._displayATK = ctx.attacker.atk;
          ctx.attacker.atk = Math.max(0, Number(ctx.attacker.atk) - da);
        }
        if (dh > 0) {
          ctx.attacker._displayHP = ctx.attacker.hp;
          ctx.attacker.hp = Math.max(0, ctx.attacker.hp - dh);
        }
        
        if (da > 0) SkillAPI.buff(ctx.defender, 'atk', da, null, false);
        if (dh > 0) {
          const healable = Math.min((ctx.defender.maxHP || ctx.defender.hp) - ctx.defender.hp, dh);
          if (healable > 0) {
            ctx.defender._displayHP = ctx.defender.hp;
            ctx.defender.hp += healable;
            if (ctx.defender.uid && window.engineState?.combatStats?.[ctx.defender.uid]) {
              window.engineState.combatStats[ctx.defender.uid].heal += healable;
            }
          }
        }
        
        if (typeof window.showFloat === 'function') { window.showFloat(`🩸-${da}A/-${dh}H`, aSlot, "drain"); window.showFloat(`+${da}A/+${dh}H`, dSlot, "drain"); }
        ctx.defender.runtime.bloodStacks = Math.min(3, (ctx.defender.runtime?.bloodStacks || 0) + 1);
        if (typeof window.markDirty === 'function') window.markDirty();
        SkillAPI.log(`🩸 ${SkillAPI.getName(ctx.defender, !ctx.isPlayer)} Blood Stack (${ctx.defender.runtime.bloodStacks}/3)`);
      }
    },
    onAfterAttack: async (ctx) => {
      if (ctx.isLastAttack && (ctx.attacker.runtime?.bloodStacks || 0) >= 3) {
        let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "all", 0);
        if (targets.length === 0) return;
        ctx.attacker.runtime.bloodStacks = 0;
        SkillAPI.log(`🩸 ${SkillAPI.getName(ctx.attacker, ctx.isPlayer)} <span class="log-skill">💥 BLOOD NOVA!</span> <span class="log-dmg">${ctx.attacker.atk} AOE</span>`);
        
        EffectEngine.shake(); EffectEngine.play('blood-nova-overlay', document.body, 700);
        
        for (let t of targets) {
          EffectEngine.play('blood-hit-flash', t.slot, 800, 'position:absolute;inset:0;');
          let actualDmg = SkillAPI.damage(t.card, ctx.attacker.atk, !ctx.isPlayer, "blood_nova", ctx.attacker);
          if (actualDmg > 0 && typeof window.showFloat === 'function') window.showFloat(`💀 ${actualDmg}`, t.slot, "dmg", t.index * FLOAT_STAGGER_MS);
        }
      }
    }
  },
  "Grave Domain": {
    priority: 60,
    onTurnStart: async (ctx) => {
      let cSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      if ((ctx.card.runtime?.domainTurns || 0) <= 0 && !ctx.card.runtime?.domainUsed) { 
        ctx.card.runtime.domainTurns = 3; ctx.card.runtime.domainUsed = true; 
        if (typeof window.showFloat === 'function') window.showFloat("GRAVE DOMAIN", cSlot, "skill"); 
      } else if ((ctx.card.runtime?.domainTurns || 0) > 0) { 
        ctx.card.runtime.domainTurns--; 
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
      if (hasWeak && !ctx.card.runtime?.hunterAuraActive) {
        ctx.card.runtime.hunterAuraActive = true; ctx.card.runtime.hunterAuraBonus = Math.floor(ctx.card.baseATK * 0.3);
        SkillAPI.buff(ctx.card, 'atk', ctx.card.runtime.hunterAuraBonus, cSlot, "🦁 HUNTER +30%");
      } else if (!hasWeak && ctx.card.runtime?.hunterAuraActive) {
        ctx.card.runtime.hunterAuraActive = false; SkillAPI.buff(ctx.card, 'atk', -(ctx.card.runtime.hunterAuraBonus || 0), null, false);
        ctx.card.runtime.hunterAuraBonus = 0; 
      }
    }
  },
  "Soul Rip": {
    priority: 40,
    onTurnStart: async (ctx) => {
      if (ctx.card.flags?.soulRipUsed) return;
      let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "random", 1);
      let empties = ctx.myBoard.map((c, i) => !c ? i : -1).filter(i => i !== -1);
      
      if (targets.length > 0 && empties.length > 0) {
        ctx.card.flags.soulRipUsed = true; let tgt = targets[0].card; let esIdx = empties[0];
        
        let clnData = { 
          name: "Shadow of " + tgt.name.replace(/Shadow of /g, ""),
          hp: Math.floor((tgt.maxHP || tgt.hp) * 0.5), maxHP: Math.floor((tgt.maxHP || tgt.hp) * 0.5), baseHP: Math.floor((tgt.maxHP || tgt.hp) * 0.5),
          atk: Math.floor((tgt.baseATK || tgt.atk) * 1.5), baseATK: Math.floor((tgt.baseATK || tgt.atk) * 1.5),
          stars: 0, image: tgt.image, isClone: true, isSummoned: true, parentATK: ctx.card.atk,
          skills: [{ id: "Soul Nova", name: "💥 Soul Nova", desc: "โคลนระเบิดเป้าเดี่ยว", dsl: { trigger: "onDeath", target: "enemy_highest_hp", actions: [ {type: "damage", value: "source.parentATK * 0.5"} ] } }]
        };
        
        if (typeof window.cloneCardState === 'function') {
           ctx.myBoard[esIdx] = window.cloneCardState(clnData, ctx.card.owner);
        } else {
           ctx.myBoard[esIdx] = clnData; // Fallback
        }

        if (typeof window.showFloat === 'function') window.showFloat("Summon!", TargetResolver.getSlots(ctx.myBoard)[esIdx], "skill"); 
        SkillAPI.log(`💀 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} Soul Rip → ${clnData.name}`);
      }
    }
  },
  "Temporal Acceleration": {
    priority: 50,
    onTurnStart: async (ctx) => {
      let cSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      SkillAPI.log(`⏳ ${SkillAPI.getName(ctx.card, ctx.isPlayer)} <span class="log-skill">Temporal Acceleration</span>`);
      if (typeof window.showFloat === 'function') window.showFloat("⏳ TIME ACCEL!", cSlot, "skill"); 
      if (window.sleep) await window.sleep(400);

      EffectEngine.play('time-accel-sweep', document.body, 950);
      let th = ctx.isPlayer ? window.engineState.p1.hand : window.engineState.p2.hand;
      th.forEach(c => c.waitTime = Math.max(0, c.waitTime - 1));
      if (window.gameEvents) window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED); 
      if (window.sleep) await window.sleep(800);
      
      let has6 = ctx.myBoard.some(c => c && c.baseWait >= 6);
      let targets = TargetResolver.resolve(ctx.myBoard, TargetResolver.getSlots(ctx.myBoard), "all", 0);
      for (let t of targets) {
        EffectEngine.play('buff-aura', t.slot, 300);
        let hb = Math.floor(t.card.maxHP * 0.3), ab = Math.floor(t.card.baseATK * 0.3);
        t.card.maxHP += hb; SkillAPI.heal(t.card, hb, null, null, false);
        SkillAPI.buff(t.card, 'atk', ab, t.slot, `ATK+${ab}/HP+${hb}`);
        if (t.card.flags?.isSummoned || t.card.flags?.isClone) t.card.runtime.critChance = (t.card.runtime?.critChance || 0) + 35;
        if (has6) SkillAPI.heal(t.card, Math.floor(t.card.maxHP * 0.1), t.slot, ctx.card, true); 
        if (window.sleep) await window.sleep(100);
      }
    }
  },
  "Ashen Rebirth": {
    priority: 100, 
    onDeath: async (ctx) => {
      if (ctx.card.flags?.hasRevived || ctx.card.flags?.unrevivable) return;
      ctx.card.flags.hasRevived = true; ctx.card.flags.isDying = false; ctx.preventDeath = true;
      
      let reviveHP = Math.floor(ctx.card.maxHP * 0.45);
      ctx.card._displayHP = 0;     
      ctx.card.hp = reviveHP;
      if (ctx.card.uid && window.engineState?.combatStats?.[ctx.card.uid]) {
        window.engineState.combatStats[ctx.card.uid].heal += reviveHP;
      }
      
      let cSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      SkillAPI.buff(ctx.card, 'atk', Math.floor(ctx.card.baseATK * 0.2), cSlot, "REBIRTH!");
      ctx.card.status.reviveBuff = 2;
      
      SkillAPI.log(`🔥 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} คืนชีพ!`);
    }
  },
  "Grave Contract": {
    priority: 80,
    onDeath: async (ctx) => {
      if (ctx.card.flags?.graveContractUsed) return;
      ctx.card.flags.graveContractUsed = true;
      SkillAPI.log(`📜 ${SkillAPI.getName(ctx.card, ctx.isPlayer)} <span class="log-skill">Grave Contract</span>`);
      
      let targets = TargetResolver.resolve(ctx.myBoard, TargetResolver.getSlots(ctx.myBoard), "ally_except_self", 0, ctx.idx);
      for (let t of targets) SkillAPI.heal(t.card, 500, t.slot, ctx.card, true);

      let grave = ctx.isPlayer ? window.engineState.p1.graveyard : window.engineState.p2.graveyard;
      let validGrave = grave.filter(g => !g.name.includes("Chronovex") && !g.flags?.unrevivable);
      if (validGrave.length > 0) {
        validGrave.sort((a, b) => b.baseATK - a.baseATK); let rv = validGrave[0]; grave.splice(grave.indexOf(rv), 1);
        
        rv.hp = rv.maxHP; rv.atk = Math.floor(rv.baseATK * 1.2); 
        rv.flags.isSummoned = true;
        rv.status.burn = 0; rv.status.corrupt = 0; rv.flags._initialized = true; 
        
        let em = ctx.myBoard.indexOf(null);
        if (em !== -1) { 
          ctx.myBoard[em] = rv; let cSlot = TargetResolver.getSlots(ctx.myBoard)[em];
          if (typeof window.showFloat === 'function') window.showFloat("REVIVED!", cSlot, "skill"); 
          SkillAPI.log(`✨ ชุบชีวิต ${rv.name}`); 
        }
      }
    }
  },
  "Abyss Devour": {
    priority: 80,
    onAllyDeath: async (ctx) => {
      let ally = ctx.card;
      if ((ally.runtime?.devourStacks || 0) >= 8) return;
      ally.runtime.devourStacks = (ally.runtime?.devourStacks || 0) + 1;
      
      const healAmt = Math.floor(ally.maxHP * 0.1);
      let oSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      SkillAPI.heal(ally, healAmt, null, ally, false);
      SkillAPI.buff(ally, 'atk', 40, oSlot, `🕳 +${healAmt}HP / ATK+40`);
      
      SkillAPI.log(`🕳 ${SkillAPI.getName(ally, ctx.isPlayer)} Abyss Devour (${ally.runtime.devourStacks}/8) ฮีล +${healAmt} ATK→${ally.atk}`);
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
  },
  "เจาะเกราะ": {
    priority: 50,
    onAttackHit: async (ctx) => {
      if (ctx.actualDmg > 0) {
        SkillAPI.damageHero(!ctx.isPlayer, Math.floor(ctx.attacker.atk / 2), ctx.attacker);
      }
    }
  },
  "Final Judgement": {
    priority: 30,
    onDeath: async (ctx) => {
      let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "highest_atk", 1);
      if (targets.length > 0) {
        let tgt = targets[0].card; let tSlot = targets[0].slot;
        tgt.flags.unrevivable = true; 
        tgt.status.immortal = 0; 
        SkillAPI.damage(tgt, tgt.hp, !ctx.isPlayer, "skill", ctx.card);
        EffectEngine.shake(); EffectEngine.play('fj-overlay', document.body, 1900);
        EffectEngine.title('⚰️ FINAL JUDGEMENT', '— Void Sentence —', 2300);
        if (typeof window.showFloat === 'function') { window.showFloat("🌀 VOIDED!", tSlot, "skill"); window.showFloat("❌ UNREVIVABLE", tSlot, "dmg", 300); }
      }
    }
  },
  "Echoes of Oblivion": {
    priority: 50,
    onDeath: async (ctx) => {
      let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "all", 0);
      if (ctx.card.flags?.echoesUsed || targets.length === 0) return;
      ctx.card.flags.echoesUsed = true;
      let p1Grave = window.engineState.p1.graveyard, p2Grave = window.engineState.p2.graveyard;
      let cnt = (p1Grave.length + p2Grave.length) * 0.12, gCopy = [...p1Grave, ...p2Grave], wDmg = 0;
      for (let w = 0; w < 3 && gCopy.length > 0; w++) { let ri = Math.floor(Math.random() * gCopy.length); wDmg += gCopy[ri].baseATK * 0.5; gCopy.splice(ri, 1); }
      let vDmg = Math.min(Math.floor(ctx.card.baseATK * cnt + wDmg), 500);
      for (let t of targets) { 
        let actual = SkillAPI.damage(t.card, vDmg, !ctx.isPlayer, "echoes", ctx.card); 
        if (actual > 0 && typeof window.showFloat === 'function') window.showFloat(`-${actual}`, t.slot, "dmg");
        if (t.card.hp > 0 && t.card.hp < t.card.maxHP * 0.2) { 
           SkillAPI.damage(t.card, t.card.hp, !ctx.isPlayer, "skill", ctx.card); 
           if (typeof window.showFloat === 'function') window.showFloat("INSTANT KILL!", t.slot, "skill", t.index * 80); 
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
      EffectEngine.shake(); EffectEngine.play('singularity-overlay', document.body, 3100);
      EffectEngine.title('☄️ CATACLYSM SINGULARITY', '— Void Gate Opened —', 3200);
      for (let t of targets) {
        EffectEngine.play('singularity-decay-flash', t.slot, 1300, 'position:absolute;inset:0;');
        SkillAPI.damage(t.card, cataDmg, !ctx.isPlayer, "singularity", ctx.card);
        const decay = Math.floor(t.card.maxHP * 0.2); 
        t.card.maxHP = Math.max(1, t.card.maxHP - decay); t.card.hp = Math.min(t.card.hp, t.card.maxHP);
        if (typeof window.showFloat === 'function') window.showFloat(`💀 MaxHP -${decay}`, t.slot, "skill", t.index * 100);
      }
    }
  },
  "Airstrike Omega": {
    priority: 25,
    onTurnStart: async (ctx) => {
      if (ctx.skipAttack) return;
      let cSlot = TargetResolver.getSlots(ctx.myBoard)[ctx.idx];
      ctx.card.runtime.airstrikeCharge = (ctx.card.runtime?.airstrikeCharge || 0) + 1;
      if (typeof window.showFloat === 'function') window.showFloat(`🚀 ${ctx.card.runtime.airstrikeCharge}/3`, cSlot, "skill"); 
      if (window.gameEvents) window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
      if (ctx.card.runtime.airstrikeCharge >= 3) {
        let targets = TargetResolver.resolve(ctx.oppBoard, TargetResolver.getSlots(ctx.oppBoard), "all", 0);
        if (targets.length === 0) return;
        ctx.card.runtime.airstrikeCharge = 0; 
        let aoeDmg = Math.floor(ctx.card.atk * 1.6);
        EffectEngine.shake(); EffectEngine.play('airstrike-flash', document.body, 1500);
        EffectEngine.title('🚀 AIRSTRIKE OMEGA', '— AOE Annihilation —');
        for (let t of targets) {
           SkillAPI.damage(t.card, aoeDmg, !ctx.isPlayer, "airstrike", ctx.card); 
           SkillAPI.addStatus(t.card, "burn", 2, t.slot, "🔥 BURN");
           if (window.sleep) await window.sleep(80); 
        }
      }
    }
  }
};

// 🏁 8. TRIGGER CORE (ศูนย์กลางกระจาย Event สกิล)
async function triggerSkillEvent(eventName, entity, context) {
  if (!entity || !entity.skills) return;
  
  if (eventName !== 'onDeath' && eventName !== 'onAllyDeath' && eventName !== 'onEnemyDeath') {
    if (entity.hp <= 0 && !context.preventDeath && !(entity.status?.immortal > 0)) {
       // ⚠️ [Fix] กัน Trigger ซ้อนตอนมันกำลังตายอยู่แล้ว
       if (entity.flags?.isDying) return; 
       return;
    }
  }
  
  let skillDefs = entity.skills
    .map(s => { return { ...s, logic: SKILL_REGISTRY[s.id] || SKILL_REGISTRY[s.name] }; })
    .sort((a, b) => ((b.logic?.priority || b.priority || 0) - (a.logic?.priority || a.priority || 0)));

  for (let skillDef of skillDefs) {
    try {
      if (skillDef.dsl && skillDef.dsl.trigger === eventName) {
        await DSLEngine.run(skillDef, context);
      } 
      else if (skillDef.logic && typeof skillDef.logic[eventName] === "function") {
        await skillDef.logic[eventName](context);
      }
    } catch (err) {
      console.error(`[SkillEngine Error] พังที่การ์ด: ${entity.name}, ท่า: ${eventName}`, err);
    }
    if (context.preventDeath && eventName === 'onDeath') break;
  }
}