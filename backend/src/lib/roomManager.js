import { rooms, socketToRoomMap, initializeRoomState, cleanupRoom } from './state.js';
import { createRouter } from './mediasoup.js';

const sendUpdatedUserList = (io, roomId) => {
  if (!rooms[roomId]) return;
  const userList = Array.from(rooms[roomId].users.entries()).map(([id, name]) => ({ id, name }));
  io.to(roomId).emit('update-user-list', userList);
};

const handleLeaveRoom = (io, socket) => {
  const roomId = socketToRoomMap.get(socket.id);
  if (!roomId || !rooms[roomId]) return;

  const room = rooms[roomId];
  const username = room.users.get(socket.id);

  console.log(`Cleaning up for user ${username} (${socket.id}) in room ${roomId}`);

  if (room.peers[socket.id]) {
    room.peers[socket.id].producers.forEach(producer => {
      socket.to(roomId).emit('specific-producer-closed', { producerId: producer.id });
    });
    room.peers[socket.id].transports.forEach(transport => transport.close());
    delete room.peers[socket.id];
  }

  room.users.delete(socket.id);
  socketToRoomMap.delete(socket.id);
  room.raisedHands.delete(socket.id);
  socket.leave(roomId);

  console.log(`User ${username} left room ${roomId}. Users left: ${room.users.size}`);
  if (username) {
    socket.to(roomId).emit('user-left', { socketId: socket.id, name: username });
    // Hand-down broadcast if they had it raised.
    socket.to(roomId).emit('raise-hand', { socketId: socket.id, raised: false });
  }

  if (room.users.size === 0) {
    cleanupRoom(roomId);
  } else {
    sendUpdatedUserList(io, roomId);
  }
};

export const initializeRoomHandlers = (io, socket) => {
  socket.on('create-room', async (roomId, name, callback) => {
    if (rooms[roomId]) {
      return callback({ success: false, message: 'Room already exists.' });
    }
    try {
      const router = await createRouter();
      socket.join(roomId);
      socketToRoomMap.set(socket.id, roomId);

      initializeRoomState(roomId, router);
      rooms[roomId].users.set(socket.id, name);
      rooms[roomId].peers[socket.id] = { transports: [], producers: [], consumers: [] };

      const currentUserList = Array.from(rooms[roomId].users.entries()).map(([id, n]) => ({ id, name: n }));

      console.log(`User ${name} created and joined room ${roomId}`);
      callback({ success: true, roomId, message: 'Room created', users: currentUserList });
      sendUpdatedUserList(io, roomId);
    } catch (error) {
      console.error('Error creating room:', error);
      callback({ success: false, message: 'Error creating room.' });
    }
  });

  socket.on('join-room', (roomId, name, callback) => {
    if (!rooms[roomId]) return callback({ success: false, message: 'Room not found.' });

    const currentRoomId = socketToRoomMap.get(socket.id);
    if (currentRoomId === roomId) {
      console.log(`User ${name} (${socket.id}) sent a redundant join for ${roomId}.`);
      const currentUserList = Array.from(rooms[roomId].users.entries()).map(([id, n]) => ({ id, name: n }));
      return callback({ success: true, roomId, message: 'Already in room', users: currentUserList });
    }
    if (currentRoomId) handleLeaveRoom(io, socket);

    socket.join(roomId);
    socketToRoomMap.set(socket.id, roomId);
    rooms[roomId].users.set(socket.id, name);
    rooms[roomId].peers[socket.id] = { transports: [], producers: [], consumers: [] };

    console.log(`User ${name} joined room ${roomId}`);
    socket.to(roomId).emit('user-joined', { socketId: socket.id, name });

    const currentUserList = Array.from(rooms[roomId].users.entries()).map(([id, n]) => ({ id, name: n }));
    callback({ success: true, roomId, message: 'Room joined', users: currentUserList });

    // Replay chat history + currently raised hands to the joiner.
    socket.emit('chat-history', rooms[roomId].chat);
    rooms[roomId].raisedHands.forEach(sid => {
      socket.emit('raise-hand', { socketId: sid, raised: true });
    });

    sendUpdatedUserList(io, roomId);
  });

  socket.on('leave-room', () => handleLeaveRoom(io, socket));
  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
    handleLeaveRoom(io, socket);
  });

  // --- Chat / raise-hand / reactions --------------------------------------
  socket.on('chat-message', (payload) => {
    const roomId = socketToRoomMap.get(socket.id);
    const room = rooms[roomId];
    if (!room) return;
    const text = (typeof payload?.text === 'string' ? payload.text : '').slice(0, 1000);
    if (!text.trim()) return;
    const msg = {
      id: `${Date.now()}-${socket.id}`,
      socketId: socket.id,
      name: room.users.get(socket.id) || 'Anonymous',
      text,
      at: Date.now(),
    };
    room.chat.push(msg);
    if (room.chat.length > 200) room.chat.shift();
    io.to(roomId).emit('chat-message', msg);
  });

  socket.on('raise-hand', ({ raised } = {}) => {
    const roomId = socketToRoomMap.get(socket.id);
    const room = rooms[roomId];
    if (!room) return;
    if (raised) room.raisedHands.add(socket.id);
    else room.raisedHands.delete(socket.id);
    io.to(roomId).emit('raise-hand', { socketId: socket.id, raised: !!raised });
  });

  socket.on('reaction', ({ emoji } = {}) => {
    const roomId = socketToRoomMap.get(socket.id);
    const room = rooms[roomId];
    if (!room || typeof emoji !== 'string' || emoji.length > 8) return;
    io.to(roomId).emit('reaction', {
      socketId: socket.id,
      name: room.users.get(socket.id) || 'Someone',
      emoji,
    });
  });
};
