import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from 'cors';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { createRouter } from './mediasoup.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const corsOrigin = process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://192.168.0.113:5173'];

app.use(cors({
    origin: corsOrigin,
    credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET','POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }
});

// --- State Management ---
const rooms = {}; // Stores mediasoup router, users, peers
const socketToRoomMap = new Map(); // Maps socket.id to roomId
const roomDocs = new Map(); // Stores Y.Doc for each room for code
const roomAwarenessStates = new Map(); // Stores awareness instance for each room
const whiteboardStates = {}; // Stores whiteboard drawings

const handleLeaveRoom = (socket) => {
  const roomId = socketToRoomMap.get(socket.id);
  if (!roomId || !rooms[roomId]) return;

  const room = rooms[roomId];
  const username = room.users.get(socket.id);

  console.log(`Cleaning up for user ${username} (${socket.id}) in room ${roomId}`);

  // Clean up Mediasoup resources
  if (room.peers[socket.id]) {
    room.peers[socket.id].producers.forEach(producer => {
      socket.to(roomId).emit("producer-closed", { producerId: producer.id });
    });
    room.peers[socket.id].transports.forEach(transport => transport.close());
    delete room.peers[socket.id];
  }

  // Clean up Yjs Awareness state
  const awareness = roomAwarenessStates.get(roomId);
  if (awareness) {
    const states = awareness.getStates();
    if (states.has(socket.id)) {
        states.delete(socket.id);
        // FIX: Call the imported function directly
        const update = encodeAwarenessUpdate(awareness, [socket.id]);
        socket.to(roomId).emit('awareness:update', update);
    }
  }
  
  // Clean up user and room maps
  room.users.delete(socket.id);
  socketToRoomMap.delete(socket.id);
  socket.leave(roomId);
  console.log(`User ${username} left room ${roomId}. Users left: ${room.users.size}`);
  
  if(username){
    socket.to(roomId).emit("user-left", { socketId: socket.id, name: username });
  }

  // If the room is empty, destroy all associated resources
  if (room.users.size === 0) {
    console.log(`Room ${roomId} is empty, closing router and deleting all data.`);
    room.router.close();
    
    const doc = roomDocs.get(roomId);
    if (doc) {
        doc.destroy();
        roomDocs.delete(roomId);
    }
    
    if (awareness) {
        awareness.destroy();
        roomAwarenessStates.delete(roomId);
    }

    delete whiteboardStates[roomId];
    delete rooms[roomId];
  } else {
    sendUpdatedUserList(roomId);
  }
};

const sendUpdatedUserList = (roomId) => {
  if (rooms[roomId]) {
    const userList = Array.from(rooms[roomId].users.entries()).map(([id, name]) => ({ id, name }));
    io.to(roomId).emit('update-user-list', userList);
  }
};

io.on("connect", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("create-room", async (roomId, name, callback) => {
    if (rooms[roomId]) {
      return callback({ success: false, message: "Room already exists." });
    }
    try {
      const router = await createRouter();
      const doc = new Y.Doc();
      const awareness = new Awareness(doc);

      socket.join(roomId);
      socketToRoomMap.set(socket.id, roomId);
      rooms[roomId] = { router, users: new Map([[socket.id, name]]), peers: {} };
      rooms[roomId].peers[socket.id] = { transports: [], producers: [], consumers: [] };
      roomDocs.set(roomId, doc);
      roomAwarenessStates.set(roomId, awareness);

      console.log(`User ${name} created and joined room ${roomId}`);
      callback({ success: true, roomId, message: "Room created" });
      sendUpdatedUserList(roomId);
    } catch (error) {
      console.error("Error creating room:", error);
      callback({ success: false, message: "Error creating room." });
    }
  });

  socket.on("join-room", (roomId, name, callback) => {
    if (!rooms[roomId]) return callback({ success: false, message: "Room not found." });
    if (socketToRoomMap.has(socket.id)) {
        handleLeaveRoom(socket);
    }
    socket.join(roomId);
    socketToRoomMap.set(socket.id, roomId);
    rooms[roomId].users.set(socket.id, name);
    rooms[roomId].peers[socket.id] = { transports: [], producers: [], consumers: [] };

    console.log(`User ${name} joined room ${roomId}`);
    socket.to(roomId).emit("user-joined", { socketId: socket.id, name });
    callback({ success: true, roomId, message: "Room joined" });
    sendUpdatedUserList(roomId);
  });

  // --- Mediasoup Signaling ---
  socket.on("get-router-rtp-capabilities", (roomId, callback) => {
    const router = rooms[roomId]?.router;
    if (router) {
      callback(router.rtpCapabilities);
    } else {
      callback({ error: "Room not found" });
    }
  });
  
  socket.on("get-initial-producers", (roomId, callback) => {
    const producerList = [];
    if (roomId && rooms[roomId]) {
      Object.values(rooms[roomId].peers).forEach(peer => {
        peer.producers.forEach(producer => {
          producerList.push({ producerId: producer.id, socketId: producer.appData.socketId, kind: producer.kind, type: producer.appData.type });
        });
      });
    }
    callback(producerList);
  });

  socket.on("create-webrtc-transport", async ({ roomId, isSender }, callback) => {
    const router = rooms[roomId]?.router;
    if (!router) {
        console.error(`Router not found for roomId: ${roomId}`);
        return callback({ error: "Router not found" });
    }
    try {
      const transport = await router.createWebRtcTransport({
          listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.ANNOUNCED_IP }],
          enableUdp: true, enableTcp: true, preferUdp: true,
      });
      rooms[roomId].peers[socket.id].transports.push(transport);
      callback({ id: transport.id, iceParameters: transport.iceParameters, iceCandidates: transport.iceCandidates, dtlsParameters: transport.dtlsParameters });
    } catch (error) {
      console.error("Failed to create WebRTC transport:", error);
      callback({ error: error.message });
    }
  });

  socket.on("connect-transport", async ({ transportId, dtlsParameters }, callback) => {
    try {
      const roomId = socketToRoomMap.get(socket.id);
      const transport = rooms[roomId]?.peers[socket.id]?.transports.find(t => t.id === transportId);
      if (!transport) return callback({ error: "Transport not found" });
      await transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (error) {
      console.error("Error connecting transport:", error);
      callback({ error: error.message });
    }
  });

  socket.on("produce", async ({ kind, rtpParameters, transportId, appData }, callback) => {
    try {
      const roomId = socketToRoomMap.get(socket.id);
      const transport = rooms[roomId]?.peers[socket.id]?.transports.find(t => t.id === transportId);
      if (!transport) return callback({ error: "Transport not found" });
      const producer = await transport.produce({ kind, rtpParameters, appData: { ...appData, socketId: socket.id } });
      rooms[roomId].peers[socket.id].producers.push(producer);
      producer.on('transportclose', () => {
          console.log(`Producer's transport closed ${producer.id}`);
          const room = rooms[roomId];
          if (room && room.peers[socket.id]) {
              room.peers[socket.id].producers = room.peers[socket.id].producers.filter(p => p.id !== producer.id);
          }
      });
      callback({ id: producer.id });
      socket.to(roomId).emit("new-producer", { producerId: producer.id, socketId: socket.id, kind: producer.kind, type: appData?.type });
    } catch (error) {
      console.error("Error producing:", error);
      callback({ error: error.message });
    }
  });

  socket.on("consume", async ({ producerId, rtpCapabilities, transportId }, callback) => {
    try {
      const roomId = socketToRoomMap.get(socket.id);
      const router = rooms[roomId]?.router;
      const transport = rooms[roomId]?.peers[socket.id]?.transports.find(t => t.id === transportId && !t.closed);
      if (!router || !transport) return callback({ error: "Room or transport not found" });
      if (!router.canConsume({ producerId, rtpCapabilities })) return callback({ error: "Cannot consume" });
      const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
      rooms[roomId].peers[socket.id].consumers.push(consumer);
      consumer.on('transportclose', () => {});
      consumer.on('producerclose', () => io.to(socket.id).emit('consumer-closed', { consumerId: consumer.id }));
      callback({ id: consumer.id, producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters });
    } catch(error) {
        console.error("Error consuming:", error);
        callback({ error: error.message });
    }
  });

  socket.on("resume-consumer", async ({ consumerId }) => {
    try {
        const consumer = rooms[socketToRoomMap.get(socket.id)]?.peers[socket.id]?.consumers.find(c => c.id === consumerId);
        if (consumer) await consumer.resume();
    } catch (error) {
        console.error("Error resuming consumer:", error);
    }
  });

  // --- Yjs / CRDT Signaling for Code Editor ---
  socket.on('crdt:update', (roomId, update) => {
    const doc = roomDocs.get(roomId);
    if (doc) {
        Y.applyUpdate(doc, new Uint8Array(update), 'server');
        socket.to(roomId).emit('crdt:update', update);
    }
  });

  socket.on('crdt:get-state', (roomId, callback) => {
    const doc = roomDocs.get(roomId);
    if (doc) {
        callback(Y.encodeStateAsUpdate(doc));
    }
  });

  // --- Yjs / Awareness Signaling for Cursors ---
  socket.on('awareness:update', (roomId, update) => {
    const awareness = roomAwarenessStates.get(roomId);
    if (awareness) {
      // FIX: Call the imported function directly
      applyAwarenessUpdate(awareness, new Uint8Array(update), socket);
      socket.to(roomId).emit('awareness:update', update);
    }
  });

  socket.on('awareness:get-state', (roomId, callback) => {
    const awareness = roomAwarenessStates.get(roomId);
    if (awareness) {
        const allClientIDs = Array.from(awareness.getStates().keys());
        // FIX: Call the imported function directly
        const update = encodeAwarenessUpdate(awareness, allClientIDs);
        callback(update);
    }
  });

  // --- Disconnection Logic ---
  socket.on("leave-room", () => handleLeaveRoom(socket));
  socket.on("disconnect", (reason) => {
    console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
    handleLeaveRoom(socket);
  });
});

export { app, io, server };