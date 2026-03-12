// ============================================================
// 🌉 PHASE 8.2: OOP BRIDGE (Browser Combat Controller)
// ============================================================

// ── 1. HELPERS (เชื่อมต่อกับ State กลาง) ──
// หมายเหตุ: อิงจากที่ player.board เป็น Array ตรงๆ แล้ว (ไม่มี .slots)
// ── 1. HELPERS (เชื่อมต่อกับ State กลางผ่าน Window) ──
const getMyBoard = (isP1) => window.engineState.getPlayer(isP1).board;
const getOppBoard = (isP1) => window.engineState.getOpp(isP1).board;
const getMySlots = (isP1) => isP1 ? playerBoardSlots : enemyBoardSlots;
const getOppSlots = (isP1) => isP1 ? enemyBoardSlots : playerBoardSlots;

// ── 2. SHATTER EFFECT (VFX ตอนการ์ดตาย) ──
function shatterCard(slotEl) {
  if (!slotEl) return;
  const rect = slotEl.getBoundingClientRect();
  const cardEl = slotEl.querySelector('.card');
  const imgUrl = cardEl ? (cardEl.querySelector('.card-image-bg')?.style.backgroundImage || 'none') : 'none';

  const shards = [
    { clip: "polygon(0% 0%, 48% 0%, 32% 42%, 0% 28%)",       ox: -65, oy: -85, rot: -38 },
    { clip: "polygon(48% 0%, 100% 0%, 100% 22%, 62% 36%)",    ox:  75, oy: -72, rot:  30 },
    { clip: "polygon(0% 28%, 32% 42%, 18% 68%, 0% 58%)",      ox: -82, oy:  18, rot: -52 },
    { clip: "polygon(32% 42%, 62% 36%, 58% 74%, 18% 68%)",    ox: -18, oy:  95, rot:  14 },
    { clip: "polygon(62% 36%, 100% 22%, 100% 68%, 58% 74%)",  ox:  78, oy:  52, rot:  42 },
    { clip: "polygon(18% 68%, 58% 74%, 46% 100%, 0% 100%)",   ox: -58, oy: 112, rot: -26 },
    { clip: "polygon(58% 74%, 100% 68%, 100% 100%, 46% 100%)",ox:  62, oy: 105, rot:  32 }
  ];

  shards.forEach((s, idx) => {
    const shard = document.createElement('div');
    shard.className = 'battle-vfx card-shard';
    shard.style.cssText = `width:${rect.width}px; height:${rect.height}px; left:${rect.left}px; top:${rect.top}px; background-image:${imgUrl}; clip-path:${s.clip}; --ex:${s.ox}px; --ey:${s.oy + 55}px; --er:${s.rot}deg; animation-delay:${idx * 0.028}s;`;
    document.body.appendChild(shard); setTimeout(() => shard.remove(), 900 + idx * 30);
  });

  const flash = document.createElement('div'); flash.className = 'battle-vfx card-shatter-flash';
  flash.style.cssText = `left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; height:${rect.height}px;`;
  document.body.appendChild(flash); setTimeout(() => flash.remove(), 280);
}

// ============================================================
// ⚙️ THE BATTLE ENGINE CLASS (Core Logic)
// ============================================================
class BattleEngine {
  constructor(state) {
    this.state = state;
  }
// ====================== INIT & SHUFFLE ======================
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  initGame(p1DeckRaw, p2DeckRaw) {
    // นำเด็คดิบมาสับ และแปลงร่างเป็น Object แบบ OOP (CardState)
    this.state.p1.deck = this.shuffle([...p1DeckRaw]).map(c => new CardState(c, this.state.generateUID(), 'p1'));
    this.state.p2.deck = this.shuffle([...p2DeckRaw]).map(c => new CardState(c, this.state.generateUID(), 'p2'));

    // จั่วการ์ด 3 ใบแรกขึ้นมือ
    for (let i = 0; i < 3; i++) {
      if (this.state.p1.deck.length) this.state.p1.hand.push(this.state.p1.deck.shift());
      if (this.state.p2.deck.length) this.state.p2.hand.push(this.state.p2.deck.shift());
    }
  }
  // ====================== UTILS ======================
  damageHero(isTargetP1, amount, attackerCard) {
    let target = this.state.getPlayer(isTargetP1);
    target.hp = Math.max(0, target.hp - amount);
    if (target.hp === 0) this.state.isGameOver = true;
    
    if (attackerCard && attackerCard.uid && this.state.combatStats[attackerCard.uid]) {
      this.state.combatStats[attackerCard.uid].dmg += amount;
    }
    
    const tHeroEl = isTargetP1 ? playerHeroEl : enemyHeroEl;
    showFloat(`-${amount}`, tHeroEl, "dmg");
    updateHeroHP(); // อัปเดต UI ฮีโร่
    return target.hp;
  }

  // ====================== APPLY DAMAGE ======================
  applyDamage(targetCard, dmg, targetEl, isTargetP1, sourceType = "normal", attackerCard = null) {
    if (!targetCard || targetCard.hp <= 0 || isNaN(dmg)) return 0;

    const tN = `<span class="${isTargetP1 ? 'log-player' : 'log-enemy'}">${targetCard.name}</span>`;

    if (targetCard.status?.physShield && sourceType === "normal") {
      targetCard.status.physShield = false;
      if (targetEl) showFloat("BLOCKED!", targetEl, "skill");
      addLog(`🛡️ ${tN} ใช้โล่ Physical Shield ป้องกัน!`);
      markDirty(); flushBoard(); return 0; 
    }

    if (targetCard.status?.immortal > 0 && targetCard.hp - dmg <= 0) { 
      dmg = Math.max(0, targetCard.hp - 1);
      if (targetCard.hp <= 1) { if (targetEl) showFloat("IMMORTAL!", targetEl, "skill"); return 0; } 
    }

    if (targetCard.status?.corrupt > 0 && dmg > 0) { 
      dmg = Math.floor(dmg * 1.2); 
    }

    if (typeof ARMOR_TABLE !== "undefined") {
      for (let [key, fn] of Object.entries(ARMOR_TABLE)) {
        if (hasSkill(targetCard, key)) {
          let newDmg = fn(dmg, sourceType);
          if (newDmg < dmg) { if (targetEl) showFloat("🛡️ SHIELD", targetEl, "skill"); dmg = newDmg; break; }
        }
      }
    }

    let effective = Math.min(dmg, targetCard.hp);
    targetCard.hp = Math.max(0, targetCard.hp - dmg);

    if (attackerCard?.uid && this.state.combatStats[attackerCard.uid]) {
      this.state.combatStats[attackerCard.uid].dmg = (this.state.combatStats[attackerCard.uid].dmg || 0) + dmg;
    }
    if (targetCard?.uid && this.state.combatStats[targetCard.uid]) {
      this.state.combatStats[targetCard.uid].taken = (this.state.combatStats[targetCard.uid].taken || 0) + dmg;
    }

    if (dmg > 0 && !["blood_nova", "tyrant"].includes(sourceType) && targetEl) {
      showFloat(`-${dmg}`, targetEl, "dmg");
    }

    // ── Hardcoded Passives (Legacy) ──
    if (hasSkill(targetCard, "Immortal Tyrant") && effective > 0 && !["reflect", "counterstrike", "tyrant"].includes(sourceType)) {
      targetCard.hpLostAccum = (targetCard.hpLostAccum || 0) + effective;
      while (targetCard.hpLostAccum >= targetCard.maxHP * 0.25) {
        targetCard.fragments = (targetCard.fragments || 0) + 1;
        targetCard.hpLostAccum -= targetCard.maxHP * 0.25;
        if (targetEl) showFloat(`Fragment ${targetCard.fragments}/4`, targetEl, "skill"); 
        addLog(`🔮 ${tN} Soul Fragment (${targetCard.fragments}/4)`);
        
        if (targetCard.fragments >= 4) {
          targetCard.fragments = 0; targetCard.hpLostAccum = 0;
          let heal = Math.floor(targetCard.maxHP * 0.5); 
          targetCard._displayHP = targetCard.hp; targetCard.hp += heal; 
          targetCard.status.immortal = (targetCard.status.immortal || 0) + 1;
          if (targetEl) { showFloat("TYRANT AWOKEN!", targetEl, "skill"); showFloat(`+${heal}`, targetEl, "heal"); }
          addLog(`👑 ${tN} <span class="log-skill">Immortal Tyrant!</span>`);
          
          // ใช้ TargetResolver ที่ถูกต้อง
          const targets = TargetResolver.resolve(getOppBoard(isTargetP1), getOppSlots(isTargetP1), "all", 0);
          EffectEngine.shake('anim-tyrant-shake', 900); 
          EffectEngine.play('tyrant-overlay', document.body, 500); 
          EffectEngine.title('IMMORTAL TYRANT', '— Soul Dominion —', 500);
          
          setTimeout(() => {
            targets.forEach(t => {
              EffectEngine.play('tyrant-hit-flash', t.slot, 1000);
              this.applyDamage(t.card, targetCard.atk * 2, t.slot, !isTargetP1, "tyrant", targetCard);
              showFloat(`👑 ${targetCard.atk * 2}`, t.slot, "skill", t.index * 80);
            });
          }, 500); break;
        }
      }
    }

    if (hasSkill(targetCard, "Iron Sentinel") && dmg > 0 && ["normal", "splash", "domain", "burn", "dsl"].includes(sourceType)) {
      targetCard.sentinelStacks = Math.min(10, (targetCard.sentinelStacks || 0) + 1);
      targetCard.atk = (targetCard.baseATK || targetCard.atk) + targetCard.sentinelStacks * 35;
      addLog(`🛡️ ${tN} Battle Hardened (${targetCard.sentinelStacks}/10) ATK→${targetCard.atk}`);
      if (targetEl) showFloat(`⚔️+35(${targetCard.sentinelStacks})`, targetEl, "skill");
    }

    return dmg;
  }

  // ====================== EXECUTE ATTACK ======================
  async executeAttack(attacker, defender, idx, isP1) {
    if (!attacker || this.state.isGameOver) return;

    const LOA_IMPACT_MS = 175;
    const LOA_RECOIL_MS = 175;
    const tHero = isP1 ? enemyHeroEl : playerHeroEl;
    const aSlots = getMySlots(isP1);
    const tSlots = getOppSlots(isP1);
    const anim = isP1 ? 'anim-loa-attack-up' : 'anim-loa-attack-down';

    const spawnImpactClaw = (targetEl) => {
      if (!targetEl || targetEl.offsetWidth === 0) return; 
      targetEl.style.position = 'relative';
      const cx = targetEl.offsetWidth / 2, cy = targetEl.offsetHeight / 2;
      for (let i = 0; i < 3; i++) {
        const slash = document.createElement('div'); slash.className = 'claw-slash';
        slash.style.left = (cx + (Math.random() - 0.5) * 50 - 40) + 'px';
        slash.style.top  = (cy + (Math.random() - 0.5) * 30) + 'px';
        targetEl.appendChild(slash); setTimeout(() => slash.remove(), 350);
      }
      targetEl.classList.add('hit-shake'); sd(() => targetEl.classList.remove('hit-shake'), 200);
    };

    const ctx = {
      attacker, defender, idx, isPlayer: isP1,
      attackerSlot: aSlots[idx], defenderSlot: tSlots[idx], targetHero: tHero,
      get myBoard() { return getMyBoard(isP1); },
      get oppBoard() { return getOppBoard(isP1); },
      get mySlots() { return aSlots; },
      get oppSlots() { return tSlots; },
      damage: attacker.atk, actualDmg: 0,
      attackMissed: false, shadowStrike: false, isCrit: false, isLastAttack: false,
      spawnImpactClaw: spawnImpactClaw // ส่งเผื่อสกิลเก่าๆ ยังต้องใช้
    };

    await this.triggerSkillEvent('onBeforeAttack', attacker, ctx);
    if (attacker.hp <= 0) return;

    const attacks = hasSkill(attacker, "ยิงแฝด") ? 2 : 1;

    for (let a = 0; a < attacks; a++) {
      if (!attacker || attacker.hp <= 0 || this.state.isGameOver) break;
      
      ctx.shadowStrike = false; ctx.isCrit = false; ctx.attackMissed = false;
      ctx.isLastAttack = (a === attacks - 1);
      ctx.damage = attacker.atk;

      let cardEl = ctx.attackerSlot?.querySelector('.card');
      const breakAndCleanup = () => { cardEl?.classList.remove(anim); };

      if (cardEl) { cardEl.classList.remove(anim); void cardEl.offsetWidth; cardEl.classList.add(anim); }
      
      await this.triggerSkillEvent('onAttackSwing', attacker, ctx);
      await sleep(LOA_IMPACT_MS);

      if (attacker.hp <= 0) { breakAndCleanup(); break; }

      if (!ctx.shadowStrike) {
        ctx.isCrit = Math.random() * 100 < (attacker.critChance || 0);
        if (ctx.isCrit) ctx.damage = Math.floor(ctx.damage * 2); 
      }

      // ดึง defender ล่าสุดแบบสดๆ เผื่อตายไปแล้ว
      ctx.defender = getOppBoard(isP1)[idx];
      
      if (ctx.defender && (ctx.defender.status?.shadow || 0) > 0) {
        showFloat("👻 STEALTH", ctx.defenderSlot, "skill"); 
        addLog(`👻 ${ctx.defender.name} ซ่อนตัว — ดาเมจทะลุฮีโร่`);
        spawnImpactClaw(tHero); 
        this.damageHero(!isP1, ctx.damage, attacker);
        await sleep(LOA_RECOIL_MS); cardEl?.classList.remove(anim); await sleep(100); continue;
      }

      if (ctx.defender && ctx.defender.hp > 0) {
        await this.triggerSkillEvent('onBeforeDefend', ctx.defender, ctx);
        if (!ctx.attackMissed && ctx.defender.hp > 0) {
          spawnImpactClaw(ctx.defenderSlot); 
          let logMsg = `⚔️ ${SkillAPI.getName(attacker, isP1)} → ${SkillAPI.getName(ctx.defender, !isP1)} `;
          if (ctx.shadowStrike) logMsg += `(💥 Shadow) `; else if (ctx.isCrit) { showFloat("CRITICAL!", ctx.attackerSlot, "skill"); logMsg += `(💥 คริ!) `; }
          addLog(logMsg + `<span class="log-dmg">${ctx.damage}</span>`);
          
          ctx.actualDmg = this.applyDamage(ctx.defender, ctx.damage, ctx.defenderSlot, !isP1, "normal", attacker);
          await this.triggerSkillEvent('onTakeDamage', ctx.defender, ctx);
          if (attacker.hp <= 0) { breakAndCleanup(); break; }
          
          ctx.defender = getOppBoard(isP1)[idx]; // อัปเดตหลังโดนดาเมจ
          if (ctx.defender && ctx.defender.hp > 0) await this.triggerSkillEvent('onAttackHit', attacker, ctx);
        }
      } else {
        spawnImpactClaw(tHero); 
        if (ctx.shadowStrike) addLog(`💥 Shadow Strike ×2.5 ตรงฮีโร่!`);
        this.damageHero(!isP1, ctx.damage, attacker);
        let logMsg = `⚔️ ${SkillAPI.getName(attacker, isP1)} → ฮีโร่ `;
        if (ctx.shadowStrike) logMsg += `(💥 Shadow) `; else if (ctx.isCrit) { showFloat("CRITICAL!", ctx.attackerSlot, "skill"); logMsg += `(💥 คริ!) `; }
        addLog(logMsg + `(<span class="log-dmg">${ctx.damage}</span>)`);
      }
      
      await sleep(LOA_RECOIL_MS); cardEl?.classList.remove(anim); await sleep(60); 

      if (attacker.hp <= 0) break;
      await this.triggerSkillEvent('onAfterAttack', attacker, ctx);
    } 
  }

  // ====================== CHECK DEATHS (Event Queue) ======================
  async checkDeaths() {
    let resolved = true; let changed = false;
    while (resolved) {
      if (this.state.isGameOver) break;
      resolved = false; let pending = [];

      for (let isP1 of [true, false]) {
        let board = getMyBoard(isP1);
        for (let i = 0; i < BOARD_SIZE; i++) {
          let c = board[i];
          if (c && c.hp <= 0 && !c.flags.isDying) {
            c.flags.isDying = true;
            pending.push({ card: c, index: i, isPlayer: isP1 });
          }
        }
      }

      if (pending.length === 0) break;
      resolved = true; changed = true;

      for (let pd of pending) {
        if (this.state.isGameOver) break;
        let { card, index, isPlayer } = pd;
        
        let ctx = {
          card: card, idx: index, isPlayer: isPlayer,
          get myBoard() { return getMyBoard(isPlayer); },
          get oppBoard() { return getOppBoard(isPlayer); },
          get mySlots() { return getMySlots(isPlayer); },
          get oppSlots() { return getOppSlots(isPlayer); },
          preventDeath: false 
        };

        await this.triggerSkillEvent('onDeath', card, ctx);

        if (ctx.preventDeath) { card.flags.isDying = false; continue; }

        let currentBoard = getMyBoard(isPlayer);
        let cIdx = currentBoard.indexOf(card);
        
        if (cIdx !== -1) {
          addLog(`💀 ${SkillAPI.getName(card, isPlayer)} ตาย`);
          shatterCard(getMySlots(isPlayer)[cIdx]); 
          await sleep(200);

          let grave = this.state.getPlayer(isPlayer).graveyard;
          if (!grave.includes(card)) grave.push(card); 
          currentBoard[cIdx] = null; 
        }
        
        let eventCtx = { deadCard: card, deadIdx: index, deadSlot: getMySlots(isPlayer)[index] };
        let myBoardNow = getMyBoard(isPlayer);
        let oppBoardNow = getOppBoard(isPlayer);
        
        for (let i = 0; i < BOARD_SIZE; i++) {
          if (myBoardNow[i] && myBoardNow[i].hp > 0 && myBoardNow[i] !== card) {
            await this.triggerSkillEvent('onAllyDeath', myBoardNow[i], { ...eventCtx, isPlayer: isPlayer, card: myBoardNow[i], observerSlot: getMySlots(isPlayer)[i] });
          }
          if (oppBoardNow[i] && oppBoardNow[i].hp > 0) {
            await this.triggerSkillEvent('onEnemyDeath', oppBoardNow[i], { ...eventCtx, isPlayer: !isPlayer, card: oppBoardNow[i], observerSlot: getOppSlots(isPlayer)[i] });
          }
        }
      }
    }
    if (changed) { updateHeroHP(); updateGrave(); markDirty(); flushBoard(); }
  }

  // ====================== SHIFT BOARDS (Safe Reference Check) ======================
  async shiftBoards() {
    let p1Board = this.state.p1.board;
    let p2Board = this.state.p2.board;

    const np1 = [...p1Board.filter(Boolean), ...Array(BOARD_SIZE).fill(null)].slice(0, BOARD_SIZE);
    const np2 = [...p2Board.filter(Boolean), ...Array(BOARD_SIZE).fill(null)].slice(0, BOARD_SIZE);

    let changed = false;
    if (p1Board.some((c, i) => c !== np1[i])) { 
      for(let i=0; i<BOARD_SIZE; i++) p1Board[i] = np1[i]; 
      changed = true; 
    }
    if (p2Board.some((c, i) => c !== np2[i])) { 
      for(let i=0; i<BOARD_SIZE; i++) p2Board[i] = np2[i]; 
      changed = true; 
    }

    if (changed) {
      addLog(`➡️ <span style="color:#aaa">กระดานเลื่อน...</span>`);
      markDirty(); flushBoard(); await sleep(250);
    }
  }

  // ====================== PROCESS TURN PHASE ======================
  async processTurnPhase(isP1) {
    const slots = getMySlots(isP1);
    const player = this.state.getPlayer(isP1);

    for (let i = 0; i < BOARD_SIZE; i++) {
      if (this.state.isGameOver) return;
      
      let pCard = player.board[i];
      if (!pCard || pCard.hp <= 0) continue;
      
      if (!pCard.flags._initialized) { 
        if (typeof initCard === "function") initCard(pCard); // กรณีมี UI ผูกอยู่
        pCard.flags._initialized = true; 
      }

      // Status Effects Update
      if (pCard.status?.immortal > 0) pCard.status.immortal--;
      if (pCard.status?.reviveBuff > 0) { 
        pCard.status.reviveBuff--; 
        if (pCard.status.reviveBuff === 0) pCard.atk -= Math.floor(pCard.baseATK * 0.2); 
      }
      if (pCard.status?.corrupt > 0) { pCard.status.corrupt--; markDirty(); }
      
      if (pCard.status?.burn > 0) {
        let bd = Math.floor((pCard.maxHP || pCard.hp) * 0.05);
        let burnRemain = pCard.status.burn - 1; 
        this.applyDamage(pCard, bd, slots[i], isP1, "burn");
        addLog(`🔥 ${SkillAPI.getName(pCard, isP1)} ติดไฟ! ดาเมจ ${bd} (เหลือ ${burnRemain} เทิร์น)`);
        pCard.status.burn = burnRemain;
        await this.checkDeaths();
        pCard = player.board[i];
        if (!pCard || pCard.hp <= 0) continue;
      }

      let ctx = {
        get card() { return player.board[i]; }, 
        idx: i, isPlayer: isP1, cardSlot: slots[i],
        get myBoard() { return player.board; },
        get oppBoard() { return window.engineState.getOpp(isP1).board; },
        get mySlots() { return getMySlots(isP1); },
        get oppSlots() { return getOppSlots(isP1); },
        skipAttack: false 
      };

      await this.triggerSkillEvent('onTurnStart', pCard, ctx);
      
      markDirty(); flushBoard(); updateHeroHP(); await sleep(50); 
      await this.checkDeaths(); 
      
      pCard = player.board[i]; 
      if (!pCard || pCard.hp <= 0) continue;

      if (!ctx.skipAttack) { 
        let defender = window.engineState.getOpp(isP1).board[i]; 
        await this.executeAttack(pCard, defender, i, isP1); 
        await this.checkDeaths(); 
        markDirty(); flushBoard(); await sleep(200); 
      }
      
      pCard = player.board[i]; 
      if (pCard && pCard.hp > 0) {
        await this.triggerSkillEvent('onTurnEnd', pCard, ctx);
        await this.checkDeaths(); markDirty(); flushBoard();
      }
    }
    
    await this.checkDeaths();
    if (!this.state.isGameOver) await this.shiftBoards();
  }

  // ====================== UNIVERSAL SKILL BRIDGE (DSL + Hardcode) ======================
  async triggerSkillEvent(eventName, entity, ctx) {
    if (!entity || !entity.skills) return;

    // Guard: ป้องกันไม่ให้การ์ดที่ตายแล้วทำงาน (เว้นแต่อมตะอยู่ หรือเป็น event ความตาย)
    if (eventName !== 'onDeath' && eventName !== 'onAllyDeath' && eventName !== 'onEnemyDeath') {
      if (entity.hp <= 0 && !ctx.preventDeath && !(entity.status?.immortal > 0)) return;
    }
    
    // ดึงข้อมูลสกิลทั้งหมด และจัดเรียง Priority
    let skillDefs = entity.skills
      .map(s => SKILL_REGISTRY[s.id] || SKILL_REGISTRY[s.name])
      .filter(Boolean)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (let skillDef of skillDefs) {
      try {
        // 🟢 ทางแยก 1: สกิลถูกสร้างด้วย DSL Data-Driven
        if (skillDef.dsl && skillDef.dsl.trigger === eventName) {
          ctx.card = entity; // แนบตัวเองเข้าไปให้ DSL
          await DSLEngine.run(skillDef, ctx);
        } 
        // 🔵 ทางแยก 2: สกิลที่เป็น Hardcoded JS Function (Legacy / Custom)
        else if (typeof skillDef[eventName] === "function") {
          await skillDef[eventName](ctx);
        }
      } catch (err) {
        console.error(`[SkillEngine] พังที่การ์ด: ${entity.name}, ท่า: ${eventName}`, err);
      }
      
      // Interrupt System
      if (ctx.preventDeath && eventName === 'onDeath') break;
    }
  }
}