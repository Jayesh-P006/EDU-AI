import api from './api.js';

// ─── Mock Data ────────────────────────────────────────────────────────────────
export const MOCK_CANDIDATES = [
  {
    id: '6643a1b2c3d4e5f6a7b8c9d0',
    name: 'Aditya Kumar',
    email: 'aditya@eduai.demo',
    username: 'aditya_k',
    appliedRole: 'Backend Software Engineer',
    companyName: 'Google India',
    jobTitle: 'Backend Software Engineer (Go)',
    resumeStatus: 'uploaded',
    analysisStatus: 'completed',
    trustScore: 91,
    riskLevel: 'LOW',
    recommendation: 'Proceed to Technical Interview',
    appliedAt: '2026-05-15T10:00:00Z',
    skills: ['Java', 'Spring Boot', 'MySQL', 'Docker', 'System Design'],
    atsScore: 92,
    applicationStatus: 'interview',
  },
  {
    id: '6643a1b2c3d4e5f6a7b8c9d1',
    name: 'Ananya Iyer',
    email: 'ananya@eduai.demo',
    username: 'ananya_i',
    appliedRole: 'Data Scientist / ML Engineer',
    companyName: 'TechCorp Solutions',
    jobTitle: 'QA Automation Engineer',
    resumeStatus: 'uploaded',
    analysisStatus: 'completed',
    trustScore: 87,
    riskLevel: 'LOW',
    recommendation: 'Consider for Next Round',
    appliedAt: '2026-05-16T14:30:00Z',
    skills: ['Python', 'Machine Learning', 'TensorFlow', 'Pandas', 'SQL'],
    atsScore: 87,
    applicationStatus: 'hired',
  },
  {
    id: '6643a1b2c3d4e5f6a7b8c9d2',
    name: 'Kabir Mehta',
    email: 'kabir@eduai.demo',
    username: 'kabir_m',
    appliedRole: 'Frontend Developer',
    companyName: 'TechCorp Solutions',
    jobTitle: 'Senior Full-Stack Engineer',
    resumeStatus: 'uploaded',
    analysisStatus: 'completed',
    trustScore: 82,
    riskLevel: 'LOW',
    recommendation: 'Consider for Next Round',
    appliedAt: '2026-05-14T09:00:00Z',
    skills: ['JavaScript', 'React', 'Node.js', 'CSS', 'HTML'],
    atsScore: 81,
    applicationStatus: 'offered',
  },
  {
    id: '6643a1b2c3d4e5f6a7b8c9d3',
    name: 'Riya Sen',
    email: 'riya@eduai.demo',
    username: 'riya_s',
    appliedRole: 'DevOps / Site Reliability Engineer',
    companyName: 'Google India',
    jobTitle: 'Backend Software Engineer (Go)',
    resumeStatus: 'uploaded',
    analysisStatus: 'completed',
    trustScore: 95,
    riskLevel: 'NONE',
    recommendation: 'Proceed to Technical Interview',
    appliedAt: '2026-05-12T11:15:00Z',
    skills: ['Go', 'Kubernetes', 'Docker', 'AWS', 'Linux', 'Terraform'],
    atsScore: 95,
    applicationStatus: 'selected',
  },
  {
    id: '6643a1b2c3d4e5f6a7b8c9d4',
    name: 'Vikram Malhotra',
    email: 'vikram@eduai.demo',
    username: 'vikram_m',
    appliedRole: 'Full Stack Engineer',
    companyName: 'TechCorp Solutions',
    jobTitle: 'Senior Full-Stack Engineer',
    resumeStatus: 'uploaded',
    analysisStatus: 'completed',
    trustScore: 45,
    riskLevel: 'HIGH',
    recommendation: 'Not Recommended',
    appliedAt: '2026-05-10T16:45:00Z',
    skills: ['PHP', 'Laravel', 'HTML', 'CSS', 'JavaScript'],
    atsScore: 75,
    applicationStatus: 'rejected',
  },
  {
    id: '6643a1b2c3d4e5f6a7b8c9d5',
    name: 'Neha Patel',
    email: 'neha@eduai.demo',
    username: 'neha_p',
    appliedRole: 'Software Engineer',
    companyName: 'Google India',
    jobTitle: 'Backend Software Engineer (Go)',
    resumeStatus: 'uploaded',
    analysisStatus: 'pending',
    trustScore: null,
    riskLevel: null,
    recommendation: null,
    appliedAt: '2026-05-18T08:00:00Z',
    skills: ['C++', 'Algorithms', 'Data Structures', 'Python', 'Git'],
    atsScore: 88,
    applicationStatus: 'screening',
  },
  {
    id: '6643a1b2c3d4e5f6a7b8c9d6',
    name: 'Siddharth Gupta',
    email: 'sid@eduai.demo',
    username: 'sid_g',
    appliedRole: 'Fullstack Developer',
    companyName: 'TechCorp Solutions',
    jobTitle: 'Senior Full-Stack Engineer',
    resumeStatus: 'uploaded',
    analysisStatus: 'in_progress',
    trustScore: null,
    riskLevel: null,
    recommendation: null,
    appliedAt: '2026-05-19T13:00:00Z',
    skills: ['TypeScript', 'Next.js', 'PostgreSQL', 'GraphQL', 'Tailwind'],
    atsScore: 84,
    applicationStatus: 'interview',
  },
  {
    id: '6643a1b2c3d4e5f6a7b8c9d7',
    name: 'Priya Sharma',
    email: 'priya@eduai.demo',
    username: 'priya_s',
    appliedRole: 'Cloud Solutions Architect',
    companyName: 'TechCorp Solutions',
    jobTitle: 'Cloud Solutions Architect',
    resumeStatus: 'not_uploaded',
    analysisStatus: 'not_started',
    trustScore: null,
    riskLevel: null,
    recommendation: null,
    appliedAt: '2026-05-20T10:30:00Z',
    skills: ['AWS', 'Azure', 'Terraform', 'Kubernetes'],
    atsScore: 78,
    applicationStatus: 'applied',
  },
];

export const MOCK_STATS = {
  totalApplicants: 24,
  pendingAnalysis: 8,
  verified: 12,
  highRisk: 3,
  avgTrustScore: 76,
};

export const MOCK_REPORT = {
  candidateId: '6643a1b2c3d4e5f6a7b8c9d0',
  candidateName: 'Aditya Kumar',
  email: 'aditya@eduai.demo',
  appliedRole: 'Backend Software Engineer',
  trustScore: 91,
  riskLevel: 'LOW',
  recommendation: 'Proceed to Technical Interview',
  analysisCompletedAt: '2026-05-15T12:30:00Z',

  verifiedClaims: [
    'JWT Authentication',
    'Redis Caching',
    'Docker Deployment',
    'AI Chatbot Integration',
    'Role Based Access Control',
  ],

  claimVerification: [
    { claim: 'JWT Authentication', status: 'verified', confidence: 97, evidenceCount: 3 },
    { claim: 'Redis Caching', status: 'verified', confidence: 94, evidenceCount: 2 },
    { claim: 'Docker Deployment', status: 'verified', confidence: 91, evidenceCount: 4 },
    { claim: 'AI Chatbot Integration', status: 'partial', confidence: 62, evidenceCount: 1 },
    { claim: 'Role Based Access Control', status: 'failed', confidence: 18, evidenceCount: 0 },
    { claim: 'Spring Boot', status: 'verified', confidence: 99, evidenceCount: 5 },
    { claim: 'MySQL Optimization', status: 'partial', confidence: 55, evidenceCount: 1 },
  ],

  evidence: {
    'JWT Authentication': [
      { file: 'src/auth/auth.service.java', reason: 'JwtBuilder.signWith() detected', snippet: 'return Jwts.builder().setSubject(user.getId()).signWith(key).compact();' },
      { file: 'src/middleware/JwtFilter.java', reason: 'Jwts.parserBuilder() detected', snippet: 'Claims claims = Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();' },
      { file: 'src/routes/UserController.java', reason: 'Protected routes with @PreAuthorize detected', snippet: '@PreAuthorize("hasRole(\'USER\')")\n@GetMapping("/profile")' },
    ],
    'Redis Caching': [
      { file: 'src/config/RedisConfig.java', reason: 'RedisConnectionFactory configured', snippet: '@Bean\npublic RedisConnectionFactory redisConnectionFactory() { ... }' },
      { file: 'src/service/CacheService.java', reason: '@Cacheable annotation usage detected', snippet: '@Cacheable(value = "users", key = "#userId")\npublic User getUserById(String userId) { ... }' },
    ],
    'Docker Deployment': [
      { file: 'Dockerfile', reason: 'Multi-stage Docker build detected', snippet: 'FROM maven:3.8.1-openjdk-17 AS builder\nWORKDIR /app\nCOPY pom.xml .\nRUN mvn dependency:resolve' },
      { file: 'docker-compose.yml', reason: 'Docker compose with services', snippet: 'services:\n  app:\n    build: .\n    ports:\n      - "8080:8080"' },
      { file: '.github/workflows/deploy.yml', reason: 'Docker build in CI pipeline', snippet: 'docker build -t myapp:latest .' },
      { file: 'k8s/deployment.yaml', reason: 'Kubernetes deployment config', snippet: 'image: myapp:latest\nreplicas: 3' },
    ],
    'Spring Boot': [
      { file: 'pom.xml', reason: 'spring-boot-starter-web dependency', snippet: '<artifactId>spring-boot-starter-web</artifactId>' },
      { file: 'src/main/java/Application.java', reason: '@SpringBootApplication annotation', snippet: '@SpringBootApplication\npublic class Application { ... }' },
    ],
  },

  repositorySummary: {
    techStack: ['Java', 'Spring Boot', 'MySQL', 'Redis', 'Docker'],
    languages: { Java: 78, SQL: 12, YAML: 6, Dockerfile: 4 },
    frameworks: ['Spring Boot', 'Spring Security', 'Spring Data JPA'],
    database: ['MySQL', 'Redis'],
    infrastructure: ['Docker', 'Kubernetes', 'GitHub Actions'],
    totalFiles: 187,
    linesOfCode: 14200,
    commitCount: 93,
  },

  architectureAnalysis: {
    score: 88,
    structure: {
      controllers: 12,
      services: 9,
      repositories: 7,
      middlewares: 5,
      validators: 4,
      models: 11,
    },
    patterns: ['Repository Pattern', 'Service Layer', 'DTO Pattern', 'Factory Pattern'],
  },

  authenticityAnalysis: {
    score: 84,
    findings: [
      'Feature depth verified across multiple files',
      'Minimal boilerplate or template code detected',
      'Consistent architecture patterns throughout',
      'Low indicators of copy-paste from tutorials',
      'Custom business logic present in service layer',
    ],
    risks: [
      'Some utility classes appear generic',
      'Minor inconsistency in error handling',
    ],
  },

  riskIndicators: [
    'Missing test coverage (< 20% code covered)',
    'Weak error handling in some controllers',
    'No rate limiting implementation found',
    'Hardcoded configuration values detected',
  ],

  layer1: { decision: 'PASS', jdYears: 3, resumeYears: 4, gap: -1, reason: 'Candidate exceeds the minimum experience requirement by 1 year.' },
  layer3: { riskLevel: 'LOW', overallScore: 91, integrityScore: 88, verdict: 'Resume claims are largely authentic and verifiable through code analysis.', summary: { verified: 5, partial: 2, overclaimed: 0 } },
};

// ─── Multi-Project Mock Data ───────────────────────────────────────────────────
export const MOCK_MULTI_PROJECT_ANALYSIS = {
  candidateId: '6643a1b2c3d4e5f6a7b8c9d0',
  candidateName: 'Navneet Tripathi',
  appliedRole: 'Backend Software Engineer',
  email: 'navneet@example.com',
  overallTrustScore: 85,
  authenticityScore: 87,
  riskLevel: 'LOW',
  recommendation: 'Proceed to Technical Interview',
  analysisStatus: 'in_progress',
  pipelineSteps: [
    { id: 'resume_parsed', label: 'Resume Parsed', done: true, ts: '10:30:12' },
    { id: 'projects_discovered', label: 'Projects Discovered', done: true, ts: '10:30:15' },
    { id: 'repos_queued', label: 'Workers Dispatched', done: true, ts: '10:30:16' },
    { id: 'analysis_running', label: 'Analysis Running', done: false },
    { id: 'aggregation', label: 'Score Aggregation', done: false },
  ],
  aggregatedSkills: ['Python', 'JavaScript', 'Solidity', 'React Native', 'FastAPI', 'Node.js', 'MongoDB', 'Redis', 'Docker', 'JWT'],
  aggregatedTechnologies: ['FastAPI', 'Redis', 'Docker', 'Solidity', 'Hardhat', 'React Native', 'Socket.io', 'MongoDB', 'JWT', 'PostgreSQL'],
  projects: [
    {
      id: 'proj_1',
      name: 'Autobot',
      githubUrl: 'https://github.com/navneet/autobot',
      status: 'completed',
      trustScore: 91,
      authenticityScore: 92,
      architectureScore: 88,
      repositoryScore: 90,
      claimsVerified: 5,
      totalClaims: 6,
      languages: { Python: 65, JavaScript: 20, YAML: 15 },
      technologies: ['FastAPI', 'Redis', 'Docker', 'JWT', 'PostgreSQL'],
      files: 142,
      linesOfCode: 8400,
      commitCount: 67,
      claimVerification: [
        { claim: 'JWT Authentication', status: 'verified', confidence: 97, evidence: [
          { file: 'auth/middleware.py', reason: 'jwt.decode() detected', snippet: 'payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])' },
          { file: 'auth/service.py', reason: 'jwt.encode() detected', snippet: 'return jwt.encode({"sub": user.id, "exp": exp}, SECRET_KEY)' },
        ]},
        { claim: 'Redis Caching', status: 'verified', confidence: 94, evidence: [
          { file: 'cache/redis.py', reason: 'redis.StrictRedis() initialized', snippet: 'redis_client = redis.StrictRedis(host=REDIS_HOST, port=REDIS_PORT)' },
        ]},
        { claim: 'Docker Deployment', status: 'verified', confidence: 91, evidence: [
          { file: 'Dockerfile', reason: 'Multi-stage Docker build detected', snippet: 'FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .' },
          { file: 'docker-compose.yml', reason: 'Service composition detected', snippet: 'services:\n  app:\n    build: .\n  redis:\n    image: redis:7' },
        ]},
        { claim: 'FastAPI Framework', status: 'verified', confidence: 99, evidence: [
          { file: 'main.py', reason: 'FastAPI() instantiation detected', snippet: 'app = FastAPI(title="Autobot API", version="1.0.0")' },
        ]},
        { claim: 'PostgreSQL Database', status: 'verified', confidence: 88, evidence: [
          { file: 'database/db.py', reason: 'asyncpg connection detected', snippet: 'engine = create_async_engine(DATABASE_URL, echo=True)' },
        ]},
        { claim: 'GraphQL API', status: 'failed', confidence: 18, evidence: [] },
      ],
    },
    {
      id: 'proj_2',
      name: 'NFT Marketplace',
      githubUrl: 'https://github.com/navneet/nft-marketplace',
      status: 'partial',
      trustScore: 75,
      authenticityScore: 78,
      architectureScore: 72,
      repositoryScore: 77,
      claimsVerified: 3,
      totalClaims: 5,
      languages: { Solidity: 45, JavaScript: 40, CSS: 15 },
      technologies: ['Solidity', 'Hardhat', 'React', 'Web3.js', 'IPFS'],
      files: 89,
      linesOfCode: 5200,
      commitCount: 41,
      claimVerification: [
        { claim: 'Solidity Smart Contracts', status: 'verified', confidence: 96, evidence: [
          { file: 'contracts/NFTMarketplace.sol', reason: 'ERC721 contract detected', snippet: 'contract NFTMarketplace is ERC721URIStorage, Ownable {' },
        ]},
        { claim: 'Hardhat Testing', status: 'verified', confidence: 89, evidence: [
          { file: 'test/marketplace.test.js', reason: 'Hardhat test file detected', snippet: 'const { expect } = require("chai");\nconst { ethers } = require("hardhat");' },
        ]},
        { claim: 'IPFS Integration', status: 'verified', confidence: 82, evidence: [
          { file: 'src/utils/ipfs.js', reason: 'IPFS client initialization', snippet: 'const ipfs = create({ host: "ipfs.infura.io", port: 5001 })' },
        ]},
        { claim: 'OpenSea Integration', status: 'failed', confidence: 22, evidence: [] },
        { claim: 'Layer 2 Scaling', status: 'failed', confidence: 15, evidence: [] },
      ],
    },
    {
      id: 'proj_3',
      name: 'Saheli+',
      githubUrl: 'https://github.com/navneet/saheli-plus',
      status: 'completed',
      trustScore: 88,
      authenticityScore: 91,
      architectureScore: 86,
      repositoryScore: 87,
      claimsVerified: 4,
      totalClaims: 5,
      languages: { JavaScript: 60, Python: 25, CSS: 15 },
      technologies: ['React Native', 'Node.js', 'MongoDB', 'Socket.io'],
      files: 198,
      linesOfCode: 12100,
      commitCount: 89,
      claimVerification: [
        { claim: 'React Native Mobile', status: 'verified', confidence: 95, evidence: [
          { file: 'App.js', reason: 'React Native components detected', snippet: 'import { View, Text, StyleSheet } from "react-native";' },
        ]},
        { claim: 'Node.js Backend', status: 'verified', confidence: 98, evidence: [
          { file: 'server/index.js', reason: 'Express.js server detected', snippet: 'const app = express();\napp.listen(PORT);' },
        ]},
        { claim: 'MongoDB Database', status: 'verified', confidence: 92, evidence: [
          { file: 'server/models/User.js', reason: 'Mongoose schema detected', snippet: 'const userSchema = new mongoose.Schema({ name: String, email: String });' },
        ]},
        { claim: 'Real-time Chat (Socket.io)', status: 'verified', confidence: 94, evidence: [
          { file: 'server/socket/handlers.js', reason: 'Socket.io handlers detected', snippet: 'io.on("connection", (socket) => { socket.on("message", handleMessage); })' },
        ]},
        { claim: 'Push Notifications', status: 'partial', confidence: 55, evidence: [
          { file: 'src/services/notifications.js', reason: 'Firebase messaging partially configured', snippet: 'import messaging from "@react-native-firebase/messaging";' },
        ]},
      ],
    },
    {
      id: 'proj_4',
      name: 'University Chatbot',
      githubUrl: 'https://github.com/navneet/uni-chatbot',
      status: 'running',
      trustScore: null,
      authenticityScore: null,
      architectureScore: null,
      repositoryScore: null,
      claimsVerified: null,
      totalClaims: null,
      languages: {},
      technologies: [],
      files: null,
      linesOfCode: null,
      commitCount: null,
      claimVerification: [],
    },
  ],
};

// ─── API Functions ─────────────────────────────────────────────────────────────

export async function fetchRecruiterStats() {
  try {
    const res = await api.get('/admin/stats');
    const d = res.data?.data || res.data || {};
    return {
      totalApplicants: d.totalUsers || d.totalApplicants || MOCK_STATS.totalApplicants,
      pendingAnalysis: d.pendingAnalysis || MOCK_STATS.pendingAnalysis,
      verified: d.verifiedCandidates || d.verified || MOCK_STATS.verified,
      highRisk: d.highRisk || MOCK_STATS.highRisk,
      avgTrustScore: d.avgTrustScore || MOCK_STATS.avgTrustScore,
    };
  } catch {
    return MOCK_STATS;
  }
}

export async function fetchAllCandidates() {
  try {
    const res = await api.get('/admin/users', { params: { role: 'candidate' } });
    const users = res.data?.data?.users || res.data?.users || [];
    if (users.length > 0) return users;
    return MOCK_CANDIDATES;
  } catch {
    return MOCK_CANDIDATES;
  }
}

export async function analyzeCandidate(candidateId, jdText = '') {
  const res = await api.post(`/verification/${candidateId}/run`, { jdText });
  return res.data;
}

export async function getVerificationResults(candidateId) {
  const res = await api.get(`/verification/${candidateId}/results`);
  return res.data;
}

export async function fetchCandidateReport(candidateId) {
  try {
    const res = await api.get(`/verification/${candidateId}/results`);
    const d = res.data;
    if (d?.verification) {
      return { ...MOCK_REPORT, ...d.verification, candidateId };
    }
    return MOCK_REPORT;
  } catch {
    return MOCK_REPORT;
  }
}

export function getTrustScoreColor(score) {
  if (score === null || score === undefined) return '#737373';
  if (score >= 90) return '#22c55e';
  if (score >= 75) return '#3b82f6';
  if (score >= 50) return '#eab308';
  return '#ef4444';
}

export function getTrustScoreLabel(score) {
  if (score === null || score === undefined) return 'Not Analyzed';
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Moderate';
  return 'High Risk';
}

export function getRiskColor(level) {
  const map = { NONE: '#22c55e', LOW: '#3b82f6', MEDIUM: '#eab308', HIGH: '#ef4444' };
  return map[level] || '#737373';
}

export function getRecommendation(score) {
  if (score === null || score === undefined) return 'Analysis Pending';
  if (score >= 90) return 'Proceed to Technical Interview';
  if (score >= 75) return 'Consider for Next Round';
  if (score >= 50) return 'Requires Further Review';
  return 'Not Recommended';
}

// ─── Candidate API Functions ───────────────────────────────────────────────────

export async function submitApplication(jobId, formData) {
  const res = await api.post(`/jobs/${jobId}/apply`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function getCandidateStatus(candidateId) {
  try {
    const res = await api.get(`/candidate/${candidateId}/status`);
    return res.data;
  } catch {
    return null;
  }
}

export async function getCandidateVerificationReport(candidateId) {
  try {
    const res = await api.get(`/candidate/${candidateId}/report`);
    return res.data;
  } catch {
    return null;
  }
}

// ─── Recruiter Extended APIs ───────────────────────────────────────────────────

export async function fetchAllApplicants() {
  try {
    const res = await api.get('/recruiter/applicants');
    const list = res.data?.data || res.data || [];
    return Array.isArray(list) && list.length > 0 ? list : MOCK_CANDIDATES;
  } catch {
    return MOCK_CANDIDATES;
  }
}

export async function fetchRecruiterCandidate(candidateId) {
  try {
    const res = await api.get(`/recruiter/candidate/${candidateId}`);
    return res.data?.data || res.data;
  } catch {
    return MOCK_CANDIDATES.find(c => c.id === candidateId) || null;
  }
}

export async function fetchRecruiterReport(candidateId) {
  try {
    const res = await api.get(`/recruiter/report/${candidateId}`);
    return res.data?.data || res.data;
  } catch {
    return MOCK_REPORT;
  }
}

// ─── Multi-Project Resume Workflow ────────────────────────────────────────────

export async function discoverGithubRepos(candidateId, resumeText) {
  try {
    const res = await api.post('/verification/resume/discover', { candidateId, resumeText });
    return res.data;
  } catch {
    return { candidateId, projectsFound: 4, projects: MOCK_MULTI_PROJECT_ANALYSIS.projects.map(p => ({ name: p.name, githubUrl: p.githubUrl, confidence: 0.95 })) };
  }
}

export async function analyzeResumeMultiProject(candidateId, resumeText) {
  try {
    const res = await api.post('/verification/resume/analyze', { candidateId, resumeText });
    return res.data;
  } catch {
    return { candidateId, groupId: `grp_${candidateId}`, projectsDiscovered: 4, projectsQueued: 4, message: 'Demo mode' };
  }
}

export async function getMultiProjectGroupStatus(groupId, candidateId) {
  try {
    const res = await api.get(`/verification/resume/group/${groupId}`, { params: { candidateId } });
    return res.data;
  } catch {
    return MOCK_MULTI_PROJECT_ANALYSIS;
  }
}

export async function fetchMultiProjectAnalysis(candidateId) {
  try {
    const res = await api.get(`/verification/${candidateId}/multi`);
    const d = res.data?.data || res.data;
    // Return null when no jobs exist yet so the UI shows the empty state
    if (!d || (Array.isArray(d.projects) && d.projects.length === 0)) return null;
    return d;
  } catch {
    return null;
  }
}
