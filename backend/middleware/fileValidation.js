import path from 'path';
import fs from 'fs';

/**
 * File upload validation middleware
 * Validates file size, type, and content
 */

// Allowed file types with their MIME types and signatures
const ALLOWED_FILE_TYPES={
    pdf: {
        mimes: ['application/pdf'],
        extensions: ['.pdf'],
        signature: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
        maxSize: 5*1024*1024, // 5MB
    },
    docx: {
        mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        extensions: ['.docx'],
        signature: Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP header
        maxSize: 5*1024*1024,
    },
    doc: {
        mimes: ['application/msword'],
        extensions: ['.doc'],
        signature: Buffer.from([0xD0, 0xCF, 0x11, 0xE0]),
        maxSize: 5*1024*1024,
    },
    txt: {
        mimes: ['text/plain'],
        extensions: ['.txt'],
        signature: null, // No specific signature
        maxSize: 2*1024*1024, // 2MB
    },
};

/**
 * Validate file signature (magic bytes)
 */
function validateFileSignature(filePath, fileType)
{
    const config=ALLOWED_FILE_TYPES[fileType];
    if (!config||!config.signature)
    {
        return true; // No signature validation needed
    }

    try
    {
        const fd=fs.openSync(filePath, 'r');
        const buffer=Buffer.alloc(config.signature.length);
        fs.readSync(fd, buffer, 0, config.signature.length, 0);
        fs.closeSync(fd);

        return buffer.equals(config.signature);
    } catch (err)
    {
        console.error('[FILE-VALIDATION] Error reading file signature:', err);
        return false;
    }
}

/**
 * Get file type from extension
 */
function getFileTypeFromExtension(filename)
{
    const ext=path.extname(filename).toLowerCase();
    for (const [type, config] of Object.entries(ALLOWED_FILE_TYPES))
    {
        if (config.extensions.includes(ext))
        {
            return type;
        }
    }
    return null;
}

/**
 * Middleware to validate uploaded files
 */
export function validateFileUpload(fieldName='file', allowedTypes=Object.keys(ALLOWED_FILE_TYPES))
{
    return async (req, res, next) =>
    {
        try
        {
            const file=req.file;

            if (!file)
            {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded',
                });
            }

            const fileType=getFileTypeFromExtension(file.originalname);

            if (!fileType)
            {
                return res.status(400).json({
                    success: false,
                    error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
                });
            }

            if (!allowedTypes.includes(fileType))
            {
                return res.status(400).json({
                    success: false,
                    error: `File type .${fileType} not allowed`,
                });
            }

            const config=ALLOWED_FILE_TYPES[fileType];

            // Check file size
            if (file.size>config.maxSize)
            {
                fs.unlinkSync(file.path); // Delete temp file
                return res.status(400).json({
                    success: false,
                    error: `File exceeds maximum size of ${config.maxSize/(1024*1024)}MB`,
                });
            }

            // Check file size is not 0
            if (file.size===0)
            {
                fs.unlinkSync(file.path);
                return res.status(400).json({
                    success: false,
                    error: 'File is empty',
                });
            }

            // Validate MIME type
            if (!config.mimes.includes(file.mimetype))
            {
                console.warn(`[FILE-VALIDATION] MIME type mismatch: ${file.mimetype} (expected ${config.mimes.join(', ')})`);
                // Don't reject based on MIME alone (can be spoofed)
            }

            // Validate file signature
            if (config.signature)
            {
                const isValidSignature=validateFileSignature(file.path, fileType);
                if (!isValidSignature)
                {
                    fs.unlinkSync(file.path);
                    return res.status(400).json({
                        success: false,
                        error: `File content does not match .${fileType} format`,
                    });
                }
            }

            // Add validated file info to request
            req.validatedFile={
                path: file.path,
                filename: file.filename,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                type: fileType,
            };

            next();
        } catch (err)
        {
            console.error('[FILE-VALIDATION] Error:', err);
            // Clean up uploaded file on error
            if (req.file&&fs.existsSync(req.file.path))
            {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({
                success: false,
                error: 'File validation failed',
            });
        }
    };
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename)
{
    // Remove directory traversal attempts
    let sanitized=path.basename(filename);
    // Remove special characters except dots and hyphens
    sanitized=sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Limit length
    sanitized=sanitized.substring(0, 255);
    return sanitized;
}

/**
 * Generate safe storage filename
 */
export function generateStorageFilename(originalname, userId)
{
    const timestamp=Date.now();
    const random=Math.random().toString(36).substring(2, 8);
    const ext=path.extname(originalname).toLowerCase();
    return `${userId}_${timestamp}_${random}${ext}`;
}
