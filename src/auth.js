const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ใน production ควรเซ็ตผ่าน environment variable เท่านั้น
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me_in_production';
const TOKEN_TTL = '8h';

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function signToken(admin) {
  return jwt.sign(
    { sub: admin.username, role: 'admin' },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'ต้องเข้าสู่ระบบก่อนใช้งานส่วนนี้' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

module.exports = { hashPassword, verifyPassword, signToken, requireAuth };
