# HireSpec — AI-Powered Recruitment & Interview Platform

> A full-stack intelligent hiring platform built for **IIT Gandhinagar** that automates the entire recruitment pipeline — from job posting and ATS screening to AI-driven interviews, live quizzes, coding contests, and proctored assessments.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Screenshots](#screenshots)
- [License](#license)

---

## Features

### Recruitment & ATS
- **Job Posting** with eligibility criteria (CGPA, skills, experience, education)
- **ATS Scoring Engine** — automatic resume parsing, skill matching, CGPA extraction, and composite scoring (0–100)
- **Project Extraction** from resumes with relevance scoring
- **Auto-Shortlisting** based on configurable ATS score thresholds
- **Bulk Shortlist & Re-score** actions for recruiters
- **Candidate Eligibility Filtering** — required skills, min CGPA, experience range

### AI Interviews
- **AI-Powered Interview Room** with real-time question generation (Groq/Gemini)
- **Practice Interview Mode** for candidates to prepare
- **AI Interview Reports** with detailed feedback and scoring
- **Interview Scheduling** from company dashboard

### Live Quiz System
- **Real-time Quiz Hosting** via WebSocket (Socket.IO)
- **AI-Generated Quiz Questions** on any topic
- **Live Leaderboard** with per-question timers
- **Quiz Results & Analytics**

### Coding Contests
- **Competitive Coding Contests** with real-time code execution
- **Multi-language Support** — JavaScript, Python, C++, Java
- **Monaco Editor** integration with syntax highlighting
- **Contest Leaderboard** and results dashboard
- **AI-Generated Coding Problems**

### Coding Practice
- **Practice Mode** with curated and AI-generated problems
- **Code Execution Engine** with test case validation
- **AI Code Analysis** — suggestions, complexity analysis, optimization tips
- **Session Tracking & Reports**

### Proctoring & Security
- **Face Detection** proctoring via face-api.js + Pinecone
- **Tab Switch & Window Blur Detection**
- **Resume Verification** with AI-powered authenticity checks
- **CSRF Protection, Rate Limiting, Security Headers**

### Dashboards
- **Company Dashboard** — job management, ATS candidate screening, analytics, interview scheduling
- **Candidate Dashboard** — job browsing, application Kanban board, ATS score visibility
- **Recruiter Dashboard** — candidate management workflow
- **Admin Scoring Dashboard**

### Communication
- **Axiom AI Chat** — context-aware AI assistant
- **Spec AI Chat** — platform-specific AI helper
- **Email Notifications** via Nodemailer (OTP, interview scheduling)
- **AI Phone Calling** integration (Twilio)

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| Vite | Build tool & dev server |
| React Router v6 | Client-side routing |
| Monaco Editor | Code editor |
| Socket.IO Client | Real-time communication |
| face-api.js | Face detection proctoring |
| ApexCharts / Recharts | Data visualization |
| Framer Motion | Animations |
| Lucide React | Icon library |
| html2canvas + jsPDF | Report PDF generation |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js + Express | REST API server |
| MongoDB + Mongoose | Primary database |
| Socket.IO | WebSocket server |
| Groq SDK | AI interview & analysis |
| Google GenAI (Gemini) | AI question generation |
| Pinecone | Vector DB for face embeddings |
| Redis | Caching & session management |
| JWT | Authentication |
| Joi | Request validation |
| Nodemailer | Email service |
| Multer | File uploads |
| node-cron | Scheduled tasks |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│         Vite Dev Server / Vercel Deployment          │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────▼──────────────────────────────┐
│                 Backend (Express.js)                  │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────┐ │
│  │  Auth   │ │  Jobs &  │ │ Interview │ │ Quiz & │ │
│  │ Routes  │ │  ATS     │ │  Routes   │ │Contest │ │
│  └────┬────┘ └────┬─────┘ └─────┬─────┘ └───┬────┘ │
│       │           │             │            │      │
│  ┌────▼───────────▼─────────────▼────────────▼────┐ │
│  │              Services Layer                     │ │
│  │  Resume Parser │ AI Interviewer │ Code Executor │ │
│  │  Gemini AI     │ Groq Analyzer  │ Face Service  │ │
│  └────────────────┬───────────────────────────────┘ │
└───────────────────┼─────────────────────────────────┘
                    │
  ┌─────────────────▼──────────────────────────┐
  │            Data Layer                       │
  │  MongoDB │ Redis │ Pinecone │ External APIs │
  └────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **MongoDB** (local or Atlas)
- **Redis** (optional, for caching)
- **npm** or **yarn**

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/IIT-Gandhinagar-Final.git
cd IIT-Gandhinagar-Final
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/hirespec
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
PINECONE_FACE_API_KEY=your_pinecone_key
PINECONE_FACE_INDEX=your_pinecone_index
JWT_SECRET=your_jwt_secret
REDIS_URL=redis://localhost:6379
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

Start the server:

```bash
npm run dev     # development (with nodemon)
npm start       # production
```

Backend runs on `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### 4. Build for Production

```bash
cd frontend
npm run build    # outputs to dist/
npm run preview  # preview production build
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `GROQ_API_KEY` | Yes | Groq API key for AI features |
| `PINECONE_FACE_API_KEY` | Yes | Pinecone API key for face proctoring |
| `PINECONE_FACE_INDEX` | Yes | Pinecone index name |
| `GEMINI_API_KEY` | No | Google Gemini API key |
| `JWT_SECRET` | No | JWT signing secret (has default) |
| `REDIS_URL` | No | Redis connection URL |
| `EMAIL_USER` | No | SMTP email for notifications |
| `EMAIL_PASS` | No | SMTP email password |
| `TWILIO_ACCOUNT_SID` | No | Twilio SID for AI calling |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | No | Twilio phone number |
| `FRONTEND_URL` | No | Frontend URL (default: `http://localhost:5173`) |

---

## Project Structure

```
IIT-Gandhinagar-Final/
├── backend/
│   ├── server.js              # Express app entry point
│   ├── config.js              # Environment config & validation
│   ├── db/
│   │   ├── mongodb.js         # MongoDB connection
│   │   └── database.js        # DB utilities
│   ├── models/
│   │   ├── Job.js             # Job postings with eligibility criteria
│   │   ├── Application.js     # Applications with ATS scoring fields
│   │   ├── User.js            # User accounts (candidate/company/admin)
│   │   ├── AIInterview.js     # AI interview sessions
│   │   ├── Quiz.js            # Quiz data
│   │   ├── CodingContest.js   # Contest data
│   │   ├── PracticeSession.js # Practice sessions
│   │   └── Otp.js             # OTP records
│   ├── routes/
│   │   ├── auth.js            # Authentication (register/login/OTP)
│   │   ├── jobs.js            # Jobs CRUD, ATS scoring, shortlisting
│   │   ├── interview.js       # Interview management
│   │   ├── aiInterview.js     # AI interview sessions
│   │   ├── quiz.js            # Quiz hosting
│   │   ├── contest.js         # Coding contest management
│   │   ├── codingPractice.js  # Coding practice problems
│   │   ├── codeExecution.js   # Code runner
│   │   ├── proctoring.js      # Face proctoring
│   │   ├── profile.js         # User profiles
│   │   ├── scoring.js         # Admin scoring
│   │   ├── verification.js    # Resume verification
│   │   ├── ai.js              # General AI endpoints
│   │   ├── axiomChat.js       # Axiom AI chat
│   │   ├── specAiChat.js      # Spec AI chat
│   │   └── aiCalling.js       # AI phone calling
│   ├── services/
│   │   ├── resumeParser.js    # Resume parsing, skill extraction, ATS scoring
│   │   ├── aiInterviewer.js   # AI interview logic
│   │   ├── geminiAI.js        # Gemini AI integration
│   │   ├── groqAnalyzer.js    # Groq AI analysis
│   │   ├── codeExecutor.js    # Sandboxed code execution
│   │   ├── faceService.js     # Face detection service
│   │   ├── pineconeService.js # Pinecone vector operations
│   │   ├── questionBank.js    # Question management
│   │   ├── cache.js           # Redis caching
│   │   ├── sendEmail.js       # Email service
│   │   └── sessionManager.js  # Session management
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication
│   │   ├── rateLimit.js       # Rate limiting
│   │   ├── validation.js      # Request validation (Joi)
│   │   ├── securityHeaders.js # Security headers
│   │   ├── csrf.js            # CSRF protection
│   │   ├── fileValidation.js  # File upload validation
│   │   ├── timeout.js         # Request timeouts
│   │   └── logger.js          # Request logging
│   ├── socket/
│   │   ├── handlers.js        # Interview WebSocket handlers
│   │   ├── quizHandlers.js    # Quiz WebSocket handlers
│   │   └── contestHandlers.js # Contest WebSocket handlers
│   └── scheduler/
│       └── otpCleanup.js      # Cron job for OTP cleanup
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── vercel.json            # Vercel SPA config
│   └── src/
│       ├── App.jsx            # Router & route definitions
│       ├── main.jsx           # React entry point
│       ├── components/
│       │   ├── Navbar.jsx     # Navigation bar
│       │   ├── ChatPanel.jsx  # AI chat panel
│       │   ├── CodeEditor.jsx # Monaco editor wrapper
│       │   ├── ProctoringMonitor.jsx # Proctoring overlay
│       │   └── ErrorBoundary.jsx
│       ├── pages/
│       │   ├── Home.jsx               # Landing page
│       │   ├── Login.jsx              # Login
│       │   ├── Register.jsx           # Registration
│       │   ├── CompanyDashboard.jsx   # Company ATS & management
│       │   ├── CandidateDashboard.jsx # Candidate job tracking
│       │   ├── CandidateProfile.jsx   # Profile management
│       │   ├── AIInterviewRoom.jsx    # AI interview interface
│       │   ├── AIInterviewSetup.jsx   # Interview setup
│       │   ├── AIInterviewReport.jsx  # Interview results
│       │   ├── InterviewRoom.jsx      # Live interview
│       │   ├── QuizHost.jsx           # Quiz hosting
│       │   ├── QuizPlay.jsx           # Quiz participation
│       │   ├── QuizResults.jsx        # Quiz results
│       │   ├── ContestHost.jsx        # Contest hosting
│       │   ├── ContestPlay.jsx        # Contest participation
│       │   ├── ContestResults.jsx     # Contest results
│       │   ├── CodingPractice.jsx     # Practice coding
│       │   ├── PracticeMode.jsx       # Practice interviews
│       │   ├── ProctorDashboard.jsx   # Proctoring dashboard
│       │   ├── ResumeVerification.jsx # Resume checks
│       │   ├── AdminScoring.jsx       # Admin scoring panel
│       │   └── CandidateAnalytics.jsx # Candidate analytics
│       └── services/
│           └── api.js                 # Axios API client
│
└── README.md
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/send-otp` | Send email OTP |
| POST | `/api/auth/verify-otp` | Verify OTP |
| POST | `/api/auth/forgot-password` | Password reset |

### Jobs & ATS
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs/browse` | Browse all active jobs |
| POST | `/api/jobs` | Create job with eligibility criteria |
| PUT | `/api/jobs/:jobId` | Update job |
| POST | `/api/jobs/:jobId/apply` | Apply (triggers ATS scoring) |
| GET | `/api/jobs/:jobId/applicants` | Get applicants with ATS data |
| POST | `/api/jobs/:jobId/shortlist` | Bulk shortlist by ATS threshold |
| POST | `/api/jobs/:jobId/rescore` | Re-score all applicants |

### Interviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai-interview/start` | Start AI interview |
| POST | `/api/ai-interview/respond` | Submit answer |
| POST | `/api/ai-interview/end` | End & generate report |
| POST | `/api/interview/schedule` | Schedule interview |

### Quiz
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/quiz/create` | Create quiz |
| POST | `/api/quiz/generate-questions` | AI generate questions |
| GET | `/api/quiz/:quizId` | Get quiz details |

### Coding
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/code/execute` | Execute code |
| GET | `/api/coding-practice/problems` | Get practice problems |
| POST | `/api/contest/create` | Create coding contest |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile/me` | Get user profile |
| PUT | `/api/profile/update` | Update profile |
| POST | `/api/profile/resume` | Upload resume |

---

## ATS Scoring Algorithm

The ATS engine evaluates candidates against job criteria with a weighted composite score:

| Component | Weight | Description |
|-----------|--------|-------------|
| Skill Match | 40% | Matched skills ÷ total job skills |
| Required Skills | 25% | Coverage of must-have skills |
| Resume Quality | 15% | Section completeness, length, formatting |
| CGPA | 10% | Normalized CGPA vs minimum threshold |
| Experience | 10% | Years of experience match |

**Eligibility Checks:**
- Minimum CGPA threshold
- Required skills coverage (≥50% of must-have skills)
- Experience range validation

Candidates failing eligibility are auto-marked as `not_eligible`.

---

## Deployment

### Frontend (Vercel)
The frontend is configured for Vercel with SPA rewrites in `vercel.json`.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel --prod
```

### Backend
Deploy the backend to any Node.js hosting (Railway, Render, AWS, etc.):

```bash
cd backend
npm start
```

Ensure all environment variables are set in your hosting provider's dashboard.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes (`git commit -m 'Add my feature'`)
4. Push to branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

This project was developed for **IIT Gandhinagar**. All rights reserved.
