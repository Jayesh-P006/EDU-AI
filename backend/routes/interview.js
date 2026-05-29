import express from 'express';
import {v4 as uuidv4} from 'uuid';
import mongoose from 'mongoose';
import AIInterview from '../models/AIInterview.js';
import Application from '../models/Application.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import {verifyAuth} from '../middleware/auth.js';
import {APIResponse} from '../middleware/response.js';
import {validateRequest, interviewSchemas} from '../middleware/validation.js';
import interviewReportGenerator from '../services/interviewReportGenerator.js';

const router=express.Router();

// Helper: build query to find interview by _id or sessionId
function findInterviewQuery(id)
{
    const conditions=[{sessionId: id}];
    if (mongoose.Types.ObjectId.isValid(id))
    {
        conditions.push({_id: id});
    }
    return {$or: conditions};
}

// Create interview - now using MongoDB
router.post('/create', verifyAuth, validateRequest(interviewSchemas.create), async (req, res) =>
{
    try
    {
        // Use client-provided sessionId (Quick Join) or generate a new UUID
        const sessionId=req.body.sessionId||uuidv4();
        // JWT stores `userId`, not `id` — use req.user.userId
        const candidateId=req.user?.userId||null;

        const interview=new AIInterview({
            sessionId,
            candidateName: req.body.candidateName||'Anonymous',
            candidateId,
            role: req.body.role||'Software Engineer',
            experience: req.body.experience||'entry',
            topics: req.body.topics||[],
            duration: req.body.duration||30,
            status: 'active',
            startTime: new Date(),
            questions: [],
            codeSubmissions: [],
            proctoringEvents: [],
            notes: req.body.notes||'',
        });

        const saved=await interview.save();
        APIResponse.success(res, saved, 'Interview created', 201);
    } catch (err)
    {
        console.error('[INTERVIEW] Creation error:', err);
        APIResponse.serverError(res, 'Failed to create interview');
    }
});

// ── Schedule interview for a specific candidate on a job ──────────────────────
router.post('/schedule', verifyAuth, async (req, res) =>
{
    try
    {
        const {candidateId, jobId, applicationId, scheduledAt, duration, notes}=req.body;
        if (!candidateId||!jobId)
        {
            return APIResponse.error(res, 'candidateId and jobId are required', 400);
        }

        // Verify the application exists
        let application;
        if (applicationId)
        {
            application=await Application.findById(applicationId);
        }
        if (!application)
        {
            application=await Application.findOne({job: jobId, candidate: candidateId});
        }
        if (!application)
        {
            return APIResponse.error(res, 'No application found for this candidate and job', 404);
        }

        // Get candidate and job info
        const [candidate, job]=await Promise.all([
            User.findById(candidateId).select('username email').lean(),
            Job.findById(jobId).select('title companyName').lean(),
        ]);

        if (!candidate||!job)
        {
            return APIResponse.error(res, 'Candidate or Job not found', 404);
        }

        const sessionId=`interview-${Date.now()}`;
        const schedulerId=req.user?.userId||null;

        const interview=new AIInterview({
            sessionId,
            candidateName: candidate.username,
            candidateId,
            jobId,
            applicationId: application._id,
            scheduledBy: schedulerId,
            scheduledAt: scheduledAt? new Date(scheduledAt):new Date(),
            interviewLink: sessionId,
            role: job.title,
            experience: 'entry',
            topics: [],
            duration: duration||30,
            status: 'scheduled',
            startTime: null,
            questions: [],
            codeSubmissions: [],
            proctoringEvents: [],
            notes: notes||`Scheduled interview for ${job.title} at ${job.companyName}`,
        });

        const saved=await interview.save();

        // Update application status to 'interview'
        application.status='interview';
        application.round='Interview Scheduled';
        application.statusHistory.push({
            status: 'interview',
            changedAt: new Date(),
            changedBy: schedulerId,
            note: `Interview scheduled — Session: ${sessionId}`,
        });
        await application.save();

        APIResponse.success(res, {
            interview: saved,
            interviewLink: sessionId,
            candidateName: candidate.username,
            candidateEmail: candidate.email,
            jobTitle: job.title,
        }, 'Interview scheduled', 201);
    } catch (err)
    {
        console.error('[INTERVIEW] Schedule error:', err);
        APIResponse.serverError(res, 'Failed to schedule interview');
    }
});

// ── Get scheduled interviews for a candidate ──────────────────────────────────
router.get('/my-interviews', verifyAuth, async (req, res) =>
{
    try
    {
        const userId=req.user?.userId;
        if (!userId) return APIResponse.error(res, 'Not authenticated', 401);

        const interviews=await AIInterview.find({
            candidateId: userId,
            status: {$in: ['scheduled', 'active']},
        })
            .populate('jobId', 'title companyName department location type')
            .populate('scheduledBy', 'username companyName')
            .sort({scheduledAt: -1})
            .lean();

        const result=interviews.map(iv => ({
            id: iv.sessionId,
            sessionId: iv.sessionId,
            jobTitle: iv.jobId?.title||iv.role,
            companyName: iv.jobId?.companyName||iv.scheduledBy?.companyName||'',
            department: iv.jobId?.department||'',
            location: iv.jobId?.location||'',
            scheduledAt: iv.scheduledAt,
            duration: iv.duration,
            status: iv.status,
            interviewLink: iv.interviewLink,
            notes: iv.notes,
        }));

        APIResponse.success(res, result);
    } catch (err)
    {
        console.error('[INTERVIEW] My-interviews error:', err);
        APIResponse.serverError(res, 'Failed to fetch interviews');
    }
});

// ── Get scheduled interviews for a job (company-side) ─────────────────────────
router.get('/job/:jobId', verifyAuth, async (req, res) =>
{
    try
    {
        const {jobId}=req.params;
        if (!jobId||jobId==='undefined'||jobId==='null')
        {
            return APIResponse.error(res, 'Valid jobId is required', 400);
        }

        const interviews=await AIInterview.find({
            jobId,
        })
            .populate('candidateId', 'username email')
            .sort({scheduledAt: -1})
            .lean();

        const result=interviews.map(iv => ({
            id: iv.sessionId,
            sessionId: iv.sessionId,
            candidateName: iv.candidateName,
            candidateEmail: iv.candidateId?.email||'',
            scheduledAt: iv.scheduledAt,
            duration: iv.duration,
            status: iv.status,
            interviewLink: iv.interviewLink,
            overallScore: iv.overallScore,
        }));

        APIResponse.success(res, result);
    } catch (err)
    {
        console.error('[INTERVIEW] Job interviews error:', err);
        APIResponse.serverError(res, 'Failed to fetch job interviews');
    }
});

// Get leaderboard — all completed interviews ranked by score
// NOTE: Must be defined BEFORE /:id to avoid being caught by the wildcard param
router.get('/leaderboard/all', verifyAuth, async (req, res) =>
{
    try
    {
        const interviews=await AIInterview.find({
            status: {$in: ['completed', 'ended']},
            overallScore: {$ne: null},
        })
            .sort({overallScore: -1})
            .limit(100)
            .select('sessionId candidateName candidateId role experience overallScore sectionScores endTime codeSubmissions')
            .lean();

        const leaderboard=interviews.map((iv, idx) =>
        {
            const totalPassed=(iv.codeSubmissions||[]).reduce((s, sub) => s+(sub.passed||0), 0);
            const totalTests=(iv.codeSubmissions||[]).reduce((s, sub) => s+(sub.total||0), 0);

            return {
                rank: idx+1,
                sessionId: iv.sessionId,
                name: iv.candidateName,
                candidateId: iv.candidateId,
                role: iv.role,
                experience: iv.experience,
                overall: iv.overallScore,
                sections: iv.sectionScores||{},
                testsPassed: totalPassed,
                testsTotal: totalTests,
                completedAt: iv.endTime,
            };
        });

        APIResponse.success(res, {leaderboard, total: leaderboard.length});
    } catch (err)
    {
        console.error('[INTERVIEW] Leaderboard error:', err);
        APIResponse.serverError(res, 'Failed to fetch leaderboard');
    }
});

// Get interview by ID
router.get('/:id', verifyAuth, async (req, res) =>
{
    try
    {
        const interview=await AIInterview.findOne(findInterviewQuery(req.params.id));

        if (!interview)
        {
            return APIResponse.notFound(res, 'Interview not found');
        }

        // Ownership check — candidate can only see their own, recruiter/admin can see any
        const userId=req.user?.userId;
        const userRole=req.user?.role;
        if (interview.candidateId&&userRole==='candidate'&&String(interview.candidateId)!==String(userId))
        {
            return APIResponse.forbidden(res, 'You do not have access to this interview');
        }

        APIResponse.success(res, interview);
    } catch (err)
    {
        console.error('[INTERVIEW] Fetch error:', err);
        APIResponse.serverError(res, 'Failed to fetch interview');
    }
});

// Get all interviews for current user
router.get('/', verifyAuth, async (req, res) =>
{
    try
    {
        // JWT stores `userId`, not `id`
        const userId=req.user?.userId;
        if (!userId)
        {
            return APIResponse.error(res, 'User ID not found in token', 400);
        }

        const interviews=await AIInterview.find({
            candidateId: userId,
        }).sort({startTime: -1});

        APIResponse.success(res, interviews);
    } catch (err)
    {
        console.error('[INTERVIEW] List error:', err);
        APIResponse.serverError(res, 'Failed to fetch interviews');
    }
});

// End interview
router.post('/:id/end', verifyAuth, validateRequest(interviewSchemas.end), async (req, res) =>
{
    try
    {
        const interview=await AIInterview.findOne(findInterviewQuery(req.params.id));

        if (!interview)
        {
            return APIResponse.notFound(res, 'Interview not found');
        }

        // Ownership check — only participants can end
        const userId=req.user?.userId;
        const userRole=req.user?.role;
        if (interview.candidateId&&userRole==='candidate'&&String(interview.candidateId)!==String(userId))
        {
            return APIResponse.forbidden(res, 'You do not have permission to end this interview');
        }

        if (interview.status==='completed'||interview.status==='ended')
        {
            return APIResponse.error(res, 'Interview has already ended', 400);
        }

        interview.status='completed';
        interview.endTime=new Date();
        interview.feedback=req.body.feedback||'';
        interview.notes=req.body.notes||'';
        interview.rating=req.body.rating??null;
        interview.score=req.body.score??0;
        interview.hiringDecision=req.body.hiringDecision||'';

        // Save recruiter's manual scores if provided (all out of 10)
        if (req.body.recruiterScores)
        {
            interview.recruiterScores={
                technical: req.body.recruiterScores.technical||0,
                problemSolving: req.body.recruiterScores.problemSolving||0,
                communication: req.body.recruiterScores.communication||0,
                domain: req.body.recruiterScores.domain||0,
                aptitude: req.body.recruiterScores.aptitude||0,
                overallScore: req.body.recruiterScores.overallScore||0,
            };
        }

        // Generate comprehensive report
        try
        {
            const report=interviewReportGenerator.generateReport(interview);

            // If recruiter provided scores, use those instead of auto-generated ones
            if (req.body.recruiterScores)
            {
                const rs=req.body.recruiterScores;
                report.sectionScores={
                    technical: (rs.technical||0)*10,
                    communication: (rs.communication||0)*10,
                    problemSolving: (rs.problemSolving||0)*10,
                    domain: (rs.domain||0)*10,
                    aptitude: (rs.aptitude||0)*10,
                };
                report.overallScore=(rs.overallScore||0)*10;
                report.grade=interviewReportGenerator.assignGrade(report.overallScore);
            }

            // Save hiring decision into the report object
            if (req.body.hiringDecision)
            {
                report.hiringDecision=req.body.hiringDecision;
            }

            interview.report=report;
            interview.overallScore=report.overallScore;
            interview.sectionScores={
                technical: report.sectionScores.technical,
                communication: report.sectionScores.communication,
                problemSolving: report.sectionScores.problemSolving,
                domain: report.sectionScores.domain,
                aptitude: report.sectionScores.aptitude,
            };
        } catch (reportErr)
        {
            console.error('[INTERVIEW] Report generation error:', reportErr);
            // Still allow ending even if report generation fails
        }

        const updated=await interview.save();

        APIResponse.success(res, updated, 'Interview ended');
    } catch (err)
    {
        console.error('[INTERVIEW] End error:', err);
        APIResponse.serverError(res, 'Failed to end interview');
    }
});

// Add question to interview
router.post('/:id/question', verifyAuth, validateRequest(interviewSchemas.addQuestion), async (req, res) =>
{
    try
    {
        const interview=await AIInterview.findOne(findInterviewQuery(req.params.id));

        if (!interview)
        {
            return APIResponse.notFound(res, 'Interview not found');
        }

        if (interview.status!=='active')
        {
            return APIResponse.error(res, 'Cannot add questions to a completed interview', 400);
        }

        if (!interview.questionAnswerPairs)
        {
            interview.questionAnswerPairs=[];
        }

        interview.questionAnswerPairs.push({
            question: req.body.question||'',
            questionMetadata: req.body.metadata||null,
            answer: req.body.answer||'',
            evaluation: null,
            followUps: [],
            timestamp: new Date(),
        });

        const updated=await interview.save();

        APIResponse.success(res, updated, 'Question added');
    } catch (err)
    {
        console.error('[INTERVIEW] Question add error:', err);
        APIResponse.serverError(res, 'Failed to add question');
    }
});

// Add code submission
router.post('/:id/submission', verifyAuth, validateRequest(interviewSchemas.addSubmission), async (req, res) =>
{
    try
    {
        const interview=await AIInterview.findOne(findInterviewQuery(req.params.id));

        if (!interview)
        {
            return APIResponse.notFound(res, 'Interview not found');
        }

        if (interview.status!=='active')
        {
            return APIResponse.error(res, 'Cannot submit to a completed interview', 400);
        }

        if (!interview.codeSubmissions)
        {
            interview.codeSubmissions=[];
        }

        // Only allow validated fields, not arbitrary body spread
        interview.codeSubmissions.push({
            code: req.body.code,
            language: req.body.language,
            questionId: req.body.questionId,
            timestamp: new Date(),
        });

        const updated=await interview.save();

        APIResponse.success(res, updated, 'Submission added');
    } catch (err)
    {
        console.error('[INTERVIEW] Submission error:', err);
        APIResponse.serverError(res, 'Failed to add submission');
    }
});

// Get interview report
router.get('/:id/report', verifyAuth, async (req, res) =>
{
    try
    {
        const interview=await AIInterview.findOne(findInterviewQuery(req.params.id));

        if (!interview)
        {
            return APIResponse.notFound(res, 'Interview not found');
        }

        // If report already exists, return it (with recruiter data merged in)
        if (interview.report)
        {
            const reportData={
                ...interview.report,
                recruiterScores: interview.recruiterScores||null,
                feedback: interview.feedback||'',
                notes: interview.notes||'',
                rating: interview.rating,
                hiringDecision: interview.hiringDecision||'',
            };
            return APIResponse.success(res, reportData);
        }

        // If interview is completed but no report (legacy), generate one now
        if (interview.status==='completed'||interview.status==='ended')
        {
            const report=interviewReportGenerator.generateReport(interview);
            interview.report=report;
            interview.overallScore=report.overallScore;
            interview.sectionScores={
                technical: report.sectionScores.technical,
                communication: report.sectionScores.communication,
                problemSolving: report.sectionScores.problemSolving,
                domain: report.sectionScores.domain,
                aptitude: report.sectionScores.aptitude,
            };
            await interview.save();
            const reportData={
                ...report,
                recruiterScores: interview.recruiterScores||null,
                feedback: interview.feedback||'',
                notes: interview.notes||'',
                rating: interview.rating,
                hiringDecision: interview.hiringDecision||'',
            };
            return APIResponse.success(res, reportData);
        }

        return APIResponse.error(res, 'Interview is still active. End it to generate a report.', 400);
    } catch (err)
    {
        console.error('[INTERVIEW] Report error:', err);
        APIResponse.serverError(res, 'Failed to generate report');
    }
});

export default router;
