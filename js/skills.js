// ── 3. SKILL REGISTRY ───────────────────────────────────────
const ARMOR_TABLE = {
  "เกราะหิน":      (dmg, _src)  => Math.max(0, dmg - 100),
  "Crimson Frenzy": (dmg, _src)  => Math.min(dmg, 100),
  "Iron Sentinel":  (dmg, src)   => ["airstrike","echoes","tyrant"].includes(src) ? dmg : Math.min(dmg, 130),
};

const DEATH_TABLE = {
  "Ashen Rebirth": (c, _b, _g, slots, i) => {
    if (c.hasRevived || c.unrevivable) return false;
    c.hasRevived = true; c.isDying = false;
    c._displayHP = c.hp; c._displayATK = c.atk; // snapshot
    c.hp = Math.floor(c.maxHP * 0.45); c.atk = Number(c.atk) + Math.floor(c.baseATK * 0.2); c.reviveBuffTurns = 2;
    if (combatStats[c.uid]) combatStats[c.uid].heal += c.hp;
    showFloat("REBIRTH!", slots[i], "skill"); addLog(`🔥 <span class="log-player">${c.name}</span> คืนชีพ!`);
    return true; 
  },
  "Grave Contract": (c, board, grave, slots, _i) => {
    if (c.graveContractUsed) return false;
    c.graveContractUsed = true;
    addLog(`📜 ${c.name} <span class="log-skill">Grave Contract</span>`);

    // ── ✨ GRAVE CONTRACT: spectral pillars on each ally ──
    board.forEach((a, ai) => {
      if (a && a !== c && a.hp > 0) {
        a.hp += 500;
        if (combatStats[c.uid]) combatStats[c.uid].heal += 500;
        showFloat("+500", slots[ai], "heal");

        // Pillar of spectral light on each healed ally
        const sr = getEffectRect(slots[ai]);
        const pillar = document.createElement('div'); pillar.className = 'battle-vfx grave-contract-pillar';
        pillar.style.cssText = `left:${sr.left + sr.width/2 - 35}px;bottom:${window.innerHeight - sr.bottom}px;height:${180 + Math.random()*60}px;--pillar-delay:${ai * 0.1}s;`;
        document.body.appendChild(pillar);
        setTimeout(() => pillar.remove(), 1700);

        // Floating soul orbs
        for (let so = 0; so < 3; so++) {
          const orb = document.createElement('div'); orb.className = 'battle-vfx grave-soul-orb';
          const sz = 10 + Math.random() * 8;
          const ox = (Math.random() - 0.5) * 80;
          const oy = -(100 + Math.random() * 80);
          orb.style.cssText = `width:${sz}px;height:${sz}px;left:${sr.left + sr.width/2 + (Math.random()-0.5)*40}px;top:${sr.top + sr.height/2}px;--gs-x:${ox}px;--gs-y:${oy}px;--gs-dur:${1.2 + Math.random()*0.4}s;--gs-delay:${ai * 0.1 + so * 0.1}s;`;
          document.body.appendChild(orb);
          setTimeout(() => orb.remove(), 2000);
        }
      }
    });
    // ──────────────────────────────────────────────────────

    let bi = -1, mx = -1;
    // ✅ เพิ่ม && !g.unrevivable ตรงนี้
    grave.forEach((g, gi) => { if (!g.name.includes("Chronovex") && !g.unrevivable && g.baseATK > mx) { mx = g.baseATK; bi = gi; } });
    if (bi !== -1) {
      let rv = grave.splice(bi, 1)[0];
      rv.hp = rv.maxHP;
      rv.atk = Math.floor(rv.baseATK * 1.2); rv.isSummoned = true;
      // FIX: ใช้ getCombatStateDefaults แทน hardcode list — เพิ่มสกิลใหม่แก่ที่เดียว
      // force burnTurns/corruptTurns = 0 เพราะการ์ด revive ไม่ควรพกสถานะลบจากชาติก่อน
      Object.assign(rv, getCombatStateDefaults(rv), { burnTurns: 0, corruptTurns: 0 });
      rv._initialized = true; // baseHP/maxHP/baseATK ยังคงเดิม — ไม่ re-init
      let em = board.indexOf(null);
      if (em !== -1) { board[em] = rv; if (combatStats[c.uid]) combatStats[c.uid].heal += rv.maxHP; showFloat("REVIVED!", slots[em], "skill");
      addLog(`✨ ชุบชีวิต ${rv.name}`); }
    }
    return false;
  },
  "Echoes of Oblivion": (c, _b, _g, _slots, bIdx) => {
    if (c.echoesUsed) return false;
    c.echoesUsed = true;
    let cnt = (playerGraveyard.length + enemyGraveyard.length) * 0.12;
    let gCopy = bIdx === 0 ? [...enemyGraveyard] : [...playerGraveyard]; let wDmg = 0;
    for (let w = 0; w < 3 && gCopy.length > 0; w++) { let ri = Math.floor(Math.random() * gCopy.length);
    wDmg += gCopy[ri].baseATK * 0.5; gCopy.splice(ri, 1); }
    let vDmg = Math.min(Math.floor(c.baseATK * cnt + wDmg), 500);
    addLog(`🌌 ${c.name} <span class="log-skill">Echoes of Oblivion</span> <span class="log-dmg">${vDmg} AOE</span>`);
    let tb = bIdx === 0 ? enemyBoard : playerBoard, ts = bIdx === 0 ? enemyBoardSlots : playerBoardSlots;
    tb.forEach((e, idx) => { if (e) { applyDamage(e, vDmg, ts[idx], bIdx !== 0, "echoes", c); if (e.hp > 0 && e.hp < e.maxHP * 0.2) { e.hp = 0; showFloat("INSTANT KILL!", ts[idx], "skill", idx * 80); } } });
    return false;
  },
  "Cataclysm Singularity": (c, board, grave, slots, i, bIdx) => {
    const oBoard = bIdx === 0 ? enemyBoard : playerBoard;
    const oSlots = bIdx === 0 ? enemyBoardSlots : playerBoardSlots;
    const cataDmg = Math.floor((c.baseATK || c.atk) * 2.0);
    addLog(`☄️ ${c.name} <span class="log-skill">Cataclysm Singularity!</span> <span class="log-dmg">AOE ${cataDmg} + Decay MaxHP -20%</span>`);

    // ── ✨ SINGULARITY visual ──
    (() => {
      battlefieldEl?.classList.add('anim-screen-shake');
      sd(() => battlefieldEl?.classList.remove('anim-screen-shake'), 900);
      const ov = document.createElement('div'); ov.className = 'battle-vfx singularity-overlay'; document.body.appendChild(ov);
      setTimeout(() => ov.remove(), 3100);
      const ttl = document.createElement('div'); ttl.className = 'battle-vfx singularity-title';
      ttl.innerHTML = `<span class="st-main">☄️ CATACLYSM SINGULARITY</span><span class="st-sub">— Void Gate Opened —</span>`;
      document.body.appendChild(ttl); sd(() => ttl.remove(), 3200);
      const sRect = getEffectRect(slots?.[i]);
      if (sRect) {
        const cx = sRect.left + sRect.width / 2, cy = sRect.top + sRect.height / 2;
        const sz = 120;
        const core = document.createElement('div'); core.className = 'battle-vfx singularity-core';
        core.style.cssText = `width:${sz}px;height:${sz}px;left:${cx - sz/2}px;top:${cy - sz/2}px;`;
        document.body.appendChild(core); setTimeout(() => core.remove(), 2900);
        [0, 0.2, 0.4].forEach((d, idx) => {
          const ring = document.createElement('div'); ring.className = 'battle-vfx singularity-ring';
          ring.style.cssText = `left:${cx}px;top:${cy}px;--sr-delay:${d}s;--sr-dur:${1.4 + idx*0.15}s;`;
          document.body.appendChild(ring); setTimeout(() => ring.remove(), (2.0 + d) * 1000);
        });
      }
    })();
    // ──────────────────────────

    // FIX: ทำ AOE ตรงนี้เลย (sync กับ checkDeaths loop) แทน setTimeout
    oBoard.forEach((e, idx) => {
      if (!e || e.hp <= 0) return;
      const fl = document.createElement('div'); fl.className = 'battle-vfx singularity-decay-flash';
      oSlots[idx].style.position = 'relative'; oSlots[idx].appendChild(fl);
      applyDamage(e, cataDmg, oSlots[idx], bIdx === 0, "singularity", c);
      const decay = Math.floor(e.maxHP * 0.2);
      e.maxHP = Math.max(1, e.maxHP - decay);
      e.hp = Math.min(e.hp, e.maxHP);
      showFloat(`💀 MaxHP -${decay}`, oSlots[idx], "skill", idx * 100);
      sd(() => fl?.remove(), 1300);
    });
    markDirty(); flushBoard(); updateHeroHP();
    // checkDeaths() จะถูกเรียกโดย loop หลักใน checkDeaths() เองอยู่แล้ว

    return false; // ตัวมันเองตายปกติ
  },
  "Final Judgement": (c, board, grave, slots, i, bIdx) => {
    let oBoard = bIdx === 0 ? enemyBoard : playerBoard;
    let oSlots = bIdx === 0 ? enemyBoardSlots : playerBoardSlots;
    let maxAtk = -1, maxIdx = -1;
    oBoard.forEach((e, idx) => { if (e && e.hp > 0 && e.atk > maxAtk) { maxAtk = e.atk; maxIdx = idx; } });
    
    if (maxIdx !== -1) {
      let tgt = oBoard[maxIdx];
      tgt.hp = 0;
      tgt.unrevivable = true; // ฝังคำสาปห้ามชุบ
      tgt.immortalTurns = 0;  // ล้างอมตะ
      
      let tSlot = oSlots[maxIdx];
      tSlot.style.position = 'relative';
      let cardEl = tSlot.querySelector('.card');

      // 💥 --- VISUAL EFFECT START (หลุมดำมิติ) --- 💥
      battlefieldEl?.classList.add('anim-screen-shake');
      sd(() => battlefieldEl?.classList.remove('anim-screen-shake'), 600);

      const fjOverlay = document.createElement('div'); fjOverlay.className = 'battle-vfx fj-overlay';
      document.body.appendChild(fjOverlay);
      setTimeout(() => fjOverlay.remove(), 1900);

      const fjTitle = document.createElement('div'); fjTitle.className = 'battle-vfx fj-title';
      fjTitle.innerHTML = `<span class="fjt-main">⚰️ FINAL JUDGEMENT</span><span class="fjt-sub">— Void Sentence —</span>`;
      document.body.appendChild(fjTitle);
      setTimeout(() => fjTitle.remove(), 2300);

      // สร้างหลุมดำ
      let vortex = document.createElement('div'); vortex.className = 'blackhole-vortex'; tSlot.appendChild(vortex);
      let particles = document.createElement('div'); particles.className = 'blackhole-particles'; tSlot.appendChild(particles);
      
      // สั่งให้การ์ดหมุนติ้วโดนดูดเข้าไป!
      if (cardEl) {
        cardEl.classList.add('anim-sucked-in');
      }
      
      // เคลียร์ทิ้งหลังเอฟเฟกต์จบ (1.5 วิ)
      setTimeout(() => { 
        vortex.remove(); 
        particles.remove(); 
        if (cardEl) cardEl.classList.remove('anim-sucked-in'); 
      }, 1500);
      // 💥 --- VISUAL EFFECT END --- 💥

      showFloat("🌀 VOIDED!", tSlot, "skill");
      showFloat("❌ UNREVIVABLE", tSlot, "dmg", 300); // หน่วงเวลาเด้งนิดนึง
      
      addLog(`⚰️ ${c.name} <span class="log-skill">Final Judgement</span> ดูด ${tgt.name} หายไปในหลุมดำมิติ! (ชุบไม่ได้)`);
    }
    return false; // ตัวมันเองตายปกติ
  }
};