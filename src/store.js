const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function getAdminByUsername(username) {
  const db = readDB();
  return db.admins.find(a => a.username === username) || null;
}

function getCellTypes() {
  const db = readDB();
  return db.cellTypes;
}

function getCells(boardId) {
  const db = readDB();
  return db.cells.filter(c => c.board_id === boardId);
}

function getCellById(id) {
  const db = readDB();
  return db.cells.find(c => c.id === id) || null;
}

// เฉพาะฟิลด์ที่แอดมินแก้ไขได้ — กันไม่ให้ patch เผลอทับ id/board_id/position
const EDITABLE_FIELDS = [
  'name', 'type', 'image_url', 'model_3d_url', 'description',
  'price', 'rent_base', 'effect_value', 'effect_steps', 'attractions',
  'phone', 'facebook', 'line_id', 'website'
];

function updateCell(id, patch) {
  const db = readDB();
  const idx = db.cells.findIndex(c => c.id === id);
  if (idx === -1) return null;

  const cell = db.cells[idx];
  for (const key of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      cell[key] = patch[key];
    }
  }
  cell.updated_at = new Date().toISOString();
  db.cells[idx] = cell;
  writeDB(db);
  return cell;
}

module.exports = {
  readDB, writeDB, getAdminByUsername, getCellTypes,
  getCells, getCellById, updateCell, EDITABLE_FIELDS,
};
