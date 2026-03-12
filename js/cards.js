// ── 2. CARD DATABASE ───────────────────────────────────────
const cardDB = [
  { id:1,  name:"Goblin",   hp:300,  atk:150, waitTime:2, stars:1, image:"https://i.postimg.cc/tCkDpygS/b699f533da1b9c729a446f7521186312.webp",  skills:[{id:"เจาะเกราะ",    name:"🗡️ เจาะเกราะ", desc:"ตีทะลุเข้าหน้าฮีโร่ 50%"}] },
  { id:2,  name:"Hellhound",hp:450,  atk:250, waitTime:2, stars:2, image:"https://i.postimg.cc/pXs7kKKf/9d17994d-4035-4cf3-8493-bf4412b9d28d.jpg",  skills:[{id:"พ่นไฟ",         name:"🔥 พ่นไฟ", desc:"ยิงลูกไฟทำดาเมจ 100 ก่อนพุ่งชน"}] },
  { id:3,  name:"Artemis",  hp:600,  atk:350, waitTime:3, stars:3, image:"https://i.postimg.cc/Gpdy2TSg/a475e71e-0f52-42ec-bff2-6b2b81fad58a.jpg",  skills:[{id:"ยิงแฝด",        name:"🏹 ยิงแฝด", desc:"โจมตี 2 ครั้ง"},{id:"หลบหลีก",name:"💨 หลบหลีก", desc:"โอกาส 50% หลบดาเมจ"}] },
  { id:4,  name:"Ares",     hp:800,  atk:400, waitTime:4, stars:4, image:"https://i.postimg.cc/Px1PhXd8/1966f728-8f4c-4bf8-b436-f214325d3a6c.jpg",  skills:[{id:"ตีกระจาย",     name:"⚔️ ตีกระจาย", desc:"โดนข้างๆ 50%"},{id:"สะท้อน",name:"🛡️ สะท้อน", desc:"สะท้อนดาเมจ 50%"},{id:"คลุ้มคลั่ง",name:"💪 คลุ้มคลั่ง", desc:"โจมตีแล้ว ATK+50"}] },
  { id:5,  name:"Titan",    hp:1200, atk:500, waitTime:6, stars:5, image:"https://i.postimg.cc/Rhf1k5YZ/42e365f9-ad0d-4f18-a1d2-10af673a512f.jpg",  skills:[{id:"เกราะหิน",     name:"⛰️ เกราะหิน", desc:"ลดดาเมจรับ 100"},{id:"ฟื้นฟู",name:"❤️ ฟื้นฟู", desc:"ฟื้นฟูเลือด 100"},{id:"สตัน",name:"⚡ สตัน", desc:"ลด ATK ศัตรู 50"}] },
  { id:97, name:"Chrono Arbiter", hp:880, atk:390, waitTime:5, stars:6, isUR:true, image:"https://i.postimg.cc/kGTRNFMP/8cc2d32e-471d-4222-b59e-d978217ae905.jpg",
    skills:[
      {id:"Temporal Summon",    name:"⏳ Temporal Summon",    desc:"ก่อนโจมตี: เรียกการ์ดพันธมิตร Wait สูงสุดจากมือลงสนาม + มอบโล่กันกายภาพ 1 ฮิต"},
      {id:"Restoration Pulse",  name:"💖 Restoration Pulse",  desc:"หลังโจมตี: ฟื้นฟู HP ให้พันธมิตรที่ HP ต่ำสุด 150% ของ ATK"},
      {id:"Final Judgement",    name:"⚰️ Final Judgement",    desc:"ตาย: ฆ่าศัตรู ATK สูงสุดทันที (ห้ามป้องกัน/ห้ามชุบชีวิต)"}
    ] 
  },
  { id:98, name:"Chronovex Rift Conductor", hp:800,  atk:400, waitTime:5, stars:6, isUR:true, image:"https://i.postimg.cc/zfvWgthR/2c78b3fd-d165-46a2-b035-7eb71d6d7d28.jpg",
    skills:[{id:"Rift Deployment",       name:"🌀 Rift Deployment",       desc:"เริ่มเกม: วาร์ปลงสนาม + อัญเชิญการ์ด Wait สูงสุด (Haste)"},{id:"Temporal Acceleration",name:"⏳ Temporal Acceleration",desc:"ลด CD มือ 1, บัฟเพื่อน ATK/HP +30%, ฮีล 10% ถ้ามีเพื่อน Cost 6+"},{id:"Grave Contract",         name:"📜 Grave Contract",         desc:"เมื่อตาย: ฮีลเพื่อน +500 + ชุบชีวิตการ์ด ATK สูงสุด (ATK +20%)"}] },
  { id:99, name:"Abyssal Lord", hp:500, atk:500, waitTime:5, stars:6, isUR:true, image:"https://i.postimg.cc/KvkDTLcP/e3d314c0-5428-4f01-bad7-06d25ab6f4fa.jpg",
    skills:[{id:"Soul Rip",          name:"💀 Soul Rip",          desc:"สร้าง Clone ศัตรูสุ่ม โคลนตายระเบิดเป้า HP สูงสุด 50% ATK"},{id:"Crimson Frenzy",     name:"🩸 Crimson Frenzy",     desc:"Blood Armor cap 100 | Blood Stack ดูด 10% สะสม 3 ชั้น → Blood Nova AOE"},{id:"Echoes of Oblivion", name:"🌌 Echoes of Oblivion", desc:"ตาย: AOE ตามสุสาน สูงสุด 500 ทะลุเกราะ HP<20% ตายทันที"}] },
  { id:100, name:"Aeternus of Undying", hp:1500, atk:300, waitTime:6, stars:6, isUR:true, image:"https://i.postimg.cc/C17hNmYH/82f3cd3d-3bd1-46af-8d29-16f82bb24167.jpg",
    skills:[{id:"Ashen Rebirth",   name:"🔥 Ashen Rebirth",   desc:"คืนชีพ 1 ครั้ง (HP 45%) ATK +20% 2 เทิร์น"},{id:"Grave Domain",     name:"🪦 Grave Domain",     desc:"กางอาณาเขต 3 เทิร์น: ศัตรู ATK-20% HP-5%/โจมตี เราฮีล 8%/เทิร์น"},{id:"Immortal Tyrant",  name:"👑 Immortal Tyrant",  desc:"เสีย HP ทุก 25% ได้ Soul Fragment ครบ 4: ฟื้น 50% อมตะ 1 เทิร์น AOE 200%"}] },
  { id:101, name:"Ghost Zero", hp:950, atk:420, waitTime:6, stars:6, isUR:true, image:"https://i.postimg.cc/qvRq32d8/732c2394-755d-43d5-af08-578719af29c4.jpg",
    skills:[{id:"Shadow Protocol",  name:"👻 Shadow Protocol",  desc:"ลงสนาม: เข้าสู่ Stealth 2 เทิร์น (ไม่สามารถถูกเลือกเป็นเป้าหมายได้) | เมื่อ Stealth สิ้นสุด โจมตีเป้าหมาย HP สูงสุดด้วย Assassination Strike สร้างดาเมจ ×2.5 และรับประกัน Critical Hit"},{id:"Airstrike Omega",   name:"🚀 Airstrike Omega",   desc:"ชาร์จพลัง 3 เทิร์น จากนั้นปล่อยการโจมตีทางอากาศ สร้าง AOE 160% ATK ทะลุเกราะ และติด Burn 2 เทิร์น (สร้างความเสียหายต่อเนื่อง)"},{id:"Iron Sentinel",     name:"🛡️ Iron Sentinel",     desc:"ระบบป้องกันอัตโนมัติ: ความเสียหายต่อครั้งไม่เกิน 130 | Counterstrike สะท้อนดาเมจ 40% กลับผู้โจมตี | Battle Hardened: ทุกครั้งที่ถูกโจมตี ATK +35 (สูงสุด 10 ชั้น)"}] },
  { id:102, name:"Tyrant of the Fallen", hp:900, atk:450, waitTime:6, stars:6, isUR:true, image:"https://i.postimg.cc/BbkckYvb/1aaf4207-c764-481c-b88d-92575a364df1.jpg",
    skills:[
      {id:"Devour the Weak",       name:"💀 Devour the Weak",       desc:"ลงสนาม: ทำลายศัตรู ATK ต่ำสุดทันที → รับ ATK/HP +200% ของเหยื่อ แล้วโจมตีทันที 1 ครั้ง"},
      {id:"Power from the Fallen", name:"⚡ Power from the Fallen",  desc:"ทำลายศัตรู: ATK +20%, ฮีล HP 15% ของ Max HP"},
      {id:"Hunter's Aura",         name:"🦁 Hunter's Aura",          desc:"Ongoing: ถ้าศัตรู Wait ต้นทาง < 3 บนสนาม → ATK +30% (toggle)"},
    ]},
  { id:103, name:"Void Dragon", hp:1300, atk:360, waitTime:6, stars:6, isUR:true, image:"https://i.postimg.cc/3rjb2yXk/4c3cfe66-67a1-49c9-b4e6-67500d0ca177.jpg",
    skills:[
      {id:"Void Breath",              name:"🌌 Void Breath",              desc:"โจมตี: AOE 140% ATK ใส่ศัตรูทั้งหมด + ติด Corrupt 2 เทิร์น (รับดาเมจ +20%)"},
      {id:"Abyss Devour",             name:"🕳 Abyss Devour",             desc:"ศัตรูตาย: ดูดวิญญาณ ฮีล HP 10% + ATK +40 (สูงสุด 8 ชั้น)"},
      {id:"Cataclysm Singularity",    name:"☄️ Cataclysm Singularity",    desc:"ตาย: AOE 200% ATK ใส่ศัตรูทั้งหมด + ลด Max HP 20%"}
    ] },
];