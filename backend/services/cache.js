import redis from 'redis';
import {logger} from './logging.js';

/**
 * Redis Cache Service
 * Handles session management, caching, and distributed data
 */

let redisClient=null;
let isConnected=false;

/**
 * Initialize Redis connection
 */
export async function initializeRedis(config={})
{
    const {
        host=process.env.REDIS_HOST||'localhost',
        port=process.env.REDIS_PORT||6379,
        password=process.env.REDIS_PASSWORD,
        db=process.env.REDIS_DB||0,
        maxRetries=3,
        retryStrategy=(times) =>
        {
            if (times>maxRetries)
            {
                logger.warn('[REDIS] Max reconnect attempts reached, giving up');
                return false; // Stop retrying
            }
            return Math.min(times*500, 3000);
        },
    }=config;

    let errorLogged=false;

    try
    {
        redisClient=redis.createClient({
            host,
            port,
            password,
            db,
            socket: {
                reconnectStrategy: retryStrategy,
                connectTimeout: 5000,
            },
        });

        // Handle connection events
        redisClient.on('connect', () =>
        {
            isConnected=true;
            errorLogged=false;
            logger.info('[REDIS] Connected', {host, port, db});
        });

        redisClient.on('error', (err) =>
        {
            if (!errorLogged)
            {
                logger.error('[REDIS] Connection error:', {error: err.message});
                errorLogged=true;
            }
        });

        redisClient.on('disconnect', () =>
        {
            isConnected=false;
            logger.warn('[REDIS] Disconnected');
        });

        await redisClient.connect();
        return redisClient;
    } catch (error)
    {
        logger.error('[REDIS] Failed to initialize:', {error: error.message});
        throw error;
    }
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected()
{
    return isConnected&&redisClient!==null;
}

/**
 * Set cache value with TTL
 */
export async function setCacheValue(key, value, ttlSeconds=3600)
{
    if (!isRedisConnected())
    {
        logger.warn('[CACHE] Redis not connected, skipping cache set');
        return;
    }

    try
    {
        const serialized=JSON.stringify(value);
        await redisClient.setEx(key, ttlSeconds, serialized);
        logger.debug('[CACHE] Set', {key, ttl: ttlSeconds});
    } catch (error)
    {
        logger.error('[CACHE] Set failed:', {key, error: error.message});
    }
}

/**
 * Get cache value
 */
export async function getCacheValue(key)
{
    if (!isRedisConnected())
    {
        return null;
    }

    try
    {
        const value=await redisClient.get(key);
        if (!value) return null;

        const parsed=JSON.parse(value);
        logger.debug('[CACHE] Get hit', {key});
        return parsed;
    } catch (error)
    {
        logger.error('[CACHE] Get failed:', {key, error: error.message});
        return null;
    }
}

/**
 * Delete cache value
 */
export async function deleteCacheValue(key)
{
    if (!isRedisConnected()) return;

    try
    {
        await redisClient.del(key);
        logger.debug('[CACHE] Deleted', {key});
    } catch (error)
    {
        logger.error('[CACHE] Delete failed:', {key, error: error.message});
    }
}

/**
 * Clear cache by pattern
 */
export async function clearCachePattern(pattern)
{
    if (!isRedisConnected()) return;

    try
    {
        const keys=await redisClient.keys(pattern);
        if (keys.length>0)
        {
            await redisClient.del(keys);
            logger.info('[CACHE] Cleared pattern', {pattern, deletedCount: keys.length});
        }
    } catch (error)
    {
        logger.error('[CACHE] Clear pattern failed:', {pattern, error: error.message});
    }
}

/**
 * Store session data
 */
export async function storeSession(sessionId, data, ttlSeconds=86400)
{
    const key=`session:${sessionId}`;
    await setCacheValue(key, data, ttlSeconds);
}

/**
 * Retrieve session data
 */
export async function retrieveSession(sessionId)
{
    const key=`session:${sessionId}`;
    return await getCacheValue(key);
}

/**
 * Delete session
 */
export async function deleteSession(sessionId)
{
    const key=`session:${sessionId}`;
    await deleteCacheValue(key);
}

/**
 * Store user authentication token
 */
export async function storeAuthToken(userId, token, ttlSeconds=86400)
{
    const key=`auth:${userId}:${token.substring(0, 10)}`;
    await setCacheValue(key, {userId, token, createdAt: Date.now()}, ttlSeconds);
}

/**
 * Verify authentication token exists
 */
export async function verifyAuthToken(userId, token)
{
    const key=`auth:${userId}:${token.substring(0, 10)}`;
    const stored=await getCacheValue(key);
    return stored&&stored.token===token;
}

/**
 * Store rate limit counter
 */
export async function incrementRateLimit(key, limit=100, windowSeconds=60)
{
    if (!isRedisConnected())
    {
        return {count: 0, remaining: limit};
    }

    try
    {
        const count=await redisClient.incr(key);

        if (count===1)
        {
            await redisClient.expire(key, windowSeconds);
        }

        const ttl=await redisClient.ttl(key);
        const remaining=Math.max(0, limit-count);

        return {
            count,
            remaining,
            resetAt: new Date(Date.now()+ttl*1000).toISOString(),
        };
    } catch (error)
    {
        logger.error('[RATE-LIMIT] Increment failed:', {key, error: error.message});
        return {count: 0, remaining: limit};
    }
}

/**
 * Get rate limit status
 */
export async function getRateLimitStatus(key, limit=100)
{
    if (!isRedisConnected())
    {
        return {count: 0, remaining: limit, resetAt: null};
    }

    try
    {
        const count=await redisClient.get(key);
        const ttl=await redisClient.ttl(key);

        const current=parseInt(count)||0;
        const remaining=Math.max(0, limit-current);

        return {
            count: current,
            remaining,
            resetAt: ttl>0? new Date(Date.now()+ttl*1000).toISOString():null,
        };
    } catch (error)
    {
        logger.error('[RATE-LIMIT] Get status failed:', {key, error: error.message});
        return {count: 0, remaining: limit, resetAt: null};
    }
}

/**
 * Distributed lock for concurrent operations
 */
export async function acquireLock(lockKey, lockValue, ttlSeconds=10)
{
    if (!isRedisConnected())
    {
        return false;
    }

    try
    {
        const result=await redisClient.set(
            lockKey,
            lockValue,
            {NX: true, EX: ttlSeconds}
        );

        if (result==='OK')
        {
            logger.debug('[LOCK] Acquired', {lockKey});
            return true;
        }

        return false;
    } catch (error)
    {
        logger.error('[LOCK] Acquire failed:', {lockKey, error: error.message});
        return false;
    }
}

/**
 * Release distributed lock
 */
export async function releaseLock(lockKey, lockValue)
{
    if (!isRedisConnected())
    {
        return false;
    }

    try
    {
        // Use Lua script to ensure atomic delete
        const script=`
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

        const result=await redisClient.eval(script, {
            keys: [lockKey],
            arguments: [lockValue],
        });

        if (result===1)
        {
            logger.debug('[LOCK] Released', {lockKey});
            return true;
        }

        return false;
    } catch (error)
    {
        logger.error('[LOCK] Release failed:', {lockKey, error: error.message});
        return false;
    }
}

/**
 * Store temporary data (OTP, verification codes, etc.)
 */
export async function storeTemporaryData(key, data, ttlSeconds)
{
    await setCacheValue(`temp:${key}`, data, ttlSeconds);
}

/**
 * Retrieve and delete temporary data (one-time use)
 */
export async function retrieveTemporaryData(key)
{
    const cacheKey=`temp:${key}`;
    const data=await getCacheValue(cacheKey);
    if (data)
    {
        await deleteCacheValue(cacheKey);
    }
    return data;
}

/**
 * Get Redis client instance
 */
export function getRedisClient()
{
    return redisClient;
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis()
{
    if (redisClient&&isConnected)
    {
        try
        {
            await redisClient.disconnect();
            isConnected=false;
            logger.info('[REDIS] Disconnected');
        } catch (error)
        {
            logger.error('[REDIS] Disconnect failed:', {error: error.message});
        }
    }
}

/**
 * Get Redis stats
 */
export async function getRedisStats()
{
    if (!isRedisConnected())
    {
        return {connected: false};
    }

    try
    {
        const info=await redisClient.info('stats');
        const dbSize=await redisClient.dbSize();

        return {
            connected: true,
            info: info,
            dbSize,
            timestamp: new Date().toISOString(),
        };
    } catch (error)
    {
        logger.error('[REDIS] Get stats failed:', {error: error.message});
        return {connected: false, error: error.message};
    }
}

export default {
    initializeRedis,
    isRedisConnected,
    setCacheValue,
    getCacheValue,
    deleteCacheValue,
    clearCachePattern,
    storeSession,
    retrieveSession,
    deleteSession,
    storeAuthToken,
    verifyAuthToken,
    incrementRateLimit,
    getRateLimitStatus,
    acquireLock,
    releaseLock,
    storeTemporaryData,
    retrieveTemporaryData,
    getRedisClient,
    disconnectRedis,
    getRedisStats,
};
