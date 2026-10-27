// ส่วนที่ 2: เติมตัวอักษรสะกดชื่อวิทยาศาสตร์ (binomial)
import { esc, shuffle, pick } from "./util.js";

const isLetter = (c) => /[A-Za-z]/.test(c);
export const DIFFICULTY = { easy: "ง่าย", medium: "กลาง", hard: "ยาก" };

/** แยก binomial เป็นคำ → ช่อง: {ch, fixed} */
export function layoutName(binomial) {
  return binomial.split(/\s+/).map((w) => [...w].map((ch) => ({ ch, fixed: !isLetter(ch) })));
}

/** เลือกช่องที่เปิดให้เห็นตามระดับความยาก: คืน Set ของ "w:c" */
export function revealedCells(words, difficulty) {
  const open = new Set();
  words.forEach((cells, wi) => {
    const letters = cells.map((c, i) => (c.fixed ? -1 : i)).filter((i) => i >= 0);
    if (!letters.length) return;
    if (difficulty === "medium") {
      open.add(`${wi}:${letters[0]}`);
    } else if (difficulty === "easy") {
      const n = Math.max(1, Math.round(letters.length * 0.4));
      shuffle(letters).slice(0, n).forEach((i) => open.add(`${wi}:${i}`));
    }
  });
  return open;
}

export function buildSpell(plant, difficulty, fromMode) {
  if (!plant.scientificName) return null;
  const from = fromMode === "mixed" ? pick(["name", "image"]) : fromMode;
  const words = layoutName(plant.scientificName);
  return {
    kind: "spell",
    spec: { plantId: plant.id, topic: "spell", from, difficulty },
    plant,
    topic: "spell",
    from,
    difficulty,
    words,
    open: revealedCells(words, difficulty),
    promptHtml:
      from === "image"
        ? "พืชในรูปมีชื่อวิทยาศาสตร์ว่าอะไร (สะกด Genus และ species epithet)"
        : `สะกดชื่อวิทยาศาสตร์ของ ${esc(plant.thaiName)} (Genus และ species epithet)`,
    image: from === "image" ? plant.image : null,
    correctText: plant.scientificName,
    correctHtml: formatAnswer(plant.scientificName),
  };
}

/** Genus ตัวแรกพิมพ์ใหญ่ ที่เหลือพิมพ์เล็ก ตัวเอียง */
export function formatAnswer(binomial) {
  const w = binomial.split(/\s+/);
  w[0] = w[0][0].toUpperCase() + w[0].slice(1).toLowerCase();
  for (let i = 1; i < w.length; i++) w[i] = w[i].toLowerCase();
  return `<i class="sci">${esc(w.join(" "))}</i>`;
}

export function makeSpellQuestions({ plants, count, difficulty, fromMode }) {
  const pool = plants.filter((p) => p.scientificName);
  const total = count === "all" ? pool.length : count;
  const out = [];
  let order = shuffle(pool);
  while (out.length < total && order.length) {
    out.push(buildSpell(order.shift(), difficulty, fromMode));
    if (!order.length && count !== "all" && out.length < total) order = shuffle(pool);
  }
  return out;
}

/** แสดงกล่องตัวอักษร; onDone({correct, score, answer, skipped}) เรียกครั้งเดียวเมื่อเฉลย */
export function mountSpell(container, q, onDone) {
  let hints = 0;
  let done = false;
  container.innerHTML = `
    <div class="spell" role="group" aria-label="ช่องสะกดชื่อวิทยาศาสตร์">
      ${q.words
        .map(
          (cells, wi) => `<div class="spell-word">${cells
            .map((c, ci) => {
              if (c.fixed) return `<span class="cell fixed" aria-hidden="true">${esc(c.ch)}</span>`;
              const given = q.open.has(`${wi}:${ci}`);
              return `<span class="cellwrap"><input class="cell${given ? " given" : ""}" data-w="${wi}" data-c="${ci}" data-ans="${esc(c.ch.toLowerCase())}"
                inputmode="text" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"
                aria-label="ตัวอักษรที่ ${ci + 1} ของคำที่ ${wi + 1}" ${given ? `value="${esc(c.ch.toLowerCase())}" readonly tabindex="-1"` : ""}><small class="fix"></small></span>`;
            })
            .join("")}</div>`
        )
        .join("")}
    </div>
    <div class="spell-actions">
      <button type="button" class="btn-ghost" data-act="hint">ขอคำใบ้ <span class="mono dim" data-hints></span></button>
      <button type="button" class="btn-ghost" data-act="skip">ข้าม</button>
      <button type="button" class="btn-square" data-act="check">ตรวจคำตอบ <span class="arr" aria-hidden="true">↗</span></button>
    </div>`;

  const inputs = () => [...container.querySelectorAll("input.cell")];
  const editable = () => inputs().filter((i) => !i.readOnly);
  const first = editable()[0];
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);

  container.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.matches("input.cell") || done) return;
    const list = editable();
    const idx = list.indexOf(el);
    // e.data = ตัวที่เพิ่งพิมพ์/วาง (ไม่มี maxlength เพื่อให้วางหลายตัวหรือพิมพ์ทับได้)
    const raw = (e.data ?? el.value).replace(/[^A-Za-z]/g, "").toLowerCase();
    if (!raw) {
      el.value = "";
      return;
    }
    let k = idx;
    for (const ch of raw) {
      if (k >= list.length) break;
      list[k++].value = ch;
    }
    const target = list[Math.min(k, list.length - 1)];
    if (target) target.focus();
  });

  container.addEventListener("keydown", (e) => {
    const el = e.target;
    if (!el.matches || !el.matches("input.cell") || done) return;
    const list = editable();
    const idx = list.indexOf(el);
    if (e.key === "Backspace" && !el.value && idx > 0) {
      e.preventDefault();
      list[idx - 1].value = "";
      list[idx - 1].focus();
    } else if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      list[idx - 1].focus();
    } else if (e.key === "ArrowRight" && idx < list.length - 1) {
      e.preventDefault();
      list[idx + 1].focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      finish(false);
    }
  });
  container.addEventListener("focusin", (e) => e.target.matches?.("input.cell") && e.target.select());

  container.querySelector('[data-act="hint"]').addEventListener("click", () => {
    if (done) return;
    const open = editable().filter((i) => i.value !== i.dataset.ans && !i.classList.contains("hinted"));
    if (!open.length) return;
    const el = pick(open);
    el.value = el.dataset.ans;
    el.classList.add("hinted");
    el.readOnly = true;
    hints++;
    container.querySelector("[data-hints]").textContent = `(${hints})`;
  });
  container.querySelector('[data-act="skip"]').addEventListener("click", () => finish(true));
  container.querySelector('[data-act="check"]').addEventListener("click", () => finish(false));

  function typed() {
    return q.words
      .map((cells, wi) =>
        cells
          .map((c, ci) => {
            if (c.fixed) return c.ch;
            const el = container.querySelector(`input[data-w="${wi}"][data-c="${ci}"]`);
            return el.value || "_";
          })
          .join("")
      )
      .join(" ");
  }

  function finish(skipped) {
    if (done) return;
    done = true;
    let allRight = true;
    const answer = typed();
    inputs().forEach((el) => {
      el.readOnly = true;
      const ok = el.value === el.dataset.ans;
      if (!ok) allRight = false;
      el.classList.toggle("right", ok);
      el.classList.toggle("wrong", !ok);
      if (!ok) el.parentElement.querySelector(".fix").textContent = el.dataset.ans;
    });
    container.querySelector(".spell-actions").hidden = true;
    const correct = !skipped && allRight;
    const score = correct ? Math.max(0, 1 - 0.25 * hints) : 0;
    onDone({ correct, score, answer: skipped ? "(ข้าม)" : answer, skipped, hints });
  }
}
