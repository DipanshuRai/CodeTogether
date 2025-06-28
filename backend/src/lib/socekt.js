import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
    credentials: true,
  },
});

// Rooms: { [roomId]: { adminId: socket.id, Map<socket.id, username> } }
const rooms = {};

const handleLeaveRoom = (socket) => {
  const roomId = socket.roomId;
  if (!roomId || !rooms[roomId]) {
    return;
  }

  const room = rooms[roomId];
  const username = room.users.get(socket.id)

  room.users.delete(socket.id);
  console.log(`User ${socket.id} removed from room ${roomId}. Users left: ${room.users.size}`);

  if(username){
    socket.to(roomId).emit("user-left", username);
  }

  if (room.users.size === 0) {
    console.log(`Room ${roomId} is empty, deleting it.`);
    delete rooms[roomId];
    return;
  }

  if (socket.id === room.adminId) {
    const newAdminId = room.users.keys().next().value; // Get the first user's ID
    room.adminId = newAdminId;
    console.log(`Admin disconnected. New admin for room ${roomId} is ${newAdminId}`);
    io.to(newAdminId).emit("new-admin");
  }

  socket.leave(roomId);
  socket.roomId = null;
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

    rooms[roomId] = {
      adminId: socket.id,
      users: new Map([[socket.id, name]]),
    };

    console.log(`User ${socket.id} created and joined room ${roomId}`);
    callback({ success: true, roomId, message: "Room created" });
  });

  socket.on("join-room", (roomId, name, callback) => {
    if (!rooms[roomId]) {
      return callback({ success: false, message: "Room not found." });
    }
    console.log("Name: ", name);

    socket.join(roomId);
    socket.roomId = roomId;

    rooms[roomId].users.set(socket.id, name);

    console.log(`User ${socket.id} joined room ${roomId}`);
    socket.to(roomId).emit("user-joined", name);
    callback({ success: true, roomId, message: "Room joined" });
  });

  socket.on("check-user", (roomId, callback) => {
    if (socket.roomId === roomId && rooms[roomId]?.users.has(socket.id)) {
      callback({ success: true });
    } else {
      callback({ success: false, message: "Provide Room ID" });
    }
  });

  socket.on("code-change", ({ language, code }) => {
    const roomId = socket.roomId;
    socket.to(roomId).emit("remote-code-change", { language, code });
  });

  socket.on("leave-room", () => {
    console.log(`User ${socket.id} is explicitly leaving room ${socket.roomId}`);
    handleLeaveRoom(socket);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    handleLeaveRoom(socket);
  });
});

export { app, io, server };
