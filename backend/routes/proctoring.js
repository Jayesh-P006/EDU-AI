import express from 'express';
import InterviewProctoring from '../models/InterviewProctoring.js';
import {verifyAuth} from '../middleware/auth.js';
import {APIResponse} from '../middleware/response.js';
import {validateRequest, proctoringSchemas} from '../middleware/validation.js';
import {verifyFace} from '../services/faceService.js';
import User from '../models/User.js';

const router=express.Router();

// Severity deduction weights (diminishing returns to prevent score going negative too fast)
const SEVERITY_WEIGHTS={
    low: {base: 1, max: 10},      // max 10 pts deducted from low events
    medium: {base: 3, max: 20},   // max 20 pts deducted from medium events
    high: {base: 7, max: 25},     // max 25 pts deducted from high events
    critical: {base: 15, max: 30}, // max 30 pts deducted from critical events
};

// Calculate integrity score with diminishing returns per severity
function calculateIntegrityScore(events)
{
    const severityCounts={low: 0, medium: 0, high: 0, critical: 0};
    events.forEach(e =>
    {
        if (severityCounts[e.severity]!==undefined) severityCounts[e.severity]++;
    });

    let totalDeduction=0;
    for (const [severity, count] of Object.entries(severityCounts))
    {
        const w=SEVERITY_WEIGHTS[severity];
        // Diminishing returns: each additional event of same severity deducts less
        const deduction=Math.min(w.max, w.base*count*(1-count*0.02));
        totalDeduction+=Math.max(0, deduction);
    }

    return Math.max(0, Math.round(100-totalDeduction));
}

// ── Log proctoring event ──
router.post('/event', verifyAuth, validateRequest(proctoringSchemas.recordEvent), async (req, res) =>
{
    try
    {
        const {interviewId, eventType, severity, details, description}=req.validatedData||req.body;

        if (!interviewId)
        {
            return APIResponse.error(res, 'interviewId is required', 400);
        }

        // Find or create proctoring record
        let proctoring=await InterviewProctoring.findOne({interviewId});
        if (!proctoring)
        {
            proctoring=await InterviewProctoring.create({
                interviewId,
                userId: req.user.userId,
                status: 'in_progress',
            });
        }

        const event={
            eventType,
            severity: severity||'low',
            description: description||details||'',
            timestamp: new Date(),
            metadata: req.body.metadata||{},
        };

        proctoring.events.push(event);
        proctoring.violationCount=proctoring.events.filter(e => ['high', 'critical'].includes(e.severity)).length;
        proctoring.warningCount=proctoring.events.filter(e => e.severity==='medium').length;
        proctoring.integrityScore=calculateIntegrityScore(proctoring.events);

        // Track specific event types
        if (eventType==='face_not_detected') proctoring.faceLostCount++;
        if (eventType==='multiple_faces') proctoring.multipleFaces=true;
        if (eventType==='noise_detected') proctoring.environmentnoise=true;
        if (eventType==='window_blur') proctoring.windowBlurCount++;
        if (eventType==='suspicious_activity') proctoring.suspiciousActivity=true;

        // Auto-flag if critical threshold reached
        if (proctoring.integrityScore<40&&!proctoring.isFlagged)
        {
            proctoring.isFlagged=true;
            proctoring.flagReason='Integrity score dropped below 40';
            proctoring.requiresReview=true;
        }

        await proctoring.save();

        return APIResponse.success(res, {event, integrityScore: proctoring.integrityScore});
    } catch (error)
    {
        console.error('[PROCTORING] Event error:', error.message);
        return APIResponse.serverError(res, 'Failed to record event');
    }
});

// ── Verify face identity during interview ──
router.post('/verify-face', verifyAuth, async (req, res) =>
{
    try
    {
        const {interviewId, descriptor}=req.body;

        if (!interviewId)
        {
            return APIResponse.error(res, 'interviewId is required', 400);
        }

        if (!descriptor||!Array.isArray(descriptor)||descriptor.length!==128)
        {
            return APIResponse.error(res, 'Valid 128-dim face descriptor is required', 400);
        }

        // Get the logged-in user's username (used as the Pinecone face ID)
        const user=await User.findById(req.user.userId).select('username faceRegistered');
        if (!user)
        {
            return APIResponse.error(res, 'User not found', 404);
        }

        if (!user.faceRegistered)
        {
            // User never registered a face — skip verification but log it
            return APIResponse.success(res, {
                verified: false,
                reason: 'no_face_registered',
                message: 'User has no registered face data',
            });
        }

        // Query Pinecone for the closest face match
        const {result: faceMatch, error: faceError}=await verifyFace(descriptor);

        let verified=false;
        let score=0;
        let matchedUser=null;

        if (faceMatch)
        {
            matchedUser=faceMatch.user_id;
            score=faceMatch.score;
            // Verified only if the matched face belongs to the logged-in user
            verified=(matchedUser===user.username);
        }

        // Update proctoring record
        let proctoring=await InterviewProctoring.findOne({interviewId});
        if (!proctoring)
        {
            proctoring=await InterviewProctoring.create({
                interviewId,
                userId: req.user.userId,
                status: 'in_progress',
            });
        }

        if (verified)
        {
            proctoring.faceVerifiedCount=(proctoring.faceVerifiedCount||0)+1;
            proctoring.lastFaceVerifiedAt=new Date();
            proctoring.identityConfirmed=true;

            // Log as a low-severity positive event
            proctoring.events.push({
                eventType: 'face_verified',
                severity: 'low',
                description: `Identity confirmed (score: ${score.toFixed(3)})`,
                timestamp: new Date(),
                metadata: {score, matchedUser},
            });
        }
        else
        {
            proctoring.faceMismatchCount=(proctoring.faceMismatchCount||0)+1;

            const mismatchDescription=faceError
                ? `Face verification failed: ${faceError}`
                :matchedUser
                    ? `Face matched different user: ${matchedUser} (expected: ${user.username}, score: ${score.toFixed(3)})`
                    :'Face not recognized — no match in database';

            // Severity escalates with repeated mismatches
            const mismatchCount=proctoring.faceMismatchCount;
            const severity=mismatchCount>=3? 'critical':mismatchCount>=2? 'high':'medium';

            proctoring.events.push({
                eventType: 'face_mismatch',
                severity,
                description: mismatchDescription,
                timestamp: new Date(),
                metadata: {score, matchedUser, expectedUser: user.username, mismatchCount},
            });

            proctoring.violationCount=proctoring.events.filter(e => ['high', 'critical'].includes(e.severity)).length;
            proctoring.warningCount=proctoring.events.filter(e => e.severity==='medium').length;

            // Auto-flag on 3+ mismatches
            if (mismatchCount>=3&&!proctoring.isFlagged)
            {
                proctoring.isFlagged=true;
                proctoring.flagReason='Repeated face identity mismatch — possible impersonation';
                proctoring.requiresReview=true;
            }
        }

        // Recalculate integrity score
        const severityCounts={low: 0, medium: 0, high: 0, critical: 0};
        proctoring.events.forEach(e =>
        {
            if (severityCounts[e.severity]!==undefined) severityCounts[e.severity]++;
        });
        let totalDeduction=0;
        for (const [sev, count] of Object.entries(severityCounts))
        {
            const w={low: {base: 1, max: 10}, medium: {base: 3, max: 20}, high: {base: 7, max: 25}, critical: {base: 15, max: 30}}[sev];
            totalDeduction+=Math.max(0, Math.min(w.max, w.base*count*(1-count*0.02)));
        }
        proctoring.integrityScore=Math.max(0, Math.round(100-totalDeduction));

        await proctoring.save();

        console.log(`[PROCTORING] Face verify: user=${user.username}, verified=${verified}, score=${score.toFixed(3)}, mismatches=${proctoring.faceMismatchCount}`);

        return APIResponse.success(res, {
            verified,
            score,
            matchedUser: verified? undefined:matchedUser,
            expectedUser: user.username,
            mismatchCount: proctoring.faceMismatchCount,
            integrityScore: proctoring.integrityScore,
        });
    } catch (error)
    {
        console.error('[PROCTORING] Face verify error:', error.message);
        return APIResponse.serverError(res, 'Failed to verify face identity');
    }
});

// ── Register/update active session ──
router.post('/session', verifyAuth, async (req, res) =>
{
    try
    {
        const {interviewId, candidateName, candidateEmail, recruiterName, startTime}=req.body;

        if (!interviewId)
        {
            return APIResponse.error(res, 'interviewId is required', 400);
        }

        let proctoring=await InterviewProctoring.findOne({interviewId});
        if (!proctoring)
        {
            proctoring=await InterviewProctoring.create({
                interviewId,
                userId: req.user.userId,
                status: 'in_progress',
                startTime: startTime||new Date(),
            });
        } else
        {
            proctoring.status='in_progress';
            await proctoring.save();
        }

        return APIResponse.success(res, {interviewId, status: 'active'});
    } catch (error)
    {
        console.error('[PROCTORING] Session error:', error.message);
        return APIResponse.serverError(res, 'Failed to register session');
    }
});

// ── End session ──
router.delete('/session/:interviewId', verifyAuth, async (req, res) =>
{
    try
    {
        const proctoring=await InterviewProctoring.findOne({interviewId: req.params.interviewId});
        if (proctoring)
        {
            proctoring.status='completed';
            proctoring.endTime=new Date();
            await proctoring.save();
        }
        return APIResponse.success(res, {success: true});
    } catch (error)
    {
        console.error('[PROCTORING] End session error:', error.message);
        return APIResponse.serverError(res, 'Failed to end session');
    }
});

// ── Get all active sessions (for proctor dashboard) ──
// IMPORTANT: Must be defined BEFORE /:interviewId to avoid route shadowing
router.get('/dashboard/sessions', verifyAuth, async (req, res) =>
{
    try
    {
        const sessions=await InterviewProctoring.find({status: 'in_progress'})
            .sort({createdAt: -1})
            .lean();

        const result=sessions.map(session =>
        {
            const violations={
                low: session.events.filter(e => e.severity==='low').length,
                medium: session.events.filter(e => e.severity==='medium').length,
                high: session.events.filter(e => e.severity==='high').length,
                critical: session.events.filter(e => e.severity==='critical').length,
            };

            const duration=Math.floor((new Date()-new Date(session.startTime||session.createdAt))/1000/60);

            return {
                interviewId: session.interviewId,
                candidateName: session.userId?.username||'Unknown',
                candidateEmail: session.userId?.email||'',
                status: session.status,
                startTime: session.startTime||session.createdAt,
                lastActivity: session.events.length>0
                    ? session.events[session.events.length-1].timestamp
                    :session.startTime||session.createdAt,
                integrityScore: session.integrityScore,
                violations,
                totalEvents: session.events.length,
                duration,
                isFlagged: session.isFlagged,
                recentEvents: session.events.slice(-5),
            };
        });

        return APIResponse.success(res, result);
    } catch (error)
    {
        console.error('[PROCTORING] Dashboard error:', error.message);
        return APIResponse.serverError(res, 'Failed to get sessions');
    }
});

// ── Get session details for dashboard ──
router.get('/dashboard/:interviewId', verifyAuth, async (req, res) =>
{
    try
    {
        const proctoring=await InterviewProctoring.findOne({interviewId: req.params.interviewId});

        if (!proctoring)
        {
            return APIResponse.notFound(res, 'Session');
        }

        return APIResponse.success(res, {
            session: proctoring,
            events: proctoring.events,
            eventCount: proctoring.events.length,
            integrityScore: proctoring.integrityScore,
        });
    } catch (error)
    {
        console.error('[PROCTORING] Dashboard detail error:', error.message);
        return APIResponse.serverError(res, 'Failed to get session details');
    }
});

// ── Get events for interview ──
// IMPORTANT: Wildcard routes must come AFTER specific routes
router.get('/:interviewId', verifyAuth, async (req, res) =>
{
    try
    {
        const proctoring=await InterviewProctoring.findOne({interviewId: req.params.interviewId});
        if (!proctoring)
        {
            return APIResponse.success(res, []);
        }
        return APIResponse.success(res, proctoring.events);
    } catch (error)
    {
        console.error('[PROCTORING] Get events error:', error.message);
        return APIResponse.serverError(res, 'Failed to get events');
    }
});

// ── Get integrity score ──
router.get('/:interviewId/score', verifyAuth, async (req, res) =>
{
    try
    {
        const proctoring=await InterviewProctoring.findOne({interviewId: req.params.interviewId});
        if (!proctoring)
        {
            return APIResponse.success(res, {score: 100, totalEvents: 0, breakdown: {}});
        }

        const breakdown={};
        proctoring.events.forEach(event =>
        {
            breakdown[event.eventType]=(breakdown[event.eventType]||0)+1;
        });

        return APIResponse.success(res, {
            score: proctoring.integrityScore,
            totalEvents: proctoring.events.length,
            breakdown,
            isFlagged: proctoring.isFlagged,
            violationCount: proctoring.violationCount,
            warningCount: proctoring.warningCount,
        });
    } catch (error)
    {
        console.error('[PROCTORING] Score error:', error.message);
        return APIResponse.serverError(res, 'Failed to get score');
    }
});

// ── Flag session for review ──
router.post('/:interviewId/flag', verifyAuth, async (req, res) =>
{
    try
    {
        const {reason, severity}=req.body;
        const proctoring=await InterviewProctoring.findOne({interviewId: req.params.interviewId});

        if (!proctoring)
        {
            return APIResponse.notFound(res, 'Session');
        }

        proctoring.isFlagged=true;
        proctoring.flagReason=reason||'Manually flagged for review';
        proctoring.requiresReview=true;
        proctoring.proctoredBy=req.user.userId;
        await proctoring.save();

        return APIResponse.success(res, {message: 'Session flagged for review'});
    } catch (error)
    {
        console.error('[PROCTORING] Flag error:', error.message);
        return APIResponse.serverError(res, 'Failed to flag session');
    }
});

export default router;
