// หน้าแรกแบบ "ออฟฟิศไอโซเมตริก" — วาดด้วย SVG/CSS ล้วน ไม่มีไฟล์ภาพ
import { esc } from "./util.js?v=18";

const TONES = {
  blue: { top: "#1b3d6b", left: "#112b4c", right: "#0b1e36", edge: "#52a8ff", screen: "#7cc0ff" },
  cyan: { top: "#14494d", left: "#0d3538", right: "#08272b", edge: "#4fe3d6", screen: "#8ff3ea" },
  green: { top: "#1f4d2d", left: "#153822", right: "#0f2818", edge: "#62c073", screen: "#9be0aa" },
  violet: { top: "#3b2b66", left: "#2a1e4b", right: "#1d1535", edge: "#b79cff", screen: "#d3c3ff" },
};

/** กล่องไอโซเมตริกฐานสี่เหลี่ยมจัตุรัส (cx,cy = กึ่งกลางพื้นล่าง) */
function box(cx, cy, W, h, t, extra = "") {
  const q = W / 4;
  const top = `${cx},${cy - h - q} ${cx + W / 2},${cy - h} ${cx},${cy - h + q} ${cx - W / 2},${cy - h}`;
  const left = `${cx - W / 2},${cy - h} ${cx},${cy - h + q} ${cx},${cy + q} ${cx - W / 2},${cy}`;
  const right = `${cx},${cy - h + q} ${cx + W / 2},${cy - h} ${cx + W / 2},${cy} ${cx},${cy + q}`;
  return `<g ${extra}><polygon points="${left}" fill="${t.left}"/><polygon points="${right}" fill="${t.right}"/><polygon points="${top}" fill="${t.top}" stroke="${t.edge}" stroke-opacity=".55" stroke-width="1"/></g>`;
}

function desk(cx, cy, t) {
  // โต๊ะ + จอคอมพิวเตอร์เรืองแสง
  return (
    box(cx, cy, 48, 12, { left: "#1a1f2b", right: "#11151e", top: "#262d3c", edge: t.edge }) +
    box(cx, cy - 8, 22, 18, { left: "#0a0d14", right: "#06080d", top: t.screen, edge: t.edge }, 'class="screen"') +
    `<ellipse cx="${cx + 14}" cy="${cy + 2}" rx="4" ry="2" fill="${t.edge}" opacity=".7"/>`
  );
}

function plant(x, y) {
  return `<g><ellipse cx="${x}" cy="${y + 4}" rx="9" ry="4" fill="#0b1a12"/><path d="M${x} ${y} C${x - 14} ${y - 8} ${x - 10} ${y - 26} ${x} ${y - 30} C${x + 10} ${y - 26} ${x + 14} ${y - 8} ${x} ${y}Z" fill="#2f8f4e"/><path d="M${x} ${y} C${x - 22} ${y - 4} ${x - 20} ${y - 18} ${x - 12} ${y - 22} C${x - 4} ${y - 14} ${x - 2} ${y - 6} ${x} ${y}Z" fill="#3fae63" opacity=".9"/></g>`;
}

function room(r) {
  const t = TONES[r.tone];
  const W = 240;
  const h = 16;
  const { cx, cy } = r;
  const topC = cy - h; // กึ่งกลางผิวพื้น
  const g = 38;
  const spots = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => [cx + (u - v) * g, topC + ((u + v) * g) / 2]);
  const warn = r.state === "warn";
  return `<g class="room" data-state="${r.state}">
    ${warn ? `<polygon class="warn-ring" points="${cx},${topC - 66} ${cx + 128},${topC} ${cx},${topC + 66} ${cx - 128},${topC}" fill="none" stroke="#ff5d5d" stroke-width="2"/>` : ""}
    ${box(cx, cy, W, h, t, 'class="slab"')}
    <polygon points="${cx},${topC - 52} ${cx + 100},${topC} ${cx},${topC + 52} ${cx - 100},${topC}" fill="none" stroke="${t.edge}" stroke-opacity=".35" stroke-dasharray="3 5"/>
    ${spots.map(([x, y]) => desk(x, y - 4, t)).join("")}
    ${plant(cx - 100, topC + 4)}
    ${plant(cx + 100, topC + 4)}
  </g>`;
}

function hub(cx, cy, label) {
  const t = { top: "#2a6fa8", left: "#17476f", right: "#0f3050", edge: "#7cd0ff" };
  const layers = [
    [190, 14, { top: "#18304d", left: "#10223a", right: "#0a1829", edge: "#52a8ff" }],
    [128, 46, t],
    [94, 46, { ...t, top: "#3b86c4" }],
    [60, 46, { ...t, top: "#59a6e0", edge: "#c9ecff" }],
  ];
  let y = cy;
  let out = "";
  for (const [W, h, tone] of layers) {
    out += box(cx, y, W, h, tone);
    y -= h;
  }
  return `<g class="hub">${out}<ellipse cx="${cx}" cy="${cy - 8}" rx="108" ry="54" fill="none" stroke="#7cd0ff" stroke-opacity=".5" class="hub-ring"/><circle cx="${cx}" cy="${y - 10}" r="5" fill="#fff" class="hub-beacon"/></g>`;
}

function floor() {
  const cx = 500;
  const cy = 310;
  const hw = 470;
  const hh = 235;
  const n = 14;
  let g = "";
  // กริด: ใช้การแบ่งขอบเป็น n ส่วนแล้วต่อเส้นขนาน
  const P = { top: [cx, cy - hh], right: [cx + hw, cy], bottom: [cx, cy + hh], left: [cx - hw, cy] };
  const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const a1 = lerp(P.top, P.right, k);
    const a2 = lerp(P.left, P.bottom, k);
    const b1 = lerp(P.top, P.left, k);
    const b2 = lerp(P.right, P.bottom, k);
    g += `<line x1="${a1[0]}" y1="${a1[1]}" x2="${a2[0]}" y2="${a2[1]}"/><line x1="${b1[0]}" y1="${b1[1]}" x2="${b2[0]}" y2="${b2[1]}"/>`;
  }
  return `<g class="floor">
    <polygon points="${P.top} ${P.right} ${P.bottom} ${P.left}" fill="url(#floorGrad)" stroke="#52a8ff" stroke-opacity=".5" stroke-width="1.5"/>
    <g stroke="#52a8ff" stroke-opacity=".12" stroke-width="1">${g}</g>
    <polygon points="${P.left} ${P.bottom} ${P.bottom[0]},${P.bottom[1] + 22} ${P.left[0]},${P.left[1] + 22}" fill="#060d1a"/>
    <polygon points="${P.bottom} ${P.right} ${P.right[0]},${P.right[1] + 22} ${P.bottom[0]},${P.bottom[1] + 22}" fill="#040913"/>
  </g>`;
}

const pctText = (v) => (v === null ? "ยังไม่เริ่ม" : `เฉลี่ย ${v}%`);

export function officeHtml(d) {
  const spots = [
    { x: 322, y: 225 },
    { x: 678, y: 225 },
    { x: 322, y: 395 },
    { x: 678, y: 395 },
  ];
  const rooms = d.rooms.map((r, i) => ({ ...r, cx: spots[i].x, cy: spots[i].y }));
  const lines = rooms
    .map((r) => `<line class="beam" x1="500" y1="310" x2="${r.cx}" y2="${r.cy}" style="stroke:${TONES[r.tone].edge}"/>`)
    .join("");
  const defs = `<defs>
    <radialGradient id="floorGrad" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#0f2342"/><stop offset=".6" stop-color="#091426"/><stop offset="1" stop-color="#050a14"/></radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;
  const tag = (r) => {
    const shift = r.cx < 500 ? -60 : 60;
    const left = ((r.cx + shift) / 1000) * 100;
    const top = ((r.cy - 16 - 118) / 560) * 100;
    return `<a class="room-tag" href="${r.href}" style="left:${left}%;top:${top}%;--ac:${TONES[r.tone].edge}" data-state="${r.state}" aria-label="${esc(r.title)}">
      <span class="rt-dot ${r.state}"></span><span class="rt-body"><b>${esc(r.short)}</b><small>${esc(r.meta)} · ${esc(pctText(r.avg))}</small></span></a>`;
  };
  const hubTag = `<a class="room-tag hub-tag" href="${d.hub.href}" style="left:50%;top:${((310 - 16 - 232) / 560) * 100}%;--ac:#7cd0ff"><span class="rt-dot ok"></span><span class="rt-body"><b>${esc(d.hub.title)}</b><small>${esc(d.hub.meta)}</small></span></a>`;
  const scene = `<div class="scene" role="img" aria-label="ออฟฟิศรวมข้อสอบ แต่ละห้องคือหนึ่งวิชา">
      <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${defs}
        <ellipse cx="500" cy="320" rx="470" ry="240" fill="#52a8ff" opacity=".07" filter="url(#glow)"/>
        ${floor()}
        ${lines}
        ${room(rooms[0])}${room(rooms[1])}
        ${hub(500, 310, d.hub.title)}
        ${room(rooms[2])}${room(rooms[3])}
        <g class="particles">${Array.from({ length: 14 }, (_, i) => `<circle cx="${80 + ((i * 67) % 840)}" cy="${60 + ((i * 41) % 440)}" r="${1.2 + (i % 3) * 0.6}" fill="#8ccfff" class="pt" style="animation-delay:${(i % 7) * 0.7}s"/>`).join("")}</g>
      </svg>
      ${rooms.map(tag).join("")}${hubTag}
    </div>`;

  const grid = `<div class="room-grid">${[...rooms, { ...d.hub, tone: "blue", short: d.hub.title, state: "ok", meta: d.hub.meta, avg: null, hubCard: true }]
    .filter((r) => !r.hubCard)
    .map(
      (r) => `<a class="room-card" href="${r.href}" style="--ac:${TONES[r.tone].edge}"><span class="rt-dot ${r.state}"></span><b>${esc(r.short)}</b><small>${esc(r.meta)}</small><small class="dim">${esc(pctText(r.avg))}</small></a>`
    )
    .join("")}</div>`;

  const banner = `<a class="office-alert ${d.banner.tone}" href="${d.banner.href}"><span class="al-ico" aria-hidden="true">${d.banner.tone === "warn" ? "!" : "✓"}</span><span class="al-text"><b>${esc(d.banner.title)}</b><small>${esc(d.banner.text)}</small></span><span class="al-go mono">ดูทั้งหมด ↗</span></a>`;

  const stats = d.stats
    .map((s) => `<div class="ostat"><div class="num">${s.n}<span class="unit mono">${esc(s.unit)}</span></div><div class="mono dim">${esc(s.label)}</div></div>`)
    .join("");

  const alerts =
    d.alerts
      .map(
        (a) => `<li class="note ${a.tone}"><span class="note-ico" aria-hidden="true">${a.tone === "fail" ? "!" : a.tone === "pass" ? "✓" : "i"}</span><div><b>${esc(a.title)}</b><small>${esc(a.text)}</small></div><span class="mono dim note-time">${esc(a.time)}</span></li>`
      )
      .join("") || `<li class="note info"><span class="note-ico" aria-hidden="true">i</span><div><b>ยังไม่มีประวัติการสอบ</b><small>เลือกห้องแล้วเริ่มทำชุดแรกได้เลย</small></div></li>`;

  const shortcuts = d.shortcuts
    .map((s) => `<a class="short" href="${s.href}"><span class="short-ico mono" aria-hidden="true">${esc(s.icon)}</span>${esc(s.label)}</a>`)
    .join("");

  const bar = d.sets
    .map((s) => `<a class="agent ${s.state}" href="${s.href}" title="${esc(s.title)}" style="--ac:${TONES[s.tone].edge}"><span class="ag-av mono">${esc(s.label)}</span><small>${esc(s.sub)}</small></a>`)
    .join("");

  return `<section class="wrap office" aria-label="ภาพรวม">
    ${banner}
    <div class="office-main">
      <div class="office-scene">
        <header class="office-head"><div><h1>รวมข้อสอบ <span>OFFICE</span></h1><p>Smarter practice. Stronger scores.</p></div><div class="chip"><i class="dot"></i>ONLINE</div></header>
        ${scene}${grid}
      </div>
      <aside class="office-side">
        <section class="panel"><h2>ภาพรวม</h2><div class="ostats">${stats}</div></section>
        <section class="panel"><h2>การแจ้งเตือนล่าสุด</h2><ul class="notes">${alerts}</ul></section>
        <section class="panel"><h2>ทางลัด</h2><div class="shorts">${shortcuts}</div></section>
      </aside>
    </div>
    <section class="agent-bar" aria-label="ชุดข้อสอบทั้งหมด"><div class="ab-title"><b>ชุดข้อสอบ</b><small class="mono dim">${d.sets.length} ชุด พร้อมใช้งาน</small></div><div class="ab-list">${bar}</div></section>
  </section>`;
}
