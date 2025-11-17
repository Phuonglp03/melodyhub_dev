import { Router } from 'express';
import middlewareController from '../../middleware/auth.js';
import {
    createLiveStream,
    getActiveLiveStreams,
    getLiveStreamById,
    goLive,
    endLiveStream,
    updateLiveStreamDetails,
    updatePrivacy,
    getChatHistory,
    banUser,
    unbanUser,
    getRoomViewers
  } from '../../controllers/user/liveroomController.js';

const router = Router();
const { verifyToken } = middlewareController;

//api/livestreams/
// Create live room 
router.post('/', verifyToken, createLiveStream);

//Update stream title and description
router.patch('/:id/details', verifyToken, updateLiveStreamDetails);

//  Go live (status'preview' -> 'live')
router.patch( '/:id/go-live',verifyToken, goLive);

// Lấy thông tin chi tiết 1 phòng (Viewer)
router.get('/:id',verifyToken, getLiveStreamById);

// End live (status'live' -> 'ended')
router.patch( '/:id/end', verifyToken,endLiveStream);

// Update privacy type (Public -> Follow Only)
router.patch('/:id/privacy', verifyToken, updatePrivacy);

// Get active live streams
router.get('/', verifyToken, getActiveLiveStreams);

// Get chat history
router.get('/:roomId/chat',verifyToken, getChatHistory);

// Ban user
router.post('/:roomId/ban/:userId', verifyToken, banUser); 

// Unban user 
router.post('/:roomId/unban/:userId', verifyToken, unbanUser);

// Get room viewers
router.get('/:roomId/viewers', verifyToken, getRoomViewers);

export default router;