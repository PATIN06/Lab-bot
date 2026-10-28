// ข้อสอบ QC (ปรนัย 5 ตัวเลือก) — สลับตำแหน่งตัวเลือกใหม่ทุกครั้งที่สร้างข้อสอบ
import { esc, shuffle } from "./util.js?v=8";

export function buildQc(file, idx) {
  const src = file.questions[idx];
  const options = shuffle([{ text: src.a, correct: true }, ...src.w.map((t) => ({ text: t, correct: false }))]).map((o) => ({
    ...o,
    html: esc(o.text),
  }));
  return {
    kind: "mcq",
    qc: true,
    spec: { qcFile: file.id, idx },
    plant: null,
    topic: src.t,
    from: "qc",
    fileNo: file.no,
    promptHtml: esc(src.q),
    image: null,
    options,
    correctText: src.a,
    correctHtml: esc(src.a),
    explain: src.e,
  };
}

/** count = "all" หรือจำนวนข้อ (สุ่มลำดับข้อ) */
export function makeQcQuestions(file, count) {
  const idxs = shuffle(file.questions.map((_, i) => i));
  const n = count === "all" ? idxs.length : Math.min(Number(count), idxs.length);
  return idxs.slice(0, n).map((i) => buildQc(file, i));
}
