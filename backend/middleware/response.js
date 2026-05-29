/**
 * Standardized API Response Helper
 * Ensures consistent response format across all endpoints
 */

export class APIResponse
{
    /**
     * Send success response
     */
    static success(res, data, message='Success', statusCode=200)
    {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Send paginated response
     */
    static paginated(res, data, page, limit, total, message='Success', statusCode=200)
    {
        const totalPages=Math.ceil(total/limit);
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNextPage: page<totalPages,
                hasPrevPage: page>1,
            },
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Send error response
     */
    static error(res, error, statusCode=400, details=null)
    {
        const response={
            success: false,
            error: error instanceof Error? error.message:error,
            statusCode,
            timestamp: new Date().toISOString(),
        };

        if (details)
        {
            response.details=details;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Send validation error response
     */
    static validationError(res, details)
    {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            statusCode: 400,
            details,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Send not found response
     */
    static notFound(res, resource='Resource')
    {
        return res.status(404).json({
            success: false,
            error: `${resource} not found`,
            statusCode: 404,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Send unauthorized response
     */
    static unauthorized(res, message='Unauthorized')
    {
        return res.status(401).json({
            success: false,
            error: message,
            statusCode: 401,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Send forbidden response
     */
    static forbidden(res, message='Forbidden')
    {
        return res.status(403).json({
            success: false,
            error: message,
            statusCode: 403,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Send server error response
     */
    static serverError(res, error='Internal server error', details=null)
    {
        console.error('[SERVER-ERROR]', error);
        const response={
            success: false,
            error: error instanceof Error? error.message:error,
            statusCode: 500,
            timestamp: new Date().toISOString(),
        };

        if (details&&process.env.NODE_ENV==='development')
        {
            response.details=details;
        }

        return res.status(500).json(response);
    }

    /**
     * Send conflict response (e.g., resource already exists)
     */
    static conflict(res, message='Resource already exists')
    {
        return res.status(409).json({
            success: false,
            error: message,
            statusCode: 409,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Send rate limit response
     */
    static rateLimitExceeded(res, retryAfter)
    {
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({
            success: false,
            error: 'Too many requests. Please try again later.',
            statusCode: 429,
            retryAfter,
            timestamp: new Date().toISOString(),
        });
    }
}

/**
 * Middleware to attach response helper to all responses
 */
export function responseHelperMiddleware(req, res, next)
{
    res.apiResponse=APIResponse;
    next();
}
