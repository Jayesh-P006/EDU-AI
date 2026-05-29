import dotenv from 'dotenv';
import {fileURLToPath} from 'url';
import path from 'path';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

// Load environment variables FIRST before anything else
dotenv.config({path: path.join(__dirname, '.env')});

// Validate critical environment variables
const REQUIRED_ENV_VARS=[
    'GROQ_API_KEY',
    'MONGODB_URI',
    'PINECONE_FACE_API_KEY',
    'PINECONE_FACE_INDEX',
];

for (const envVar of REQUIRED_ENV_VARS)
{
    if (!process.env[envVar])
    {
        console.error(`❌ CRITICAL: Missing required environment variable: ${envVar}`);
        console.error('   Please set all required variables in .env file before starting the server.');
        process.exit(1);
    }
}

console.log('✅ All critical environment variables validated');

// Warn (don't crash) if Cloudinary is not configured
if (!process.env.CLOUDINARY_CLOUD_NAME||!process.env.CLOUDINARY_API_KEY||!process.env.CLOUDINARY_API_SECRET)
{
    console.warn('⚠️  Cloudinary env vars not set – resume uploads will be disabled');
}

export default {
    PORT: process.env.PORT||5000,
    FRONTEND_URL: process.env.FRONTEND_URL||'http://localhost:5173',
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    // Cloudinary (resume storage)
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME||'',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY||'',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET||'',
    // AI Calling (Twilio + Python server)
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID||'',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN||'',
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER||'',
    NGROK_URL: process.env.NGROK_URL||'',
    AI_CALLING_URL: process.env.AI_CALLING_URL||'http://localhost:8000',
};
