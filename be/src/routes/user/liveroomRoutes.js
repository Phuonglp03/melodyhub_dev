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
    getRoomViewers,
    reportLivestream,
    checkLivestreamReport,
    checkLivestreamBanStatus
  } from '../../controllers/user/liveroomController.js';

const router = Router();
const { verifyToken, optionalVerifyToken } = middlewareController;

//api/livestreams/
// Create live room 
router.post('/', verifyToken, createLiveStream);

// Check if user is banned from livestreaming (call before creating room)
router.get('/ban-status', verifyToken, checkLivestreamBanStatus);

//Update stream title and description
router.patch('/:id/details', verifyToken, updateLiveStreamDetails);

//  Go live (status'preview' -> 'live')
router.patch( '/:id/go-live',verifyToken, goLive);

// Lấy thông tin chi tiết 1 phòng (Viewer) - Optional auth for public streams
router.get('/:id', optionalVerifyToken, getLiveStreamById);

// End live (status'live' -> 'ended')
router.patch( '/:id/end', verifyToken,endLiveStream);

// Update privacy type (Public -> Follow Only)
router.patch('/:id/privacy', verifyToken, updatePrivacy);

// Get active live streams - Optional auth
router.get('/', optionalVerifyToken, getActiveLiveStreams);

// Get chat history - Optional auth
router.get('/:roomId/chat', optionalVerifyToken, getChatHistory);

// Ban user (from chat)
router.post('/:roomId/ban/:userId', verifyToken, banUser); 

// Unban user (from chat)
router.post('/:roomId/unban/:userId', verifyToken, unbanUser);

// Get room viewers
router.get('/:roomId/viewers', verifyToken, getRoomViewers);

// ============ USER REPORT ENDPOINTS ============
// Report a livestream (user)
router.post('/:roomId/report', verifyToken, reportLivestream);

// Check if current user has reported a livestream
router.get('/:roomId/report/check', verifyToken, checkLivestreamReport);

export default router;