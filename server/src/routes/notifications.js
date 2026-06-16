import express from 'express';
import { getMyNotifications, markNotificationRead, clearMyNotifications } from '../controllers/notifications.js';
import { protect } from '../middleware/auth.js';
import { validateMongoIdParam } from '../middleware/validation.js';

const router = express.Router();

router.get('/', protect, getMyNotifications);
router.put('/:id/read', protect, validateMongoIdParam('id'), markNotificationRead);
router.delete('/', protect, clearMyNotifications);

export default router;
