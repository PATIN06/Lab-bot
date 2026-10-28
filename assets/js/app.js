import { $, $$, esc, shuffle, pad2, fmtTime, stripHtml, sciHtml, placeholder, openLightbox, closeLightbox } from "./util.js?v=7";
import { route, navigate, start } from "./router.js?v=7";
import { getState, recordResult, saveSetup, averagePct } from "./storage.js?v=7";
import { TOPICS, TOPIC_KEYS, makeMcqQuestions, buildMcq } from "./quiz-mcq.js?v=7";
import { DIFFICULTY, makeSpellQuestions, buildSpell, mountSpell } from "./quiz-spelling.js?v=7";

// เปิด/ปิดการทำข้อสอบ: false = ปิดเฉพาะส่วนทำข้อสอบ (ทบทวน/เฉลย/เคล็ดลับยังใช้ได้)
const EXAM_OPEN = true;

const app = $("#app");
let DATA = null;
let ALL = [];
const byId = new Map();
let session = null; // { cfg, qs, i, results, t0, saved }

const HERO_IMG = "./images/lab1/06.webp";
const PASS_PCT = 80;

/* ---------- data ---------- */
async function loadData() {
  const res = await fetch("./data/plants.json");
  if (!res.ok) throw new Error("โหลด plants.json ไม่ได้");
  DATA = await res.json();
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
  document.title = title ? `${title} — แนวแลปกริ้ง` : "แนวแลปกริ้ง — ซ้อมสอบ Natural Drug Discovery Lab";
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
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
  const cell = (num, unit, label) => `<div class="metric"><div class="num">${num}<span class="unit mono">${unit}</span></div><div class="mono dim">${label}</div></div>`;
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
    return `<article class="bento-card">
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

function homeView() {
  show(
    `<section class="hero">
      <img class="hero-bg" src="${HERO_IMG}" alt="" fetchpriority="high">
      <div class="hero-scrim"></div>
      <div class="wrap hero-inner">
        ${chip("NATURAL DRUG DISCOVERY LAB")}
        <h1>ซ้อมสอบแลปกริ้ง ให้จำได้ทั้งชื่อ วงศ์ สารสำคัญ และรูป</h1>
        <p class="lead">ปรนัย 5 ตัวเลือก และเติมตัวอักษรสะกดชื่อวิทยาศาสตร์ จากพืช ${ALL.length} ชนิดใน ${DATA.labs.length} Lab</p>
        <div class="hero-cta">${EXAM_OPEN ? arrowLink("เริ่มทำข้อสอบ", "#/setup") + arrowLink("ทบทวนพืช", "#/review", "btn-ghost") : arrowLink("ทบทวนพืช / เฉลย", "#/review")}</div>
      </div>
    </section>
    ${metricsHtml()}
    <section class="wrap section" id="labs"><div class="sec-head"><h2>เลือก Lab</h2><p class="dim">${EXAM_OPEN ? "แต่ละ Lab มีส่วนที่ 1 (ปรนัย) และส่วนที่ 2 (สะกดชื่อวิทยาศาสตร์)" : "ขณะนี้ปิดการทำข้อสอบชั่วคราว — ทบทวนพืชและดูเฉลยได้ตามปกติ"}</p></div>${labCards()}</section>
    <section class="wrap section"><div class="tip-teaser"><h2>เคล็ดลับข้อสอบ</h2><p class="dim">คำถามที่อาจารย์ชอบออก และพืชที่ต้องเพ่งเล็งเป็นพิเศษ</p>${arrowLink("ดูเคล็ดลับ", "#/tips", "btn-ghost")}</div></section>`,
    { nav: "" }
  );
}

function labsView() {
  show(`<section class="wrap section page-top"><div class="sec-head"><h1 class="h-page">Labs</h1><p class="dim">เลือก Lab และส่วนที่ต้องการซ้อม</p></div>${labCards()}</section>`, { nav: "labs", title: "Labs" });
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
  const label = q.kind === "spell" ? "SPELLING" : TOPICS[q.topic].chip;
  const body =
    q.kind === "mcq"
      ? `<div class="options" role="radiogroup" aria-label="ตัวเลือก">${q.options
          .map((o, i) => `<button type="button" class="opt" data-i="${i}" role="radio" aria-checked="false"><span class="letter mono">${"ABCDE"[i]}</span><span class="otext">${o.html}</span><span class="mark" aria-hidden="true"></span></button>`)
          .join("")}</div>`
      : `<div id="spellHost"></div>`;
  show(
    `<section class="wrap quiz">
      <div class="timeline" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${s.i}"><div class="tl-fill" style="width:${(s.i / total) * 100}%"></div></div>
      <div class="quiz-meta"><div class="chips">${labChip(q.plant.lab)}${chip(label)}</div><span class="mono dim">Q${pad2(s.i + 1)} / ${pad2(total)}</span></div>
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
      ${plantCard(q.plant)}
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
  const topicLabel = (k) => (k === "spell" ? "สะกดชื่อวิทย์" : TOPICS[k].th);
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
        <div class="metric"><div class="num">${Math.round(score * 100) / 100}<span class="unit mono">/ ${total}</span></div><div class="mono dim">คะแนน</div></div>
        <div class="metric"><div class="num">${pct}<span class="unit mono">%</span></div><div class="mono dim">เปอร์เซ็นต์</div></div>
        <div class="metric"><div class="num">${fmtTime(secs)}</div><div class="mono dim">เวลาที่ใช้ (นาที:วินาที)</div></div>
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
        const nq = r.q.kind === "spell" ? buildSpell(p, sp.difficulty, sp.from) : buildMcq(p, sp.topic, sp.from, ALL);
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
  route("/", homeView);
  route("/labs", labsView);
  const gated = (fn) => (p) => (EXAM_OPEN ? fn(p) : closedView());
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
