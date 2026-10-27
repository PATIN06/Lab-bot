export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const pad2 = (n) => String(n).padStart(2, "0");

export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${pad2(m)}:${pad2(s)}`;
}

export const stripHtml = (h) => String(h ?? "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** ชื่อวิทยาศาสตร์เต็ม: ส่วน binomial เป็นตัวเอียง ส่วน author ปกติ */
export function sciHtml(plant) {
  const full = plant.scientificNameFull;
  const bi = plant.scientificName;
  if (!full) return "";
  if (bi && full.startsWith(bi)) return `<i class="sci">${esc(bi)}</i>${esc(full.slice(bi.length))}`;
  return `<i class="sci">${esc(full)}</i>`;
}

const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 4'><rect width='4' height='4' fill='#0a0a0a'/></svg>");
export const placeholder = PLACEHOLDER;

export function openLightbox(src, alt = "") {
  const lb = $("#lightbox");
  const img = $("img", lb);
  img.src = src;
  img.alt = alt;
  lb.hidden = false;
  document.body.classList.add("noscroll");
}

export function closeLightbox() {
  const lb = $("#lightbox");
  lb.hidden = true;
  document.body.classList.remove("noscroll");
}
