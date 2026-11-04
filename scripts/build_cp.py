#!/usr/bin/env python3
"""รวมข้อสอบทะเบียนยา (scripts/rg/NN.json) → data/cp.json  — แก้ข้อสอบที่ไฟล์ NN.json แล้วรันสคริปต์นี้
โครงสร้างข้อเหมือน scripts/build_qc.py: {t, q, a, w:[4], e}"""
import glob, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
files = []
for f in sorted(glob.glob(str(ROOT / "scripts" / "cp" / "*.json"))):
    d = json.load(open(f, encoding="utf-8"))
    for i, q in enumerate(d["questions"], 1):
        assert len(q["w"]) == 4, (f, i)
        assert len({q["a"], *q["w"]}) == 5, (f, i, "ตัวเลือกซ้ำ")
    files.append(d)
out = {"subject": {"id": "cp", "title": "Ceutic 1 (เภสัชภัณฑ์ 1)", "code": "ยาน้ำใส ยาสกัดสมุนไพร ความคงตัว QC และบรรจุภัณฑ์"}, "files": files}
(ROOT / "data" / "cp.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(files), "files,", sum(len(f["questions"]) for f in files), "questions")
