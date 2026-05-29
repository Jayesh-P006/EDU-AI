import express from 'express';
import multer from 'multer';
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {PDFParse}=require('pdf-parse');
import User from '../models/User.js';
import resumeParser from '../services/resumeParser.js';
import {verifyAuth} from '../middleware/auth.js';
import {APIResponse} from '../middleware/response.js';

const router=express.Router();

// Apply auth to all profile routes
router.use(verifyAuth);

// Multer config — store in memory for PDF parsing
const upload=multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 10*1024*1024}, // 10 MB
  fileFilter: (req, file, cb) =>
  {
    const allowed=['application/pdf', 'text/plain'];
    if (allowed.includes(file.mimetype)||file.originalname.endsWith('.txt')||file.originalname.endsWith('.pdf'))
    {
      cb(null, true);
    } else
    {
      cb(new Error('Only PDF and TXT files are allowed'));
    }
  },
});

// ── Get profile ──
router.get('/:userId', async (req, res) =>
{
  try
  {
    const user=await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({error: 'User not found'});
    res.json({profile: user});
  } catch (error)
  {
    console.error('Error fetching profile:', error);
    res.status(500).json({error: 'Failed to fetch profile'});
  }
});

// ── Update profile ──
router.put('/:userId', async (req, res) =>
{
  try
  {
    const allowedFields=[
      'fullName', 'phone', 'location', 'linkedIn', 'github', 'portfolio',
      'headline', 'bio', 'skills', 'education', 'experience', 'projects',
      'certifications', 'languages', 'desiredRole', 'desiredSalary',
      'availability', 'workPreference',
    ];

    const updates={};
    for (const field of allowedFields)
    {
      if (req.body[field]!==undefined)
      {
        updates[field]=req.body[field];
      }
    }

    // Calculate profile completion percentage
    updates.profileComplete=calculateProfileCompletion({...updates, ...req.body});

    const user=await User.findByIdAndUpdate(
      req.params.userId,
      {$set: updates},
      {new: true, runValidators: true}
    ).select('-password');

    if (!user) return res.status(404).json({error: 'User not found'});

    res.json({profile: user, message: 'Profile updated successfully'});
  } catch (error)
  {
    console.error('Error updating profile:', error);
    res.status(500).json({error: 'Failed to update profile'});
  }
});

// ── Upload resume (raw text) ──
router.post('/:userId/resume', async (req, res) =>
{
  try
  {
    const {resumeText, fileName}=req.body;
    if (!resumeText||!resumeText.trim())
    {
      return res.status(400).json({error: 'Resume text is required'});
    }

    // Parse resume
    const parsed=resumeParser.parseResume(resumeText);

    // Extract skills for profile autofill
    const existingUser=await User.findById(req.params.userId);
    if (!existingUser) return res.status(404).json({error: 'User not found'});

    // Merge parsed skills with existing
    const existingSkills=new Set(existingUser.skills||[]);
    const newSkills=parsed.skills?.all||[];
    newSkills.forEach(s => existingSkills.add(s));

    const updateData={
      resumeText: resumeText.substring(0, 50000), // limit size
      resumeFileName: fileName||'resume.txt',
      resumeUploadedAt: new Date(),
      resumeParsed: parsed,
      atsScore: parsed.atsScore||0,
      skills: [...existingSkills],
    };

    // Auto-fill empty profile fields from parsed resume
    if (!existingUser.fullName&&parsed.candidate?.name)
    {
      updateData.fullName=parsed.candidate.name;
    }
    if (!existingUser.phone&&parsed.candidate?.phone)
    {
      updateData.phone=parsed.candidate.phone;
    }
    if (!existingUser.linkedIn&&parsed.candidate?.linkedin)
    {
      updateData.linkedIn=parsed.candidate.linkedin;
    }
    if (!existingUser.github&&parsed.candidate?.github)
    {
      updateData.github=parsed.candidate.github;
    }

    // Recalculate profile completion
    const merged={...existingUser.toObject(), ...updateData};
    updateData.profileComplete=calculateProfileCompletion(merged);

    const user=await User.findByIdAndUpdate(
      req.params.userId,
      {$set: updateData},
      {new: true}
    ).select('-password');

    res.json({
      message: 'Resume uploaded and parsed successfully',
      parsed,
      profile: user,
    });
  } catch (error)
  {
    console.error('Error uploading resume:', error);
    res.status(500).json({error: 'Failed to upload resume'});
  }
});

// ── Upload resume FILE (PDF or TXT) ──
router.post('/:userId/resume/file', upload.single('resume'), async (req, res) =>
{
  try
  {
    const file=req.file;
    if (!file) return res.status(400).json({error: 'No file uploaded'});

    let resumeText='';
    const isPdf=file.mimetype==='application/pdf'||file.originalname.endsWith('.pdf');

    if (isPdf)
    {
      try
      {
        const parser=new PDFParse({data: new Uint8Array(file.buffer)});
        const pdfData=await parser.getText();
        resumeText=pdfData.text||'';
        await parser.destroy();
      } catch (pdfErr)
      {
        console.error('PDF parse error:', pdfErr);
        return res.status(400).json({error: 'Failed to parse PDF. Ensure the file is a valid, text-based PDF.'});
      }
    } else
    {
      resumeText=file.buffer.toString('utf-8');
    }

    if (!resumeText.trim())
    {
      return res.status(400).json({error: 'Could not extract text from the file. If it is a scanned/image PDF, please paste the text manually.'});
    }

    // Parse resume
    const parsed=resumeParser.parseResume(resumeText);

    const existingUser=await User.findById(req.params.userId);
    if (!existingUser) return res.status(404).json({error: 'User not found'});

    // Merge parsed skills
    const existingSkills=new Set(existingUser.skills||[]);
    (parsed.skills?.all||[]).forEach(s => existingSkills.add(s));

    const updateData={
      resumeText: resumeText.substring(0, 50000),
      resumeFileName: file.originalname,
      resumeUploadedAt: new Date(),
      resumeParsed: parsed,
      atsScore: parsed.atsScore||0,
      skills: [...existingSkills],
    };

    // Auto-fill empty profile fields
    if (!existingUser.fullName&&parsed.candidate?.name) updateData.fullName=parsed.candidate.name;
    if (!existingUser.phone&&parsed.candidate?.phone) updateData.phone=parsed.candidate.phone;
    if (!existingUser.linkedIn&&parsed.candidate?.linkedin) updateData.linkedIn=parsed.candidate.linkedin;
    if (!existingUser.github&&parsed.candidate?.github) updateData.github=parsed.candidate.github;

    const merged={...existingUser.toObject(), ...updateData};
    updateData.profileComplete=calculateProfileCompletion(merged);

    const user=await User.findByIdAndUpdate(
      req.params.userId,
      {$set: updateData},
      {new: true}
    ).select('-password');

    console.log(`[PROFILE] ✅ Resume file uploaded: ${file.originalname} (${isPdf? 'PDF':'TXT'}, ${resumeText.length} chars)`);

    res.json({
      message: 'Resume uploaded and parsed successfully',
      parsed,
      profile: user,
    });
  } catch (error)
  {
    console.error('Error uploading resume file:', error);
    res.status(500).json({error: error.message||'Failed to upload resume file'});
  }
});

// ── Resume Analyzer (detailed report) ──
router.post('/:userId/resume-analyze', async (req, res) =>
{
  try
  {
    const {jdText}=req.body;
    const user=await User.findById(req.params.userId);
    if (!user) return res.status(404).json({error: 'User not found'});
    if (!user.resumeText) return res.status(400).json({error: 'No resume uploaded yet'});

    const resumeResult=resumeParser.parseResume(user.resumeText);

    // Build comprehensive resume analysis report
    const report={
      overallScore: user.atsScore||resumeResult.atsScore||0,
      wordCount: resumeResult.wordCount||0,
      charCount: resumeResult.charCount||0,
    };

    // ── Contact Info Analysis ──
    const contactFields=['name', 'email', 'phone', 'linkedin', 'github'];
    const contactPresent=contactFields.filter(f => resumeResult.candidate?.[f]);
    const contactMissing=contactFields.filter(f => !resumeResult.candidate?.[f]);
    report.contactAnalysis={
      score: Math.round((contactPresent.length/contactFields.length)*100),
      present: contactPresent,
      missing: contactMissing,
      details: resumeResult.candidate||{},
    };

    // ── Skills Analysis ──
    const techSkills=resumeResult.skills?.technical||[];
    const softSkills=resumeResult.skills?.soft||[];
    const categorized=resumeResult.skills?.categorized||{};
    report.skillsAnalysis={
      score: Math.min(100, techSkills.length*5+softSkills.length*3),
      technicalCount: techSkills.length,
      softCount: softSkills.length,
      totalUnique: (resumeResult.skills?.all||[]).length,
      technical: techSkills,
      soft: softSkills,
      categorized,
      strength: techSkills.length>=8? 'Excellent':techSkills.length>=5? 'Good':techSkills.length>=3? 'Fair':'Needs Improvement',
    };

    // ── Experience Analysis ──
    const expYears=resumeResult.experience?.years;
    const seniority=resumeResult.experience?.seniority;
    report.experienceAnalysis={
      score: expYears!=null? Math.min(100, expYears*10+(seniority? 20:0)):0,
      years: expYears,
      seniority: seniority||'Not specified',
      raw: resumeResult.experience?.raw||[],
      strength: expYears>=5? 'Senior':expYears>=2? 'Mid-level':expYears!=null? 'Entry':'Not detected',
    };

    // ── Education Analysis ──
    const education=resumeResult.education||[];
    report.educationAnalysis={
      score: education.length>0? Math.min(100, education.length*40):0,
      qualifications: education,
      count: education.length,
      strength: education.length>=2? 'Strong':education.length===1? 'Adequate':'Not found',
    };

    // ── Content Quality Analysis ──
    const text=user.resumeText.toLowerCase();
    const actionVerbs=['developed', 'implemented', 'designed', 'led', 'built', 'managed', 'created', 'optimized', 'deployed', 'automated', 'architected', 'mentored', 'collaborated', 'delivered', 'resolved', 'improved', 'scaled', 'integrated', 'launched', 'maintained'];
    const usedVerbs=actionVerbs.filter(v => text.includes(v));
    const hasQuantifiableResults=/\d+%|\d+x|\$\d+|\d+\s*(users|customers|projects|clients|team|members)/i.test(user.resumeText);
    const hasCertifications=text.includes('certified')||text.includes('certification')||text.includes('certificate');
    const hasProjects=text.includes('project');
    const hasAchievements=text.includes('achievement')||text.includes('award')||text.includes('accomplished');

    let contentScore=0;
    if (resumeResult.wordCount>=200) contentScore+=15;
    if (resumeResult.wordCount>=400) contentScore+=10;
    if (usedVerbs.length>=5) contentScore+=20;
    else if (usedVerbs.length>=2) contentScore+=10;
    if (hasQuantifiableResults) contentScore+=20;
    if (hasCertifications) contentScore+=10;
    if (hasProjects) contentScore+=15;
    if (hasAchievements) contentScore+=10;

    report.contentAnalysis={
      score: Math.min(100, contentScore),
      wordCount: resumeResult.wordCount||0,
      actionVerbs: usedVerbs,
      hasQuantifiableResults,
      hasCertifications,
      hasProjects,
      hasAchievements,
      strength: contentScore>=60? 'Excellent':contentScore>=40? 'Good':contentScore>=20? 'Fair':'Needs Improvement',
    };

    // ── Recommendations ──
    const recommendations=[];
    if (contactMissing.length>0) recommendations.push(`Add missing contact info: ${contactMissing.join(', ')}`);
    if (techSkills.length<5) recommendations.push('Add more technical skills to strengthen your profile');
    if (softSkills.length===0) recommendations.push('Include soft skills like leadership, communication, teamwork');
    if (!hasQuantifiableResults) recommendations.push('Add quantifiable achievements (e.g., "Improved performance by 40%")');
    if (usedVerbs.length<3) recommendations.push('Use more action verbs: developed, implemented, designed, optimized, etc.');
    if (resumeResult.wordCount<300) recommendations.push('Resume is too short. Aim for 400-800 words with detailed descriptions');
    if (resumeResult.wordCount>1500) recommendations.push('Resume may be too long. Focus on most relevant experience');
    if (!hasCertifications) recommendations.push('Consider adding relevant certifications to stand out');
    if (!hasProjects) recommendations.push('Add project descriptions to showcase practical skills');
    if (education.length===0) recommendations.push('Include your educational qualifications');
    if (expYears==null) recommendations.push('Clearly mention your years of experience');
    report.recommendations=recommendations;

    // ── JD Comparison (if provided) ──
    if (jdText&&jdText.trim())
    {
      const jdResult=resumeParser.parseJD(jdText);
      const gap=resumeParser.analyzeGap(jdResult, resumeResult);
      report.jdComparison={
        matchPercentage: gap.matchPercentage||0,
        matched: gap.matched||[],
        missing: gap.missing||{},
        extra: gap.extra||[],
        experienceMatch: gap.experienceMatch,
        jdRole: jdResult.role?.title||'Not specified',
        jdYears: gap.jdYears,
        resumeYears: gap.resumeYears,
      };
    }

    // Recalculate overall score from sections
    report.overallScore=Math.round(
      (report.contactAnalysis.score*0.15)+
      (report.skillsAnalysis.score*0.30)+
      (report.experienceAnalysis.score*0.20)+
      (report.educationAnalysis.score*0.15)+
      (report.contentAnalysis.score*0.20)
    );

    report.grade=report.overallScore>=80? 'A':report.overallScore>=65? 'B':report.overallScore>=50? 'C':report.overallScore>=35? 'D':'F';

    res.json({success: true, report});
  } catch (error)
  {
    console.error('Error analyzing resume:', error);
    res.status(500).json({error: 'Failed to analyze resume'});
  }
});

// Legacy ATS endpoint — redirect to analyzer
router.post('/:userId/ats-score', async (req, res) =>
{
  try
  {
    const {jdText}=req.body;
    const user=await User.findById(req.params.userId);
    if (!user) return res.status(404).json({error: 'User not found'});
    if (!user.resumeText) return res.status(400).json({error: 'No resume uploaded yet'});

    const resumeResult=resumeParser.parseResume(user.resumeText);
    const jdResult=resumeParser.parseJD(jdText);
    const gap=resumeParser.analyzeGap(jdResult, resumeResult);

    res.json({
      atsScore: user.atsScore,
      gap,
      jdResult: {
        role: jdResult.role,
        skills: jdResult.skills,
        experience: jdResult.experience,
      },
      resumeResult: {
        skills: resumeResult.skills,
        experience: resumeResult.experience,
      },
    });
  } catch (error)
  {
    console.error('Error calculating ATS score:', error);
    res.status(500).json({error: 'Failed to calculate ATS score'});
  }
});

// ── Delete resume ──
router.delete('/:userId/resume', async (req, res) =>
{
  try
  {
    const user=await User.findByIdAndUpdate(
      req.params.userId,
      {
        $set: {
          resumeText: '',
          resumeFileName: '',
          resumeUploadedAt: null,
          resumeParsed: null,
          atsScore: null,
        },
      },
      {new: true}
    ).select('-password');

    if (!user) return res.status(404).json({error: 'User not found'});
    res.json({message: 'Resume deleted', profile: user});
  } catch (error)
  {
    console.error('Error deleting resume:', error);
    res.status(500).json({error: 'Failed to delete resume'});
  }
});

// ── Helper: calculate profile completion ──
function calculateProfileCompletion(data)
{
  let score=0;
  const checks=[
    () => data.fullName||data.username,               // 10
    () => data.email,                                   // 10
    () => data.phone,                                   // 5
    () => data.headline,                                // 5
    () => data.bio&&data.bio.length>20,             // 10
    () => data.skills?.length>0,                      // 15
    () => data.education?.length>0,                   // 10
    () => data.experience?.length>0,                  // 10
    () => data.resumeText||data.resumeFileName,       // 15
    () => data.linkedIn,                                // 5
    () => data.github,                                  // 5
  ];
  const weights=[10, 10, 5, 5, 10, 15, 10, 10, 15, 5, 5];

  checks.forEach((check, i) =>
  {
    try {if (check()) score+=weights[i];} catch { /* skip */}
  });
  return Math.min(score, 100);
}

export default router;
