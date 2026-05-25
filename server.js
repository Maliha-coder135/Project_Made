/**
 * Real-Time Chat Server
 * Course: Parallel & Distributed Computing — Project 6B
 * Stack: Node.js + Express + Socket.IO + Redis Cluster
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  PORT: process.env.PORT || 3000,
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT) || 6379,
  USE_CLUSTER: process.env.USE_CLUSTER === 'true',
  MAX_HISTORY: 50,
  ROOMS: ['general', 'tech', 'random', 'distributed-systems'],
};

// ─── REDIS SETUP ─────────────────────────────────────────────────────────────
async function createRedisClients() {
  if (CONFIG.USE_CLUSTER) {
    // Redis Cluster mode — multiple nodes
    const clusterNodes = [
      { host: process.env.REDIS_NODE1_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_NODE1_PORT) || 7001 },
      { host: process.env.REDIS_NODE2_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_NODE2_PORT) || 7002 },
      { host: process.env.REDIS_NODE3_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_NODE3_PORT) || 7003 },
    ];

    console.log('🔴 Connecting to Redis Cluster:', clusterNodes);

    const pubClient = createClient({
      cluster: { rootNodes: clusterNodes.map(n => ({ url: `redis://${n.host}:${n.port}` })) }
    });
    const subClient = pubClient.duplicate();
    return { pubClient, subClient };

  } else {
    // Single Redis instance (development/testing)
    console.log(`🔴 Connecting to Redis standalone: ${CONFIG.REDIS_HOST}:${CONFIG.REDIS_PORT}`);
    const pubClient = createClient({ socket: { host: CONFIG.REDIS_HOST, port: CONFIG.REDIS_PORT } });
    const subClient = pubClient.duplicate();
    return { pubClient, subClient };
  }
}

// ─── IN-MEMORY FALLBACK (if Redis unavailable) ────────────────────────────────
const inMemoryStore = {
  messages: {},       // room → [messages]
  users: {},          // socketId → userInfo
  userRooms: {},      // socketId → Set<room>
};

// ─── SOCKET.IO SETUP ─────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── METRICS ─────────────────────────────────────────────────────────────────
const metrics = {
  totalMessages: 0,
  totalConnections: 0,
  activeConnections: 0,
  startTime: Date.now(),
  messageRates: [],  // last 60 seconds
};

function recordMessage() {
  metrics.totalMessages++;
  const now = Date.now();
  metrics.messageRates.push(now);
  // Keep only last 60 seconds
  metrics.messageRates = metrics.messageRates.filter(t => now - t < 60000);
}

// ─── HELPER: REDIS KEY BUILDERS ───────────────────────────────────────────────
const KEYS = {
  roomMessages: (room) => `chat:room:${room}:messages`,
  roomUsers: (room) => `chat:room:${room}:users`,
  userInfo: (socketId) => `chat:user:${socketId}`,
  globalStats: () => 'chat:stats:global',
};

// ─── MAIN BOOT ────────────────────────────────────────────────────────────────
async function boot() {
  let redisAvailable = false;
  let pubClient, subClient;

  try {
    ({ pubClient, subClient } = await createRedisClients());
    
    pubClient.on('error', (err) => console.error('Redis pub error:', err.message));
    subClient.on('error', (err) => console.error('Redis sub error:', err.message));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    
    // Attach Redis adapter — enables multi-server scaling
    io.adapter(createAdapter(pubClient, subClient));
    redisAvailable = true;
    console.log('✅ Redis adapter attached — multi-node scaling active');

    // Initialize room message history
    for (const room of CONFIG.ROOMS) {
      const exists = await pubClient.exists(KEYS.roomMessages(room));
      if (!exists) await pubClient.del(KEYS.roomMessages(room)); // reset on fresh start
    }

  } catch (err) {
    console.warn('⚠️  Redis unavailable, falling back to in-memory store:', err.message);
    console.warn('   Messages will NOT persist across restarts and scaling is disabled.');
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────
  async function saveMessage(room, message) {
    if (redisAvailable) {
      const key = KEYS.roomMessages(room);
      await pubClient.rPush(key, JSON.stringify(message));
      // Keep only last MAX_HISTORY messages
      const len = await pubClient.lLen(key);
      if (len > CONFIG.MAX_HISTORY) await pubClient.lTrim(key, len - CONFIG.MAX_HISTORY, -1);
    } else {
      if (!inMemoryStore.messages[room]) inMemoryStore.messages[room] = [];
      inMemoryStore.messages[room].push(message);
      if (inMemoryStore.messages[room].length > CONFIG.MAX_HISTORY)
        inMemoryStore.messages[room].shift();
    }
  }

  async function getRoomHistory(room) {
    if (redisAvailable) {
      const raw = await pubClient.lRange(KEYS.roomMessages(room), 0, -1);
      return raw.map(m => JSON.parse(m));
    }
    return inMemoryStore.messages[room] || [];
  }

  async function getRoomUserCount(room) {
    const sockets = await io.in(room).fetchSockets();
    return sockets.length;
  }

  async function updateGlobalStats() {
    if (!redisAvailable) return;
    await pubClient.hSet(KEYS.globalStats(), {
      totalMessages: metrics.totalMessages,
      activeConnections: metrics.activeConnections,
      uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
      node: `node-${process.pid}`,
    });
  }

  // ── SOCKET EVENTS ──────────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    metrics.totalConnections++;
    metrics.activeConnections++;
    console.log(`🔌 Connected: ${socket.id} | Active: ${metrics.activeConnections}`);

    // ── JOIN ──────────────────────────────────────────────────────────────
    socket.on('join', async ({ username, room }) => {
      if (!username || !room) return;

      username = username.trim().substring(0, 30);
      room = CONFIG.ROOMS.includes(room) ? room : 'general';

      const userInfo = {
        id: socket.id,
        username,
        room,
        joinedAt: Date.now(),
        color: `hsl(${Math.floor(Math.random() * 360)}, 65%, 60%)`,
      };

      inMemoryStore.users[socket.id] = userInfo;
      if (!inMemoryStore.userRooms[socket.id]) inMemoryStore.userRooms[socket.id] = new Set();
      inMemoryStore.userRooms[socket.id].add(room);

      await socket.join(room);

      // Send history
      const history = await getRoomHistory(room);
      socket.emit('history', { room, messages: history });

      // Notify room
      const systemMsg = {
        id: uuidv4(),
        type: 'system',
        content: `${username} joined the room`,
        room,
        timestamp: Date.now(),
      };
      await saveMessage(room, systemMsg);
      io.to(room).emit('message', systemMsg);

      // Send user their info
      socket.emit('user_info', userInfo);

      // Update room roster
      const userCount = await getRoomUserCount(room);
      io.to(room).emit('room_update', { room, userCount });

      await updateGlobalStats();
      console.log(`👤 ${username} joined #${room}`);
    });

    // ── SEND MESSAGE ──────────────────────────────────────────────────────
    socket.on('send_message', async ({ content, room }) => {
      const userInfo = inMemoryStore.users[socket.id];
      if (!userInfo || !content?.trim()) return;

      content = content.trim().substring(0, 1000);
      recordMessage();

      const message = {
        id: uuidv4(),
        type: 'chat',
        content,
        username: userInfo.username,
        color: userInfo.color,
        room,
        timestamp: Date.now(),
        serverId: process.pid, // shows which server handled this (for scaling demo)
      };

      await saveMessage(room, message);
      io.to(room).emit('message', message);      // broadcast via Redis adapter
      await updateGlobalStats();
    });

    // ── TYPING ────────────────────────────────────────────────────────────
    socket.on('typing', ({ room, isTyping }) => {
      const userInfo = inMemoryStore.users[socket.id];
      if (!userInfo) return;
      socket.to(room).emit('typing_update', { username: userInfo.username, isTyping });
    });

    // ── SWITCH ROOM ───────────────────────────────────────────────────────
    socket.on('switch_room', async ({ oldRoom, newRoom }) => {
      const userInfo = inMemoryStore.users[socket.id];
      if (!userInfo) return;

      await socket.leave(oldRoom);
      inMemoryStore.userRooms[socket.id]?.delete(oldRoom);

      const leaveMsg = {
        id: uuidv4(), type: 'system',
        content: `${userInfo.username} left the room`,
        room: oldRoom, timestamp: Date.now(),
      };
      await saveMessage(oldRoom, leaveMsg);
      io.to(oldRoom).emit('message', leaveMsg);
      io.to(oldRoom).emit('room_update', { room: oldRoom, userCount: await getRoomUserCount(oldRoom) });

      userInfo.room = newRoom;
      await socket.join(newRoom);
      inMemoryStore.userRooms[socket.id]?.add(newRoom);

      const history = await getRoomHistory(newRoom);
      socket.emit('history', { room: newRoom, messages: history });

      const joinMsg = {
        id: uuidv4(), type: 'system',
        content: `${userInfo.username} joined the room`,
        room: newRoom, timestamp: Date.now(),
      };
      await saveMessage(newRoom, joinMsg);
      io.to(newRoom).emit('message', joinMsg);
      io.to(newRoom).emit('room_update', { room: newRoom, userCount: await getRoomUserCount(newRoom) });
    });

    // ── STATS REQUEST ─────────────────────────────────────────────────────
    socket.on('get_stats', async () => {
      const stats = {
        totalMessages: metrics.totalMessages,
        activeConnections: metrics.activeConnections,
        totalConnections: metrics.totalConnections,
        messagesPerMinute: metrics.messageRates.length,
        uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
        redisAvailable,
        clusterMode: CONFIG.USE_CLUSTER,
        serverId: process.pid,
        rooms: {},
      };
      for (const room of CONFIG.ROOMS) {
        stats.rooms[room] = await getRoomUserCount(room);
      }
      socket.emit('stats', stats);
    });

    // ── DISCONNECT ────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      metrics.activeConnections--;
      const userInfo = inMemoryStore.users[socket.id];

      if (userInfo) {
        const rooms = inMemoryStore.userRooms[socket.id] || new Set();
        for (const room of rooms) {
          const leaveMsg = {
            id: uuidv4(), type: 'system',
            content: `${userInfo.username} left the room`,
            room, timestamp: Date.now(),
          };
          await saveMessage(room, leaveMsg);
          io.to(room).emit('message', leaveMsg);
          io.to(room).emit('room_update', { room, userCount: await getRoomUserCount(room) });
        }
        delete inMemoryStore.users[socket.id];
        delete inMemoryStore.userRooms[socket.id];
      }

      await updateGlobalStats();
      console.log(`🔌 Disconnected: ${socket.id} | Active: ${metrics.activeConnections}`);
    });
  });

  // ── REST ENDPOINTS ─────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../client')));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      redisAvailable,
      clusterMode: CONFIG.USE_CLUSTER,
      pid: process.pid,
      uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
      activeConnections: metrics.activeConnections,
    });
  });

  app.get('/api/rooms', (req, res) => {
    res.json({ rooms: CONFIG.ROOMS });
  });

  app.get('/api/stats', async (req, res) => {
    const stats = {
      totalMessages: metrics.totalMessages,
      activeConnections: metrics.activeConnections,
      messagesPerMinute: metrics.messageRates.length,
      uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
      redisAvailable,
      pid: process.pid,
    };
    if (redisAvailable) {
      const globalStats = await pubClient.hGetAll(KEYS.globalStats());
      stats.redis = globalStats;
    }
    res.json(stats);
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });

  // ── START ──────────────────────────────────────────────────────────────────
  server.listen(CONFIG.PORT, () => {
    console.log(`\n🚀 Chat server running on http://localhost:${CONFIG.PORT}`);
    console.log(`   PID: ${process.pid}`);
    console.log(`   Redis: ${redisAvailable ? (CONFIG.USE_CLUSTER ? 'Cluster' : 'Standalone') : 'In-Memory Fallback'}`);
    console.log(`   Rooms: ${CONFIG.ROOMS.join(', ')}\n`);
  });
}

boot().catch(err => {
  console.error('❌ Boot failed:', err);
  process.exit(1);
});
