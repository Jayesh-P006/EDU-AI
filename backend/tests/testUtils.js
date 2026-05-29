/**
 * Testing Utilities & Factories
 * Provides helpers for unit, integration, and E2E tests
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';

/**
 * Test Database Setup
 */
export class TestDatabase
{
    constructor(mongoUri=process.env.TEST_MONGODB_URI)
    {
        this.mongoUri=mongoUri;
        this.connection=null;
    }

    /**
     * Connect to test database
     */
    async connect()
    {
        if (this.connection) return;

        const mongoose=await import('mongoose');
        this.connection=await mongoose.connect(this.mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        return this.connection;
    }

    /**
     * Disconnect from test database
     */
    async disconnect()
    {
        if (this.connection)
        {
            await this.connection.disconnect();
            this.connection=null;
        }
    }

    /**
     * Drop all collections
     */
    async dropCollections()
    {
        if (!this.connection) return;

        const collections=this.connection.collections;
        for (const key in collections)
        {
            const collection=collections[key];
            await collection.deleteMany({});
        }
    }

    /**
     * Seed database with test data
     */
    async seed(User, seedData)
    {
        return await User.insertMany(seedData);
    }
}

/**
 * Test User Factory
 */
export class TestUserFactory
{
    static createUser(overrides={})
    {
        const defaults={
            email: `test.user${Date.now()}@example.com`,
            password: 'TestPassword123!',
            firstName: 'Test',
            lastName: 'User',
            role: 'candidate',
            isVerified: true,
            isActive: true,
        };

        return {...defaults, ...overrides};
    }

    static createAdmin(overrides={})
    {
        return TestUserFactory.createUser({
            role: 'admin',
            ...overrides,
        });
    }

    static createProctor(overrides={})
    {
        return TestUserFactory.createUser({
            role: 'proctor',
            ...overrides,
        });
    }

    static createBatch(count, overrides={})
    {
        const users=[];
        for (let i=0;i<count;i++)
        {
            users.push(TestUserFactory.createUser({
                email: `test.user${i}.${Date.now()}@example.com`,
                ...overrides,
            }));
        }
        return users;
    }
}

/**
 * Test Interview Factory
 */
export class TestInterviewFactory
{
    static createInterview(overrides={})
    {
        return {
            jobId: 'test-job-id',
            userId: 'test-user-id',
            status: 'scheduled',
            startTime: new Date(),
            endTime: new Date(Date.now()+3600000), // 1 hour later
            questions: [],
            score: null,
            feedback: '',
            ...overrides,
        };
    }

    static createWithQuestions(questionCount=3, overrides={})
    {
        const questions=[];
        for (let i=0;i<questionCount;i++)
        {
            questions.push({
                questionId: `q${i}`,
                question: `Test question ${i}`,
                timeAllocated: 300,
            });
        }

        return TestInterviewFactory.createInterview({
            questions,
            ...overrides,
        });
    }
}

/**
 * Test Session Manager
 */
export class TestSessionManager
{
    constructor(app)
    {
        this.app=app;
        this.tokens=new Map();
        this.cookies=new Map();
    }

    /**
     * Create test session for user
     */
    createTestToken(userId, role='candidate')
    {
        const secret=process.env.JWT_SECRET||'test-secret';
        const token=jwt.sign(
            {id: userId, role},
            secret,
            {expiresIn: '24h'}
        );

        this.tokens.set(userId, token);
        return token;
    }

    /**
     * Get authorization header
     */
    getAuthHeader(userId)
    {
        const token=this.tokens.get(userId)||this.createTestToken(userId);
        return {Authorization: `Bearer ${token}`};
    }

    /**
     * Create authenticated request
     */
    authenticatedRequest(method, endpoint, userId)
    {
        const req=request(this.app)[method.toLowerCase()](endpoint);
        const authHeader=this.getAuthHeader(userId);
        return req.set(authHeader);
    }
}

/**
 * Test Assertions Helper
 */
export class TestAssertions
{
    /**
     * Assert response format
     */
    static assertValidResponse(response, expectedStatus=200)
    {
        expect(response.status).toBe(expectedStatus);
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('timestamp');
    }

    /**
     * Assert error response
     */
    static assertErrorResponse(response, expectedStatus, errorMessage)
    {
        expect(response.status).toBe(expectedStatus);
        expect(response.body.success).toBe(false);
        expect(response.body.error||response.body.message).toContain(errorMessage);
    }

    /**
     * Assert pagination response
     */
    static assertPaginationResponse(response, page, limit, total)
    {
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.page).toBe(page);
        expect(response.body.pagination.limit).toBe(limit);
        expect(response.body.pagination.total).toBe(total);
        expect(response.body.pagination.totalPages).toBe(Math.ceil(total/limit));
    }

    /**
     * Assert data shape
     */
    static assertDataShape(data, shape)
    {
        for (const [key, type] of Object.entries(shape))
        {
            expect(data).toHaveProperty(key);
            if (type!=='any')
            {
                expect(typeof data[key]).toBe(type);
            }
        }
    }
}

/**
 * Mock Service Factory
 */
export class MockServiceFactory
{
    static createAuthService(overrides={})
    {
        return {
            hashPassword: jest.fn().mockResolvedValue('hashed-password'),
            verifyPassword: jest.fn().mockResolvedValue(true),
            generateToken: jest.fn().mockReturnValue('test-token'),
            verifyToken: jest.fn().mockReturnValue({id: 'user-1', role: 'candidate'}),
            ...overrides,
        };
    }

    static createEmailService(overrides={})
    {
        return {
            sendOTP: jest.fn().mockResolvedValue({success: true}),
            sendVerificationEmail: jest.fn().mockResolvedValue({success: true}),
            sendErrorNotification: jest.fn().mockResolvedValue({success: true}),
            ...overrides,
        };
    }

    static createInterviewService(overrides={})
    {
        return {
            createInterview: jest.fn().mockResolvedValue({id: 'interview-1'}),
            getInterview: jest.fn().mockResolvedValue(TestInterviewFactory.createInterview()),
            submitAnswer: jest.fn().mockResolvedValue({success: true}),
            scoreInterview: jest.fn().mockResolvedValue({score: 85}),
            ...overrides,
        };
    }
}

/**
 * Performance Testing Utilities
 */
export class PerformanceTest
{
    /**
     * Measure request response time
     */
    static async measureResponseTime(fn, iterations=100)
    {
        const times=[];

        for (let i=0;i<iterations;i++)
        {
            const start=process.hrtime.bigint();
            await fn();
            const end=process.hrtime.bigint();
            times.push(Number(end-start)/1e6); // Convert to ms
        }

        return {
            min: Math.min(...times),
            max: Math.max(...times),
            avg: times.reduce((a, b) => a+b)/times.length,
            median: times.sort((a, b) => a-b)[Math.floor(times.length/2)],
            times,
        };
    }

    /**
     * Load testing helper
     */
    static async loadTest(fn, concurrency=10, duration=5000)
    {
        const startTime=Date.now();
        let completed=0;
        let failed=0;

        const tasks=[];
        for (let i=0;i<concurrency;i++)
        {
            tasks.push(
                (async () =>
                {
                    while (Date.now()-startTime<duration)
                    {
                        try
                        {
                            await fn();
                            completed++;
                        } catch (error)
                        {
                            failed++;
                        }
                    }
                })()
            );
        }

        await Promise.all(tasks);

        return {
            completed,
            failed,
            duration: Date.now()-startTime,
            throughput: (completed/(Date.now()-startTime))*1000, // req/sec
            concurrency,
        };
    }
}

/**
 * Snapshot Testing Utilities
 */
export class SnapshotTest
{
    /**
     * Create API response snapshot
     */
    static createResponseSnapshot(response)
    {
        return {
            status: response.status,
            headers: response.headers,
            body: response.body,
        };
    }

    /**
     * Compare with previous snapshot
     */
    static compareSnapshots(current, previous)
    {
        return JSON.stringify(current)===JSON.stringify(previous);
    }
}

/**
 * Integration Test Helper
 */
export class IntegrationTestHelper
{
    constructor(app)
    {
        this.app=app;
        this.db=new TestDatabase();
        this.session=new TestSessionManager(app);
    }

    /**
     * Setup test environment
     */
    async setup()
    {
        await this.db.connect();
    }

    /**
     * Cleanup test environment
     */
    async cleanup()
    {
        await this.db.dropCollections();
        await this.db.disconnect();
    }

    /**
     * Create test user and get authenticated request
     */
    async createAuthenticatedUser(overrides={})
    {
        const User=(await import('../models/User.js')).default;
        const userData=TestUserFactory.createUser(overrides);
        const user=await User.create(userData);

        return {
            user,
            token: this.session.createTestToken(user._id),
            request: (method, endpoint) => this.session.authenticatedRequest(method, endpoint, user._id),
        };
    }
}

/**
 * E2E Test Scenario Builder
 */
export class E2EScenario
{
    constructor(app)
    {
        this.app=app;
        this.steps=[];
        this.data={};
    }

    /**
     * Add step to scenario
     */
    addStep(name, fn)
    {
        this.steps.push({name, fn});
        return this;
    }

    /**
     * Execute scenario
     */
    async execute()
    {
        const results=[];

        for (const step of this.steps)
        {
            try
            {
                console.log(`[E2E] Executing: ${step.name}`);
                const result=await step.fn(this);
                results.push({step: step.name, success: true, result});
            } catch (error)
            {
                results.push({step: step.name, success: false, error: error.message});
                throw error;
            }
        }

        return results;
    }

    /**
     * Store data for later steps
     */
    storeData(key, value)
    {
        this.data[key]=value;
        return this;
    }

    /**
     * Retrieve stored data
     */
    getData(key)
    {
        return this.data[key];
    }
}

/**
 * Test Data Builder
 */
export class TestDataBuilder
{
    constructor()
    {
        this.data={};
    }

    withUser(userData)
    {
        this.data.user=TestUserFactory.createUser(userData);
        return this;
    }

    withInterview(interviewData)
    {
        this.data.interview=TestInterviewFactory.createInterview(interviewData);
        return this;
    }

    withQuestions(count)
    {
        this.data.interview=TestInterviewFactory.createWithQuestions(count);
        return this;
    }

    build()
    {
        return this.data;
    }
}

export default {
    TestDatabase,
    TestUserFactory,
    TestInterviewFactory,
    TestSessionManager,
    TestAssertions,
    MockServiceFactory,
    PerformanceTest,
    SnapshotTest,
    IntegrationTestHelper,
    E2EScenario,
    TestDataBuilder,
};
