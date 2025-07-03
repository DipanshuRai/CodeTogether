import express from 'express';
import {signup, login, googleLogin, logout, refreshAccessToken} from '../controllers/user.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router=express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.post('/logout', verifyJWT, logout);
router.route("/refresh-token").post(refreshAccessToken);

export default router;