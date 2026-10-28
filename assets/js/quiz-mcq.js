// ส่วนที่ 1: ปรนัย 5 ตัวเลือก — ตรรกะล้วน (ไม่แตะ DOM) เพื่อให้ทดสอบด้วย node ได้
import { esc, shuffle, pick } from "./util.js?v=7";

export const TOPICS = {
  family: { chip: "FAMILY", th: "วงศ์", get: (p) => p.family },
  name: { chip: "COMMON NAME", th: "ชื่อสามัญ (ชื่อไทย)", get: (p) => p.thaiName },
  sci: { chip: "SCI-NAME", th: "ชื่อวิทยาศาสตร์", get: (p) => p.scientificName },
  uses: { chip: "USES", th: "สรรพคุณ", get: (p) => p.uses },
  constituents: { chip: "CONSTITUENTS", th: "สารสำคัญ", get: (p) => p.constituents },
  part: { chip: "PART USED", th: "ส่วนที่ใช้", get: (p) => p.partUsed },
};
export const TOPIC_KEYS = Object.keys(TOPICS);

const key = (v) => String(v).toLowerCase().replace(/\s+/g, " ").trim();
const tokens = (v) =>
  new Set(
    String(v).toLowerCase().split(/[\/,;()]|และ/).map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean)
  );

/** ตัวเลือกหลอกต้องไม่ใช่คำตอบที่ถูกด้วย */
function conflicts(topic, answer, cand) {
  if (key(answer) === key(cand)) return true;
  if (topic === "part" || topic === "constituents") {
    const a = tokens(answer);
    for (const t of tokens(cand)) if (a.has(t)) return true;
  }
  return false;
}

function valueOf(topic, plant) {
  const v = TOPICS[topic].get(plant);
  return v && String(v).trim() ? String(v).trim() : null;
}

/** พืชที่ใช้ถามหัวข้อนี้ในโหมดนี้ได้ไหม */
export function canAsk(plant, topic, from) {
  if (!valueOf(topic, plant)) return false;
  if (from === "name") {
    if (topic === "name") return !!plant.scientificName; // ถามจากชื่อวิทย์ → ชื่อสามัญ
    return !!plant.thaiName;
  }
  return !!plant.image;
}

function promptFor(topic, from, plant) {
  const th = esc(plant.thaiName);
  if (from === "image") {
    return {
      name: "พืชในรูปคืออะไร",
      family: "พืชในรูปอยู่วงศ์ใด",
      part: "crude drug ในรูปมาจากส่วนใดของพืช",
      constituents: "พืชในรูปมีสารสำคัญคืออะไร",
      uses: "พืชในรูปมีสรรพคุณอย่างไร",
      sci: "พืชในรูปมีชื่อวิทยาศาสตร์ว่าอะไร",
    }[topic];
  }
  return {
    name: `<i class="sci">${esc(plant.scientificName)}</i> มีชื่อสามัญว่าอะไร`,
    family: `${th} อยู่ในวงศ์ใด`,
    part: `${th} ใช้ส่วนใด`,
    constituents: `${th} มีสารสำคัญคืออะไร`,
    uses: `${th} มีสรรพคุณอย่างไร`,
    sci: `${th} มีชื่อวิทยาศาสตร์ว่าอะไร`,
  }[topic];
}

/** สร้างคำถาม 1 ข้อ; คืน null ถ้าสร้างตัวเลือกหลอก 4 ตัวไม่ได้ */
export function buildMcq(plant, topic, from, allPlants) {
  const answer = valueOf(topic, plant);
  if (!answer || !canAsk(plant, topic, from)) return null;

  // พืชชื่อเดียวกัน/ชื่อวิทย์เดียวกัน (ซ้ำข้าม Lab) — ค่าของมันอาจเป็นคำตอบที่ถูกด้วย จึงห้ามใช้เป็นตัวหลอก
  const twins = allPlants.filter(
    (q) => q.id !== plant.id && (q.thaiName === plant.thaiName || (q.scientificName && q.scientificName === plant.scientificName))
  );
  const altAnswers = twins.map((q) => valueOf(topic, q)).filter(Boolean);
  const pool = allPlants.filter(
    (q) =>
      q.id !== plant.id &&
      q.thaiName !== plant.thaiName &&
      !(q.scientificName && q.scientificName === plant.scientificName)
  );
  const sameLab = shuffle(pool.filter((q) => q.lab === plant.lab));
  const others = shuffle(pool.filter((q) => q.lab !== plant.lab));

  const chosen = [];
  const seen = new Set([key(answer)]);
  for (const q of [...sameLab, ...others]) {
    const v = valueOf(topic, q);
    if (!v || seen.has(key(v)) || conflicts(topic, answer, v) || altAnswers.some((x) => conflicts(topic, x, v))) continue;
    // ตัวเลือกหลอกที่ยาวผิดปกติเทียบกับคำตอบ ไม่ตัด — แต่ห้ามซ้ำกัน
    seen.add(key(v));
    chosen.push(v);
    if (chosen.length === 4) break;
  }
  if (chosen.length < 4) return null;

  const fmt = (v) => (topic === "sci" ? `<i class="sci">${esc(v)}</i>` : esc(v));
  const options = shuffle([{ text: answer, correct: true }, ...chosen.map((t) => ({ text: t, correct: false }))]).map(
    (o) => ({ ...o, html: fmt(o.text) })
  );
  return {
    kind: "mcq",
    spec: { plantId: plant.id, topic, from },
    plant,
    topic,
    from,
    promptHtml: promptFor(topic, from, plant),
    image: from === "image" ? plant.quizImage || plant.image : null,
    options,
    correctText: answer,
    correctHtml: fmt(answer),
  };
}

/** เลือกพืช/หัวข้อ/รูปแบบโจทย์วนไปจนครบจำนวน */
export function makeMcqQuestions({ plants, allPlants, count, topics, fromMode }) {
  const out = [];
  const total = count === "all" ? plants.length : count;
  let order = shuffle(plants);
  let guard = 0;
  let i = 0;
  while (out.length < total && guard < total * 12 + plants.length * 2) {
    guard++;
    if (i >= order.length) {
      if (count === "all") break;
      order = shuffle(plants);
      i = 0;
    }
    const p = order[i++];
    const from = fromMode === "mixed" ? pick(["name", "image"]) : fromMode;
    const ts = shuffle(topics.filter((t) => canAsk(p, t, from)));
    for (const t of ts) {
      const q = buildMcq(p, t, from, allPlants);
      if (q) {
        out.push(q);
        break;
      }
    }
  }
  return out;
}
