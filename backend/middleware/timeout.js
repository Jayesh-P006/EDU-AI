/**
 * Request timeout middleware
 * Prevents requests from hanging indefinitely
 */

/**
 * Create a timeout middleware
 * @param {number} timeoutMs - Timeout in milliseconds
 */
export function createTimeoutMiddleware(timeoutMs=30000)
{
    return (req, res, next) =>
    {
        // Set socket timeout
        req.socket.setTimeout(timeoutMs);

        // Set response timeout
        const timeoutId=setTimeout(() =>
        {
            if (!res.headersSent)
            {
                console.warn(`[TIMEOUT] Request exceeded ${timeoutMs}ms: ${req.method} ${req.path}`);
                res.status(408).json({
                    success: false,
                    error: 'Request timeout. The server took too long to respond.',
                });
            }
            // Abort the ongoing operation by destroying the socket
            req.socket.destroy();
        }, timeoutMs);

        // Clear timeout if response is sent
        const originalSend=res.send;
        res.send=function (data)
        {
            clearTimeout(timeoutId);
            return originalSend.call(this, data);
        };

        const originalJson=res.json;
        res.json=function (data)
        {
            clearTimeout(timeoutId);
            return originalJson.call(this, data);
        };

        next();
    };
}

/**
 * Default timeout middleware (30 seconds)
 */
export const timeoutMiddleware=createTimeoutMiddleware(30000);

/**
 * Longer timeout for AI endpoints (120 seconds)
 */
export const aiTimeoutMiddleware=createTimeoutMiddleware(120000);

/**
 * Shorter timeout for quick endpoints (10 seconds)
 */
export const quickTimeoutMiddleware=createTimeoutMiddleware(10000);
