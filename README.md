# แนวแลปกริ้ง — เว็บซ้อมสอบ ปฏิบัติการการค้นพบยาจากแหล่งธรรมชาติ

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
