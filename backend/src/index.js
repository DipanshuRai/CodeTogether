import express from 'express';
import { app, server } from './lib/socekt.js';
import { connectDB } from './lib/db.js';
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser';
import morgan from "morgan";
import authRoutes from './routes/auth.route.js';

dotenv.config();
const PORT=process.env.PORT || 5000;

// app.use(cors({
//     origin: ['http://localhost:5173', 'http://192.168.0.113:5173'],
//     // origin: process.env.CORS_ORIGIN,
//     credentials: true
// }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use('/api/auth', authRoutes);

connectDB().
then(()=>{
    server.listen(PORT, ()=>{
        console.log(`Server is running on port: ${PORT}`);   
    })
}).
catch((error)=>{
    console.log("Server did not start: ", error);
});