// ============================================================
// 🌉 PHASE 8.2: OOP BRIDGE (Core Logic Controller)
// หน้าที่: คำนวณดาเมจ, จัดการ State, และส่ง Event (ไม่มี DOM/UI ปน)
// ============================================================

// ── 1. HELPERS (เชื่อมต่อกับ State กลาง) ──
const getMyBoard = (isP1) => window.engineState.getPlayer(isP1).board;
const getOppBoard = (isP1) => window.engineState.getOpp(isP1).board;

// (เอา getMySlots / getOppSlots ออกจาก Logic เพราะเป็นเรื่องของ UI)

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
    this.state.p1.deck = this.shuffle([...p1DeckRaw]).map(c => new CardState(c, this.state.generateUID(), 'p1'));
    this.state.p2.deck = this.shuffle([...p2DeckRaw]).map(c => new CardState(c, this.state.generateUID(), 'p2'));

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
    
    // 📢 ประกาศว่าฮีโร่โดนโจมตี
    window.gameEvents.emit(window.EVENTS.HERO_DAMAGED, {
      isPlayer: isTargetP1,
      damage: amount,
      currentHp: target.hp,
      attacker: attackerCard
    });

    return target.hp;
  }

  // ====================== APPLY DAMAGE ======================
  // 💡 ลบ targetEl ออกจาก Parameter เพราะ Logic ไม่ต้องใช้แล้ว
  applyDamage(targetCard, dmg, isTargetP1, sourceType = "normal", attackerCard = null) {
    if (!targetCard || targetCard.hp <= 0 || isNaN(dmg)) return 0;

    // 1. ตรวจสอบ Physical Shield
    if (targetCard.status?.physShield && sourceType === "normal") {
      targetCard.status.physShield = false;
      window.gameEvents.emit(window.EVENTS.STATUS_APPLIED, { 
        type: 'SHIELD_BLOCK', target: targetCard, isPlayer: isTargetP1 
      });
      return 0; 
    }

    // 2. ปรับตัวเลขตาม Status (Immortal, Corrupt, Armor)
    if (targetCard.status?.immortal > 0 && targetCard.hp - dmg <= 0) { 
      dmg = Math.max(0, targetCard.hp - 1);
    }

    if (targetCard.status?.corrupt > 0 && dmg > 0) { 
      dmg = Math.floor(dmg * 1.2); 
    }

    if (typeof ARMOR_TABLE !== "undefined") {
      for (let [key, fn] of Object.entries(ARMOR_TABLE)) {
        if (hasSkill(targetCard, key)) {
          let newDmg = fn(dmg, sourceType);
          if (newDmg < dmg) { dmg = newDmg; break; }
        }
      }
    }

    // 3. หักลบ HP จริง
    let effective = Math.min(dmg, targetCard.hp);
    targetCard.hp = Math.max(0, targetCard.hp - dmg);

    // 4. บันทึกสถิติ
    if (attackerCard?.uid && this.state.combatStats[attackerCard.uid]) {
      this.state.combatStats[attackerCard.uid].dmg = (this.state.combatStats[attackerCard.uid].dmg || 0) + dmg;
    }
    if (targetCard?.uid && this.state.combatStats[targetCard.uid]) {
      this.state.combatStats[targetCard.uid].taken = (this.state.combatStats[targetCard.uid].taken || 0) + dmg;
    }

    // 📢 5. ประกาศ Event ให้ UI ไปแสดงผลดาเมจ
    if (dmg > 0 && !["blood_nova", "tyrant"].includes(sourceType)) {
      window.gameEvents.emit(window.EVENTS.DAMAGE_TAKEN, {
        target: targetCard,
        damage: dmg,
        isPlayer: isTargetP1,
        sourceType: sourceType,
        attacker: attackerCard
      });
    }

    // ── Hardcoded Passives (Legacy) แบบไม่มี DOM ──
    if (hasSkill(targetCard, "Immortal Tyrant") && effective > 0 && !["reflect", "counterstrike", "tyrant"].includes(sourceType)) {
      targetCard.hpLostAccum = (targetCard.hpLostAccum || 0) + effective;
      while (targetCard.hpLostAccum >= targetCard.maxHP * 0.25) {
        targetCard.fragments = (targetCard.fragments || 0) + 1;
        targetCard.hpLostAccum -= targetCard.maxHP * 0.25;
        
        window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, `🔮 ${targetCard.name} Soul Fragment (${targetCard.fragments}/4)`);
        
        if (targetCard.fragments >= 4) {
          targetCard.fragments = 0; targetCard.hpLostAccum = 0;
          let heal = Math.floor(targetCard.maxHP * 0.5); 
          targetCard._displayHP = targetCard.hp; targetCard.hp += heal; 
          targetCard.status.immortal = (targetCard.status.immortal || 0) + 1;
          
          window.gameEvents.emit(window.EVENTS.SKILL_CAST, {
            skillName: "Immortal Tyrant",
            target: targetCard,
            isPlayer: isTargetP1,
            healAmount: heal,
            triggerVFX: 'TYRANT_AWOKEN'
          });
          
          // ทำดาเมจ AOE ตอบโต้ (ส่ง Logic ต่อให้ UI ไปวาดแสงสีทีหลัง)
          const oppBoard = getOppBoard(isTargetP1);
          setTimeout(() => {
            oppBoard.forEach((t, tIdx) => {
              if (t && t.hp > 0) {
                this.applyDamage(t, targetCard.atk * 2, !isTargetP1, "tyrant", targetCard);
              }
            });
          }, 500); 
          break;
        }
      }
    }

    if (hasSkill(targetCard, "Iron Sentinel") && dmg > 0 && ["normal", "splash", "domain", "burn", "dsl"].includes(sourceType)) {
      targetCard.sentinelStacks = Math.min(10, (targetCard.sentinelStacks || 0) + 1);
      targetCard.atk = (targetCard.baseATK || targetCard.atk) + targetCard.sentinelStacks * 35;
      window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, `🛡️ ${targetCard.name} Battle Hardened (${targetCard.sentinelStacks}/10) ATK→${targetCard.atk}`);
    }

    return dmg;
  }

  // ====================== EXECUTE ATTACK ======================
  async executeAttack(attacker, defender, idx, isP1) {
    if (!attacker || this.state.isGameOver) return;

    // 💡 ลบ UI elements (Slot, HeroEl) ออกจาก Context แล้ว
    const ctx = {
      attacker, defender, idx, isPlayer: isP1,
      get myBoard() { return getMyBoard(isP1); },
      get oppBoard() { return getOppBoard(isP1); },
      damage: 0, actualDmg: 0,
      attackMissed: false, shadowStrike: false, isCrit: false, isLastAttack: false
    };

    // 1. ตั้งต้น Base Damage ก่อนสกิลบัฟ
    ctx.damage = attacker.atk;
    await this.triggerSkillEvent('onBeforeAttack', attacker, ctx);
    
    if (attacker.hp <= 0) return;

    const attacks = hasSkill(attacker, "ยิงแฝด") ? 2 : 1;

    for (let a = 0; a < attacks; a++) {
      if (!attacker || attacker.hp <= 0 || this.state.isGameOver) break;
      
      ctx.isLastAttack = (a === attacks - 1);
      
      // ดึงเป้าหมายล่าสุดเผื่อตายไปแล้วใน Hit แรก
      ctx.defender = getOppBoard(isP1)[idx];

      // 2. ให้สกิลคำนวณ Buff ก่อนง้างดาบ
      await this.triggerSkillEvent('onAttackSwing', attacker, ctx);

      // 3. ทอยลูกเต๋าคำนวณ Critical ล่วงหน้า เพื่อให้ UI เตรียมเอฟเฟกต์
      let currentHitDamage = ctx.damage;
      if (!ctx.shadowStrike) {
        ctx.isCrit = Math.random() * 100 < (attacker.critChance || 0);
        if (ctx.isCrit) currentHitDamage = Math.floor(currentHitDamage * 2); 
      }

      // 📢 4. สั่ง UI เล่นอนิเมชัน และ "รอ" สัญญาณ Impact จาก UI (พร้อม Timeout กันค้าง)
      await new Promise(resolve => {
        let isResolved = false;
        const safeResolve = () => {
          if (!isResolved) { isResolved = true; resolve(); }
        };
        
        window.gameEvents.emit(window.EVENTS.ATTACK_SWING, {
          ...ctx,
          defender: ctx.defender, // ส่ง Defender ปัจจุบันไปให้ UI
          currentHitDamage, 
          onImpact: safeResolve
        });

        setTimeout(safeResolve, 600); // กันเหนียว UI ตายกลางทาง
      });

      if (attacker.hp <= 0) break;

      // เช็ค Stealth ดาเมจทะลุตัว
      ctx.defender = getOppBoard(isP1)[idx];
      if (ctx.defender && (ctx.defender.status?.shadow || 0) > 0) {
        window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, `👻 ${ctx.defender.name} ซ่อนตัว — ดาเมจทะลุฮีโร่`);
        this.damageHero(!isP1, currentHitDamage, attacker);
        window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
        window.gameEvents.emit(window.EVENTS.ATTACK_RECOIL, { idx, isPlayer: isP1 });
        await sleep(150); 
        continue;
      }

      // ⚔️ 5. หักดาเมจจริง (จังหวะ Impact เป๊ะๆ)
      if (ctx.defender && ctx.defender.hp > 0) {
        await this.triggerSkillEvent('onBeforeDefend', ctx.defender, ctx);
        
        if (!ctx.attackMissed && ctx.defender.hp > 0) {
          let logMsg = `⚔️ ${ctx.attacker.name} → ${ctx.defender.name} `;
          if (ctx.shadowStrike) logMsg += `(💥 Shadow) `; 
          else if (ctx.isCrit) logMsg += `(💥 คริ!) `;
          window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, logMsg + `[${currentHitDamage}]`);
          
          ctx.actualDmg = this.applyDamage(ctx.defender, currentHitDamage, !isP1, "normal", attacker);
          await this.triggerSkillEvent('onTakeDamage', ctx.defender, ctx);
          window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
          
          if (attacker.hp > 0) await this.triggerSkillEvent('onAttackHit', attacker, ctx);

          window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
        }
      } else {
        // ตีฮีโร่
        if (ctx.shadowStrike) window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, `💥 Shadow Strike ×2.5 ตรงฮีโร่!`);
        let logMsg = `⚔️ ${ctx.attacker.name} → ฮีโร่ `;
        if (ctx.isCrit) logMsg += `(💥 คริ!) `;
        window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, logMsg + `[${currentHitDamage}]`);
        
        this.damageHero(!isP1, currentHitDamage, attacker);
        
        // ทำให้ Lifesteal/On-Hit ทำงานแม้ตีฮีโร่
        ctx.actualDmg = currentHitDamage; 
        if (attacker.hp > 0) await this.triggerSkillEvent('onAttackHit', attacker, ctx);
        window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
      }
      
      // 📢 6. สั่ง UI ดึงดาบกลับ
      window.gameEvents.emit(window.EVENTS.ATTACK_RECOIL, { idx, isPlayer: isP1 });
      
      await sleep(200); 

      if (attacker.hp <= 0) break;
      await this.triggerSkillEvent('onAfterAttack', attacker, ctx);
    } 
  }

  // ====================== CHECK DEATHS ======================
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
          preventDeath: false 
        };

        await this.triggerSkillEvent('onDeath', card, ctx);

        if (ctx.preventDeath) { card.flags.isDying = false; continue; }

        let currentBoard = getMyBoard(isPlayer);
        let cIdx = currentBoard.indexOf(card);
        
        if (cIdx !== -1) {
          // 📢 ส่งสัญญาณให้ UI ทำเอฟเฟกต์ไพ่แตก
          window.gameEvents.emit(window.EVENTS.CARD_DIED, { card, index: cIdx, isPlayer });
          await sleep(200);

          let grave = this.state.getPlayer(isPlayer).graveyard;
          if (!grave.includes(card)) grave.push(card); 
          currentBoard[cIdx] = null; 
        }
        
        let eventCtx = { deadCard: card, deadIdx: index };
        let myBoardNow = getMyBoard(isPlayer);
        let oppBoardNow = getOppBoard(isPlayer);
        
        for (let i = 0; i < BOARD_SIZE; i++) {
          if (myBoardNow[i] && myBoardNow[i].hp > 0 && myBoardNow[i] !== card) {
            await this.triggerSkillEvent('onAllyDeath', myBoardNow[i], { ...eventCtx, isPlayer: isPlayer, card: myBoardNow[i] });
          }
          if (oppBoardNow[i] && oppBoardNow[i].hp > 0) {
            await this.triggerSkillEvent('onEnemyDeath', oppBoardNow[i], { ...eventCtx, isPlayer: !isPlayer, card: oppBoardNow[i] });
          }
        }
      }
    }
    
    if (changed) {
      // 📢 ถ้าบอร์ดเปลี่ยน สั่งอัปเดตกระดาน
      window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
    }
  }

  // ====================== SHIFT BOARDS ======================
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
      window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, `➡️ <span style="color:#aaa">กระดานเลื่อน...</span>`);
      window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
      await sleep(250);
    }
  }

  // ====================== PROCESS TURN PHASE ======================
  async processTurnPhase(isP1) {
    const player = this.state.getPlayer(isP1);

    for (let i = 0; i < BOARD_SIZE; i++) {
      if (this.state.isGameOver) return;
      
      let pCard = player.board[i];
      if (!pCard || pCard.hp <= 0) continue;
      
      if (!pCard.flags._initialized) { 
        if (typeof initCard === "function") initCard(pCard); 
        pCard.flags._initialized = true; 
      }

      // --- อัปเดตสถานะ (Status Effects) ---
      if (pCard.status?.immortal > 0) pCard.status.immortal--;
      if (pCard.status?.reviveBuff > 0) { 
        pCard.status.reviveBuff--; 
        if (pCard.status.reviveBuff === 0) pCard.atk -= Math.floor(pCard.baseATK * 0.2); 
      }
      if (pCard.status?.corrupt > 0) pCard.status.corrupt--; 
      
      if (pCard.status?.burn > 0) {
        let bd = Math.floor((pCard.maxHP || pCard.hp) * 0.05);
        pCard.status.burn--; 
        
        window.gameEvents.emit(window.EVENTS.LOG_MESSAGE, `🔥 ${pCard.name} ติดไฟ! ดาเมจ ${bd} (เหลือ ${pCard.status.burn} เทิร์น)`);
        
        this.applyDamage(pCard, bd, isP1, "burn");
        await this.checkDeaths();
        
        pCard = player.board[i];
        if (!pCard || pCard.hp <= 0) continue;
      }

      window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
      await sleep(50);

      let ctx = {
        get card() { return player.board[i]; }, 
        idx: i, isPlayer: isP1,
        get myBoard() { return player.board; },
        get oppBoard() { return window.engineState.getOpp(isP1).board; },
        skipAttack: false 
      };

      await this.triggerSkillEvent('onTurnStart', pCard, ctx);
      await this.checkDeaths(); 
      
      pCard = player.board[i]; 
      if (!pCard || pCard.hp <= 0) continue;

      if (!ctx.skipAttack) { 
        let defender = window.engineState.getOpp(isP1).board[i]; 
        await this.executeAttack(pCard, defender, i, isP1); 
        await this.checkDeaths(); 
        
        window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
        await sleep(200); 
      }
      
      pCard = player.board[i]; 
      if (pCard && pCard.hp > 0) {
        await this.triggerSkillEvent('onTurnEnd', pCard, ctx);
        await this.checkDeaths(); 
      }
    }
    
    await this.checkDeaths();
    if (!this.state.isGameOver) await this.shiftBoards();
    window.gameEvents.emit(window.EVENTS.BOARD_UPDATE_NEEDED);
  }

  // ====================== UNIVERSAL SKILL BRIDGE ======================
  async triggerSkillEvent(eventName, entity, ctx) {
    if (!entity || !entity.skills) return;

    if (eventName !== 'onDeath' && eventName !== 'onAllyDeath' && eventName !== 'onEnemyDeath') {
      if (entity.hp <= 0 && !ctx.preventDeath && !(entity.status?.immortal > 0)) return;
    }
    
    let skillDefs = entity.skills
      .map(s => (typeof SKILL_REGISTRY !== 'undefined' ? (SKILL_REGISTRY[s.id] || SKILL_REGISTRY[s.name]) : null))
      .filter(Boolean)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (let skillDef of skillDefs) {
      try {
        if (skillDef.dsl && skillDef.dsl.trigger === eventName && typeof DSLEngine !== 'undefined') {
          ctx.card = entity; 
          await DSLEngine.run(skillDef, ctx);
        } 
        else if (typeof skillDef[eventName] === "function") {
          await skillDef[eventName](ctx);
        }
      } catch (err) {
        console.error(`[SkillEngine] Error on card: ${entity.name}, hook: ${eventName}`, err);
      }
      
      if (ctx.preventDeath && eventName === 'onDeath') break;
    }
  }
}