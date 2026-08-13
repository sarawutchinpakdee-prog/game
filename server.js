const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./src/authRoutes');
const cellRoutes = require('./src/cellRoutes');
const game = require('./src/game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } }); // dev only — จำกัด origin ตอน deploy จริง

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api', cellRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true }));

/* ============================================================
   SOCKET.IO — เลเยอร์เกม real-time (คนละส่วนกับ REST admin API
   แต่ใช้ store.js/cells ชุดเดียวกัน — แอดมินแก้ช่องแล้วมีผลกับ
   เกมที่กำลังเล่นอยู่ทันที เพราะอ่านจากไฟล์เดียวกันทุกครั้ง)
   ============================================================ */
function chooseAiAnswer(q, player) {
  if (!q || !Array.isArray(q.choices) || !q.choices.length) return 0;
  // บุคลิก AI จากเวอร์ชันก่อนหน้า: นักวางแผนแม่นที่สุด
  const name = String(player?.name || '').toLowerCase();
  let accuracy = 0.8;
  if (name.includes('วางแผน') || name.includes('planner')) accuracy = 0.92;
  else if (name.includes('เสี่ยง') || name.includes('risk')) accuracy = 0.68;
  else if (name.includes('ธุรกิจ') || name.includes('business')) accuracy = 0.82;
  else if (name.includes('ฉวย') || name.includes('opportun')) accuracy = 0.86;
  if (Math.random() < accuracy) return Number(q.answer) || 0;
  let wrong = Math.floor(Math.random() * q.choices.length);
  if (wrong === Number(q.answer) && q.choices.length > 1) wrong = (wrong + 1) % q.choices.length;
  return wrong;
}

function scheduleAiTurn(session, delay = 900) {
  if (!session || session.aiRunning || session.gameOver || !game.botShouldPlay(session)) return;
  session.aiRunning = true;
  setTimeout(async () => {
    try {
      const player = game.currentPlayer(session);
      if (!player || !player.isBot || session.gameOver) return;
      await new Promise(r => setTimeout(r, 350));
      if (session.pendingQuestion?.playerKey === player.playerKey && !session.gameOver) {
        const q = session.pendingQuestion;
        const answer = chooseAiAnswer(q, player);
        game.answerQuestion(io, session, player.socketId, answer);
      } else {
        const result = await game.handleRollDice(io, session, player.socketId);
        if (result?.error) {
          if (session.pendingPurchase?.playerKey === player.playerKey) {
            game.skipPropertyPurchase(io, session, player.socketId);
          }
        }

        // การ์ดคำถามอาจถูกสร้างขึ้นระหว่าง handleRollDice() หลังจาก AI เดินตก EVENT
        // ต้องตอบทันทีในรอบเดียวกัน ไม่ปล่อยให้เทิร์นค้างรอผู้เล่นจริง
        if (session.pendingQuestion?.playerKey === player.playerKey && !session.gameOver) {
          const q2 = session.pendingQuestion;
          const answer2 = chooseAiAnswer(q2, player);
          const answerResult = game.answerQuestion(io, session, player.socketId, answer2);
          if (answerResult?.error) {
            console.warn('AI quiz answer failed:', answerResult.error);
            // กันเทิร์นค้างจากข้อผิดพลาดของ AI: ข้ามการ์ดและไปเทิร์นถัดไป
            if (session.pendingQuestion?.playerKey === player.playerKey) {
              session.pendingQuestion = null;
              if (!session.gameOver && game.currentPlayer(session)?.playerKey === player.playerKey) {
                game.advanceTurn(session);
              }
            }
          }
        }
      }
      // ถ้าตก PROPERTY จะค้าง pendingPurchase; ให้ AI ตัดสินใจซื้อ/ไม่ซื้อ
      if (session.pendingPurchase?.playerKey === player.playerKey && !session.gameOver) {
        if (game.chooseBotPurchase(session, player)) {
          game.buyProperty(io, session, player.socketId);
        } else {
          game.skipPropertyPurchase(io, session, player.socketId);
        }
      }
      io.to(session.id).emit('state_update', game.publicState(session));
    } catch (err) {
      console.error('AI turn error:', err);
    } finally {
      session.aiRunning = false;
      if (!session.gameOver && game.botShouldPlay(session)) scheduleAiTurn(session, 800);
    }
  }, delay);
}

function normalizeRoomId(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);
}

function makeRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  do {
    id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  } while (game.getSession(id));
  return id;
}

function joinSession(socket, { sessionId, playerName, playerToken, mode, aiCount }) {
  const sid = normalizeRoomId(sessionId);
  if (!sid) return socket.emit('error_msg', 'กรุณาระบุรหัสห้อง');

  let session = game.getSession(sid);
  if (!session && mode === 'ai') session = game.createSession(sid);
  if (!session) return socket.emit('error_msg', `ไม่พบห้อง ${sid} กรุณาตรวจสอบรหัสห้อง`);
  if (session.mode === 'ai' && mode !== 'ai') return socket.emit('error_msg', 'ห้องนี้เป็นห้อง AI ไม่สามารถเข้าร่วมแบบผู้เล่นได้');
  if (session.mode === 'human' && mode === 'ai') return socket.emit('error_msg', 'ห้องนี้เป็นห้องผู้เล่น ไม่สามารถเปลี่ยนเป็นห้อง AI ได้');
  if (session.gameOver) return socket.emit('error_msg', 'ห้องนี้จบเกมแล้ว กรุณาสร้างห้องใหม่');

  socket.join(sid);
  socket.data.sessionId = sid;
  session.mode = mode === 'ai' ? 'ai' : 'human';

  const playerKey = typeof playerToken === 'string' && playerToken.trim() ? playerToken.trim() : `player-${socket.id}`;
  const player = game.addPlayer(session, socket.id, playerName, playerKey);

  if (session.mode === 'ai' && session.aiCount === 0) {
    const count = Math.max(1, Math.min(3, Number(aiCount) || 3));
    for (let i = 1; i <= count; i++) game.addBot(session, `AI ${i}`);
    game.addLog(session, `${player.name} สร้างโต๊ะเล่นกับ AI ${count} คน`);
  } else {
    game.addLog(session, `${player.name} เข้าร่วมโต๊ะ`);
  }

  io.to(sid).emit('room_info', { roomId: sid, playerCount: session.players.length, mode: session.mode });
  io.to(sid).emit('state_update', game.publicState(session));
  io.to(sid).emit('gm_log', session.logs[0]);
  scheduleAiTurn(session, 1200);
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ playerName, playerToken }) => {
    const sid = makeRoomId();
    const session = game.createSession(sid);
    session.mode = 'human';
    socket.emit('room_created', { roomId: sid });
    joinSession(socket, { sessionId: sid, playerName, playerToken, mode: 'human' });
  });

  socket.on('join', (payload = {}) => joinSession(socket, payload));

  socket.on('buy_property', () => {
    const sid = socket.data.sessionId;
    if (!sid) return socket.emit('error_msg', 'กรุณาเข้าร่วมเกมก่อน');
    const session = game.getOrCreateSession(sid);
    const result = game.buyProperty(io, session, socket.id);
    if (result.error) socket.emit('error_msg', result.error);
    scheduleAiTurn(session, 700);
  });

  socket.on('sell_property', ({ cellId }) => {
    const sid = socket.data.sessionId;
    if (!sid) return socket.emit('error_msg', 'กรุณาเข้าร่วมเกมก่อน');
    const session = game.getOrCreateSession(sid);
    const result = game.sellProperty(io, session, socket.id, cellId);
    if (result.error) socket.emit('error_msg', result.error);
  });

  socket.on('upgrade_property', ({ cellId }) => {
    const sid = socket.data.sessionId;
    if (!sid) return socket.emit('error_msg', 'กรุณาเข้าร่วมเกมก่อน');
    const session = game.getOrCreateSession(sid);
    const result = game.upgradeProperty(io, session, socket.id, cellId);
    if (result.error) socket.emit('error_msg', result.error);
  });

  socket.on('transfer_property', ({ cellId, targetPlayerId }) => {
    const sid = socket.data.sessionId;
    if (!sid) return socket.emit('error_msg', 'กรุณาเข้าร่วมเกมก่อน');
    const session = game.getOrCreateSession(sid);
    const result = game.transferProperty(io, session, socket.id, cellId, targetPlayerId);
    if (result.error) socket.emit('error_msg', result.error);
  });

  socket.on('skip_property', () => {
    const sid = socket.data.sessionId;
    if (!sid) return socket.emit('error_msg', 'กรุณาเข้าร่วมเกมก่อน');
    const session = game.getOrCreateSession(sid);
    const result = game.skipPropertyPurchase(io, session, socket.id);
    if (result.error) socket.emit('error_msg', result.error);
    scheduleAiTurn(session, 700);
  });

  socket.on('roll_dice', async () => {
    const sid = socket.data.sessionId;
    if (!sid) return socket.emit('error_msg', 'กรุณา join ก่อนทอยลูกเต๋า');
    const session = game.getOrCreateSession(sid);
    const result = await game.handleRollDice(io, session, socket.id);
    if (result.error) socket.emit('error_msg', result.error);
    scheduleAiTurn(session, 700);
  });

  socket.on('answer_quiz', ({ choiceIndex }) => {
    const sid = socket.data.sessionId;
    if (!sid) return socket.emit('error_msg', 'กรุณาเข้าร่วมเกมก่อน');
    const session = game.getOrCreateSession(sid);
    const result = game.answerQuestion(io, session, socket.id, choiceIndex);
    if (result.error) socket.emit('error_msg', result.error);
    scheduleAiTurn(session, 700);
  });

  socket.on('disconnect', () => {
    const sid = socket.data.sessionId;
    if (!sid) return;
    const session = game.getOrCreateSession(sid);
    game.removePlayerBySocket(session, socket.id);
    io.to(sid).emit('state_update', game.publicState(session));
  });
});

server.listen(PORT, () => {
  console.log(`Board API + Realtime running: http://localhost:${PORT}`);
  console.log(`Admin panel:                  http://localhost:${PORT}/admin.html`);
  console.log(`Play (real-time game):        http://localhost:${PORT}/play.html`);
});
