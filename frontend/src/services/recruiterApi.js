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
// NOTE: these hit real backend/FastAPI endpoints. Errors are propagated (not
// swallowed into mock data) so React Query can drive loading/error/retry UI.

export async function discoverGithubRepos(candidateId, resumeText) {
  const res = await api.post('/verification/resume/discover', { candidateId, resumeText });
  return res.data;
}

export async function analyzeResumeMultiProject(candidateId, resumeText) {
  const res = await api.post('/verification/resume/analyze', { candidateId, resumeText });
  return res.data;
}

export async function getMultiProjectGroupStatus(groupId, candidateId) {
  const res = await api.get(`/verification/resume/group/${groupId}`, { params: { candidateId } });
  return res.data;
}

export async function fetchMultiProjectAnalysis(candidateId) {
  const res = await api.get(`/verification/${candidateId}/multi`);
  const d = res.data?.data || res.data || null;
  if (!d) return null;
  // FastAPI's GroupStatusResponse nests overall scores under `aggregated`.
  // Flatten them so the dashboard can read d.overallTrustScore etc. directly
  // regardless of which shape the backend returns.
  const agg = d.aggregated || {};
  return {
    ...d,
    overallTrustScore: d.overallTrustScore ?? agg.overallTrustScore ?? null,
    authenticityScore: d.authenticityScore ?? agg.authenticityScore ?? null,
    riskLevel: d.riskLevel ?? agg.riskLevel ?? null,
    recommendation: d.recommendation ?? agg.recommendation ?? null,
  };
}

// Candidate's basic profile — backs the "Candidate Overview" card on the
// verification dashboard (name, email, GitHub, LinkedIn, resume/ATS score).
// Backend: GET /api/profile/:userId (existing route, returns { profile: User }).
export async function fetchCandidateProfile(candidateId) {
  if (!candidateId) return null;
  const res = await api.get(`/profile/${candidateId}`);
  const user = res.data?.profile || res.data || null;
  if (!user) return null;
  return {
    name: user.fullName || user.username || '',
    email: user.email || '',
    github: user.github || user.socialLinks?.github || '',
    linkedin: user.linkedIn || user.socialLinks?.linkedin || '',
    resumeScore: user.atsScore ?? null,
  };
}

// Upload a resume for immediate parsing + auto GitHub-verification trigger.
// Backend: POST /jobs/preview-resume — returns full structured candidate data
// (name, email, phone, skills, projects, github, linkedin) plus discovered repos.
export async function parseResumeAndTriggerVerification(file, { signal, onUploadProgress } = {}) {
  const formData = new FormData();
  formData.append('resume', file);
  const res = await api.post('/jobs/preview-resume', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    signal,
    onUploadProgress,
  });
  return res.data;
}
