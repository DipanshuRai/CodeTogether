import { rooms, socketToRoomMap, initializeRoomState, cleanupRoom } from './state.js';
import { createRouter } from './mediasoup.js';

const sendUpdatedUserList = (io, roomId) => {
    if (rooms[roomId]) {
        const userList = Array.from(rooms[roomId].users.entries()).map(([id, name]) => ({ id, name }));
        io.to(roomId).emit('update-user-list', userList);
    }
};

const handleLeaveRoom = (io, socket) => {
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
    if (username) {
        socket.to(roomId).emit("user-left", { socketId: socket.id, name: username });
    }

    if (room.users.size === 0) {
        cleanupRoom(roomId);
    } else {
        sendUpdatedUserList(io, roomId);
    }
};

export const initializeRoomHandlers = (io, socket) => {
    socket.on("create-room", async (roomId, name, callback) => {
        if (rooms[roomId]) {
            return callback({ success: false, message: "Room already exists." });
        }
        try {
            const router = await createRouter();
            socket.join(roomId);
            socketToRoomMap.set(socket.id, roomId);
            
            initializeRoomState(roomId, router);
            rooms[roomId].users.set(socket.id, name);
            rooms[roomId].peers[socket.id] = { transports: [], producers: [], consumers: [] };
            
            const currentUserList = Array.from(rooms[roomId].users.entries()).map(([id, name]) => ({ id, name }));

            console.log(`User ${name} created and joined room ${roomId}`);
            callback({ success: true, roomId, message: "Room created", users: currentUserList });
            sendUpdatedUserList(io, roomId);
        } catch (error) {
            console.error("Error creating room:", error);
            callback({ success: false, message: "Error creating room." });
        }
    });

    socket.on("join-room", (roomId, name, callback) => {
        if (!rooms[roomId]) return callback({ success: false, message: "Room not found." });
        if (socketToRoomMap.has(socket.id)) {
            handleLeaveRoom(io, socket);
        }
        socket.join(roomId);
        socketToRoomMap.set(socket.id, roomId);
        rooms[roomId].users.set(socket.id, name);
        rooms[roomId].peers[socket.id] = { transports: [], producers: [], consumers: [] };

        console.log(`User ${name} joined room ${roomId}`);
        socket.to(roomId).emit("user-joined", { socketId: socket.id, name });
        
        const currentUserList = Array.from(rooms[roomId].users.entries()).map(([id, name]) => ({ id, name }));
        callback({ 
            success: true, 
            roomId, 
            message: "Room joined",
            users: currentUserList 
        });
        
        sendUpdatedUserList(io, roomId);
    });

    socket.on("leave-room", () => handleLeaveRoom(io, socket));
    socket.on("disconnect", (reason) => {
        console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
        handleLeaveRoom(io, socket);
    });
};