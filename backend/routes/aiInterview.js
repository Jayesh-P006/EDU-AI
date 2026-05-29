import express from 'express';
import {v4 as uuidv4} from 'uuid';
import aiInterviewer from '../services/aiInterviewer.js';
import AIInterview from '../models/AIInterview.js';

const router=express.Router();

// Helper: ensure a value is a finite number, fallback to 0
const safeNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// ── Available job roles ──
router.get('/roles', (req, res) => {
  const roles = [
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'Data Scientist',
    'DevOps Engineer',
  ];
  res.json({ roles });
});

// ── Create / Start new AI interview session ──
router.post('/create', async (req, res) => {
  try {
    const {
      candidateName, role,
      experience = 'entry', topics = [], duration = 30,
      questionCount = 5, useAI = true, candidateId = null,
    } = req.body;

    if (!candidateName || !role) {
      return res.status(400).json({ error: 'candidateName and role are required' });
    }

    const sessionId = uuidv4();
    const difficultyMap = { entry: 'Easy', mid: 'Mixed', senior: 'Hard' };
    const difficulty = difficultyMap[experience] || 'Mixed';

    let questions;
    if (useAI) {
      console.log(`🤖 Generating AI questions for ${role} (${difficulty})...`);
      questions = await aiInterviewer.generateAIQuestions(role, questionCount, difficulty, topics);
    } else {
      questions = aiInterviewer.getQuestionsForRole(role, questionCount);
    }

    const greeting = aiInterviewer.generateGreeting(candidateName, role);

    await AIInterview.create({
      sessionId, candidateName, candidateId, role, experience, topics, duration,
      status: 'active', startTime: new Date(), currentQuestionIndex: 0,
      questions, questionAnswerPairs: [], greeting,
      totalQuestions: questions.length, useAI,
    });

    console.log(`✅ Interview created for ${candidateName} — ${role} (${questions.length} questions)`);

    res.json({
      sessionId, greeting, duration,
      totalQuestions: questions.length,
      firstQuestion: questions[0]?.question,
      questionMetadata: {
        id: questions[0]?.id, topic: questions[0]?.topic,
        difficulty: questions[0]?.difficulty, number: 1, total: questions.length,
      },
    });
  } catch (error) {
    console.error('Error creating AI interview:', error);
    res.status(500).json({ error: 'Failed to create interview', details: error.message });
  }
});

// Legacy alias
router.post('/start', (req, res, next) => {
  router.handle({ ...req, url: '/create', method: 'POST' }, res, next);
});

// ── Get all interviews for a specific user ──
router.get('/user/:userId/interviews', async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await AIInterview.find({ candidateId: userId })
      .select('sessionId candidateName role status startTime endTime totalQuestions overallScore sectionScores questionAnswerPairs topics experience duration')
      .sort({ createdAt: -1 });

    const summaries = sessions.map(s => ({
      sessionId: s.sessionId,
      candidateName: s.candidateName,
      role: s.role,
      status: s.status,
      startTime: s.startTime,
      endTime: s.endTime,
      totalQuestions: s.totalQuestions,
      questionsAnswered: s.questionAnswerPairs?.length || 0,
      overallScore: s.overallScore,
      sectionScores: s.sectionScores,
      topics: s.topics,
      experience: s.experience,
      duration: s.duration,
    }));

    res.json({ sessions: summaries, total: summaries.length });
  } catch (error) {
    console.error('Error fetching user interviews:', error);
    res.status(500).json({ error: 'Failed to fetch user interviews' });
  }
});

// ── List all sessions (recruiter / admin) ──
router.get('/sessions/list', async (req, res) => {
  try {
    const { status, role } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (role) filter.role = role;

    const sessions = await AIInterview.find(filter)
      .select('sessionId candidateName role status startTime endTime totalQuestions overallScore questionAnswerPairs')
      .sort({ createdAt: -1 }).limit(100);

    const summaries = sessions.map(s => ({
      sessionId: s.sessionId, candidateName: s.candidateName, role: s.role,
      status: s.status, startTime: s.startTime, endTime: s.endTime,
      totalQuestions: s.totalQuestions,
      questionsAnswered: s.questionAnswerPairs?.length || 0,
      overallScore: s.overallScore,
    }));

    res.json({ sessions: summaries, total: summaries.length });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// ── Get session data ──
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (['roles', 'sessions', 'create', 'start'].includes(sessionId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const session = await AIInterview.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json({
      sessionId: session.sessionId, candidateName: session.candidateName,
      role: session.role, experience: session.experience, topics: session.topics,
      duration: session.duration, status: session.status,
      startTime: session.startTime, endTime: session.endTime,
      currentQuestionIndex: session.currentQuestionIndex,
      totalQuestions: session.totalQuestions,
      questionsAnswered: session.questionAnswerPairs.length,
      greeting: session.greeting,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// ── Get next question ──
router.post('/:sessionId/question', async (req, res) => {
  try {
    const session = await AIInterview.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.currentQuestionIndex >= session.questions.length) {
      return res.json({ question: null, interviewComplete: true });
    }

    const q = session.questions[session.currentQuestionIndex];
    res.json({
      question: q.question,
      questionMetadata: {
        id: q.id, topic: q.topic, difficulty: q.difficulty,
        number: session.currentQuestionIndex + 1, total: session.totalQuestions,
      },
    });
  } catch (error) {
    console.error('Error getting question:', error);
    res.status(500).json({ error: 'Failed to get question' });
  }
});

// ── Submit answer ──
router.post('/:sessionId/answer', async (req, res) => {
  try {
    const { answer, question, audioMetrics = {} } = req.body;
    if (!answer) return res.status(400).json({ error: 'answer is required' });

    const session = await AIInterview.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Session is not active' });

    const currentQuestion = session.questions[session.currentQuestionIndex];
    const evaluation = await aiInterviewer.evaluateAnswer({
      question: currentQuestion?.question || question, answer,
      role: session.role, audioMetrics,
    });

    const qaData = {
      question: currentQuestion?.question || question,
      questionMetadata: currentQuestion, answer, evaluation,
      followUps: [], timestamp: new Date(),
    };
    session.questionAnswerPairs.push(qaData);

    const shouldFollowUp = evaluation.overallScore < 70 || answer.length < 50 || Math.random() > 0.5;
    let response = {
      evaluation: { overallScore: evaluation.overallScore, feedback: evaluation.detailedFeedback },
      questionNumber: session.currentQuestionIndex + 1,
      totalQuestions: session.totalQuestions,
    };

    if (shouldFollowUp && !session.hasFollowUp) {
      const followUp = await aiInterviewer.generateFollowUpQuestion(
        currentQuestion.question, answer, session.role, req.params.sessionId
      );
      session.hasFollowUp = true;
      qaData.followUps.push({ question: followUp, answer: null });
      response.hasFollowUp = true;
      response.followUpQuestion = followUp;
      response.question = followUp;
      response.message = "That's interesting. Let me ask a follow-up question:";
    } else {
      session.hasFollowUp = false;
      session.currentQuestionIndex += 1;

      if (session.currentQuestionIndex < session.questions.length) {
        const nextQ = session.questions[session.currentQuestionIndex];
        response.nextQuestion = nextQ.question;
        response.question = nextQ.question;
        response.questionMetadata = {
          id: nextQ.id, topic: nextQ.topic, difficulty: nextQ.difficulty,
          number: session.currentQuestionIndex + 1, total: session.totalQuestions,
        };
        response.message = 'Great! Moving to the next question:';
      } else {
        session.status = 'completed';
        session.endTime = new Date();
        response.interviewComplete = true;
        response.message = 'That concludes our interview. Generating your report now...';
      }
    }

    await session.save();
    res.json(response);
  } catch (error) {
    console.error('Error processing answer:', error);
    res.status(500).json({ error: 'Failed to process answer' });
  }
});

// ── Submit follow-up answer ──
router.post('/:sessionId/follow-up-answer', async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer) return res.status(400).json({ error: 'answer is required' });

    const session = await AIInterview.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const lastQA = session.questionAnswerPairs[session.questionAnswerPairs.length - 1];
    if (lastQA?.followUps?.length > 0) {
      lastQA.followUps[lastQA.followUps.length - 1].answer = answer;
    }

    session.hasFollowUp = false;
    session.currentQuestionIndex += 1;

    let response = {
      questionNumber: session.currentQuestionIndex + 1,
      totalQuestions: session.totalQuestions,
    };

    if (session.currentQuestionIndex < session.questions.length) {
      const nextQ = session.questions[session.currentQuestionIndex];
      response.nextQuestion = nextQ.question;
      response.question = nextQ.question;
      response.questionMetadata = {
        id: nextQ.id, topic: nextQ.topic, difficulty: nextQ.difficulty,
        number: session.currentQuestionIndex + 1, total: session.totalQuestions,
      };
      response.message = "Thank you. Let's move on:";
    } else {
      session.status = 'completed';
      session.endTime = new Date();
      response.interviewComplete = true;
      response.message = 'That concludes our interview. Generating your report now...';
    }

    await session.save();
    res.json(response);
  } catch (error) {
    console.error('Error processing follow-up:', error);
    res.status(500).json({ error: 'Failed to process follow-up answer' });
  }
});

// ── End interview early ──
router.post('/:sessionId/end', async (req, res) => {
  try {
    const session = await AIInterview.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = 'ended';
    session.endTime = new Date();

    if (session.questionAnswerPairs.length > 0) {
      const scores = session.questionAnswerPairs.map(qa => safeNum(qa.evaluation?.overallScore));
      session.overallScore = safeNum(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
      const os = session.overallScore;
      session.sectionScores = {
        technical: safeNum(Math.round(os * (0.85 + Math.random() * 0.3))),
        communication: safeNum(Math.round(os * (0.8 + Math.random() * 0.3))),
        problemSolving: safeNum(Math.round(os * (0.85 + Math.random() * 0.3))),
        domain: safeNum(Math.round(os * (0.8 + Math.random() * 0.3))),
        aptitude: safeNum(Math.round(os * (0.9 + Math.random() * 0.2))),
      };
    }

    await session.save();
    res.json({ message: 'Interview ended', sessionId: req.params.sessionId });
  } catch (error) {
    console.error('Error ending interview:', error);
    res.status(500).json({ error: 'Failed to end interview' });
  }
});

// ── Generate / Get report ──
router.post('/:sessionId/report', async (req, res) => {
  try {
    const session = await AIInterview.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const duration = Math.round(
      (new Date(session.endTime || new Date()) - new Date(session.startTime)) / 60000
    );

    const report = await aiInterviewer.generateFinalReport({
      candidateName: session.candidateName, role: session.role,
      questionAnswerPairs: session.questionAnswerPairs, duration,
      sessionId: req.params.sessionId,
    });

    session.report = report;
    if (report.scores?.overall) session.overallScore = safeNum(report.scores.overall);
    if (report.scores) {
      session.sectionScores = {
        technical: safeNum(report.scores.technicalKnowledge || report.scores.technical),
        communication: safeNum(report.scores.communication),
        problemSolving: safeNum(report.scores.problemSolving),
        domain: safeNum(report.scores.confidence || report.scores.domain),
        aptitude: safeNum(report.scores.consistency || report.scores.aptitude),
      };
    }
    await session.save();
    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.get('/:sessionId/report', async (req, res) => {
  try {
    const session = await AIInterview.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const duration = Math.round(
      (new Date(session.endTime || new Date()) - new Date(session.startTime)) / 60000
    );

    // Always (re)generate report from live data for accuracy
    let report;
    try {
      report = await aiInterviewer.generateFinalReport({
        candidateName: session.candidateName, role: session.role,
        questionAnswerPairs: session.questionAnswerPairs, duration,
        sessionId: req.params.sessionId,
      });
    } catch (e) {
      console.error('AI report gen failed, building from raw data:', e.message);
      report = null;
    }

    // Build per-question results from raw QA pairs
    const questionResults = session.questionAnswerPairs.map((qa, idx) => {
      const ev = qa.evaluation || {};
      const meta = qa.questionMetadata || session.questions[idx] || {};
      const getScore = (field) => {
        const v = ev[field];
        if (v && typeof v === 'object') return safeNum(v.score);
        return safeNum(v);
      };
      const getFeedback = (field) => {
        const v = ev[field];
        if (v && typeof v === 'object') return v.feedback || '';
        return '';
      };
      return {
        number: idx + 1,
        question: qa.question,
        answer: qa.answer,
        topic: meta.topic || 'General',
        difficulty: meta.difficulty || 'Medium',
        expectedSkills: meta.expectedSkills || [],
        score: safeNum(ev.overallScore),
        feedback: ev.detailedFeedback || getFeedback('communication') || 'Evaluated',
        technicalKnowledge: getScore('technicalKnowledge'),
        communication: getScore('communication'),
        problemSolving: getScore('problemSolving'),
        confidence: getScore('confidence'),
        consistency: getScore('consistency'),
        technicalFeedback: getFeedback('technicalKnowledge'),
        communicationFeedback: getFeedback('communication'),
        problemSolvingFeedback: getFeedback('problemSolving'),
        strengths: Array.isArray(ev.strengths) ? ev.strengths : [],
        weaknesses: Array.isArray(ev.weaknesses) ? ev.weaknesses : [],
        followUps: qa.followUps || [],
      };
    });

    // Compute averages from per-question scores
    const count = questionResults.length || 1;
    const avg = (key) => safeNum(Math.round(questionResults.reduce((s, q) => s + safeNum(q[key]), 0) / count));
    const overallScore = avg('score');

    const scores = {
      overall: safeNum(report?.scores?.overall) || overallScore,
      technicalKnowledge: safeNum(report?.scores?.technicalKnowledge) || avg('technicalKnowledge'),
      communication: safeNum(report?.scores?.communication) || avg('communication'),
      problemSolving: safeNum(report?.scores?.problemSolving) || avg('problemSolving'),
      confidence: safeNum(report?.scores?.confidence) || avg('confidence'),
      consistency: safeNum(report?.scores?.consistency) || avg('consistency'),
    };

    // Build normalized response the frontend expects
    // Topic-wise performance breakdown
    const topicMap = {};
    questionResults.forEach(q => {
      const topic = q.topic || 'General';
      if (!topicMap[topic]) topicMap[topic] = { scores: [], questions: 0 };
      topicMap[topic].scores.push(q.score);
      topicMap[topic].questions += 1;
    });
    const topicPerformance = Object.entries(topicMap).map(([topic, data]) => ({
      topic,
      averageScore: safeNum(Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)),
      questionsCount: data.questions,
      maxScore: Math.max(...data.scores),
      minScore: Math.min(...data.scores),
    }));

    // Difficulty-wise breakdown
    const diffMap = {};
    questionResults.forEach(q => {
      const diff = q.difficulty || 'Medium';
      if (!diffMap[diff]) diffMap[diff] = { scores: [], count: 0 };
      diffMap[diff].scores.push(q.score);
      diffMap[diff].count += 1;
    });
    const difficultyBreakdown = Object.entries(diffMap).map(([difficulty, data]) => ({
      difficulty,
      averageScore: safeNum(Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)),
      count: data.count,
    }));

    // Compute performance trend (are scores improving across the interview?)
    const performanceTrend = questionResults.map(q => q.score);
    const firstHalf = performanceTrend.slice(0, Math.ceil(performanceTrend.length / 2));
    const secondHalf = performanceTrend.slice(Math.ceil(performanceTrend.length / 2));
    const firstHalfAvg = firstHalf.length ? safeNum(Math.round(firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length)) : 0;
    const secondHalfAvg = secondHalf.length ? safeNum(Math.round(secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length)) : 0;
    const trendDirection = secondHalfAvg > firstHalfAvg ? 'improving' : secondHalfAvg < firstHalfAvg ? 'declining' : 'stable';

    const normalized = {
      candidateName: session.candidateName,
      candidateId: session.candidateId,
      role: session.role,
      experience: session.experience,
      topics: session.topics,
      interviewDate: session.startTime,
      endTime: session.endTime,
      duration,
      totalQuestions: session.questions.length,
      questionsAnswered: session.questionAnswerPairs.length,
      overallScore: scores.overall,
      scores,
      strengths: report?.strengths?.length ? report.strengths : questionResults.flatMap(q => q.strengths).filter((v,i,a) => v && a.indexOf(v) === i).slice(0, 5),
      improvements: report?.weaknesses?.length ? report.weaknesses : questionResults.flatMap(q => q.weaknesses).filter((v,i,a) => v && a.indexOf(v) === i).slice(0, 5),
      questionResults,
      topicPerformance,
      difficultyBreakdown,
      performanceTrend: {
        scores: performanceTrend,
        direction: trendDirection,
        firstHalfAvg,
        secondHalfAvg,
      },
      recommendation: report?.recommendation || {
        recommendation: scores.overall >= 80 ? 'Strongly Recommend' : scores.overall >= 70 ? 'Recommend' : scores.overall >= 50 ? 'Maybe' : 'Not Recommend',
        reasoning: `Based on overall score of ${scores.overall}/100`,
        fitScore: scores.overall,
        nextSteps: scores.overall >= 70 ? 'Proceed to next interview round' : 'Consider additional screening',
      },
      detailedFeedback: report?.questionDetails?.map(q => q.evaluation?.detailedFeedback).filter(Boolean).join('\n\n') || questionResults.map(q => `Q${q.number}: ${q.feedback}`).join('\n\n'),
    };

    // Persist to DB
    session.report = normalized;
    session.overallScore = safeNum(scores.overall);
    session.sectionScores = {
      technical: safeNum(scores.technicalKnowledge),
      communication: safeNum(scores.communication),
      problemSolving: safeNum(scores.problemSolving),
      domain: safeNum(scores.confidence),
      aptitude: safeNum(scores.consistency),
    };
    await session.save();

    res.json(normalized);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

export default router;
