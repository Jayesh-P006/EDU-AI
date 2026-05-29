/**
 * Resume Parser Service — Node.js port of the Python AdvancedJDParser
 * Extracts skills, experience, education, contact info from raw text.
 */

// ═══════════════════════════════════════════════════════════════
//  SKILL TAXONOMY — Comprehensive mapping of keywords → canonical names
// ═══════════════════════════════════════════════════════════════

const SKILL_TAXONOMY={
  // Programming Languages
  python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript',
  java: 'Java', 'c++': 'C++', cpp: 'C++', 'c#': 'C#', csharp: 'C#',
  go: 'Go', golang: 'Go', rust: 'Rust', ruby: 'Ruby', php: 'PHP',
  swift: 'Swift', kotlin: 'Kotlin', scala: 'Scala',
  perl: 'Perl', haskell: 'Haskell', elixir: 'Elixir',
  dart: 'Dart', lua: 'Lua', matlab: 'MATLAB', julia: 'Julia',
  'objective-c': 'Objective-C', shell: 'Shell/Bash', bash: 'Shell/Bash',
  powershell: 'PowerShell', groovy: 'Groovy',
  'node.js': 'Node.js', nodejs: 'Node.js', 'node js': 'Node.js',
  // Frontend
  react: 'React', reactjs: 'React', 'react.js': 'React',
  angular: 'Angular', angularjs: 'Angular',
  vue: 'Vue.js', vuejs: 'Vue.js', 'vue.js': 'Vue.js',
  'next.js': 'Next.js', nextjs: 'Next.js',
  nuxt: 'Nuxt.js', svelte: 'Svelte', gatsby: 'Gatsby',
  jquery: 'jQuery',
  html: 'HTML/CSS', css: 'HTML/CSS', html5: 'HTML/CSS', css3: 'HTML/CSS',
  tailwind: 'Tailwind CSS', tailwindcss: 'Tailwind CSS',
  bootstrap: 'Bootstrap', 'material ui': 'Material UI',
  sass: 'SASS/SCSS', scss: 'SASS/SCSS',
  webpack: 'Webpack', vite: 'Vite',
  redux: 'Redux', mobx: 'MobX', zustand: 'Zustand',
  'd3': 'D3.js', 'd3.js': 'D3.js', 'three.js': 'Three.js',
  // Backend
  django: 'Django', flask: 'Flask', fastapi: 'FastAPI',
  express: 'Express.js', expressjs: 'Express.js', 'express.js': 'Express.js',
  nestjs: 'NestJS', 'nest.js': 'NestJS',
  spring: 'Spring Boot', 'spring boot': 'Spring Boot', springboot: 'Spring Boot',
  rails: 'Ruby on Rails', 'ruby on rails': 'Ruby on Rails',
  laravel: 'Laravel', symfony: 'Symfony',
  'asp.net': 'ASP.NET', '.net': '.NET', dotnet: '.NET',
  gin: 'Gin', fiber: 'Fiber',
  'koa': 'Koa.js', 'hapi': 'Hapi.js',
  // Databases
  sql: 'SQL', mysql: 'MySQL', postgresql: 'PostgreSQL', postgres: 'PostgreSQL',
  mongodb: 'MongoDB', mongo: 'MongoDB',
  redis: 'Redis', memcached: 'Memcached', elasticsearch: 'Elasticsearch',
  dynamodb: 'DynamoDB', cassandra: 'Cassandra',
  sqlite: 'SQLite', oracle: 'Oracle DB',
  mariadb: 'MariaDB', neo4j: 'Neo4j',
  firebase: 'Firebase', firestore: 'Firestore',
  supabase: 'Supabase', prisma: 'Prisma',
  database: 'Databases', databases: 'Databases',
  nosql: 'NoSQL', rdbms: 'RDBMS',
  'sql server': 'SQL Server', mssql: 'SQL Server',
  // Cloud
  aws: 'AWS', 'amazon web services': 'AWS',
  azure: 'Azure', 'microsoft azure': 'Azure',
  gcp: 'Google Cloud', 'google cloud': 'Google Cloud',
  heroku: 'Heroku', vercel: 'Vercel', netlify: 'Netlify',
  digitalocean: 'DigitalOcean', cloudflare: 'Cloudflare',
  ec2: 'AWS EC2', s3: 'AWS S3', lambda: 'AWS Lambda',
  sqs: 'AWS SQS', ecs: 'AWS ECS', rds: 'AWS RDS',
  // DevOps
  docker: 'Docker', kubernetes: 'Kubernetes', k8s: 'Kubernetes',
  terraform: 'Terraform', ansible: 'Ansible',
  jenkins: 'Jenkins', circleci: 'CircleCI',
  'ci/cd': 'CI/CD', cicd: 'CI/CD', 'ci cd': 'CI/CD',
  devops: 'DevOps', sre: 'SRE',
  'github actions': 'GitHub Actions', 'gitlab ci': 'GitLab CI',
  argocd: 'ArgoCD', helm: 'Helm',
  prometheus: 'Prometheus', grafana: 'Grafana',
  datadog: 'Datadog', splunk: 'Splunk', elk: 'ELK Stack',
  nginx: 'Nginx', apache: 'Apache HTTP',
  serverless: 'Serverless', cloudformation: 'CloudFormation',
  // AI/ML
  'machine learning': 'Machine Learning', ml: 'Machine Learning',
  'deep learning': 'Deep Learning', 'artificial intelligence': 'AI',
  tensorflow: 'TensorFlow', pytorch: 'PyTorch', torch: 'PyTorch',
  'scikit-learn': 'Scikit-learn', sklearn: 'Scikit-learn',
  keras: 'Keras', xgboost: 'XGBoost', lightgbm: 'LightGBM',
  nlp: 'NLP', 'natural language processing': 'NLP',
  'computer vision': 'Computer Vision', opencv: 'OpenCV',
  pandas: 'Pandas', numpy: 'NumPy', scipy: 'SciPy',
  matplotlib: 'Matplotlib', seaborn: 'Seaborn', plotly: 'Plotly',
  jupyter: 'Jupyter',
  llm: 'LLMs', 'large language model': 'LLMs',
  'generative ai': 'Generative AI', 'gen ai': 'Generative AI',
  openai: 'OpenAI', chatgpt: 'ChatGPT/OpenAI',
  transformers: 'Transformers', bert: 'BERT', gpt: 'GPT',
  'hugging face': 'Hugging Face', huggingface: 'Hugging Face',
  langchain: 'LangChain', llamaindex: 'LlamaIndex',
  rag: 'RAG', 'reinforcement learning': 'Reinforcement Learning',
  'neural network': 'Neural Networks', cnn: 'CNN', rnn: 'RNN', lstm: 'LSTM', gan: 'GANs',
  mlops: 'MLOps', mlflow: 'MLflow',
  // Data Engineering
  etl: 'ETL', elt: 'ELT',
  'data pipeline': 'Data Pipelines', 'data pipelines': 'Data Pipelines',
  spark: 'Apache Spark', 'apache spark': 'Apache Spark', pyspark: 'PySpark',
  hadoop: 'Hadoop', hive: 'Hive',
  airflow: 'Apache Airflow', 'apache airflow': 'Apache Airflow',
  'data warehouse': 'Data Warehousing',
  snowflake: 'Snowflake', bigquery: 'BigQuery',
  redshift: 'Redshift', databricks: 'Databricks',
  dbt: 'dbt', 'data modeling': 'Data Modeling', 'data lake': 'Data Lake',
  // Architecture
  'system design': 'System Design', 'software architecture': 'Software Architecture',
  microservices: 'Microservices',
  api: 'APIs', apis: 'APIs',
  rest: 'REST APIs', restful: 'REST APIs', 'rest api': 'REST APIs',
  graphql: 'GraphQL', grpc: 'gRPC',
  websocket: 'WebSockets', websockets: 'WebSockets',
  'design patterns': 'Design Patterns', solid: 'SOLID Principles',
  'distributed systems': 'Distributed Systems',
  'event driven': 'Event-Driven Architecture', 'event-driven': 'Event-Driven Architecture',
  cqrs: 'CQRS', ddd: 'DDD',
  'message queue': 'Message Queues',
  rabbitmq: 'RabbitMQ', kafka: 'Apache Kafka', 'apache kafka': 'Apache Kafka',
  celery: 'Celery', 'pub/sub': 'Pub/Sub',
  // Testing
  testing: 'Testing', 'unit testing': 'Unit Testing',
  'integration testing': 'Integration Testing', 'e2e testing': 'E2E Testing',
  jest: 'Jest', mocha: 'Mocha', pytest: 'Pytest', selenium: 'Selenium',
  cypress: 'Cypress', playwright: 'Playwright',
  tdd: 'TDD', bdd: 'BDD', postman: 'Postman', jmeter: 'JMeter',
  // Security
  security: 'Security', cybersecurity: 'Cybersecurity',
  oauth: 'OAuth', jwt: 'JWT',
  authentication: 'Authentication', authorization: 'Authorization',
  sso: 'SSO', encryption: 'Encryption',
  ssl: 'SSL/TLS', tls: 'SSL/TLS',
  owasp: 'OWASP', iam: 'IAM', rbac: 'RBAC',
  gdpr: 'GDPR', hipaa: 'HIPAA',
  // Mobile
  'react native': 'React Native', flutter: 'Flutter',
  ios: 'iOS Development', android: 'Android Development',
  mobile: 'Mobile Development',
  swiftui: 'SwiftUI', 'jetpack compose': 'Jetpack Compose',
  // Tools
  git: 'Git', github: 'GitHub', gitlab: 'GitLab', bitbucket: 'Bitbucket',
  jira: 'Jira', confluence: 'Confluence',
  figma: 'Figma', sketch: 'Sketch',
  linux: 'Linux', unix: 'Unix/Linux',
  swagger: 'Swagger/OpenAPI', openapi: 'Swagger/OpenAPI',
  // Practices
  agile: 'Agile', scrum: 'Scrum', kanban: 'Kanban',
  oop: 'OOP', 'object oriented': 'OOP',
  'functional programming': 'Functional Programming',
  'clean code': 'Clean Code', 'clean architecture': 'Clean Architecture',
  'code review': 'Code Review', documentation: 'Documentation',
  // Soft Skills
  communication: 'Communication', leadership: 'Leadership',
  'problem solving': 'Problem Solving', 'problem-solving': 'Problem Solving',
  teamwork: 'Teamwork', collaboration: 'Collaboration',
  'project management': 'Project Management',
  mentoring: 'Mentoring', mentorship: 'Mentoring',
  'time management': 'Time Management', 'critical thinking': 'Critical Thinking',
  'stakeholder management': 'Stakeholder Management',
  'cross functional': 'Cross-functional Collaboration',
  'cross-functional': 'Cross-functional Collaboration',
};

const SOFT_SKILLS_SET=new Set([
  'Communication', 'Leadership', 'Problem Solving', 'Teamwork',
  'Collaboration', 'Project Management', 'Mentoring',
  'Time Management', 'Critical Thinking', 'Presentation Skills',
  'Stakeholder Management', 'Cross-functional Collaboration',
]);

const SKILL_CATEGORIES={
  'Programming Languages': ['Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'Dart', 'MATLAB', 'Julia', 'Shell/Bash', 'PowerShell'],
  'Frontend': ['React', 'Angular', 'Vue.js', 'Next.js', 'Svelte', 'jQuery', 'HTML/CSS', 'Tailwind CSS', 'Bootstrap', 'SASS/SCSS', 'Redux', 'D3.js'],
  'Backend': ['Node.js', 'Express.js', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'NestJS', 'Ruby on Rails', 'Laravel', '.NET', 'ASP.NET'],
  'Databases': ['SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB', 'Cassandra', 'SQLite', 'Firebase', 'Prisma', 'SQL Server'],
  'Cloud & DevOps': ['AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'GitHub Actions', 'Jenkins', 'Nginx', 'Serverless'],
  'AI & Data': ['Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'NLP', 'Computer Vision', 'Pandas', 'NumPy', 'LLMs', 'Generative AI', 'LangChain', 'RAG'],
  'Architecture': ['System Design', 'Microservices', 'REST APIs', 'GraphQL', 'gRPC', 'WebSockets', 'Design Patterns', 'Distributed Systems', 'Apache Kafka'],
  'Testing & Security': ['Testing', 'Jest', 'Cypress', 'Selenium', 'TDD', 'Security', 'OAuth', 'JWT', 'OWASP'],
};

// ═══════════════════════════════════════════════════════════════
//  EXPERIENCE PATTERNS
// ═══════════════════════════════════════════════════════════════

const EXPERIENCE_PATTERNS=[
  {regex: /(\d+)\+?\s*(?:to|-)\s*(\d+)\s*(?:years?|yrs?)/gi, type: 'range'},
  {regex: /(\d+)\+\s*(?:years?|yrs?)/gi, type: 'min'},
  {regex: /(?:at\s*least|minimum|min)\s*(\d+)\s*(?:years?|yrs?)/gi, type: 'min'},
  {regex: /(\d+)\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)/gi, type: 'exact'},
  {regex: /(?:experience|exp)\s*(?:of)?\s*(\d+)\s*(?:years?|yrs?)/gi, type: 'exact'},
];

const SENIORITY_KEYWORDS={
  intern: 'Intern (0 years)', internship: 'Intern (0 years)',
  fresher: 'Entry Level (0-1 years)', 'entry level': 'Entry Level (0-1 years)',
  'entry-level': 'Entry Level (0-1 years)',
  junior: 'Junior (1-3 years)', jr: 'Junior (1-3 years)',
  'mid level': 'Mid-Level (3-5 years)', 'mid-level': 'Mid-Level (3-5 years)',
  senior: 'Senior (5-8 years)', sr: 'Senior (5-8 years)',
  lead: 'Lead (8-10 years)', 'tech lead': 'Lead (8-10 years)',
  staff: 'Staff (8-12 years)', principal: 'Principal (10+ years)',
  architect: 'Architect (10+ years)', director: 'Director (12+ years)',
};

const EDUCATION_PATTERNS={
  phd: 'PhD', 'ph.d': 'PhD', doctorate: 'PhD',
  master: "Master's", masters: "Master's", 'm.s.': "Master's",
  'm.sc': "Master's", mtech: 'M.Tech', 'm.tech': 'M.Tech', mba: 'MBA',
  bachelor: "Bachelor's", bachelors: "Bachelor's",
  'b.s.': "Bachelor's", 'b.sc': "Bachelor's",
  btech: 'B.Tech', 'b.tech': 'B.Tech', 'b.e.': 'B.E.',
  diploma: 'Diploma',
  'computer science': 'Computer Science',
  'information technology': 'Information Technology',
  'software engineering': 'Software Engineering',
  'data science': 'Data Science',
  mathematics: 'Mathematics', statistics: 'Statistics',
};

// ═══════════════════════════════════════════════════════════════
//  PARSER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Extract skills from text
 */
function extractSkills(text)
{
  const lower=text.toLowerCase();
  const found=new Map(); // canonical → count

  // Sort keys by length (descending) so longer matches take precedence
  const sortedKeys=Object.keys(SKILL_TAXONOMY).sort((a, b) => b.length-a.length);

  for (const key of sortedKeys)
  {
    const canonical=SKILL_TAXONOMY[key];
    if (found.has(canonical)) continue; // already found via longer key

    // Use word boundary matching
    const escaped=key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex=new RegExp(`(?:^|[\\s,;|/()\\[\\]])${escaped}(?:[\\s,;|/()\\[\\]]|$)`, 'i');
    if (regex.test(lower))
    {
      found.set(canonical, true);
    }
  }

  const technical=[];
  const soft=[];
  for (const skill of found.keys())
  {
    if (SOFT_SKILLS_SET.has(skill))
    {
      soft.push(skill);
    } else
    {
      technical.push(skill);
    }
  }

  // Categorize technical skills
  const categorized={};
  for (const [category, categorySkills] of Object.entries(SKILL_CATEGORIES))
  {
    const matched=technical.filter(s => categorySkills.includes(s));
    if (matched.length>0) categorized[category]=matched;
  }

  return {technical, soft, categorized, all: [...technical, ...soft]};
}

/**
 * Extract candidate contact information
 */
function extractCandidateInfo(text)
{
  const info={name: '', email: '', phone: '', linkedin: '', github: '', portfolio: ''};

  // Name: first non-empty line (heuristic)
  const lines=text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length>0)
  {
    const firstLine=lines[0];
    // If first line doesn't look like email/phone/url, it's likely the name
    if (!firstLine.includes('@')&&!firstLine.match(/^\+?\d/)&&!firstLine.match(/^http/i))
    {
      info.name=firstLine;
    }
  }

  // Email
  const emailMatch=text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) info.email=emailMatch[0];

  // Phone
  const phoneMatch=text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) info.phone=phoneMatch[0];

  // LinkedIn
  const linkedinMatch=text.match(/(?:linkedin\.com\/in\/|linkedin:\s*)([\w-]+)/i);
  if (linkedinMatch) info.linkedin=`linkedin.com/in/${linkedinMatch[1]}`;

  // GitHub
  const githubMatch=text.match(/(?:github\.com\/|github:\s*)([\w-]+)/i);
  if (githubMatch) info.github=`github.com/${githubMatch[1]}`;

  // Portfolio
  const portfolioMatch=text.match(/(?:portfolio|website|site)[\s:]*(?:https?:\/\/)?([^\s]+)/i);
  if (portfolioMatch) info.portfolio=portfolioMatch[1];

  return info;
}

/**
 * Extract experience (years)
 */
function extractExperience(text)
{
  const lower=text.toLowerCase();
  const result={years: null, range: null, seniority: null, raw: []};

  // Experience patterns
  for (const {regex, type} of EXPERIENCE_PATTERNS)
  {
    const re=new RegExp(regex.source, regex.flags);
    let match;
    while ((match=re.exec(lower))!==null)
    {
      if (type==='range')
      {
        const min=parseInt(match[1]);
        const max=parseInt(match[2]);
        result.range={min, max};
        result.years=result.years||max;
        result.raw.push(`${min}-${max} years`);
      } else if (type==='min')
      {
        const val=parseInt(match[1]);
        result.years=result.years||val;
        result.raw.push(`${val}+ years`);
      } else
      {
        const val=parseInt(match[1]);
        result.years=result.years||val;
        result.raw.push(`${val} years`);
      }
    }
  }

  // Seniority keywords
  for (const [keyword, level] of Object.entries(SENIORITY_KEYWORDS))
  {
    if (lower.includes(keyword))
    {
      result.seniority=level;
      break;
    }
  }

  return result;
}

/**
 * Extract education
 */
function extractEducation(text)
{
  const lower=text.toLowerCase();
  const found=[];
  for (const [keyword, label] of Object.entries(EDUCATION_PATTERNS))
  {
    if (lower.includes(keyword)&&!found.includes(label))
    {
      found.push(label);
    }
  }
  return found;
}

/**
 * Extract role/title
 */
function extractRole(text)
{
  const lower=text.toLowerCase();
  const rolePatterns=[
    /(?:job\s*title|position|role)\s*[:\-–]\s*(.+)/i,
    /(?:looking for|hiring|seeking)\s*(?:a|an)?\s*(.+?)(?:\.|$)/i,
  ];

  for (const pattern of rolePatterns)
  {
    const match=text.match(pattern);
    if (match)
    {
      return {title: match[1].trim().substring(0, 80), matched: true};
    }
  }

  // Fallback: look for common titles
  const titles=[
    'Senior Backend Engineer', 'Frontend Developer', 'Full Stack Developer',
    'Backend Developer', 'Software Engineer', 'Data Scientist', 'DevOps Engineer',
    'Machine Learning Engineer', 'Product Manager', 'Engineering Manager',
    'Staff Engineer', 'Principal Engineer', 'Solutions Architect',
  ];
  for (const title of titles)
  {
    if (lower.includes(title.toLowerCase()))
    {
      return {title, matched: true};
    }
  }

  return {title: 'Software Developer', matched: false};
}

/**
 * Parse resume text into structured data
 */
function parseResume(text)
{
  if (!text||!text.trim())
  {
    return {success: false, error: 'No text provided'};
  }

  const candidate=extractCandidateInfo(text);
  const skills=extractSkills(text);
  const experience=extractExperience(text);
  const education=extractEducation(text);
  const role=extractRole(text);

  // Calculate ATS score
  const atsScore=calculateATSScore({candidate, skills, experience, education, text});

  return {
    success: true,
    candidate,
    skills,
    experience,
    education,
    role,
    atsScore,
    wordCount: text.split(/\s+/).length,
    charCount: text.length,
  };
}

/**
 * Parse JD text into structured data
 */
function parseJD(text)
{
  if (!text||!text.trim())
  {
    return {success: false, error: 'No text provided'};
  }

  const role=extractRole(text);
  const skills=extractSkillsWeighted(text);
  const experience=extractExperience(text);
  const education=extractEducation(text);

  return {
    success: true,
    role,
    skills,
    experience,
    education,
    wordCount: text.split(/\s+/).length,
  };
}

/**
 * Extract skills with priority weighting (for JDs)
 */
function extractSkillsWeighted(text)
{
  const lower=text.toLowerCase();
  const skills=extractSkills(text);

  const HIGH_SIGNALS=[
    'must have', 'required', 'essential', 'mandatory', 'strong',
    'expert', 'proficient', 'deep knowledge', 'extensive experience',
    'core', 'critical', 'key requirement', 'fundamental', 'proven',
    'demonstrated', 'advanced', 'significant experience',
    'production experience', 'hands-on experience', 'solid',
  ];
  const MEDIUM_SIGNALS=[
    'preferred', 'good to have', 'should have', 'important',
    'familiar', 'working knowledge', 'solid understanding',
    'comfortable with', 'hands-on', 'understanding of',
  ];
  const LOW_SIGNALS=[
    'nice to have', 'bonus', 'plus', 'optional', 'additionally',
    'ideally', 'desirable', 'advantageous', 'exposure to',
    'basic knowledge', 'awareness', 'interest in',
  ];

  const weighted={};
  for (const skill of skills.all)
  {
    // Find context around skill mention
    const skillLower=skill.toLowerCase();
    const idx=lower.indexOf(skillLower);
    const context=idx>=0? lower.substring(Math.max(0, idx-100), Math.min(lower.length, idx+100)):'';

    let priority='medium';
    if (HIGH_SIGNALS.some(s => context.includes(s))) priority='high';
    else if (LOW_SIGNALS.some(s => context.includes(s))) priority='low';
    else if (MEDIUM_SIGNALS.some(s => context.includes(s))) priority='medium';

    weighted[skill]=priority;
  }

  return {...skills, weighted};
}

/**
 * Perform gap analysis between JD and Resume
 */
function analyzeGap(jdResult, resumeResult)
{
  if (!jdResult?.success||!resumeResult?.success)
  {
    return {success: false, error: 'Invalid JD or Resume data'};
  }

  const jdSkills=new Set(jdResult.skills.all||[]);
  const resumeSkills=new Set(resumeResult.skills.all||[]);

  const matched=[...jdSkills].filter(s => resumeSkills.has(s));
  const missing=[...jdSkills].filter(s => !resumeSkills.has(s));
  const extra=[...resumeSkills].filter(s => !jdSkills.has(s));

  const matchPercentage=jdSkills.size>0
    ? Math.round((matched.length/jdSkills.size)*100)
    :0;

  // Separate missing by priority
  const criticalMissing=missing.filter(s => (jdResult.skills.weighted?.[s]||'medium')==='high');
  const niceMissing=missing.filter(s => (jdResult.skills.weighted?.[s]||'medium')==='low');
  const otherMissing=missing.filter(s => !criticalMissing.includes(s)&&!niceMissing.includes(s));

  // Experience gap
  let experienceMatch='unknown';
  const jdYears=jdResult.experience?.years;
  const resYears=resumeResult.experience?.years;
  if (jdYears!=null&&resYears!=null)
  {
    if (resYears>=jdYears) experienceMatch='meets';
    else if (resYears>=jdYears-2) experienceMatch='close';
    else experienceMatch='gap';
  }

  return {
    success: true,
    matchPercentage,
    matched,
    missing: {critical: criticalMissing, medium: otherMissing, nice: niceMissing},
    extra,
    experienceMatch,
    jdYears,
    resumeYears: resYears,
    totalJDSkills: jdSkills.size,
    totalResumeSkills: resumeSkills.size,
  };
}

/**
 * Calculate ATS resume score (0-100)
 */
function calculateATSScore({candidate, skills, experience, education, text})
{
  let score=0;

  // Contact info completeness (max 15)
  if (candidate.name) score+=3;
  if (candidate.email) score+=3;
  if (candidate.phone) score+=3;
  if (candidate.linkedin) score+=3;
  if (candidate.github) score+=3;

  // Skills section (max 30)
  const techCount=skills.technical?.length||0;
  score+=Math.min(techCount*2, 25);
  if (skills.soft?.length>0) score+=5;

  // Experience (max 20)
  if (experience.years)
  {
    score+=Math.min(experience.years*2, 15);
  }
  if (experience.seniority) score+=5;

  // Education (max 15)
  if (education.length>0) score+=10;
  if (education.length>1) score+=5;

  // Content quality (max 20)
  const wordCount=text.split(/\s+/).length;
  if (wordCount>=200) score+=5;
  if (wordCount>=400) score+=5;
  if (text.toLowerCase().includes('project')) score+=3;
  if (text.toLowerCase().includes('achievement')||text.toLowerCase().includes('accomplished')||text.toLowerCase().includes('developed')) score+=3;
  if (text.toLowerCase().includes('certified')||text.toLowerCase().includes('certification')) score+=4;

  return Math.min(score, 100);
}

/**
 * Extract CGPA / GPA from text
 */
function extractCGPA(text)
{
  const patterns=[
    /(?:cgpa|cpi|gpa|grade\s*point)\s*[:\-–]?\s*(\d+\.?\d*)\s*(?:\/\s*(\d+\.?\d*))?/gi,
    /(\d+\.?\d*)\s*(?:\/\s*(\d+\.?\d*))?\s*(?:cgpa|cpi|gpa)/gi,
    /(?:cgpa|cpi|gpa|grade)\s*[:\-–]?\s*(\d+\.?\d*)\s*(?:out\s*of\s*(\d+\.?\d*))?/gi,
    /(?:cumulative|overall)\s*(?:grade|gpa|cgpa|cpi)\s*[:\-–]?\s*(\d+\.?\d*)\s*(?:\/\s*(\d+\.?\d*))?/gi,
    /(\d+\.?\d*)\s*\/\s*(10|4\.?0?)\s*(?:gpa|cgpa|cpi)?/gi,
  ];

  let bestCGPA=0;
  let scale=10;

  for (const pattern of patterns)
  {
    const re=new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match=re.exec(text))!==null)
    {
      const val=parseFloat(match[1]);
      const maxScale=match[2]? parseFloat(match[2]):null;

      if (maxScale)
      {
        scale=maxScale;
      }

      // Normalize to 10-point scale
      let normalized=val;
      if (maxScale&&maxScale<=5)
      {
        normalized=(val/maxScale)*10;
      } else if (val<=4.5&&!maxScale)
      {
        // Likely 4.0 GPA scale
        normalized=(val/4.0)*10;
        scale=4;
      }

      // Validate: CGPA should be reasonable
      if (val>0&&val<=(maxScale||10)&&normalized>bestCGPA)
      {
        bestCGPA=normalized;
      }
    }
  }

  return {
    cgpa: bestCGPA>0? Math.round(bestCGPA*100)/100:0,
    raw: bestCGPA>0? bestCGPA:0,
    scale,
  };
}

/**
 * Extract projects from resume text
 */
function extractProjects(text)
{
  const projects=[];
  const lower=text.toLowerCase();

  // Try to find project section
  const projectSectionPatterns=[
    /(?:projects?|personal\s*projects?|academic\s*projects?|key\s*projects?)[\s:]*\n([\s\S]*?)(?=\n\s*(?:education|experience|work|skills|certifications?|achievements?|awards?|publications?|references?|hobbies|interests|languages?|$))/gi,
    /(?:projects?)[\s]*[-–:]?\s*\n([\s\S]*?)(?=\n\s*\n\s*[A-Z])/gi,
  ];

  let projectText='';
  for (const pattern of projectSectionPatterns)
  {
    const match=new RegExp(pattern.source, pattern.flags).exec(text);
    if (match)
    {
      projectText=match[1]||match[0];
      break;
    }
  }

  if (!projectText)
  {
    // Fallback: look for project-like entries anywhere
    projectText=text;
  }

  // Extract individual projects
  const projectPatterns=[
    /(?:^|\n)\s*(?:•|[-–*]|(?:\d+[.)]))?\s*([A-Z][^\n]{5,80})(?:\n(?:(?!(?:•|[-–*]|\d+[.)])\s)[^\n]+\n?)*)/gm,
  ];

  // Simple extraction: find lines that look like project titles
  const lines=projectText.split('\n');
  let currentProject=null;

  for (const line of lines)
  {
    const trimmed=line.trim();
    if (!trimmed) continue;

    // Check if this is a project title (starts with bullet or is short and capitalized)
    const isTitleLine=(
      /^(?:•|[-–*]|\d+[.)])/.test(trimmed)||
      (trimmed.length<100&&/^[A-Z]/.test(trimmed)&&!trimmed.includes(':')&&trimmed.split(' ').length<=10)
    );

    if (isTitleLine&&trimmed.length>5)
    {
      if (currentProject)
      {
        projects.push(currentProject);
      }
      currentProject={
        name: trimmed.replace(/^(?:•|[-–*]|\d+[.)])\s*/, '').trim(),
        description: '',
        technologies: [],
        relevanceScore: 0,
      };
    } else if (currentProject)
    {
      currentProject.description+=(currentProject.description? ' ':'')+trimmed;
    }
  }
  if (currentProject)
  {
    projects.push(currentProject);
  }

  // Extract technologies for each project
  for (const project of projects)
  {
    const fullText=`${project.name} ${project.description}`;
    const skills=extractSkills(fullText);
    project.technologies=skills.technical.slice(0, 10);

    // Score based on tech count and description quality
    project.relevanceScore=Math.min(
      (project.technologies.length*10)+
      (project.description.length>50? 15:5)+
      (fullText.toLowerCase().includes('built')||fullText.toLowerCase().includes('developed')||fullText.toLowerCase().includes('created')? 10:0),
      100
    );
  }

  return projects.slice(0, 10); // max 10 projects
}

/**
 * Calculate ATS match score against a job (resume vs JD matching)
 */
function calculateJobMatchScore({resumeResult, job, candidateCGPA=0})
{
  const jobSkills=new Set((job.skills||[]).map(s => s.toLowerCase()));
  const requiredSkills=new Set((job.eligibilityCriteria?.requiredSkills||[]).map(s => s.toLowerCase()));
  const preferredSkills=new Set((job.eligibilityCriteria?.preferredSkills||[]).map(s => s.toLowerCase()));
  const allJobSkills=new Set([...jobSkills, ...requiredSkills, ...preferredSkills]);

  const resumeSkills=new Set((resumeResult?.skills?.all||[]).map(s => s.toLowerCase()));

  // Skill matching
  const matched=[...allJobSkills].filter(s =>
  {
    // Check direct match
    if (resumeSkills.has(s)) return true;
    // Check if resume has a skill that matches taxonomy
    for (const rs of resumeSkills)
    {
      if (rs.includes(s)||s.includes(rs)) return true;
    }
    return false;
  });
  const missing=[...allJobSkills].filter(s => !matched.includes(s));

  const skillMatchPercent=allJobSkills.size>0
    ? Math.round((matched.length/allJobSkills.size)*100):100;

  // Required skills match (critical)
  const requiredMatched=requiredSkills.size>0
    ? [...requiredSkills].filter(s => matched.includes(s)).length:0;
  const requiredMatchPercent=requiredSkills.size>0
    ? Math.round((requiredMatched/requiredSkills.size)*100):100;

  // Calculate composite ATS score
  let atsScore=0;

  // Skill match weight: 40%
  atsScore+=skillMatchPercent*0.40;

  // Required skills weight: 25%
  atsScore+=requiredMatchPercent*0.25;

  // Resume quality (existing ATS score): 15%
  const resumeATS=resumeResult?.atsScore||0;
  atsScore+=(resumeATS/100)*15;

  // CGPA weight: 10%
  const minCGPA=job.eligibilityCriteria?.minCGPA||0;
  if (minCGPA>0&&candidateCGPA>0)
  {
    const cgpaPercent=Math.min((candidateCGPA/10)*100, 100);
    atsScore+=cgpaPercent*0.10;
  } else
  {
    atsScore+=10; // full points if no CGPA criteria
  }

  // Experience weight: 10%
  const resYears=resumeResult?.experience?.years||0;
  const minExp=job.eligibilityCriteria?.minExperience||0;
  if (minExp>0)
  {
    const expPercent=Math.min((resYears/minExp)*100, 100);
    atsScore+=expPercent*0.10;
  } else
  {
    atsScore+=10;
  }

  atsScore=Math.round(Math.min(atsScore, 100));

  // Eligibility check
  const eligibilityReasons=[];
  let eligible=true;

  // Check required skills
  if (requiredSkills.size>0&&requiredMatchPercent<50)
  {
    eligible=false;
    eligibilityReasons.push(`Missing critical skills: ${[...requiredSkills].filter(s => !matched.includes(s)).join(', ')}`);
  }

  // Check CGPA
  if (minCGPA>0&&candidateCGPA>0&&candidateCGPA<minCGPA)
  {
    eligible=false;
    eligibilityReasons.push(`CGPA ${candidateCGPA} below minimum ${minCGPA}`);
  }

  // Check experience
  if (minExp>0&&resYears<minExp)
  {
    const maxExp=job.eligibilityCriteria?.maxExperience||0;
    if (maxExp>0&&resYears>maxExp)
    {
      eligibilityReasons.push(`Experience ${resYears}yrs exceeds max ${maxExp}yrs`);
    } else if (resYears<minExp)
    {
      eligibilityReasons.push(`Experience ${resYears}yrs below minimum ${minExp}yrs`);
    }
  }

  // Canonical names for matched/missing
  const matchedCanonical=matched.map(s =>
  {
    const found=(resumeResult?.skills?.all||[]).find(rs => rs.toLowerCase()===s);
    return found||s;
  });
  const missingCanonical=missing.map(s =>
  {
    const found=[...(job.skills||[]), ...(job.eligibilityCriteria?.requiredSkills||[]), ...(job.eligibilityCriteria?.preferredSkills||[])].find(js => js.toLowerCase()===s);
    return found||s;
  });

  return {
    atsScore,
    skillMatchScore: skillMatchPercent,
    matchedSkills: matchedCanonical,
    missingSkills: missingCanonical,
    eligible,
    eligibilityReasons,
    experienceYears: resYears,
    cgpa: candidateCGPA,
    breakdown: {
      skillMatch: Math.round(skillMatchPercent*0.40),
      requiredSkillMatch: Math.round(requiredMatchPercent*0.25),
      resumeQuality: Math.round((resumeATS/100)*15),
      cgpaScore: minCGPA>0? Math.round(Math.min((candidateCGPA/10)*100, 100)*0.10):10,
      experienceScore: minExp>0? Math.round(Math.min((resYears/minExp)*100, 100)*0.10):10,
    },
  };
}

export
{
  SKILL_TAXONOMY,
  SKILL_CATEGORIES,
  SOFT_SKILLS_SET,
  extractSkills,
  extractCandidateInfo,
  extractExperience,
  extractEducation,
  extractRole,
  extractSkillsWeighted,
  extractCGPA,
  extractProjects,
  parseResume,
  parseJD,
  analyzeGap,
  calculateATSScore,
  calculateJobMatchScore,
};

export default {
  parseResume,
  parseJD,
  analyzeGap,
  calculateJobMatchScore,
  extractCGPA,
  extractProjects,
  SKILL_TAXONOMY,
  SKILL_CATEGORIES,
};
