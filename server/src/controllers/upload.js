import multer from 'multer';
import { uploadToCloudinary } from '../services/cloudinary.js';

// Setup multer memory storage (stores file in memory as Buffer)
const storage = multer.memoryStorage();

// File type filter helper
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i;
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');
  
  if (file.originalname.match(allowedExtensions) && (isImage || isVideo)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format. Only images (JPG, JPEG, PNG, GIF, WEBP) and videos (MP4, MOV, WEBM) are supported.'), false);
  }
};

// Multer upload instances
export const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB size limit
  },
  fileFilter,
});

// @desc    Upload an image (avatar or chat image)
// @route   POST /api/upload/image
// @access  Private
export const uploadImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload an image file' });
  }

  try {
    const isImage = req.file.mimetype.startsWith('image/');
    const allowedImgExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;
    
    if (!isImage || !req.file.originalname.match(allowedImgExtensions)) {
      return res.status(400).json({ success: false, message: 'Uploaded file is not a supported image format' });
    }

    const folder = req.body.type === 'avatar' ? 'avatars' : 'images';
    const result = await uploadToCloudinary(req.file.buffer, folder);

    res.status(200).json({
      success: true,
      url: result.secure_url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
  } catch (error) {
    console.error('UploadImage error:', error);
    res.status(500).json({ success: false, message: 'File upload failed: ' + error.message });
  }
};

// @desc    Upload an allowed video file
// @route   POST /api/upload/file
// @access  Private
export const uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a file' });
  }

  try {
    const isVideo = req.file.mimetype.startsWith('video/');
    const allowedVideoExtensions = /\.(mp4|mov|webm)$/i;
    
    if (!isVideo || !req.file.originalname.match(allowedVideoExtensions)) {
      return res.status(400).json({ success: false, message: 'Uploaded file is not a supported video format' });
    }

    const folder = 'videos';
    const fileType = 'video';

    const result = await uploadToCloudinary(req.file.buffer, folder);

    res.status(200).json({
      success: true,
      url: result.secure_url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: fileType,
    });
  } catch (error) {
    console.error('UploadFile error:', error);
    res.status(500).json({ success: false, message: 'File upload failed: ' + error.message });
  }
};
