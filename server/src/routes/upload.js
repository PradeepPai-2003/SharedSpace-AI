import express from 'express';
import { upload, uploadImage, uploadFile } from '../controllers/upload.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/image', protect, upload.single('file'), uploadImage);
router.post('/file', protect, upload.single('file'), uploadFile);

export default router;
