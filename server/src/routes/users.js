import express from 'express';
import { getUserById, updateUser, searchUsers } from '../controllers/users.js';
import { protect } from '../middleware/auth.js';
import { validateMongoIdParam, validateUpdateUser } from '../middleware/validation.js';

const router = express.Router();

router.get('/search', protect, searchUsers);
router.get('/:id', protect, validateMongoIdParam('id'), getUserById);
router.put('/:id', protect, validateMongoIdParam('id'), validateUpdateUser, updateUser);

export default router;
