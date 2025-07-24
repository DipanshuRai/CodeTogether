import { Router } from 'express';
import { Liveblocks } from '@liveblocks/node';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY,
});

router.post('/auth', verifyJWT, async (req, res) => {
  try {
    const user = req.user;

    const { room } = req.body;

    if (!room) {
      return res.status(400).json({ message: 'Room ID is required.' });
    }

    const session = liveblocks.prepareSession(user._id.toString(), {
      userInfo: {
        name: user.fullname,
        email: user.email,
      },
    });

    session.allow(room, session.FULL_ACCESS);

    const { status, body } = await session.authorize(); [2]

    return res.status(status).end(body);

  } catch (error) {
    console.error("Error in Liveblocks auth controller: ", error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;