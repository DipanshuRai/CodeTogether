import express from 'express';
import { app, server } from './lib/socket.js';
import { connectDB } from './lib/db.js';
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser';
import morgan from "morgan";
import authRoutes from './routes/auth.route.js';
import liveblocksRoutes from './routes/liveblocks.route.js';
import { getWorkerStats } from './lib/mediasoup.js';

dotenv.config();
const PORT=process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.use('/api/auth', authRoutes);
app.use('/api/liveblocks', liveblocksRoutes);

// Liveness / worker stats endpoint for monitoring.
app.get('/api/health', async (_req, res) => {
    try {
        const workers = await getWorkerStats();
        res.json({ ok: true, workers });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

connectDB()
    .then(()=>{
        server.listen(PORT, ()=>{
            console.log(`Server is running on port: ${PORT}`);   
        })
    })
    .catch((error)=>{
        console.log("Server did not start: ", error);
    });