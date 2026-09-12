import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';

import { initializeRoomHandlers } from './roomManager.js';
import { initializeMediasoupHandlers } from './mediasoupManager.js';
import { initializeWorkerPool, closeAllWorkers } from './mediasoup.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://192.168.0.113:5173'];

app.use(cors({ origin: corsOrigin, credentials: true }));

const io = new SocketIOServer(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
  // Compress messages for low-bandwidth clients (chat, signaling).
  perMessageDeflate: {
    threshold: 1024, // only compress payloads >= 1 KB
  },
  // Bigger buffer for the occasional large SDP / RTP-params payload.
  maxHttpBufferSize: 2_000_000,
});

// --- Optional Redis adapter ----------------------------------------------
// If REDIS_URL is set we wire @socket.io/redis-adapter so multiple backend
// instances can broadcast to each other. Loaded lazily so the dependency
// is only required when actually enabled.
if (process.env.REDIS_URL) {
  try {
    const { createAdapter } = await import('@socket.io/redis-adapter');
    const { createClient } = await import('redis');
    const pub = createClient({ url: process.env.REDIS_URL });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    io.adapter(createAdapter(pub, sub));
    console.log('[socket.io] Redis adapter enabled');
  } catch (err) {
    console.warn('[socket.io] Failed to enable Redis adapter:', err.message);
    console.warn('           Falling back to in-memory adapter.');
  }
}

// Boot the mediasoup worker pool before accepting connections.
await initializeWorkerPool();

io.on('connect', (socket) => {
  console.log(`User connected with socket.io: ${socket.id}`);
  initializeRoomHandlers(io, socket);
  initializeMediasoupHandlers(io, socket);
});

// Graceful shutdown.
const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down…`);
  closeAllWorkers();
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, io, server };
