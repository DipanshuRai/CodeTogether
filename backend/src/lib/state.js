import * as Y from 'yjs';

// Centralized state management to avoid circular dependencies
export const rooms = {}; // Stores mediasoup router, users, peers
export const socketToRoomMap = new Map(); // Maps socket.id to roomId
export const roomDocs = new Map(); // Stores Y.Doc for each room for code

// Helper function to initialize room state
export const initializeRoomState = (roomId, router) => {
    const doc = new Y.Doc();
    roomDocs.set(roomId, doc);
    rooms[roomId] = { router, users: new Map(), peers: {} };
};

// Helper function to clean up all resources associated with a room
export const cleanupRoom = (roomId) => {
    console.log(`Room ${roomId} is empty, closing router and deleting all data.`);
    
    const room = rooms[roomId];
    if (room && room.router) {
        room.router.close();
    }

    const doc = roomDocs.get(roomId);
    if (doc) {
        doc.destroy();
        roomDocs.delete(roomId);
    }

    delete rooms[roomId];
};