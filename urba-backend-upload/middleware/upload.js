const multer = require('multer');
const path = require('path');
const ApiError = require('../utils/apiError');

// Memory storage for secure validation and direct streaming to Cloudinary or disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allowed mime types strictly for image safety
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per image
    files: 5, // max 5 images per product
  },
  fileFilter,
});

module.exports = upload;
