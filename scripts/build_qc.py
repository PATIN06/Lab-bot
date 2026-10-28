#!/usr/bin/env python3
"""รวมข้อสอบ QC (scripts/qc/NN.json) → data/qc.json  — แก้ข้อสอบที่ไฟล์ NN.json แล้วรันสคริปต์นี้
โครงสร้างข้อ: {t: หัวข้อ, q: โจทย์, a: ข้อถูก, w: [ตัวเลือกหลอก 4 ข้อ], e: คำอธิบายเฉลย}
เว็บจะสลับตำแหน่งตัวเลือกให้สุ่มทุกครั้ง"""
import glob, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
files = []
for f in sorted(glob.glob(str(ROOT / "scripts" / "qc" / "*.json"))):
    d = json.load(open(f, encoding="utf-8"))
    for i, q in enumerate(d["questions"], 1):
        assert len(q["w"]) == 4, (f, i)
        assert len({q["a"], *q["w"]}) == 5, (f, i, "ตัวเลือกซ้ำ")
    files.append(d)
out = {
    "subject": {"id": "qc", "title": "เครื่องมือวิเคราะห์ทางเภสัชกรรม (QC)", "code": "79121168 Pharmaceutical Analytical Instrument"},
    "files": files,
}
(ROOT / "data" / "qc.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(files), "files,", sum(len(f["questions"]) for f in files), "questions")
