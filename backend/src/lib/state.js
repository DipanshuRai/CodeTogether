// Per-process in-memory room registry.
// In multi-instance deployments, point Socket.IO at the Redis adapter
// (see socket.js) so events flow between instances; the room *router state*
// still lives on the instance that owns it (mediasoup is per-process).
export const rooms = {};
export const socketToRoomMap = new Map();

export const initializeRoomState = (roomId, router) => {
  rooms[roomId] = {
    router,
    users: new Map(),
    peers: {},
    // Chat history (last 200 msgs).
    chat: [],
    // Set of socketIds with hand raised.
    raisedHands: new Set(),
    // mediasoup AudioLevelObserver instance (lazy).
    audioLevelObserver: null,
  };
};

export const cleanupRoom = (roomId) => {
  console.log(`Room ${roomId} is empty, closing router and deleting all data.`);
  const room = rooms[roomId];
  if (!room) return;
  try { room.audioLevelObserver?.close(); } catch { /* ignore */ }
  try { room.router?.close(); } catch { /* ignore */ }
  delete rooms[roomId];
};
