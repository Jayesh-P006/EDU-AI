import dotenv from 'dotenv';
import mongoose from 'mongoose';
import crypto from 'crypto';
import User from './models/User.js';
import Job from './models/Job.js';
import Application from './models/Application.js';

// Load environment variables
dotenv.config();

const uri = process.env.MONGODB_URI;

// Password hashing logic matching backend/routes/auth.js
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function seedDatabase() {
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in environment variables!');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  try {
    await mongoose.connect(uri, { dbName: 'hirespec' });
    console.log('✅ Connected successfully to MongoDB dbName: hirespec');

    // ── 1. Create Recruiter and Company Users ──
    console.log('👥 Seeding Company Admins and Recruiters...');
    
    const companySpecs = [
      {
        username: 'google_hr',
        email: 'hr@google.demo',
        role: 'company_admin',
        companyName: 'Google India',
        fullName: 'Rajesh Nair',
        bio: 'HR Lead for Google India Dev Centres.',
      },
      {
        username: 'microsoft_recruiter',
        email: 'recruiter@microsoft.demo',
        role: 'recruiter',
        companyName: 'Microsoft',
        fullName: 'Sarah Jenkins',
        bio: 'Senior Technical Talent Acquisition Specialist.',
      },
      {
        username: 'meta_admin',
        email: 'admin@meta.demo',
        role: 'company_admin',
        companyName: 'Meta',
        fullName: 'David Chen',
        bio: 'Director of Recruiting at Meta APAC.',
      },
      {
        username: 'stripe_recruiter',
        email: 'recruiter@stripe.demo',
        role: 'recruiter',
        companyName: 'Stripe',
        fullName: 'Elena Rostova',
        bio: 'Technical recruiter specializing in APAC engineering hires.',
      }
    ];

    const companies = [];
    for (const spec of companySpecs) {
      let user = await User.findOne({ username: spec.username });
      if (!user) {
        user = await User.create({
          ...spec,
          password: hashPassword('demo123'),
          profileComplete: 80 + Math.floor(Math.random() * 20),
        });
        console.log(`+ Created Company User: ${spec.username}`);
      } else {
        console.log(`~ Company User already exists: ${spec.username}`);
      }
      companies.push(user);
    }

    // ── 2. Create Candidate (Student) Users ──
    console.log('🎓 Seeding Candidates...');
    
    const candidateSpecs = [
      {
        username: 'aditya_k',
        email: 'aditya@eduai.demo',
        fullName: 'Aditya Kumar',
        skills: ['Java', 'Spring Boot', 'MySQL', 'System Design', 'Docker'],
        bio: 'B.Tech CS Student at IIT Gandhinagar. Backend engineer focusing on Java web applications and system scalability.',
        desiredRole: 'Software Engineer (Backend)',
        location: 'Gandhinagar, India',
        headline: 'Aspiring Backend Developer | Java & Spring enthusiast',
        desiredSalary: '18,000,000 INR',
        atsScore: 92,
        profileComplete: 90,
      },
      {
        username: 'ananya_i',
        email: 'ananya@eduai.demo',
        fullName: 'Ananya Iyer',
        skills: ['Python', 'Machine Learning', 'TensorFlow', 'Pandas', 'SQL'],
        bio: 'Final year Data Science student. Passionate about applying machine learning to real-world business challenges.',
        desiredRole: 'Data Scientist / ML Engineer',
        location: 'Mumbai, India',
        headline: 'Data Scientist | Machine Learning Specialist',
        desiredSalary: '16,000,000 INR',
        atsScore: 87,
        profileComplete: 85,
      },
      {
        username: 'kabir_m',
        email: 'kabir@eduai.demo',
        fullName: 'Kabir Mehta',
        skills: ['JavaScript', 'React', 'Node.js', 'Express', 'CSS', 'HTML'],
        bio: 'Front-end enthusiast with a love for clean UI/UX design and modern web development.',
        desiredRole: 'Frontend Developer',
        location: 'Delhi, India',
        headline: 'React Frontend Developer | UI Enthusiast',
        desiredSalary: '12,000,000 INR',
        atsScore: 81,
        profileComplete: 95,
      },
      {
        username: 'riya_s',
        email: 'riya@eduai.demo',
        fullName: 'Riya Sen',
        skills: ['Go', 'Kubernetes', 'Docker', 'AWS', 'Linux', 'Terraform'],
        bio: 'DevOps researcher interested in cloud-native infrastructure automation and continuous integration pipelines.',
        desiredRole: 'DevOps / Site Reliability Engineer',
        location: 'Bangalore, India',
        headline: 'Go Developer & DevOps Engineer',
        desiredSalary: '20,000,000 INR',
        atsScore: 95,
        profileComplete: 88,
      },
      {
        username: 'vikram_m',
        email: 'vikram@eduai.demo',
        fullName: 'Vikram Malhotra',
        skills: ['PHP', 'Laravel', 'HTML', 'CSS', 'JavaScript', 'SQL'],
        bio: 'Self-taught full-stack developer with experience building web applications for small businesses.',
        desiredRole: 'Full Stack Engineer',
        location: 'Pune, India',
        headline: 'Full-stack Web Developer | PHP & React Specialist',
        desiredSalary: '10,000,000 INR',
        atsScore: 75,
        profileComplete: 75,
      },
      {
        username: 'neha_p',
        email: 'neha@eduai.demo',
        fullName: 'Neha Patel',
        skills: ['C++', 'Algorithms', 'Data Structures', 'Python', 'Git'],
        bio: 'Competitive programmer who loves solving algorithmic puzzles and writing efficient C++ code.',
        desiredRole: 'Software Engineer',
        location: 'Ahmedabad, India',
        headline: 'C++ Competitive Programmer | Coding Enthusiast',
        desiredSalary: '15,000,000 INR',
        atsScore: 88,
        profileComplete: 80,
      },
      {
        username: 'sid_g',
        email: 'sid@eduai.demo',
        fullName: 'Siddharth Gupta',
        skills: ['TypeScript', 'Next.js', 'PostgreSQL', 'GraphQL', 'Tailwind'],
        bio: 'Fullstack web engineer building responsive web apps using TypeScript, Next.js, and Postgres.',
        desiredRole: 'Fullstack Developer',
        location: 'Gandhinagar, India',
        headline: 'TypeScript & Next.js Fullstack Developer',
        desiredSalary: '14,000,000 INR',
        atsScore: 84,
        profileComplete: 90,
      }
    ];

    const candidates = [];
    for (const spec of candidateSpecs) {
      let user = await User.findOne({ username: spec.username });
      if (!user) {
        user = await User.create({
          ...spec,
          password: hashPassword('demo123'),
          role: 'candidate',
          faceRegistered: false,
          education: [{
            degree: 'B.Tech',
            field: 'Computer Science',
            institution: 'IIT Gandhinagar',
            year: '2026',
            startYear: '2022',
            endYear: '2026',
            grade: '9.0/10 CGPA'
          }]
        });
        console.log(`+ Created Candidate: ${spec.username}`);
      } else {
        console.log(`~ Candidate already exists: ${spec.username}`);
      }
      candidates.push(user);
    }

    // ── 3. Create Sample Jobs ──
    console.log('💼 Seeding Jobs...');
    
    const jobSpecs = [
      {
        title: 'Backend Software Engineer (Go)',
        department: 'Engineering',
        location: 'Remote',
        type: 'Full-Time',
        description: 'Build high-performance microservices and cloud infrastructure in Go.',
        requirements: 'Experience with Go programming, REST/gRPC APIs, Docker, and SQL databases.',
        skills: ['Go', 'Docker', 'Kubernetes', 'SQL', 'AWS'],
        companyName: 'Google India',
        salary: { min: 1500000, max: 2500000, currency: 'INR' },
        recruiterIndex: 0, // Google
      },
      {
        title: 'Software Development Engineer II',
        department: 'Engineering',
        location: 'Hybrid',
        type: 'Full-Time',
        description: 'Design and deploy robust cloud platform features for Microsoft Azure core services.',
        requirements: 'Experience with Java, C#, or C++ development, cloud architectures, and system performance design.',
        skills: ['Java', 'Docker', 'Azure', 'C#', 'SQL'],
        companyName: 'Microsoft',
        salary: { min: 1400000, max: 2200000, currency: 'INR' },
        recruiterIndex: 1, // Microsoft
      },
      {
        title: 'Machine Learning Research Engineer',
        department: 'Research',
        location: 'On-site',
        type: 'Full-Time',
        description: 'Train and optimize state-of-the-art deep learning models for NLP and vision pipelines.',
        requirements: 'Solid knowledge of Python, PyTorch/TensorFlow, pandas, machine learning math, and model deployment.',
        skills: ['Python', 'TensorFlow', 'Pandas', 'Algorithms', 'Git'],
        companyName: 'Meta',
        salary: { min: 1800000, max: 2800000, currency: 'INR' },
        recruiterIndex: 2, // Meta
      },
      {
        title: 'Front-end Engineer (React)',
        department: 'Product',
        location: 'Remote',
        type: 'Full-Time',
        description: 'Craft beautiful payment dashboard components and design-system libraries using React & TypeScript.',
        requirements: 'Advanced React patterns, CSS transitions, responsive layouts, typescript, and frontend bundle optimization.',
        skills: ['JavaScript', 'TypeScript', 'React', 'HTML', 'CSS', 'Tailwind'],
        companyName: 'Stripe',
        salary: { min: 1200000, max: 1800000, currency: 'INR' },
        recruiterIndex: 3, // Stripe
      },
      {
        title: 'DevOps Engineering Intern',
        department: 'Infrastructure',
        location: 'Remote',
        type: 'Internship',
        description: 'Assist in containerizing backend web systems and configuring CI/CD pipelines.',
        requirements: 'Familiarity with Git, Linux terminal, Docker foundations, and hosting applications on AWS.',
        skills: ['Linux', 'Docker', 'Git', 'AWS', 'JavaScript'],
        companyName: 'Google India',
        salary: { min: 40000, max: 60000, currency: 'INR' },
        recruiterIndex: 0, // Google
      }
    ];

    const jobs = [];
    for (const spec of jobSpecs) {
      let job = await Job.findOne({ title: spec.title, companyName: spec.companyName });
      if (!job) {
        const recruiter = companies[spec.recruiterIndex];
        job = await Job.create({
          title: spec.title,
          department: spec.department,
          location: spec.location,
          type: spec.type,
          description: spec.description,
          requirements: spec.requirements,
          skills: spec.skills,
          salary: spec.salary,
          companyName: spec.companyName,
          postedBy: recruiter._id,
          status: 'active',
          applicantCount: 0,
        });
        console.log(`+ Created Job: "${spec.title}" for ${spec.companyName}`);
      } else {
        console.log(`~ Job already exists: "${spec.title}"`);
      }
      jobs.push(job);
    }

    // ── 4. Create Job Applications (Funnel Data) ──
    console.log('📈 Seeding Applications...');
    
    // We want a mix of statuses for our dashboard figures:
    // applied, screening, shortlisted, interview, offered, hired, rejected, not_eligible
    const appSpecs = [
      { candIndex: 0, jobIndex: 1, status: 'interview', round: 'Technical Round 2', score: 85 }, // Aditya to Microsoft
      { candIndex: 0, jobIndex: 4, status: 'applied', round: 'Applied', score: 0 }, // Aditya to Google DevOps Intern
      { candIndex: 1, jobIndex: 2, status: 'hired', round: 'Hired', score: 92 }, // Ananya to Meta ML (Hired)
      { candIndex: 2, jobIndex: 3, status: 'offered', round: 'Offer Extended', score: 88 }, // Kabir to Stripe React (Offered)
      { candIndex: 3, jobIndex: 0, status: 'selected', round: 'HR Round Completed', score: 94 }, // Riya to Google Go (Selected)
      { candIndex: 3, jobIndex: 1, status: 'shortlisted', round: 'Online Test Passed', score: 90 }, // Riya to Microsoft
      { candIndex: 4, jobIndex: 3, status: 'rejected', round: 'Resume Screening', score: 45 }, // Vikram to Stripe React (Rejected)
      { candIndex: 5, jobIndex: 0, status: 'screening', round: 'Resume Review', score: 68 }, // Neha to Google Go
      { candIndex: 5, jobIndex: 1, status: 'applied', round: 'Applied', score: 0 }, // Neha to Microsoft
      { candIndex: 6, jobIndex: 3, status: 'interview', round: 'System Design', score: 82 }, // Sid to Stripe React
      { candIndex: 6, jobIndex: 1, status: 'rejected', round: 'Online Coding Test', score: 55 }, // Sid to Microsoft
      { candIndex: 2, jobIndex: 0, status: 'not_eligible', round: 'Mismatch', score: 30 } // Ananya to Google Go (Not Eligible)
    ];

    for (const spec of appSpecs) {
      const candidate = candidates[spec.candIndex];
      const job = jobs[spec.jobIndex];

      const existing = await Application.findOne({ job: job._id, candidate: candidate._id });
      if (!existing) {
        await Application.create({
          job: job._id,
          candidate: candidate._id,
          status: spec.status,
          round: spec.round,
          score: spec.score,
          atsScore: candidate.atsScore || 75,
          skillMatchScore: Math.floor(60 + Math.random() * 40),
          appliedAt: new Date(Date.now() - (Math.random() * 30 + 1) * 24 * 60 * 60 * 1000), // applied 1-30 days ago
        });
        
        // Increment applicant count on job
        await Job.findByIdAndUpdate(job._id, { $inc: { applicantCount: 1 } });
        console.log(`+ Created Application: ${candidate.username} ➔ "${job.title}" [${spec.status}]`);
      } else {
        console.log(`~ Application already exists: ${candidate.username} ➔ "${job.title}"`);
      }
    }

    console.log('🎉 Database seeding completed successfully!');
  } catch (err) {
    console.error('❌ Seeding failed with error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

seedDatabase();
