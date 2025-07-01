import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from 'cors';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: ['http://localhost:5173', 'http://192.168.0.113:5173'],
    // origin: process.env.CORS_ORIGIN,
    credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://192.168.0.113:5173'],
    methods: ['GET','POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }
});

// Rooms: { [roomId]: { adminId: socket.id, Map<socket.id, username> } }
const rooms = {};

// Sockets: Map<socket.id, roomId>
const socketToRoomMap = new Map();

const handleLeaveRoom = (socket) => {
  const roomId = socket.roomId;
  if (!roomId || !rooms[roomId]) {
    return;
  }

  const room = rooms[roomId];
  const username = room.users.get(socket.id)

  room.users.delete(socket.id);
  socketToRoomMap.delete(socket.id);
  console.log(`User ${socket.id} removed from room ${roomId}. Users left: ${room.users.size}`);

  if(username){
    socket.to(roomId).emit("user-left", { socketId: socket.id, name: username });
  }

  if (room.users.size === 0) {
    console.log(`Room ${roomId} is empty, deleting it.`);
    delete rooms[roomId];
    return;
  }
  else{
    if (socket.id === room.adminId) {
      const newAdminId = room.users.keys().next().value; // Get the first user's ID
      room.adminId = newAdminId;
      console.log(`Admin disconnected. New admin for room ${roomId} is ${newAdminId}`);
      io.to(newAdminId).emit("new-admin");
    }
    sendUpdatedUserList(roomId);
  }
  
  socket.leave(roomId);
};

const sendUpdatedUserList = (roomId) => {
  if (rooms[roomId]) {
    const userList = Array.from(rooms[roomId].users.entries()).map(([id, name]) => ({ id, name }));
    io.to(roomId).emit('update-user-list', userList);
  }
};

io.on("connect", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("create-room", (roomId, name, callback) => {
    if (rooms[roomId]) {
      return callback({
        success: false,
        message: "Room already exists. Try a different ID.",
      });
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socketToRoomMap.set(socket.id, roomId);

    rooms[roomId] = {
      adminId: socket.id,
      users: new Map([[socket.id, name]]),
    };

    console.log(`User ${socket.id} created and joined room ${roomId}`);
    callback({ success: true, roomId, message: "Room created" });

    sendUpdatedUserList(roomId);
  });

  socket.on("join-room", (roomId, name, callback) => {
    if (!rooms[roomId]) {
      return callback({ success: false, message: "Room not found." });
    }

    socket.join(roomId);
    socketToRoomMap.set(socket.id, roomId);
    rooms[roomId].users.set(socket.id, name);

    console.log(`User ${name}(${socket.id}) joined room ${roomId}`);
    socket.to(roomId).emit("user-joined", { socketId: socket.id, name });
    callback({ success: true, roomId, message: "Room joined" });

    sendUpdatedUserList(roomId);
  });

  socket.on("check-user", (roomId, callback) => {
    if (socketToRoomMap.get(socket.id) === roomId && rooms[roomId]?.users.has(socket.id)) {
      callback({ success: true });
    } else {
      callback({ success: false, message: "Access denied. You are not in this room." });
    }
  });

  socket.on("code-change", ({ language, code }) => {
    const roomId = socketToRoomMap.get(socket.id);
    if(roomId){
        socket.to(roomId).emit("remote-code-change", { language, code });
    }
  });

  socket.on("leave-room", () => {
    console.log(`User ${socket.id} is explicitly leaving room ${socketToRoomMap.get(socket.id)}`);
    handleLeaveRoom(socket);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    handleLeaveRoom(socket);
  });

  // A user sends an offer to a specific peer
  socket.on("webrtc:offer", ({ to, offer }) => {
    console.log(`Forwarding offer from ${socket.id} to ${to}`);
    io.to(to).emit("webrtc:offer", { from: socket.id, offer });
  });

  // A user sends an answer back to the peer who made the offer
  socket.on("webrtc:answer", ({ to, answer }) => {
    console.log(`Forwarding answer from ${socket.id} to ${to}`);
    io.to(to).emit("webrtc:answer", { from: socket.id, answer });
  });

  // A user sends an ICE candidate to a peer
  socket.on("webrtc:ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("webrtc:ice-candidate", { from: socket.id, candidate });
  });
});

export { app, io, server };
