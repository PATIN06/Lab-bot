import { $, $$, esc, shuffle, pad2, fmtTime, stripHtml, sciHtml, placeholder, openLightbox, closeLightbox } from "./util.js?v=26";
import { route, navigate, start } from "./router.js?v=26";
import { getState, recordResult, saveSetup, averagePct } from "./storage.js?v=26";
import { TOPICS, TOPIC_KEYS, makeMcqQuestions, buildMcq } from "./quiz-mcq.js?v=26";
import { officeHtml } from "./office.js?v=26";
import { initFx } from "./fx.js?v=26";
import { makeQcQuestions, buildQc } from "./quiz-qc.js?v=26";
import { DIFFICULTY, makeSpellQuestions, buildSpell, mountSpell } from "./quiz-spelling.js?v=26";

// เปิด/ปิดการทำข้อสอบ: false = ปิดเฉพาะส่วนทำข้อสอบ (ทบทวน/เฉลย/เคล็ดลับยังใช้ได้)
const EXAM_OPEN = true;

const app = $("#app");
let DATA = null;
let ALL = [];
let QC = null;
let PG = null;
let RG = null;
let R2 = null;
let TP = null;
let CP = null;
let T2 = null;
const qcById = new Map();
const byId = new Map();
let session = null; // { cfg, qs, i, results, t0, saved }

const RING = ["L1-06", "L2-18", "L3-09", "L4-29", "L5-10", "L6-06", "L7-23", "L2-16"];
const HERO_IMG = "./images/lab1/06.webp";
const PASS_PCT = 80;

/* ---------- data ---------- */
async function loadData() {
  const res = await fetch("./data/plants.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("โหลด plants.json ไม่ได้");
  DATA = await res.json();
  try {
    QC = await (await fetch("./data/qc.json", { cache: "no-cache" })).json();
    for (const f of QC.files) qcById.set(f.id, f);
  } catch (e) {
    QC = { files: [] };
  }
  try {
    PG = await (await fetch("./data/pg.json", { cache: "no-cache" })).json();
    for (const f of PG.files) qcById.set(f.id, f);
    RG = await (await fetch("./data/rg.json", { cache: "no-cache" })).json();
    for (const f of RG.files) qcById.set(f.id, f);
    R2 = await (await fetch("./data/r2.json", { cache: "no-cache" })).json();
    for (const f of R2.files) qcById.set(f.id, f);
    TP = await (await fetch("./data/tp.json", { cache: "no-cache" })).json();
    for (const f of TP.files) qcById.set(f.id, f);
    CP = await (await fetch("./data/cp.json", { cache: "no-cache" })).json();
    for (const f of CP.files) qcById.set(f.id, f);
    T2 = await (await fetch("./data/t2.json", { cache: "no-cache" })).json();
    for (const f of T2.files) qcById.set(f.id, f);
  } catch (e) {
    PG = { files: [] };
    RG = { files: [] };
    R2 = { files: [] };
    TP = { files: [] };
    CP = { files: [] };
    T2 = { files: [] };
  }
  for (const lab of DATA.labs) {
    for (const p of lab.plants) {
      p.lab = lab.id;
      p.labTitle = lab.title;
      ALL.push(p);
      byId.set(p.id, p);
    }
  }
}
const labById = (id) => DATA.labs.find((l) => String(l.id) === String(id));
const labChip = (id) => `<span class="chip"><i class="dot"></i>${esc(labById(id)?.title ?? "LAB " + pad2(id))}</span>`;
const chip = (t, kind = "") => `<span class="chip ${kind}"><i class="dot"></i>${esc(t)}</span>`;

/* ---------- chrome ---------- */
function setNav(name) {
  $$(".nav-desktop a").forEach((a) => a.classList.toggle("active", a.dataset.nav === name));
}
function closeMenu() {
  $("#mobileMenu").hidden = true;
  $("#menuBtn").setAttribute("aria-expanded", "false");
  document.body.classList.remove("noscroll");
}
$("#menuBtn").addEventListener("click", () => {
  const m = $("#mobileMenu");
  const open = m.hidden;
  m.hidden = !open;
  $("#menuBtn").setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("noscroll", open);
});
$("#mobileMenu").addEventListener("click", (e) => e.target.closest("a") && closeMenu());
$("#lightbox").addEventListener("click", closeLightbox);
window.addEventListener("keydown", (e) => e.key === "Escape" && (closeLightbox(), closeMenu()));
document.addEventListener("click", (e) => {
  const z = e.target.closest("[data-zoom]");
  if (z) openLightbox(z.dataset.zoom, z.dataset.alt || "");
});
window.addEventListener("scroll", () => $("#header").classList.toggle("solid", scrollY > 24), { passive: true });

function show(html, { nav = "", title = "" } = {}) {
  closeMenu();
  closeLightbox();
  app.innerHTML = html;
  setNav(nav);
  document.title = title ? `${title} — รวมข้อสอบ` : "รวมข้อสอบ";
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
  initFx(app);
}

const arrowBtn = (label, attrs = "", cls = "btn-square") => `<button ${/\btype=/.test(attrs) ? "" : 'type="button"'} class="${cls}" ${attrs}>${label} <span class="arr" aria-hidden="true">↗</span></button>`;
const arrowLink = (label, href, cls = "btn-square") => `<a class="${cls}" href="${href}">${label} <span class="arr" aria-hidden="true">↗</span></a>`;

function img(p, cls = "") {
  return `<img class="${cls}" src="./${esc(p.image)}" alt="${esc(p.thaiName)}" loading="lazy" decoding="async" width="640" height="640">`;
}

function plantCard(p) {
  const row = (k, v, html) => (v ? `<div class="kv"><dt class="mono">${k}</dt><dd>${html ?? esc(v)}</dd></div>` : "");
  return `<article class="pcard">
    <button type="button" class="pimg" data-zoom="./${esc(p.image)}" data-alt="${esc(p.thaiName)}" aria-label="ขยายรูป ${esc(p.thaiName)}">${img(p)}</button>
    <div class="pbody">
      <div class="pchips">${labChip(p.lab)}${p.groupTag ? chip(p.groupTag) : ""}${p.highlight ? chip("HIGHLIGHT", "hl") : ""}</div>
      <h3>${p.no}. ${esc(p.thaiName)}</h3>
      <dl>
        ${row("SCI-NAME", p.scientificNameFull, sciHtml(p))}
        ${row("FAMILY", p.family)}
        ${row("CONSTITUENTS", p.constituents)}
        ${row("PART USED", p.partUsed)}
        ${row("USES", p.uses)}
      </dl>
    </div>
  </article>`;
}

/* ---------- home ---------- */
function metricsHtml() {
  const st = getState();
  const avg = averagePct();
  const cell = (num, unit, label) => `<div class="metric reveal"><div class="num">${num}<span class="unit mono">${unit}</span></div><div class="mono dim">${label}</div></div>`;
  return `<section class="wrap metrics" aria-label="สถิติ">
    ${cell(ALL.length, "PLANTS", "พืชทั้งหมด")}
    ${cell(DATA.labs.length, "LABS", "จำนวน Lab")}
    ${cell(avg === null ? "—" : avg, avg === null ? "" : "%", "คะแนนเฉลี่ยของฉัน")}
    ${cell(st.answered, "Q", "ข้อที่ทำไปแล้ว")}
  </section>`;
}

function labCards() {
  const st = getState();
  const card = (key, title, count, labNo) => {
    const best = st.best[key];
    const pass = best >= PASS_PCT;
    return `<article class="bento-card reveal" data-tilt="6">
      <div class="bento-top">${labNo ? "" : chip("ALL LABS")}${best === undefined ? chip("NO SCORE") : pass ? chip(`PASS ${best}%`, "pass") : chip(`BEST ${best}%`)}</div>
      <h3>${esc(title)}</h3>
      <p class="mono dim">${count} พืช</p>
      <div class="bento-actions">
        ${EXAM_OPEN
          ? `${arrowLink("ส่วนที่ 1", `#/lab/${key}/part1`)}${arrowLink("ส่วนที่ 2", `#/lab/${key}/part2`, "btn-ghost")}`
          : arrowLink("ทบทวน / เฉลย", key === "all" ? "#/review" : `#/review/${key}`)}
      </div>
    </article>`;
  };
  return `<div class="bento">${DATA.labs.map((l) => card(String(l.id), l.title, l.plants.length, l.id)).join("")}${card("all", "รวมทุก Lab", ALL.length, null)}</div>`;
}


/* ---------- office (home) data ---------- */
function timeAgo(ts) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return "เมื่อครู่";
  if (m < 60) return `${m} นาทีก่อน`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ชม.ก่อน`;
  return `${Math.round(h / 24)} วันก่อน`;
}

function setName(key) {
  if (key === "all") return "รวมทุก Lab";
  const f = qcById.get(key);
  if (f) return `${f.id.slice(0, 2).toUpperCase()} ${pad2(f.no)} · ${f.title}`;
  return labById(key)?.title ?? key;
}

function officeData() {
  const st = getState();
  const bests = (keys) => keys.map((k) => st.best[k]).filter((v) => v !== undefined);
  const mean = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  const stateOf = (a) => (!a.length ? "new" : mean(a) >= PASS_PCT ? "ok" : "warn");
  const labKeys = DATA.labs.map((l) => String(l.id));
  const qcKeys = QC.files.map((f) => f.id);
  const pgKeys = PG.files.map((f) => f.id);
  const rgKeys = RG.files.map((f) => f.id);
  const r2Keys = R2.files.map((f) => f.id);
  const tpKeys = TP.files.map((f) => f.id);
  const cpKeys = CP.files.map((f) => f.id);
  const t2Keys = T2.files.map((f) => f.id);
  const room = (key, short, title, href, tone, meta, keys) => {
    const b = bests(keys);
    return { key, short, title, href, tone, meta, avg: mean(b), state: stateOf(b) };
  };
  const rooms = [
    room("labs", "วิชา 1 · แลปกริ้ง", "ปฏิบัติการการค้นพบยาจากแหล่งธรรมชาติ", "#/labs", "blue", `${DATA.labs.length} Lab · ${ALL.length} พืช`, labKeys),
    room("qc", "วิชา 2 · QC", "เครื่องมือวิเคราะห์ทางเภสัชกรรม", "#/qc", "cyan", `${QC.files.length} ชุด`, qcKeys),
    room("pg", "วิชา 3 · เภสัชเวท", "Pharmacognosy", "#/pg", "green", `${PG.files.length} ชุด`, pgKeys),
    room("rg", "วิชา 4 · R&D", "R&D ยา ชุด 1 และ 2", "#/rg", "violet", `2 ชุด · ${RG.files.length + R2.files.length} ไฟล์`, [...rgKeys, ...r2Keys]),
  ];
  const allKeys = [...labKeys, ...qcKeys, ...pgKeys, ...rgKeys, ...r2Keys, ...tpKeys, ...t2Keys, ...cpKeys];
  const attempted = bests(allKeys);
  const weak = allKeys.filter((k) => st.best[k] !== undefined && st.best[k] < PASS_PCT).length;
  const banner = weak
    ? { tone: "warn", title: `มี ${weak} ชุดที่ควรทบทวน`, text: "คะแนนสูงสุดยังไม่ถึง 80% — ลองทำซ้ำหรือดูเฉลยก่อน", href: "#/review" }
    : attempted.length
      ? { tone: "ok", title: "ทำได้ดีมาก ทุกชุดที่ทำไว้ผ่านเกณฑ์", text: "เลือกห้องต่อไปเพื่อซ้อมเพิ่ม", href: "#/labs" }
      : { tone: "ok", title: "ยินดีต้อนรับสู่ออฟฟิศรวมข้อสอบ", text: "เลือกห้องวิชาเพื่อเริ่มซ้อมสอบ หรือเข้าห้องทบทวนเพื่อดูเฉลย", href: "#/labs" };
  const avg = averagePct();
  const totalSets = allKeys.length;
  const alerts = st.history.slice(0, 3).map((h) => ({
    tone: h.pct >= PASS_PCT ? "pass" : "fail",
    title: setName(h.labKey),
    text: `ได้ ${h.pct}% (${h.score}/${h.total} ข้อ)`,
    time: timeAgo(h.ts),
  }));
  const barOf = (keys, label, tone, hrefOf, subOf, titleOf) =>
    keys.map((k, i) => ({ id: k, label: `${label}${i + 1}`, tone, href: hrefOf(k), sub: subOf(k), title: titleOf(k), state: st.best[k] === undefined ? "new" : st.best[k] >= PASS_PCT ? "ok" : "warn" }));
  const open = EXAM_OPEN;
  const sets = [
    ...barOf(labKeys, "L", "blue", (k) => (open ? `#/lab/${k}/part1` : `#/review/${k}`), (k) => (st.best[k] === undefined ? "ใหม่" : `${st.best[k]}%`), (k) => setName(k)),
    ...barOf(qcKeys, "Q", "cyan", (k) => (open ? `#/qc/${k}/all` : `#/qc/${k}/key`), (k) => (st.best[k] === undefined ? "ใหม่" : `${st.best[k]}%`), (k) => setName(k)),
    ...barOf(pgKeys, "P", "green", (k) => (open ? `#/pg/${k}/all` : `#/pg/${k}/key`), (k) => (st.best[k] === undefined ? "ใหม่" : `${st.best[k]}%`), (k) => setName(k)),
    ...barOf(cpKeys, "C", "cyan", (k) => (open ? `#/cp/${k}/all` : `#/cp/${k}/key`), (k) => (st.best[k] === undefined ? "ใหม่" : `${st.best[k]}%`), (k) => setName(k)),
    ...barOf(tpKeys, "T", "blue", (k) => (open ? `#/tp/${k}/all` : `#/tp/${k}/key`), (k) => (st.best[k] === undefined ? "ใหม่" : `${st.best[k]}%`), (k) => setName(k)),
    ...barOf(t2Keys, "U", "blue", (k) => (open ? `#/t2/${k}/all` : `#/t2/${k}/key`), (k) => (st.best[k] === undefined ? "ใหม่" : `${st.best[k]}%`), (k) => setName(k)),
    ...barOf(r2Keys, "S", "violet", (k) => (open ? `#/r2/${k}/all` : `#/r2/${k}/key`), (k) => (st.best[k] === undefined ? "ใหม่" : `${st.best[k]}%`), (k) => setName(k)),
    ...barOf(rgKeys, "R", "violet", (k) => (open ? `#/rg/${k}/all` : `#/rg/${k}/key`), (k) => (st.best[k] === undefined ? "ใหม่" : `${st.best[k]}%`), (k) => setName(k)),
  ];
  return {
    banner,
    rooms,
    hub: { title: "รวมข้อสอบ", meta: `6 วิชา · ${totalSets} ชุด`, href: open ? "#/setup" : "#/review" },
    stats: [
      { n: avg === null ? "—" : avg, unit: avg === null ? "" : "%", label: "คะแนนเฉลี่ยของฉัน" },
      { n: st.answered, unit: "Q", label: "ข้อที่ทำไปแล้ว" },
      { n: totalSets, unit: "SETS", label: "ชุดข้อสอบทั้งหมด" },
      { n: ALL.length, unit: "PLANTS", label: "พืชทั้งหมด" },
    ],
    alerts,
    shortcuts: [
      ...(open ? [{ icon: "▶", label: "เริ่มทำข้อสอบ", href: "#/setup" }] : []),
      { icon: "✚", label: "วิชา 5 · Therapy 3", href: "#/tp" },
      { icon: "✚", label: "วิชา 5 · Therapy 3 ชุด 2", href: "#/t2" },
      { icon: "⚗", label: "วิชา 6 · Ceutic 1", href: "#/cp" },
      { icon: "◎", label: "ทบทวนพืช / เฉลย", href: "#/review" },
      { icon: "✦", label: "เคล็ดลับข้อสอบ", href: "#/tips" },
      { icon: "≡", label: "รายชื่อชุดข้อสอบ", href: "#/labs" },
    ],
    sets,
  };
}

function homeView() {
  show(
    `${officeHtml(officeData())}
    <section class="wrap section" id="labs"><div class="sec-head"><span class="chip"><i class="dot"></i>วิชา 1</span><h2>ปฏิบัติการการค้นพบยาจากแหล่งธรรมชาติ</h2><p class="dim">${EXAM_OPEN ? "แต่ละ Lab มีส่วนที่ 1 (ปรนัย) และส่วนที่ 2 (สะกดชื่อวิทยาศาสตร์)" : "ขณะนี้ปิดการทำข้อสอบชั่วคราว — ทบทวนพืชและดูเฉลยได้ตามปกติ"}</p></div>${labCards()}</section>
    <section class="wrap section" id="qc"><div class="sec-head"><span class="chip"><i class="dot"></i>วิชา 2</span><h2>เครื่องมือวิเคราะห์ทางเภสัชกรรม (QC)</h2><p class="dim">ปรนัย 5 ตัวเลือก ไฟล์ละ 20 ข้อ จากเนื้อหา 9 หัวข้อ</p></div>${setCards("qc")}</section>
    <section class="wrap section" id="pg"><div class="sec-head"><span class="chip"><i class="dot"></i>วิชา 3</span><h2>เภสัชเวท (Pharmacognosy)</h2><p class="dim">ปรนัย 5 ตัวเลือก ไฟล์ละ 20 ข้อ จากเนื้อหา 7 หัวข้อ (น้ำมันหอมระเหย ควิโนน ฟีนอลิก แทนนิน ไซยาโนเจนิก สารอื่น ๆ และแอลคาลอยด์)</p></div>${setCards("pg")}</section>
    <section class="wrap section" id="rg"><div class="sec-head"><span class="chip"><i class="dot"></i>วิชา 4</span><h2>R&D ยา (Research & Development)</h2><p class="dim">ปรนัย 5 ตัวเลือก ไฟล์ละ 20 ข้อ จากเนื้อหา 7 หัวข้อ (ขึ้นทะเบียนยา ASEAN guideline ACTD ชีววัตถุ CRA ยาชีววัตถุ R&D และสิทธิบัตร/ทรัพย์สินทางปัญญา)</p></div>${setCards("rg")}</section>
    <section class="wrap section" id="cp"><div class="sec-head"><span class="chip"><i class="dot"></i>วิชา 6</span><h2>Ceutic 1 (เภสัชภัณฑ์ 1)</h2><p class="dim">ปรนัย 5 ตัวเลือก ไฟล์ละ 20 ข้อ จาก 6 หัวข้อ (ยาน้ำใส 1–2, Herbal liquid solutions, Stability and shelf life, QC และเอกสาร, บรรจุภัณฑ์)</p></div>${setCards("cp")}</section>
    <section class="wrap section" id="tp"><div class="sec-head"><span class="chip"><i class="dot"></i>วิชา 5</span><h2>Therapy 3 (เภสัชบำบัด 3)</h2><p class="dim">ปรนัย 5 ตัวเลือก ไฟล์ละ 20 ข้อ จาก 13 หัวข้อ (GU, หลักการมะเร็ง, Supportive care, ยาเคมีบำบัด, Targeted/Immuno/Hormonal, มะเร็งลำไส้ ปอด ปากมดลูก เต้านม, SSTI, SLE/LN, โรคเขตร้อน)</p></div>${setCards("tp")}</section>
    <section class="wrap section" id="t2"><div class="sec-head"><span class="chip"><i class="dot"></i>วิชา 5 · ชุดที่ 2</span><h2>Therapy 3 — ข้อสอบชุดที่ 2</h2><p class="dim">ข้อสอบอีกชุด 13 ไฟล์ ไฟล์ละ 20 ข้อ ตัวเลือกออกให้ใกล้เคียงโจทย์ และเฉลยบอกหน้าสไลด์ที่อ้างอิง</p></div>${setCards("t2")}</section>
    <section class="wrap section" id="r2"><div class="sec-head"><span class="chip"><i class="dot"></i>วิชา 4 · ชุดที่ 2</span><h2>R&D ยา — ข้อสอบชุดที่ 2</h2><p class="dim">ข้อสอบอีกชุดหนึ่ง 7 ไฟล์ ไฟล์ละ 20 ข้อ (ไฟล์ 6 และ 7 ออกตามจุดที่อาจารย์เน้น)</p></div>${setCards("r2")}</section>
    <section class="wrap section"><div class="tip-teaser reveal" data-tilt="3"><h2>เคล็ดลับข้อสอบ</h2><p class="dim">คำถามที่อาจารย์ชอบออก และพืชที่ต้องเพ่งเล็งเป็นพิเศษ</p>${arrowLink("ดูเคล็ดลับ", "#/tips", "btn-ghost")}</div></section>`,
    { nav: "" }
  );
}

function labsView() {
  show(`<section class="wrap section page-top"><div class="sec-head"><h1 class="h-page">วิชา 1 · ปฏิบัติการการค้นพบยาจากแหล่งธรรมชาติ</h1><p class="dim">เลือก Lab และส่วนที่ต้องการซ้อม</p></div>${labCards()}</section>`, { nav: "labs", title: "Labs" });
}

/* ---------- setup ---------- */
const defaults = { lab: "all", part: "part1", count: "20", from: "mixed", difficulty: "medium", highlight: false, topics: TOPIC_KEYS };

function setupView(params = {}) {
  const last = getState().setup || {};
  const cfg = { ...defaults, ...last };
  if (params.id) cfg.lab = params.id;
  if (params.part) cfg.part = params.part;
  const radio = (name, items, cur) =>
    `<div class="seg" role="radiogroup">${items.map(([v, l]) => `<label class="seg-item"><input type="radio" name="${name}" value="${v}" ${String(cur) === String(v) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>`;
  const labItems = [["all", "รวมทุก Lab"], ...DATA.labs.map((l) => [String(l.id), l.title])];
  show(
    `<section class="wrap section page-top narrow">
      <h1 class="h-page">ตั้งค่าข้อสอบ</h1>
      <form id="setup" class="setup">
        <fieldset><legend class="mono">LAB</legend>${radio("lab", labItems, cfg.lab)}</fieldset>
        <fieldset><legend class="mono">ส่วน</legend>${radio("part", [["part1", "ส่วนที่ 1 ปรนัย"], ["part2", "ส่วนที่ 2 สะกดชื่อวิทย์"], ["mixed", "ผสม"]], cfg.part)}</fieldset>
        <fieldset><legend class="mono">จำนวนข้อ</legend>${radio("count", [["10", "10"], ["20", "20"], ["30", "30"], ["all", "ทั้งหมด"]], cfg.count)}
          <p class="dim small">“ทั้งหมด” = ถามทุกพืชใน Lab ที่เลือกอย่างละ 1 ข้อ (ส่วนผสม = ทั้งสองส่วน)</p></fieldset>
        <fieldset><legend class="mono">รูปแบบโจทย์</legend>${radio("from", [["name", "จากชื่อ"], ["image", "จากรูป"], ["mixed", "ผสม"]], cfg.from)}</fieldset>
        <fieldset data-for="part1 mixed"><legend class="mono">หัวข้อที่ถาม (ส่วนที่ 1)</legend>
          <div class="checks">${TOPIC_KEYS.map((k) => `<label class="check"><input type="checkbox" name="topics" value="${k}" ${cfg.topics.includes(k) ? "checked" : ""}><span>${TOPICS[k].th}</span></label>`).join("")}</div></fieldset>
        <fieldset data-for="part2 mixed"><legend class="mono">ระดับความยาก (ส่วนที่ 2)</legend>${radio("difficulty", [["easy", "ง่าย · เห็น ~40%"], ["medium", "กลาง · เห็นตัวแรก"], ["hard", "ยาก · ช่องว่างหมด"]], cfg.difficulty)}</fieldset>
        <fieldset><legend class="mono">ตัวกรอง</legend><label class="check"><input type="checkbox" name="highlight" ${cfg.highlight ? "checked" : ""}><span>เฉพาะพืชตัวแดง (highlight)</span></label></fieldset>
        <p class="form-msg" id="formMsg" role="alert" hidden></p>
        <div class="setup-go">${arrowBtn("เริ่มทำข้อสอบ", 'type="submit"')}</div>
      </form>
    </section>`,
    { nav: "", title: "ตั้งค่าข้อสอบ" }
  );
  const form = $("#setup");
  const sync = () => {
    const part = new FormData(form).get("part");
    $$("[data-for]", form).forEach((f) => (f.hidden = !f.dataset.for.split(" ").includes(part)));
    const lab = new FormData(form).get("lab");
  };
  form.addEventListener("change", sync);
  sync();
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const c = {
      lab: fd.get("lab"),
      part: fd.get("part"),
      count: fd.get("count"),
      from: fd.get("from"),
      difficulty: fd.get("difficulty"),
      highlight: fd.get("highlight") === "on",
      topics: fd.getAll("topics"),
    };
    if (c.part !== "part2" && !c.topics.length) return formMsg("เลือกหัวข้ออย่างน้อย 1 หัวข้อ");
    saveSetup(c);
    const err = startQuiz(c);
    if (err) return formMsg(err);
    navigate("/quiz");
  });
}
function formMsg(t) {
  const m = $("#formMsg");
  m.textContent = t;
  m.hidden = false;
}

/* ---------- quiz ---------- */
function startQuiz(cfg, prebuilt = null) {
  let qs = prebuilt;
  if (!qs && cfg.part === "qc") {
    const file = qcById.get(cfg.lab);
    if (!file) return "ไม่พบชุดข้อสอบ";
    qs = makeQcQuestions(file, cfg.count);
  }
  if (!qs) {
    let plants = cfg.lab === "all" ? ALL : ALL.filter((p) => String(p.lab) === String(cfg.lab));
    if (cfg.highlight) plants = plants.filter((p) => p.highlight);
    if (!plants.length) return "ไม่มีพืชตามตัวกรองที่เลือก";
    const n = cfg.count === "all" ? "all" : Number(cfg.count);
    const mcq = (count) => makeMcqQuestions({ plants, allPlants: ALL, count, topics: cfg.topics, fromMode: cfg.from });
    const spell = (count) => makeSpellQuestions({ plants, count, difficulty: cfg.difficulty, fromMode: cfg.from });
    if (cfg.part === "part1") qs = mcq(n);
    else if (cfg.part === "part2") qs = spell(n);
    else qs = n === "all" ? shuffle([...mcq("all"), ...spell("all")]) : shuffle([...mcq(Math.ceil(n / 2)), ...spell(Math.floor(n / 2))]);
    if (!qs.length) return "สร้างข้อสอบไม่ได้ ลองเลือกหัวข้อ/รูปแบบโจทย์อื่น";
  }
  session = { cfg, qs, i: 0, results: [], t0: Date.now(), saved: false, answered: false };
  return null;
}

function preload(q) {
  if (q && q.image) new Image().src = "./" + q.image;
}

function quizView() {
  if (!session) return navigate("/setup");
  if (session.i >= session.qs.length) return navigate("/result");
  const s = session;
  const q = s.qs[s.i];
  s.answered = false;
  preload(s.qs[s.i + 1]);
  const total = s.qs.length;
  const label = q.qc ? q.topic : q.kind === "spell" ? "SPELLING" : TOPICS[q.topic].chip;
  const body =
    q.kind === "mcq"
      ? `<div class="options" role="radiogroup" aria-label="ตัวเลือก">${q.options
          .map((o, i) => `<button type="button" class="opt" data-i="${i}" role="radio" aria-checked="false"><span class="letter mono">${"ABCDE"[i]}</span><span class="otext">${o.html}</span><span class="mark" aria-hidden="true"></span></button>`)
          .join("")}</div>`
      : `<div id="spellHost"></div>`;
  show(
    `<section class="wrap quiz">
      <div class="timeline" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${s.i}"><div class="tl-fill" style="width:${(s.i / total) * 100}%"></div></div>
      <div class="quiz-meta"><div class="chips">${q.qc ? chip(`${q.setPrefix} ${pad2(q.fileNo)}`) : labChip(q.plant.lab)}${chip(label)}</div><span class="mono dim">Q${pad2(s.i + 1)} / ${pad2(total)}</span></div>
      <h2 class="prompt">${q.promptHtml}</h2>
      ${q.image ? `<button type="button" class="qimg" data-zoom="./${esc(q.image)}" data-alt="รูปพืช" aria-label="ขยายรูป"><img src="./${esc(q.image)}" alt="รูปพืชในโจทย์" width="640" height="640"><span class="zoom mono">ขยาย ⤢</span></button>` : ""}
      ${body}
      <div id="feedback" aria-live="polite"></div>
    </section>`,
    { title: `ข้อ ${s.i + 1}` }
  );
  if (q.kind === "mcq") {
    $$(".opt").forEach((b) => b.addEventListener("click", () => answerMcq(Number(b.dataset.i))));
  } else {
    mountSpell($("#spellHost"), q, (r) => finishQuestion(q, { ...r, yourText: r.answer }));
  }
}

function answerMcq(i) {
  const s = session;
  if (!s || s.answered) return;
  const q = s.qs[s.i];
  const chosen = q.options[i];
  $$(".opt").forEach((b, k) => {
    b.disabled = true;
    const o = q.options[k];
    if (o.correct) b.classList.add("right");
    if (k === i) {
      b.classList.add("picked");
      b.setAttribute("aria-checked", "true");
      if (!o.correct) b.classList.add("wrong");
    }
    b.querySelector(".mark").textContent = o.correct ? "✓" : k === i ? "✕" : "";
  });
  finishQuestion(q, { correct: chosen.correct, score: chosen.correct ? 1 : 0, yourText: chosen.text, skipped: false });
}

function finishQuestion(q, r) {
  const s = session;
  s.answered = true;
  s.results.push({
    q,
    topic: q.kind === "spell" ? "spell" : q.topic,
    prompt: stripHtml(q.promptHtml),
    yourText: r.yourText,
    correctText: q.correctText,
    correct: r.correct,
    skipped: !!r.skipped,
    score: r.score,
    from: q.from,
    hints: r.hints || 0,
  });
  const last = s.i === s.qs.length - 1;
  const status = r.skipped ? chip("SKIP") : r.correct ? chip(r.score < 1 ? `PASS ${Math.round(r.score * 100)}%` : "PASS", "pass") : chip("FAIL", "fail");
  const fb = $("#feedback");
  fb.innerHTML = `<div class="feedback ${r.correct ? "ok" : "no"}">
      <div class="fb-head">${status}<span class="fb-text">${r.correct ? "ถูกต้อง" : r.skipped ? "ข้ามข้อนี้" : "ยังไม่ถูก"} · เฉลย: ${q.correctHtml}</span></div>
      ${q.qc ? `<div class="explain"><div class="mono dim">อธิบายเฉลย</div><p>${esc(q.explain || "")}</p>${q.source ? `<p class="src-ref">📍 อ้างอิง: สไลด์ ${esc(q.source)}</p>` : ""}</div>` : plantCard(q.plant)}
      <div class="next-row">${arrowBtn(last ? "ดูผลคะแนน" : "ข้อต่อไป", 'id="nextBtn"')}<span class="mono dim">กด Enter</span></div>
    </div>`;
  $("#nextBtn").addEventListener("click", nextQuestion);
  fb.scrollIntoView({ behavior: "smooth", block: "nearest" });
  $("#nextBtn").focus({ preventScroll: true });
}

function nextQuestion() {
  const s = session;
  if (!s || !s.answered) return;
  s.i++;
  if (s.i >= s.qs.length) navigate("/result");
  else quizView();
}

window.addEventListener("keydown", (e) => {
  if (!location.hash.startsWith("#/quiz") || !session || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t.matches && t.matches("input, textarea, select")) return;
  const q = session.qs[session.i];
  if (!q) return;
  if (session.answered) {
    if (e.key === "Enter" && t.id !== "nextBtn") nextQuestion();
    return;
  }
  if (q.kind !== "mcq") return;
  const k = e.key.toLowerCase();
  let idx = "12345".indexOf(k);
  if (idx < 0) idx = "abcde".indexOf(k);
  if (idx >= 0) answerMcq(idx);
});

/* ---------- result ---------- */
function resultView() {
  const s = session;
  if (!s || !s.results.length) return navigate("/setup");
  const total = s.results.length;
  const score = s.results.reduce((a, r) => a + r.score, 0);
  const pct = Math.round((score / total) * 100);
  const secs = (Date.now() - s.t0) / 1000;
  if (!s.saved) {
    s.saved = true;
    s.secs = secs;
    recordResult({ labKey: String(s.cfg.lab), part: s.cfg.part, total, score, secs });
  }
  const pass = pct >= PASS_PCT;
  const groups = {};
  for (const r of s.results) {
    const g = (groups[r.topic] ||= { n: 0, s: 0 });
    g.n++;
    g.s += r.score;
  }
  const topicLabel = (k) => (k === "spell" ? "สะกดชื่อวิทย์" : TOPICS[k]?.th ?? k);
  const bars = Object.entries(groups)
    .sort((a, b) => a[1].s / a[1].n - b[1].s / b[1].n)
    .map(([k, g]) => {
      const p = Math.round((g.s / g.n) * 100);
      return `<div class="bar-row"><div class="bar-label"><span>${topicLabel(k)}</span><span class="mono dim">${Math.round(g.s * 100) / 100}/${g.n} · ${p}%</span></div><div class="timeline"><div class="tl-fill ${p >= PASS_PCT ? "full" : ""}" style="width:${p}%"></div></div></div>`;
    })
    .join("");
  const wrong = s.results.filter((r) => !r.correct);
  show(
    `<section class="wrap section page-top">
      <div class="result-head">${chip(pass ? "PASS" : "FAIL", pass ? "pass" : "fail")}<h1 class="h-page">สรุปผลคะแนน</h1></div>
      <div class="metrics tight">
        <div class="metric reveal"><div class="num">${Math.round(score * 100) / 100}<span class="unit mono">/ ${total}</span></div><div class="mono dim">คะแนน</div></div>
        <div class="metric reveal"><div class="num">${pct}<span class="unit mono">%</span></div><div class="mono dim">เปอร์เซ็นต์</div></div>
        <div class="metric reveal"><div class="num">${fmtTime(secs)}</div><div class="mono dim">เวลาที่ใช้ (นาที:วินาที)</div></div>
      </div>
      <h2 class="h-sec">คะแนนตามหัวข้อ <span class="dim small">(เรียงจากอ่อนสุด)</span></h2>
      <div class="bars">${bars}</div>
      <div class="result-actions">
        ${wrong.length ? arrowBtn(`ทำเฉพาะข้อที่ผิดอีกครั้ง (${wrong.length})`, 'id="retryBtn"') : ""}
        ${arrowLink("ตั้งค่าใหม่", "#/setup", "btn-ghost")}
        ${arrowLink("หน้าแรก", "#/", "btn-ghost")}
      </div>
      <h2 class="h-sec">ทบทวนข้อสอบ</h2>
      <label class="check inline"><input type="checkbox" id="onlyWrong" ${wrong.length ? "checked" : ""}><span>แสดงเฉพาะข้อที่ผิด</span></label>
      <div class="review">
        <aside class="rv-side" aria-label="รายการข้อ">${s.results
          .map((r, i) => `<button type="button" class="rv-item" data-row="${i}"><i class="sdot ${r.skipped ? "skip" : r.correct ? "ok" : "no"}"></i><span class="mono">Q${pad2(i + 1)}</span></button>`)
          .join("")}</aside>
        <div class="rv-table" role="table" aria-label="ตารางทบทวน">
          <div class="rv-row rv-head mono" role="row"><span>QUESTION</span><span>YOUR ANSWER</span><span>CORRECT</span></div>
          ${s.results
            .map(
              (r, i) => `<div class="rv-row ${r.correct ? "is-ok" : "is-no"}" id="row-${i}" role="row">
              <span class="rv-q" data-l="QUESTION"><i class="sdot ${r.skipped ? "skip" : r.correct ? "ok" : "no"}"></i> <b class="mono">Q${pad2(i + 1)}</b> ${r.from === "image" ? "(รูป) " : ""}${esc(r.prompt)}</span>
              <span class="mono" data-l="YOUR ANSWER">${r.skipped ? "(ข้าม)" : esc(r.yourText)}</span>
              <span class="mono" data-l="CORRECT">${esc(r.correctText)}</span></div>`
            )
            .join("")}
        </div>
      </div>
    </section>`,
    { title: "สรุปผล" }
  );
  const apply = () => $$(".rv-row[id]").forEach((row) => (row.hidden = $("#onlyWrong").checked && row.classList.contains("is-ok")));
  $("#onlyWrong").addEventListener("change", apply);
  apply();
  $$(".rv-item").forEach((b) =>
    b.addEventListener("click", () => {
      const row = $(`#row-${b.dataset.row}`);
      if (row.hidden) {
        $("#onlyWrong").checked = false;
        apply();
      }
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.add("flash");
      setTimeout(() => row.classList.remove("flash"), 1200);
    })
  );
  const retry = $("#retryBtn");
  if (retry)
    retry.addEventListener("click", () => {
      const qs = [];
      for (const r of wrong) {
        const sp = r.q.spec;
        const p = byId.get(sp.plantId);
        const nq = r.q.qc
          ? buildQc(qcById.get(sp.qcFile), sp.idx)
          : r.q.kind === "spell" ? buildSpell(p, sp.difficulty, sp.from) : buildMcq(p, sp.topic, sp.from, ALL);
        if (nq) qs.push(nq);
      }
      session = null;
      startQuiz(s.cfg, shuffle(qs));
      navigate("/quiz");
    });
}

/* ---------- review (flashcards) ---------- */
function reviewView(params = {}) {
  let labF = params.id || "all";
  let hide = false;
  show(
    `<section class="wrap section page-top">
      <h1 class="h-page">ทบทวนพืช</h1>
      <div class="toolbar">
        <div class="seg" role="radiogroup" id="labSeg">${[["all", "ทั้งหมด"], ...DATA.labs.map((l) => [String(l.id), l.title])]
          .map(([v, l]) => `<label class="seg-item"><input type="radio" name="rl" value="${v}" ${v === labF ? "checked" : ""}><span>${l}</span></label>`)
          .join("")}</div>
        <input type="search" id="q" class="search" placeholder="ค้นหา ชื่อไทย / ชื่อวิทย์ / วงศ์" aria-label="ค้นหา" autocomplete="off" spellcheck="false">
        <label class="check"><input type="checkbox" id="hideAns"><span>โหมดการ์ดจำ (ซ่อนข้อมูล แตะเพื่อเปิด)</span></label>
      </div>
      <p class="mono dim" id="count"></p>
      <div class="cards" id="cards"></div>
    </section>`,
    { nav: "review", title: "ทบทวนพืช" }
  );
  const render = () => {
    const q = $("#q").value.trim().toLowerCase();
    const list = ALL.filter(
      (p) =>
        (labF === "all" || String(p.lab) === labF) &&
        (!q || [p.thaiName, p.scientificNameFull, p.family].some((v) => v && v.toLowerCase().includes(q)))
    );
    $("#count").textContent = `${list.length} รายการ`;
    $("#cards").innerHTML = list.map((p) => `<div class="flip ${hide ? "hidden-info" : ""}">${plantCard(p)}</div>`).join("") || `<p class="dim">ไม่พบรายการ</p>`;
  };
  $("#labSeg").addEventListener("change", (e) => ((labF = e.target.value), render()));
  $("#q").addEventListener("input", render);
  $("#hideAns").addEventListener("change", (e) => ((hide = e.target.checked), render()));
  $("#cards").addEventListener("click", (e) => {
    const f = e.target.closest(".flip.hidden-info");
    if (f && !e.target.closest("[data-zoom]")) f.classList.toggle("revealed");
  });
  render();
}

/* ---------- tips ---------- */
function tipsView() {
  const notes = DATA.labs.filter((l) => l.note).map((l) => `<li>${labChip(l.id)} ${esc(l.note)}</li>`).join("");
  const focus = (t) => (t.endsWith("*") ? `${esc(t.slice(0, -1).trim())} <span class="mono">*</span>` : esc(t));
  show(
    `<section class="wrap section page-top narrow">
      <h1 class="h-page">เคล็ดลับข้อสอบ</h1>
      <h2 class="h-sec">มัดรวมคำถามที่อาจารย์ชอบออก</h2>
      <ol class="tips">${DATA.examTips.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
      <h2 class="h-sec">พืชที่ควรเพ่งเล็งเป็นพิเศษ</h2>
      <ul class="tips plain">${DATA.focusGroups.map((t) => `<li>${focus(t)}</li>`).join("")}</ul>
      <h2 class="h-sec">หมายเหตุประจำบท</h2>
      <ul class="tips plain">${notes}</ul>
      <div class="result-actions">${arrowLink(EXAM_OPEN ? "เริ่มทำข้อสอบ" : "ทบทวนพืช / เฉลย", EXAM_OPEN ? "#/setup" : "#/review")}</div>
    </section>`,
    { nav: "tips", title: "เคล็ดลับข้อสอบ" }
  );
}

/* ---------- ชุดข้อสอบปรนัยรายวิชา (วิชา 2 QC / วิชา 3 เภสัชเวท) ---------- */
const SETS = {
  qc: { no: 2, prefix: "QC", title: "วิชาเครื่องมือวิเคราะห์ (QC)", short: "วิชา 2 QC", get: () => QC },
  pg: { no: 3, prefix: "PG", title: "วิชาเภสัชเวท (Pharmacognosy)", short: "วิชา 3 เภสัชเวท", get: () => PG },
  rg: { no: 4, prefix: "RG", title: "วิชา R&D ยา — ชุดที่ 1", short: "วิชา 4 R&D ชุด 1", get: () => RG },
  cp: { no: 6, prefix: "CP", title: "วิชา Ceutic 1 (เภสัชภัณฑ์ 1)", short: "วิชา 6 Ceutic 1", get: () => CP },
  tp: { no: 5, prefix: "TP", title: "วิชา Therapy 3 (เภสัชบำบัด 3)", short: "วิชา 5 Therapy 3", get: () => TP },
  t2: { no: 5, prefix: "T2", title: "วิชา Therapy 3 — ชุดที่ 2", short: "วิชา 5 Therapy 3 ชุด 2", get: () => T2 },
  r2: { no: 4, prefix: "R2", title: "วิชา R&D ยา — ชุดที่ 2", short: "วิชา 4 R&D ชุด 2", get: () => R2 },
};
const setOfFile = (f) => f.id.slice(0, 2);

function setCards(key) {
  const st = getState();
  return `<div class="bento">${SETS[key]
    .get()
    .files.map((f) => {
      const best = st.best[f.id];
      const status = best === undefined ? chip("NO SCORE") : best >= PASS_PCT ? chip(`PASS ${best}%`, "pass") : chip(`BEST ${best}%`);
      return `<article class="bento-card reveal" data-tilt="6">
        <div class="bento-top">${chip(`${SETS[key].prefix} ${pad2(f.no)}`)}${status}</div>
        <h3><a href="#/${key}/${f.id}">${esc(f.title)}</a></h3>
        <p class="mono dim">${f.questions.length} ข้อ · ปรนัย 5 ตัวเลือก</p>
        <div class="bento-actions">
          ${EXAM_OPEN ? arrowLink("ทำข้อสอบ 20 ข้อ", `#/${key}/${f.id}/all`) : ""}
          ${arrowLink("ดูเฉลย", `#/${key}/${f.id}/key`, "btn-ghost")}
        </div>
      </article>`;
    })
    .join("")}</div>`;
}

function examSwitch(key) {
  const pair = key === "rg" || key === "r2" ? ["rg", "r2"] : key === "tp" || key === "t2" ? ["tp", "t2"] : null;
  if (!pair) return "";
  return `<nav class="set-tabs exam-switch" aria-label="เลือกข้อสอบชุดที่"><a href="#/${pair[0]}" class="${key === pair[0] ? "on" : ""}">ข้อสอบชุดที่ 1</a><a href="#/${pair[1]}" class="${key === pair[1] ? "on" : ""}">ข้อสอบชุดที่ 2</a></nav>`;
}

function setTabs(key, current) {
  const set = SETS[key];
  const st = getState();
  return `<nav class="set-tabs" aria-label="เลือกชุดข้อสอบ">${set
    .get()
    .files.map((f) => {
      const best = st.best[f.id];
      return `<a href="#/${key}/${f.id}" class="${f.id === current ? "on" : ""}" ${f.id === current ? 'aria-current="page"' : ""}>ชุด ${f.no}${best === undefined ? "" : `<small>${best}%</small>`}</a>`;
    })
    .join("")}</nav>`;
}

function setDetailView(key, p) {
  const file = qcById.get(p.id);
  if (!file) return navigate(`/${key}`);
  const set = SETS[key];
  const files = set.get().files;
  const idx = files.findIndex((f) => f.id === file.id);
  const prev = files[idx - 1];
  const next = files[idx + 1];
  const best = getState().best[file.id];
  const topics = [...new Set(file.questions.map((q) => q.t))];
  show(
    `<section class="wrap section page-top narrow">
      <p class="dim"><a href="#/${key}">← ${esc(set.short)}</a></p>
      ${examSwitch(key)}
      ${setTabs(key, file.id)}
      <div class="chips" style="margin-top:16px">${chip(`${set.prefix} ${pad2(file.no)}`)}${best === undefined ? chip("NO SCORE") : best >= PASS_PCT ? chip(`PASS ${best}%`, "pass") : chip(`BEST ${best}%`)}</div>
      <h1 class="h-page" style="margin-top:12px">ชุด ${file.no} · ${esc(file.title)}</h1>
      <p class="dim">${file.questions.length} ข้อ · ปรนัย 5 ตัวเลือก</p>
      <div class="chips" style="margin:12px 0">${topics.map((t) => chip(t)).join("")}</div>
      <div class="result-actions">${EXAM_OPEN ? arrowLink("ทำข้อสอบชุดนี้", `#/${key}/${file.id}/all`) : ""}${arrowLink("ดูเฉลย", `#/${key}/${file.id}/key`, "btn-ghost")}</div>
      <div class="result-actions">${prev ? arrowLink(`← ชุด ${prev.no}`, `#/${key}/${prev.id}`, "btn-ghost") : ""}${next ? arrowLink(`ชุด ${next.no} →`, `#/${key}/${next.id}`, "btn-ghost") : ""}</div>
    </section>`,
    { nav: key, title: `${set.short} ชุด ${file.no}` }
  );
}

function setView(key) {
  const set = SETS[key];
  const data = set.get();
  show(
    `<section class="wrap section page-top">
      <div class="sec-head"><span class="chip"><i class="dot"></i>วิชา ${set.no}</span><h1 class="h-page" style="margin-top:12px">${esc(set.title)}</h1>
      <p class="dim">${esc(data.subject?.code ?? "")} · ข้อสอบปรนัย 5 ตัวเลือก ไฟล์ละ 20 ข้อ รวม ${data.files.reduce((a, f) => a + f.questions.length, 0)} ข้อ</p></div>
      ${examSwitch(key)}
      ${setTabs(key, "")}
      ${setCards(key)}
    </section>`,
    { nav: key, title: set.short }
  );
}

function setStart(key, p) {
  const file = qcById.get(p.id);
  if (!file) return navigate(`/${key}`);
  const cfg = { lab: file.id, part: "qc", count: p.n === "all" ? "all" : p.n, topics: [], from: "qc" };
  const err = startQuiz(cfg);
  if (err) return navigate(`/${key}`);
  navigate("/quiz");
}

function setKeyView(key, p) {
  const file = qcById.get(p.id);
  if (!file) return navigate(`/${key}`);
  const prefix = SETS[key].prefix;
  show(
    `<section class="wrap section page-top narrow">
      <div class="chips">${chip(`${prefix} ${pad2(file.no)}`)}</div>
      <h1 class="h-page" style="margin-top:12px">${esc(file.title)} — เฉลย</h1>
      <p class="dim">${file.questions.length} ข้อ · ตัวเลือกที่ถูกต้องไฮไลต์สีเขียว</p>
      <ol class="key">${file.questions
        .map(
          (q) => `<li class="key-item"><div class="chips">${chip(q.t)}</div><p class="key-q">${esc(q.q)}</p>
          <ul class="key-opts"><li class="right"><span class="mark" aria-hidden="true">✓</span>${esc(q.a)}</li>${q.w.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
          <div class="explain"><div class="mono dim">อธิบายเฉลย</div><p>${esc(q.e || "")}</p>${q.s ? `<p class="src-ref">📍 อ้างอิง: สไลด์ ${esc(q.s)}</p>` : ""}</div></li>`
        )
        .join("")}</ol>
      <div class="result-actions">${EXAM_OPEN ? arrowLink("ทำข้อสอบชุดนี้", `#/${key}/${file.id}/all`) : ""}${arrowLink("กลับ", `#/${key}/${file.id}`, "btn-ghost")}</div>
    </section>`,
    { nav: key, title: `เฉลย ${file.title}` }
  );
}

/* ---------- exam closed ---------- */
function closedView() {
  show(
    `<section class="wrap section page-top narrow">
      ${chip("EXAM CLOSED")}
      <h1 class="h-page" style="margin-top:16px">ปิดการทำข้อสอบชั่วคราว</h1>
      <p class="lead">ตอนนี้ยังทำข้อสอบไม่ได้ แต่ดูเฉลยและทบทวนพืชทั้งหมดได้ตามปกติ</p>
      <div class="result-actions">${arrowLink("ทบทวนพืช / เฉลย", "#/review")}${arrowLink("เคล็ดลับข้อสอบ", "#/tips", "btn-ghost")}</div>
    </section>`,
    { title: "ปิดการทำข้อสอบ" }
  );
}

/* ---------- boot ---------- */
async function boot() {
  try {
    await loadData();
  } catch (e) {
    app.innerHTML = `<section class="wrap section page-top"><h1 class="h-page">โหลดข้อมูลไม่ได้</h1><p class="dim">${esc(e.message)} — ถ้าเปิดไฟล์ตรง ๆ ให้รันผ่านเซิร์ฟเวอร์ (python -m http.server)</p></section>`;
    return;
  }
  if (!EXAM_OPEN) {
    const cta = $(".nav-cta");
    cta.href = "#/review";
    cta.firstChild.textContent = "ทบทวน / เฉลย ";
    const big = $("#mobileMenu .big");
    big.href = "#/review";
    big.textContent = "ทบทวน / เฉลย ↗";
  }
  const gated = (fn) => (p) => (EXAM_OPEN ? fn(p) : closedView());
  route("/", homeView);
  route("/labs", labsView);
  for (const key of Object.keys(SETS)) {
    route(`/${key}`, () => setView(key));
    route(`/${key}/:id`, (p) => setDetailView(key, p));
    route(`/${key}/:id/key`, (p) => setKeyView(key, p));
    route(`/${key}/:id/:n`, gated((p) => setStart(key, p)));
  }
  route("/setup", gated(() => setupView()));
  route("/lab/:id/:part", gated((p) => setupView(p)));
  route("/quiz", gated(quizView));
  route("/result", gated(resultView));
  route("/review", () => reviewView());
  route("/review/:id", (p) => reviewView(p));
  route("/tips", tipsView);
  start();
}
boot();
