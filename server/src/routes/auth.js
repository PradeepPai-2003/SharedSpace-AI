import express from 'express';
import { register, login, logout, getMe } from '../controllers/auth.js';
import { protect } from '../middleware/auth.js';
import { validateRegister, validateLogin } from '../middleware/validation.js';
import { loginRegisterLimiter } from '../middleware/aiRateLimiter.js';

const router = express.Router();

router.post('/register', loginRegisterLimiter, validateRegister, register);
router.post('/login', loginRegisterLimiter, validateLogin, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

export default router;
