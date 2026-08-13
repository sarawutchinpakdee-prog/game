# Admin ↔ Tourism Popup

- หน้า Admin แก้ `attractions` ได้ โดยใส่ 1 สถานที่ต่อ 1 บรรทัด
- กดบันทึกแล้วข้อมูลถูกเขียนลง `data/db.json` ผ่าน `PUT /api/cells/:id`
- หน้าเกมใช้ `GET /api/board/default/cells` แบบ `cache: no-store` ทุกครั้งที่เปิด Popup
- Popup จึงใช้ชื่ออำเภอ คำอธิบาย รูปภาพ ราคา ค่าเช่า และรายการสถานที่ล่าสุดจากฐานข้อมูลเดียวกับ Admin
- ไม่มีรายชื่อสถานที่แบบ hard-code ใน `play.html` อีกต่อไป
