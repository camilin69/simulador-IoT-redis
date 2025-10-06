const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const PORT = process.env.PORT || 3000;  // ✅ Puerto correcto: 3000

console.log(`🔧 Configuración Redis: ${REDIS_HOST}:${REDIS_PORT}`);
console.log(`🔧 Puerto del servidor: ${PORT}`);

const app = express();
const server = http.createServer(app);

// Configuración de Socket.IO con CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware para CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'web-subscriber',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Endpoint raíz
app.get('/', (req, res) => {
  res.json({ 
    message: 'Servidor IoT Web Subscriber',
    port: PORT,
    endpoints: {
      health: '/health',
      historicalData: '/api/historical-data'
    }
  });
});

// Cliente Redis
const redisConfig = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  retryDelay: 1000
};

const sub = new Redis(redisConfig);
const redisClient = new Redis(redisConfig);

// Manejo de errores de Redis
redisClient.on('error', (err) => {
  console.error('❌ Error de Redis Client:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Conectado a Redis como cliente');
});

sub.on('error', (err) => {
  console.error('❌ Error de Redis Subscriber:', err);
});

sub.on('connect', () => {
  console.log('✅ Conectado a Redis como subscriber');
});

// Endpoint para obtener datos históricos
app.get('/api/historical-data', async (req, res) => {
  try {
    console.log('📊 Solicitando datos históricos de Redis...');
    
    const keys = await redisClient.keys('sensor:*:history');
    const historicalData = {};
    
    for (const key of keys) {
      const sensorName = key.split(':')[1];
      
      // ✅ CAMBIO: Obtener los últimos 100 puntos históricos (en lugar de 20)
      const data = await redisClient.lrange(key, 0, 99);
      
      historicalData[sensorName] = data.map(item => {
        try {
          return JSON.parse(item);
        } catch (e) {
          console.error('Error parseando dato:', item);
          return null;
        }
      }).filter(item => item !== null);
    }
    
    console.log(`✅ Datos históricos recuperados para ${Object.keys(historicalData).length} sensores`);
    res.json(historicalData);
    
  } catch (error) {
    console.error('❌ Error obteniendo datos históricos:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// Suscribirse a Redis
sub.psubscribe('clima:*', (err, count) => {
  if (err) {
    console.error('Error suscribiéndose a Redis:', err);
    process.exit(1);
  }
  console.log(`✅ Suscrito a ${count} patrones. Escuchando 'clima:*'...`);
});

sub.on('pmessage', async (pattern, channel, message) => {
  try {
    const data = JSON.parse(message);
    
    // Guardar en Redis para histórico
    const sensorName = channel.split(':')[2];
    const historyKey = `sensor:${sensorName}:history`;
    
    // Guardar el nuevo dato en la lista histórica
    await redisClient.lpush(historyKey, JSON.stringify(data));
    
    // ✅ CAMBIO: Mantener los últimos 100 puntos por sensor (en lugar de 20)
    await redisClient.ltrim(historyKey, 0, 99);
    
    const payload = { channel, data };
    io.emit('sensor-data', payload);
    console.log(`📊 Reenviando desde ${channel}:`, data);
    
  } catch (e) {
    console.warn('❌ Mensaje no JSON recibido en', channel, message);
  }
});

// Configuración de Socket.IO
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);
  
  socket.on('disconnect', (reason) => {
    console.log('🔌 Cliente desconectado:', socket.id, 'Razón:', reason);
  });
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor web iniciado en http://0.0.0.0:${PORT}`);
  console.log(`📊 Endpoint histórico: http://0.0.0.0:${PORT}/api/historical-data`);
  console.log(`❤️  Health check: http://0.0.0.0:${PORT}/health`);
});

// Manejar cierre graceful
process.on('SIGTERM', async () => {
  console.log('🛑 Recibido SIGTERM, cerrando servidor...');
  await redisClient.quit();
  await sub.quit();
  server.close(() => {
    console.log('✅ Servidor cerrado');
    process.exit(0);
  });
});