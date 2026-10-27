// localStorage ครอบ try/catch — ใช้ไม่ได้ก็ยังทำข้อสอบได้ปกติ
const KEY = "labquiz.v1";
const EMPTY = () => ({ history: [], best: {}, answered: 0, setup: null });
let memory = EMPTY();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY(), ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return memory;
}

function save(state) {
  memory = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

export function getState() {
  return load();
}

/** บันทึกผลการทำข้อสอบ: labKey = "1".."7" หรือ "all" */
export function recordResult({ labKey, part, total, score, secs }) {
  const s = load();
  const pct = total ? Math.round((score / total) * 100) : 0;
  s.history.unshift({ ts: Date.now(), labKey, part, total, score: Math.round(score * 100) / 100, pct, secs: Math.round(secs) });
  s.history = s.history.slice(0, 200);
  s.best[labKey] = Math.max(s.best[labKey] ?? 0, pct);
  s.answered += total;
  save(s);
  return pct;
}

export function saveSetup(setup) {
  const s = load();
  s.setup = setup;
  save(s);
}

export function lastHistoryFor(labKey, n = 5) {
  return load().history.filter((h) => h.labKey === labKey).slice(0, n);
}

export function averagePct() {
  const h = load().history;
  if (!h.length) return null;
  return Math.round(h.reduce((a, b) => a + b.pct, 0) / h.length);
}
