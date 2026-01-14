import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import logger from './logger.js';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.SECRET_KEY,
});

/**
 * Upload a file to Cloudinary
 * @param {string} fileToUpload - Path to the file or data URI
 * @param {string} resourceType - Type of resource (image, video, raw, auto)
 * @returns {Promise<Object>} - Cloudinary upload result
 */
export const cloudinaryUpload = async (fileToUpload, resourceType) => {
    return new Promise((resolve, reject) => {
        const uploadOptions = {
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true,
        };

        cloudinary.uploader.upload(
            fileToUpload,
            uploadOptions,
            (error, result) => {
                if (error) {
                    logger.error('Cloudinary upload error:', error);
                    reject(error);
                } else {
                    resolve({
                        url: result.secure_url,
                        asset_id: result.asset_id,
                        public_id: result.public_id,
                        resource_type: result.resource_type,
                    });
                }
            }
        );
    });
};

/**
 * Upload an image to Cloudinary
 */
export const cloudinaryUploadImage = async (fileToUpload) => {
    return cloudinaryUpload(fileToUpload, "image");
};

/**
 * Upload a video to Cloudinary
 */
export const cloudinaryUploadVideo = async (fileToUpload) => {
    return cloudinaryUpload(fileToUpload, "video");
};

/**
 * Upload an audio to Cloudinary
 */
export const cloudinaryUploadAudio = async (fileToUpload) => {
    // Cloudinary uses "video" resource type for audio files
    return cloudinaryUpload(fileToUpload, "video");
};

/**
 * Upload a document (PDF, etc.) to Cloudinary
 */
export const cloudinaryUploadDocument = async (fileToUpload) => {
    return cloudinaryUpload(fileToUpload, "raw");
};

/**
 * Generate a signed URL for accessing private/raw files
 * @param {string} publicId - The public_id of the uploaded file
 * @param {number} expiresIn - Time in seconds until the URL expires (default: 1 hour)
 * @returns {string} - Signed URL
 */
export const generateSignedUrl = (publicId, expiresIn = 3600) => {
    const timestamp = Math.floor(Date.now() / 1000) + expiresIn;
    return cloudinary.url(publicId, {
        resource_type: 'raw',
        type: 'upload',
        sign_url: true,
        secure: true,
        expires_at: timestamp
    });
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - The public_id of the file to delete
 * @param {string} resourceType - Type of resource
 */
export const cloudinaryDelete = async (publicId, resourceType = 'image') => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (error, result) => {
            if (error) {
                logger.error('Cloudinary delete error:', error);
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
};

export default {
    cloudinaryUpload,
    cloudinaryUploadImage,
    cloudinaryUploadVideo,
    cloudinaryUploadAudio,
    cloudinaryUploadDocument,
    generateSignedUrl,
    cloudinaryDelete
};
