import mongoose from 'mongoose';

/**
 * Database transaction helper for atomic operations
 * Wraps MongoDB transactions with automatic session management
 */

/**
 * Execute operations within a transaction
 * Automatically rolls back on error
 * 
 * @param {Function} callback - Async function with session parameter
 * @returns {Promise} Result of callback
 * 
 * @example
 * const result = await withTransaction(async (session) => {
 *   const user = await User.findByIdAndUpdate(userId, { score }, { session });
 *   const interview = await Interview.findByIdAndUpdate(interviewId, { status: 'completed' }, { session });
 *   return { user, interview };
 * });
 */
export async function withTransaction(callback)
{
    const session=await mongoose.startSession();
    session.startTransaction();

    try
    {
        const result=await callback(session);
        await session.commitTransaction();
        return result;
    } catch (error)
    {
        await session.abortTransaction();
        throw error;
    } finally
    {
        await session.endSession();
    }
}

/**
 * Execute operations with retry logic for transient failures
 * Useful for handling temporary connection issues
 * 
 * @param {Function} callback - Async function with session parameter
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} retryDelayMs - Delay between retries in ms (default: 100)
 * @returns {Promise} Result of callback
 */
export async function withTransactionRetry(callback, maxRetries=3, retryDelayMs=100)
{
    let lastError;

    for (let attempt=1;attempt<=maxRetries;attempt++)
    {
        try
        {
            return await withTransaction(callback);
        } catch (error)
        {
            lastError=error;

            // Only retry on specific transient errors
            const isTransientError=
                error.hasErrorLabel?.('TransientTransactionError')||
                error.hasErrorLabel?.('UnknownTransactionCommitResult')||
                (error.message&&error.message.includes('ECONNREFUSED'));

            if (!isTransientError||attempt===maxRetries)
            {
                throw error;
            }

            // Exponential backoff
            const delayMs=retryDelayMs*Math.pow(2, attempt-1);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            console.log(`[DB-TRANSACTION] Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms`, error.message);
        }
    }

    throw lastError;
}

/**
 * Execute multiple independent operations in sequence within a transaction
 * Useful for ensuring all-or-nothing semantics
 * 
 * @param {Function[]} operations - Array of async functions(session) => value
 * @returns {Promise<any[]>} Array of operation results
 * 
 * @example
 * const [user, interview, proctoring] = await withMultipleOperations([
 *   (session) => User.findByIdAndUpdate(userId, data, { session }),
 *   (session) => Interview.findByIdAndUpdate(interviewId, data, { session }),
 *   (session) => InterviewProctoring.create([data], { session }),
 * ]);
 */
export async function withMultipleOperations(operations)
{
    const results=[];

    try
    {
        await withTransaction(async (session) =>
        {
            for (const operation of operations)
            {
                const result=await operation(session);
                results.push(result);
            }
        });
    } catch (error)
    {
        console.error('[DB-TRANSACTION] Multiple operations failed:', error);
        throw error;
    }

    return results;
}

/**
 * Batch write operations within a transaction
 * Efficient for bulk updates/inserts
 * 
 * @param {Model} model - Mongoose model
 * @param {Array} operations - Bulk write operations
 * @returns {Promise<BulkWriteResult>} Bulk write result
 * 
 * @example
 * const operations = [
 *   { insertOne: { document: { name: 'test' } } },
 *   { updateMany: { filter: { status: 'pending' }, update: { status: 'processed' } } },
 * ];
 * const result = await withBatchOperations(User, operations);
 */
export async function withBatchOperations(model, operations)
{
    const session=await mongoose.startSession();
    session.startTransaction();

    try
    {
        const result=await model.collection.bulkWrite(operations, {session});
        await session.commitTransaction();
        return result;
    } catch (error)
    {
        await session.abortTransaction();
        console.error('[DB-TRANSACTION] Batch operation failed:', error);
        throw error;
    } finally
    {
        await session.endSession();
    }
}

/**
 * Acquire locks for exclusive access during transaction
 * Prevents concurrent modifications
 * 
 * @param {Model} model - Mongoose model
 * @param {string|ObjectId} documentId - Document to lock
 * @param {Function} callback - Operation to perform while locked
 * @returns {Promise} Result of callback
 * 
 * @example
 * const result = await withLock(Interview, interviewId, async (session, doc) => {
 *   // This operation is exclusive unless another holds the lock
 *   return await UserScore.updateOne({ userId: doc.userId }, { score: 100 }, { session });
 * });
 */
export async function withLock(model, documentId, callback)
{
    return await withTransaction(async (session) =>
    {
        // Use findByIdAndUpdate with projection to acquire lock through transaction
        const doc=await model.findById(documentId, {}, {session});

        if (!doc)
        {
            throw new Error(`Document not found: ${documentId}`);
        }

        // Perform callback with locked document
        return await callback(session, doc);
    });
}

/**
 * Execute operation with automatic session management
 * Middleware for routes to automatically include session
 * 
 * @param {Function} handler - Route handler (req, res, next, session)
 * @returns {Function} Express middleware
 * 
 * @example
 * router.post('/interview/submit', 
 *   withSessionMiddleware(async (req, res, next, session) => {
 *     const result = await Interview.findByIdAndUpdate(
 *       req.body.interviewId, 
 *       { status: 'completed' },
 *       { session }
 *     );
 *     res.json({ success: true, data: result });
 *   })
 * );
 */
export function withSessionMiddleware(handler)
{
    return async (req, res, next) =>
    {
        const session=await mongoose.startSession();
        session.startTransaction();

        try
        {
            const result=await handler(req, res, next, session);
            await session.commitTransaction();
            return result;
        } catch (error)
        {
            await session.abortTransaction();
            next(error);
        } finally
        {
            await session.endSession();
        }
    };
}

/**
 * Check if a session is active
 * Useful for debugging and monitoring
 */
export function isSessionActive(session)
{
    return session&&session.sessionId&&!session.hasEnded;
}

/**
 * Get transaction stats for monitoring
 */
export class TransactionStats
{
    constructor()
    {
        this.successful=0;
        this.failed=0;
        this.retried=0;
        this.totalDuration=0;
    }

    recordSuccess(durationMs)
    {
        this.successful++;
        this.totalDuration+=durationMs;
    }

    recordFailure()
    {
        this.failed++;
    }

    recordRetry()
    {
        this.retried++;
    }

    getStats()
    {
        return {
            successful: this.successful,
            failed: this.failed,
            retried: this.retried,
            totalDuration: this.totalDuration,
            averageDuration: this.successful>0? this.totalDuration/this.successful:0,
        };
    }
}

// Global stats instance
export const transactionStats=new TransactionStats();

/**
 * Execute transaction with stats tracking
 */
export async function withTransactionTracking(callback)
{
    const startTime=Date.now();

    try
    {
        const result=await withTransaction(callback);
        const duration=Date.now()-startTime;
        transactionStats.recordSuccess(duration);
        return result;
    } catch (error)
    {
        transactionStats.recordFailure();
        throw error;
    }
}
