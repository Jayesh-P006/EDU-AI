/**
 * Structured logging utilities
 * Provides console-based logging with structured format
 * (In production, integrate with Winston or Pino)
 */

const LOG_LEVELS={
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
};

function formatTimestamp()
{
    return new Date().toISOString();
}

function createLogEntry(level, module, message, data=null)
{
    const entry={
        timestamp: formatTimestamp(),
        level,
        module,
        message,
    };

    if (data)
    {
        entry.data=data;
    }

    return entry;
}

function logToConsole(level, entry)
{
    const prefix=`[${entry.timestamp}] [${entry.level}] [${entry.module}]`;
    const message=`${prefix} ${entry.message}`;

    // Don't log data in production for sensitive operations
    const isDev=process.env.NODE_ENV!=='production';

    if (isDev&&entry.data)
    {
        // Sanitize sensitive fields
        const sanitizedData={...entry.data};
        const sensitiveFields=['password', 'otp', 'token', 'apiKey', 'secret', 'descriptor', 'face'];
        Object.keys(sanitizedData).forEach((key) =>
        {
            if (sensitiveFields.some((field) => key.toLowerCase().includes(field)))
            {
                sanitizedData[key]='[REDACTED]';
            }
        });

        if (level==='ERROR')
        {
            console.error(message, sanitizedData);
        } else if (level==='WARN')
        {
            console.warn(message, sanitizedData);
        } else
        {
            console.log(message, sanitizedData);
        }
    } else
    {
        if (level==='ERROR')
        {
            console.error(message);
        } else if (level==='WARN')
        {
            console.warn(message);
        } else
        {
            console.log(message);
        }
    }
}

/**
 * Logger instance for modules
 */
export function createLogger(moduleName)
{
    return {
        debug(message, data)
        {
            const entry=createLogEntry(LOG_LEVELS.DEBUG, moduleName, message, data);
            if (process.env.DEBUG||process.env.NODE_ENV!=='production')
            {
                logToConsole(LOG_LEVELS.DEBUG, entry);
            }
        },

        info(message, data)
        {
            const entry=createLogEntry(LOG_LEVELS.INFO, moduleName, message, data);
            logToConsole(LOG_LEVELS.INFO, entry);
        },

        warn(message, data)
        {
            const entry=createLogEntry(LOG_LEVELS.WARN, moduleName, message, data);
            logToConsole(LOG_LEVELS.WARN, entry);
        },

        error(message, data)
        {
            const entry=createLogEntry(LOG_LEVELS.ERROR, moduleName, message, data);
            logToConsole(LOG_LEVELS.ERROR, entry);
        },
    };
}

/**
 * Express middleware for request logging
 */
export function requestLoggingMiddleware(req, res, next)
{
    const logger=createLogger('HTTP');
    const startTime=Date.now();

    // Log request
    logger.debug(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });

    // Log response
    const originalSend=res.send;
    res.send=function (data)
    {
        const duration=Date.now()-startTime;
        logger.info(`${req.method} ${req.path} - ${res.statusCode}`, {
            duration: `${duration}ms`,
            status: res.statusCode,
        });
        return originalSend.call(this, data);
    };

    next();
}

/**
 * Error logging middleware
 */
export function errorLoggingMiddleware(err, req, res, next)
{
    const logger=createLogger('ERROR');

    logger.error(`${req.method} ${req.path}`, {
        errorMessage: err.message,
        errorStack: err.stack,
        statusCode: err.statusCode||500,
    });

    next(err);
}
