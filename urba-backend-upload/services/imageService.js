const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary if credentials exist in env
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
    secure: true,
  });
} else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Upload an image buffer to Cloudinary or fallback to local static storage
 */
const uploadImageBuffer = async (buffer, originalname) => {
  const isCloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME &&
     process.env.CLOUDINARY_API_KEY &&
     process.env.CLOUDINARY_API_SECRET &&
     process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name')
  );

  if (isCloudinaryConfigured) {
    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'fashion-store/products',
            resource_type: 'image',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
          },
          (error, res) => {
            if (error) return reject(error);
            resolve({
              url: res.secure_url,
              publicId: res.public_id,
            });
          }
        );
        uploadStream.end(buffer);
      });
      return result;
    } catch (cloudErr) {
      console.error('Cloudinary upload failed, falling back to local storage:', cloudErr.message);
    }
  }

  // Fallback: Store locally in server/public/uploads with safe nonces
  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const ext = path.extname(originalname).toLowerCase() || '.jpg';
  const safeFilename = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
  const filePath = path.join(uploadsDir, safeFilename);

  fs.writeFileSync(filePath, buffer);

  return {
    url: `/uploads/${safeFilename}`,
    publicId: safeFilename,
  };
};

module.exports = { uploadImageBuffer };
