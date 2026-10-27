#!/usr/bin/env python3
"""สกัดข้อมูลพืชและรูปจาก PDF แนวแลปกริ้ง -> data/plants.json, images/lab{n}/NN.webp, data/report.md

วิธีใช้:  python scripts/extract.py "/path/to/เนเน่ไม่ได้เก่งในวันเดียว.pdf"
แก้ข้อมูลที่สกัดผิดด้วยมือได้ใน scripts/overrides.json (ดู README) — สคริปต์จะนำไปทับให้ทุกครั้งที่รัน
"""
import io
import json
import re
import sys
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PDF = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads" / "เนเน่ไม่ได้เก่งในวันเดียว.pdf"

# (lab id, หน้าปก, หน้าตาราง first..last) — เลขหน้าเริ่มที่ 1
LABS = [
    (1, 4, (5, 9)),
    (2, 10, (11, 17)),
    (3, 18, (19, 20)),
    (4, 21, (22, 25)),
    (5, 26, (27, 28)),
    (6, 29, (30, 31)),
    (7, 32, (33, 35)),
]

RED = 0xFF3131

# ฟอนต์ THSarabunNew ใน PDF ใช้อักขระ PUA แทนวรรณยุกต์/สระที่เลื่อนตำแหน่ง
PUA = {
    0xF701: "ิ", 0xF702: "ี", 0xF703: "ึ", 0xF704: "ื",
    0xF705: "่", 0xF706: "้", 0xF707: "๊", 0xF708: "๋", 0xF709: "์",
    0xF70A: "่", 0xF70B: "้", 0xF70C: "๊", 0xF70D: "๋", 0xF70E: "์",
    0xF710: "ั", 0xF711: "ํ", 0xF712: "็",
    0xF713: "่", 0xF714: "้", 0xF715: "๊", 0xF716: "๋", 0xF717: "์",
}

LABEL_RE = re.compile(r"^(ชื่อวิทยาศาสตร์|วงศ์|กลุ่มสาร/สารสำคัญ|สารสำคัญ|ส่วนที่ใช้|สรรพคุณ)\s*:\s*(.*)$")
LABEL_KEY = {
    "ชื่อวิทยาศาสตร์": "sci",
    "วงศ์": "family",
    "สารสำคัญ": "constituents",
    "กลุ่มสาร/สารสำคัญ": "constituents",
    "ส่วนที่ใช้": "partUsed",
    "สรรพคุณ": "uses",
}
INFRA_RE = re.compile(r"^\s*((?:var|subsp|ssp|f)\.\s+[a-z][a-z-]+)")


def norm(s: str) -> str:
    s = "".join(PUA.get(ord(c), c) for c in s)
    s = s.replace("ﬁ", "fi").replace("ﬂ", "fl").replace("ﬀ", "ff")
    s = re.sub(r"ํ([่้๊๋])า", r"\1ำ", s)   # นํ้า -> น้ำ
    s = s.replace("ํา", "ำ")
    s = s.replace(" ", " ")
    return re.sub(r"[ \t]+", " ", s)


def is_thai(c: str) -> bool:
    return "฀" <= c <= "๿"


def collect_lines(page):
    """ทุกบรรทัดข้อความในหน้า พร้อม spans"""
    lines = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            spans = [s for s in l["spans"] if s["text"].strip() or s["text"]]
            if not spans:
                continue
            raw = "".join(s["text"] for s in spans)
            if not raw.strip():
                continue
            lines.append({"bbox": l["bbox"], "spans": spans, "raw": raw})
    return lines


def cell_join(lines_raw):
    """ต่อข้อความหลายบรรทัดของ field เดียวกัน"""
    out = ""
    for raw in lines_raw:
        t = norm(raw)
        if not t.strip():
            continue
        if not out:
            out = t
            continue
        a, b = out, t
        if is_thai(a.rstrip()[-1]) and is_thai(b.lstrip()[0]) and not a.endswith(" ") and not b.startswith(" "):
            out = a + b
        else:
            out = a.rstrip() + " " + b.lstrip()
    return re.sub(r"\s+", " ", out).strip()


def clean_sci(s):
    if not s:
        return None
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


def build_binomial(italic_text: str, full: str):
    """binomial = ส่วนตัวเอียง + infraspecific (var./subsp.) หรือ spp. ถ้ามี (ตัด author ออก)"""
    if not italic_text:
        return None
    b = re.sub(r"\s+", " ", italic_text).strip()
    if re.search(r"\bspp?\.$", b):
        return b
    rest = full.split(b, 1)[-1] if b in full else ""
    m = re.match(r"^\s*(spp?\.)", rest)
    if m:
        return b + " " + m.group(1)
    m = INFRA_RE.match(rest)
    if m and not re.search(r"\b(var|subsp|ssp)\.", b):
        return b + " " + m.group(1)
    return b


def parse_cell(lines, img_bbox):
    """lines: บรรทัดทั้งหมดที่อยู่ในเซลล์นี้ เรียงตามแกน y"""
    lines = sorted(lines, key=lambda l: (round(l["bbox"][1]), l["bbox"][0]))
    name_lines = [l for l in lines if l["bbox"][3] <= img_bbox[1] + 2]
    body = [l for l in lines if l["bbox"][1] >= img_bbox[3] - 12]

    name_raw = " ".join(l["raw"] for l in name_lines)
    name_n = norm(name_raw).strip()
    m = re.match(r"^(\d+)\s*\.\s*(.*)$", name_n)
    no = int(m.group(1)) if m else None
    thai = m.group(2).strip() if m else name_n
    highlight = any(
        (s["color"] & 0xFFFFFF) == RED for l in name_lines for s in l["spans"] if s["text"].strip()
    )

    fields = {}
    italics = []
    group_parts = []
    cur = None
    for l in body:
        raw = l["raw"]
        t = norm(raw).strip()
        m = LABEL_RE.match(t)
        if m:
            cur = LABEL_KEY[m.group(1)]
            fields[cur] = [m.group(2)]
            if cur == "sci":
                # ข้อความตัวเอียงหลัง label
                it = "".join(s["text"] for s in l["spans"] if "Italic" in s["font"] or (s["flags"] & 2))
                if it.strip():
                    italics.append(it)
            continue
        if cur is None:
            group_parts.append(t)
        else:
            fields[cur].append(raw if cur != "sci" else norm(raw))
            if cur == "sci":
                it = "".join(s["text"] for s in l["spans"] if "Italic" in s["font"] or (s["flags"] & 2))
                if it.strip():
                    italics.append(it)

    out = {"no": no, "thaiName": thai, "highlight": highlight}
    group = " ".join(group_parts).strip() or None
    out["groupTag"] = group
    for key in ("family", "constituents", "partUsed", "uses"):
        out[key] = cell_join(fields[key]) if key in fields else None
        if out[key] == "":
            out[key] = None
    sci_full = cell_join(fields["sci"]) if "sci" in fields else None
    sci_full = clean_sci(sci_full)
    out["scientificNameFull"] = sci_full
    it = norm(re.sub(r"\s+", " ", " ".join(i.strip() for i in italics))).strip()
    out["scientificName"] = build_binomial(it, sci_full or "") if sci_full else None
    return out


def render_cell_image(page, sq_bbox, overlays, dest: Path):
    """เรนเดอร์ภาพพืช (รวมภาพ crude drug ที่แปะทับ) เป็น WebP ด้านยาว ~640px"""
    inset = 7
    r = pymupdf.Rect(sq_bbox) + (inset, inset, -inset, -inset)
    for o in overlays:
        r |= pymupdf.Rect(o)
    # กันข้อความใต้รูป/ชื่อพืชรั่วเข้ามาเมื่อภาพแปะทับล้นกรอบ
    r.y1 = min(r.y1, sq_bbox[3] - 6)
    r.y0 = max(r.y0, sq_bbox[1] + 2)
    r &= page.rect
    zoom = 640 / max(r.width, r.height)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=r, alpha=False)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    dest.parent.mkdir(parents=True, exist_ok=True)
    for q in (75, 68, 60, 52):
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=q, method=6)
        if buf.tell() <= 80 * 1024:
            break
    dest.write_bytes(buf.getvalue())
    return buf.tell()


def main():
    doc = pymupdf.open(PDF)
    overrides = {}
    ov_path = ROOT / "scripts" / "overrides.json"
    if ov_path.exists():
        overrides = json.loads(ov_path.read_text(encoding="utf-8"))

    labs_out = []
    report = []
    missing = []
    unmatched = []

    for lab_id, cover_pg, (p0, p1) in LABS:
        # ปกบท
        cl = collect_lines(doc[cover_pg - 1])
        title, note = None, None
        for l in cl:
            size = l["spans"][0]["size"]
            t = norm(l["raw"]).strip()
            if re.match(r"^LAB\s*\d+$", t, re.I):
                continue
            if title is None and 35 < size < 50:
                title = t
            elif title is not None:
                note = (note + " " + t) if note else t
        if title and "(" in title:
            title, extra = title.split("(", 1)
            title = title.strip()
            note = ("(" + extra + (" " + note if note else "")).strip()
        if title:
            title = title[0].upper() + title[1:]
        plants = []
        for pg in range(p0, p1 + 1):
            page = doc[pg - 1]
            info = page.get_text("dict")["blocks"]
            sqs = [b for b in info if b["type"] == 1 and b["width"] == 540 and b["height"] == 540]
            others = [b["bbox"] for b in info if b["type"] == 1 and not (b["width"] == 540 and b["height"] == 540)]
            lines = collect_lines(page)
            sqs.sort(key=lambda b: (0 if (b["bbox"][1] + b["bbox"][3]) / 2 < 300 else 1, b["bbox"][0]))
            for b in sqs:
                bb = pymupdf.Rect(b["bbox"])
                x0 = bb.x0 - 28
                x1 = bb.x0 + 140
                row1 = (bb.y0 + bb.y1) / 2 < 300
                y0, y1 = (0, 314) if row1 else (314, 600)
                cell_lines = [
                    l for l in lines
                    if x0 <= l["bbox"][0] < x1 and y0 <= l["bbox"][1] < y1
                ]
                data = parse_cell(cell_lines, bb)
                if data["no"] is None:
                    unmatched.append(f"Lab {lab_id} หน้า {pg}: อ่านชื่อ/ลำดับไม่ได้ ({bb})")
                    continue
                # overlay ที่ซ้อนกับรูปหลัก (ภาพ crude drug แปะทับ) — ไม่เอารูปใหญ่หรือรูปที่ไม่ซ้อน
                ovs = []
                for o in others:
                    orc = pymupdf.Rect(o)
                    if orc.width > 160 or orc.height > 160:
                        continue
                    inter = orc & bb
                    if inter.is_empty or inter.get_area() < 0.5 * orc.get_area():
                        continue
                    ovs.append(o)
                pid = f"L{lab_id}-{data['no']:02d}"
                rel = f"images/lab{lab_id}/{data['no']:02d}.webp"
                size = render_cell_image(page, bb, ovs, ROOT / rel)
                plant = {
                    "id": pid,
                    "no": data["no"],
                    "thaiName": data["thaiName"],
                    "highlight": data["highlight"],
                    "scientificNameFull": data["scientificNameFull"],
                    "scientificName": data["scientificName"],
                    "family": data["family"],
                    "constituents": data["constituents"],
                    "partUsed": data["partUsed"],
                    "uses": data["uses"],
                    "groupTag": data["groupTag"],
                    "image": rel,
                    "_page": pg,
                }
                plants.append(plant)
        plants.sort(key=lambda p: p["no"])
        labs_out.append({"id": lab_id, "title": title, "note": note, "plants": plants})

    # overrides: {"L1-02": {"thaiName": "..."}}
    for lab in labs_out:
        for p in lab["plants"]:
            for k, v in overrides.get(p["id"], {}).items():
                p[k] = v

    # หน้า 2–3
    def page_lines(n):
        out = []
        for l in sorted(collect_lines(doc[n - 1]), key=lambda l: (round(l["bbox"][1]), l["bbox"][0])):
            if l["spans"][0]["size"] > 40:
                continue
            t = norm(l["raw"]).strip()
            if t:
                out.append(t)
        return out

    data = {"labs": labs_out, "examTips": page_lines(2), "focusGroups": page_lines(3)}
    for lab in data["labs"]:
        for p in lab["plants"]:
            p.pop("_page", None)

    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data" / "plants.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    # ---- report ----
    rep = ["# รายงานการสกัดข้อมูล", ""]
    rep.append("| Lab | หัวข้อ | จำนวนพืช |")
    rep.append("|---|---|---|")
    total = 0
    for lab in labs_out:
        rep.append(f"| {lab['id']} | {lab['title']} | {len(lab['plants'])} |")
        total += len(lab["plants"])
    rep.append(f"| | **รวม** | **{total}** |")
    rep.append("")
    rep.append("## Field ที่ขาด (null)")
    rep.append("")
    any_missing = False
    for lab in labs_out:
        for p in lab["plants"]:
            miss = [k for k in ("scientificNameFull", "scientificName", "family", "constituents", "partUsed", "uses") if not p[k]]
            if miss:
                any_missing = True
                rep.append(f"- {p['id']} {p['thaiName']}: {', '.join(miss)}")
    if not any_missing:
        rep.append("- ไม่มี")
    rep.append("")
    rep.append("## รูปที่จับคู่ไม่ได้ / อ่านชื่อไม่ได้")
    rep.append("")
    rep += [f"- {u}" for u in unmatched] or ["- ไม่มี"]
    rep.append("")
    rep.append("## ลำดับพืชไม่ต่อเนื่อง")
    rep.append("")
    gaps = []
    for lab in labs_out:
        nos = [p["no"] for p in lab["plants"]]
        exp = list(range(1, max(nos) + 1)) if nos else []
        if nos != exp:
            gaps.append(f"- Lab {lab['id']}: ได้ {nos} คาดว่า 1..{max(nos)}")
    rep += gaps or ["- ไม่มี"]
    rep.append("")
    rep.append("## ตรวจชื่อวิทยาศาสตร์ (binomial) ที่มี var./subsp./spp./ขีด หรือผิดรูปแบบปกติ")
    rep.append("")
    for lab in labs_out:
        for p in lab["plants"]:
            b = p["scientificName"]
            if b and (re.search(r"var\.|subsp\.|spp?\.|-|×", b) or not re.match(r"^[A-Z][a-z]+ [a-z-]+$", b)):
                rep.append(f"- {p['id']} {p['thaiName']}: `{b}`  ← full: `{p['scientificNameFull']}`")
    rep.append("")
    rep.append("## ตัวแดง (highlight)")
    rep.append("")
    for lab in labs_out:
        hl = [f"{p['no']}.{p['thaiName']}" for p in lab["plants"] if p["highlight"]]
        rep.append(f"- Lab {lab['id']}: " + (", ".join(hl) if hl else "-"))
    rep.append("")
    rep.append("## ตัวอย่างข้อมูล 5 ต้นต่อ Lab (สำหรับเทียบกับไฟล์)")
    rep.append("")
    for lab in labs_out:
        rep.append(f"### Lab {lab['id']} {lab['title']}")
        n = len(lab["plants"])
        idx = sorted({0, n // 4, n // 2, (3 * n) // 4, n - 1})
        for i in idx:
            p = lab["plants"][i]
            rep.append(f"- **{p['no']}. {p['thaiName']}** — `{p['scientificNameFull']}` | วงศ์ {p['family']} | สาร: {p['constituents']} | ส่วนที่ใช้: {p['partUsed']} | สรรพคุณ: {p['uses']} | tag: {p['groupTag']}")
        rep.append("")
    (ROOT / "data" / "report.md").write_text("\n".join(rep), encoding="utf-8")

    print(f"สกัดแล้ว {total} ต้น")
    for lab in labs_out:
        print(f"  Lab {lab['id']}: {len(lab['plants'])}")


if __name__ == "__main__":
    main()
