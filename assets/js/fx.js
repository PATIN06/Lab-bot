// เอฟเฟกต์ 3D/ภาพเคลื่อนไหว — ปิดอัตโนมัติเมื่อผู้ใช้ตั้งค่า reduced motion และไม่เอียงการ์ดบนจอสัมผัส
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
let pending = [];
let bound = false;

function checkReveal() {
  const h = innerHeight || document.documentElement.clientHeight || 800;
  pending = pending.filter((el) => {
    if (!el.isConnected) return false;
    if (el.getBoundingClientRect().top < h * 0.94) {
      el.classList.add("in");
      return false;
    }
    return true;
  });
}

export function initFx(root) {
  // scroll reveal (ใช้ scroll + getBoundingClientRect เพื่อไม่พึ่ง IntersectionObserver ที่อาจไม่ทำงานในแท็บเบื้องหลัง)
  const items = [...root.querySelectorAll(".reveal")];
  if (reduce) {
    items.forEach((el) => el.classList.add("in"));
  } else {
    items.forEach((el, i) => el.style.setProperty("--d", `${Math.min(i % 6, 5) * 60}ms`));
    pending = items;
    if (!bound) {
      bound = true;
      addEventListener("scroll", checkReveal, { passive: true });
      addEventListener("resize", checkReveal);
    }
    checkReveal();
    setTimeout(checkReveal, 120);
    setTimeout(checkReveal, 700);
  }

  if (reduce || !fine) return;

  // 3D tilt + glare ตามตำแหน่งเมาส์
  root.querySelectorAll("[data-tilt]").forEach((el) => {
    const max = Number(el.dataset.tilt) || 7;
    let raf = 0;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--ry", `${((x - 0.5) * 2 * max).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${((0.5 - y) * 2 * max).toFixed(2)}deg`);
        el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
        el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      });
      el.classList.add("tilting");
    });
    el.addEventListener("pointerleave", () => {
      el.classList.remove("tilting");
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    });
  });

  // parallax ของฮีโร่
  const hero = root.querySelector(".hero");
  if (hero) {
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      hero.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    });
  }
}
