# EDU AI — System Documentation

**Version:** 2.0  
**Date:** 2026-06-06  
**Platform:** AI-Powered Interview & Hiring Platform  
**Institution:** LNCT Bhopal

---

## Table of Contents

1. [Software Requirements Specification (SRS)](#1-software-requirements-specification)
2. [System Architecture Diagram](#2-system-architecture-diagram)
3. [Technical Component Diagram](#3-technical-component-diagram)
4. [Network & Infrastructure Diagram](#4-network--infrastructure-diagram)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
6. [Process Flowcharts](#6-process-flowcharts)
7. [AI Avatar Interview — Feature Spec](#7-ai-avatar-interview--feature-spec)
8. [Upcoming Features](#8-upcoming-features)
9. [Data Models (ER Diagram)](#9-data-models--er-diagram)
10. [API Surface Summary](#10-api-surface-summary)

---

## 1. Software Requirements Specification

### 1.1 Introduction

#### 1.1.1 Purpose
This document specifies the functional and non-functional requirements for EDU AI, an AI-powered recruitment and interview platform. It covers the current implemented system, features under active development, and planned future capabilities.

#### 1.1.2 Scope
EDU-AI is a multi-role web platform designed for:
- **Educational institutions** to conduct proctored assessments, quizzes, and coding contests
- **Companies** to post jobs, screen candidates via ATS, and run AI-powered interviews
- **Candidates** to practice coding, attend AI interviews, and track applications
- **Recruiters & Admins** to manage hiring pipelines and platform governance

#### 1.1.3 Definitions

| Term | Definition |
|------|-----------|
| ATS | Applicant Tracking System — automated resume scoring engine |
| Proctoring | Real-time monitoring of interview/exam integrity via face detection |
| AI Avatar | AI-generated animated interviewer persona conducting video interviews |
| LangGraph | Stateful AI workflow orchestration library used in Resume Verifier v2 |
| Trust Score | Composite confidence score (0–100) computed by Resume Verifier v2 |
| OTP | One-Time Password used for email verification |
| CSRF | Cross-Site Request Forgery protection token |

#### 1.1.4 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         EDU-AI Platform                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Candidate  │  │   Company /  │  │   Admin / Proctor /  │  │
│  │   Portal     │  │   Recruiter  │  │   Scoring Panel      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                  │                     │               │
│  ┌──────▼──────────────────▼─────────────────────▼───────────┐  │
│  │              Main Backend API (Node.js + Express)          │  │
│  └────────────────────────────────────────────────────────────┘  │
│         │                  │                     │               │
│  ┌──────▼──────┐  ┌────────▼──────┐  ┌──────────▼──────────┐  │
│  │  MongoDB    │  │ Resume        │  │  Whiteboard          │  │
│  │  Redis      │  │ Verifier v2   │  │  (Coming Soon)       │  │
│  │  Pinecone   │  │ (FastAPI)     │  │                      │  │
│  └─────────────┘  └───────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 1.2 Functional Requirements

#### FR-01: Authentication & Identity
| ID | Requirement | Status |
|----|-------------|--------|
| FR-01.1 | System shall support OTP-based email registration | ✅ Implemented |
| FR-01.2 | System shall support password login with PBKDF2 (100k iterations) | ✅ Implemented |
| FR-01.3 | System shall support face recognition login via vector search | ✅ Implemented |
| FR-01.4 | System shall issue JWT tokens as HTTP-only cookies (7-day expiry) | ✅ Implemented |
| FR-01.5 | System shall enforce role-based access control (6 roles) | ✅ Implemented |
| FR-01.6 | System shall provide forgot-password and reset-password flows | ✅ Implemented |

#### FR-02: Job & ATS Management
| ID | Requirement | Status |
|----|-------------|--------|
| FR-02.1 | Companies shall be able to create jobs with ATS eligibility criteria | ✅ Implemented |
| FR-02.2 | System shall auto-score resumes against job criteria (5-component ATS) | ✅ Implemented |
| FR-02.3 | System shall support bulk shortlisting by ATS threshold | ✅ Implemented |
| FR-02.4 | System shall track application status through 9-stage pipeline | ✅ Implemented |

#### FR-03: AI Interview
| ID | Requirement | Status |
|----|-------------|--------|
| FR-03.1 | System shall generate role-specific interview questions via Groq AI | ✅ Implemented |
| FR-03.2 | System shall evaluate and score candidate answers in real-time | ✅ Implemented |
| FR-03.3 | System shall generate post-interview reports with feedback | ✅ Implemented |
| FR-03.4 | System shall provide AI Avatar interviewer persona | 🔄 In Progress |
| FR-03.5 | System shall support practice interview mode | ✅ Implemented |

#### FR-04: Proctoring
| ID | Requirement | Status |
|----|-------------|--------|
| FR-04.1 | System shall detect and log tab switches during interviews | ✅ Implemented |
| FR-04.2 | System shall detect multiple faces via face-api.js | ✅ Implemented |
| FR-04.3 | System shall calculate integrity score with diminishing-returns algorithm | ✅ Implemented |
| FR-04.4 | System shall persist proctoring events per interview session | ✅ Implemented |

#### FR-05: Coding Platform
| ID | Requirement | Status |
|----|-------------|--------|
| FR-05.1 | System shall execute code in JavaScript, Python, C++, Java | ✅ Implemented |
| FR-05.2 | System shall host real-time coding contests via WebSocket | ✅ Implemented |
| FR-05.3 | System shall generate AI hints and code analysis | ✅ Implemented |
| FR-05.4 | System shall host real-time AI-generated quizzes | ✅ Implemented |

#### FR-06: Resume Verification (Microservice)
| ID | Requirement | Status |
|----|-------------|--------|
| FR-06.1 | Service shall parse GitHub repositories to verify resume claims | ✅ Implemented |
| FR-06.2 | Service shall perform AST-level code analysis via Tree-sitter | ✅ Implemented |
| FR-06.3 | Service shall compute weighted trust score (0–100) | ✅ Implemented |
| FR-06.4 | Service shall generate detailed verification reports | ✅ Implemented |
| FR-06.5 | Frontend integration with main platform | ⬜ Not Integrated |

#### FR-07: AI Doubt Solver with Live Whiteboard
| ID | Requirement | Status |
|----|-------------|--------|
| FR-07.1 | System shall accept a student's natural-language question and stream a live concept map | ✅ Built (standalone) |
| FR-07.2 | LLM shall generate hierarchical concept maps with min 20 nodes and 4 depth levels | ✅ Built (standalone) |
| FR-07.3 | System shall stream draw commands (node/arrow/equation/code) via SSE in real-time | ✅ Built (standalone) |
| FR-07.4 | Student shall be able to export the concept map as a PNG | ✅ Built (standalone) |
| FR-07.5 | Whiteboard app shall be integrated into the main EDU AI platform dashboard | ⬜ Not Integrated |

---

### 1.3 Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | API response time < 200ms for non-AI endpoints (p95) |
| **Performance** | AI endpoints (Groq/Gemini) timeout after 60 seconds |
| **Security** | All endpoints behind CSRF, rate limiting, and security headers |
| **Security** | File uploads validated by type and size (10 MB max) |
| **Availability** | System degrades gracefully when Redis is offline |
| **Scalability** | Stateless backend — horizontally scalable behind load balancer |
| **Observability** | Winston logging to files + console; Sentry integration available |
| **Compatibility** | Frontend supports modern browsers (Chrome 90+, Firefox 90+, Safari 14+) |
| **Accessibility** | WCAG 2.1 AA compliance target for all public-facing pages |

---

### 1.4 Roles & Permissions

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| `candidate` | Job seeker / student | Apply to jobs, take AI interviews, coding practice, view own analytics |
| `company_admin` | Company account owner | Create jobs, view all applicants, manage company profile |
| `company_hr` | HR staff | View applicants, update application status, schedule interviews |
| `recruiter` | External recruiter | View assigned candidates, move pipeline stages |
| `proctor` | Exam supervisor | View proctoring dashboard, flag incidents |
| `admin` | Platform administrator | Full access, manage all users, global AI config, audit logs |

---

## 2. System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        CF[React Frontend<br/>Vite / React 18<br/>:5173]
        RF[Recruiter Frontend<br/>React App<br/>:5174]
    end

    subgraph "API Gateway Layer"
        NG[NGINX / Reverse Proxy<br/>SSL Termination<br/>:443 / :80]
    end

    subgraph "Application Layer"
        BE[Main Backend<br/>Node.js + Express<br/>:5000]
        WS[Socket.IO Server<br/>WebSocket Hub]
        RV[Resume Verifier v2<br/>FastAPI + LangGraph<br/>:8000]
        CW[Celery Workers<br/>Async Task Queue<br/>×4 concurrency]
        WBB[AI Doubt Solver Backend<br/>FastAPI + Groq SSE<br/>:5000 standalone]
        WBF[AI Doubt Solver Frontend<br/>React + SVG Canvas<br/>:5173 standalone]
    end

    subgraph "Data Layer"
        MG[(MongoDB<br/>Primary DB<br/>:27017)]
        RD[(Redis<br/>Cache + Sessions<br/>:6379)]
        PI[(Pinecone<br/>Vector DB<br/>Face Embeddings)]
        PG[(PostgreSQL<br/>Resume Verifier DB<br/>:5432)]
    end

    subgraph "External AI Services"
        GR[Groq AI<br/>llama-3.3-70b<br/>Interview + Code]
        GM[Gemini AI<br/>2.5 Pro / Flash<br/>Resume + Questions]
        SC[Secondary Camera<br/>Python FastAPI<br/>AI Calling :8001]
    end

    subgraph "External Platform Services"
        CL[Cloudinary<br/>File Storage<br/>Resume / Avatars]
        TW[Twilio<br/>AI Phone Calls]
        SM[SMTP<br/>Email / OTP<br/>Nodemailer]
        SN[Sentry<br/>Error Monitoring]
    end

    CF -->|HTTPS| NG
    RF -->|HTTPS| NG
    NG -->|HTTP| BE
    NG -->|WS| WS
    NG -->|HTTP| RV
    NG -->|HTTP SSE| WBB
    WBF -->|HTTP SSE| NG

    BE <-->|Mongoose ODM| MG
    BE <-->|ioredis| RD
    BE <-->|REST API| PI
    BE -->|POST /api/v1/analyze| RV
    BE -->|SDK| GR
    BE -->|SDK| GM
    BE -->|REST| CL
    BE -->|REST| TW
    BE -->|SMTP| SM
    BE -->|SDK| SN

    RV -->|SQLAlchemy| PG
    RV -->|Celery Broker| RD
    RD -->|Task Queue| CW
    CW -->|SDK| GM
    CW -->|Results| PG

    WS <-->|Events| BE
    WBB <-->|WS Events| WBF

    style CF fill:#4f9eff,color:#fff
    style RF fill:#4f9eff,color:#fff
    style BE fill:#22c55e,color:#fff
    style RV fill:#f97316,color:#fff
    style WBB fill:#a855f7,color:#fff,stroke-dasharray: 5 5
    style WBF fill:#a855f7,color:#fff,stroke-dasharray: 5 5
    style MG fill:#16a34a,color:#fff
    style RD fill:#dc2626,color:#fff
    style PI fill:#0ea5e9,color:#fff
    style PG fill:#1d4ed8,color:#fff
```

---

## 3. Technical Component Diagram

```mermaid
flowchart LR
    subgraph FE["Frontend Pages"]
        AUTH_UI["Auth\nLogin / Register / OTP"]
        DASH_UI["Dashboards\nCandidate / Company / Admin"]
        INTV_UI["Interview Suite\nAI Room / Practice / Live"]
        CODE_UI["Coding Suite\nPractice / Contest / Monaco"]
        QUIZ_UI["Quiz Suite\nHost / Play / Results"]
        PROC_UI["Proctoring\nMonitor / Secondary Cam"]
        CHAT_UI["AI Assistants\nAxiom / SpecAI"]
        ANLYT_UI["Analytics\nCandidate / Interview Report"]
        RESV_UI["Resume Verifier\n(Needs Integration)"]
        WB_UI["AI Doubt Solver\n(Integration Pending)"]
    end

    subgraph RT["Backend Routes"]
        AUTH_RT["/api/auth\nOTP / JWT / Face"]
        JOBS_RT["/api/jobs\nCRUD / ATS / Shortlist"]
        INTV_RT["/api/ai-interview\nSession / Evaluate / Report"]
        PROC_RT["/api/proctoring\nEvents / Score / Face"]
        CODE_RT["/api/cp\nExecute / Analyze / Report"]
        CONT_RT["/api/contest\nCreate / Realtime / Score"]
        QUIZ_RT["/api/quiz\nGenerate / Host / Results"]
        CHAT_RT["/api/axiom + spec-ai\nMulti-turn AI Chat"]
        VERIF_RT["/api/verification\nLayer 1-3 Pipeline"]
        ADMIN_RT["/api/admin\nStats / Audit / Config"]
        PROF_RT["/api/profile\nResume Upload / ATS"]
    end

    subgraph SVC["Service Layer"]
        AI_SVC["aiInterviewer.js\nGroq Interview Logic"]
        RSME_SVC["resumeParser.js\nPDF Parse + ATS"]
        FACE_SVC["faceService + pinecone\nEmbedding + Search"]
        CODE_SVC["codeExecutor.js\nSandboxed Runner"]
        GROQ_SVC["groqAnalyzer.js\nGroq SDK"]
        GEM_SVC["geminiAI.js\nGemini SDK"]
        CACHE_SVC["cache.js\nRedis Wrapper"]
        EMAIL_SVC["sendEmail.js\nNodemailer"]
        AUDIT_SVC["auditLog.js\nAudit Trail"]
    end

    subgraph SOCK["Socket.IO"]
        INTV_SOCK["handlers.js\nInterview Realtime"]
        QUIZ_SOCK["quizHandlers.js\nLive Quiz"]
        CONT_SOCK["contestHandlers.js\nLeaderboard"]
    end

    subgraph MW["Middleware"]
        MW1["JWT Auth"]
        MW2["CSRF"]
        MW3["Rate Limit"]
        MW4["Joi Validation"]
        MW5["Security Headers"]
        MW6["Timeout + Logger"]
    end

    AUTH_UI --> AUTH_RT
    DASH_UI --> JOBS_RT
    INTV_UI --> INTV_RT
    CODE_UI --> CODE_RT
    QUIZ_UI --> QUIZ_RT
    PROC_UI --> PROC_RT
    CHAT_UI --> CHAT_RT
    ANLYT_UI --> INTV_RT
    RESV_UI -.->|not wired yet| VERIF_RT
    WB_UI -.->|not implemented| CONT_RT

    AUTH_RT --> AI_SVC
    INTV_RT --> AI_SVC
    INTV_RT --> GROQ_SVC
    JOBS_RT --> RSME_SVC
    PROF_RT --> RSME_SVC
    AUTH_RT --> FACE_SVC
    PROC_RT --> FACE_SVC
    CODE_RT --> CODE_SVC
    CODE_RT --> GROQ_SVC
    CHAT_RT --> GROQ_SVC
    CHAT_RT --> GEM_SVC
    VERIF_RT --> RSME_SVC
    AUTH_RT --> EMAIL_SVC
    ADMIN_RT --> AUDIT_SVC
    JOBS_RT --> CACHE_SVC

    INTV_RT --> INTV_SOCK
    QUIZ_RT --> QUIZ_SOCK
    CONT_RT --> CONT_SOCK

    MW1 --> AUTH_RT
    MW2 --> PROF_RT
    MW3 --> AUTH_RT
    MW4 --> JOBS_RT
    MW5 --> AUTH_RT
    MW6 --> AUTH_RT
```

---

## 4. Network & Infrastructure Diagram

```mermaid
graph TB
    subgraph "Internet / Public Zone"
        USR[End User Browser<br/>Chrome / Firefox / Safari]
        MOB[Mobile Browser]
    end

    subgraph "CDN / Edge"
        VCL[Vercel CDN<br/>Frontend Delivery<br/>vercel.app]
    end

    subgraph "Load Balancer Zone"
        LB[NGINX Reverse Proxy<br/>:443 HTTPS / :80 HTTP<br/>SSL Termination<br/>Rate Limiting]
    end

    subgraph "Application Servers [DMZ]"
        BE_1[Node.js Backend<br/>app server :5000<br/>Express + Socket.IO]
        RV_1[Resume Verifier<br/>FastAPI :8000<br/>Python 3.12]
        CW_1[Celery Worker 1<br/>Async Analysis]
        CW_2[Celery Worker 2<br/>Async Analysis]
        WBB_1[AI Doubt Solver Backend<br/>FastAPI + Groq :5000<br/>standalone service]
    end

    subgraph "Data Servers [Private Zone]"
        MDB[MongoDB Atlas<br/>or local :27017<br/>Primary + Replica]
        RDS[Redis Server<br/>:6379<br/>Cache + Celery Broker]
        PGS[PostgreSQL<br/>:5432<br/>Resume Verifier DB]
    end

    subgraph "External SaaS [HTTPS]"
        direction LR
        PCN[Pinecone Cloud<br/>Vector DB<br/>api.pinecone.io]
        CDY[Cloudinary Cloud<br/>File CDN<br/>api.cloudinary.com]
        GRQ[Groq Cloud<br/>LLM API<br/>api.groq.com]
        GMN[Google Gemini<br/>LLM API<br/>generativelanguage.googleapis.com]
        TWL[Twilio Cloud<br/>Voice API<br/>api.twilio.com]
        SEN[Sentry Cloud<br/>Error Reporting<br/>sentry.io]
        SMTP[SMTP Relay<br/>Gmail / Custom<br/>:587 TLS]
    end

    subgraph "Firewall Rules"
        FW1[Public: 443, 80 open]
        FW2[App → DB: 27017, 6379, 5432 allowed]
        FW3[App → SaaS: 443 outbound allowed]
        FW4[DB: no public ingress]
    end

    USR -->|HTTPS :443| VCL
    MOB -->|HTTPS :443| VCL
    VCL -->|API Calls + WS| LB
    LB -->|HTTP :5000| BE_1
    LB -->|HTTP :8000| RV_1
    LB -->|HTTP SSE :5000| WBB_1

    BE_1 -->|MongoDB Driver :27017| MDB
    BE_1 -->|ioredis :6379| RDS
    BE_1 -->|HTTPS| PCN
    BE_1 -->|HTTPS| CDY
    BE_1 -->|HTTPS| GRQ
    BE_1 -->|HTTPS| GMN
    BE_1 -->|HTTPS| TWL
    BE_1 -->|HTTPS| SEN
    BE_1 -->|STARTTLS :587| SMTP
    BE_1 -->|HTTP :8000| RV_1

    RV_1 -->|SQLAlchemy :5432| PGS
    RV_1 -->|Celery Broker :6379| RDS
    RDS -->|Task Dispatch| CW_1
    RDS -->|Task Dispatch| CW_2
    CW_1 -->|HTTPS| GMN
    CW_2 -->|HTTPS| GMN
    CW_1 -->|SQLAlchemy :5432| PGS
    CW_2 -->|SQLAlchemy :5432| PGS

    style BE_1 fill:#22c55e,color:#fff
    style RV_1 fill:#f97316,color:#fff
    style WBB_1 fill:#a855f7,color:#fff,stroke-dasharray: 5 5
    style MDB fill:#16a34a,color:#fff
    style RDS fill:#dc2626,color:#fff
    style PGS fill:#1d4ed8,color:#fff
    style GRQ fill:#8b5cf6,color:#fff
    style GMN fill:#0ea5e9,color:#fff
```

---

## 5. Data Flow Diagrams

### 5.1 Authentication Data Flow

```mermaid
sequenceDiagram
    actor C as Candidate
    participant FE as Frontend
    participant BE as Backend
    participant DB as MongoDB
    participant PC as Pinecone
    participant EM as Email SMTP

    C->>FE: Enter email + password
    FE->>BE: POST /api/auth/register
    BE->>BE: Validate input (Joi)
    BE->>DB: Check email uniqueness
    BE->>DB: PBKDF2 hash password
    BE->>DB: Save User (unverified)
    BE->>EM: Send OTP email
    BE-->>FE: 201 Created — verify OTP
    FE->>C: Show OTP input
    C->>FE: Enter OTP
    FE->>BE: POST /api/auth/verify-otp
    BE->>DB: Find OTP record (expiry check)
    BE->>DB: Mark user verified
    BE->>DB: Delete OTP record
    BE-->>FE: Set JWT cookie (HTTP-only, 7d)
    FE-->>C: Redirect to dashboard

    Note over C,FE: Face Login Alternative
    C->>FE: Enable camera
    FE->>FE: face-api.js extract 128-dim descriptor
    FE->>BE: POST /api/auth/face-login {descriptor}
    BE->>PC: Query nearest face vector
    PC-->>BE: userId + distance score
    BE->>DB: Load user by userId
    BE-->>FE: Set JWT cookie
    FE-->>C: Logged in
```

### 5.2 ATS Scoring Data Flow

```mermaid
sequenceDiagram
    actor C as Candidate
    participant FE as Frontend
    participant BE as Backend
    participant RS as ResumeParser Service
    participant DB as MongoDB

    C->>FE: Apply to Job
    FE->>BE: POST /api/jobs/:jobId/apply
    BE->>DB: Load Job (eligibility criteria)
    BE->>DB: Load User profile + resume text
    BE->>RS: scoreResume(resumeText, jobCriteria)

    rect rgb(240,248,255)
        Note over RS: ATS Scoring Engine
        RS->>RS: Extract skills from resume
        RS->>RS: Skill Match Score (40%)
        RS->>RS: Required Skills Coverage (25%)
        RS->>RS: Resume Quality Score (15%)
        RS->>RS: CGPA Normalization (10%)
        RS->>RS: Experience Match (10%)
        RS->>RS: Eligibility Gate Check
        RS-->>BE: {atsScore, isEligible, breakdown}
    end

    BE->>DB: Save Application {atsScore, status}
    alt isEligible == false
        BE->>DB: Set status = not_eligible
        BE-->>FE: 200 Applied (not eligible)
    else Auto-shortlist enabled AND score >= threshold
        BE->>DB: Set status = shortlisted
        BE-->>FE: 200 Applied (auto-shortlisted)
    else
        BE->>DB: Set status = applied
        BE-->>FE: 200 Applied
    end
    FE-->>C: Show application status
```

### 5.3 Resume Verification Data Flow

```mermaid
sequenceDiagram
    participant BE as Node.js Backend
    participant RV as Resume Verifier v2<br/>(FastAPI :8000)
    participant CQ as Celery Queue
    participant LG as LangGraph Workflow
    participant GH as GitHub API
    participant GM as Gemini AI
    participant PG as PostgreSQL

    BE->>RV: POST /api/v1/analyze<br/>{candidateId, githubUrl, resumeText}
    RV->>PG: Create analysis record (status=queued)
    RV->>CQ: Queue analysis task
    RV-->>BE: 202 {analysisId, status=queued}

    CQ->>LG: Start LangGraph workflow

    rect rgb(255,248,240)
        Note over LG: LangGraph 8-Node Pipeline
        LG->>GM: [1] extract_claims (Flash)<br/>Parse resume → structured claims
        LG->>GH: [2] download_repo<br/>Download ZIP archive
        LG->>LG: [3] scan_repo<br/>Detect languages, frameworks
        LG->>LG: [4] ast_analysis (Tree-sitter)<br/>Extract code structure
        LG->>GM: [5] verify_claims (Flash)<br/>Evidence search per claim
        LG->>GM: [6] authenticity (Pro)<br/>Deep architectural analysis
        LG->>LG: [7] score<br/>Weighted trust computation
        LG->>LG: [8] generate_report<br/>Assemble final report
    end

    LG->>PG: Save report + scores
    BE->>RV: GET /api/v1/analyze/{analysisId}
    RV-->>BE: {status, trustScore, riskLevel}
    BE->>RV: GET /api/v1/report/{analysisId}
    RV-->>BE: Full verification report
```

### 5.4 LangGraph StateGraph — Resume Verifier v2

```mermaid
flowchart TD
    START([__start__]) --> N1

    N1["Node 1 — extract_claims\nGemini 2.5 Flash\nresume_text → claims list\nFallback: regex keyword match"]

    N2["Node 2 — download_repo\nhttpx async\ngithub_url → repo_path, temp_dir\nFallback: repo_path = None"]

    N3["Node 3 — scan_repo\nFile tree walk\nrepo_path → repo_metadata\nLanguages, frameworks, hasTests, hasCi"]

    N4["Node 4 — ast_analysis\nTree-sitter multi-lang\nrepo_path → ast_data\nFunctions, classes, services, controllers"]

    N5["Node 5 — verify_claims\nGemini 2.5 Flash\nclaims + ast_data → verification_results\nPer-claim: verified, confidence, evidence"]

    N6["Node 6 — authenticity\nGemini 2.5 Pro\n12 sampled files + README + deps\n→ authenticityScore, riskLevel, reasoning\nFallback: heuristic formula"]

    N7["Node 7 — score\nScoringEngine.compute\nAll sub-scores → trust_score 0-100\nFeatureVerify 35% + Arch 20% + Code 15% + Sec 15% + Auth 15%"]

    N8["Node 8 — generate_report\nAssemble final JSON\nSave to PostgreSQL\n→ report dict with all evidence"]

    END_([__end__])

    N1 --> N2
    N2 --> COND{repo_path\nexists?}
    COND -->|Yes — happy path| N3
    COND -->|No — download failed\nskip scan + AST| N6
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> END_

    style N1 fill:#0ea5e9,color:#fff
    style N2 fill:#22c55e,color:#fff
    style N3 fill:#22c55e,color:#fff
    style N4 fill:#22c55e,color:#fff
    style N5 fill:#0ea5e9,color:#fff
    style N6 fill:#f97316,color:#fff
    style N7 fill:#8b5cf6,color:#fff
    style N8 fill:#8b5cf6,color:#fff
    style COND fill:#ef4444,color:#fff
    style START fill:#16a34a,color:#fff
    style END_ fill:#16a34a,color:#fff
```

---

## 6. Process Flowcharts

### 6.1 AI Interview Flow

```mermaid
flowchart TD
    A([Candidate opens AI Interview]) --> B[Select Role + Difficulty]
    B --> C[POST /api/ai-interview/start]
    C --> D{Session created?}
    D -- No --> E[Show error]
    D -- Yes --> F[Display greeting + first question]
    F --> G[Candidate records/types answer]
    G --> H[POST /api/ai-interview/respond]
    H --> I[Groq evaluates answer]
    I --> J[Score stored in AIInterview model]
    J --> K{More questions?}
    K -- Yes --> L[Next question generated]
    L --> G
    K -- No --> M[POST /api/ai-interview/end]
    M --> N[Generate full interview report]
    N --> O[Store in AIInterview.report]
    O --> P[Redirect to AIInterviewReport page]
    P --> Q([Show scores + feedback + PDF download])

    subgraph "Proctoring [Parallel]"
        P1[Tab switch detection]
        P2[Face detection every 5s]
        P3[Copy/paste detection]
        P4[POST /api/proctoring/event]
        P5[Integrity score updated]
        P1 --> P4
        P2 --> P4
        P3 --> P4
        P4 --> P5
    end

    G -.->|Browser events| P1
    G -.->|Camera feed| P2
    G -.->|Clipboard API| P3
```

### 6.2 Coding Contest Flow

```mermaid
flowchart TD
    A([Host opens Contest Dashboard]) --> B[POST /api/contest/create]
    B --> C[AI generates problems via Groq]
    C --> D[6-char contest code issued]
    D --> E[Share code with participants]

    F([Participant enters code]) --> G[WebSocket: join-contest]
    G --> H{Code valid?}
    H -- No --> I[Show error]
    H -- Yes --> J[Participant joins room]

    E --> J
    J --> K[View problem statement]
    K --> L[Write code in Monaco Editor]
    L --> M[Submit solution]
    M --> N[POST /api/cp/code/submit]
    N --> O[codeExecutor runs test cases]
    O --> P{All tests pass?}
    P -- No --> Q[Show failed test results]
    Q --> L
    P -- Yes --> R[Score calculated]
    R --> S[WebSocket: score-update broadcast]
    S --> T[Live leaderboard updates]
    T --> U{Contest ended?}
    U -- No --> K
    U -- Yes --> V([Final results + rankings])
```

### 6.3 Application Pipeline Flow

```mermaid
flowchart LR
    A[applied] --> B{ATS Eligible?}
    B -- No --> Z[not_eligible]
    B -- Yes + Auto-shortlist --> C[shortlisted]
    B -- Yes --> D[screening]
    D --> C
    C --> E[interview]
    E --> F{Decision}
    F --> G[selected]
    F --> Z2[rejected]
    G --> H[offered]
    H --> I{Candidate accepts?}
    I -- Yes --> J[hired]
    I -- No --> Z2

    style Z fill:#ef4444,color:#fff
    style Z2 fill:#ef4444,color:#fff
    style J fill:#22c55e,color:#fff
    style C fill:#3b82f6,color:#fff
    style G fill:#8b5cf6,color:#fff
```

### 6.4 Live Quiz Flow

```mermaid
flowchart TD
    H([Host creates quiz]) --> A[POST /api/quiz/create]
    A --> B[AI generates questions via Groq]
    B --> C[6-char join code issued]
    C --> D[WebSocket: quiz-room-created]

    P([Participant opens QuizJoin]) --> E[Enter join code]
    E --> F[WebSocket: join-quiz]
    F --> G{Room valid + open?}
    G -- No --> H2[Show error]
    G -- Yes --> I[Wait in lobby]

    D --> J[Host starts quiz]
    J --> K[WebSocket: quiz-start broadcast]
    K --> L[Question + timer shown]
    L --> M[Participant answers]
    M --> N[WebSocket: submit-answer]
    N --> O[Score calculated server-side]
    O --> P2[WebSocket: score-update + leaderboard]
    P2 --> Q{Next question?}
    Q -- Yes --> L
    Q -- No --> R([Quiz Results + Final Leaderboard])
```

---

## 7. AI Avatar Interview — Feature Spec

### 7.1 Overview

The AI Avatar Interview feature replaces the static text-chat interface with an animated AI interviewer persona. The avatar speaks questions aloud, listens to spoken candidate responses, and provides a human-like interview experience.

### 7.2 Feature Architecture

```mermaid
graph TB
    subgraph "Candidate Browser"
        CAM[Webcam Feed]
        MIC[Microphone Input]
        AV[Avatar Renderer<br/>Three.js / ReadyPlayerMe]
        TTS_CLIENT[Browser TTS<br/>Web Speech API]
        STT_CLIENT[Browser STT<br/>Web Speech API]
        CANVAS[Proctoring Canvas<br/>face-api.js overlay]
    end

    subgraph "AI Avatar Pipeline"
        direction LR
        STT[Speech-to-Text<br/>Whisper / Web Speech API]
        LLM[Groq LLM<br/>Question + Evaluation]
        TTS[Text-to-Speech<br/>ElevenLabs / Browser TTS]
        LIP[Lip Sync Engine<br/>Viseme generation]
        ANIM[Avatar Animation<br/>Expression + Gesture]
    end

    subgraph "Backend"
        INTV[AI Interview Route<br/>/api/ai-interview]
        PROC[Proctoring Route<br/>/api/proctoring]
        WS_INTV[Socket.IO<br/>Interview Handler]
    end

    MIC --> STT_CLIENT
    STT_CLIENT -->|transcript| INTV
    INTV --> LLM
    LLM -->|question text| TTS_CLIENT
    TTS_CLIENT -->|audio| AV
    LLM -->|lip-sync data| LIP
    LIP --> AV
    LLM -->|emotion cue| ANIM
    ANIM --> AV

    CAM --> CANVAS
    CANVAS --> PROC
    WS_INTV <--> INTV
    WS_INTV <--> CAM

    style AV fill:#8b5cf6,color:#fff
    style LLM fill:#22c55e,color:#fff
    style TTS fill:#f97316,color:#fff
```

### 7.3 Avatar Interview Screen Layout

```
┌─────────────────────────────────────────────────────────────┐
│  EDU AI AI Interview         [● REC]  [Integrity: 94%]   │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│   AI AVATAR (3D/2D)      │   CANDIDATE VIDEO FEED           │
│   ┌──────────────────┐   │   ┌──────────────────────────┐  │
│   │                  │   │   │                          │  │
│   │   [Avatar Face]  │   │   │   [Webcam Stream]        │  │
│   │   Speaking...    │   │   │   Face Detection Active  │  │
│   │   🟢 Lip-sync    │   │   │                          │  │
│   └──────────────────┘   │   └──────────────────────────┘  │
│                          │                                  │
├──────────────────────────┴──────────────────────────────────┤
│  Q3 / 8 ──────────────────────────── 01:23 remaining       │
│                                                              │
│  "Explain the difference between REST and GraphQL APIs."    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [🎙 Speaking... (auto-detect)]    [Skip]   [End Interview] │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 Implementation Plan

| Step | Task | Tech |
|------|------|------|
| 1 | Integrate Web Speech API for STT | Browser native / Whisper API |
| 2 | Pipe transcript to `/api/ai-interview/respond` | Existing endpoint |
| 3 | Receive AI question text + evaluate response | Groq LLM (existing) |
| 4 | Text-to-Speech output | Browser SpeechSynthesis / ElevenLabs |
| 5 | Load 3D avatar model | Ready Player Me / Three.js |
| 6 | Generate lip-sync visemes from TTS audio | Rhubarb Lip Sync / phoneme mapping |
| 7 | Animate avatar expressions based on question sentiment | LLM emotion tag → animation state |
| 8 | Maintain proctoring overlay | face-api.js (existing) |

### 7.5 API Contract Changes

**New field on `/api/ai-interview/start` response:**
```json
{
  "sessionId": "uuid",
  "avatarId": "professional_female_01",
  "greetingText": "Hello! I am Aria, your AI interviewer...",
  "greetingAudioUrl": "https://cdn.hirespec.ai/tts/greeting_abc.mp3",
  "firstQuestion": { "text": "...", "audioUrl": "..." }
}
```

**New field on `/api/ai-interview/respond` response:**
```json
{
  "score": 8.2,
  "nextQuestion": {
    "text": "Tell me about a challenging project...",
    "audioUrl": "https://cdn.hirespec.ai/tts/q4_xyz.mp3",
    "emotionCue": "curious",
    "visemes": [{ "time": 0.1, "value": "AA" }, ...]
  }
}
```

---

## 8. Upcoming Features

### 8.1 AI Doubt Solver with Live Whiteboard ✅ Built (Integration Pending)

#### 8.1.1 Overview

The AI Doubt Solver is a **standalone educational micro-app** — not a collaborative drawing tool. A student types any question (e.g. "Explain recursion" or "Trees vs Graphs"), and the system streams back a **live hierarchical concept map** rendered as an SVG graph that builds up in real-time as the LLM generates it.

**What it actually is:**
- Student asks a doubt in natural language
- FastAPI backend streams to Groq LLM (`llama-3.3-70b-versatile`)
- Groq responds with **JSON-Lines draw commands** (`node`, `arrow`, `equation`, `code`, `mermaid`)
- React frontend renders a live concept map (min 20–35 nodes, 4+ levels deep) via SVG
- Multi-turn conversation history supported
- Export concept map as PNG

**What it is NOT:** It is not a collaborative hand-drawing whiteboard for interviews.

**Current state:** Backend (FastAPI) and Frontend (React) are both fully built as a standalone app. Integration into the main EDU AI platform dashboard is pending.

#### 8.1.2 Architecture

```mermaid
flowchart TD
    subgraph "Whiteboard Frontend [React + Vite]"
        CP["ChatPanel.jsx\nQuestion input\n+ conversation history"]
        WC["WhiteboardCanvas.jsx\nSVG-based concept map\nlive node/arrow renderer"]
        HK["useWhiteboardStream.js\nfetch SSE stream\nparse JSON-Lines"]
        MP["mermaidParser.js\nRender Mermaid blocks\ninside canvas"]
        EX["Export PNG\nSVG → Canvas → PNG\n1600x960"]
    end

    subgraph "Whiteboard Backend [FastAPI :5000]"
        API["POST /api/whiteboard/solve\nStreamingResponse\ntext/event-stream SSE"]
        SAVE["POST /api/whiteboard/save\nSession ID + element count"]
        SVC["groq_whiteboard.py\nBuild system prompt\nStream from Groq API"]
        DEMO["Demo fallback\nDeterministic chunks\nwhen no API key"]
    end

    subgraph "Groq AI"
        LLM["llama-3.3-70b-versatile\nStreams JSON-Lines\n25-35 nodes per topic"]
    end

    CP -->|"POST {question, subject, history}"| API
    API --> SVC
    SVC -->|"Bearer GROQ_API_KEY\nstream:true"| LLM
    LLM -->|"SSE: data: {json-line}"| SVC
    SVC -->|"yield SSE chunk"| API
    API -->|"text/event-stream"| HK
    HK -->|"elements[]"| WC
    HK -->|"messages[]"| CP
    WC -->|"SVG nodes + arrows"| EX
    WC --> MP
    SVC -->|"no API key"| DEMO

    style API fill:#f97316,color:#fff
    style LLM fill:#8b5cf6,color:#fff
    style WC fill:#0ea5e9,color:#fff
    style SVC fill:#22c55e,color:#fff
```

#### 8.1.3 SSE Streaming Protocol

The backend uses **Server-Sent Events (SSE)** — not WebSockets. The LLM streams JSON-Lines; each line is one draw command:

| Chunk Type | Example Payload | Frontend Action |
|------------|----------------|-----------------|
| `draw / clear` | `{"type":"draw","command":"clear","data":{}}` | Clear SVG canvas |
| `draw / node` | `{"type":"draw","command":"node","data":{"id":"root","title":"Trees","color":"#6366f1","parent":null}}` | Add node to graph |
| `draw / arrow` | `{"type":"draw","command":"arrow","data":{"from":"root","to":"leaf"}}` | Draw edge between nodes |
| `draw / equation` | `{"type":"draw","command":"equation","data":{"latex":"O(n^2)"}}` | Render LaTeX |
| `draw / code` | `{"type":"draw","command":"code","data":{"language":"python","snippet":"..."}}` | Code block on canvas |
| `draw / mermaid` | `{"type":"draw","command":"mermaid","data":{"code":"graph LR..."}}` | Mermaid sub-diagram |
| `text` | `{"type":"text","content":"Let's start with..."}` | Chat message bubble |
| `speak` | `{"type":"speak","content":"Key insight here"}` | Voice-over cue |
| `done` | `{"type":"done"}` | Stream complete |

#### 8.1.4 Concept Map Structure (LLM-enforced)

```
Root Concept (Level 0 — #6366f1)
├── Definition / Core Concept   (Level 1 — #06b6d4)
│   ├── Formal definition       (Level 2 — #10b981)
│   └── Informal explanation    (Level 2 — #10b981)
├── Internal Structure          (Level 1 — #06b6d4)
│   ├── Components              (Level 2 — #10b981)
│   └── Sub-components          (Level 3 — #f59e0b)
├── Key Properties              (Level 1 — #06b6d4)
├── Types / Variants            (Level 1 — #06b6d4)
├── Examples                    (Level 1 — #06b6d4)
├── Advantages                  (Level 1 — #06b6d4)
├── Disadvantages               (Level 1 — #06b6d4)
├── Real-world Applications     (Level 1 — #06b6d4)
├── Comparisons / Trade-offs    (Level 1 — #06b6d4)
└── Interview Takeaways         (Level 1 — #06b6d4)
```

**"vs" topic mode** (e.g. "Trees vs Graphs"): generates two equal-depth side-by-side subtrees.

#### 8.1.5 UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  EDU-AI Whiteboard   [Network icon]    [Export PNG]  [Clear]   │
│  Live doubt solving with synchronized diagrams                  │
├──────────────────────────────────────┬──────────────────────────┤
│                                      │                          │
│     SVG CONCEPT MAP CANVAS           │    CHAT PANEL            │
│                                      │                          │
│   [root: Recursion]                  │  Student: Explain        │
│        |                             │  recursion               │
│   [Definition]  [Types]  [Apps]      │                          │
│        |           |        |        │  AI: Let's explore       │
│   [Base Case] [Direct] [Tree Walk]   │  recursion step by step. │
│        |       [Indirect]            │                          │
│   [Recursive] [Mutual]               │  [Streaming...]          │
│     Case                             │                          │
│                                      │  ┌───────────────────┐  │
│   [Advantages] [Disadvantages]       │  │ Type a question..  │  │
│                                      │  │              [Ask] │  │
│                                      │  └───────────────────┘  │
└──────────────────────────────────────┴──────────────────────────┘
```

#### 8.1.6 Integration TODO

| Task | Priority |
|------|----------|
| Embed whiteboard app inside main frontend as an iframe or route | High |
| Add "Open Doubt Solver" button to Candidate Dashboard | High |
| Pass student JWT to whiteboard for session tracking | Medium |
| Store session snapshots linked to user account | Medium |

---

### 8.2 AI Resume Verifier (Platform Integration) ⬜ Not Integrated

> **Note:** The Resume Verifier v2 microservice (FastAPI + LangGraph) is fully built as a standalone service. What's missing is frontend integration and seamless connection to the main hiring pipeline.

#### 8.2.1 Overview
The Resume Verifier automatically validates candidate GitHub project claims against actual code, producing a trust score and detailed evidence report viewable by recruiters.

#### 8.2.2 Integration Architecture

```mermaid
flowchart TD
    subgraph "Recruiter Workflow"
        REC[Recruiter views applicant profile]
        BTN[Click: Verify Resume]
        PANEL[Verification Panel opens]
        REPORT[View trust score + evidence]
        DECISION[Accept / Flag / Reject]
    end

    subgraph "Main Backend Integration"
        API1[POST /api/verification/start<br/>triggers RV2 analysis]
        API2[GET /api/verification/status/:id<br/>polling for completion]
        API3[GET /api/verification/report/:id<br/>full report fetch]
        DB_SAVE[Save result to User.verification]
    end

    subgraph "Resume Verifier v2"
        RV2[FastAPI :8000<br/>POST /api/v1/analyze]
        LG[LangGraph 8-node pipeline]
        TRUST[Trust Score 0-100]
    end

    REC --> BTN
    BTN --> API1
    API1 -->|X-API-Key auth| RV2
    RV2 --> LG
    LG --> TRUST
    API1 --> PANEL
    PANEL -->|poll every 3s| API2
    API2 --> RV2
    TRUST --> DB_SAVE
    DB_SAVE --> API3
    API3 --> REPORT
    REPORT --> DECISION
```

#### 8.2.3 Trust Score Display

```
┌───────────────────────────────────────────────────────────┐
│  Resume Verification Report — John Doe                     │
│                                                           │
│  Trust Score: ████████████░░░░  84.5 / 100   🟢 LOW RISK │
│                                                           │
│  ┌─────────────────┬────────────────────────────────────┐ │
│  │ Feature Verify  │ ████████████████████░░░░  78%      │ │
│  │ Architecture    │ ██████████████████████░░  90%      │ │
│  │ Code Quality    │ ████████████████░░░░░░░░  72%      │ │
│  │ Security        │ ██████████████████░░░░░░  75%      │ │
│  │ Authenticity    │ ████████████████████░░░░  82%      │ │
│  └─────────────────┴────────────────────────────────────┘ │
│                                                           │
│  ✅ Verified Claims (8):                                  │
│     ✓ JWT Authentication     [97% conf] Deep evidence    │
│     ✓ Redis Caching          [91% conf] Deep evidence    │
│     ✓ Docker Containerization [88% conf] Moderate evid.  │
│     ✓ REST API Design        [95% conf] Deep evidence    │
│                                                           │
│  ❌ Unverified Claims (2):                                │
│     ✗ Kubernetes Deployment  — No evidence found         │
│     ✗ ML Model Integration   — No evidence found         │
│                                                           │
│  Recommendation: ✅ PROCEED TO TECHNICAL INTERVIEW        │
│                                                           │
│  [Download Full Report PDF]    [Flag for Review]         │
└───────────────────────────────────────────────────────────┘
```

#### 8.2.4 Integration TODO

| Task | Owner | Priority |
|------|-------|----------|
| Add `POST /api/verification/start` in Node.js backend | Backend | High |
| Wire `ResumeVerification.jsx` to call above endpoint | Frontend | High |
| Add polling UI in `ResumeVerification.jsx` (3s intervals) | Frontend | High |
| Render trust score breakdown chart (ApexCharts) | Frontend | Medium |
| Store verifier result in `User.verification.v2` | Backend | Medium |
| Add "Verify Resume" button to Company applicant view | Frontend | Medium |
| Environment variable: `RESUME_VERIFIER_URL` in Node.js | DevOps | High |

---

## 9. Data Models — ER Diagram

```mermaid
erDiagram
    USER {
        ObjectId _id
        string email
        string passwordHash
        string role
        string name
        object profile
        object resume
        object verification
        float[] faceDescriptor
        string pineconeId
        date createdAt
    }

    JOB {
        ObjectId _id
        ObjectId companyId
        string title
        string department
        string status
        object atsCriteria
        int applicantCount
        date createdAt
    }

    APPLICATION {
        ObjectId _id
        ObjectId candidateId
        ObjectId jobId
        string status
        float atsScore
        bool isEligible
        object scoreBreakdown
        array rounds
        date appliedAt
    }

    AI_INTERVIEW {
        ObjectId _id
        ObjectId userId
        string sessionId
        string role
        string difficulty
        array questions
        array answers
        array scores
        object report
        int integrityScore
        date createdAt
    }

    INTERVIEW_PROCTORING {
        ObjectId _id
        string interviewId
        ObjectId userId
        array events
        float integrityScore
        date createdAt
    }

    CODING_CONTEST {
        ObjectId _id
        string code
        ObjectId hostId
        array problems
        array participants
        string status
        date startTime
    }

    QUIZ {
        ObjectId _id
        string joinCode
        ObjectId hostId
        array questions
        array participants
        string status
    }

    PRACTICE_SESSION {
        ObjectId _id
        ObjectId userId
        string mode
        array problems
        array submissions
        object report
    }

    AUDIT_LOG {
        ObjectId _id
        ObjectId userId
        string action
        object metadata
        date createdAt
    }

    OTP {
        ObjectId _id
        string email
        string hash
        date expiresAt
    }

    USER ||--o{ APPLICATION : "submits"
    JOB ||--o{ APPLICATION : "receives"
    USER ||--o{ AI_INTERVIEW : "takes"
    AI_INTERVIEW ||--|| INTERVIEW_PROCTORING : "has"
    USER ||--o{ CODING_CONTEST : "hosts"
    USER ||--o{ QUIZ : "hosts"
    USER ||--o{ PRACTICE_SESSION : "runs"
    USER ||--o{ AUDIT_LOG : "generates"
```

---

## 10. API Surface Summary

### Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | — | Register + trigger OTP |
| POST | `/verify-otp` | — | Verify OTP → issue JWT |
| POST | `/login` | — | Password login |
| POST | `/face-login` | — | Face descriptor login |
| POST | `/forgot-password` | — | Send reset OTP |
| POST | `/reset-password` | — | Set new password |
| POST | `/logout` | JWT | Clear cookie |
| GET | `/me` | JWT | Current user |

### Jobs & ATS (`/api/jobs`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/browse` | JWT | All active jobs |
| POST | `/` | company_admin / hr | Create job |
| PUT | `/:jobId` | company_admin / hr | Update job |
| DELETE | `/:jobId` | company_admin | Delete job |
| POST | `/:jobId/apply` | candidate | Apply + ATS score |
| GET | `/:jobId/applicants` | company | Applicant list |
| POST | `/:jobId/shortlist` | company | Bulk shortlist |
| POST | `/:jobId/rescore` | company | Re-run ATS on all |

### AI Interview (`/api/ai-interview`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/start` | JWT | Create session |
| POST | `/respond` | JWT | Submit answer |
| POST | `/end` | JWT | Generate report |
| GET | `/sessions` | JWT | My sessions |
| GET | `/session/:id` | JWT | Session detail |

### Coding Platform (`/api/cp/*`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/cp/code/submit` | JWT | Submit code solution |
| POST | `/cp/code/run` | JWT | Run without submitting |
| GET | `/cp/questions` | JWT | Problem list |
| POST | `/cp/questions/generate` | JWT | AI-generate problem |
| GET | `/cp/session` | JWT | Active session |
| GET | `/cp/reports` | JWT | Practice reports |
| POST | `/cp/analysis/analyze` | JWT | Analyze code quality |

### Resume Verifier v2 (`/api/v1` on port 8000)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/analyze` | API-Key | Queue analysis |
| GET | `/analyze/:id` | API-Key | Poll status |
| GET | `/report/:id` | API-Key | Full report |
| GET | `/health` | — | Service health |

### AI Doubt Solver (`/api/whiteboard` on standalone port 5000)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/solve` | — | Stream SSE concept map for a question |
| POST | `/save` | — | Save session elements + chat history |
| GET | `/health` | — | Service liveness check |

---

## Appendix A: Environment Variables

| Variable | Service | Required | Description |
|----------|---------|----------|-------------|
| `MONGODB_URI` | Backend | Yes | MongoDB connection string |
| `JWT_SECRET` | Backend | Yes | JWT signing key |
| `GROQ_API_KEY` | Backend | Yes | Groq LLM API key |
| `GEMINI_API_KEY` | Backend | No | Google Gemini API key |
| `PINECONE_FACE_API_KEY` | Backend | Yes | Pinecone face index key |
| `PINECONE_FACE_INDEX` | Backend | Yes | Pinecone index name |
| `CLOUDINARY_CLOUD_NAME` | Backend | Yes | Cloudinary account |
| `CLOUDINARY_API_KEY` | Backend | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Backend | Yes | Cloudinary API secret |
| `REDIS_URL` | Backend | No | Redis connection URL |
| `EMAIL_USER` | Backend | No | SMTP email address |
| `EMAIL_PASS` | Backend | No | SMTP app password |
| `TWILIO_ACCOUNT_SID` | Backend | No | Twilio SID |
| `TWILIO_AUTH_TOKEN` | Backend | No | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Backend | No | Twilio phone number |
| `NGROK_URL` | Backend | No | AI calling webhook URL |
| `SENTRY_DSN` | Backend | No | Sentry error reporting |
| `DATABASE_URL` | Resume Verifier | Yes | PostgreSQL async URL |
| `SYNC_DATABASE_URL` | Resume Verifier | Yes | PostgreSQL sync URL (Celery) |
| `REDIS_URL` | Resume Verifier | Yes | Redis URL (Celery broker) |
| `GEMINI_API_KEY` | Resume Verifier | Yes | Gemini API key |
| `API_KEY` | Resume Verifier | Yes | Shared secret with Node.js |

---

## Appendix B: ATS Scoring Weights

| Component | Weight | Formula |
|-----------|--------|---------|
| Skill Match | 40% | `matchedSkills / totalJobSkills` |
| Required Skills | 25% | `matchedRequired / totalRequired` |
| Resume Quality | 15% | Section completeness score (0–1) |
| CGPA | 10% | `min(candidateCGPA / minCGPA, 1.0)` |
| Experience | 10% | `clamp(years / minYears, 0, 1)` |
| **Total** | **100%** | Composite 0–100 score |

**Eligibility Gates (auto-fail any of these):**
- CGPA < job minimum CGPA
- Required skills coverage < 50%
- Experience outside `[minYears, maxYears]` range

---

## Appendix C: Resume Verifier Trust Score Weights

| Component | Weight | Method |
|-----------|--------|--------|
| Feature Verification | 35% | AST search + Gemini Flash per claim |
| Architecture Quality | 20% | Code structure analysis |
| Code Quality | 15% | File patterns, test presence, CI/CD |
| Security Quality | 15% | Security pattern detection |
| Authenticity | 15% | Gemini Pro deep analysis |
| **Total** | **100%** | Weighted composite 0–100 |

**Risk Levels:**
- 🟢 `LOW` — Trust Score ≥ 75
- 🟡 `MEDIUM` — Trust Score 50–74
- 🔴 `HIGH` — Trust Score < 50

---

*Document generated: 2026-06-06 | EDU AI v2.0 | LNCT Bhopal*
