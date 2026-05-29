import express from 'express';
import multer from 'multer';
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const pdfParse=require('pdf-parse');
import Job from '../models/Job.js';
import Application from '../models/Application.js';
import User from '../models/User.js';
import {verifyAuth, verifyAuthOptional, verifyRole} from '../middleware/auth.js';
import {APIResponse} from '../middleware/response.js';
import {parseResume, extractCGPA, extractProjects, calculateJobMatchScore, extractSkills} from '../services/resumeParser.js';
import {uploadToCloudinary} from '../services/cloudinary.js';

const router=express.Router();

// Multer memory storage for resume uploads (max 10MB)
const resumeUpload=multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 10*1024*1024},
  fileFilter: (req, file, cb) =>
  {
    const allowed=['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX files are allowed'), false);
  },
});

/* ═══════════════════════════════════════════════════════════════════
   JOB ROUTES (Company-side)
   ═══════════════════════════════════════════════════════════════════ */

// Create a new job posting
router.post('/', verifyAuth, async (req, res) =>
{
  try
  {
    const {title, department, location, type, description, requirements, skills, userId, companyName, salary, eligibilityCriteria}=req.body;

    if (!title||!department)
    {
      return res.status(400).json({message: 'Title and department are required'});
    }

    if (!userId)
    {
      return res.status(401).json({message: 'User ID is required'});
    }

    // Verify the user is a company role
    const user=await User.findById(userId);
    if (!user||!['company_admin', 'company_hr', 'recruiter'].includes(user.role))
    {
      return res.status(403).json({message: 'Only company users can post jobs'});
    }

    const job=await Job.create({
      title,
      department,
      location: location||'Remote',
      type: type||'Full-Time',
      description: description||'',
      requirements: requirements||'',
      skills: skills||[],
      salary: salary||{min: 0, max: 0, currency: 'INR'},
      postedBy: userId,
      companyName: companyName||user.companyName||user.username,
      status: 'active',
      eligibilityCriteria: eligibilityCriteria||{},
    });

    console.log(`[JOBS] ✅ Job posted: "${title}" by ${user.username}`);

    return res.status(201).json({
      message: 'Job posted successfully',
      job: {
        id: job._id,
        title: job.title,
        department: job.department,
        location: job.location,
        type: job.type,
        description: job.description,
        requirements: job.requirements,
        skills: job.skills,
        salary: job.salary,
        companyName: job.companyName,
        status: job.status,
        eligibilityCriteria: job.eligibilityCriteria,
        applicantCount: 0,
        createdAt: job.createdAt,
      },
    });
  } catch (err)
  {
    console.error('[JOBS] Post error:', err);
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Get all jobs for a company (by userId)
router.get('/company/:userId', verifyAuth, async (req, res) =>
{
  try
  {
    const jobs=await Job.find({postedBy: req.params.userId})
      .sort({createdAt: -1})
      .lean();

    const jobsWithApplicants=await Promise.all(
      jobs.map(async (job) =>
      {
        const applicantCount=await Application.countDocuments({job: job._id});
        return {
          id: job._id,
          title: job.title,
          department: job.department,
          location: job.location,
          type: job.type,
          description: job.description,
          requirements: job.requirements,
          skills: job.skills,
          salary: job.salary,
          companyName: job.companyName,
          status: job.status,
          eligibilityCriteria: job.eligibilityCriteria,
          applicantCount,
          createdAt: job.createdAt,
        };
      })
    );

    return res.json({jobs: jobsWithApplicants});
  } catch (err)
  {
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Get all active jobs (for candidates to browse)
router.get('/browse', verifyAuthOptional, async (req, res) =>
{
  try
  {
    const {search, location, type, department}=req.query;
    const filter={status: 'active'};

    if (search)
    {
      filter.$or=[
        {title: {$regex: search, $options: 'i'}},
        {description: {$regex: search, $options: 'i'}},
        {companyName: {$regex: search, $options: 'i'}},
        {department: {$regex: search, $options: 'i'}},
      ];
    }
    if (location&&location!=='All') filter.location=location;
    if (type&&type!=='All') filter.type=type;
    if (department) filter.department={$regex: department, $options: 'i'};

    const jobs=await Job.find(filter)
      .sort({createdAt: -1})
      .lean();

    const jobsWithApplicants=jobs.map((job) => ({
      id: job._id,
      title: job.title,
      department: job.department,
      location: job.location,
      type: job.type,
      description: job.description,
      requirements: job.requirements,
      skills: job.skills,
      salary: job.salary,
      companyName: job.companyName,
      status: job.status,
      eligibilityCriteria: job.eligibilityCriteria,
      applicantCount: job.applicantCount||0,
      createdAt: job.createdAt,
    }));

    return res.json({jobs: jobsWithApplicants});
  } catch (err)
  {
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Get single job details
router.get('/:jobId', verifyAuthOptional, async (req, res) =>
{
  try
  {
    const job=await Job.findById(req.params.jobId).lean();
    if (!job) return res.status(404).json({message: 'Job not found'});

    const applicantCount=await Application.countDocuments({job: job._id});

    return res.json({
      id: job._id,
      title: job.title,
      department: job.department,
      location: job.location,
      type: job.type,
      description: job.description,
      requirements: job.requirements,
      skills: job.skills,
      salary: job.salary,
      companyName: job.companyName,
      status: job.status,
      eligibilityCriteria: job.eligibilityCriteria,
      applicantCount,
      createdAt: job.createdAt,
    });
  } catch (err)
  {
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Update job status
router.put('/:jobId', verifyAuth, async (req, res) =>
{
  try
  {
    const {status, title, department, location, type, description, requirements, skills, salary, eligibilityCriteria}=req.body;
    const update={};
    if (status) update.status=status;
    if (title) update.title=title;
    if (department) update.department=department;
    if (location) update.location=location;
    if (type) update.type=type;
    if (description!==undefined) update.description=description;
    if (requirements!==undefined) update.requirements=requirements;
    if (skills) update.skills=skills;
    if (salary) update.salary=salary;
    if (eligibilityCriteria) update.eligibilityCriteria=eligibilityCriteria;

    const job=await Job.findByIdAndUpdate(req.params.jobId, update, {new: true});
    if (!job) return res.status(404).json({message: 'Job not found'});

    return res.json({message: 'Job updated', job});
  } catch (err)
  {
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Delete job
router.delete('/:jobId', verifyAuth, async (req, res) =>
{
  try
  {
    await Job.findByIdAndDelete(req.params.jobId);
    await Application.deleteMany({job: req.params.jobId});
    return res.json({message: 'Job deleted'});
  } catch (err)
  {
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

/* ═══════════════════════════════════════════════════════════════════
   APPLICATION ROUTES (Candidate-side)
   ═══════════════════════════════════════════════════════════════════ */

// Apply to a job
router.post('/:jobId/apply', verifyAuth, resumeUpload.single('resume'), async (req, res) =>
{
  try
  {
    const {candidateId, coverLetter}=req.body;
    const {jobId}=req.params;

    if (!candidateId)
    {
      return res.status(401).json({message: 'Candidate ID is required'});
    }

    const job=await Job.findById(jobId);
    if (!job) return res.status(404).json({message: 'Job not found'});
    if (job.status!=='active') return res.status(400).json({message: 'This job is no longer accepting applications'});

    // Check for duplicate application
    const existing=await Application.findOne({job: jobId, candidate: candidateId});
    if (existing)
    {
      return res.status(400).json({message: 'You have already applied to this job'});
    }

    // ── Upload resume to Cloudinary if provided ──
    let resumeUrl='';
    let resumePublicId='';
    let uploadedResumeText='';

    if (req.file)
    {
      try
      {
        // Upload to Cloudinary
        const cloudResult=await uploadToCloudinary(req.file.buffer, {
          folder: 'hirespec-resumes',
          publicId: `resume_${candidateId}_${jobId}_${Date.now()}`,
        });
        resumeUrl=cloudResult.secureUrl;
        resumePublicId=cloudResult.publicId;
        console.log(`[JOBS] ☁ Resume uploaded to Cloudinary: ${resumeUrl}`);

        // Extract text from uploaded PDF for ATS scoring
        if (req.file.mimetype==='application/pdf')
        {
          try
          {
            const pdfData=await pdfParse(req.file.buffer);
            uploadedResumeText=pdfData.text||'';
          } catch (pdfErr)
          {
            console.warn('[JOBS] PDF parse warning:', pdfErr.message);
          }
        }
      } catch (cloudErr)
      {
        console.error('[JOBS] Cloudinary upload failed:', cloudErr.message);
        // Continue without resume URL — don't block application
      }
    }

    // ── ATS Scoring on Apply ──
    const candidate=await User.findById(candidateId);
    let atsData={atsScore: 0, skillMatchScore: 0, matchedSkills: [], missingSkills: [], eligible: true, eligibilityReasons: [], cgpa: 0, experienceYears: 0, projectDetails: [], resumeParsed: null};

    if (candidate)
    {
      // Parse resume if available — prefer freshly uploaded resume text
      const resumeText=uploadedResumeText||candidate.resumeText||'';
      let resumeResult=null;

      if (resumeText)
      {
        resumeResult=parseResume(resumeText);
      }
      if (!resumeResult&&candidate.resumeParsed)
      {
        resumeResult=candidate.resumeParsed;
      }

      // Build skills from user.skills if no resume
      const profileSkills=(candidate.skills||[]).map(s => s.trim()).filter(Boolean);
      if (!resumeResult||!resumeResult.success)
      {
        resumeResult={
          success: true,
          skills: {technical: profileSkills, soft: [], all: profileSkills, categorized: {}},
          experience: {years: 0, range: null, seniority: null},
          education: [],
          atsScore: 0,
        };
      } else
      {
        // MERGE profile skills into resume-parsed skills so nothing is missed
        const existingAll=new Set((resumeResult.skills?.all||[]).map(s => s.toLowerCase()));
        for (const ps of profileSkills)
        {
          if (!existingAll.has(ps.toLowerCase()))
          {
            resumeResult.skills.all.push(ps);
            resumeResult.skills.technical.push(ps);
          }
        }
      }

      // Extract CGPA from resume text or education
      let cgpa=0;
      if (resumeText)
      {
        const cgpaResult=extractCGPA(resumeText);
        cgpa=cgpaResult.cgpa;
      }
      // Also check user education for grade
      if (!cgpa&&candidate.education?.length>0)
      {
        for (const edu of candidate.education)
        {
          if (edu.grade)
          {
            const gradeNum=parseFloat(edu.grade);
            if (!isNaN(gradeNum)&&gradeNum>0&&gradeNum<=10)
            {
              cgpa=gradeNum;
              break;
            }
          }
        }
      }

      // Extract projects from resume or user profile
      let projectDetails=[];
      if (resumeText)
      {
        projectDetails=extractProjects(resumeText);
      }
      if (projectDetails.length===0&&candidate.projects?.length>0)
      {
        projectDetails=candidate.projects.map(p => ({
          name: p.name||'',
          description: p.description||'',
          technologies: Array.isArray(p.technologies)? p.technologies:[],
          relevanceScore: 0,
        }));
        // Calculate relevance for profile projects
        for (const p of projectDetails)
        {
          const fullText=`${p.name} ${p.description} ${p.technologies.join(' ')}`;
          const skills=extractSkills(fullText);
          p.technologies=skills.technical.length>0? skills.technical:p.technologies;
          p.relevanceScore=Math.min(p.technologies.length*15+(p.description?.length>30? 15:0), 100);
        }
      }

      // Calculate job match score
      const matchResult=calculateJobMatchScore({
        resumeResult,
        job,
        candidateCGPA: cgpa,
      });

      atsData={
        atsScore: matchResult.atsScore,
        skillMatchScore: matchResult.skillMatchScore,
        matchedSkills: matchResult.matchedSkills,
        missingSkills: matchResult.missingSkills,
        eligible: matchResult.eligible,
        eligibilityReasons: matchResult.eligibilityReasons,
        cgpa,
        experienceYears: matchResult.experienceYears||resumeResult?.experience?.years||0,
        projectDetails: projectDetails.slice(0, 5),
        resumeParsed: resumeResult?.success? {
          skills: resumeResult.skills,
          experience: resumeResult.experience,
          education: resumeResult.education,
        }:null,
      };
    }

    // Determine initial status based on eligibility & auto-shortlisting
    let initialStatus='applied';
    let initialRound='Applied';
    if (!atsData.eligible)
    {
      initialStatus='not_eligible';
      initialRound='Not Eligible';
    } else if (job.eligibilityCriteria?.autoShortlist&&atsData.atsScore>=(job.eligibilityCriteria?.minATSScore||60))
    {
      initialStatus='shortlisted';
      initialRound='Auto-Shortlisted';
    }

    const application=await Application.create({
      job: jobId,
      candidate: candidateId,
      coverLetter: coverLetter||'',
      resumeUrl,
      resumePublicId,
      status: initialStatus,
      round: initialRound,
      score: atsData.atsScore,
      atsScore: atsData.atsScore,
      skillMatchScore: atsData.skillMatchScore,
      matchedSkills: atsData.matchedSkills,
      missingSkills: atsData.missingSkills,
      cgpa: atsData.cgpa,
      experienceYears: atsData.experienceYears,
      eligible: atsData.eligible,
      eligibilityReasons: atsData.eligibilityReasons,
      projectDetails: atsData.projectDetails,
      resumeParsed: atsData.resumeParsed,
      shortlistedAt: initialStatus==='shortlisted'? new Date():undefined,
    });

    // Increment applicant count
    await Job.findByIdAndUpdate(jobId, {$inc: {applicantCount: 1}});

    console.log(`[JOBS] ✅ Application submitted for job "${job.title}" by candidate ${candidateId} (ATS: ${atsData.atsScore}, Eligible: ${atsData.eligible})`);

    return res.status(201).json({
      message: atsData.eligible
        ? (initialStatus==='shortlisted'? 'Application submitted & auto-shortlisted!':'Application submitted successfully')
        :'Application submitted — does not meet minimum criteria',
      application: {
        id: application._id,
        jobId: application.job,
        status: application.status,
        resumeUrl: resumeUrl||'',
        atsScore: atsData.atsScore,
        skillMatchScore: atsData.skillMatchScore,
        matchedSkills: atsData.matchedSkills,
        missingSkills: atsData.missingSkills,
        cgpa: atsData.cgpa,
        experienceYears: atsData.experienceYears,
        eligible: atsData.eligible,
        eligibilityReasons: atsData.eligibilityReasons,
        projectDetails: atsData.projectDetails||[],
        createdAt: application.createdAt,
      },
    });
  } catch (err)
  {
    if (err.code===11000)
    {
      return res.status(400).json({message: 'You have already applied to this job'});
    }
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Get candidate's applications
router.get('/applications/:candidateId', verifyAuth, async (req, res) =>
{
  try
  {
    const applications=await Application.find({candidate: req.params.candidateId})
      .populate('job', 'title department location type companyName status createdAt skills salary')
      .sort({createdAt: -1})
      .lean();

    const result=applications.map((app) => ({
      id: app._id,
      status: app.status,
      round: app.round,
      score: app.score,
      atsScore: app.atsScore||0,
      skillMatchScore: app.skillMatchScore||0,
      matchedSkills: app.matchedSkills||[],
      missingSkills: app.missingSkills||[],
      cgpa: app.cgpa||0,
      eligible: app.eligible!==false,
      resumeUrl: app.resumeUrl||'',
      appliedAt: app.createdAt,
      job: app.job? {
        id: app.job._id,
        title: app.job.title,
        department: app.job.department,
        location: app.job.location,
        type: app.job.type,
        companyName: app.job.companyName,
        status: app.job.status,
        skills: app.job.skills||[],
        salary: app.job.salary,
      }:null,
    }));

    return res.json({applications: result});
  } catch (err)
  {
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Get applicants for a job (company-side) — with ATS data
router.get('/:jobId/applicants', verifyAuth, async (req, res) =>
{
  try
  {
    const {sortBy='atsScore', filterStatus, minScore}=req.query;

    const query={job: req.params.jobId};
    if (filterStatus&&filterStatus!=='all')
    {
      query.status=filterStatus;
    }
    if (minScore)
    {
      query.atsScore={$gte: parseInt(minScore)};
    }

    const sortOptions={};
    if (sortBy==='atsScore') sortOptions.atsScore=-1;
    else if (sortBy==='skillMatch') sortOptions.skillMatchScore=-1;
    else if (sortBy==='cgpa') sortOptions.cgpa=-1;
    else if (sortBy==='date') sortOptions.createdAt=-1;
    else sortOptions.atsScore=-1;

    const applications=await Application.find(query)
      .populate('candidate', 'username email skills bio createdAt fullName education experience projects resumeText')
      .sort(sortOptions)
      .lean();

    const result=applications.map((app) => ({
      id: app._id,
      status: app.status,
      round: app.round,
      score: app.score,
      atsScore: app.atsScore||0,
      skillMatchScore: app.skillMatchScore||0,
      matchedSkills: app.matchedSkills||[],
      missingSkills: app.missingSkills||[],
      cgpa: app.cgpa||0,
      experienceYears: app.experienceYears||0,
      eligible: app.eligible!==false,
      eligibilityReasons: app.eligibilityReasons||[],
      projectDetails: app.projectDetails||[],
      resumeUrl: app.resumeUrl||'',
      appliedAt: app.createdAt,
      shortlistedAt: app.shortlistedAt,
      candidate: app.candidate? {
        id: app.candidate._id,
        name: app.candidate.fullName||app.candidate.username,
        email: app.candidate.email,
        skills: app.candidate.skills,
        bio: app.candidate.bio,
        education: app.candidate.education,
        experience: app.candidate.experience,
        projects: app.candidate.projects,
      }:null,
    }));

    return res.json({applicants: result});
  } catch (err)
  {
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Bulk shortlist applicants by ATS threshold
router.post('/:jobId/shortlist', verifyAuth, async (req, res) =>
{
  try
  {
    const {jobId}=req.params;
    const {minATSScore=60, changedBy}=req.body;

    const job=await Job.findById(jobId);
    if (!job) return res.status(404).json({message: 'Job not found'});

    // Find eligible applications above threshold
    const applications=await Application.find({
      job: jobId,
      status: 'applied',
      eligible: true,
      atsScore: {$gte: minATSScore},
    });

    let shortlistedCount=0;
    for (const app of applications)
    {
      app.status='shortlisted';
      app.round='Shortlisted';
      app.shortlistedAt=new Date();
      app.statusHistory.push({
        status: 'shortlisted',
        changedAt: new Date(),
        changedBy: changedBy||null,
        note: `Auto-shortlisted (ATS Score: ${app.atsScore} >= ${minATSScore})`,
      });
      await app.save();
      shortlistedCount++;
    }

    console.log(`[JOBS] ✅ Bulk shortlisted ${shortlistedCount} applicants for job "${job.title}" (threshold: ${minATSScore})`);

    return res.json({
      message: `${shortlistedCount} applicant(s) shortlisted`,
      shortlistedCount,
      threshold: minATSScore,
    });
  } catch (err)
  {
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Re-score all applicants for a job (useful after criteria change)
router.post('/:jobId/rescore', verifyAuth, async (req, res) =>
{
  try
  {
    const {jobId}=req.params;
    const job=await Job.findById(jobId);
    if (!job) return res.status(404).json({message: 'Job not found'});

    const applications=await Application.find({job: jobId}).populate('candidate', 'resumeText skills education projects resumeParsed');
    let rescored=0;

    for (const app of applications)
    {
      const candidate=app.candidate;
      if (!candidate) continue;

      const resumeText=candidate.resumeText||'';
      let resumeResult=candidate.resumeParsed||null;
      if (resumeText&&!resumeResult)
      {
        resumeResult=parseResume(resumeText);
      }
      const profileSkills=(candidate.skills||[]).map(s => s.trim()).filter(Boolean);
      if (!resumeResult||!resumeResult.success)
      {
        resumeResult={
          success: true,
          skills: {technical: profileSkills, soft: [], all: profileSkills, categorized: {}},
          experience: {years: 0},
          education: [],
          atsScore: 0,
        };
      } else
      {
        // Merge profile skills into resume-parsed skills
        const existingAll=new Set((resumeResult.skills?.all||[]).map(s => s.toLowerCase()));
        for (const ps of profileSkills)
        {
          if (!existingAll.has(ps.toLowerCase()))
          {
            resumeResult.skills.all.push(ps);
            resumeResult.skills.technical.push(ps);
          }
        }
      }

      let cgpa=0;
      if (resumeText) cgpa=extractCGPA(resumeText).cgpa;
      if (!cgpa&&candidate.education?.length>0)
      {
        for (const edu of candidate.education)
        {
          if (edu.grade)
          {
            const g=parseFloat(edu.grade);
            if (!isNaN(g)&&g>0&&g<=10) {cgpa=g; break;}
          }
        }
      }

      const matchResult=calculateJobMatchScore({resumeResult, job, candidateCGPA: cgpa});

      app.atsScore=matchResult.atsScore;
      app.skillMatchScore=matchResult.skillMatchScore;
      app.matchedSkills=matchResult.matchedSkills;
      app.missingSkills=matchResult.missingSkills;
      app.eligible=matchResult.eligible;
      app.eligibilityReasons=matchResult.eligibilityReasons;
      app.cgpa=cgpa;
      app.experienceYears=matchResult.experienceYears;
      app.score=matchResult.atsScore;

      // Re-evaluate status based on eligibility & auto-shortlist
      if (!matchResult.eligible&&app.status==='applied')
      {
        app.status='not_eligible';
        app.round='Not Eligible';
      } else if (matchResult.eligible&&app.status==='not_eligible')
      {
        app.status='applied';
        app.round='Applied';
      }
      if (matchResult.eligible&&job.eligibilityCriteria?.autoShortlist&&matchResult.atsScore>=(job.eligibilityCriteria?.minATSScore||60)&&(app.status==='applied'))
      {
        app.status='shortlisted';
        app.round='Auto-Shortlisted';
        app.shortlistedAt=new Date();
      }

      await app.save();
      rescored++;
    }

    return res.json({message: `Re-scored ${rescored} applications`, rescored});
  } catch (err)
  {
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Update application status (company-side)
router.put('/applications/:applicationId', verifyAuth, async (req, res) =>
{
  try
  {
    const {status, round, score, notes}=req.body;
    const update={};
    if (status) update.status=status;
    if (round) update.round=round;
    if (score!==undefined) update.score=score;
    if (notes!==undefined) update.notes=notes;

    const application=await Application.findByIdAndUpdate(req.params.applicationId, update, {new: true});
    if (!application) return res.status(404).json({message: 'Application not found'});

    return res.json({message: 'Application updated', application});
  } catch (err)
  {
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Get candidate dashboard stats
router.get('/stats/:candidateId', verifyAuth, async (req, res) =>
{
  try
  {
    const candidateId=req.params.candidateId;

    const [totalApplied, inProgress, pending, totalJobs, shortlisted, selected]=await Promise.all([
      Application.countDocuments({candidate: candidateId}),
      Application.countDocuments({candidate: candidateId, status: {$in: ['screening', 'interview', 'assessment']}}),
      Application.countDocuments({candidate: candidateId, status: 'applied'}),
      Job.countDocuments({status: 'active'}),
      Application.countDocuments({candidate: candidateId, status: 'shortlisted'}),
      Application.countDocuments({candidate: candidateId, status: {$in: ['selected', 'offered', 'hired']}}),
    ]);

    return res.json({
      applied: totalApplied,
      assessments: inProgress,
      pending,
      availableJobs: totalJobs,
      shortlisted,
      selected,
    });
  } catch (err)
  {
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

/* ═══════════════════════════════════════════════════════════════════
   KANBAN ROUTES (Candidate-side grouped by status)
   ═══════════════════════════════════════════════════════════════════ */

// Get Kanban-grouped applications for a candidate
router.get('/kanban/:candidateId', verifyAuth, async (req, res) =>
{
  try
  {
    const candidateId=req.params.candidateId;

    const applications=await Application.find({candidate: candidateId})
      .populate('job', 'title department location type companyName status createdAt skills salary description')
      .sort({createdAt: -1})
      .lean();

    // Group applications by Kanban columns
    const kanban={
      applied: [],
      shortlisted: [],
      selected: [],
      rejected: [],
      not_eligible: [],
    };

    applications.forEach(app =>
    {
      const item={
        id: app._id,
        status: app.status,
        round: app.round,
        score: app.score,
        atsScore: app.atsScore||0,
        skillMatchScore: app.skillMatchScore||0,
        matchedSkills: app.matchedSkills||[],
        missingSkills: app.missingSkills||[],
        cgpa: app.cgpa||0,
        eligible: app.eligible!==false,
        eligibilityReasons: app.eligibilityReasons||[],
        resumeUrl: app.resumeUrl||'',
        notes: app.notes,
        appliedAt: app.appliedAt||app.createdAt,
        shortlistedAt: app.shortlistedAt,
        selectedAt: app.selectedAt,
        statusHistory: app.statusHistory||[],
        job: app.job? {
          id: app.job._id,
          title: app.job.title,
          department: app.job.department,
          location: app.job.location,
          type: app.job.type,
          companyName: app.job.companyName,
          status: app.job.status,
          skills: app.job.skills||[],
          salary: app.job.salary,
          description: app.job.description,
          createdAt: app.job.createdAt,
        }:null,
      };

      if (app.status==='not_eligible')
      {
        kanban.not_eligible.push(item);
      } else if (['applied', 'screening'].includes(app.status))
      {
        kanban.applied.push(item);
      } else if (['shortlisted', 'interview', 'assessment'].includes(app.status))
      {
        kanban.shortlisted.push(item);
      } else if (['selected', 'offered', 'hired'].includes(app.status))
      {
        kanban.selected.push(item);
      } else if (['rejected', 'withdrawn'].includes(app.status))
      {
        kanban.rejected.push(item);
      } else
      {
        kanban.applied.push(item);
      }
    });

    return res.json({
      kanban,
      counts: {
        applied: kanban.applied.length,
        shortlisted: kanban.shortlisted.length,
        selected: kanban.selected.length,
        rejected: kanban.rejected.length,
        not_eligible: kanban.not_eligible.length,
        total: applications.length,
      },
    });
  } catch (err)
  {
    console.error('[JOBS] Kanban error:', err);
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Update application status (company-side — for Kanban management)
router.put('/applications/:applicationId/status', verifyAuth, async (req, res) =>
{
  try
  {
    const {status, note, changedBy}=req.body;
    if (!status) return res.status(400).json({message: 'Status is required'});

    const validStatuses=['applied', 'shortlisted', 'selected', 'screening', 'interview', 'assessment', 'offered', 'hired', 'rejected', 'withdrawn', 'not_eligible'];
    if (!validStatuses.includes(status))
    {
      return res.status(400).json({message: 'Invalid status'});
    }

    const application=await Application.findById(req.params.applicationId);
    if (!application) return res.status(404).json({message: 'Application not found'});

    const oldStatus=application.status;
    application.status=status;

    // Set timestamps for Kanban columns
    if (status==='shortlisted'&&!application.shortlistedAt)
    {
      application.shortlistedAt=new Date();
    }
    if (['selected', 'offered', 'hired'].includes(status)&&!application.selectedAt)
    {
      application.selectedAt=new Date();
    }

    // Add to status history
    if (!application.statusHistory) application.statusHistory=[];
    application.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: changedBy||null,
      note: note||`Status changed from ${oldStatus} to ${status}`,
    });

    await application.save();

    console.log(`[JOBS] ✅ Application ${application._id} status: ${oldStatus} → ${status}`);

    return res.json({
      message: 'Application status updated',
      application: {
        id: application._id,
        status: application.status,
        shortlistedAt: application.shortlistedAt,
        selectedAt: application.selectedAt,
        statusHistory: application.statusHistory,
      },
    });
  } catch (err)
  {
    console.error('[JOBS] Status update error:', err);
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// Get company dashboard stats
router.get('/company-stats/:userId', verifyAuth, async (req, res) =>
{
  try
  {
    const userId=req.params.userId;

    const jobs=await Job.find({postedBy: userId}).lean();
    const jobIds=jobs.map(j => j._id);

    const [totalApplicants, inInterview, offered, hired]=await Promise.all([
      Application.countDocuments({job: {$in: jobIds}}),
      Application.countDocuments({job: {$in: jobIds}, status: 'interview'}),
      Application.countDocuments({job: {$in: jobIds}, status: 'offered'}),
      Application.countDocuments({job: {$in: jobIds}, status: 'hired'}),
    ]);

    return res.json({
      activeJobs: jobs.filter(j => j.status==='active').length,
      totalApplicants,
      inInterview,
      offered,
      hired,
    });
  } catch (err)
  {
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

// ─── Leaderboard: All candidates ranked across all company jobs ───
router.get('/leaderboard/:userId', verifyAuth, async (req, res) =>
{
  try
  {
    const userId=req.params.userId;
    const {jobId, limit=50}=req.query;

    // Get all jobs posted by this company user
    const jobs=await Job.find({postedBy: userId}).select('_id title department').lean();
    if (!jobs.length) return res.json({leaderboard: [], jobs: []});

    const jobIds=jobId? [jobId]:jobs.map(j => j._id);
    const jobMap={};
    jobs.forEach(j => {jobMap[j._id.toString()]={title: j.title, department: j.department};});

    // Fetch all applications across these jobs
    const applications=await Application.find({job: {$in: jobIds}})
      .populate('candidate', 'username email fullName phone skills education experience atsScore')
      .populate('job', 'title department')
      .sort({atsScore: -1, skillMatchScore: -1})
      .limit(parseInt(limit))
      .lean();

    // Build a deduplicated leaderboard – best application per candidate
    const candidateMap=new Map();
    for (const app of applications)
    {
      if (!app.candidate) continue;
      const cid=app.candidate._id.toString();
      const compositeScore=Math.round(((app.atsScore||0)*0.5+(app.skillMatchScore||0)*0.3+(app.cgpa||0)*2)*10)/10;

      if (!candidateMap.has(cid)||candidateMap.get(cid).compositeScore<compositeScore)
      {
        candidateMap.set(cid, {
          candidateId: cid,
          name: app.candidate.fullName||app.candidate.username||'Unknown',
          email: app.candidate.email||'',
          phone: app.candidate.phone||'',
          skills: app.candidate.skills||[],
          education: app.candidate.education||[],
          experience: app.candidate.experience||[],
          atsScore: app.atsScore||0,
          skillMatchScore: app.skillMatchScore||0,
          cgpa: app.cgpa||0,
          compositeScore,
          status: app.status,
          jobTitle: app.job?.title||'—',
          jobDepartment: app.job?.department||'',
          jobId: app.job?._id?.toString()||'',
          appliedAt: app.createdAt,
          matchedSkills: app.matchedSkills||[],
          missingSkills: app.missingSkills||[],
          eligible: app.eligible!==false,
        });
      }
    }

    // Sort by compositeScore desc, assign rank
    const leaderboard=[...candidateMap.values()]
      .sort((a, b) => b.compositeScore-a.compositeScore)
      .map((c, i) => ({...c, rank: i+1}));

    return res.json({
      leaderboard,
      jobs: jobs.map(j => ({id: j._id, title: j.title, department: j.department})),
      total: leaderboard.length,
    });
  } catch (err)
  {
    console.error('[JOBS] Leaderboard error:', err);
    return res.status(500).json({message: `Server error: ${err.message}`});
  }
});

export default router;
