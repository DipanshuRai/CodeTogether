import { rooms, socketToRoomMap } from './state.js';

// Initializes all Mediasoup-related event listeners for a given socket
export const initializeMediasoupHandlers = (socket) => {
    socket.on("get-router-rtp-capabilities", (roomId, callback) => {
        const router = rooms[roomId]?.router;
        if (router) callback(router.rtpCapabilities);
        else callback({ error: "Room not found" });
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
        if (!router) return callback({ error: "Router not found" });
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
        const roomId = socketToRoomMap.get(socket.id);
        const transport = rooms[roomId]?.peers[socket.id]?.transports.find(t => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        try {
            await transport.connect({ dtlsParameters });
            callback({ success: true });
        } catch (error) {
            callback({ error: error.message });
        }
    });

    socket.on("produce", async ({ kind, rtpParameters, transportId, appData }, callback) => {
        const roomId = socketToRoomMap.get(socket.id);
        const transport = rooms[roomId]?.peers[socket.id]?.transports.find(t => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        try {
            const producer = await transport.produce({ kind, rtpParameters, appData: { ...appData, socketId: socket.id } });
            rooms[roomId].peers[socket.id].producers.push(producer);
            producer.on('transportclose', () => {
                const room = rooms[roomId];
                if (room && room.peers[socket.id]) {
                    room.peers[socket.id].producers = room.peers[socket.id].producers.filter(p => p.id !== producer.id);
                }
            });
            callback({ id: producer.id });
            socket.to(roomId).emit("new-producer", { producerId: producer.id, socketId: socket.id, kind: producer.kind, type: appData?.type });
        } catch (error) {
            callback({ error: error.message });
        }
    });

    socket.on("consume", async ({ producerId, rtpCapabilities, transportId }, callback) => {
        const roomId = socketToRoomMap.get(socket.id);
        const router = rooms[roomId]?.router;
        const transport = rooms[roomId]?.peers[socket.id]?.transports.find(t => t.id === transportId && !t.closed);
        if (!router || !transport) return callback({ error: "Room or transport not found" });
        if (!router.canConsume({ producerId, rtpCapabilities })) return callback({ error: "Cannot consume" });
        try {
            const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
            rooms[roomId].peers[socket.id].consumers.push(consumer);
            consumer.on('producerclose', () => socket.to(socket.id).emit('consumer-closed', { consumerId: consumer.id }));
            callback({ id: consumer.id, producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters });
        } catch (error) {
            callback({ error: error.message });
        }
    });

    socket.on("resume-consumer", async ({ consumerId }) => {
        const consumer = rooms[socketToRoomMap.get(socket.id)]?.peers[socket.id]?.consumers.find(c => c.id === consumerId);
        if (consumer) await consumer.resume();
    });
};