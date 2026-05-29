import {createTransport} from 'nodemailer';

// ── Build transporter based on available env vars ───────────────────
let transporter=null;
let transporterType=null;

function initTransporter()
{
    // Option 1: OAuth2 (preferred for Gmail)
    if (process.env.EMAIL_USER&&process.env.CLIENT_ID&&process.env.CLIENT_SECRET&&process.env.REFRESH_TOKEN)
    {
        transporter=createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: process.env.EMAIL_USER,
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
                refreshToken: process.env.REFRESH_TOKEN,
            },
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            rateDelta: 1000,
            rateLimit: 5,
        });
        transporterType='oauth2';
        console.log('[EMAIL] ✅ OAuth2 transporter configured for', process.env.EMAIL_USER);
    }
    // Option 2: Simple SMTP (app password)
    else if (process.env.MAIL_USERNAME&&process.env.MAIL_PASSWORD)
    {
        transporter=createTransport({
            host: process.env.MAIL_SERVER||'smtp.gmail.com',
            port: parseInt(process.env.MAIL_PORT||'587', 10),
            secure: false,
            auth: {
                user: process.env.MAIL_USERNAME,
                pass: process.env.MAIL_PASSWORD,
            },
        });
        transporterType='smtp';
        console.log('[EMAIL] ✅ SMTP transporter configured for', process.env.MAIL_USERNAME);
    }
    else
    {
        console.warn('[EMAIL] ⚠️ No email credentials configured. OTPs will be logged to console.');
        console.warn('[EMAIL]   Set EMAIL_USER + CLIENT_ID + CLIENT_SECRET + REFRESH_TOKEN for OAuth2');
        console.warn('[EMAIL]   Or set MAIL_USERNAME + MAIL_PASSWORD for simple SMTP');
    }

    // Verify connection if configured
    if (transporter)
    {
        transporter.verify((err) =>
        {
            if (err)
            {
                console.error('[EMAIL] ❌ Transporter verification failed:', err.message);
            }
            else
            {
                console.log('[EMAIL] ✅ Email server is ready to send messages');
            }
        });
    }
}

// Initialize on module load
initTransporter();

// ── Send email with retry ───────────────────────────────────────────
async function sendEmail(to, subject, text, html, retryCount=3)
{
    if (!transporter)
    {
        console.debug(`[EMAIL] No transporter — would have sent to ${to}: "${subject}"`);
        return {success: false, reason: 'no-transporter'};
    }

    // Input validation
    if (!to||!subject||(!text&&!html))
    {
        throw new Error('Missing required email parameters: to, subject, and either text or html');
    }

    const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const addresses=Array.isArray(to)? to:[to];
    const invalid=addresses.filter(e => !emailRegex.test(e));
    if (invalid.length>0)
    {
        throw new Error(`Invalid email address(es): ${invalid.join(', ')}`);
    }

    const fromAddress=process.env.EMAIL_USER||process.env.MAIL_USERNAME;

    for (let attempt=1;attempt<=retryCount;attempt++)
    {
        try
        {
            const info=await transporter.sendMail({
                from: `"EDU-AI" <${fromAddress}>`,
                to: addresses.join(', '),
                subject,
                text,
                html,
            });

            console.log(`[EMAIL] Sent (attempt ${attempt}): ${info.messageId}`);
            return {success: true, messageId: info.messageId};
        }
        catch (error)
        {
            console.error(`[EMAIL] Attempt ${attempt} failed:`, error.message);

            if (attempt===retryCount)
            {
                throw new Error(`Failed to send email after ${retryCount} attempts: ${error.message}`);
            }

            // Exponential backoff
            await new Promise(r => setTimeout(r, Math.pow(2, attempt)*1000));
        }
    }
}

export function isEmailConfigured()
{
    return transporter!==null;
}

export default sendEmail;
