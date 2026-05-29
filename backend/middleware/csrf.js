import crypto from 'crypto';

/**
 * CSRF Protection Middleware
 * Prevents Cross-Site Request Forgery attacks
 */

const csrfTokenStore=new Map(); // In production, use Redis

/**
 * Generate CSRF token for a session
 */
export function generateCSRFToken(sessionId)
{
    const token=crypto.randomBytes(32).toString('hex');
    csrfTokenStore.set(sessionId, {
        token,
        createdAt: Date.now(),
    });
    return token;
}

/**
 * Middleware to generate and provide CSRF token
 * Use on GET endpoints that render forms
 */
export function csrfTokenMiddleware(req, res, next)
{
    const sessionId=req.user?.id||req.ip;
    const token=generateCSRFToken(sessionId);

    // Attach token to request for use in responses
    res.locals.csrfToken=token;
    req.csrfToken=token;

    next();
}

/**
 * Middleware to verify CSRF token on state-changing requests
 * Use on POST, PUT, DELETE, PATCH endpoints
 */
export function verifyCSRFToken(req, res, next)
{
    // Skip verification for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method))
    {
        return next();
    }

    // Skip verification for endpoints that don't need it
    const skipPaths=['/api/auth/login', '/api/auth/register'];
    if (skipPaths.some(path => req.path.startsWith(path)))
    {
        return next();
    }

    const sessionId=req.user?.id||req.ip;
    const token=req.body._csrf||req.headers['x-csrf-token'];

    if (!token)
    {
        console.warn('[CSRF] Missing CSRF token from', req.path);
        return res.status(403).json({
            success: false,
            error: 'CSRF token missing',
        });
    }

    const stored=csrfTokenStore.get(sessionId);

    if (!stored)
    {
        console.warn('[CSRF] No CSRF token stored for session', sessionId);
        return res.status(403).json({
            success: false,
            error: 'CSRF token invalid or expired',
        });
    }

    // Check if token matches
    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(stored.token)))
    {
        console.warn('[CSRF] CSRF token mismatch for', req.path);
        return res.status(403).json({
            success: false,
            error: 'CSRF token invalid',
        });
    }

    // Check if token has expired (1 hour TTL)
    const tokenAge=Date.now()-stored.createdAt;
    if (tokenAge>60*60*1000)
    {
        console.warn('[CSRF] CSRF token expired');
        csrfTokenStore.delete(sessionId);
        return res.status(403).json({
            success: false,
            error: 'CSRF token expired',
        });
    }

    // Token is valid, regenerate for next request
    const newToken=generateCSRFToken(sessionId);
    res.locals.csrfToken=newToken;

    next();
}

/**
 * Cleanup expired CSRF tokens periodically
 */
setInterval(() =>
{
    const now=Date.now();
    const maxAge=60*60*1000; // 1 hour

    for (const [key, value] of csrfTokenStore.entries())
    {
        if (now-value.createdAt>maxAge)
        {
            csrfTokenStore.delete(key);
        }
    }
}, 10*60*1000); // Cleanup every 10 minutes
