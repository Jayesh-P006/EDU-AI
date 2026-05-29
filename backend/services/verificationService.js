/**
 * 3-Layer Resume Verification Service
 * Ported from Python AdvancedJDParser pipeline.
 *
 * Layer 1: Experience Gate — instant pass/flag/reject
 * Layer 2: Skill Proof    — generates assessment questions per critical skill
 * Layer 3: Overclaim Detector — compares resume claims vs test performance
 */

import { extractSkills, parseResume, parseJD, analyzeGap } from './resumeParser.js';

// ═══════════════════════════════════════════════════════════
//  LAYER 1 — EXPERIENCE GATE
// ═══════════════════════════════════════════════════════════

const SENIORITY_RANK = {
  intern: 0, internship: 0,
  'entry level': 0.5, entry: 0.5, fresher: 0.5,
  junior: 1.5, jr: 1.5,
  'mid-level': 4, 'mid level': 4, mid: 4,
  senior: 6, sr: 6,
  lead: 8, 'tech lead': 8,
  staff: 10, principal: 12,
  architect: 12, director: 14, vp: 16, head: 12,
};

function experienceGate(jdResult, resumeResult) {
  const HARD_REJECT_GAP = 3;
  const SOFT_FLAG_GAP = 1.5;

  const parseYears = (expData) => {
    if (!expData) return null;
    if (expData.years != null) return expData.years;
    if (expData.range) return expData.range.max;
    // Try seniority → estimated years
    if (expData.seniority) {
      const s = expData.seniority.toLowerCase();
      for (const [key, rank] of Object.entries(SENIORITY_RANK)) {
        if (s.includes(key)) return rank;
      }
    }
    return null;
  };

  const jdYears = parseYears(jdResult?.experience);
  const resumeYears = parseYears(resumeResult?.experience);

  const result = {
    jdYears,
    resumeYears,
    gap: null,
    decision: 'PASS', // PASS | FLAG | REJECT
    reason: '',
    details: {},
  };

  if (jdYears == null || resumeYears == null) {
    result.decision = 'PASS';
    result.reason = 'Could not determine experience from both documents. Proceeding.';
    return result;
  }

  result.gap = jdYears - resumeYears;

  if (result.gap >= HARD_REJECT_GAP) {
    result.decision = 'REJECT';
    result.reason = `Candidate has ${resumeYears} years but JD requires ${jdYears}+ years (gap: ${result.gap} years). Auto-rejected.`;
  } else if (result.gap >= SOFT_FLAG_GAP) {
    result.decision = 'FLAG';
    result.reason = `Candidate has ${resumeYears} years, JD prefers ${jdYears}+ years. Close but flagged for review.`;
  } else {
    result.decision = 'PASS';
    result.reason = `Candidate (${resumeYears} yrs) meets JD requirement (${jdYears}+ yrs).`;
  }

  result.details = {
    jdSeniority: jdResult?.experience?.seniority || null,
    resumeSeniority: resumeResult?.experience?.seniority || null,
  };

  return result;
}

// ═══════════════════════════════════════════════════════════
//  LAYER 2 — SKILL PROOF (QUESTION BANK)
// ═══════════════════════════════════════════════════════════

const QUESTION_BANK = {
  Python: {
    mcq: {
      question: 'What is the output of: print(type([]) is list)',
      options: ['A) True', 'B) False', 'C) TypeError', 'D) None'],
      answer: 'A',
      explanation: "type([]) returns <class 'list'>, which is the same object as list, so 'is' returns True.",
    },
    coding: {
      question: 'Write a Python function that takes a list of integers and returns the second largest unique element. If no second largest exists, return None.',
      example_input: '[4, 1, 7, 7, 3]',
      expected_output: '4',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'You have a Python script processing 10GB CSV files. It runs out of memory. What are 3 approaches to handle this?',
      key_points: ['chunked reading (pandas chunksize)', 'generators/iterators', 'dask/vaex', 'reduce dtypes', 'use database'],
    },
  },
  JavaScript: {
    mcq: {
      question: "What does '0 == false' evaluate to in JavaScript?",
      options: ['A) true', 'B) false', 'C) TypeError', 'D) undefined'],
      answer: 'A',
      explanation: "JavaScript performs type coercion with ==. 0 is falsy, so 0 == false is true.",
    },
    coding: {
      question: "Write a JavaScript function 'debounce(fn, delay)' that returns a debounced version of fn.",
      example_input: 'debounce(() => console.log("fired"), 300)',
      expected_output: 'Function that delays execution by 300ms, resetting timer on each call',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'A user reports that your web app freezes for 3 seconds when fetching data. How would you debug and fix this?',
      key_points: ['check if fetch blocks main thread', 'use async/await', 'add loading state', 'check network tab', 'Web Workers'],
    },
  },
  'Node.js': {
    mcq: {
      question: 'In Node.js, which module is used to create an HTTP server?',
      options: ['A) fs', 'B) http', 'C) path', 'D) url'],
      answer: 'B',
      explanation: "The 'http' module provides functionality to create HTTP servers.",
    },
    coding: {
      question: 'Write a Node.js middleware for Express.js that logs request method, URL, and response time in ms.',
      example_input: 'GET /api/users',
      expected_output: 'GET /api/users - 45ms',
      difficulty: 'Easy',
    },
    scenario: {
      question: 'Your Node.js API handles 1000 req/sec but occasionally returns 503 errors on a 4-core server. How do you scale?',
      key_points: ['cluster module or PM2', 'event loop blocking', 'connection pooling', 'load balancer', 'clinic.js profiling'],
    },
  },
  React: {
    mcq: {
      question: 'What hook runs a side effect only once on mount?',
      options: ['A) useEffect(() => {}, [])', 'B) useEffect(() => {})', 'C) useMemo(() => {}, [])', 'D) useState()'],
      answer: 'A',
      explanation: 'useEffect with empty dependency array [] runs only once after initial render.',
    },
    coding: {
      question: "Build a custom React hook 'useLocalStorage(key, initialValue)' that syncs state with localStorage.",
      example_input: "const [name, setName] = useLocalStorage('name', 'Guest')",
      expected_output: 'Hook that persists state to localStorage',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'Your React app renders 10,000 items and scrolling is laggy. What strategies would you implement?',
      key_points: ['virtualization', 'React.memo', 'pagination', 'useMemo', 'key prop optimization'],
    },
  },
  SQL: {
    mcq: {
      question: 'What is the difference between WHERE and HAVING?',
      options: ['A) WHERE filters before GROUP BY, HAVING after', 'B) Identical', 'C) HAVING before GROUP BY', 'D) WHERE only with JOINs'],
      answer: 'A',
      explanation: 'WHERE filters rows before grouping. HAVING filters grouped results.',
    },
    coding: {
      question: 'Write a SQL query to find the top 3 departments by average salary, only including departments with 5+ employees.',
      example_input: 'Tables: employees(id, name, dept_id, salary), departments(id, name)',
      expected_output: 'Department | Emp_Count | Avg_Salary (top 3)',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'A SQL query joining 3 tables with millions of rows takes 45 seconds. How do you optimize it?',
      key_points: ['EXPLAIN plan', 'indexes on join columns', 'avoid full scans', 'optimize WHERE', 'materialized views'],
    },
  },
  MongoDB: {
    mcq: {
      question: "What does the '$lookup' aggregation stage do?",
      options: ['A) Left outer join', 'B) Text search', 'C) Create index', 'D) Filter docs'],
      answer: 'A',
      explanation: '$lookup performs a left outer join to another collection.',
    },
    coding: {
      question: 'Write a MongoDB aggregation pipeline grouping orders by customer_id with total spent, return top 5.',
      example_input: 'Collection: orders { customer_id, amount, date }',
      expected_output: 'Top 5 customers by total_spent',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'MongoDB collection with 50M documents — queries getting slower with full scans. How do you fix?',
      key_points: ['compound indexes', 'explain()', 'sharding', 'schema redesign', 'projections'],
    },
  },
  Docker: {
    mcq: {
      question: 'What is the difference between CMD and ENTRYPOINT?',
      options: ['A) CMD defaults can be overridden; ENTRYPOINT always runs', 'B) Identical', 'C) CMD at build time', 'D) ENTRYPOINT deprecated'],
      answer: 'A',
      explanation: 'ENTRYPOINT configures the container executable. CMD provides overridable defaults.',
    },
    coding: {
      question: 'Write a multi-stage Dockerfile for a Node.js app: build stage + slim production image.',
      example_input: 'Node.js app with package.json, src/',
      expected_output: 'Dockerfile with build and production stages',
      difficulty: 'Medium',
    },
    scenario: {
      question: "Docker container works locally but fails in production with 'permission denied' and OOM after 30 min. Debug?",
      key_points: ['user permissions', 'memory limits', 'volume mounts', 'docker logs/stats', 'non-root user'],
    },
  },
  Kubernetes: {
    mcq: {
      question: 'What is the role of a Kubernetes Service?',
      options: ['A) Stable networking for Pods', 'B) Store config', 'C) Manage images', 'D) Handle logging'],
      answer: 'A',
      explanation: 'A Service provides stable IP and DNS for a set of Pods with load balancing.',
    },
    coding: {
      question: 'Write a K8s Deployment YAML: 3 replicas, resource limits (256Mi/250m CPU), readiness probe on /health.',
      example_input: 'Image: myapp:v1, Port: 8080',
      expected_output: 'Valid Deployment YAML',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'Pods keep restarting with CrashLoopBackOff. Logs are empty. Debug process?',
      key_points: ['kubectl describe pod', 'check events', 'resource limits', 'liveness probe', 'init containers', 'logs --previous'],
    },
  },
  AWS: {
    mcq: {
      question: 'Which AWS service for serverless event-driven architecture?',
      options: ['A) EC2', 'B) Lambda', 'C) RDS', 'D) S3'],
      answer: 'B',
      explanation: 'Lambda runs code in response to events without provisioning servers.',
    },
    coding: {
      question: 'Write an AWS Lambda function (pseudo-code) that validates uploaded JSON files and moves invalid ones to errors/ prefix.',
      example_input: 'S3 event: bucket=my-bucket, key=uploads/data.json',
      expected_output: 'Lambda handler that validates and moves',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'AWS bill tripled this month. You use EC2, RDS, S3, Lambda. How do you identify and reduce the spike?',
      key_points: ['Cost Explorer', 'unused resources', 'right-size instances', 'Reserved Instances', 'S3 lifecycle', 'Lambda concurrency'],
    },
  },
  'System Design': {
    mcq: {
      question: 'In CAP theorem, what must be sacrificed during a network partition?',
      options: ['A) Either Consistency or Availability', 'B) Performance', 'C) Security', 'D) Both C and A'],
      answer: 'A',
      explanation: 'During partition, a distributed system must choose Consistency or Availability.',
    },
    coding: {
      question: 'Design schema and API endpoints for a URL shortener. Include data model + 3 REST endpoints.',
      example_input: 'Long URL: https://example.com/very/long/path',
      expected_output: 'Short URL: https://short.ly/abc123 + API design',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'Design a real-time chat system for 1M concurrent users. High-level architecture?',
      key_points: ['WebSocket', 'message queue (Kafka)', 'Cassandra for messages', 'presence service', 'horizontal scaling'],
    },
  },
  'REST APIs': {
    mcq: {
      question: 'What HTTP status code for a successfully created resource?',
      options: ['A) 200 OK', 'B) 201 Created', 'C) 204 No Content', 'D) 301 Moved'],
      answer: 'B',
      explanation: '201 Created indicates a new resource has been successfully created.',
    },
    coding: {
      question: "Design a RESTful API for 'Tasks' resource. 5 endpoints with proper HTTP methods and status codes.",
      example_input: 'Resource: Task { id, title, description, status, assignee, due_date }',
      expected_output: '5 endpoints: CRUD + filtered list',
      difficulty: 'Easy',
    },
    scenario: {
      question: 'REST API returns all fields for every resource. Clients complain about slow responses. How to optimize?',
      key_points: ['field selection', 'pagination', 'compression', 'caching (ETag)', 'consider GraphQL'],
    },
  },
  GraphQL: {
    mcq: {
      question: 'What problem does GraphQL primarily solve vs REST?',
      options: ['A) Over/under-fetching', 'B) Authentication', 'C) DB management', 'D) Deployment'],
      answer: 'A',
      explanation: 'GraphQL lets clients request exactly the data they need.',
    },
    coding: {
      question: 'Write a GraphQL schema for a blog with User, Post, Comment types.',
      example_input: 'Blog with users, posts, comments',
      expected_output: 'Schema with types, queries, mutations',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'Malicious user sends deeply nested GraphQL query (20 levels), crashing server. Prevention?',
      key_points: ['depth limiting', 'complexity analysis', 'persisted queries', 'timeouts', 'rate limiting'],
    },
  },
  'Machine Learning': {
    mcq: {
      question: 'What is the primary purpose of cross-validation?',
      options: ['A) Assess generalization to unseen data', 'B) Increase speed', 'C) Reduce dataset', 'D) Select features'],
      answer: 'A',
      explanation: 'Cross-validation evaluates model performance and detects overfitting.',
    },
    coding: {
      question: 'Write pseudo-code for a classification pipeline: handle missing values, scale features, train Random Forest, evaluate with 5-fold CV.',
      example_input: 'Numeric features + binary target',
      expected_output: 'Pipeline with preprocessing + model + CV scores',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'Model has 99% training accuracy but 60% test accuracy. What and how to fix?',
      key_points: ['overfitting', 'regularization', 'reduce complexity', 'more data', 'feature selection', 'early stopping'],
    },
  },
  TypeScript: {
    mcq: {
      question: "Difference between 'interface' and 'type' in TypeScript?",
      options: ['A) Interfaces can be extended/merged; types support unions', 'B) Identical', 'C) Types for primitives only', 'D) Interfaces deprecated'],
      answer: 'A',
      explanation: 'Interfaces support declaration merging. Types support unions and intersections.',
    },
    coding: {
      question: "Write a generic function 'groupBy<T>(array: T[], key: keyof T): Record<string, T[]>'.",
      example_input: "groupBy([{name:'a', age:1}, {name:'b', age:1}], 'age')",
      expected_output: "{'1': [{name:'a', age:1}, {name:'b', age:1}]}",
      difficulty: 'Medium',
    },
    scenario: {
      question: 'Migrating 50K-line JS codebase to TypeScript. Strict from day one or gradual? Your strategy?',
      key_points: ['allowJs: true', 'rename gradually', 'use any initially', 'enable strict incrementally', 'shared modules first'],
    },
  },
  Microservices: {
    mcq: {
      question: 'What pattern solves distributed transactions across microservices?',
      options: ['A) Saga Pattern', 'B) Singleton', 'C) MVC', 'D) Factory'],
      answer: 'A',
      explanation: 'Saga manages distributed transactions with compensating actions for rollback.',
    },
    coding: {
      question: 'Design service boundaries for e-commerce: identify 4+ microservices and communication patterns.',
      example_input: 'E-commerce: products, orders, payments, notifications',
      expected_output: 'Architecture with service APIs and message flows',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'Service A → B → C. C is down, cascading failures. Prevention?',
      key_points: ['circuit breaker', 'bulkhead', 'timeouts with backoff', 'fallback responses', 'async communication'],
    },
  },
  Redis: {
    mcq: {
      question: 'What Redis data structure for a leaderboard?',
      options: ['A) Sorted Set (ZSET)', 'B) List', 'C) Hash', 'D) String'],
      answer: 'A',
      explanation: 'Sorted Sets maintain elements with scores for O(log N) operations.',
    },
    coding: {
      question: 'Write pseudo-code for a Redis rate limiter: 100 requests per minute per user (sliding window).',
      example_input: 'User ID: user123, Limit: 100 req/min',
      expected_output: 'Function returning True (allowed) or False (rate-limited)',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'Redis at 90% memory with OOM errors. How to diagnose and fix?',
      key_points: ['redis-cli --bigkeys', 'maxmemory policy LRU/LFU', 'set TTLs', 'SCAN analysis', 'Redis Cluster'],
    },
  },
  'CI/CD': {
    mcq: {
      question: 'Difference between Continuous Delivery and Continuous Deployment?',
      options: ['A) Deployment auto-deploys; Delivery needs manual approval', 'B) Identical', 'C) Delivery is faster', 'D) Deployment needs Docker'],
      answer: 'A',
      explanation: 'Continuous Deployment automatically deploys every change that passes tests.',
    },
    coding: {
      question: 'Write a GitHub Actions workflow: trigger on push to main, test, build Docker image, push to registry, deploy.',
      example_input: 'Node.js app with npm test',
      expected_output: '.github/workflows/deploy.yml',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'CI/CD pipeline takes 45 minutes. How to optimize?',
      key_points: ['parallelize tests', 'cache dependencies', 'only affected tests', 'smaller images', 'self-hosted runners'],
    },
  },
  Git: {
    mcq: {
      question: "Difference between 'git merge' and 'git rebase'?",
      options: ['A) Merge creates merge commit; rebase replays for linear history', 'B) Identical', 'C) Rebase faster', 'D) Merge deletes branches'],
      answer: 'A',
      explanation: 'Merge joins branches with a commit. Rebase replays commits for linear history.',
    },
    coding: {
      question: 'You committed a secret API key 3 commits ago. Write git commands to remove it from history.',
      example_input: 'Secret in config.py, 3 commits ago',
      expected_output: 'Git commands to rewrite history',
      difficulty: 'Medium',
    },
    scenario: {
      question: 'Two devs push to main and get merge conflicts. Walk through resolution and prevention.',
      key_points: ['git pull --rebase', 'resolve manually', 'feature branches', 'PR reviews', 'smaller commits'],
    },
  },
};

// Default question template for skills not in the bank
const DEFAULT_QUESTION = {
  mcq: {
    question: 'Which of the following best describes the primary purpose of {SKILL}?',
    options: ['A) Performance optimization', 'B) Core functionality', 'C) User interface', 'D) Security'],
    answer: 'B',
    explanation: 'Generic question — skill-specific questions should be generated for real assessment.',
  },
  coding: {
    question: 'Write a small program demonstrating your proficiency in {SKILL}.',
    example_input: 'A practical problem in {SKILL}',
    expected_output: 'Working code with comments',
    difficulty: 'Medium',
  },
  scenario: {
    question: 'A critical production bug in your {SKILL} system at 2 AM. Walk through debugging.',
    key_points: ['check logs', 'reproduce issue', 'identify root cause', 'implement fix', 'verify and deploy'],
  },
};

/**
 * Generate skill proof assessment questions
 */
function generateAssessment(jdResult, resumeResult = null) {
  const jdSkills = jdResult?.skills?.all || [];
  const resumeSkills = new Set(resumeResult?.skills?.all || []);
  const weighted = jdResult?.skills?.weighted || {};

  // Identify critical skills (those in JD that resume claims)
  const criticalSkills = jdSkills.filter(s =>
    resumeSkills.has(s) && (weighted[s] === 'high' || weighted[s] === 'medium')
  );

  // If no critical skills, test all JD skills claimed
  const skillsToTest = criticalSkills.length > 0
    ? criticalSkills
    : jdSkills.filter(s => resumeSkills.has(s));

  // Take up to 8 skills
  const selectedSkills = skillsToTest.slice(0, 8);

  const questions = [];
  const qTypes = ['mcq', 'coding', 'scenario'];

  selectedSkills.forEach((skill, idx) => {
    const qType = qTypes[idx % qTypes.length];
    const bank = QUESTION_BANK[skill] || null;

    let question;
    if (bank && bank[qType]) {
      question = { ...bank[qType] };
    } else {
      // Use default with skill name substituted
      question = JSON.parse(JSON.stringify(DEFAULT_QUESTION[qType]).replace(/\{SKILL\}/g, skill));
    }

    questions.push({
      id: idx + 1,
      skill,
      type: qType,
      priority: weighted[skill] || 'medium',
      ...question,
    });
  });

  return {
    totalQuestions: questions.length,
    estimatedTimeMinutes: questions.length * 5,
    skillsTested: selectedSkills,
    questions,
  };
}

// ═══════════════════════════════════════════════════════════
//  LAYER 3 — OVERCLAIM DETECTOR
// ═══════════════════════════════════════════════════════════

const OVERCLAIM_THRESHOLD = 40;
const STRONG_OVERCLAIM = 20;
const VERIFIED_THRESHOLD = 70;

/**
 * Analyze overclaims based on assessment scores
 * @param {Object[]} answers - [{skill, score, type, answered}]
 * @param {Object} resumeResult - parsed resume
 */
function analyzeOverclaims(answers, resumeResult = null) {
  if (!answers || answers.length === 0) {
    return { success: false, error: 'No answers to analyze' };
  }

  const resumeSkills = new Set(resumeResult?.skills?.all || []);
  const results = [];
  let totalScore = 0;
  let totalQuestions = 0;

  const overclaimed = [];
  const verified = [];
  const partiallyVerified = [];

  for (const ans of answers) {
    const score = Number(ans.score) || 0;
    const claimedOnResume = resumeSkills.has(ans.skill);
    totalScore += score;
    totalQuestions++;

    let status;
    if (claimedOnResume && score < STRONG_OVERCLAIM) {
      status = 'strong_overclaim';
      overclaimed.push({ skill: ans.skill, score, severity: 'strong' });
    } else if (claimedOnResume && score < OVERCLAIM_THRESHOLD) {
      status = 'overclaim';
      overclaimed.push({ skill: ans.skill, score, severity: 'moderate' });
    } else if (score >= VERIFIED_THRESHOLD) {
      status = 'verified';
      verified.push({ skill: ans.skill, score });
    } else {
      status = 'partial';
      partiallyVerified.push({ skill: ans.skill, score });
    }

    results.push({
      skill: ans.skill,
      score,
      status,
      claimedOnResume,
      type: ans.type,
    });
  }

  const overallScore = totalQuestions > 0 ? Math.round(totalScore / totalQuestions) : 0;

  // Calculate integrity score
  const overclaimCount = overclaimed.length;
  const strongCount = overclaimed.filter(o => o.severity === 'strong').length;
  let integrityScore = 100 - (overclaimCount * 15) - (strongCount * 10);
  integrityScore = Math.max(0, Math.min(100, integrityScore));

  // Risk level
  let riskLevel;
  if (strongCount >= 2 || overclaimCount >= 3) riskLevel = 'HIGH';
  else if (overclaimCount >= 2 || strongCount >= 1) riskLevel = 'MEDIUM';
  else if (overclaimCount >= 1) riskLevel = 'LOW';
  else riskLevel = 'NONE';

  // Build verdict
  let verdict;
  if (riskLevel === 'HIGH') {
    verdict = 'Multiple overclaimed skills detected. Resume may contain significant exaggerations. Recommend additional technical screening.';
  } else if (riskLevel === 'MEDIUM') {
    verdict = 'Some skills could not be verified at claimed level. Consider focused re-evaluation in flagged areas.';
  } else if (riskLevel === 'LOW') {
    verdict = 'Minor discrepancy detected. Overall profile appears genuine with minor gaps.';
  } else {
    verdict = 'Resume claims are consistent with demonstrated skill level. Candidate verified.';
  }

  return {
    success: true,
    overallScore,
    integrityScore,
    riskLevel,
    verdict,
    results,
    overclaimed_skills: overclaimed.map(o => o.skill),
    verified_skills: verified.map(v => v.skill),
    partially_verified: partiallyVerified.map(p => p.skill),
    summary: {
      total: totalQuestions,
      verified: verified.length,
      partial: partiallyVerified.length,
      overclaimed: overclaimed.length,
    },
  };
}

// ═══════════════════════════════════════════════════════════
//  FULL PIPELINE
// ═══════════════════════════════════════════════════════════

/**
 * Run full 3-layer verification pipeline
 * @param {string} resumeText - raw resume text
 * @param {string} jdText - raw JD text (optional)
 * @param {Object[]} assessmentAnswers - [{skill, score, type}] (optional)
 */
function runFullPipeline(resumeText, jdText = null, assessmentAnswers = null) {
  const resumeResult = parseResume(resumeText);

  let jdResult = null;
  let gapAnalysis = null;

  if (jdText) {
    jdResult = parseJD(jdText);
    gapAnalysis = analyzeGap(jdResult, resumeResult);
  }

  // Layer 1: Experience Gate
  const layer1 = jdResult
    ? experienceGate(jdResult, resumeResult)
    : { decision: 'PASS', reason: 'No JD provided for comparison', gap: null, jdYears: null, resumeYears: resumeResult.experience?.years };

  // Layer 2: Skill Proof Assessment
  let layer2 = null;
  if (jdResult && layer1.decision !== 'REJECT') {
    layer2 = generateAssessment(jdResult, resumeResult);
  } else if (!jdText) {
    // Generate assessment from resume skills alone
    const fakeJd = {
      skills: {
        all: resumeResult.skills?.technical?.slice(0, 8) || [],
        weighted: {},
      },
      experience: resumeResult.experience,
    };
    fakeJd.skills.all.forEach(s => { fakeJd.skills.weighted[s] = 'high'; });
    layer2 = generateAssessment(fakeJd, resumeResult);
  }

  // Layer 3: Overclaim Detection (only if answers provided)
  let layer3 = null;
  if (assessmentAnswers && assessmentAnswers.length > 0) {
    layer3 = analyzeOverclaims(assessmentAnswers, resumeResult);
  }

  return {
    resumeResult,
    jdResult,
    gapAnalysis,
    layer1,
    layer2,
    layer3,
    pipelineComplete: !!layer3,
  };
}

export {
  experienceGate,
  generateAssessment,
  analyzeOverclaims,
  runFullPipeline,
  QUESTION_BANK,
};

export default {
  experienceGate,
  generateAssessment,
  analyzeOverclaims,
  runFullPipeline,
  QUESTION_BANK,
};
