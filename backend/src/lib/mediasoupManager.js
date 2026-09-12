import { rooms, socketToRoomMap } from './state.js';
import { webRtcTransportOptions } from './mediasoup.js';

const safe = (cb) => (typeof cb === 'function' ? cb : () => {});

// Lazy-create one AudioLevelObserver per room and wire its events to the
// room's socket.io broadcast so clients can highlight the active speaker.
const ensureAudioLevelObserver = async (io, room, roomId) => {
  if (room.audioLevelObserver) return room.audioLevelObserver;
  try {
    const observer = await room.router.createAudioLevelObserver({
      maxEntries: 1,
      threshold: -65,
      interval: 800,
    });
    observer.on('volumes', (volumes) => {
      const top = volumes[0];
      const socketId = top?.producer?.appData?.socketId;
      if (socketId) io.to(roomId).emit('active-speaker', { socketId });
    });
    observer.on('silence', () => io.to(roomId).emit('active-speaker-silence'));
    room.audioLevelObserver = observer;
  } catch (err) {
    console.warn('Could not create AudioLevelObserver:', err.message);
  }
  return room.audioLevelObserver;
};

export const initializeMediasoupHandlers = (io, socket) => {
  socket.on('get-router-rtp-capabilities', (roomId, callback) => {
    const cb = safe(callback);
    const router = rooms[roomId]?.router;
    if (router) cb(router.rtpCapabilities);
    else cb({ error: 'Room not found' });
  });

  socket.on('get-initial-producers', (roomId, callback) => {
    const cb = safe(callback);
    const producerList = [];
    const room = rooms[roomId];
    if (room) {
      Object.entries(room.peers).forEach(([peerId, peer]) => {
        if (peerId === socket.id) return;
        peer.producers.forEach(producer => {
          if (producer.closed) return;
          producerList.push({
            producerId: producer.id,
            socketId: producer.appData.socketId,
            kind: producer.kind,
            type: producer.appData.type,
          });
        });
      });
    }
    cb(producerList);
  });

  socket.on('create-webrtc-transport', async ({ roomId }, callback) => {
    const cb = safe(callback);
    const room = rooms[roomId];
    if (!room || !room.peers[socket.id]) return cb({ error: 'Room not found' });
    try {
      const transport = await room.router.createWebRtcTransport(webRtcTransportOptions);
      transport.on('dtlsstatechange', (state) => {
        if (state === 'closed' || state === 'failed') transport.close();
      });
      room.peers[socket.id].transports.push(transport);
      cb({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (error) {
      console.error('Failed to create WebRTC transport:', error);
      cb({ error: error.message });
    }
  });

  socket.on('connect-transport', async ({ transportId, dtlsParameters }, callback) => {
    const cb = safe(callback);
    const roomId = socketToRoomMap.get(socket.id);
    const transport = rooms[roomId]?.peers[socket.id]?.transports.find(t => t.id === transportId);
    if (!transport) return cb({ error: 'Transport not found' });
    try {
      await transport.connect({ dtlsParameters });
      cb({ success: true });
    } catch (error) {
      console.error('connect-transport failed:', error);
      cb({ error: error.message });
    }
  });

  socket.on('restart-ice', async ({ transportId }, callback) => {
    const cb = safe(callback);
    const roomId = socketToRoomMap.get(socket.id);
    const transport = rooms[roomId]?.peers[socket.id]?.transports.find(t => t.id === transportId);
    if (!transport) return cb({ error: 'Transport not found' });
    try {
      const iceParameters = await transport.restartIce();
      cb({ iceParameters });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on('produce', async ({ kind, rtpParameters, transportId, appData }, callback) => {
    const cb = safe(callback);
    const roomId = socketToRoomMap.get(socket.id);
    const room = rooms[roomId];
    const peer = room?.peers[socket.id];
    const transport = peer?.transports.find(t => t.id === transportId);
    if (!transport) return cb({ error: 'Transport not found' });
    try {
      const producer = await transport.produce({
        kind,
        rtpParameters,
        appData: { ...appData, socketId: socket.id },
      });
      peer.producers.push(producer);

      producer.on('transportclose', () => {
        producer.close();
        if (rooms[roomId]?.peers[socket.id]) {
          rooms[roomId].peers[socket.id].producers =
            rooms[roomId].peers[socket.id].producers.filter(p => p.id !== producer.id);
        }
      });

      // Add mic to active-speaker observer so clients can highlight speakers.
      if (kind === 'audio') {
        const obs = await ensureAudioLevelObserver(io, room, roomId);
        try { await obs?.addProducer({ producerId: producer.id }); } catch { /* ignore */ }
      }

      cb({ id: producer.id });
      socket.to(roomId).emit('new-producer', {
        producerId: producer.id,
        socketId: socket.id,
        kind: producer.kind,
        type: appData?.type,
      });
    } catch (error) {
      console.error('produce failed:', error);
      cb({ error: error.message });
    }
  });

  socket.on('consume', async ({ producerId, rtpCapabilities, transportId }, callback) => {
    const cb = safe(callback);
    const roomId = socketToRoomMap.get(socket.id);
    const room = rooms[roomId];
    const transport = room?.peers[socket.id]?.transports.find(t => t.id === transportId && !t.closed);
    if (!room || !transport) return cb({ error: 'Room or transport not found' });
    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      return cb({ error: 'Cannot consume' });
    }
    try {
      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });
      room.peers[socket.id].consumers.push(consumer);

      const cleanup = () => {
        if (rooms[roomId]?.peers[socket.id]) {
          rooms[roomId].peers[socket.id].consumers =
            rooms[roomId].peers[socket.id].consumers.filter(c => c.id !== consumer.id);
        }
      };
      consumer.on('producerclose', () => {
        cleanup();
        socket.emit('consumer-closed', { consumerId: consumer.id });
      });
      consumer.on('transportclose', cleanup);

      cb({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (error) {
      console.error('consume failed:', error);
      cb({ error: error.message });
    }
  });

  socket.on('resume-consumer', async ({ consumerId }, callback) => {
    const cb = safe(callback);
    const consumer = rooms[socketToRoomMap.get(socket.id)]?.peers[socket.id]?.consumers.find(c => c.id === consumerId);
    if (!consumer) return cb({ error: 'Consumer not found' });
    try { await consumer.resume(); cb({ success: true }); }
    catch (error) { cb({ error: error.message }); }
  });

  // Pause a consumer server-side — fully stops SFU egress for the inactive tile.
  socket.on('pause-consumer', async ({ consumerId }, callback) => {
    const cb = safe(callback);
    const consumer = rooms[socketToRoomMap.get(socket.id)]?.peers[socket.id]?.consumers.find(c => c.id === consumerId);
    if (!consumer) return cb({ error: 'Consumer not found' });
    try { await consumer.pause(); cb({ success: true }); }
    catch (error) { cb({ error: error.message }); }
  });

  socket.on('close-producer', ({ producerId }, callback) => {
    const cb = safe(callback);
    const roomId = socketToRoomMap.get(socket.id);
    const peer = rooms[roomId]?.peers[socket.id];
    if (!peer) return cb({ error: 'Peer not found' });

    const producer = peer.producers.find(p => p.id === producerId);
    if (producer) {
      producer.close();
      peer.producers = peer.producers.filter(p => p.id !== producerId);
    }
    socket.to(roomId).emit('specific-producer-closed', { producerId });
    cb({ success: true });
  });
};
