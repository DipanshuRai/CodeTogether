import express from 'express';
import http from 'http';
import { Server } from 'socket.io'
import dotenv from 'dotenv'

dotenv.config();
const PORT=process.env.PORT;

const app=express();
const server=http.createServer(app);

const io=new Server(server, {
    cors:{
        origin:['http://localhost:5173']
    }
})

io.on('connect', (socket)=>{
    console.log(`User connected: ${socket.id}`);

    socket.on('disconnect', ()=>{
        console.log(`User disconnected: ${socket.id}`);
    })

    socket.on('connect_error', (err) => {
        console.error('Connection error:', err.message);
    });

    socket.on('code-change', ({language, code})=>{
        socket.broadcast.emit('remote-code-change', {language, code});
    });
});

server.listen(PORT, ()=>{
    console.log(`Server is running on port: ${PORT}`);
});