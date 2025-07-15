import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from 'cors';
import { createRouter } from './mediasoup.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173' || 'http://192.168.0.113:5173',
    credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET','POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }
});

const rooms = {};
const socketToRoomMap = new Map();
const whiteboardStates = {};

const handleLeaveRoom = (socket) => {
  const roomId = socketToRoomMap.get(socket.id);
  if (!roomId || !rooms[roomId]) return;

  const room = rooms[roomId];
  const username = room.users.get(socket.id);

  console.log(`Cleaning up for user ${username} (${socket.id}) in room ${roomId}`);

  if (room.peers[socket.id]) {
    room.peers[socket.id].transports.forEach(transport => transport.close());
    delete room.peers[socket.id];
  }
  
  room.users.delete(socket.id);
  socketToRoomMap.delete(socket.id);
  socket.leave(roomId);
  console.log(`User ${username} left room ${roomId}. Users left: ${room.users.size}`);
  
  if(username){
    socket.to(roomId).emit("producer-closed", { socketId: socket.id });
    socket.to(roomId).emit("user-left", { socketId: socket.id, name: username });
  }

  if (room.users.size === 0) {
    console.log(`Room ${roomId} is empty, closing router and deleting room.`);
    room.router.close();
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
    const router = await createRouter();
    socket.join(roomId);
    socketToRoomMap.set(socket.id, roomId);
    rooms[roomId] = { router, users: new Map([[socket.id, name]]), peers: {} };
    rooms[roomId].peers[socket.id] = { transports: [], producers: [], consumers: [] };
    console.log(`User ${name} created and joined room ${roomId}`);
    callback({ success: true, roomId, message: "Room created" });
    sendUpdatedUserList(roomId);
  });

  socket.on("join-room", (roomId, name, callback) => {
    if (!rooms[roomId]) return callback({ success: false, message: "Room not found." });
    handleLeaveRoom(socket);
    socket.join(roomId);
    socketToRoomMap.set(socket.id, roomId);
    rooms[roomId].users.set(socket.id, name);
    rooms[roomId].peers[socket.id] = { transports: [], producers: [], consumers: [] };
    console.log(`User ${name} joined room ${roomId}`);
    socket.to(roomId).emit("user-joined", { socketId: socket.id, name });
    callback({ success: true, roomId, message: "Room joined" });
    sendUpdatedUserList(roomId);
  });

  socket.on("get-router-rtp-capabilities", (roomId, callback) => {
    const router = rooms[roomId]?.router;
    if (router) callback(router.rtpCapabilities);
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

  socket.on("create-webrtc-transport", async ({ isSender }, callback) => {
    const roomId = socketToRoomMap.get(socket.id);
    const router = rooms[roomId]?.router;
    if (!router) return callback({ error: "Router not found" });

    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.ANNOUNCED_IP }],
      enableUdp: true, enableTcp: true, preferUdp: true,
    });
    rooms[roomId].peers[socket.id].transports.push(transport);
    callback({ id: transport.id, iceParameters: transport.iceParameters, iceCandidates: transport.iceCandidates, dtlsParameters: transport.dtlsParameters });
  });

  socket.on("connect-transport", async ({ transportId, dtlsParameters }, callback) => {
    const roomId = socketToRoomMap.get(socket.id);
    const transport = rooms[roomId]?.peers[socket.id]?.transports.find(t => t.id === transportId);
    if (!transport) return callback({ error: "Transport not found" });
    await transport.connect({ dtlsParameters });
    callback({ success: true });
  });

  socket.on("produce", async ({ kind, rtpParameters, transportId, appData }, callback) => {
    const roomId = socketToRoomMap.get(socket.id);
    const transport = rooms[roomId]?.peers[socket.id]?.transports.find(t => t.id === transportId);
    if (!transport) return callback({ error: "Transport not found" });

    const producer = await transport.produce({ kind, rtpParameters, appData: { ...appData, socketId: socket.id } });
    rooms[roomId].peers[socket.id].producers.push(producer);

    producer.on('close', () => {
        console.log(`Producer ${producer.id} closed`);
        const room = rooms[roomId];
        if (room && room.peers[socket.id]) {
            room.peers[socket.id].producers = room.peers[socket.id].producers.filter(p => p.id !== producer.id);
            io.to(roomId).emit("specific-producer-closed", { producerId: producer.id });
        }
    });
    
    callback({ id: producer.id });
    
    // *** THIS IS THE FIX ***
    // Using optional chaining (?.) prevents a crash if appData is undefined.
    socket.to(roomId).emit("new-producer", { producerId: producer.id, socketId: socket.id, kind: producer.kind, type: appData?.type });
  });

  socket.on("consume", async ({ producerId, rtpCapabilities, transportId }, callback) => {
    const roomId = socketToRoomMap.get(socket.id);
    const router = rooms[roomId]?.router;
    const transport = rooms[roomId]?.peers[socket.id]?.transports.find(t => t.id === transportId && !t.closed);
    if (!router || !transport) return callback({ error: "Room or transport not found" });
    if (!router.canConsume({ producerId, rtpCapabilities })) return callback({ error: "Cannot consume" });

    const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
    rooms[roomId].peers[socket.id].consumers.push(consumer);
    callback({ id: consumer.id, producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters });
  });

  socket.on("resume-consumer", async ({ consumerId }) => {
    const consumer = rooms[socketToRoomMap.get(socket.id)]?.peers[socket.id]?.consumers.find(c => c.id === consumerId);
    if (consumer) await consumer.resume();
  });

  socket.on("whiteboard:set-state", (data) => {
    const roomId = socketToRoomMap.get(socket.id);
    if (roomId) {
      whiteboardStates[roomId] = data.paths;
      io.to(roomId).emit("whiteboard:state-update", { paths: data.paths });
    }
  });

  socket.on("whiteboard:get-state", () => {
    const roomId = socketToRoomMap.get(socket.id);
    if (roomId && whiteboardStates[roomId]) {
      socket.emit("whiteboard:state-update", { paths: whiteboardStates[roomId] });
    }
  });

  socket.on("leave-room", () => handleLeaveRoom(socket));

  socket.on("disconnect", (reason) => {
    console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
    handleLeaveRoom(socket);
  });
});

export { app, io, server };