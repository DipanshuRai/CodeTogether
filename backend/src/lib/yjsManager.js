import * as Y from 'yjs';
import { roomDocs } from './state.js';

export const initializeYjsHandlers = (socket) => {
    socket.on('crdt:update', (roomId, update) => {                        
        const doc = roomDocs.get(roomId);
        if (doc) {
            Y.applyUpdate(doc, new Uint8Array(update), socket);
            // socket.to(roomId).emit('crdt:update', update);
            socket.broadcast.to(roomId).emit('crdt:update', update);
        }
    });

    socket.on('crdt:get-state', (roomId, callback) => {        
        const doc = roomDocs.get(roomId);
        if (doc) {
            callback(Y.encodeStateAsUpdate(doc));
        }
    });
};