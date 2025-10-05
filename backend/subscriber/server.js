const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const sub = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

sub.psubscribe('clima:*', (err, count) => {
  if (err) {
    console.error('Error suscribiéndose a Redis:', err);
    process.exit(1);
  }
  console.log(`Suscrito a ${count} patrones. Escuchando 'clima:*'...`);
});

sub.on('pmessage', (pattern, channel, message) => {
  try {
    const data = JSON.parse(message);
    // include channel so frontend knows source
    const payload = { channel, data };
    io.emit('sensor-data', payload);
    console.log(`Reenviando desde ${channel}:`, data);
  } catch (e) {
    console.warn('Mensaje no JSON recibido en', channel, message);
  }
});

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor web iniciado en http://localhost:${PORT}`);
});
