// ── 7. CARD INIT & DECK ────────────────────────────────────
// ── getCombatStateDefaults ─────────────────────────────────
// Single source of truth สำหรับ combat state fields ทั้งหมด
// ใช้ทั้งใน initCard() และ revival code (แทน hardcode list)
function getCombatStateDefaults(c) {
  return {
    bloodStacks: 0, hasRevived: false, reviveBuffTurns: 0,
    domainTurns: 0, domainUsed: false, fragments: 0,
    hpLostAccum: 0, immortalTurns: 0, critChance: 0,
    isSummoned: !!c.isSummoned, echoesUsed: false, graveContractUsed: false,
    burnTurns: c.burnTurns ?? 0, isDying: false,
    shadowTurns: hasSkill(c, "Shadow Protocol") ? 2 : 0, shadowReady: false,
    airstrikeCharge: 0, sentinelStacks: 0,
    physShield: false, unrevivable: false,
    corruptTurns: 0, devourStacks: 0,
    tyrantEntryDone: false, hunterAuraActive: false, hunterAuraBonus: 0,
    _displayHP: c.hp, _displayATK: c.atk,
  };
}

function initCard(c) {
  // FIX: ใช้ _initialized flag แทน typeof maxHP check
  // — ป้องกัน initCard ซ้ำบนการ์ดที่ revive แล้วมี maxHP อยู่แล้ว
  if (!c || c._initialized) {
    if (c && !combatStats[c.uid]) {
      combatStats[c.uid] = { name: c.name, owner: c.owner, isClone: c.isClone, dmg: 0, taken: 0, heal: 0 };
    }
    return;
  }
  Object.assign(c, {
    baseHP: c.hp, maxHP: c.hp, baseATK: c.atk,
    baseWait: c.waitTime,
    ...getCombatStateDefaults(c),
    _initialized: true,   // ← flag ชัดเจน ป้องกัน double-init
  });
  if (!c.uid) { c.uid = ++cardUidCounter; c.owner = "Unknown"; }
  combatStats[c.uid] = { name: c.name, owner: c.owner, isClone: c.isClone, dmg: 0, taken: 0, heal: 0 };
}

function buildDeck(isPlayer) {
  let d = [], counts = {};
  while (d.length < 10) {
    let c = cardDB[Math.floor(Math.random() * cardDB.length)];
    counts[c.id] = (counts[c.id] || 0);
    if (c.stars === 6 && counts[c.id] >= 1) continue;
    if (c.stars === 5 && counts[c.id] >= 2) continue;
    if (c.stars  <  5 && counts[c.id] >= 3) continue;
    let nc = cloneCard(c); let uid = window.engineState ? window.engineState.generateUID() : Math.floor(Math.random() * 100000);
    nc.owner = isPlayer ? 'พีช' : 'บอส';
    d.push(nc); counts[c.id]++;
  }
  return d;
}