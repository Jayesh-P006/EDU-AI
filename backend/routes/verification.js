import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import AIInterview from '../models/AIInterview.js';
import aiInterviewer from '../services/aiInterviewer.js';
import {
  runFullPipeline,
  generateAssessment,
  analyzeOverclaims,
  experienceGate,
} from '../services/verificationService.js';
import { parseResume, parseJD, analyzeGap } from '../services/resumeParser.js';

const router = express.Router();

// ─── Run full verification pipeline ────────────────────────
router.post('/:userId/run', async (req, res) => {
  try {
    const { userId } = req.params;
    const { jdText } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.resumeText) {
      return res.status(400).json({ error: 'No resume uploaded. Please upload your resume first.' });
    }

    const pipeline = runFullPipeline(user.resumeText, jdText || null);

    // Store verification data on user
    user.verification = {
      lastRunAt: new Date(),
      jdText: jdText || null,
      layer1: pipeline.layer1,
      layer2: pipeline.layer2,
      layer3: null,
      resumeParsed: pipeline.resumeResult,
      gapAnalysis: pipeline.gapAnalysis,
      pipelineComplete: false,
    };
    user.markModified('verification');
    await user.save();

    res.json({
      success: true,
      layer1: pipeline.layer1,
      layer2: pipeline.layer2,
      resumeParsed: pipeline.resumeResult,
      gapAnalysis: pipeline.gapAnalysis,
    });
  } catch (err) {
    console.error('Verification run error:', err);
    res.status(500).json({ error: 'Verification failed', details: err.message });
  }
});

// ─── Get stored verification results ──────────────────────
router.get('/:userId/results', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      success: true,
      verification: user.verification || null,
      hasResume: !!user.resumeText,
    });
  } catch (err) {
    console.error('Verification results error:', err);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// ─── Layer 2: Get assessment questions ────────────────────
router.get('/:userId/assessment', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.verification?.layer2) {
      return res.status(400).json({
        error: 'Run verification first to generate assessment questions.',
      });
    }

    res.json({
      success: true,
      assessment: user.verification.layer2,
    });
  } catch (err) {
    console.error('Assessment fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch assessment' });
  }
});

// ─── Layer 2−3: Submit assessment answers & get overclaim analysis ──
router.post('/:userId/submit-assessment', async (req, res) => {
  try {
    const { userId } = req.params;
    const { answers } = req.body;
    // answers: [{ skill, score (0-100), type, questionId }]

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'Answers array is required.' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.resumeText) {
      return res.status(400).json({ error: 'No resume uploaded.' });
    }

    const resumeResult = user.verification?.resumeParsed || parseResume(user.resumeText);

    // Run Layer 3
    const layer3 = analyzeOverclaims(answers, resumeResult);

    // Update verification on user
    if (!user.verification) user.verification = {};
    user.verification.layer3 = layer3;
    user.verification.assessmentAnswers = answers;
    user.verification.pipelineComplete = true;
    user.verification.completedAt = new Date();
    user.markModified('verification');
    await user.save();

    res.json({
      success: true,
      layer3,
      pipelineComplete: true,
    });
  } catch (err) {
    console.error('Assessment submit error:', err);
    res.status(500).json({ error: 'Failed to analyze assessment', details: err.message });
  }
});

// ─── Quick experience check (Layer 1 only) ────────────────
router.post('/:userId/experience-check', async (req, res) => {
  try {
    const { userId } = req.params;
    const { jdText } = req.body;

    if (!jdText) return res.status(400).json({ error: 'Job description text required.' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.resumeText) return res.status(400).json({ error: 'No resume uploaded.' });

    const resumeResult = parseResume(user.resumeText);
    const jdResult = parseJD(jdText);
    const layer1 = experienceGate(jdResult, resumeResult);

    res.json({ success: true, layer1 });
  } catch (err) {
    console.error('Experience check error:', err);
    res.status(500).json({ error: 'Experience check failed' });
  }
});

// ─── Quick skill gap analysis ─────────────────────────────
router.post('/:userId/skill-gap', async (req, res) => {
  try {
    const { userId } = req.params;
    const { jdText } = req.body;

    if (!jdText) return res.status(400).json({ error: 'Job description text required.' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.resumeText) return res.status(400).json({ error: 'No resume uploaded.' });

    const resumeResult = parseResume(user.resumeText);
    const jdResult = parseJD(jdText);
    const gap = analyzeGap(jdResult, resumeResult);

    res.json({ success: true, gap });
  } catch (err) {
    console.error('Skill gap error:', err);
    res.status(500).json({ error: 'Skill gap analysis failed' });
  }
});

// ─── Auto-create AI Interview from verification data (Layer 2) ──
router.post('/:userId/auto-interview', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.verification?.layer2) {
      return res.status(400).json({ error: 'Run verification first to generate Layer 2 data.' });
    }

    // ── Attempt tracking (max 5 attempts) ──
    const MAX_ATTEMPTS = 5;
    const autoInterview = user.verification.autoInterview || {};
    const currentAttempts = autoInterview.attempts || 0;

    if (currentAttempts >= MAX_ATTEMPTS) {
      return res.status(400).json({
        error: 'Maximum verification attempts reached',
        attemptsUsed: currentAttempts,
        maxAttempts: MAX_ATTEMPTS,
        remainingAttempts: 0,
      });
    }

    // Gather skills from verification + profile
    const skillsTested = user.verification.layer2.skillsTested || [];
    const profileSkills = user.skills || [];
    const projects = user.projects || [];
    const resumeParsed = user.verification.resumeParsed || user.resumeParsed || {};

    // Build context-rich topics from skills + projects
    const topics = [...new Set([
      ...skillsTested,
      ...profileSkills.slice(0, 5),
      ...projects.map(p => p.name).filter(Boolean).slice(0, 3),
    ])].slice(0, 8);

    // Determine role from JD or profile
    const role = resumeParsed?.role?.title || user.desiredRole || 'Software Developer';
    const candidateName = user.fullName || user.username || 'Candidate';

    // Determine experience level
    const expYears = resumeParsed?.experience?.years || user.verification.layer1?.resumeYears || 0;
    let experience = 'entry';
    if (expYears >= 5) experience = 'senior';
    else if (expYears >= 2) experience = 'mid';

    const sessionId = uuidv4();
    const difficultyMap = { entry: 'Easy', mid: 'Mixed', senior: 'Hard' };
    const difficulty = difficultyMap[experience] || 'Mixed';

    // Generate 5 AI-powered questions based on skills & projects
    let questions;
    try {
      questions = await aiInterviewer.generateAIQuestions(role, 5, difficulty, topics);
    } catch (aiErr) {
      console.error('AI question gen failed, using fallback:', aiErr.message);
      questions = aiInterviewer.getQuestionsForRole(role, 5);
    }

    const greeting = aiInterviewer.generateGreeting(candidateName, role);

    await AIInterview.create({
      sessionId,
      candidateName,
      candidateId: userId,
      role,
      experience,
      topics,
      duration: 30,
      status: 'active',
      startTime: new Date(),
      currentQuestionIndex: 0,
      questions,
      questionAnswerPairs: [],
      greeting,
      totalQuestions: questions.length,
      useAI: true,
    });

    const newAttempts = currentAttempts + 1;

    // Store interview reference in verification with attempt tracking
    user.verification.autoInterview = {
      sessionId,
      role,
      topics,
      questionCount: questions.length,
      createdAt: new Date(),
      attempts: newAttempts,
      maxAttempts: MAX_ATTEMPTS,
      remainingAttempts: MAX_ATTEMPTS - newAttempts,
      status: 'in-progress',
      lastScore: autoInterview.lastScore || null,
      history: [
        ...(autoInterview.history || []),
        { sessionId, startedAt: new Date(), attempt: newAttempts },
      ],
    };
    user.markModified('verification');
    await user.save();

    console.log(`✅ Auto AI Interview attempt ${newAttempts}/${MAX_ATTEMPTS}: ${sessionId} — ${role} (${questions.length}Q)`);

    res.json({
      success: true,
      sessionId,
      role,
      topics,
      questionCount: questions.length,
      greeting,
      firstQuestion: questions[0]?.question,
      attempt: newAttempts,
      maxAttempts: MAX_ATTEMPTS,
      remainingAttempts: MAX_ATTEMPTS - newAttempts,
    });
  } catch (err) {
    console.error('Auto-interview creation error:', err);
    res.status(500).json({ error: 'Failed to create AI interview', details: err.message });
  }
});

// ─── Check interview result and update verification status ──
router.post('/:userId/verify-interview-result', async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const session = await AIInterview.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: 'Interview session not found' });

    const autoInterview = user.verification?.autoInterview || {};
    const MAX_ATTEMPTS = 5;
    const attempts = autoInterview.attempts || 1;
    const remainingAttempts = MAX_ATTEMPTS - attempts;

    // Check if interview was completed (all questions answered)
    const allQuestionsAnswered = session.questionAnswerPairs.length >= session.totalQuestions;
    const interviewStatus = session.status; // 'completed', 'ended', 'active'

    // If ended early (not all questions answered), mark as incomplete
    if (!allQuestionsAnswered || interviewStatus === 'ended') {
      user.verification.autoInterview = {
        ...autoInterview,
        status: 'incomplete',
        lastSessionId: sessionId,
        lastScore: null,
        remainingAttempts,
        completedAt: new Date(),
      };
      // Update history entry
      const history = autoInterview.history || [];
      const lastEntry = history.find(h => h.sessionId === sessionId);
      if (lastEntry) {
        lastEntry.status = 'incomplete';
        lastEntry.completedAt = new Date();
        lastEntry.questionsAnswered = session.questionAnswerPairs.length;
        lastEntry.totalQuestions = session.totalQuestions;
      }
      user.verification.autoInterview.history = history;
      user.markModified('verification');
      await user.save();

      return res.json({
        verified: false,
        status: 'incomplete',
        message: 'Interview was not completed. All 5 questions must be answered.',
        remainingAttempts,
        attempts,
        maxAttempts: MAX_ATTEMPTS,
      });
    }

    // Interview was completed — check score
    let score = session.overallScore;
    if (!score && session.questionAnswerPairs.length > 0) {
      const scores = session.questionAnswerPairs
        .map(qa => qa.evaluation?.overallScore || 0)
        .filter(s => s > 0);
      score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    }
    score = score || 0;

    const PASS_THRESHOLD = 70;
    const passed = score >= PASS_THRESHOLD;

    // Update history entry
    const history = autoInterview.history || [];
    const lastEntry = history.find(h => h.sessionId === sessionId);
    if (lastEntry) {
      lastEntry.status = passed ? 'passed' : 'failed';
      lastEntry.score = score;
      lastEntry.completedAt = new Date();
      lastEntry.questionsAnswered = session.questionAnswerPairs.length;
    }

    user.verification.autoInterview = {
      ...autoInterview,
      status: passed ? 'passed' : 'failed',
      lastSessionId: sessionId,
      lastScore: score,
      remainingAttempts,
      completedAt: new Date(),
      history,
    };

    // If passed, mark layer2 as verified via interview
    if (passed) {
      user.verification.layer2InterviewVerified = true;
      user.verification.layer2InterviewScore = score;
    }

    user.markModified('verification');
    await user.save();

    res.json({
      verified: passed,
      status: passed ? 'passed' : 'failed',
      score,
      passThreshold: PASS_THRESHOLD,
      message: passed
        ? `Congratulations! You scored ${score}/100. Resume skills verified successfully.`
        : `Score ${score}/100 is below the required ${PASS_THRESHOLD}. ${remainingAttempts > 0 ? `You have ${remainingAttempts} attempt(s) remaining.` : 'No more attempts remaining.'}`,
      remainingAttempts,
      attempts,
      maxAttempts: MAX_ATTEMPTS,
    });
  } catch (err) {
    console.error('Verify interview result error:', err);
    res.status(500).json({ error: 'Failed to verify interview result' });
  }
});


// ─── Reset verification ──────────────────────────────────
router.delete('/:userId/reset', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.verification = {};
    user.markModified('verification');
    await user.save();

    res.json({ success: true, message: 'Verification reset.' });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

export default router;
