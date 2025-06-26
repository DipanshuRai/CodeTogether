import express from 'express';
import { app, server } from './lib/socekt.js';
import { connectDB } from './lib/db.js';
import cors from 'cors';
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser';
import morgan from "morgan";
import authRoutes from './routes/auth.route.js';

dotenv.config();
const PORT=process.env.PORT;

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
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