import {Router} from 'express';
import AIInterview from '../models/AIInterview.js';
import User from '../models/User.js';
const router=Router();

/* ═══════════════════════════════════════════════════════
   JOB ROLES & SKILL CATEGORIES (config)
   ═══════════════════════════════════════════════════════ */

const JOB_ROLES=[
  {id: 'sde-frontend', label: 'Frontend Developer'},
  {id: 'sde-backend', label: 'Backend Developer'},
  {id: 'sde-fullstack', label: 'Full Stack Engineer'},
  {id: 'data-analyst', label: 'Data Analyst'},
  {id: 'devops', label: 'DevOps Engineer'},
  {id: 'ui-ux', label: 'UI/UX Designer'},
];

const ROLE_MAP={
  'sde-frontend': 'Frontend Developer',
  'sde-backend': 'Backend Developer',
  'sde-fullstack': 'Full Stack Developer',
  'data-analyst': 'Data Analyst',
  'devops': 'DevOps Engineer',
  'ui-ux': 'UI/UX Designer',
};

const SKILL_CATEGORIES={
  'sde-frontend': ['JavaScript', 'React', 'CSS', 'TypeScript', 'Testing', 'Performance'],
  'sde-backend': ['Node.js', 'Databases', 'APIs', 'System Design', 'Security', 'DevOps Basics'],
  'sde-fullstack': ['JavaScript', 'React', 'Node.js', 'Databases', 'System Design', 'DevOps'],
  'data-analyst': ['SQL', 'Python', 'Statistics', 'Visualization', 'Excel', 'ML Basics'],
  'devops': ['Docker', 'Kubernetes', 'CI/CD', 'Cloud', 'Networking', 'Monitoring'],
  'ui-ux': ['Figma', 'Prototyping', 'User Research', 'Visual Design', 'Accessibility', 'Interaction'],
};

function generateCandidates(role, count=40)
{
  const firstNames=['Arjun', 'Priya', 'Ravi', 'Sneha', 'Vikram', 'Anita', 'Mohammed', 'Kavya', 'Rohan', 'Meera', 'Aditya', 'Nisha', 'Karan', 'Divya', 'Sanjay', 'Pooja', 'Rahul', 'Isha', 'Amit', 'Tanvi',
    'Deepak', 'Ritika', 'Suresh', 'Neha', 'Manish', 'Swati', 'Vishal', 'Anjali', 'Nikhil', 'Shreya',
    'Gaurav', 'Pallavi', 'Rajesh', 'Simran', 'Akash', 'Bhavna', 'Tushar', 'Komal', 'Harsh', 'Megha'];
  const lastNames=['Mehta', 'Sharma', 'Kumar', 'Patel', 'Singh', 'Desai', 'Ali', 'Nair', 'Verma', 'Gupta', 'Joshi', 'Rao', 'Iyer', 'Chauhan', 'Das', 'Reddy', 'Malhotra', 'Bhat', 'Tiwari', 'Saxena'];
  const skills=SKILL_CATEGORIES[role]||SKILL_CATEGORIES['sde-fullstack'];
  const levels=['Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const candidates=[];
  for (let i=0;i<count;i++)
  {
    const fn=firstNames[i%firstNames.length];
    const ln=lastNames[(i*3+7)%lastNames.length];
    const technical=Math.floor(Math.random()*40)+60;
    const aptitude=Math.floor(Math.random()*35)+55;
    const domain=Math.floor(Math.random()*45)+50;
    const communication=Math.floor(Math.random()*30)+65;
    const problemSolving=Math.floor(Math.random()*40)+55;
    const overall=Math.round((technical*0.3+aptitude*0.15+domain*0.25+communication*0.15+problemSolving*0.15));
    const timeSpent=Math.floor(Math.random()*40)+20; // minutes

    candidates.push({
      id: `cand-${role}-${i+1}`,
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@email.com`,
      overall,
      sections: {technical, aptitude, domain, communication, problemSolving},
      skills: skills.map(s => ({
        name: s,
        score: Math.floor(Math.random()*50)+50,
        level: levels[Math.floor(Math.random()*4)],
      })),
      timeSpent,
      appliedDate: new Date(Date.now()-Math.floor(Math.random()*15)*86400000).toISOString(),
    });
  }

  candidates.sort((a, b) => b.overall-a.overall);
  candidates.forEach((c, idx) => {c.rank=idx+1;});
  return candidates;
}

const cache={};
function getCandidates(role)
{
  if (!cache[role]) cache[role]=generateCandidates(role);
  return cache[role];
}

/* Leaderboard configs per role */
const leaderboardConfig={};
function getConfig(role)
{
  if (!leaderboardConfig[role])
  {
    leaderboardConfig[role]={
      threshold: 60,
      liveEnabled: false,
      topN: 10,
      weights: {technical: 30, aptitude: 15, domain: 25, communication: 15, problemSolving: 15},
    };
  }
  return leaderboardConfig[role];
}

/* ═══════════════════════════════════════════
   ADMIN ENDPOINTS
   ═══════════════════════════════════════════ */

// List available job roles
router.get('/roles', (_req, res) =>
{
  res.json({roles: JOB_ROLES});
});

// Get all candidate scores for a job role
router.get('/admin/scores/:jobRole', (req, res) =>
{
  const {jobRole}=req.params;
  const config=getConfig(jobRole);
  const candidates=getCandidates(jobRole).map(c => ({
    ...c,
    status: c.overall>=config.threshold? 'qualified':'not-qualified',
  }));
  res.json({candidates, config, role: jobRole});
});

// Get single candidate detail
router.get('/admin/candidate/:candidateId', (req, res) =>
{
  const {candidateId}=req.params;
  for (const role of Object.keys(cache))
  {
    const found=cache[role].find(c => c.id===candidateId);
    if (found)
    {
      const config=getConfig(role);
      return res.json({
        candidate: {...found, status: found.overall>=config.threshold? 'qualified':'not-qualified'},
        role,
      });
    }
  }
  res.status(404).json({message: 'Candidate not found'});
});

// Update threshold / config
router.put('/admin/thresholds', (req, res) =>
{
  const {jobRole, threshold, topN, weights}=req.body;
  if (!jobRole) return res.status(400).json({message: 'jobRole required'});
  const config=getConfig(jobRole);
  if (threshold!==undefined) config.threshold=Number(threshold);
  if (topN!==undefined) config.topN=Number(topN);
  if (weights) Object.assign(config.weights, weights);
  res.json({message: 'Config updated', config});
});

// Toggle live leaderboard
router.put('/admin/leaderboard-config', (req, res) =>
{
  const {jobRole, liveEnabled, topN}=req.body;
  if (!jobRole) return res.status(400).json({message: 'jobRole required'});
  const config=getConfig(jobRole);
  if (liveEnabled!==undefined) config.liveEnabled=liveEnabled;
  if (topN!==undefined) config.topN=Number(topN);
  res.json({message: 'Leaderboard config updated', config});
});

// Stats summary for a role
router.get('/admin/stats/:jobRole', (req, res) =>
{
  const {jobRole}=req.params;
  const config=getConfig(jobRole);
  const candidates=getCandidates(jobRole);
  const qualified=candidates.filter(c => c.overall>=config.threshold);
  const avgScore=Math.round(candidates.reduce((s, c) => s+c.overall, 0)/candidates.length);
  const topScore=candidates[0]?.overall||0;
  const avgTime=Math.round(candidates.reduce((s, c) => s+c.timeSpent, 0)/candidates.length);
  res.json({
    total: candidates.length,
    qualified: qualified.length,
    notQualified: candidates.length-qualified.length,
    avgScore,
    topScore,
    avgTime,
    threshold: config.threshold,
  });
});

/* ═══════════════════════════════════════════
   LEADERBOARD ENDPOINT (public / candidate)
   Uses real MongoDB data when available, falls back to generated mock data
   ═══════════════════════════════════════════ */
router.get('/leaderboard/:jobRole', async (req, res) =>
{
  const {jobRole}=req.params;
  const config=getConfig(jobRole);

  try
  {
    // Try real interviews from MongoDB
    const liveInterviews=await AIInterview.find({
      status: {$in: ['completed', 'ended']},
      overallScore: {$ne: null},
    }).sort({overallScore: -1}).limit(config.topN+20).lean();

    if (liveInterviews.length>=3)
    {
      const top=liveInterviews.slice(0, config.topN).map((iv, idx) => ({
        rank: idx+1,
        name: iv.candidateName,
        overall: iv.overallScore,
        sections: iv.sectionScores||{},
        role: iv.role,
        status: iv.overallScore>=config.threshold? 'qualified':'not-qualified',
        completedAt: iv.endTime,
      }));
      return res.json({leaderboard: top, total: liveInterviews.length, config: {topN: config.topN, liveEnabled: true}, source: 'live'});
    }
  } catch (err)
  {
    console.error('[SCORING] Live leaderboard error, falling back to mock:', err.message);
  }

  // Fallback to mock/generated data
  const all=getCandidates(jobRole);
  const top=all.slice(0, config.topN).map(c => ({
    rank: c.rank,
    name: c.name,
    overall: c.overall,
    status: c.overall>=config.threshold? 'qualified':'not-qualified',
  }));
  res.json({leaderboard: top, total: all.length, config: {topN: config.topN, liveEnabled: config.liveEnabled}, source: 'mock'});
});

/* ═══════════════════════════════════════════
   CANDIDATE ENDPOINT — personal results
   ═══════════════════════════════════════════ */
router.get('/candidate/my-results', (req, res) =>
{
  // In production: extract user from JWT. Here use query param or default to first candidate.
  const {userId, role: qRole}=req.query;
  const role=qRole||'sde-frontend';
  const all=getCandidates(role);
  const config=getConfig(role);
  // Pick candidate by userId or default to a mid-ranking one
  let candidate=userId? all.find(c => c.id===userId):all[Math.floor(all.length*0.3)];
  if (!candidate) candidate=all[0];

  const avgScores={
    technical: Math.round(all.reduce((s, c) => s+c.sections.technical, 0)/all.length),
    aptitude: Math.round(all.reduce((s, c) => s+c.sections.aptitude, 0)/all.length),
    domain: Math.round(all.reduce((s, c) => s+c.sections.domain, 0)/all.length),
    communication: Math.round(all.reduce((s, c) => s+c.sections.communication, 0)/all.length),
    problemSolving: Math.round(all.reduce((s, c) => s+c.sections.problemSolving, 0)/all.length),
  };

  const percentile=Math.round(((all.length-candidate.rank)/all.length)*100);
  const roleLabel=JOB_ROLES.find(r => r.id===role)?.label||role;

  res.json({
    candidate: {
      ...candidate,
      status: candidate.overall>=config.threshold? 'qualified':'not-qualified',
      percentile,
    },
    averages: avgScores,
    totalCandidates: all.length,
    role,
    roleLabel,
    threshold: config.threshold,
    strengths: candidate.skills.filter(s => s.score>=80).map(s => s.name),
    improvements: candidate.skills.filter(s => s.score<65).map(s => s.name),
  });
});

// Export data (returns JSON — frontend converts to CSV)
router.get('/admin/export/:jobRole', (req, res) =>
{
  const {jobRole}=req.params;
  const config=getConfig(jobRole);
  const candidates=getCandidates(jobRole).map(c => ({
    Rank: c.rank,
    Name: c.name,
    Email: c.email,
    Overall: c.overall,
    Technical: c.sections.technical,
    Aptitude: c.sections.aptitude,
    Domain: c.sections.domain,
    Communication: c.sections.communication,
    ProblemSolving: c.sections.problemSolving,
    Status: c.overall>=config.threshold? 'Qualified':'Not Qualified',
    TimeSpent: `${c.timeSpent} min`,
  }));
  res.json({data: candidates, role: jobRole});
});

/* ═══════════════════════════════════════════════════════════
   CANDIDATE ANALYTICS — live MongoDB data with mock fallback
   ═══════════════════════════════════════════════════════════ */
router.get('/candidate/analytics', async (req, res) =>
{
  try
  {
    const {userId, role: qRole}=req.query;

    // Try to get live interview data from MongoDB
    const liveInterviews=await AIInterview.find({
      status: {$in: ['completed', 'ended']},
      overallScore: {$ne: null},
    }).sort({createdAt: -1}).limit(200).lean();

    if (liveInterviews.length>=2)
    {
      // ── Use LIVE DATA from MongoDB ──
      const role=qRole||'sde-frontend';
      const roleLabel=JOB_ROLES.find(r => r.id===role)?.label||role;
      const mappedRole=ROLE_MAP[role]||roleLabel;
      const config=getConfig(role);
      const skills=SKILL_CATEGORIES[role]||SKILL_CATEGORIES['sde-fullstack'];
      const levels=['Beginner', 'Intermediate', 'Advanced', 'Expert'];

      // Build candidate list from live interviews
      const allCandidates=liveInterviews.map((iv, idx) =>
      {
        const sections={
          technical: iv.sectionScores?.technical||Math.round(iv.overallScore*(0.85+Math.random()*0.3)),
          aptitude: iv.sectionScores?.aptitude||Math.round(iv.overallScore*(0.9+Math.random()*0.2)),
          domain: iv.sectionScores?.domain||Math.round(iv.overallScore*(0.8+Math.random()*0.3)),
          communication: iv.sectionScores?.communication||Math.round(iv.overallScore*(0.8+Math.random()*0.3)),
          problemSolving: iv.sectionScores?.problemSolving||Math.round(iv.overallScore*(0.85+Math.random()*0.3)),
        };
        // Clamp values to 0-100
        Object.keys(sections).forEach(k =>
        {
          sections[k]=Math.min(100, Math.max(0, sections[k]));
        });

        const duration=iv.endTime&&iv.startTime
          ? Math.round((new Date(iv.endTime)-new Date(iv.startTime))/60000)
          :iv.duration||30;

        return {
          id: iv.sessionId,
          name: iv.candidateName,
          email: `${iv.candidateName.toLowerCase().replace(/\s+/g, '.')}@hirespec.live`,
          overall: Math.min(100, Math.max(0, iv.overallScore)),
          sections,
          skills: skills.map(s =>
          {
            const score=Math.min(100, Math.max(0, Math.round(iv.overallScore*(0.7+Math.random()*0.5))));
            return {
              name: s, score,
              level: score>=85? 'Expert':score>=70? 'Advanced':score>=50? 'Intermediate':'Beginner',
            };
          }),
          timeSpent: duration,
          appliedDate: iv.createdAt?.toISOString()||new Date().toISOString(),
          interviewRole: iv.role,
          liveData: true,
        };
      });

      allCandidates.sort((a, b) => b.overall-a.overall);
      allCandidates.forEach((c, idx) => {c.rank=idx+1;});

      // Pick candidate: by userId match or the most recent interview
      let candidate=userId
        ? allCandidates.find(c => c.id===userId)
        :allCandidates[0];
      if (!candidate) candidate=allCandidates[0];

      const percentile=Math.round(((allCandidates.length-candidate.rank)/allCandidates.length)*100);
      const status=candidate.overall>=config.threshold? 'qualified':'not-qualified';

      // Section averages
      const sectionKeys=Object.keys(candidate.sections);
      const sectionAverages={};
      const sectionDistribution={};
      sectionKeys.forEach(k =>
      {
        const vals=allCandidates.map(c => c.sections[k]);
        sectionAverages[k]=Math.round(vals.reduce((a, b) => a+b, 0)/vals.length);
        const buckets=[0, 0, 0, 0, 0];
        vals.forEach(v =>
        {
          if (v<=20) buckets[0]++;
          else if (v<=40) buckets[1]++;
          else if (v<=60) buckets[2]++;
          else if (v<=80) buckets[3]++;
          else buckets[4]++;
        });
        sectionDistribution[k]=buckets;
      });

      // Overall distribution
      const overallDist=[0, 0, 0, 0, 0];
      allCandidates.forEach(c =>
      {
        if (c.overall<=20) overallDist[0]++;
        else if (c.overall<=40) overallDist[1]++;
        else if (c.overall<=60) overallDist[2]++;
        else if (c.overall<=80) overallDist[3]++;
        else overallDist[4]++;
      });

      // Timeline from actual interviews of this candidate
      const candidateInterviews=liveInterviews
        .filter(iv => iv.candidateName===candidate.name)
        .sort((a, b) => new Date(a.createdAt)-new Date(b.createdAt));

      let timeline;
      if (candidateInterviews.length>=2)
      {
        timeline=candidateInterviews.slice(-5).map((iv, idx) => ({
          week: `Session ${idx+1}`,
          score: Math.min(100, iv.overallScore||0),
          technical: Math.min(100, iv.sectionScores?.technical||iv.overallScore||0),
          aptitude: Math.min(100, iv.sectionScores?.aptitude||iv.overallScore||0),
          domain: Math.min(100, iv.sectionScores?.domain||iv.overallScore||0),
        }));
      } else
      {
        const baseScore=Math.max(30, candidate.overall-15);
        timeline=[];
        for (let w=1;w<=5;w++)
        {
          timeline.push({
            week: `Week ${w}`,
            score: Math.min(100, Math.round(baseScore+((candidate.overall-baseScore)*w)/5)),
            technical: Math.min(100, Math.round(candidate.sections.technical*(0.7+0.06*w))),
            aptitude: Math.min(100, Math.round(candidate.sections.aptitude*(0.72+0.056*w))),
            domain: Math.min(100, Math.round(candidate.sections.domain*(0.68+0.064*w))),
          });
        }
      }

      const top5=allCandidates.slice(0, 5).map(c => ({
        name: c.name, overall: c.overall, rank: c.rank,
        technical: c.sections.technical, aptitude: c.sections.aptitude,
      }));

      const strengths=candidate.skills.filter(s => s.score>=75).sort((a, b) => b.score-a.score);
      const weaknesses=candidate.skills.filter(s => s.score<65).sort((a, b) => a.score-b.score);

      let starRating=1;
      if (percentile>=90) starRating=5;
      else if (percentile>=75) starRating=4;
      else if (percentile>=50) starRating=3;
      else if (percentile>=25) starRating=2;

      const sectionComparison=sectionKeys.map(k => ({
        section: k.charAt(0).toUpperCase()+k.slice(1),
        you: candidate.sections[k],
        average: sectionAverages[k],
        top10: Math.round(allCandidates.slice(0, Math.max(1, Math.floor(allCandidates.length*0.1))).reduce((s, c) => s+c.sections[k], 0)/
          Math.max(1, Math.floor(allCandidates.length*0.1))),
      }));

      const avgTime=Math.round(allCandidates.reduce((s, c) => s+c.timeSpent, 0)/allCandidates.length);
      const fastestTime=Math.min(...allCandidates.map(c => c.timeSpent));

      return res.json({
        candidate: {...candidate, status, percentile, starRating, photo: null},
        roleLabel, role, threshold: config.threshold,
        totalCandidates: allCandidates.length,
        sectionAverages, sectionDistribution,
        overallDistribution: overallDist, sectionComparison,
        timeline, top5, strengths, weaknesses,
        timeAnalytics: {yours: candidate.timeSpent, average: avgTime, fastest: fastestTime},
        skillRadar: candidate.skills.map(s => ({skill: s.name, score: s.score, level: s.level})),
        dataSource: 'live_mongodb',
      });
    }

    // ── FALLBACK to generated data when no live interviews exist ──
    const role=qRole||'sde-frontend';
    const all=getCandidates(role);
    const config=getConfig(role);
    let candidate=userId? all.find(c => c.id===userId):all[Math.floor(all.length*0.3)];
    if (!candidate) candidate=all[0];

    const percentile=Math.round(((all.length-candidate.rank)/all.length)*100);
    const status=candidate.overall>=config.threshold? 'qualified':'not-qualified';
    const roleLabel=JOB_ROLES.find(r => r.id===role)?.label||role;

    const sectionKeys=Object.keys(candidate.sections);
    const sectionAverages={};
    const sectionDistribution={};
    sectionKeys.forEach(k =>
    {
      const vals=all.map(c => c.sections[k]);
      sectionAverages[k]=Math.round(vals.reduce((a, b) => a+b, 0)/vals.length);
      const buckets=[0, 0, 0, 0, 0];
      vals.forEach(v =>
      {
        if (v<=20) buckets[0]++;
        else if (v<=40) buckets[1]++;
        else if (v<=60) buckets[2]++;
        else if (v<=80) buckets[3]++;
        else buckets[4]++;
      });
      sectionDistribution[k]=buckets;
    });

    const overallDist=[0, 0, 0, 0, 0];
    all.forEach(c =>
    {
      if (c.overall<=20) overallDist[0]++;
      else if (c.overall<=40) overallDist[1]++;
      else if (c.overall<=60) overallDist[2]++;
      else if (c.overall<=80) overallDist[3]++;
      else overallDist[4]++;
    });

    const baseScore=Math.max(30, candidate.overall-Math.floor(Math.random()*20)-15);
    const timeline=[];
    for (let w=1;w<=5;w++)
    {
      timeline.push({
        week: `Week ${w}`,
        score: Math.min(100, Math.round(baseScore+((candidate.overall-baseScore)*w)/5+(Math.random()*6-3))),
        technical: Math.min(100, Math.round(candidate.sections.technical*(0.7+0.06*w)+(Math.random()*8-4))),
        aptitude: Math.min(100, Math.round(candidate.sections.aptitude*(0.72+0.056*w)+(Math.random()*8-4))),
        domain: Math.min(100, Math.round(candidate.sections.domain*(0.68+0.064*w)+(Math.random()*8-4))),
      });
    }

    const top5=all.slice(0, 5).map(c => ({
      name: c.name, overall: c.overall, rank: c.rank,
      technical: c.sections.technical, aptitude: c.sections.aptitude,
    }));

    const strengths=candidate.skills.filter(s => s.score>=75).sort((a, b) => b.score-a.score);
    const weaknesses=candidate.skills.filter(s => s.score<65).sort((a, b) => a.score-b.score);

    let starRating=1;
    if (percentile>=90) starRating=5;
    else if (percentile>=75) starRating=4;
    else if (percentile>=50) starRating=3;
    else if (percentile>=25) starRating=2;

    const sectionComparison=sectionKeys.map(k => ({
      section: k.charAt(0).toUpperCase()+k.slice(1),
      you: candidate.sections[k],
      average: sectionAverages[k],
      top10: Math.round(all.slice(0, Math.max(1, Math.floor(all.length*0.1))).reduce((s, c) => s+c.sections[k], 0)/
        Math.max(1, Math.floor(all.length*0.1))),
    }));

    const avgTime=Math.round(all.reduce((s, c) => s+c.timeSpent, 0)/all.length);
    const fastestTime=Math.min(...all.map(c => c.timeSpent));

    res.json({
      candidate: {...candidate, status, percentile, starRating, photo: null},
      roleLabel, role, threshold: config.threshold,
      totalCandidates: all.length,
      sectionAverages, sectionDistribution,
      overallDistribution: overallDist, sectionComparison,
      timeline, top5, strengths, weaknesses,
      timeAnalytics: {yours: candidate.timeSpent, average: avgTime, fastest: fastestTime},
      skillRadar: candidate.skills.map(s => ({skill: s.name, score: s.score, level: s.level})),
      dataSource: 'generated_fallback',
    });
  } catch (error)
  {
    console.error('Error fetching analytics:', error);
    res.status(500).json({error: 'Failed to fetch analytics'});
  }
});

export default router;
