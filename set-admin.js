// เปลี่ยนบัญชีแอดมินเป็น username: admin1234 / password: piyawat12win
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = './data/db.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

db.admins = [
  { username: 'admin1234', password_hash: bcrypt.hashSync('piyawat12win', 10) }
];

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('อัปเดตบัญชีแอดมินแล้ว ->', db.admins[0].username);
