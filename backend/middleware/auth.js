import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET=process.env.JWT_SECRET||'dev-secret-key-change-in-production';

/**
 * Middleware to verify JWT token from headers or cookies
 * Extracts user information and attaches to req.user
 */
export function verifyAuth(req, res, next)
{
    try
    {
        // Get token from Authorization header or cookies
        const authHeader=req.headers.authorization;
        let token=null;

        if (authHeader&&authHeader.startsWith('Bearer '))
        {
            token=authHeader.substring(7);
        } else if (req.cookies&&req.cookies.authToken)
        {
            token=req.cookies.authToken;
        }

        if (!token)
        {
            return res.status(401).json({
                success: false,
                error: 'Authentication required. Please provide a valid token.',
            });
        }

        // Verify JWT token
        const decoded=jwt.verify(token, JWT_SECRET);
        req.user=decoded;
        next();
    } catch (err)
    {
        console.error('[AUTH-MIDDLEWARE] Token verification failed:', err.message);
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token. Please login again.',
        });
    }
}

/**
 * Middleware to verify optional auth (doesn't fail if no token)
 * Useful for endpoints that work with or without auth
 */
export function verifyAuthOptional(req, res, next)
{
    try
    {
        const authHeader=req.headers.authorization;
        let token=null;

        if (authHeader&&authHeader.startsWith('Bearer '))
        {
            token=authHeader.substring(7);
        } else if (req.cookies&&req.cookies.authToken)
        {
            token=req.cookies.authToken;
        }

        if (token)
        {
            const decoded=jwt.verify(token, JWT_SECRET);
            req.user=decoded;
        }
        next();
    } catch (err)
    {
        // Fail silently for optional auth
        console.debug('[AUTH-MIDDLEWARE] Optional auth failed:', err.message);
        next();
    }
}

/**
 * Middleware to verify role-based access
 */
export function verifyRole(...allowedRoles)
{
    return async (req, res, next) =>
    {
        if (!req.user)
        {
            console.log('[VERIFY-ROLE] req.user is missing');
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }

        try
        {
            console.log('[VERIFY-ROLE] Allowed:', allowedRoles, 'User ID:', req.user.userId || req.user.id);
            const user = await User.findById(req.user.userId || req.user.id).select('role');
            console.log('[VERIFY-ROLE] Database User role:', user?.role);
            if (!user || !allowedRoles.includes(user.role))
            {
                console.log('[VERIFY-ROLE] Access Denied: User role is', user?.role, 'but needs', allowedRoles);
                return res.status(403).json({
                    success: false,
                    error: `Access denied. Required role: ${allowedRoles.join(', ')}`,
                });
            }
            req.user.role = user.role;
            next();
        } catch (err)
        {
            console.error('[VERIFY-ROLE] error:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to verify user role',
            });
        }
    };
}
