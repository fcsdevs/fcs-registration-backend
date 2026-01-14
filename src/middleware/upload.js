import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// Set up storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Temporary directory for uploads
        const uploadPath = 'public/files/images';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniquesuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniquesuffix + ".jpeg");
    },
});

// File filter
const multerFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image")) {
        cb(null, true);
    } else {
        cb(new Error("Unsupported file format"), false);
    }
};

// Multer upload instances
export const uploadPhoto = multer({
    storage: storage,
    fileFilter: multerFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Resizing middleware (specifically for images)
export const eventImgResize = async (req, res, next) => {
    if (!req.file) return next();

    const originalPath = req.file.path;
    const filename = req.file.filename;
    const outputPath = `public/files/images/resized-${filename}`;

    try {
        await sharp(originalPath)
            .resize(800, 800, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .toFormat("jpeg")
            .jpeg({ quality: 90 })
            .toFile(outputPath);

        // Remove original file
        if (fs.existsSync(originalPath)) {
            fs.unlinkSync(originalPath);
        }

        // Update req.file details to point to resized image
        req.file.path = outputPath;
        req.file.filename = `resized-${filename}`;

        next();
    } catch (error) {
        next(error);
    }
};

export default { uploadPhoto, eventImgResize };
