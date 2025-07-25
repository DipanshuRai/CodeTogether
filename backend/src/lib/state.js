export const rooms = {}; // Stores mediasoup router, users, peers
export const socketToRoomMap = new Map(); // Maps socket.id to roomId

export const initializeRoomState = (roomId, router) => {
    rooms[roomId] = { router, users: new Map(), peers: {} };
};

export const cleanupRoom = (roomId) => {
    console.log(`Room ${roomId} is empty, closing router and deleting all data.`);
    
    const room = rooms[roomId];
    if (room && room.router) {
        room.router.close();
    }

    delete rooms[roomId];
};