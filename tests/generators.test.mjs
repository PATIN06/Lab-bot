// เปิด tests/index.html ผ่าน http.server — ตรวจตัวสร้างโจทย์ส่วนที่ 1/2 และไฟล์รูป
const v = "?v=" + Date.now();
const { buildMcq, makeMcqQuestions, TOPIC_KEYS } = await import("../assets/js/quiz-mcq.js" + v);
const { layoutName, buildSpell } = await import("../assets/js/quiz-spelling.js" + v);

const data = await (await fetch("../data/plants.json")).json();
const out = [];
const log = (...a) => out.push(a.join(" "));
const all = [];
for (const l of data.labs) for (const p of l.plants) { p.lab = l.id; all.push(p); }
let fail = 0;
const bad = (m) => { fail++; if (fail < 25) log("FAIL", m); };

// รูปทุกรูปมีไฟล์จริง
for (const p of all) {
  const r = await fetch("../" + p.image, { method: "HEAD" });
  if (!r.ok) bad("missing image " + p.id);
}

const key = (v) => v.toLowerCase().replace(/\s+/g, " ").trim();
for (const lab of [...data.labs.map((l) => l.id), "all"]) {
  const plants = lab === "all" ? all : all.filter((p) => p.lab === lab);
  for (const fromMode of ["name", "image", "mixed"]) {
    const qs = makeMcqQuestions({ plants, allPlants: all, count: 200, topics: TOPIC_KEYS, fromMode });
    if (qs.length !== 200) bad(`lab ${lab} ${fromMode}: ได้ ${qs.length}/200 ข้อ`);
    for (const q of qs) {
      if (q.options.length !== 5) bad(`${q.spec.plantId} options=${q.options.length}`);
      const keys = q.options.map((o) => key(o.text));
      if (new Set(keys).size !== 5) bad(`${q.spec.plantId} ${q.topic} ซ้ำ ${keys}`);
      if (q.options.filter((o) => o.correct).length !== 1) bad("ไม่มีข้อถูกเดียว");
      if (q.from === "image" && q.plant.thaiName && q.promptHtml.includes(q.plant.thaiName)) bad("โจทย์รูปมีชื่อพืช " + q.plant.id);
      // ตัวเลือกหลอกต้องไม่เท่าค่าของพืชอื่นที่ชื่อเดียวกัน (ซึ่งถูกด้วย)
      const same = all.filter((p) => p.id !== q.plant.id && (p.thaiName === q.plant.thaiName || (p.scientificName && p.scientificName === q.plant.scientificName)));
      const getters = { family: "family", name: "thaiName", sci: "scientificName", uses: "uses", constituents: "constituents", part: "partUsed" };
      for (const s of same) {
        const v = s[getters[q.topic]];
        if (v && key(v) !== key(q.correctText) && q.options.some((o) => !o.correct && key(o.text) === key(v))) bad(`distractor ถูกด้วย ${q.plant.id}/${s.id}`);
      }
    }
  }
}
// ส่วนที่ 2 — รูปแบบช่อง
const wantCells = { "Trigonella foenum-graecum": ["-"], "Cananga odorata var. fruticosa": ["."], "Rosa spp.": ["."], "Mentha × piperita": ["×"] };
for (const [name, fixedChars] of Object.entries(wantCells)) {
  const w = layoutName(name);
  const fixed = w.flat().filter((c) => c.fixed).map((c) => c.ch);
  if (JSON.stringify(fixed) !== JSON.stringify(fixedChars)) bad(`layout ${name}: fixed=${fixed}`);
  log(name, "→", w.map((x) => x.map((c) => (c.fixed ? `[${c.ch}]` : "_")).join("")).join(" | "));
}
for (const p of all.filter((p) => p.scientificName)) {
  for (const d of ["easy", "medium", "hard"]) {
    const q = buildSpell(p, d, "name");
    const letters = q.words.flat().filter((c) => !c.fixed).length;
    if (d === "hard" && q.open.size) bad("hard มีช่องเปิด");
    if (d === "medium" && q.open.size !== q.words.filter((w) => w.some((c) => !c.fixed)).length) bad(`medium ${p.id} open=${q.open.size} words=${q.words.length}`);
    if (d === "easy" && (q.open.size < 1 || q.open.size > letters)) bad("easy " + p.id);
  }
}
log("plants:", all.length, "without sci:", all.filter((p) => !p.scientificName).map((p) => p.id));
log(fail ? `FAILED ${fail}` : "ALL PASS");
document.body.textContent = out.join("\n");
window.__result = { fail, out };
