// server.js
const { createServer } = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);

// CORS 設定：クライアントが動いているオリジンを必ず許可してください
const io = new Server(httpServer, {
  cors: {
    origin: ['http://192.000.0.0:3000', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'],      // 必要に応じて
  allowUpgrades: true,            // HTTP→WebSocket の自動アップグレードを許可
});

io.on('connection', (socket) => {
  console.log('[Server] client connected:', socket.id);

  // クライアントから "canvas:sync" というイベントを受け取ったら
  socket.on('canvas:sync-chunk', (imageStates) => {
    console.log('[Server] received canvas:sync-chunk from', socket.id, imageStates);
    // 自分以外の全クライアントへブロードキャスト
    socket.broadcast.emit('canvas:sync-chunk', imageStates);
  });

  // 画像一覧の即時同期用イベント受け取り＆ブロードキャスト
  socket.on('list:sync-chunk', (imageList) => {
    console.log('[Server] received list:sync-chunk from', socket.id, imageList);
    socket.broadcast.emit('list:sync-chunk', imageList);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Server] client disconnected:', socket.id, 'reason =', reason);
  });
});

// 必ずサーバーを起動する
const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on http://192.000.0.0:${PORT}`);
});
