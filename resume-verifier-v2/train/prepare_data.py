"""
Generates 1000+ training examples for the resume verifier model.
Covers claim extraction and authenticity analysis across many domains and tech stacks.

Run:  python train/prepare_data.py
Out:  train/training_data.jsonl
"""

import json
import random
from pathlib import Path

random.seed(42)

# ══════════════════════════════════════════════════════════════════════════════
# TECHNOLOGY POOLS
# ══════════════════════════════════════════════════════════════════════════════

FRONTEND = [
    "React", "Next.js", "Vue.js", "Nuxt.js", "Angular", "Svelte", "SvelteKit",
    "Gatsby", "Remix", "Astro", "Solid.js", "Preact", "Lit", "Alpine.js",
    "Redux", "Zustand", "Pinia", "Recoil", "Jotai", "MobX", "Valtio",
    "TailwindCSS", "Chakra UI", "Material UI", "Ant Design", "Shadcn/UI",
    "Styled Components", "Emotion", "SCSS", "Bootstrap", "Framer Motion",
    "React Query", "SWR", "Apollo Client", "TRPC", "Axios",
    "Vite", "Webpack", "Turbopack", "Rollup", "esbuild",
    "TypeScript", "JavaScript", "HTML5", "CSS3",
]

BACKEND = [
    "Node.js", "Express.js", "NestJS", "Fastify", "Hapi.js", "Koa",
    "FastAPI", "Django", "Flask", "Starlette", "Tornado", "Sanic",
    "Spring Boot", "Spring MVC", "Micronaut", "Quarkus", "Ktor",
    "Ruby on Rails", "Sinatra", "Laravel", "Symfony", "CodeIgniter",
    "Go/Gin", "Go/Echo", "Go/Fiber", "Go/Chi",
    "Rust/Actix", "Rust/Axum", "Rust/Rocket",
    "ASP.NET Core", "Minimal API", "gRPC",
    "GraphQL", "REST API", "WebSocket", "Socket.IO", "Server-Sent Events",
]

DATABASE = [
    "PostgreSQL", "MySQL", "SQLite", "MariaDB", "CockroachDB", "TimescaleDB",
    "MongoDB", "DynamoDB", "Firestore", "CouchDB", "RavenDB",
    "Redis", "Memcached", "KeyDB",
    "Elasticsearch", "OpenSearch", "Solr",
    "Cassandra", "ScyllaDB", "HBase",
    "Neo4j", "ArangoDB", "FaunaDB",
    "Supabase", "PlanetScale", "Neon", "Turso",
    "SQLAlchemy", "Prisma", "TypeORM", "Drizzle ORM", "Sequelize",
    "Mongoose", "Hibernate", "GORM",
]

AUTH = [
    "JWT", "OAuth2", "OpenID Connect", "SAML", "Passport.js", "Auth0",
    "Keycloak", "Firebase Auth", "Cognito", "Okta", "Clerk",
    "NextAuth.js", "Lucia", "Better Auth",
    "RBAC", "ABAC", "rate limiting", "session management",
    "bcrypt", "Argon2", "TOTP", "2FA", "MFA",
    "API key auth", "mTLS", "SSL/TLS",
]

DEVOPS = [
    "Docker", "Docker Compose", "Podman", "Buildah",
    "Kubernetes", "Helm", "Kustomize", "ArgoCD", "Flux",
    "AWS", "GCP", "Azure", "DigitalOcean", "Hetzner", "Railway", "Fly.io",
    "Terraform", "Pulumi", "Ansible", "Chef", "Puppet",
    "GitHub Actions", "GitLab CI", "Jenkins", "CircleCI", "Drone CI", "Tekton",
    "Nginx", "Caddy", "Traefik", "HAProxy",
    "Prometheus", "Grafana", "Loki", "Tempo", "Jaeger", "OpenTelemetry",
    "ELK Stack", "Datadog", "Sentry", "New Relic",
    "CDN", "CloudFront", "Cloudflare", "Vercel", "Netlify",
]

MESSAGING = [
    "RabbitMQ", "Apache Kafka", "NATS", "Redis Pub/Sub",
    "AWS SQS", "AWS SNS", "Google Pub/Sub", "Azure Service Bus",
    "Celery", "BullMQ", "Sidekiq", "Temporal", "Inngest",
    "WebRTC", "MQTT", "AMQP",
]

AI_ML = [
    "PyTorch", "TensorFlow", "JAX", "scikit-learn", "XGBoost", "LightGBM",
    "Hugging Face Transformers", "OpenAI API", "Anthropic API", "Gemini API",
    "LangChain", "LangGraph", "LlamaIndex", "Haystack", "CrewAI",
    "Pinecone", "ChromaDB", "Weaviate", "Qdrant", "Milvus", "FAISS",
    "RAG", "vector search", "embeddings", "LLM integration",
    "Ollama", "vLLM", "llama.cpp", "ONNX Runtime",
    "OpenCV", "MediaPipe", "YOLOv8", "Stable Diffusion",
    "MLflow", "Weights & Biases", "DVC", "BentoML", "Triton",
]

TESTING = [
    "Jest", "Vitest", "Mocha", "Chai", "Jasmine",
    "pytest", "unittest", "hypothesis",
    "JUnit", "TestNG", "Mockito",
    "Cypress", "Playwright", "Selenium", "Puppeteer",
    "React Testing Library", "Storybook",
    "k6", "Artillery", "Locust", "JMeter",
    "TDD", "BDD", "integration tests", "unit tests", "E2E tests",
]

PAYMENTS = [
    "Stripe", "PayPal", "Razorpay", "Braintree", "Square", "Adyen",
    "Paddle", "Lemon Squeezy", "Chargebee",
]

STORAGE = [
    "AWS S3", "Google Cloud Storage", "Azure Blob", "MinIO", "Cloudinary",
    "Uploadthing", "ImageKit", "Backblaze B4",
    "FFmpeg", "Sharp", "ImageMagick",
]

MOBILE = [
    "React Native", "Flutter", "Expo", "Ionic",
    "Swift", "SwiftUI", "UIKit",
    "Kotlin", "Jetpack Compose", "Android SDK",
    "Capacitor", "Cordova",
]

BLOCKCHAIN = [
    "Solidity", "Hardhat", "Foundry", "Truffle",
    "Ethereum", "Polygon", "Solana", "Base",
    "Web3.js", "Ethers.js", "Wagmi", "Viem",
    "IPFS", "Arweave", "The Graph",
    "MetaMask SDK", "WalletConnect",
]

NOTIFICATIONS = [
    "SendGrid", "Mailgun", "Resend", "Postmark",
    "Twilio", "Vonage", "AWS SES", "AWS SNS",
    "Firebase Cloud Messaging", "OneSignal", "Pushover",
]

# ══════════════════════════════════════════════════════════════════════════════
# CLAIM EXTRACTION SYSTEM PROMPT
# ══════════════════════════════════════════════════════════════════════════════

CLAIM_SYSTEM = (
    "You are a senior technical recruiter assistant specialising in software engineering. "
    "Extract all concrete, verifiable technical claims from a candidate's resume. "
    "Focus ONLY on technologies, tools, frameworks, libraries, architectural patterns, "
    "infrastructure, AI/ML capabilities, security features, and external integrations. "
    "Do NOT include soft skills, team sizes, vague business metrics, or non-technical claims. "
    "Return as JSON with a single 'claims' array."
)

AUTHENTICITY_SYSTEM = (
    "You are a principal software architect with 15 years of experience reviewing candidate portfolios. "
    "Evaluate whether a GitHub repository represents GENUINE, ORIGINAL engineering work. "
    "Analyse architecture depth, feature completeness, template/boilerplate indicators, "
    "project maturity, dead code, and code coherence. "
    "Be strict and honest. A tutorial project should score low even if it works. "
    "Return your evaluation as valid JSON."
)

# ══════════════════════════════════════════════════════════════════════════════
# PROJECT TEMPLATES FOR CLAIM EXTRACTION
# ══════════════════════════════════════════════════════════════════════════════

PROJECT_TEMPLATES = [
    # (description_template, required_pools, optional_pools)
    (
        "Built a full-stack {domain} platform using {frontend} and {backend}. "
        "Implemented {auth} and {database} for data persistence. "
        "Deployed on {devops} with {ci} pipeline. {extra}",
        ["frontend", "backend", "auth", "database", "devops", "ci"],
        ["testing", "storage", "notifications"],
    ),
    (
        "Developed a real-time {domain} application with {backend} and {messaging}. "
        "Used {database} for storage, {auth} for access control. "
        "Frontend built with {frontend}. {extra}",
        ["frontend", "backend", "database", "auth", "messaging"],
        ["devops", "testing", "monitoring"],
    ),
    (
        "Engineered a microservices {domain} system using {backend} with {messaging}. "
        "Each service uses {database}, communicates via {protocol}. "
        "Containerised with {containers} and orchestrated on {orchestration}. {extra}",
        ["backend", "database", "messaging", "containers", "orchestration"],
        ["monitoring", "testing", "auth"],
    ),
    (
        "Created an AI-powered {domain} tool using {ai_ml}. "
        "Backend API with {backend}, vector storage in {vector_db}. "
        "Frontend dashboard in {frontend}. {extra}",
        ["ai_ml", "backend", "frontend", "vector_db"],
        ["database", "auth", "devops"],
    ),
    (
        "Architected a {domain} SaaS platform with {frontend} and {backend}. "
        "Integrated {payments} for billing, {notifications} for alerts. "
        "Infrastructure on {devops}, CI/CD with {ci}. {extra}",
        ["frontend", "backend", "payments", "notifications", "devops", "ci"],
        ["database", "auth", "testing"],
    ),
    (
        "Built a {domain} mobile app with {mobile} and {backend} API. "
        "Used {database} for data, {auth} for user management. "
        "Push notifications via {notifications}. {extra}",
        ["mobile", "backend", "database", "auth", "notifications"],
        ["testing", "devops", "storage"],
    ),
    (
        "Developed a machine learning {domain} pipeline using {ml_framework}. "
        "Data processing with {data_tools}, model serving via {serving}. "
        "Experiment tracking with {tracking}, deployed on {devops}. {extra}",
        ["ml_framework", "devops"],
        ["data_tools", "serving", "tracking", "testing"],
    ),
    (
        "Built a decentralised {domain} application with {blockchain}. "
        "Smart contracts in {smart_contract_lang}, frontend with {frontend}. "
        "IPFS for storage, {backend} for indexing. {extra}",
        ["blockchain", "frontend", "backend"],
        ["smart_contract_lang", "testing", "devops"],
    ),
    (
        "Implemented a {domain} REST API using {backend} and {database}. "
        "Added {auth}, {caching} layer, and {testing} coverage. "
        "Documented with OpenAPI/Swagger. {extra}",
        ["backend", "database", "auth", "testing"],
        ["caching", "devops", "monitoring"],
    ),
    (
        "Designed a {domain} data pipeline processing millions of events using {messaging}. "
        "Consumers built in {backend}, results stored in {database}. "
        "Monitoring via {monitoring}, deployed on {devops}. {extra}",
        ["messaging", "backend", "database", "monitoring", "devops"],
        ["testing", "ci"],
    ),
]

DOMAINS = [
    "e-commerce", "fintech", "healthcare", "social media", "food delivery",
    "job portal", "learning management", "video streaming", "real-time chat",
    "task management", "inventory management", "hotel booking", "ride-sharing",
    "fitness tracking", "news aggregation", "document management", "CRM",
    "analytics dashboard", "monitoring", "authentication", "API gateway",
    "content management", "event ticketing", "subscription", "marketplace",
    "logistics tracking", "IoT dashboard", "DevOps", "code review", "recruitment",
    "customer support", "billing", "reporting", "notification", "search",
]

EXTRAS = [
    "Wrote unit and integration tests with {testing}.",
    "Monitoring with {monitoring} and alerting via PagerDuty.",
    "Implemented CI/CD with {ci} for automated deployments.",
    "Added {auth} with refresh token rotation.",
    "Used {caching} to reduce database load by 60%.",
    "Containerised with Docker, deployed on Kubernetes.",
    "Full TypeScript codebase with strict mode enabled.",
    "GraphQL API with real-time subscriptions.",
    "Implemented rate limiting and DDoS protection.",
    "Added end-to-end encryption for sensitive data.",
    "Configured Nginx reverse proxy with SSL termination.",
    "Used message queues for async task processing.",
    "Multi-tenant architecture with row-level security.",
    "Implemented event sourcing and CQRS patterns.",
    "Set up distributed tracing with OpenTelemetry.",
    "Automated database migrations with zero downtime.",
    "Implemented webhook system for third-party integrations.",
    "Added server-side rendering for SEO optimisation.",
    "Built admin dashboard with role-based access control.",
    "Integrated payment gateway with recurring billing support.",
    "",  # sometimes no extra
]


def _pick(pool: list, n: int = 1) -> list:
    return random.sample(pool, min(n, len(pool)))


def _pick1(pool: list) -> str:
    return random.choice(pool)


POOL_MAP = {
    "frontend":            FRONTEND,
    "backend":             BACKEND,
    "database":            DATABASE,
    "auth":                AUTH,
    "devops":              DEVOPS,
    "ci":                  DEVOPS,
    "messaging":           MESSAGING,
    "ai_ml":               AI_ML,
    "vector_db":           ["Pinecone", "ChromaDB", "Weaviate", "Qdrant", "FAISS", "Milvus"],
    "testing":             TESTING,
    "payments":            PAYMENTS,
    "storage":             STORAGE,
    "mobile":              MOBILE,
    "blockchain":          BLOCKCHAIN,
    "notifications":       NOTIFICATIONS,
    "monitoring":          ["Prometheus", "Grafana", "Datadog", "Sentry", "New Relic", "OpenTelemetry"],
    "containers":          ["Docker", "Docker Compose", "Podman"],
    "orchestration":       ["Kubernetes", "AWS ECS", "Google Cloud Run", "Fly.io"],
    "protocol":            ["gRPC", "REST", "GraphQL", "AMQP", "NATS"],
    "caching":             ["Redis", "Memcached", "Varnish", "CDN"],
    "ml_framework":        AI_ML[:12],
    "data_tools":          ["Pandas", "NumPy", "Polars", "Apache Spark", "Dask", "DuckDB"],
    "serving":             ["BentoML", "TorchServe", "Triton", "FastAPI", "Ray Serve"],
    "tracking":            ["MLflow", "Weights & Biases", "Neptune", "Comet ML"],
    "smart_contract_lang": ["Solidity", "Rust/Anchor", "Move"],
}


def _build_slots(required: list, optional: list) -> dict:
    slots = {}
    for key in required:
        pool = POOL_MAP.get(key, [key])
        slots[key] = _pick1(pool)
    for key in optional:
        if random.random() < 0.6:
            pool = POOL_MAP.get(key, [key])
            slots[key] = _pick1(pool)
    return slots


def _extract_claims_from_slots(slots: dict) -> list[str]:
    """Flatten all selected technologies into a deduplicated claims list."""
    seen = set()
    claims = []
    for val in slots.values():
        for token in val.replace("/", " ").split():
            clean = token.strip(".,;:")
            if clean and clean not in seen and len(clean) > 1:
                seen.add(clean)
                claims.append(clean)
        if val not in seen:
            seen.add(val)
            if val not in claims:
                claims.append(val)
    return claims


def _render_template(template: str, slots: dict, domain: str, extra: str) -> str:
    filled = template.replace("{domain}", domain)
    for key, val in slots.items():
        filled = filled.replace(f"{{{key}}}", val)
    # Fill extra with random tech refs
    extra_slots = {k: _pick1(v) for k, v in POOL_MAP.items()}
    extra_filled = extra
    for k, v in extra_slots.items():
        extra_filled = extra_filled.replace(f"{{{k}}}", v)
    filled = filled.replace("{extra}", extra_filled)
    # Remove any unfilled placeholders
    import re
    filled = re.sub(r"\{[^}]+\}", "", filled).strip()
    return " ".join(filled.split())


def generate_claim_examples(n: int = 750) -> list[dict]:
    examples = []
    attempts = 0
    while len(examples) < n and attempts < n * 10:
        attempts += 1
        tmpl, required, optional = random.choice(PROJECT_TEMPLATES)
        slots = _build_slots(required, optional)
        domain = _pick1(DOMAINS)
        extra = _pick1(EXTRAS)

        resume_text = _render_template(tmpl, slots, domain, extra)
        claims = _extract_claims_from_slots(slots)

        # Add a few random extra claims that appear in the description
        bonus_pool = random.sample(FRONTEND + BACKEND + DATABASE + DEVOPS, 3)
        for b in bonus_pool:
            if b.lower() in resume_text.lower() and b not in claims:
                claims.append(b)

        if len(claims) < 3:
            continue

        user_msg = (
            f"Resume text:\n{resume_text}\n\n"
            "Extract all technical claims. Return as JSON:\n"
            '{"claims": ["claim1", "claim2", ...]}'
        )
        examples.append({
            "messages": [
                {"role": "system",    "content": CLAIM_SYSTEM},
                {"role": "user",      "content": user_msg},
                {"role": "assistant", "content": json.dumps({"claims": claims})},
            ]
        })
    return examples


# ══════════════════════════════════════════════════════════════════════════════
# AUTHENTICITY EXAMPLES
# ══════════════════════════════════════════════════════════════════════════════

def _authenticity_score_from_params(p: dict) -> tuple[int, str, list, dict]:
    """Deterministically score a repo based on metadata params."""
    score = 20.0  # baseline

    # File count signal
    fc = p["file_count"]
    if fc >= 100:   score += 20
    elif fc >= 50:  score += 14
    elif fc >= 25:  score += 7
    elif fc >= 10:  score += 3

    # Services
    sc = p["service_count"]
    if sc >= 5:     score += 15
    elif sc >= 3:   score += 10
    elif sc >= 1:   score += 5

    # Middleware
    mc = p["middleware_count"]
    if mc >= 3:     score += 8
    elif mc >= 1:   score += 4

    # Tests & CI
    if p["has_tests"]:  score += 10
    if p["has_ci"]:     score += 8

    # Maturity
    mi = len(p.get("maturity_indicators", []))
    score += min(10, mi * 3)

    # Language diversity
    if p["lang_count"] >= 3:  score += 5
    elif p["lang_count"] == 2: score += 3

    # README quality
    readme_len = len(p.get("readme_desc", ""))
    if readme_len > 200:   score += 5
    elif readme_len > 100: score += 3
    elif readme_len < 20:  score -= 5

    score = max(5.0, min(97.0, score))
    score = round(score + random.uniform(-3, 3), 1)
    score = max(5.0, min(97.0, score))

    if score >= 70:  risk = "LOW"
    elif score >= 42: risk = "MEDIUM"
    else:            risk = "HIGH"

    reasoning = _build_reasoning(p, score)
    indicators = _build_indicators(score, p)

    return int(score), risk, reasoning, indicators


def _build_reasoning(p: dict, score: float) -> list[str]:
    r = []
    if p["file_count"] >= 80:
        r.append(f"Large codebase ({p['file_count']} files) suggests substantial implementation")
    elif p["file_count"] < 15:
        r.append(f"Very low file count ({p['file_count']}) — minimal or tutorial-level project")

    if p["service_count"] >= 4:
        r.append(f"{p['service_count']} distinct service classes indicate real separation of concerns")
    elif p["service_count"] == 0:
        r.append("No service layer detected — logic likely in controllers or flat files")

    if p["has_tests"] and p["has_ci"]:
        r.append("Test coverage and CI pipeline configured — engineering maturity present")
    elif not p["has_tests"]:
        r.append("No test suite — lacks professional development standards")

    if p["middleware_count"] >= 2:
        r.append(f"{p['middleware_count']} middleware components show production awareness")

    mi = p.get("maturity_indicators", [])
    if mi:
        r.append(f"Maturity indicators present: {', '.join(mi[:3])}")
    else:
        r.append("No maturity indicators (logging, error handling, validation) detected")

    readme = p.get("readme_desc", "")
    if len(readme) < 30:
        r.append("Minimal README with no project description")
    elif "production" in readme.lower() or "enterprise" in readme.lower():
        r.append("README describes production-grade features")

    return r[:5]


def _build_indicators(score: float, p: dict) -> dict:
    if score >= 75:
        return {"architectureDepth": "deep",     "templateRisk": "none",   "featureCompleteness": "enterprise", "projectMaturity": "senior"}
    elif score >= 58:
        return {"architectureDepth": "moderate", "templateRisk": "low",    "featureCompleteness": "complete",   "projectMaturity": "intermediate"}
    elif score >= 40:
        return {"architectureDepth": "moderate", "templateRisk": "medium", "featureCompleteness": "partial",    "projectMaturity": "intermediate"}
    else:
        return {"architectureDepth": "shallow",  "templateRisk": "high",   "featureCompleteness": "partial",    "projectMaturity": "beginner"}


LANGUAGE_DISTS = [
    "TypeScript: 78%, CSS: 14%, HTML: 8%",
    "Python: 91%, Shell: 9%",
    "TypeScript: 62%, Python: 28%, Dockerfile: 10%",
    "JavaScript: 88%, CSS: 8%, HTML: 4%",
    "Go: 95%, Makefile: 5%",
    "Java: 85%, XML: 10%, Shell: 5%",
    "Rust: 92%, TOML: 8%",
    "Python: 65%, TypeScript: 30%, Shell: 5%",
    "Kotlin: 82%, Gradle: 12%, XML: 6%",
    "C#: 88%, XML: 7%, PowerShell: 5%",
    "Ruby: 80%, ERB: 14%, YAML: 6%",
    "PHP: 82%, Blade: 12%, SQL: 6%",
    "Dart: 95%, YAML: 5%",
    "TypeScript: 45%, Python: 35%, SQL: 12%, Shell: 8%",
    "JavaScript: 72%, Python: 20%, CSS: 8%",
    "Solidity: 68%, TypeScript: 28%, JavaScript: 4%",
    "Swift: 90%, Storyboard: 10%",
    "HTML: 65%, CSS: 25%, JavaScript: 10%",
    "Python: 100%",
    "JavaScript: 55%, HTML: 30%, CSS: 15%",
]

MATURITY_POOL = [
    "error handling", "input validation", "structured logging", "health checks",
    "graceful shutdown", "database migrations", "environment config", "secrets management",
    "OpenAPI docs", "retry logic", "circuit breaker", "caching layer",
    "request tracing", "audit logging", "data pagination", "soft deletes",
    "rate limiting", "CORS configuration", "CSP headers", "SQL injection protection",
    "XSS prevention", "load balancing", "blue-green deployment", "feature flags",
]

README_DESCRIPTIONS = [
    # High quality
    "Production-ready SaaS platform with multi-tenancy, Stripe billing, and enterprise SSO.",
    "Distributed event-driven microservices system handling 10k+ events/second with Kafka.",
    "Full-stack e-commerce platform with real-time inventory, payment processing, and admin panel.",
    "AI-powered code review tool using RAG and LLM integration with GitHub webhooks.",
    "Real-time collaborative whiteboard with WebRTC, conflict resolution, and offline support.",
    "Zero-downtime deployment pipeline with canary releases, automated rollback, and monitoring.",
    "Healthcare appointment system with HIPAA-compliant data handling and end-to-end encryption.",
    "High-throughput financial transaction processor with idempotency and double-entry accounting.",
    "Kubernetes operator for managing custom CRDs with controller-runtime and admission webhooks.",
    "Multi-region distributed cache with consistent hashing and automatic failover.",
    # Medium quality
    "Task management app with user authentication and team collaboration features.",
    "REST API for a blog platform with JWT authentication and PostgreSQL.",
    "Chat application using WebSocket and MongoDB for message storage.",
    "E-commerce site with product catalog, shopping cart, and PayPal integration.",
    "Weather dashboard using OpenWeather API with React frontend.",
    "URL shortener service with click analytics and Redis caching.",
    "Job board platform with resume upload and company profiles.",
    "Forum application with nested comments and upvote system.",
    "Recipe sharing platform with search and user profiles.",
    "Simple expense tracker with categorisation and charts.",
    # Low quality
    "A todo app built with React.",
    "My first website.",
    "Basic CRUD application.",
    "Tutorial project following YouTube course.",
    "Practice project.",
    "Beginner Python project.",
    "Learning Next.js.",
    "Sample app.",
    "Portfolio website.",
    "",
]

SERVICE_NAMES = [
    "AuthService", "UserService", "ProductService", "OrderService",
    "PaymentService", "NotificationService", "EmailService", "FileService",
    "SearchService", "AnalyticsService", "ReportService", "CacheService",
    "AuditService", "TokenService", "WebhookService", "LLMService",
]

MIDDLEWARE_NAMES = [
    "authMiddleware", "rateLimitMiddleware", "loggingMiddleware",
    "errorHandler", "corsMiddleware", "validationMiddleware",
    "cacheMiddleware", "tracingMiddleware", "compressionMiddleware",
]

FRAMEWORK_COMBOS = [
    ["React", "Node.js"], ["Next.js", "FastAPI"], ["Vue.js", "Django"],
    ["Angular", "Spring Boot"], ["Svelte", "Go/Gin"], ["Nuxt.js", "Laravel"],
    ["React Native", "Node.js"], ["Flutter", "FastAPI"], ["Remix", "NestJS"],
    ["Astro", "Go/Fiber"], ["SvelteKit", "Rust/Axum"], ["Next.js", "tRPC"],
    ["React", "FastAPI", "LangChain"], ["Vue.js", "Django", "Celery"],
    ["Angular", "NestJS"], ["Next.js", "Prisma"], ["Nuxt.js", "Supabase"],
    ["React", "Spring Boot"], ["Svelte", "Deno"], ["Next.js", "Go/Echo"],
]


def _random_repo_params(complexity: str) -> dict:
    """Generate random repo metadata for a given complexity level."""
    if complexity == "high":
        file_count       = random.randint(70, 250)
        service_count    = random.randint(4, 12)
        middleware_count = random.randint(3, 8)
        has_tests        = True
        has_ci           = True
        maturity_count   = random.randint(4, 10)
        lang_count       = random.randint(2, 4)
        readme_idx       = random.randint(0, 9)
    elif complexity == "medium":
        file_count       = random.randint(20, 70)
        service_count    = random.randint(1, 4)
        middleware_count = random.randint(1, 3)
        has_tests        = random.random() > 0.4
        has_ci           = random.random() > 0.5
        maturity_count   = random.randint(1, 4)
        lang_count       = random.randint(1, 3)
        readme_idx       = random.randint(10, 19)
    else:  # low
        file_count       = random.randint(3, 20)
        service_count    = random.randint(0, 1)
        middleware_count = random.randint(0, 1)
        has_tests        = random.random() > 0.8
        has_ci           = random.random() > 0.9
        maturity_count   = random.randint(0, 2)
        lang_count       = random.randint(1, 2)
        readme_idx       = random.randint(20, len(README_DESCRIPTIONS) - 1)

    services    = random.sample(SERVICE_NAMES, min(service_count, len(SERVICE_NAMES)))
    middlewares = random.sample(MIDDLEWARE_NAMES, min(middleware_count, len(MIDDLEWARE_NAMES)))
    maturity    = random.sample(MATURITY_POOL, min(maturity_count, len(MATURITY_POOL)))
    frameworks  = random.choice(FRAMEWORK_COMBOS)
    lang_dist   = random.choice(LANGUAGE_DISTS)
    readme      = README_DESCRIPTIONS[readme_idx]

    return {
        "file_count":         file_count,
        "service_count":      service_count,
        "middleware_count":   middleware_count,
        "has_tests":          has_tests,
        "has_ci":             has_ci,
        "maturity_indicators": maturity,
        "lang_count":         lang_count,
        "lang_dist":          lang_dist,
        "frameworks":         frameworks,
        "services":           services,
        "middlewares":        middlewares,
        "readme_desc":        readme,
    }


def _render_auth_input(p: dict) -> str:
    svc  = ", ".join(p["services"])  or "none"
    mw   = ", ".join(p["middlewares"]) or "none"
    mi   = ", ".join(p["maturity_indicators"]) or "none"
    fw   = ", ".join(p["frameworks"])
    return (
        f"Files: {p['file_count']} | "
        f"Languages: {p['lang_dist']} | "
        f"Frameworks: {fw} | "
        f"Has tests: {p['has_tests']} | Has CI: {p['has_ci']} | "
        f"Services: {svc} | Middleware: {mw} | "
        f"Maturity indicators: {mi} | "
        f"README: {p['readme_desc']}"
    )


def generate_authenticity_examples(n: int = 300) -> list[dict]:
    examples = []
    complexities = ["high"] * (n // 3) + ["medium"] * (n // 3) + ["low"] * (n - 2 * (n // 3))
    random.shuffle(complexities)

    for complexity in complexities:
        p = _random_repo_params(complexity)
        score, risk, reasoning, indicators = _authenticity_score_from_params(p)
        input_text = _render_auth_input(p)

        user_msg = (
            f"Repository Analysis:\n{input_text}\n\n"
            "Evaluate the repository's authenticity. Return JSON:\n"
            '{"authenticityScore": 0-100, "riskLevel": "LOW|MEDIUM|HIGH", '
            '"reasoning": ["point1", ...], '
            '"indicators": {"architectureDepth": "...", "templateRisk": "...", '
            '"featureCompleteness": "...", "projectMaturity": "..."}}'
        )
        output = {
            "authenticityScore": score,
            "riskLevel":         risk,
            "reasoning":         reasoning,
            "indicators":        indicators,
        }
        examples.append({
            "messages": [
                {"role": "system",    "content": AUTHENTICITY_SYSTEM},
                {"role": "user",      "content": user_msg},
                {"role": "assistant", "content": json.dumps(output)},
            ]
        })
    return examples


# ══════════════════════════════════════════════════════════════════════════════
# HAND-CRAFTED HIGH-QUALITY SEED EXAMPLES
# ══════════════════════════════════════════════════════════════════════════════

SEED_CLAIM_EXAMPLES = [
    {
        "resume": "Architected a distributed payment processing system using NestJS, Apache Kafka, and PostgreSQL. Implemented idempotency keys, distributed locking with Redis, and SAGA pattern for transaction management. Deployed on AWS ECS with Terraform IaC, GitHub Actions CI/CD, and Datadog monitoring.",
        "claims": ["NestJS", "Apache Kafka", "PostgreSQL", "Redis", "SAGA pattern", "AWS ECS", "Terraform", "GitHub Actions", "Datadog", "idempotency", "distributed locking"]
    },
    {
        "resume": "Built a multi-modal RAG chatbot using LangGraph, ChromaDB, and OpenAI GPT-4o. FastAPI backend with JWT auth, PostgreSQL for user data, Redis for session caching. Deployed on Kubernetes with Helm charts, monitored via Prometheus and Grafana.",
        "claims": ["LangGraph", "ChromaDB", "OpenAI", "GPT-4o", "RAG", "FastAPI", "JWT", "PostgreSQL", "Redis", "Kubernetes", "Helm", "Prometheus", "Grafana"]
    },
    {
        "resume": "Engineered a real-time collaborative code editor with WebRTC, Yjs CRDT, and Monaco Editor. Backend WebSocket server in Go/Fiber, Redis for presence tracking, PostgreSQL for document persistence. OAuth2 with Google, containerised with Docker Compose.",
        "claims": ["WebRTC", "Yjs", "CRDT", "Monaco Editor", "WebSocket", "Go/Fiber", "Redis", "PostgreSQL", "OAuth2", "Docker Compose"]
    },
    {
        "resume": "Developed a fintech open-banking platform with Spring Boot microservices and Kafka event bus. Used Keycloak for OAuth2/OIDC, Vault for secrets management, PostgreSQL with Row-Level Security. Deployed on GKE with ArgoCD GitOps, SLO monitoring with Prometheus.",
        "claims": ["Spring Boot", "microservices", "Kafka", "Keycloak", "OAuth2", "OIDC", "Vault", "PostgreSQL", "Row-Level Security", "GKE", "ArgoCD", "GitOps", "Prometheus", "SLO"]
    },
    {
        "resume": "Built an AI resume screener using Hugging Face Transformers, sentence-transformers, and Pinecone for vector similarity search. FastAPI with async SQLAlchemy, Celery for background processing, React frontend with TailwindCSS. GitHub Actions CI with pytest coverage reports.",
        "claims": ["Hugging Face Transformers", "sentence-transformers", "Pinecone", "vector search", "FastAPI", "SQLAlchemy", "Celery", "React", "TailwindCSS", "GitHub Actions", "pytest"]
    },
    {
        "resume": "Implemented a decentralised NFT marketplace with Solidity smart contracts on Ethereum, verified with Hardhat and Foundry tests. Frontend with Next.js and Wagmi, IPFS via Pinata for metadata. The Graph for indexing, OpenZeppelin for contract standards.",
        "claims": ["Solidity", "Ethereum", "NFT", "Hardhat", "Foundry", "Next.js", "Wagmi", "IPFS", "The Graph", "OpenZeppelin", "Pinata"]
    },
    {
        "resume": "Created a Kubernetes operator in Go using controller-runtime for managing custom database CRDs. Admission webhooks for validation, RBAC for service accounts. Operator deployed via Helm, e2e tests with envtest framework. Published to OperatorHub.",
        "claims": ["Kubernetes", "Go", "controller-runtime", "CRD", "admission webhooks", "RBAC", "Helm", "envtest", "OperatorHub"]
    },
    {
        "resume": "Developed a ML model serving platform with FastAPI, TorchServe, and ONNX Runtime. Canary deployments with Istio service mesh, A/B testing via feature flags. MLflow for experiment tracking, Weights & Biases for model monitoring. DVC for dataset versioning.",
        "claims": ["FastAPI", "TorchServe", "ONNX Runtime", "Istio", "A/B testing", "feature flags", "MLflow", "Weights & Biases", "DVC", "canary deployments"]
    },
    {
        "resume": "Built a multi-tenant SaaS CRM with Next.js App Router, Prisma, and PostgreSQL with schema-per-tenant isolation. Stripe for billing with webhook handling, Resend for transactional emails. Deployed on Vercel with Edge Functions, Redis for caching.",
        "claims": ["Next.js", "Prisma", "PostgreSQL", "multi-tenant", "Stripe", "webhooks", "Resend", "Vercel", "Edge Functions", "Redis"]
    },
    {
        "resume": "Architected a streaming data pipeline ingesting 5M events/day with Apache Kafka, Flink, and ClickHouse. Python consumers with Pydantic validation, Terraform on AWS MSK. Real-time dashboard in Grafana, alerting via PagerDuty. dbt for data transformation.",
        "claims": ["Apache Kafka", "Flink", "ClickHouse", "Python", "Pydantic", "Terraform", "AWS MSK", "Grafana", "PagerDuty", "dbt"]
    },
]

SEED_AUTH_EXAMPLES = [
    {
        "input": "Files: 187 | Languages: TypeScript: 68%, Python: 22%, Dockerfile: 10% | Frameworks: Next.js, FastAPI, LangChain | Has tests: True | Has CI: True | Services: AuthService, LLMService, RAGService, UserService, FileService | Middleware: authMiddleware, rateLimitMiddleware, loggingMiddleware, errorHandler | Maturity indicators: structured logging, health checks, database migrations, secrets management, graceful shutdown | README: Production-ready AI-powered document intelligence platform with RAG, vector search, and multi-tenant support.",
        "score": 91, "risk": "LOW",
        "reasoning": ["Large codebase (187 files) with significant TypeScript and Python", "5 well-named service classes with clear domain separation", "Tests, CI, and 5 maturity indicators — strong engineering practices", "Custom middleware stack shows production awareness", "README describes enterprise-grade features"],
        "indicators": {"architectureDepth": "deep", "templateRisk": "none", "featureCompleteness": "enterprise", "projectMaturity": "senior"}
    },
    {
        "input": "Files: 8 | Languages: HTML: 60%, CSS: 35%, JavaScript: 5% | Frameworks: none | Has tests: False | Has CI: False | Services: none | Middleware: none | Maturity indicators: none | README: My portfolio website.",
        "score": 12, "risk": "HIGH",
        "reasoning": ["Only 8 files — minimal implementation", "Pure static HTML/CSS with trivial JavaScript", "No framework, services, tests, or CI", "No maturity indicators whatsoever", "Portfolio site not representative of engineering skills"],
        "indicators": {"architectureDepth": "shallow", "templateRisk": "high", "featureCompleteness": "partial", "projectMaturity": "beginner"}
    },
    {
        "input": "Files: 54 | Languages: TypeScript: 78%, CSS: 14%, HTML: 8% | Frameworks: React, Node.js | Has tests: True | Has CI: True | Services: AuthService, ProductService, OrderService | Middleware: authMiddleware, errorHandler | Maturity indicators: error handling, input validation, structured logging | README: E-commerce platform with cart, checkout, and Stripe integration.",
        "score": 72, "risk": "LOW",
        "reasoning": ["54 files with reasonable TypeScript coverage", "3 service classes indicating domain-driven design", "Tests and CI configured with 3 maturity indicators", "Custom auth and error middleware show backend awareness"],
        "indicators": {"architectureDepth": "moderate", "templateRisk": "low", "featureCompleteness": "complete", "projectMaturity": "intermediate"}
    },
    {
        "input": "Files: 22 | Languages: JavaScript: 88%, CSS: 8%, HTML: 4% | Frameworks: React, Express.js | Has tests: False | Has CI: False | Services: none | Middleware: none | Maturity indicators: none | README: Todo app built following Traversy Media tutorial.",
        "score": 19, "risk": "HIGH",
        "reasoning": ["22 files but no services or middleware", "Explicitly copied from a tutorial — low authenticity signal", "No tests or CI pipeline", "React + Express with no additional architecture"],
        "indicators": {"architectureDepth": "shallow", "templateRisk": "high", "featureCompleteness": "partial", "projectMaturity": "beginner"}
    },
    {
        "input": "Files: 112 | Languages: Go: 95%, Makefile: 5% | Frameworks: Go/Gin, gRPC | Has tests: True | Has CI: True | Services: UserService, AuthService, PaymentService, NotificationService, AuditService | Middleware: loggingMiddleware, authMiddleware, tracingMiddleware | Maturity indicators: structured logging, request tracing, circuit breaker, graceful shutdown, health checks, database migrations | README: High-throughput microservices backend processing financial transactions with idempotency and SAGA pattern.",
        "score": 93, "risk": "LOW",
        "reasoning": ["112 Go files with pure idiomatic Go", "5 domain services + 3 middleware — mature layered architecture", "6 maturity indicators including circuit breaker and tracing", "Financial domain with idempotency shows production engineering mindset"],
        "indicators": {"architectureDepth": "deep", "templateRisk": "none", "featureCompleteness": "enterprise", "projectMaturity": "senior"}
    },
]


def build_seed_examples() -> list[dict]:
    examples = []
    for ex in SEED_CLAIM_EXAMPLES:
        user_msg = (
            f"Resume text:\n{ex['resume']}\n\n"
            "Extract all technical claims. Return as JSON:\n"
            '{"claims": ["claim1", "claim2", ...]}'
        )
        examples.append({
            "messages": [
                {"role": "system",    "content": CLAIM_SYSTEM},
                {"role": "user",      "content": user_msg},
                {"role": "assistant", "content": json.dumps({"claims": ex["claims"]})},
            ]
        })

    for ex in SEED_AUTH_EXAMPLES:
        user_msg = (
            f"Repository Analysis:\n{ex['input']}\n\n"
            "Evaluate the repository's authenticity. Return JSON:\n"
            '{"authenticityScore": 0-100, "riskLevel": "LOW|MEDIUM|HIGH", '
            '"reasoning": [...], "indicators": {...}}'
        )
        output = {
            "authenticityScore": ex["score"],
            "riskLevel":         ex["risk"],
            "reasoning":         ex["reasoning"],
            "indicators":        ex["indicators"],
        }
        examples.append({
            "messages": [
                {"role": "system",    "content": AUTHENTICITY_SYSTEM},
                {"role": "user",      "content": user_msg},
                {"role": "assistant", "content": json.dumps(output)},
            ]
        })
    return examples


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("Generating training data ...")

    seed      = build_seed_examples()           # 15 high-quality handcrafted
    claims    = generate_claim_examples(735)    # programmatic claim extraction
    auth      = generate_authenticity_examples(300)  # programmatic authenticity

    all_examples = seed + claims + auth
    random.shuffle(all_examples)

    output_path = Path("train/training_data.jsonl")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        for ex in all_examples:
            f.write(json.dumps(ex) + "\n")

    claim_count = sum(1 for e in all_examples if e["messages"][0]["content"] == CLAIM_SYSTEM)
    auth_count  = len(all_examples) - claim_count

    print(f"\nWrote {len(all_examples)} examples to {output_path}")
    print(f"  Claim extraction : {claim_count}")
    print(f"  Authenticity     : {auth_count}")
    print(f"\nNext steps:")
    print(f"  python train/tokenizer_train.py")
    print(f"  python train/train_scratch.py --hf_token hf_... --hf_repo username/model-name")


if __name__ == "__main__":
    main()
