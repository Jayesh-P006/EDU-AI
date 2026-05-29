import cron from 'node-cron';
import Otp from '../models/Otp.js';
import {logger} from '../services/logging.js';

/**
 * OTP Cleanup Scheduler
 * Periodically removes expired OTPs from database
 * Runs every hour by default
 */

let cleanupJob=null;
let isRunning=false;

/**
 * Cleanup expired OTPs from database
 * Removes OTPs older than TTL (Time To Live)
 */
export async function cleanupExpiredOTPs()
{
    if (isRunning)
    {
        logger.warn('[OTP-CLEANUP] Cleanup already in progress, skipping...');
        return;
    }

    isRunning=true;
    const startTime=Date.now();

    try
    {
        // OTP TTL is typically 10 minutes (600 seconds)
        // But we keep a grace period of 5 minutes for failed verification
        const otpExpiredTime=new Date(Date.now()-15*60*1000); // 15 minutes

        const result=await Otp.deleteMany({
            createdAt: {$lt: otpExpiredTime},
            verified: false, // Only delete unverified OTPs
        });

        const duration=Date.now()-startTime;

        logger.info('[OTP-CLEANUP] Cleanup completed', {
            deletedCount: result.deletedCount,
            durationMs: duration,
            timestamp: new Date().toISOString(),
        });

        return {
            success: true,
            deletedCount: result.deletedCount,
            durationMs: duration,
        };
    } catch (error)
    {
        logger.error('[OTP-CLEANUP] Error during cleanup:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
        });

        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        };
    } finally
    {
        isRunning=false;
    }
}

/**
 * Start OTP cleanup scheduler
 * Runs periodically at specified interval
 * 
 * @param {string} schedule - Cron schedule (default: every hour)
 *                            '0 * * * *' = every hour
 *                            '0 0 * * *' = every day at midnight
 *                            '0 *​/6 * * *' = every 6 hours
 */
export function startOTPCleanupScheduler(schedule='0 * * * *')
{
    if (cleanupJob)
    {
        logger.warn('[OTP-CLEANUP] Scheduler already running');
        return;
    }

    try
    {
        cleanupJob=cron.schedule(schedule, async () =>
        {
            await cleanupExpiredOTPs();
        });

        logger.info('[OTP-CLEANUP] Scheduler started', {
            schedule,
            nextRun: getNextRunTime(schedule),
        });

        // Run cleanup immediately on startup
        cleanupExpiredOTPs().catch(err =>
        {
            logger.error('[OTP-CLEANUP] Initial cleanup failed:', err);
        });
    } catch (error)
    {
        logger.error('[OTP-CLEANUP] Failed to start scheduler:', {
            message: error.message,
            schedule,
        });
        throw error;
    }
}

/**
 * Stop OTP cleanup scheduler
 */
export function stopOTPCleanupScheduler()
{
    if (cleanupJob)
    {
        cleanupJob.stop();
        cleanupJob.destroy();
        cleanupJob=null;
        logger.info('[OTP-CLEANUP] Scheduler stopped');
    }
}

/**
 * Check if scheduler is running
 */
export function isOTPCleanupSchedulerRunning()
{
    return cleanupJob!==null;
}

/**
 * Get next scheduled run time
 */
export function getNextRunTime(schedule)
{
    try
    {
        const CronParser=require('cron-parser');
        const interval=CronParser.parseExpression(schedule);
        return interval.next().toDate();
    } catch (error)
    {
        return null;
    }
}

/**
 * Manual cleanup trigger (for testing/admin endpoints)
 */
export async function triggerOTPCleanup()
{
    logger.info('[OTP-CLEANUP] Manual cleanup triggered');
    return await cleanupExpiredOTPs();
}

/**
 * Cleanup sessions with additional filters
 * Removes OTPs for blocked users or inactive accounts
 */
export async function advancedOTPCleanup()
{
    isRunning=true;
    const startTime=Date.now();

    try
    {
        const expiredTime=new Date(Date.now()-15*60*1000);

        // Delete unverified expired OTPs
        const expiredResult=await Otp.deleteMany({
            createdAt: {$lt: expiredTime},
            verified: false,
        });

        // Delete multiple failed attempts (potential brute force)
        const bruteForceResult=await Otp.deleteMany({
            attempts: {$gte: 5}, // More than 5 failed attempts
            createdAt: {$lt: new Date(Date.now()-1*60*1000)}, // For over 1 minute
        });

        const totalDeleted=expiredResult.deletedCount+bruteForceResult.deletedCount;
        const duration=Date.now()-startTime;

        logger.info('[OTP-CLEANUP] Advanced cleanup completed', {
            expiredCount: expiredResult.deletedCount,
            bruteForceSuspectCount: bruteForceResult.deletedCount,
            totalDeleted,
            durationMs: duration,
        });

        return {
            success: true,
            expiredCount: expiredResult.deletedCount,
            bruteForceSuspectCount: bruteForceResult.deletedCount,
            totalDeleted,
            durationMs: duration,
        };
    } catch (error)
    {
        logger.error('[OTP-CLEANUP] Advanced cleanup error:', error);
        return {
            success: false,
            error: error.message,
        };
    } finally
    {
        isRunning=false;
    }
}

/**
 * Get cleanup scheduler stats
 */
export async function getCleanupStats()
{
    try
    {
        const totalOTPs=await Otp.countDocuments();
        const unverifiedOTPs=await Otp.countDocuments({verified: false});
        const verifiedOTPs=await Otp.countDocuments({verified: true});

        const oldestUnverified=await Otp.findOne({verified: false})
            .sort({createdAt: 1})
            .lean();

        return {
            totalOTPs,
            unverifiedOTPs,
            verifiedOTPs,
            oldestUnverified: oldestUnverified? oldestUnverified.createdAt:null,
            schedulerRunning: isOTPCleanupSchedulerRunning(),
            currentlyRunning: isRunning,
        };
    } catch (error)
    {
        logger.error('[OTP-CLEANUP] Error getting stats:', error);
        return null;
    }
}

export default {
    startOTPCleanupScheduler,
    stopOTPCleanupScheduler,
    cleanupExpiredOTPs,
    triggerOTPCleanup,
    advancedOTPCleanup,
    getCleanupStats,
    isOTPCleanupSchedulerRunning,
};
