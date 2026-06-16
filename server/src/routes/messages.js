import express from 'express';
import { getMessagesBySpace, deleteMessage, clearSpaceChat, togglePinMessage, getStarredMessages, replyWithAI } from '../controllers/messages.js';
import { protect } from '../middleware/auth.js';
import { aiRestLimiter } from '../middleware/aiRateLimiter.js';
import { validateMongoIdParam } from '../middleware/validation.js';

const router = express.Router();

router.get('/starred', protect, getStarredMessages);
router.get('/:spaceId', protect, validateMongoIdParam('spaceId'), getMessagesBySpace);
router.delete('/clear/:spaceId', protect, validateMongoIdParam('spaceId'), clearSpaceChat);
router.put('/:id/pin', protect, validateMongoIdParam('id'), togglePinMessage);
router.delete('/:id', protect, validateMongoIdParam('id'), deleteMessage);
router.post('/:id/reply-with-ai', protect, aiRestLimiter, validateMongoIdParam('id'), replyWithAI);

export default router;
