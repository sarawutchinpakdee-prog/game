แก้ JavaScript tourismPhotoCard ที่มีการ escape quote ผิดใน V2.6 โดยเปลี่ยนเป็นการสร้าง DOM nodes ด้วย textContent/append เพื่อป้องกัน SyntaxError และปัญหา quote injection.
