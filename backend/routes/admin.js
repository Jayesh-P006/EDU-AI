import express from 'express';
import mongoose from 'mongoose';
import {verifyAuth} from '../middleware/auth.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Application from '../models/Application.js';
import AIInterview from '../models/AIInterview.js';
import InterviewProctoring from '../models/InterviewProctoring.js';
import CompanyGovernance from '../models/CompanyGovernance.js';
import GlobalAIConfig from '../models/GlobalAIConfig.js';
import AuditLog from '../models/AuditLog.js';
import SecurityControl from '../models/SecurityControl.js';
import {writeAuditLog} from '../services/auditLog.js';

const router=express.Router();

async function requireAdmin(req, res, next)
{
  try
  {
    const currentUser=await User.findById(req.user?.userId).select('role isActive');
    if (!currentUser)
    {
      return res.status(401).json({message: 'Authentication required'});
    }

    if (currentUser.isActive===false)
    {
      return res.status(403).json({message: 'Account is suspended'});
    }

    if (currentUser.role!=='admin')
    {
      return res.status(403).json({message: 'Admin access required'});
    }

    req.currentUser=currentUser;
    next();
  } catch (err)
  {
    return res.status(500).json({message: `Auth check failed: ${err.message}`});
  }
}

router.use(verifyAuth, requireAdmin);

const AI_PATTERN_REGEX=/(ai|generated|copilot|chatgpt|llm|gemini|pattern)/i;

function startOfDaysAgo(daysAgo)
{
  const d=new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate()-daysAgo);
  return d;
}

function mapDateCounts(rows, key='count')
{
  const out=[];
  for (let i=6; i>=0; i--)
  {
    const d=startOfDaysAgo(i);
    const day=d.toISOString().slice(0, 10);
    const found=rows.find((r) => r._id===day);
    out.push({day, value: Number(found?.[key]||0)});
  }
  return out;
}

function computeFraudSignals(events=[])
{
  const tabSwitchCount=events.filter((e) => e.eventType==='tab_switch').length;
  const multiFaceCount=events.filter((e) => e.eventType==='multiple_faces').length;
  const copyPasteCount=events.filter((e) => e.eventType==='copy'||e.eventType==='paste').length;
  const aiCodePatternCount=events.filter((e) =>
  {
    if (e.eventType!=='suspicious_activity') return false;
    const text=[e.description, JSON.stringify(e.metadata||{})].join(' ');
    return AI_PATTERN_REGEX.test(text);
  }).length;

  return {tabSwitchCount, multiFaceCount, copyPasteCount, aiCodePatternCount};
}

async function getGlobalAIConfig()
{
  const config=await GlobalAIConfig.findOneAndUpdate(
    {key: 'global'},
    {$setOnInsert: {key: 'global'}},
    {new: true, upsert: true}
  ).lean();
  return config;
}

async function getSecurityControl()
{
  const control=await SecurityControl.findOneAndUpdate(
    {key: 'global'},
    {$setOnInsert: {key: 'global'}},
    {new: true, upsert: true}
  );
  return control;
}

function toPercent(part=0, total=0)
{
  if (!total) return 0;
  return Number(((part/total)*100).toFixed(2));
}

function computeRiskLevel({integrityScore=100, tabSwitchCount=0, multiFaceCount=0, copyPasteCount=0, aiCodePatternCount=0, mismatch=false, fraudSensitivityLevel='medium'})
{
  let riskScore=0;
  if (integrityScore<40) riskScore+=4;
  else if (integrityScore<60) riskScore+=3;
  else if (integrityScore<75) riskScore+=2;
  else riskScore+=1;

  riskScore+=Math.min(3, Math.floor(tabSwitchCount/3));
  riskScore+=Math.min(3, multiFaceCount>0? 2+Math.floor((multiFaceCount-1)/2):0);
  riskScore+=Math.min(2, Math.floor(copyPasteCount/3));
  riskScore+=Math.min(2, aiCodePatternCount>0? 1+Math.floor((aiCodePatternCount-1)/2):0);
  if (mismatch) riskScore+=2;

  if (fraudSensitivityLevel==='high') riskScore+=1;
  if (fraudSensitivityLevel==='low') riskScore-=1;
  riskScore=Math.max(0, riskScore);

  if (riskScore>=9) return 'CRITICAL';
  if (riskScore>=7) return 'HIGH';
  if (riskScore>=4) return 'MEDIUM';
  return 'LOW';
}

router.get('/analytics/overview', async (req, res) =>
{
  try
  {
    const companyRoles=['company_admin', 'company_hr', 'recruiter'];
    const completedStatuses=['completed', 'ended'];

    const [
      companyNamesFromUsers,
      companyNamesFromJobs,
      totalCandidates,
      totalJobs,
      totalAssessments,
      totalAssessmentsCompleted,
      avgScoreAgg,
      avgIntegrityAgg,
      fraudFlaggedCount,
    ]=await Promise.all([
      User.distinct('companyName', {role: {$in: companyRoles}, companyName: {$exists: true, $ne: ''}}),
      Job.distinct('companyName', {companyName: {$exists: true, $ne: ''}}),
      User.countDocuments({role: 'candidate'}),
      Job.countDocuments(),
      AIInterview.countDocuments(),
      AIInterview.countDocuments({status: {$in: completedStatuses}}),
      AIInterview.aggregate([
        {$match: {status: {$in: completedStatuses}, overallScore: {$ne: null}}},
        {$group: {_id: null, value: {$avg: '$overallScore'}}},
      ]),
      InterviewProctoring.aggregate([
        {$match: {integrityScore: {$ne: null}}},
        {$group: {_id: null, value: {$avg: '$integrityScore'}}},
      ]),
      InterviewProctoring.countDocuments({$or: [{isFlagged: true}, {requiresReview: true}]}),
    ]);

    const totalCompanies=new Set([
      ...(companyNamesFromUsers||[]),
      ...(companyNamesFromJobs||[]),
    ]).size;

    const avgScoreRaw=avgScoreAgg?.[0]?.value;
    const avgIntegrityRaw=avgIntegrityAgg?.[0]?.value;

    const fraudFlagRate=totalAssessmentsCompleted>0
      ? (fraudFlaggedCount/totalAssessmentsCompleted)*100
      :0;

    const completionRate=totalAssessments>0
      ? (totalAssessmentsCompleted/totalAssessments)*100
      :0;

    return res.json({
      total_companies: totalCompanies,
      total_candidates: totalCandidates,
      total_jobs: totalJobs,
      total_assessments_completed: totalAssessmentsCompleted,
      fraud_flag_rate: Number(fraudFlagRate.toFixed(2)),
      avg_score: avgScoreRaw!==undefined&&avgScoreRaw!==null? Number(avgScoreRaw.toFixed(2)):null,
      avg_integrity_score: avgIntegrityRaw!==undefined&&avgIntegrityRaw!==null? Number(avgIntegrityRaw.toFixed(2)):null,
      completion_rate: Number(completionRate.toFixed(2)),
    });
  } catch (err)
  {
    console.error('[ADMIN] analytics overview error:', err);
    return res.status(500).json({
      message: 'Failed to fetch analytics overview',
      error: err.message,
      code: 'ANALYTICS_OVERVIEW_FAILED',
    });
  }
});

router.get('/analytics/trends', async (req, res) =>
{
  try
  {
    const since=startOfDaysAgo(6);

    const [jobsByDay, candidatesByDay, completedAssessmentsByDay, avgScoreByDay, fraudSignalAgg]=await Promise.all([
      Job.aggregate([
        {$match: {createdAt: {$gte: since}}},
        {$group: {_id: {$dateToString: {format: '%Y-%m-%d', date: '$createdAt'}}, count: {$sum: 1}}},
      ]),
      User.aggregate([
        {$match: {role: 'candidate', createdAt: {$gte: since}}},
        {$group: {_id: {$dateToString: {format: '%Y-%m-%d', date: '$createdAt'}}, count: {$sum: 1}}},
      ]),
      AIInterview.aggregate([
        {$match: {status: {$in: ['completed', 'ended']}, updatedAt: {$gte: since}}},
        {$group: {_id: {$dateToString: {format: '%Y-%m-%d', date: '$updatedAt'}}, count: {$sum: 1}}},
      ]),
      AIInterview.aggregate([
        {$match: {status: {$in: ['completed', 'ended']}, overallScore: {$ne: null}, updatedAt: {$gte: since}}},
        {$group: {_id: {$dateToString: {format: '%Y-%m-%d', date: '$updatedAt'}}, avgScore: {$avg: '$overallScore'}}},
      ]),
      InterviewProctoring.aggregate([
        {$match: {createdAt: {$gte: since}}},
        {$unwind: {path: '$events', preserveNullAndEmptyArrays: true}},
        {$group: {_id: '$events.eventType', count: {$sum: 1}}},
      ]),
    ]);

    const avgScoreSeries=[];
    for (let i=6; i>=0; i--)
    {
      const d=startOfDaysAgo(i);
      const day=d.toISOString().slice(0, 10);
      const row=avgScoreByDay.find((r) => r._id===day);
      avgScoreSeries.push({day, value: row?.avgScore? Number(row.avgScore.toFixed(2)):0});
    }

    const fraudSignals={
      tab_switch: 0,
      multiple_faces: 0,
      copy_paste: 0,
      suspicious_activity: 0,
    };

    for (const row of fraudSignalAgg)
    {
      if (row._id==='tab_switch') fraudSignals.tab_switch=row.count;
      if (row._id==='multiple_faces') fraudSignals.multiple_faces=row.count;
      if (row._id==='copy'||row._id==='paste') fraudSignals.copy_paste+=row.count;
      if (row._id==='suspicious_activity') fraudSignals.suspicious_activity=row.count;
    }

    return res.json({
      jobs_created: mapDateCounts(jobsByDay),
      candidates_registered: mapDateCounts(candidatesByDay),
      assessments_completed: mapDateCounts(completedAssessmentsByDay),
      average_scores: avgScoreSeries,
      fraud_signals: fraudSignals,
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch analytics trends: ${err.message}`});
  }
});

router.get('/analytics/fraud-signals/:signalType/students', async (req, res) =>
{
  try
  {
    const {signalType}=req.params;
    const signalMatchers={
      tab_switch: (evt) => evt?.eventType==='tab_switch',
      multiple_faces: (evt) => evt?.eventType==='multiple_faces',
      copy_paste: (evt) => evt?.eventType==='copy'||evt?.eventType==='paste',
      suspicious_activity: (evt) => evt?.eventType==='suspicious_activity',
    };

    const matcher=signalMatchers[signalType];
    if (!matcher)
    {
      return res.status(400).json({message: 'Invalid signal type'});
    }

    const rows=await InterviewProctoring.find({})
      .populate('userId', 'username fullName email')
      .sort({updatedAt: -1})
      .limit(500)
      .lean();

    const studentMap=new Map();

    for (const row of rows)
    {
      const matchingEvents=(row.events||[]).filter(matcher);
      if (!matchingEvents.length) continue;

      const studentId=String(row.userId?._id||row.userId||'unknown');
      const latestEventTs=matchingEvents
        .map((e) => new Date(e.timestamp||row.updatedAt||row.createdAt||Date.now()).getTime())
        .reduce((max, ts) => Math.max(max, ts), 0);

      const existing=studentMap.get(studentId)||{
        studentId,
        username: row.userId?.username||'Unknown',
        fullName: row.userId?.fullName||'',
        email: row.userId?.email||'',
        signalCount: 0,
        sessionCount: 0,
        latestEventAt: null,
        latestEventTs: 0,
      };

      existing.signalCount+=matchingEvents.length;
      existing.sessionCount+=1;
      if (latestEventTs>existing.latestEventTs)
      {
        existing.latestEventTs=latestEventTs;
        existing.latestEventAt=new Date(latestEventTs).toISOString();
      }

      studentMap.set(studentId, existing);
    }

    const students=[...studentMap.values()]
      .sort((a, b) => b.latestEventTs-a.latestEventTs)
      .map(({latestEventTs, ...rest}) => rest);

    return res.json({
      signalType,
      totalStudents: students.length,
      totalSignalEvents: students.reduce((sum, row) => sum+Number(row.signalCount||0), 0),
      students,
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch fraud signal students: ${err.message}`});
  }
});

router.get('/fraud/center', async (req, res) =>
{
  try
  {
    const selectedCompany=String(req.query.companyName||'all').trim();
    const globalConfig=await getGlobalAIConfig();
    let proctoringFilter={};
    if (selectedCompany&&selectedCompany!=='all')
    {
      const companyJobIds=await Job.find({companyName: selectedCompany}).distinct('_id');
      const companyCandidateIds=companyJobIds.length
        ? await Application.distinct('candidate', {job: {$in: companyJobIds}})
        : [];

      proctoringFilter=companyCandidateIds.length
        ? {userId: {$in: companyCandidateIds}}
        : {_id: {$exists: false}};
    }

    const rows=await InterviewProctoring.find(proctoringFilter)
      .populate('userId', 'username email isActive verification')
      .sort({updatedAt: -1})
      .limit(200)
      .lean();

    const candidateIds=[...new Set(
      rows
        .map((r) => r.userId?._id)
        .filter(Boolean)
        .map((id) => String(id))
    )];

    const applicationRows=candidateIds.length
      ? await Application.find({candidate: {$in: candidateIds}})
        .select('candidate job createdAt')
        .populate('job', 'companyName')
        .sort({createdAt: -1})
        .lean()
      : [];

    const candidateCompanyMap=new Map();
    for (const app of applicationRows)
    {
      const candidateKey=String(app.candidate||'');
      if (!candidateKey||candidateCompanyMap.has(candidateKey)) continue;
      const companyName=app.job?.companyName||'Unassigned';
      candidateCompanyMap.set(candidateKey, companyName);
    }

    const interviewIds=[...new Set(
      rows
        .map((r) => r.interviewId)
        .filter((id) => id&&mongoose.Types.ObjectId.isValid(String(id)))
        .map((id) => String(id))
    )];

    const interviews=interviewIds.length
      ? await AIInterview.find({_id: {$in: interviewIds}}).select('_id sessionId role overallScore status').lean()
      : [];
    const interviewMap=new Map(interviews.map((row) => [String(row._id), row]));

    const cases=rows.map((row) =>
    {
      const signals=computeFraudSignals(row.events||[]);
      const verification=row.userId?.verification||{};
      const layer3=verification.layer3||{};

      const interviewData=interviewMap.get(String(row.interviewId))||null;

      const mismatch=Boolean(
        (layer3.riskLevel&&['HIGH', 'MEDIUM'].includes(layer3.riskLevel))
        ||((interviewData?.overallScore||0)<60&&(layer3.overclaimed_skills||[]).length>0)
      );

      const riskLevel=computeRiskLevel({
        integrityScore: row.integrityScore,
        tabSwitchCount: signals.tabSwitchCount,
        multiFaceCount: signals.multiFaceCount,
        copyPasteCount: signals.copyPasteCount,
        aiCodePatternCount: signals.aiCodePatternCount,
        mismatch,
        fraudSensitivityLevel: globalConfig?.fraudSensitivityLevel||'medium',
      });

      return {
        id: row._id,
        proctoringId: row._id,
        candidateId: row.userId?._id||null,
        companyName: candidateCompanyMap.get(String(row.userId?._id||''))||'Unassigned',
        candidate: row.userId?.username||'Unknown',
        email: row.userId?.email||'',
        userActive: row.userId?.isActive!==false,
        interviewSession: interviewData?.sessionId||'',
        interviewRole: interviewData?.role||'',
        interviewScore: interviewData?.overallScore?? null,
        integrityScore: row.integrityScore,
        violationCount: row.violationCount,
        warningCount: row.warningCount,
        tabSwitchCount: signals.tabSwitchCount,
        multiFaceCount: signals.multiFaceCount,
        copyPasteCount: signals.copyPasteCount,
        aiCodePatternCount: signals.aiCodePatternCount,
        resumePerformanceMismatch: mismatch,
        riskLevel,
        isFlagged: row.isFlagged,
        requiresReview: row.requiresReview,
        flagReason: row.flagReason||'',
        updatedAt: row.updatedAt,
      };
    });

    const companyMap=cases.reduce((acc, row) =>
    {
      const key=row.companyName||'Unassigned';
      if (!acc.has(key))
      {
        acc.set(key, {companyName: key, count: 0});
      }
      acc.get(key).count+=1;
      return acc;
    }, new Map());

    const companies=[...companyMap.values()].sort((a, b) => b.count-a.count);

    const scopedCases=selectedCompany==='all'
      ? cases
      : cases.filter((row) => row.companyName===selectedCompany);

    const summary={
      total: scopedCases.length,
      critical: scopedCases.filter((c) => c.riskLevel==='CRITICAL').length,
      high: scopedCases.filter((c) => c.riskLevel==='HIGH').length,
      medium: scopedCases.filter((c) => c.riskLevel==='MEDIUM').length,
      low: scopedCases.filter((c) => c.riskLevel==='LOW').length,
    };

    return res.json({summary, cases: scopedCases, companies, selectedCompany});
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch fraud center data: ${err.message}`});
  }
});

router.get('/fraud/:proctoringId/details', async (req, res) =>
{
  try
  {
    const globalConfig=await getGlobalAIConfig();
    const {proctoringId}=req.params;
    const row=await InterviewProctoring.findById(proctoringId)
      .populate('userId', 'username fullName email role isActive companyName headline bio skills experience education verification profileComplete createdAt')
      .lean();

    if (!row)
    {
      return res.status(404).json({message: 'Proctoring case not found'});
    }

    let interviewData=null;
    if (row.interviewId&&mongoose.Types.ObjectId.isValid(String(row.interviewId)))
    {
      interviewData=await AIInterview.findById(row.interviewId)
        .select('sessionId role overallScore status startTime endTime totalQuestions questionAnswerPairs')
        .lean();
    }

    const signals=computeFraudSignals(row.events||[]);
    const verification=row.userId?.verification||{};
    const layer3=verification.layer3||{};
    const mismatch=Boolean(
      (layer3.riskLevel&&['HIGH', 'MEDIUM'].includes(layer3.riskLevel))
      ||((interviewData?.overallScore||0)<60&&(layer3.overclaimed_skills||[]).length>0)
    );

    const riskLevel=computeRiskLevel({
      integrityScore: row.integrityScore,
      tabSwitchCount: signals.tabSwitchCount,
      multiFaceCount: signals.multiFaceCount,
      copyPasteCount: signals.copyPasteCount,
      aiCodePatternCount: signals.aiCodePatternCount,
      mismatch,
      fraudSensitivityLevel: globalConfig?.fraudSensitivityLevel||'medium',
    });

    const events=(row.events||[])
      .map((e) => ({
        eventType: e.eventType,
        severity: e.severity,
        description: e.description||'',
        timestamp: e.timestamp,
        metadata: e.metadata||{},
      }))
      .sort((a, b) => new Date(b.timestamp)-new Date(a.timestamp));

    return res.json({
      case: {
        id: row._id,
        proctoringId: row._id,
        integrityScore: row.integrityScore,
        violationCount: row.violationCount,
        warningCount: row.warningCount,
        tabSwitchCount: signals.tabSwitchCount,
        multiFaceCount: signals.multiFaceCount,
        copyPasteCount: signals.copyPasteCount,
        aiCodePatternCount: signals.aiCodePatternCount,
        resumePerformanceMismatch: mismatch,
        riskLevel,
        isFlagged: row.isFlagged,
        requiresReview: row.requiresReview,
        flagReason: row.flagReason||'',
        notes: row.proctoringNotes||'',
        updatedAt: row.updatedAt,
      },
      candidateProfile: row.userId? {
        id: row.userId._id,
        username: row.userId.username,
        fullName: row.userId.fullName||'',
        email: row.userId.email,
        role: row.userId.role,
        isActive: row.userId.isActive!==false,
        companyName: row.userId.companyName||'',
        headline: row.userId.headline||'',
        bio: row.userId.bio||'',
        skills: row.userId.skills||[],
        experience: row.userId.experience||[],
        education: row.userId.education||[],
        profileComplete: row.userId.profileComplete||0,
        verification: row.userId.verification||null,
        createdAt: row.userId.createdAt,
      }:null,
      interview: interviewData? {
        sessionId: interviewData.sessionId,
        role: interviewData.role,
        overallScore: interviewData.overallScore,
        status: interviewData.status,
        startTime: interviewData.startTime,
        endTime: interviewData.endTime,
        totalQuestions: interviewData.totalQuestions||0,
        answeredQuestions: interviewData.questionAnswerPairs?.length||0,
      }:null,
      timeline: events,
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch fraud case details: ${err.message}`});
  }
});

router.patch('/fraud/:proctoringId/override', async (req, res) =>
{
  try
  {
    const {proctoringId}=req.params;
    const {note='Override approved by admin'}=req.body||{};

    const proctoring=await InterviewProctoring.findById(proctoringId);
    if (!proctoring)
    {
      return res.status(404).json({message: 'Proctoring case not found'});
    }

    proctoring.isFlagged=false;
    proctoring.requiresReview=false;
    proctoring.flagReason='';
    proctoring.proctoringNotes=[proctoring.proctoringNotes, `[${new Date().toISOString()}] OVERRIDE: ${note}`].filter(Boolean).join('\n');
    proctoring.proctoredBy=req.user.userId;
    await proctoring.save();

    await writeAuditLog(req, {
      actionType: 'fraud_override',
      category: 'fraud',
      status: 'success',
      actorId: req.user.userId,
      targetType: 'proctoring_case',
      targetId: proctoring._id,
      metadata: {note},
    });

    return res.json({message: 'Fraud flag overridden successfully'});
  } catch (err)
  {
    return res.status(500).json({message: `Failed to override fraud case: ${err.message}`});
  }
});

router.post('/fraud/:proctoringId/suspend', async (req, res) =>
{
  try
  {
    const {proctoringId}=req.params;
    const {reason='Suspended by admin due to integrity risk'}=req.body||{};

    const proctoring=await InterviewProctoring.findById(proctoringId).populate('userId');
    if (!proctoring)
    {
      return res.status(404).json({message: 'Proctoring case not found'});
    }

    if (!proctoring.userId)
    {
      return res.status(400).json({message: 'Candidate account missing for this case'});
    }

    proctoring.userId.isActive=false;
    await proctoring.userId.save();

    proctoring.isFlagged=true;
    proctoring.requiresReview=true;
    proctoring.flagReason=reason;
    proctoring.proctoringNotes=[proctoring.proctoringNotes, `[${new Date().toISOString()}] SUSPEND: ${reason}`].filter(Boolean).join('\n');
    proctoring.proctoredBy=req.user.userId;
    await proctoring.save();

    await writeAuditLog(req, {
      actionType: 'fraud_suspend_candidate',
      category: 'fraud',
      status: 'success',
      actorId: req.user.userId,
      targetType: 'user',
      targetId: proctoring.userId._id,
      targetLabel: proctoring.userId.username,
      metadata: {proctoringId, reason},
    });

    return res.json({
      message: 'Candidate suspended successfully',
      candidateId: proctoring.userId._id,
      candidate: proctoring.userId.username,
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to suspend candidate: ${err.message}`});
  }
});

router.post('/fraud/:proctoringId/reassess', async (req, res) =>
{
  try
  {
    const {proctoringId}=req.params;
    const {reason='Reassessment requested by admin'}=req.body||{};

    const proctoring=await InterviewProctoring.findById(proctoringId).populate('userId');
    if (!proctoring)
    {
      return res.status(404).json({message: 'Proctoring case not found'});
    }

    proctoring.isFlagged=true;
    proctoring.requiresReview=true;
    proctoring.flagReason=reason;
    proctoring.proctoringNotes=[proctoring.proctoringNotes, `[${new Date().toISOString()}] REASSESS: ${reason}`].filter(Boolean).join('\n');
    proctoring.proctoredBy=req.user.userId;
    await proctoring.save();

    if (proctoring.userId)
    {
      const existingVerification=proctoring.userId.verification||{};
      proctoring.userId.verification={
        ...existingVerification,
        reassessment: {
          requestedAt: new Date(),
          requestedBy: req.user.userId,
          reason,
          status: 'pending',
        },
      };
      proctoring.userId.markModified('verification');
      await proctoring.userId.save();
    }

    await writeAuditLog(req, {
      actionType: 'fraud_reassess_requested',
      category: 'fraud',
      status: 'success',
      actorId: req.user.userId,
      targetType: 'proctoring_case',
      targetId: proctoring._id,
      metadata: {reason},
    });

    return res.json({message: 'Reassessment request has been triggered'});
  } catch (err)
  {
    return res.status(500).json({message: `Failed to trigger reassessment: ${err.message}`});
  }
});

router.get('/overview', async (req, res) =>
{
  try
  {
    const sevenDaysAgo=new Date(Date.now()-7*24*60*60*1000);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      candidates,
      companyUsers,
      companyNamesFromUsers,
      companyNamesFromJobs,
      admins,
      totalJobs,
      activeJobs,
      totalApplications,
      totalInterviews,
      completedInterviews,
      flaggedProctoring,
      newUsers7d,
      newJobs7d,
      newApplications7d,
    ]=await Promise.all([
      User.countDocuments(),
      User.countDocuments({isActive: {$ne: false}}),
      User.countDocuments({isActive: false}),
      User.countDocuments({role: 'candidate'}),
      User.countDocuments({role: {$in: ['company_admin', 'company_hr', 'recruiter']}}),
      User.distinct('companyName', {role: {$in: ['company_admin', 'company_hr', 'recruiter']}, companyName: {$exists: true, $ne: ''}}),
      Job.distinct('companyName', {companyName: {$exists: true, $ne: ''}}),
      User.countDocuments({role: 'admin'}),
      Job.countDocuments(),
      Job.countDocuments({status: 'active'}),
      Application.countDocuments(),
      AIInterview.countDocuments(),
      AIInterview.countDocuments({status: {$in: ['completed', 'ended']}}),
      InterviewProctoring.countDocuments({$or: [{isFlagged: true}, {requiresReview: true}] }),
      User.countDocuments({createdAt: {$gte: sevenDaysAgo}}),
      Job.countDocuments({createdAt: {$gte: sevenDaysAgo}}),
      Application.countDocuments({createdAt: {$gte: sevenDaysAgo}}),
    ]);

    const totalCompanies=new Set([
      ...(companyNamesFromUsers||[]),
      ...(companyNamesFromJobs||[]),
    ]).size;

    return res.json({
      summary: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        candidates,
        totalCompanies,
        companyUsers,
        admins,
        totalJobs,
        activeJobs,
        totalApplications,
        totalInterviews,
        completedInterviews,
        flaggedProctoring,
      },
      recentGrowth: {
        users7d: newUsers7d,
        jobs7d: newJobs7d,
        applications7d: newApplications7d,
      },
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch overview: ${err.message}`});
  }
});

router.get('/users', async (req, res) =>
{
  try
  {
    const {role='all', status='all', search='', view='all', skill='all', skills='', placement='all'}=req.query;
    const filter={};
    const placedStatuses=['hired', 'selected', 'offered'];

    const escapedRegex=(value='') => new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    const selectedSkills=[
      ...(Array.isArray(skills)
        ? skills
        : String(skills||'').split(',')),
      ...(skill&&skill!=='all'? [skill]:[]),
    ]
      .map((entry) => String(entry||'').trim())
      .filter((entry) => entry&&entry!=='all');

    if (view==='all_candidates'||view==='skill_based')
    {
      filter.role='candidate';
    }

    if (role!=='all')
    {
      filter.role=role;
    }

    if (selectedSkills.length)
    {
      filter.skills={$in: selectedSkills.map((entry) => escapedRegex(entry))};
    }

    if (placement==='placed'||placement==='unplaced')
    {
      const placedIds=await Application.distinct('candidate', {
        status: {$in: placedStatuses},
      });

      if (placement==='placed')
      {
        filter._id={$in: placedIds};
      } else
      {
        filter._id={$nin: placedIds};
      }
    }

    if (status==='active')
    {
      filter.isActive={$ne: false};
    }

    if (status==='suspended')
    {
      filter.isActive=false;
    }

    if (search)
    {
      filter.$or=[
        {username: {$regex: search, $options: 'i'}},
        {email: {$regex: search, $options: 'i'}},
        {companyName: {$regex: search, $options: 'i'}},
      ];
    }

    const users=await User.find(filter)
      .select('_id username email role companyName isActive createdAt updatedAt skills')
      .sort({createdAt: -1})
      .limit(200)
      .lean();

    const candidateIds=users
      .filter((row) => row.role==='candidate')
      .map((row) => row._id);

    const placedCandidateIds=candidateIds.length
      ? await Application.distinct('candidate', {
        candidate: {$in: candidateIds},
        status: {$in: placedStatuses},
      })
      :[];

    const placedSet=new Set((placedCandidateIds||[]).map((row) => String(row)));

    return res.json({
      users: users.map((u) => ({
        id: u._id,
        username: u.username,
        email: u.email,
        role: u.role,
        companyName: u.companyName,
        isActive: u.isActive!==false,
        isPlaced: placedSet.has(String(u._id)),
        skills: u.skills||[],
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      count: users.length,
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch users: ${err.message}`});
  }
});

router.get('/users/skills', async (req, res) =>
{
  try
  {
    const skills=await User.aggregate([
      {$match: {role: 'candidate', skills: {$exists: true, $ne: []}}},
      {$unwind: '$skills'},
      {$project: {skill: {$trim: {input: '$skills'}}}},
      {$match: {skill: {$ne: ''}}},
      {
        $group: {
          _id: {$toLower: '$skill'},
          label: {$first: '$skill'},
          count: {$sum: 1},
        },
      },
      {$sort: {count: -1, label: 1}},
      {$limit: 100},
    ]);

    return res.json({
      skills: skills.map((row) => ({
        id: row._id,
        label: row.label,
        count: row.count,
      })),
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch candidate skills: ${err.message}`});
  }
});

router.patch('/users/:userId/status', async (req, res) =>
{
  try
  {
    const {userId}=req.params;
    const {isActive}=req.body;

    if (typeof isActive!=='boolean')
    {
      return res.status(400).json({message: 'isActive (boolean) is required'});
    }

    if (String(req.user.userId)===String(userId)&&isActive===false)
    {
      return res.status(400).json({message: 'You cannot suspend your own admin account'});
    }

    const updated=await User.findByIdAndUpdate(
      userId,
      {isActive},
      {new: true}
    ).select('_id username email role companyName isActive');

    if (!updated)
    {
      return res.status(404).json({message: 'User not found'});
    }

    try
    {
      await writeAuditLog(req, {
        actionType: isActive? 'admin_user_activated':'admin_user_suspended',
        category: 'admin',
        status: 'success',
        actorId: req.user.userId,
        targetType: 'user',
        targetId: updated._id,
        targetLabel: updated.username,
        metadata: {isActive},
      });
    } catch (auditErr)
    {
      console.warn('[ADMIN] user status audit log failed:', auditErr.message);
    }

    return res.json({
      message: `User ${isActive? 'activated':'suspended'} successfully`,
      user: {
        id: updated._id,
        username: updated.username,
        email: updated.email,
        role: updated.role,
        companyName: updated.companyName,
        isActive: updated.isActive!==false,
      },
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to update user status: ${err.message}`});
  }
});

router.get('/companies', async (req, res) =>
{
  try
  {
    const governanceRows=await CompanyGovernance.find({}).lean();
    const governanceMap=new Map(governanceRows.map((g) => [g.companyName, g]));

    const companyUsers=await User.find({role: {$in: ['company_admin', 'company_hr', 'recruiter']}})
      .select('_id username companyName isActive')
      .lean();

    const grouped={};
    for (const user of companyUsers)
    {
      const name=(user.companyName||user.username||'Unknown Company').trim();
      if (!grouped[name])
      {
        grouped[name]={
          companyName: name,
          userCount: 0,
          activeUserCount: 0,
          userIds: [],
        };
      }
      grouped[name].userCount+=1;
      if (user.isActive!==false) grouped[name].activeUserCount+=1;
      grouped[name].userIds.push(user._id);
    }

    const companies=[];
    for (const item of Object.values(grouped))
    {
      const jobs=await Job.find({postedBy: {$in: item.userIds}}).select('_id status applicantCount createdAt').lean();
      const jobIds=jobs.map((j) => j._id);

      const applications=jobIds.length>0
        ? await Application.find({job: {$in: jobIds}}).select('status candidate createdAt').lean()
        :[];

      const totalApplications=applications.length;
      const applicantIds=[...new Set(applications.map((a) => String(a.candidate)).filter(Boolean))];

      const flaggedApplicantIds=applicantIds.length>0
        ? await InterviewProctoring.distinct('userId', {
          userId: {$in: applicantIds},
          $or: [{isFlagged: true}, {requiresReview: true}],
        })
        :[];

      const fraudRate=applicantIds.length>0
        ? Number(((flaggedApplicantIds.length/applicantIds.length)*100).toFixed(2))
        :0;

      const hiringActivity={
        inInterview: applications.filter((a) => ['interview', 'assessment', 'screening'].includes(a.status)).length,
        offered: applications.filter((a) => a.status==='offered').length,
        hired: applications.filter((a) => a.status==='hired').length,
      };

      const governance=governanceMap.get(item.companyName)||null;

      companies.push({
        companyName: item.companyName,
        userCount: item.userCount,
        activeUserCount: item.activeUserCount,
        totalJobs: jobs.length,
        activeJobs: jobs.filter((j) => j.status==='active').length,
        totalApplications,
        fraudRate,
        hiringActivity,
        governanceStatus: governance?.status||'pending_review',
        governanceNotes: governance?.notes||'',
        reviewedAt: governance?.reviewedAt||null,
      });
    }

    companies.sort((a, b) => b.totalApplications-a.totalApplications);

    return res.json({companies});
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch companies: ${err.message}`});
  }
});

router.patch('/companies/governance', async (req, res) =>
{
  try
  {
    const {companyName, status, notes=''}=req.body;
    if (!companyName||typeof companyName!=='string')
    {
      return res.status(400).json({message: 'companyName is required'});
    }

    const allowedStatuses=['pending_review', 'approved', 'rejected', 'suspended'];
    if (!allowedStatuses.includes(status))
    {
      return res.status(400).json({message: 'Invalid governance status'});
    }

    const governance=await CompanyGovernance.findOneAndUpdate(
      {companyName: companyName.trim()},
      {
        companyName: companyName.trim(),
        status,
        notes,
        reviewedBy: req.user.userId,
        reviewedAt: new Date(),
      },
      {new: true, upsert: true}
    );

    if (status==='suspended'||status==='rejected')
    {
      await User.updateMany(
        {companyName: companyName.trim(), role: {$in: ['company_admin', 'company_hr', 'recruiter']}},
        {$set: {isActive: false}}
      );
    }

    if (status==='approved')
    {
      await User.updateMany(
        {companyName: companyName.trim(), role: {$in: ['company_admin', 'company_hr', 'recruiter']}},
        {$set: {isActive: true}}
      );
    }

    await writeAuditLog(req, {
      actionType: 'company_governance_updated',
      category: 'governance',
      status: 'success',
      actorId: req.user.userId,
      targetType: 'company',
      targetLabel: companyName.trim(),
      metadata: {status, notes},
    });

    return res.json({
      message: 'Company governance updated successfully',
      governance,
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to update company governance: ${err.message}`});
  }
});

router.get('/config/global-ai', async (req, res) =>
{
  try
  {
    const config=await getGlobalAIConfig();
    return res.json({config});
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch global AI config: ${err.message}`});
  }
});

router.put('/config/global-ai', async (req, res) =>
{
  try
  {
    const {
      integrityThresholds,
      skillWeightDistribution,
      fraudSensitivityLevel,
      aiDifficultyScaling,
    }=req.body||{};

    const allowedSensitivity=['low', 'medium', 'high'];
    if (fraudSensitivityLevel&&!allowedSensitivity.includes(fraudSensitivityLevel))
    {
      return res.status(400).json({message: 'Invalid fraudSensitivityLevel'});
    }

    if (skillWeightDistribution)
    {
      const sum=Object.values(skillWeightDistribution).reduce((acc, v) => acc+Number(v||0), 0);
      if (Math.round(sum)!==100)
      {
        return res.status(400).json({message: 'Skill weight distribution must total 100'});
      }
    }

    const update={
      ...(integrityThresholds? {integrityThresholds}:{}),
      ...(skillWeightDistribution? {skillWeightDistribution}:{}),
      ...(fraudSensitivityLevel? {fraudSensitivityLevel}:{}),
      ...(aiDifficultyScaling? {aiDifficultyScaling}:{}),
      updatedBy: req.user.userId,
    };

    const config=await GlobalAIConfig.findOneAndUpdate(
      {key: 'global'},
      {$set: update, $setOnInsert: {key: 'global'}},
      {new: true, upsert: true}
    );

    await writeAuditLog(req, {
      actionType: 'global_ai_config_updated',
      category: 'configuration',
      status: 'success',
      actorId: req.user.userId,
      targetType: 'configuration',
      targetId: config._id,
      targetLabel: 'global_ai',
      metadata: {
        integrityThresholds: Boolean(integrityThresholds),
        skillWeightDistribution: Boolean(skillWeightDistribution),
        fraudSensitivityLevel: fraudSensitivityLevel||null,
        aiDifficultyScaling: Boolean(aiDifficultyScaling),
      },
    });

    return res.json({message: 'Global AI configuration updated', config});
  } catch (err)
  {
    return res.status(500).json({message: `Failed to update global AI config: ${err.message}`});
  }
});

router.get('/jobs', async (req, res) =>
{
  try
  {
    const jobs=await Job.find({})
      .populate('postedBy', 'username companyName email')
      .sort({createdAt: -1})
      .limit(200)
      .lean();

    const jobIds=jobs.map((job) => job._id);
    const appAgg=jobIds.length
      ? await Application.aggregate([
        {$match: {job: {$in: jobIds}}},
        {
          $group: {
            _id: '$job',
            applicationsReceived: {$sum: 1},
            avgCandidateScore: {$avg: '$score'},
          },
        },
      ])
      : [];

    const appMap=new Map(appAgg.map((item) => [String(item._id), item]));

    return res.json({
      jobs: jobs.map((job) => ({
        ...(() =>
        {
          const metrics=appMap.get(String(job._id));
          const avgScoreRaw=metrics?.avgCandidateScore;
          const applicationsReceived=Number(metrics?.applicationsReceived??job.applicantCount??0);

          return {
            applicationsReceived,
            avgCandidateScore: avgScoreRaw===undefined||avgScoreRaw===null
              ? null
              : Number(avgScoreRaw.toFixed(2)),
            totalViews: Number(job.totalViews||0),
          };
        })(),
        id: job._id,
        title: job.title,
        department: job.department,
        location: job.location,
        type: job.type,
        companyName: job.companyName,
        status: job.status,
        applicantCount: job.applicantCount||0,
        postedBy: job.postedBy?.username||'Unknown',
        createdAt: job.createdAt,
      })),
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch jobs: ${err.message}`});
  }
});

router.get('/jobs/:jobId/applicants', async (req, res) =>
{
  try
  {
    const {jobId}=req.params;
    const job=await Job.findById(jobId).select('title companyName status').lean();
    if (!job)
    {
      return res.status(404).json({message: 'Job not found'});
    }

    const applications=await Application.find({job: jobId})
      .populate('candidate', 'username fullName email')
      .sort({createdAt: -1})
      .lean();

    return res.json({
      job: {
        id: job._id,
        title: job.title,
        companyName: job.companyName,
        status: job.status,
      },
      applicants: applications.map((application) => ({
        id: application._id,
        status: application.status,
        score: application.score??0,
        appliedAt: application.appliedAt||application.createdAt,
        candidate: {
          id: application.candidate?._id,
          username: application.candidate?.username||'Unknown',
          fullName: application.candidate?.fullName||'',
          email: application.candidate?.email||'',
        },
      })),
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch applicants: ${err.message}`});
  }
});

router.patch('/jobs/:jobId', async (req, res) =>
{
  try
  {
    const {jobId}=req.params;
    const {title, department, location, type, status}=req.body||{};
    const updates={};

    if (title!==undefined)
    {
      const sanitized=String(title).trim();
      if (!sanitized)
      {
        return res.status(400).json({message: 'Title is required'});
      }
      updates.title=sanitized;
    }

    if (department!==undefined)
    {
      const sanitized=String(department).trim();
      if (!sanitized)
      {
        return res.status(400).json({message: 'Department is required'});
      }
      updates.department=sanitized;
    }

    if (location!==undefined)
    {
      if (!['Remote', 'On-site', 'Hybrid'].includes(location))
      {
        return res.status(400).json({message: 'Invalid location'});
      }
      updates.location=location;
    }

    if (type!==undefined)
    {
      if (!['Full-Time', 'Part-Time', 'Contract', 'Internship'].includes(type))
      {
        return res.status(400).json({message: 'Invalid type'});
      }
      updates.type=type;
    }

    if (status!==undefined)
    {
      if (!['active', 'closed', 'draft', 'paused'].includes(status))
      {
        return res.status(400).json({message: 'Invalid job status'});
      }
      updates.status=status;
    }

    if (Object.keys(updates).length===0)
    {
      return res.status(400).json({message: 'No valid fields provided for update'});
    }

    const updated=await Job.findByIdAndUpdate(jobId, {$set: updates}, {new: true}).lean();
    if (!updated)
    {
      return res.status(404).json({message: 'Job not found'});
    }

    await writeAuditLog(req, {
      actionType: 'job_updated',
      category: 'job',
      status: 'success',
      actorId: req.user.userId,
      targetType: 'job',
      targetId: updated._id,
      targetLabel: updated.title||'',
      metadata: updates,
    });

    return res.json({
      message: 'Job updated',
      job: {
        id: updated._id,
        title: updated.title,
        department: updated.department,
        location: updated.location,
        type: updated.type,
        status: updated.status,
      },
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to update job: ${err.message}`});
  }
});

router.delete('/jobs/:jobId', async (req, res) =>
{
  try
  {
    const {jobId}=req.params;
    const existing=await Job.findById(jobId).select('title').lean();
    if (!existing)
    {
      return res.status(404).json({message: 'Job not found'});
    }

    await Promise.all([
      Application.deleteMany({job: jobId}),
      Job.deleteOne({_id: jobId}),
    ]);

    await writeAuditLog(req, {
      actionType: 'job_deleted',
      category: 'job',
      status: 'success',
      actorId: req.user.userId,
      targetType: 'job',
      targetId: jobId,
      targetLabel: existing.title||'',
    });

    return res.json({message: 'Job deleted'});
  } catch (err)
  {
    return res.status(500).json({message: `Failed to delete job: ${err.message}`});
  }
});

router.patch('/jobs/:jobId/status', async (req, res) =>
{
  try
  {
    const {jobId}=req.params;
    const {status}=req.body;

    if (!['active', 'closed', 'draft', 'paused'].includes(status))
    {
      return res.status(400).json({message: 'Invalid job status'});
    }

    const updated=await Job.findByIdAndUpdate(jobId, {status}, {new: true}).lean();
    if (!updated)
    {
      return res.status(404).json({message: 'Job not found'});
    }

    await writeAuditLog(req, {
      actionType: 'job_status_updated',
      category: 'job',
      status: 'success',
      actorId: req.user.userId,
      targetType: 'job',
      targetId: updated._id,
      targetLabel: updated.title||'',
      metadata: {status},
    });

    return res.json({message: 'Job status updated', job: updated});
  } catch (err)
  {
    return res.status(500).json({message: `Failed to update job status: ${err.message}`});
  }
});

router.get('/proctoring/flags', async (req, res) =>
{
  try
  {
    const rows=await InterviewProctoring.find({$or: [{isFlagged: true}, {requiresReview: true}]})
      .populate('userId', 'username email')
      .sort({updatedAt: -1})
      .limit(100)
      .lean();

    const interviewIds=[...new Set(
      rows
        .map((r) => r.interviewId)
        .filter((id) => id&&mongoose.Types.ObjectId.isValid(String(id)))
        .map((id) => String(id))
    )];

    const interviews=interviewIds.length
      ? await AIInterview.find({_id: {$in: interviewIds}}).select('_id sessionId role candidateName').lean()
      : [];
    const interviewMap=new Map(interviews.map((it) => [String(it._id), it]));

    return res.json({
      flags: rows.map((row) => ({
        id: row._id,
        candidate: row.userId?.username||'Unknown',
        email: row.userId?.email||'',
        interviewSession: (interviewMap.get(String(row.interviewId))||{}).sessionId||'',
        role: (interviewMap.get(String(row.interviewId))||{}).role||'',
        integrityScore: row.integrityScore,
        violationCount: row.violationCount,
        warningCount: row.warningCount,
        isFlagged: row.isFlagged,
        requiresReview: row.requiresReview,
        flagReason: row.flagReason||'',
        updatedAt: row.updatedAt,
      })),
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch proctoring flags: ${err.message}`});
  }
});

router.get('/activity', async (req, res) =>
{
  try
  {
    const [recentUsers, recentJobs, recentApplications]=await Promise.all([
      User.find({}).select('username role createdAt').sort({createdAt: -1}).limit(5).lean(),
      Job.find({}).select('title companyName createdAt').sort({createdAt: -1}).limit(5).lean(),
      Application.find({}).select('status createdAt').populate('candidate', 'username').populate('job', 'title').sort({createdAt: -1}).limit(5).lean(),
    ]);

    const activity=[
      ...recentUsers.map((u) => ({
        type: 'user_joined',
        label: `${u.username} joined as ${u.role}`,
        createdAt: u.createdAt,
      })),
      ...recentJobs.map((j) => ({
        type: 'job_posted',
        label: `${j.title} posted by ${j.companyName}`,
        createdAt: j.createdAt,
      })),
      ...recentApplications.map((a) => ({
        type: 'application',
        label: `${a.candidate?.username||'Candidate'} applied for ${a.job?.title||'a job'} (${a.status})`,
        createdAt: a.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0, 15);

    return res.json({activity});
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch activity: ${err.message}`});
  }
});

router.get('/audit/logs', async (req, res) =>
{
  try
  {
    const {category='all', status='all', action='all', search=''}=req.query;
    const limit=Math.min(200, Math.max(1, Number(req.query.limit||100)));
    const filter={};

    if (category!=='all') filter.category=category;
    if (status!=='all') filter.status=status;
    if (action!=='all') filter.actionType=action;

    if (search)
    {
      filter.$or=[
        {actionType: {$regex: search, $options: 'i'}},
        {targetLabel: {$regex: search, $options: 'i'}},
        {actorLabel: {$regex: search, $options: 'i'}},
        {ipAddress: {$regex: search, $options: 'i'}},
      ];
    }

    const rows=await AuditLog.find(filter)
      .populate('actorId', 'username email role')
      .sort({createdAt: -1})
      .limit(limit)
      .lean();

    return res.json({
      logs: rows.map((r) => ({
        id: r._id,
        actionType: r.actionType,
        category: r.category,
        status: r.status,
        actor: {
          id: r.actorId?._id||r.actorId||null,
          username: r.actorId?.username||r.actorLabel||'system',
          email: r.actorId?.email||'',
          role: r.actorId?.role||r.actorRole||'',
        },
        targetType: r.targetType||'',
        targetId: r.targetId||'',
        targetLabel: r.targetLabel||'',
        ipAddress: r.ipAddress||'',
        userAgent: r.userAgent||'',
        metadata: r.metadata||{},
        createdAt: r.createdAt,
      })),
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch audit logs: ${err.message}`});
  }
});

router.get('/security/overview', async (req, res) =>
{
  try
  {
    const since24h=new Date(Date.now()-24*60*60*1000);
    const since2h=new Date(Date.now()-2*60*60*1000);

    const [control, failedIpAgg, loginAgg24h, loginAgg2h, recentSecurityEvents]=await Promise.all([
      getSecurityControl(),
      AuditLog.aggregate([
        {$match: {actionType: {$in: ['auth_login_failed', 'auth_face_login_failed']}, createdAt: {$gte: since24h}}},
        {$group: {_id: '$ipAddress', count: {$sum: 1}}},
        {$sort: {count: -1}},
        {$limit: 20},
      ]),
      AuditLog.aggregate([
        {$match: {actionType: {$in: ['auth_login_success', 'auth_face_login_success']}, createdAt: {$gte: since24h}, actorId: {$ne: null}}},
        {$group: {_id: '$actorId', loginCount: {$sum: 1}, ips: {$addToSet: '$ipAddress'}}},
      ]),
      AuditLog.aggregate([
        {$match: {actionType: {$in: ['auth_login_success', 'auth_face_login_success']}, createdAt: {$gte: since2h}, actorId: {$ne: null}}},
        {$group: {_id: '$actorId', sessionCount: {$sum: 1}, ips: {$addToSet: '$ipAddress'}}},
      ]),
      AuditLog.find({category: 'security'}).sort({createdAt: -1}).limit(30).lean(),
    ]);

    const suspiciousIps=failedIpAgg.filter((r) => (r.count||0)>=5);
    const abnormalLoginUsersRaw=loginAgg24h.filter((r) => (r.ips||[]).filter(Boolean).length>=3||Number(r.loginCount||0)>=8);
    const concurrentRiskUsersRaw=loginAgg2h.filter((r) => (r.ips||[]).filter(Boolean).length>=2&&Number(r.sessionCount||0)>=2);

    const affectedUserIds=[
      ...new Set([
        ...abnormalLoginUsersRaw.map((r) => String(r._id)),
        ...concurrentRiskUsersRaw.map((r) => String(r._id)),
      ]),
    ];

    const users=affectedUserIds.length
      ? await User.find({_id: {$in: affectedUserIds}}).select('_id username email role isActive').lean()
      : [];
    const userMap=new Map(users.map((u) => [String(u._id), u]));

    const now=new Date();
    const blockedIps=(control.blockedIps||[])
      .filter((entry) => entry.isActive!==false&&(!entry.expiresAt||new Date(entry.expiresAt)>now))
      .map((entry) => ({
        ip: entry.ip,
        reason: entry.reason||'',
        blockedAt: entry.blockedAt,
        expiresAt: entry.expiresAt||null,
      }));

    return res.json({
      summary: {
        blockedIpCount: blockedIps.length,
        suspiciousIpCount: suspiciousIps.length,
        repeatedAuthFailureCount: failedIpAgg.reduce((sum, row) => sum+Number(row.count||0), 0),
        abnormalLoginUsers: abnormalLoginUsersRaw.length,
        concurrentSessionRiskUsers: concurrentRiskUsersRaw.length,
      },
      suspiciousIps: failedIpAgg.map((row) => ({ip: row._id||'unknown', failureCount: row.count||0})),
      blockedIps,
      abnormalLoginUsers: abnormalLoginUsersRaw.map((row) => ({
        userId: row._id,
        username: userMap.get(String(row._id))?.username||'Unknown',
        email: userMap.get(String(row._id))?.email||'',
        role: userMap.get(String(row._id))?.role||'',
        loginCount: row.loginCount||0,
        distinctIpCount: (row.ips||[]).filter(Boolean).length,
      })),
      concurrentSessionRisks: concurrentRiskUsersRaw.map((row) => ({
        userId: row._id,
        username: userMap.get(String(row._id))?.username||'Unknown',
        email: userMap.get(String(row._id))?.email||'',
        role: userMap.get(String(row._id))?.role||'',
        sessionCount: row.sessionCount||0,
        distinctIpCount: (row.ips||[]).filter(Boolean).length,
      })),
      recentSecurityEvents: recentSecurityEvents.map((evt) => ({
        id: evt._id,
        actionType: evt.actionType,
        status: evt.status,
        ipAddress: evt.ipAddress,
        targetType: evt.targetType,
        targetLabel: evt.targetLabel,
        createdAt: evt.createdAt,
        metadata: evt.metadata||{},
      })),
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch security overview: ${err.message}`});
  }
});

router.post('/security/block-ip', async (req, res) =>
{
  try
  {
    const {ip, reason='', expiresHours=null}=req.body||{};
    if (!ip||typeof ip!=='string')
    {
      return res.status(400).json({message: 'ip is required'});
    }

    const control=await getSecurityControl();
    const now=new Date();
    const expiresAt=(Number(expiresHours)>0)
      ? new Date(now.getTime()+Number(expiresHours)*60*60*1000)
      : null;

    const existingIndex=(control.blockedIps||[]).findIndex((entry) => entry.ip===ip.trim());
    if (existingIndex>=0)
    {
      control.blockedIps[existingIndex]={
        ...control.blockedIps[existingIndex],
        ip: ip.trim(),
        reason,
        blockedBy: req.user.userId,
        blockedAt: now,
        expiresAt,
        isActive: true,
      };
    } else
    {
      control.blockedIps.push({
        ip: ip.trim(),
        reason,
        blockedBy: req.user.userId,
        blockedAt: now,
        expiresAt,
        isActive: true,
      });
    }

    control.updatedBy=req.user.userId;
    await control.save();

    await writeAuditLog(req, {
      actionType: 'security_ip_blocked',
      category: 'security',
      status: 'success',
      actorId: req.user.userId,
      targetType: 'ip_address',
      targetLabel: ip.trim(),
      metadata: {reason, expiresHours: expiresHours||null},
    });

    return res.json({message: 'IP blocked successfully'});
  } catch (err)
  {
    return res.status(500).json({message: `Failed to block IP: ${err.message}`});
  }
});

router.post('/security/unblock-ip', async (req, res) =>
{
  try
  {
    const {ip}=req.body||{};
    if (!ip||typeof ip!=='string')
    {
      return res.status(400).json({message: 'ip is required'});
    }

    const control=await getSecurityControl();
    const existingIndex=(control.blockedIps||[]).findIndex((entry) => entry.ip===ip.trim());
    if (existingIndex<0)
    {
      return res.status(404).json({message: 'IP not found in blocked list'});
    }

    control.blockedIps[existingIndex].isActive=false;
    control.updatedBy=req.user.userId;
    await control.save();

    await writeAuditLog(req, {
      actionType: 'security_ip_unblocked',
      category: 'security',
      status: 'success',
      actorId: req.user.userId,
      targetType: 'ip_address',
      targetLabel: ip.trim(),
    });

    return res.json({message: 'IP unblocked successfully'});
  } catch (err)
  {
    return res.status(500).json({message: `Failed to unblock IP: ${err.message}`});
  }
});

router.post('/security/force-logout', async (req, res) =>
{
  try
  {
    const {userId, reason='Forced logout by admin'}=req.body||{};
    if (!userId)
    {
      return res.status(400).json({message: 'userId is required'});
    }

    const updated=await User.findByIdAndUpdate(
      userId,
      {$inc: {tokenVersion: 1}},
      {new: true}
    ).select('_id username email role tokenVersion');

    if (!updated)
    {
      return res.status(404).json({message: 'User not found'});
    }

    await writeAuditLog(req, {
      actionType: 'security_force_logout',
      category: 'security',
      status: 'success',
      actorId: req.user.userId,
      targetType: 'user',
      targetId: updated._id,
      targetLabel: updated.username,
      metadata: {reason, tokenVersion: updated.tokenVersion},
    });

    return res.json({
      message: 'User sessions invalidated successfully',
      user: {
        id: updated._id,
        username: updated.username,
        email: updated.email,
        role: updated.role,
      },
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to force logout: ${err.message}`});
  }
});

router.post('/security/suspend-account', async (req, res) =>
{
  try
  {
    const {userId, reason='Suspended by admin due to security risk'}=req.body||{};
    if (!userId)
    {
      return res.status(400).json({message: 'userId is required'});
    }

    if (String(req.user.userId)===String(userId))
    {
      return res.status(400).json({message: 'You cannot suspend your own admin account'});
    }

    const updated=await User.findByIdAndUpdate(
      userId,
      {$set: {isActive: false}, $inc: {tokenVersion: 1}},
      {new: true}
    ).select('_id username email role isActive tokenVersion');

    if (!updated)
    {
      return res.status(404).json({message: 'User not found'});
    }

    await writeAuditLog(req, {
      actionType: 'security_account_suspended',
      category: 'security',
      status: 'success',
      actorId: req.user.userId,
      targetType: 'user',
      targetId: updated._id,
      targetLabel: updated.username,
      metadata: {reason, tokenVersion: updated.tokenVersion},
    });

    return res.json({
      message: 'User suspended successfully',
      user: {
        id: updated._id,
        username: updated.username,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive!==false,
      },
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to suspend account: ${err.message}`});
  }
});

router.get('/candidates/oversight', async (req, res) =>
{
  try
  {
    const completedStatuses=['completed', 'ended'];
    const interviews=await AIInterview.find({status: {$in: completedStatuses}, overallScore: {$ne: null}})
      .select('_id candidateId overallScore sectionScores updatedAt')
      .lean();

    const totalAssessments=interviews.length;
    const uniqueCandidateIds=[...new Set(interviews.map((i) => String(i.candidateId||'')).filter(Boolean))];

    const sectionTotals={technical: 0, problemSolving: 0, communication: 0, domain: 0, aptitude: 0};
    let overallSum=0;

    const performanceDistribution={
      below40: 0,
      between40And59: 0,
      between60And79: 0,
      atLeast80: 0,
    };

    for (const row of interviews)
    {
      const score=Number(row.overallScore||0);
      overallSum+=score;

      if (score<40) performanceDistribution.below40+=1;
      else if (score<60) performanceDistribution.between40And59+=1;
      else if (score<80) performanceDistribution.between60And79+=1;
      else performanceDistribution.atLeast80+=1;

      const sections=row.sectionScores||{};
      sectionTotals.technical+=Number(sections.technical||0);
      sectionTotals.problemSolving+=Number(sections.problemSolving||0);
      sectionTotals.communication+=Number(sections.communication||0);
      sectionTotals.domain+=Number(sections.domain||0);
      sectionTotals.aptitude+=Number(sections.aptitude||0);
    }

    const avgOverall=totalAssessments? Number((overallSum/totalAssessments).toFixed(2)):0;
    const skillBenchmarks={
      technical: totalAssessments? Number((sectionTotals.technical/totalAssessments).toFixed(2)):0,
      problemSolving: totalAssessments? Number((sectionTotals.problemSolving/totalAssessments).toFixed(2)):0,
      communication: totalAssessments? Number((sectionTotals.communication/totalAssessments).toFixed(2)):0,
      domain: totalAssessments? Number((sectionTotals.domain/totalAssessments).toFixed(2)):0,
      aptitude: totalAssessments? Number((sectionTotals.aptitude/totalAssessments).toFixed(2)):0,
    };

    const integrityByDayAgg=await InterviewProctoring.aggregate([
      {$match: {createdAt: {$gte: startOfDaysAgo(6)}, integrityScore: {$ne: null}}},
      {$group: {_id: {$dateToString: {format: '%Y-%m-%d', date: '$createdAt'}}, avgIntegrity: {$avg: '$integrityScore'}}},
    ]);

    const integrityTrend=[];
    for (let i=6; i>=0; i--)
    {
      const day=startOfDaysAgo(i).toISOString().slice(0, 10);
      const row=integrityByDayAgg.find((x) => x._id===day);
      integrityTrend.push({day, value: row?.avgIntegrity? Number(row.avgIntegrity.toFixed(2)):0});
    }

    const proctoringRows=await InterviewProctoring.find({interviewId: {$ne: null}})
      .select('interviewId userId integrityScore isFlagged requiresReview updatedAt')
      .lean();

    const proctoringMap=new Map();
    for (const row of proctoringRows)
    {
      const key=String(row.interviewId);
      const existing=proctoringMap.get(key);
      if (!existing||new Date(row.updatedAt)>new Date(existing.updatedAt))
      {
        proctoringMap.set(key, row);
      }
    }

    let lowIntegrityHighScoreCount=0;
    const candidateScoresMap=new Map();
    for (const interview of interviews)
    {
      const pid=proctoringMap.get(String(interview._id));
      const integrity=Number(pid?.integrityScore??100);
      const score=Number(interview.overallScore||0);

      if (score>=80&&integrity<55) lowIntegrityHighScoreCount+=1;

      const cid=String(interview.candidateId||'');
      if (!cid) continue;
      if (!candidateScoresMap.has(cid)) candidateScoresMap.set(cid, []);
      candidateScoresMap.get(cid).push(score);
    }

    const highVarianceCandidateIds=[];
    for (const [candidateId, scores] of candidateScoresMap.entries())
    {
      if (scores.length<3) continue;
      const mean=scores.reduce((a, b) => a+b, 0)/scores.length;
      const variance=scores.reduce((a, b) => a+((b-mean)**2), 0)/scores.length;
      const std=Math.sqrt(variance);
      if (std>=20) highVarianceCandidateIds.push(candidateId);
    }

    const repeatedFlaggedAgg=await InterviewProctoring.aggregate([
      {$match: {$or: [{isFlagged: true}, {requiresReview: true}] }},
      {$group: {_id: '$userId', flaggedCount: {$sum: 1}}},
      {$match: {flaggedCount: {$gte: 2}}},
      {$sort: {flaggedCount: -1}},
      {$limit: 10},
    ]);

    const anomalyUserIds=[
      ...new Set([
        ...highVarianceCandidateIds,
        ...repeatedFlaggedAgg.map((r) => String(r._id||'')),
      ].filter(Boolean)),
    ];

    const anomalyUsers=anomalyUserIds.length
      ? await User.find({_id: {$in: anomalyUserIds}}).select('_id username email').lean()
      : [];
    const anomalyUserMap=new Map(anomalyUsers.map((u) => [String(u._id), u]));

    return res.json({
      summary: {
        totalCandidatesAssessed: uniqueCandidateIds.length,
        totalAssessments,
        averageOverallScore: avgOverall,
      },
      skillBenchmarks,
      performanceDistribution: {
        below40: {count: performanceDistribution.below40, pct: toPercent(performanceDistribution.below40, totalAssessments)},
        between40And59: {count: performanceDistribution.between40And59, pct: toPercent(performanceDistribution.between40And59, totalAssessments)},
        between60And79: {count: performanceDistribution.between60And79, pct: toPercent(performanceDistribution.between60And79, totalAssessments)},
        atLeast80: {count: performanceDistribution.atLeast80, pct: toPercent(performanceDistribution.atLeast80, totalAssessments)},
      },
      integrityScoreTrend: integrityTrend,
      anomalyInsights: {
        lowIntegrityHighScoreCount,
        highVarianceCandidates: highVarianceCandidateIds.map((id) => ({
          userId: id,
          username: anomalyUserMap.get(id)?.username||'Unknown',
          email: anomalyUserMap.get(id)?.email||'',
        })),
        repeatedFlaggedCandidates: repeatedFlaggedAgg.map((row) => ({
          userId: row._id,
          username: anomalyUserMap.get(String(row._id))?.username||'Unknown',
          email: anomalyUserMap.get(String(row._id))?.email||'',
          flaggedCount: row.flaggedCount,
        })),
      },
    });
  } catch (err)
  {
    return res.status(500).json({message: `Failed to fetch candidate oversight: ${err.message}`});
  }
});

export default router;
