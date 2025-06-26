import express from 'express';
import http from 'http';
import { Server } from 'socket.io'
import dotenv from 'dotenv'

dotenv.config();

const app=express();
const server=http.createServer(app);

const io=new Server(server, {
    cors:{
        origin:['http://localhost:5173'],
        credentials: true
    }
});

// Rooms: { [roomId]: { adminId: socket.id, users: Set<socket.id> } }
const rooms = {};

io.on('connect', (socket)=>{
    console.log(`User connected: ${socket.id}`);

    socket.on('join-room', (roomId)=>{
        socket.join(roomId);

        if(!rooms[roomId]){
            rooms[roomId]={
                adminId:socket.id,
                users:new Set()
            };
        }

        rooms[roomId].users.add(socket.id);

        socket.emit('room-joined-confirmation');

        socket.emit('room-joined', {
            role: socket.id===rooms[roomId].adminId ? 'admin' : 'user',
            roomId,
        });
    });

    socket.on('code-change', ({ roomId, language, code })=>{
        socket.to(roomId).emit('remote-code-change', {language, code});
    });

    socket.on('disconnect', ()=>{
        console.log(`User disconnected: ${socket.id}`);
        for(const roomId in rooms){
            roomId.users.delete(socket.id);

            if(socket.id===roomId.adminId){
                const newAdminId=[...roomId.users][0];
                roomId.adminId=newAdminId || null;

                if(newAdminId){
                    io.to(newAdminId).emit('new-admin');
                }
            }

            if(roomId.users.size===0){
                delete rooms[roomId];
            }
        }
    });

    socket.on('connect_error', (err) => {
        console.error('Connection error:', err.message);
    });
});

export {app, io, server};