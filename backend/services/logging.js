import winston from 'winston';
import Sentry from '@sentry/node';
import path from 'path';
import fs from 'fs';

/**
 * Enhanced logging infrastructure with Winston and Sentry
 * Provides structured logging, error tracking, and performance monitoring
 */

// Ensure logs directory exists
const logsDir=path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir))
{
    fs.mkdirSync(logsDir, {recursive: true});
}

/**
 * Custom log format for better readability
 */
const customFormat=winston.format.combine(
    winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
    winston.format.errors({stack: true}),
    winston.format.printf(({level, message, timestamp, ...meta}) =>
    {
        const metaStr=Object.keys(meta).length? JSON.stringify(meta, null, 2):'';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr? '\n'+metaStr:''}`;
    })
);

/**
 * Initialize Sentry for error tracking
 */
export function initializeSentry(dsn)
{
    if (!dsn)
    {
        console.warn('[SENTRY] DSN not provided, error tracking disabled');
        return null;
    }

    try
    {
        Sentry.init({
            dsn,
            tracesSampleRate: 0.1, // 10% of transactions
            environment: process.env.NODE_ENV||'development',
            integrations: [
                new Sentry.Integrations.Http({tracing: true}),
                new Sentry.Integrations.OnUncaughtException(),
                new Sentry.Integrations.OnUnhandledRejection(),
            ],
        });

        console.log('[SENTRY] Initialized successfully');
        return Sentry;
    } catch (error)
    {
        console.error('[SENTRY] Initialization failed:', error);
        return null;
    }
}

/**
 * Create logger instance with Winston
 */
export function createLogger(serviceName='app')
{
    return winston.createLogger({
        level: process.env.LOG_LEVEL||'info',
        format: customFormat,
        defaultMeta: {service: serviceName},
        transports: [
            // Console output
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    customFormat
                ),
            }),

            // File output for all logs
            new winston.transports.File({
                filename: path.join(logsDir, 'app.log'),
                maxsize: 5242880, // 5MB
                maxFiles: 5,
            }),

            // Separate file for errors
            new winston.transports.File({
                filename: path.join(logsDir, 'error.log'),
                level: 'error',
                maxsize: 5242880,
                maxFiles: 10,
            }),

            // Separate file for warnings
            new winston.transports.File({
                filename: path.join(logsDir, 'warn.log'),
                level: 'warn',
                maxsize: 5242880,
                maxFiles: 5,
            }),
        ],
    });
}

/**
 * Global logger instance
 */
export const logger=createLogger('app');

/**
 * Log levels with severity
 */
export const logLevels={
    DEBUG: 'debug',      // Detailed debugging information
    INFO: 'info',        // General informational messages
    WARN: 'warn',        // Warning conditions
    ERROR: 'error',      // Error conditions
    FATAL: 'error',      // Fatal errors (logged as error with severity flag)
};

/**
 * Log with additional context
 */
export function logWithContext(level, message, context={})
{
    logger[level](message, {
        ...context,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Log API request
 */
export function logRequest(req, res, responseTime)
{
    const {method, url, headers, ip}=req;
    const {statusCode}=res;

    const context={
        method,
        url,
        statusCode,
        responseTime: `${responseTime}ms`,
        userAgent: headers['user-agent'],
        ip,
        userId: req.user?.id||'anonymous',
    };

    const level=statusCode>=400? 'warn':'info';
    logWithContext(level, `[API] ${method} ${url}`, context);
}

/**
 * Log authentication event
 */
export function logAuthEvent(eventType, email, details={})
{
    const timestamp=new Date().toISOString();

    logWithContext('info', `[AUTH] ${eventType}`, {
        event: eventType,
        email,
        timestamp,
        ...details,
    });

    // Also send to Sentry for important auth events
    if (['LOGIN_FAILED', 'SUSPICIOUS_ACTIVITY', 'TOKEN_INVALID'].includes(eventType))
    {
        Sentry?.captureMessage(`Authentication Event: ${eventType}`, 'warning');
    }
}

/**
 * Log performance metric
 */
export function logPerformance(operation, durationMs, metadata={})
{
    const level=durationMs>1000? 'warn':'info';

    logWithContext(level, `[PERFORMANCE] ${operation}`, {
        operation,
        durationMs,
        ...metadata,
    });
}

/**
 * Log database operation
 */
export function logDatabaseOperation(operation, collection, durationMs, success=true)
{
    logWithContext('info', `[DATABASE] ${operation} on ${collection}`, {
        operation,
        collection,
        durationMs,
        success,
    });
}

/**
 * Log error with full context
 */
export function logError(error, context={})
{
    logger.error(error.message||error, {
        ...context,
        stack: error.stack,
        timestamp: new Date().toISOString(),
    });

    // Send to Sentry for critical errors
    if (context.severity==='critical'||error.name==='FatalError')
    {
        Sentry?.captureException(error, {
            contexts: {app: context},
        });
    }
}

/**
 * Express middleware for request logging
 */
export function requestLoggingMiddleware(req, res, next)
{
    const startTime=Date.now();

    // Capture the original res.json function
    const originalJson=res.json;
    res.json=function (data)
    {
        const responseTime=Date.now()-startTime;
        logRequest(req, res, responseTime);
        return originalJson.call(this, data);
    };

    next();
}

/**
 * Express middleware for error logging
 */
export function errorLoggingMiddleware(err, req, res, next)
{
    logError(err, {
        url: req.url,
        method: req.method,
        userId: req.user?.id,
        ip: req.ip,
        severity: err.statusCode>=500? 'high':'medium',
    });

    // Report to Sentry
    if (err.statusCode===500)
    {
        Sentry?.captureException(err, {
            tags: {type: 'unhandled_error'},
            contexts: {
                request: {
                    method: req.method,
                    url: req.url,
                },
            },
        });
    }

    next(err);
}

/**
 * Performance monitoring decorator for async functions
 */
export function withPerformanceLogging(operationName)
{
    return (target, propertyKey, descriptor) =>
    {
        const originalMethod=descriptor.value;

        descriptor.value=async function (...args)
        {
            const startTime=Date.now();

            try
            {
                const result=await originalMethod.apply(this, args);
                const duration=Date.now()-startTime;
                logPerformance(operationName, duration, {success: true});
                return result;
            } catch (error)
            {
                const duration=Date.now()-startTime;
                logPerformance(operationName, duration, {success: false, error: error.message});
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Structured error handler
 */
export class StructuredError extends Error
{
    constructor(message, details={})
    {
        super(message);
        this.name=this.constructor.name;
        this.timestamp=new Date().toISOString();
        this.details=details;
    }
}

/**
 * API Request Error
 */
export class APIError extends StructuredError
{
    constructor(message, statusCode=400, details={})
    {
        super(message, details);
        this.statusCode=statusCode;
    }
}

/**
 * Authorization Error
 */
export class AuthenticationError extends APIError
{
    constructor(message='Authentication failed', details={})
    {
        super(message, 401, details);
    }
}

/**
 * Authorization Error
 */
export class AuthorizationError extends APIError
{
    constructor(message='Access denied', details={})
    {
        super(message, 403, details);
    }
}

/**
 * Validation Error
 */
export class ValidationError extends APIError
{
    constructor(message, validationDetails={})
    {
        super(message, 422, {validationDetails});
    }
}

/**
 * Resource Not Found Error
 */
export class NotFoundError extends APIError
{
    constructor(resource='Resource', details={})
    {
        super(`${resource} not found`, 404, details);
    }
}

/**
 * Database Error
 */
export class DatabaseError extends StructuredError
{
    constructor(message, operation='unknown', details={})
    {
        super(message, {operation, ...details});
        this.statusCode=500;
    }
}

/**
 * Log initialization
 */
export function initializeLogging(config={})
{
    const {
        level='info',
        sentryDsn=process.env.SENTRY_DSN,
        serviceName='app',
    }=config;

    // Initialize Sentry if DSN is provided
    if (sentryDsn)
    {
        initializeSentry(sentryDsn);
    }

    // Configure Winston
    logger.level=level;

    logger.info('[LOGGING] Initialized', {
        level,
        service: serviceName,
        environment: process.env.NODE_ENV,
    });

    return {logger, Sentry};
}

export default {
    logger,
    logLevels,
    initializeLogging,
    initializeSentry,
    createLogger,
    logWithContext,
    logRequest,
    logAuthEvent,
    logPerformance,
    logDatabaseOperation,
    logError,
    requestLoggingMiddleware,
    errorLoggingMiddleware,
    StructuredError,
    APIError,
    AuthenticationError,
    AuthorizationError,
    ValidationError,
    NotFoundError,
    DatabaseError,
};
