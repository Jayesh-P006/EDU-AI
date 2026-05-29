import {v2 as cloudinary} from 'cloudinary';

// Configure Cloudinary from env vars
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {object} options - Upload options
 * @param {string} options.folder - Cloudinary folder (default: 'resumes')
 * @param {string} options.publicId - Custom public ID
 * @param {string} options.resourceType - Resource type (default: 'raw' for PDFs)
 * @returns {Promise<{url: string, publicId: string, secureUrl: string}>}
 */
export const uploadToCloudinary=(fileBuffer, options={}) =>
{
    return new Promise((resolve, reject) =>
    {
        const uploadOptions={
            folder: options.folder||'hirespec-resumes',
            resource_type: options.resourceType||'raw',
            ...(options.publicId&&{public_id: options.publicId}),
        };

        const uploadStream=cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) =>
            {
                if (error)
                {
                    console.error('[CLOUDINARY] Upload error:', error.message);
                    return reject(error);
                }
                resolve({
                    url: result.url,
                    secureUrl: result.secure_url,
                    publicId: result.public_id,
                });
            }
        );

        uploadStream.end(fileBuffer);
    });
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - The public ID of the file
 * @param {string} resourceType - Resource type (default: 'raw')
 */
export const deleteFromCloudinary=async (publicId, resourceType='raw') =>
{
    try
    {
        await cloudinary.uploader.destroy(publicId, {resource_type: resourceType});
        console.log(`[CLOUDINARY] Deleted: ${publicId}`);
    } catch (err)
    {
        console.error('[CLOUDINARY] Delete error:', err.message);
    }
};

export default cloudinary;
