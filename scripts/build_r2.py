#!/usr/bin/env python3
"""รวมข้อสอบทะเบียนยา (scripts/rg/NN.json) → data/r2.json  — แก้ข้อสอบที่ไฟล์ NN.json แล้วรันสคริปต์นี้
โครงสร้างข้อเหมือน scripts/build_qc.py: {t, q, a, w:[4], e}"""
import glob, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
files = []
for f in sorted(glob.glob(str(ROOT / "scripts" / "r2" / "*.json"))):
    d = json.load(open(f, encoding="utf-8"))
    for i, q in enumerate(d["questions"], 1):
        assert len(q["w"]) == 4, (f, i)
        assert len({q["a"], *q["w"]}) == 5, (f, i, "ตัวเลือกซ้ำ")
    files.append(d)
out = {"subject": {"id": "r2", "title": "R&D ยา ชุดที่ 2", "code": "การขึ้นทะเบียนยา / ชีววัตถุ / ทรัพย์สินทางปัญญา"}, "files": files}
(ROOT / "data" / "r2.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(files), "files,", sum(len(f["questions"]) for f in files), "questions")
