# Board Admin + Realtime Game — กระดานเกมเศษฐี101

Server ตัวเดียวรวมสองส่วนไว้ด้วยกัน:

1. **REST API** (Express) — ให้แอดมิน login และแก้ไขช่องบนกระดาน
2. **Socket.IO** — เกม real-time ที่ server เป็นผู้คำนวณตำแหน่งผู้เล่นทั้งหมด
   (client ห้ามกำหนดปลายทางเอง) ทั้งสองส่วนอ่านข้อมูลช่องจากไฟล์เดียวกัน
   ดังนั้นแอดมินแก้ชื่อ/รูป/ราคาช่องแล้ว มีผลกับเกมที่กำลังเล่นอยู่ทันที

## วิธีรัน

```bash
npm install
node server.js
```

จากนั้นเปิดเบราว์เซอร์ไปที่:

- หน้าแอดมิน (แก้ไขช่อง): **http://localhost:4000/admin.html**
- หน้าเล่นเกมจริง (real-time): **http://localhost:4000/play.html**
  — เปิดหลายแท็บ/เครื่องพร้อมกันเพื่อจำลองผู้เล่นหลายคนบนโต๊ะเดียวกัน
- Health check: http://localhost:4000/api/health

## บัญชีแอดมิน

```
username: admin1234
password: piyawat12win
```

## Board ปัจจุบัน: 20 อำเภอของจังหวัดร้อยเอ็ด

ช่องบนกระดาน (`board_id: "default"`) ถูกตั้งค่าให้เป็น 20 อำเภอของจังหวัดร้อยเอ็ด
พร้อมแหล่งท่องเที่ยวเด่นของแต่ละอำเภอ (เก็บไว้ในฟิลด์ `description`) เช่น
"อำเภอเมืองร้อยเอ็ด" → บึงพลาญชัย, วัดบูรพาภิราม, หอโหวด 101 และอีก 19 อำเภอ

ตำแหน่งที่เหลืออีก 4 ช่อง (มุมและจุดกลางเส้นทาง) ยังคงเป็นกลไกเกม (START / TAX /
BANK / EVENT) เพื่อให้เกมยังมีความหลากหลาย ไม่ใช่แค่เดินผ่านอำเภอเฉยๆ

**รูปภาพยังว่างอยู่ทุกช่อง** — เข้า `/admin.html` แล้วคลิกแต่ละช่องเพื่อใส่รูปสถานที่
ท่องเที่ยวของอำเภอนั้นๆ ได้เลย

> **ก่อนใช้งานจริงต้องเปลี่ยนรหัสผ่าน** และตั้งค่า `JWT_SECRET` เป็น environment
> variable ของตัวเอง (`export JWT_SECRET=...`) ห้ามใช้ค่า default ใน production

## สิ่งที่ทำได้

- ล็อกอินแอดมินด้วย JWT (หมดอายุใน 8 ชั่วโมง, เก็บ token ไว้ที่ `sessionStorage`)
- ดูกระดาน 7×7 ทั้ง 24 ช่อง (public, ไม่ต้องล็อกอินก็ดูได้ — ไว้ต่อกับหน้าเล่นเกมจริงได้)
- คลิกที่ช่องใดก็ได้ → เปิดหน้าต่างแก้ไข **เฉพาะตอนล็อกอินแล้วเท่านั้น**
  (endpoint `GET /api/cells/:id` และ `PUT /api/cells/:id` ต้องมี token)
- แก้ไขได้: ชื่อช่อง, ประเภทช่อง, รูปภาพ (URL), คำอธิบาย, ราคา, ค่าเช่า
- บันทึกแล้วอัปเดตกระดานทันที

## โครงสร้างไฟล์

```
board-admin/
  server.js              จุดเริ่มต้นของ server (Express + Socket.IO บน http server เดียวกัน)
  src/
    store.js             อ่าน/เขียนข้อมูล (data/db.json)
    auth.js               hash password, sign/verify JWT, middleware requireAuth
    authRoutes.js         POST /api/auth/login, GET /api/auth/me
    cellRoutes.js         GET/PUT ช่องบอร์ด, GET ประเภทช่อง
    game.js               game engine ฝั่ง server: session, ผู้เล่น, ทอยเต๋า,
                           เดินทีละช่อง, resolve effect ตามประเภทช่อง — ทั้งหมด
                           คำนวณที่ server เท่านั้น
  data/db.json            "ฐานข้อมูล" แบบไฟล์ JSON (admin + 24 cells)
  public/
    admin.html            หน้าแอดมิน (login + กระดาน + modal แก้ไข)
    play.html              หน้าเล่นเกมจริงแบบ real-time ผ่าน Socket.IO
```

## Socket.IO events (play.html)

Client → Server:
- `join` `{ sessionId, playerName }` — เข้าร่วมโต๊ะ
- `roll_dice` — ทอยลูกเต๋า (server เช็คว่าเป็นตาของ socket นั้นจริงก่อนเสมอ)

Server → Client:
- `state_update` — สถานะทั้งโต๊ะ (ผู้เล่น, ตำแหน่ง, เงิน, ใครตา)
- `player_moving` — ตำแหน่งใหม่ระหว่างเดินทีละช่อง (ใช้ทำ animation)
- `dice_result` — ผลลูกเต๋า
- `gm_log` — ข้อความบรรยายจาก Game Master
- `error_msg` — เช่น ทอยนอกตา, โต๊ะกำลังประมวลผลตาอื่นอยู่

## หมายเหตุเรื่อง Database

ตอนนี้ใช้ไฟล์ `data/db.json` แทนฐานข้อมูลจริง เพื่อให้รันทดสอบได้ทันทีโดยไม่ต้อง
ติดตั้ง PostgreSQL/MariaDB โครงสร้างฟิลด์ของ cell (`board_id`, `position`, `row`,
`column`, `type`, `name`, `image_url`, `price`, `rent_base`, ...) ตรงกับตาราง
`cells` ใน `board_game_schema.sql` ที่ออกแบบไว้ก่อนหน้านี้ ดังนั้นเมื่อพร้อมต่อกับ
ฐานข้อมูลจริง แค่เขียน `src/store.js` ใหม่ให้ query ผ่าน `pg`/`mysql2` แทนการ
อ่านไฟล์ JSON — ส่วน routes และหน้าแอดมินไม่ต้องแก้อะไร

## ขั้นต่อไปที่แนะนำ

- เพิ่ม endpoint สำหรับ upload ไฟล์รูปจริง (ตอนนี้รับเป็น URL เท่านั้น)
- เพิ่ม `role` หลายระดับ (super admin / editor) ถ้าต้องมีแอดมินหลายคน
- ต่อกับ Socket.IO เพื่อให้หน้าผู้เล่นเห็นการเปลี่ยนแปลงช่องแบบ real-time
- เปลี่ยนจาก JSON store เป็น PostgreSQL ตาม schema เดิมเมื่อพร้อม deploy จริง


## V1.1 — Bug fixes
- แก้ข้อมูลบัญชี Admin ใน README ให้ตรงกับฐานข้อมูลและ `set-admin.js`
- แก้การข้ามเทิร์นซ้ำหลังผู้เล่นล้มละลาย
- คลิก/แตะพื้นที่ช่องทั้งช่องเพื่อเปิด Popup ได้ ไม่จำเป็นต้องกดปุ่มรายละเอียด
- รองรับ `effect_value = 0` สำหรับ EVENT อย่างถูกต้อง
- Popup มี fallback เมื่อรูปหาย/โหลดไม่ได้ และใช้ข้อมูลจาก API ล่าสุด
- ปรับการจัดการผู้เล่นที่ Disconnect ให้ข้ามเฉพาะผู้เล่นที่ออนไลน์และยังไม่ล้มละลาย
- โบนัส START ทำงานเมื่อเดินผ่าน START ทั้งขาเดินหน้าและถอยหลัง
