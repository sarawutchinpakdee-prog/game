const express = require('express');
const { getAdminByUsername } = require('./store');
const { verifyPassword, signToken, requireAuth } = require('./auth');

const router = express.Router();

// POST /api/auth/login  { username, password } -> { token, username }
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  }

  const admin = getAdminByUsername(username);
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  const token = signToken(admin);
  res.json({ token, username: admin.username });
});

// GET /api/auth/me -> ตรวจสอบว่า token ยังใช้ได้อยู่ไหม
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.admin.sub, role: req.admin.role });
});

module.exports = router;
