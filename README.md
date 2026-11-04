# รวมข้อสอบ — เว็บซ้อมสอบ (ปฏิบัติการการค้นพบยาจากแหล่งธรรมชาติ + เครื่องมือวิเคราะห์ QC)

เว็บ static (HTML + CSS + vanilla JS ES modules ไม่มี build step ไม่มี backend) สำหรับซ้อมสอบแลปกริ้ง
ข้อมูลพืช 227 ชนิด / 7 Lab สกัดจากไฟล์ PDF ต้นฉบับ

- **ส่วนที่ 1** ปรนัย 5 ตัวเลือก (วงศ์ / ชื่อสามัญ / ชื่อวิทยาศาสตร์ / สรรพคุณ / สารสำคัญ / ส่วนที่ใช้) ถามจากชื่อหรือจากรูป
- **ส่วนที่ 2** เติมตัวอักษรสะกดชื่อวิทยาศาสตร์ (ง่าย / กลาง / ยาก, ขอคำใบ้, ข้าม)
- หน้าสรุปคะแนนรายหัวข้อ, ตารางทบทวนข้อที่ผิด, ทำเฉพาะข้อที่ผิดซ้ำ, โหมดทบทวน/การ์ดจำ, หน้าเคล็ดลับข้อสอบ
- คะแนนสูงสุดและประวัติเก็บใน `localStorage` (ถ้าใช้ไม่ได้ก็ทำข้อสอบได้ตามปกติ)
- คีย์ลัด: กด `1–5` หรือ `A–E` เลือกคำตอบ, `Enter` ไปข้อต่อไป

## โครงสร้าง

```
index.html
assets/css/style.css
assets/js/  app.js  quiz-mcq.js  quiz-spelling.js  storage.js  router.js  util.js
data/plants.json      ← ข้อมูลพืชทั้งหมด (แก้มือได้)
data/report.md        ← รายงานการสกัด (จำนวนต่อ Lab, field ที่ขาด, ตัวอย่างให้ตรวจ)
images/lab{n}/NN.webp ← รูปที่บีบอัดแล้ว
scripts/extract.py    ← สคริปต์สกัดจาก PDF (รันบนเครื่องเท่านั้น)
tests/index.html      ← ทดสอบตัวสร้างโจทย์ในเบราว์เซอร์
```

## สกัดข้อมูลจาก PDF ใหม่

```bash
python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/extract.py "/path/to/เนเน่ไม่ได้เก่งในวันเดียว.pdf"
```

สคริปต์จะเขียน `data/plants.json`, `images/lab*/*.webp` และ `data/report.md` ใหม่ทั้งหมด

หมายเหตุเรื่องภาษาไทย: ฟอนต์ THSarabunNew ใน PDF ใช้อักขระ PUA (U+F70A ฯลฯ) แทนวรรณยุกต์ที่เลื่อนตำแหน่ง
สคริปต์แปลงกลับเป็น ่ ้ ๊ ๋ ์ ็ ั ให้แล้ว (ตาราง `PUA` ใน `extract.py`) และรวม `ํา` → `ำ`
ชื่อวิทยาศาสตร์แบบ binomial ได้จากส่วนที่เป็นตัวเอียงใน PDF (ตัด author ออก) บวก `var.`/`subsp.`/`spp.` ถ้ามี

## ทดสอบบนเครื่อง

```bash
python3 -m http.server 8000
```

เปิด <http://localhost:8000/> (ห้ามเปิดไฟล์ตรง ๆ เพราะต้อง fetch `plants.json`)
ทดสอบตัวสร้างโจทย์ที่ <http://localhost:8000/tests/index.html> — ต้องขึ้น `ALL PASS`

## Deploy บน GitHub Pages

1. สร้าง repo บน GitHub แล้ว push ทั้งโฟลเดอร์ (`.gitignore` กัน `*.pdf` และ `.venv/` ไว้แล้ว — **ห้าม commit PDF** เพราะ ~105 MB เกินลิมิต 100 MB ต่อไฟล์ของ GitHub)
2. Settings → Pages → Build and deployment → **Deploy from a branch** → Branch: `main` / `/ (root)` → Save
3. เว็บจะอยู่ที่ `https://<user>.github.io/<repo>/` (ทุก path เป็น relative และใช้ hash routing จึงไม่ 404 เมื่อ refresh)

## แก้ข้อมูลพืชด้วยมือ

แก้ใน `data/plants.json` ได้ตรง ๆ แต่ละต้นมี field:

| field | ความหมาย |
|---|---|
| `thaiName` | ชื่อไทย / ชื่อสามัญ |
| `scientificNameFull` | ชื่อเต็มพร้อม author (แสดงในการ์ดสรุป) |
| `scientificName` | binomial ไม่มี author (ใช้เป็นคำตอบ/ช่องสะกด) |
| `family`, `constituents`, `partUsed`, `uses` | ข้อมูลตามไฟล์; ไม่มีให้ใส่ `null` (ข้อสอบจะข้ามคำถามนั้น) |
| `highlight` | `true` = ชื่อไทยเป็นตัวแดงในไฟล์ |
| `groupTag` | ป้ายกลุ่มสาร เช่น `Terpenes`, `Volatile oils` |

ถ้าจะให้การแก้ยังอยู่หลังรัน `extract.py` ใหม่ ให้สร้าง `scripts/overrides.json` เช่น
`{"L1-02": {"uses": "ข้อความที่แก้แล้ว"}}` — สคริปต์จะนำไปทับให้ทุกครั้ง

## วิชา 2: เครื่องมือวิเคราะห์ทางเภสัชกรรม (QC)

ข้อสอบปรนัย 5 ตัวเลือก 9 ชุด (ไฟล์ละ 20 ข้อ รวม 180 ข้อ) อยู่ที่ `scripts/qc/01.json` … `09.json`
แก้ข้อสอบในไฟล์เหล่านั้นแล้วรัน `python3 scripts/build_qc.py` เพื่อสร้าง `data/qc.json` ใหม่
(โครงสร้างข้อ: `t` หัวข้อ, `q` โจทย์, `a` ข้อถูก, `w` ตัวเลือกหลอก 4 ข้อ, `e` คำอธิบายเฉลย — เว็บสลับตำแหน่งตัวเลือกให้เอง)
หน้าเว็บ: `#/qc` (รายการ 9 ชุด), `#/qc/qc01/all` (ทำข้อสอบ), `#/qc/qc01/key` (เฉลยทั้งชุด)

## วิชา 3: เภสัชเวท (Pharmacognosy)

ข้อสอบปรนัย 5 ตัวเลือก 7 ชุด (ไฟล์ละ 20 ข้อ รวม 140 ข้อ) อยู่ที่ `scripts/pg/01.json` … `07.json`
แก้ข้อสอบแล้วรัน `python3 scripts/build_pg.py` เพื่อสร้าง `data/pg.json` ใหม่ (โครงสร้างข้อเหมือนวิชา QC)

## วิชา 4: R&D ยา (Research & Development)

7 ชุด ชุดละ 20 ข้อ ปรนัย 5 ตัวเลือก (รวม 140 ข้อ) จากสไลด์การขึ้นทะเบียนยา, ASEAN quality guideline, ACTD nonclinical, ยาชีววัตถุ, CRA, R&D ยาชีววัตถุ และสิทธิบัตร/ทรัพย์สินทางปัญญา
ข้อสอบอยู่ที่ `scripts/rg/NN.json` แก้แล้วรัน `python3 scripts/build_rg.py` เพื่อสร้าง `data/rg.json` ใหม่ (โครงสร้างข้อเหมือนวิชา QC)
หน้าเว็บ: `#/pg`, `#/pg/pg01/all` (ทำข้อสอบ), `#/pg/pg01/key` (เฉลยทั้งชุด)

## วิชา 5: Therapy 3 (เภสัชบำบัด 3)

13 ไฟล์ ไฟล์ละ 20 ข้อ ปรนัย 5 ตัวเลือก (รวม 260 ข้อ) จากเอกสารบรรยาย GU, หลักการมะเร็ง, supportive care, ยาเคมีบำบัด, targeted/immuno/hormonal, มะเร็งลำไส้ใหญ่ ปอด ปากมดลูก เต้านม, SSTI, SLE/LN และโรคเขตร้อน
ข้อสอบอยู่ที่ `scripts/tp/NN.json` แก้แล้วรัน `python3 scripts/build_tp.py` เพื่อสร้าง `data/tp.json` ใหม่
หน้าเว็บ: `#/tp`, `#/tp/tp01` (หน้าไฟล์), `#/tp/tp01/all` (ทำข้อสอบ), `#/tp/tp01/key` (เฉลย)
