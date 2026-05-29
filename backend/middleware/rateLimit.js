/**
 * Simple rate limiting middleware using in-memory store
 * For production, use Redis with rate-limit package
 */

const rateLimitStore=new Map();

/**
 * Create a rate limiter middleware
 * @param {Object} options - { windowMs, maxRequests }
 */
export function createRateLimiter({
    windowMs=60000, // 1 minute
    maxRequests=100,
    keyGenerator=(req) => req.ip,
    skipSuccessfulRequests=false,
    skipFailedRequests=false,
}={})
{
    return (req, res, next) =>
    {
        const key=keyGenerator(req);
        const now=Date.now();
        const windowStart=now-windowMs;

        // Get or create record for this key
        if (!rateLimitStore.has(key))
        {
            rateLimitStore.set(key, []);
        }

        const timestamps=rateLimitStore.get(key);

        // Remove old timestamps outside the window
        const recentTimestamps=timestamps.filter((t) => t>windowStart);
        rateLimitStore.set(key, recentTimestamps);

        // Check if limit exceeded
        if (recentTimestamps.length>=maxRequests)
        {
            console.warn(`[RATE-LIMIT] Too many requests from ${key}`);
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil((Math.min(...recentTimestamps)+windowMs-now)/1000),
            });
        }

        // Add current timestamp
        recentTimestamps.push(now);
        rateLimitStore.set(key, recentTimestamps);

        // Attach rate limit info to response headers
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', maxRequests-recentTimestamps.length);
        res.setHeader('X-RateLimit-Reset', new Date(Math.min(...recentTimestamps)+windowMs).toISOString());

        next();
    };
}

/**
 * Specific rate limiters for different endpoints
 */

// Auth endpoints - stricter limit to prevent brute force
export const authRateLimiter=createRateLimiter({
    windowMs: 15*60*1000, // 15 minutes
    maxRequests: 15,
    keyGenerator: (req) => `${req.ip}:${req.baseUrl||req.path}`,
});

// API endpoints - moderate limit
export const apiRateLimiter=createRateLimiter({
    windowMs: 60*1000, // 1 minute
    maxRequests: 100,
});

// AI endpoints - moderate limit (needs headroom for active interview sessions)
export const aiRateLimiter=createRateLimiter({
    windowMs: 60*1000, // 1 minute
    maxRequests: 30,
});

// Code execution endpoints - strict limit for security
export const codeExecutionRateLimiter=createRateLimiter({
    windowMs: 60*1000, // 1 minute
    maxRequests: 20,
});

/**
 * Cleanup expired rate limit records periodically
 */
setInterval(() =>
{
    const now=Date.now();
    const windowMs=60*60*1000; // 1 hour

    for (const [key, timestamps] of rateLimitStore.entries())
    {
        const recentTimestamps=timestamps.filter((t) => t>now-windowMs);
        if (recentTimestamps.length===0)
        {
            rateLimitStore.delete(key);
        } else
        {
            rateLimitStore.set(key, recentTimestamps);
        }
    }
}, 10*60*1000); // Cleanup every 10 minutes
