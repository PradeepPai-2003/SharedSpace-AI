import express from 'express';
import { chatWithAI, chatWithAIStream, getAIMemory, clearAIMemory } from '../controllers/ai.js';
import { protect } from '../middleware/auth.js';
import { aiRestLimiter } from '../middleware/aiRateLimiter.js';
import { validateAIPrompt, validateMongoIdParam } from '../middleware/validation.js';

const router = express.Router();

router.post('/chat', protect, aiRestLimiter, validateAIPrompt, chatWithAI);
router.post('/chat/stream', protect, aiRestLimiter, validateAIPrompt, chatWithAIStream);
router.get('/memory/:userId', protect, validateMongoIdParam('userId'), getAIMemory);
router.delete('/memory/:userId', protect, validateMongoIdParam('userId'), clearAIMemory);

export default router;
