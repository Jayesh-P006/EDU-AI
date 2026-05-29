import express from 'express';
import axios from 'axios';
import PracticeSession from '../models/PracticeSession.js';
import {verifyAuth} from '../middleware/auth.js';
import {APIResponse} from '../middleware/response.js';

const router=express.Router();

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
const GROQ_TIMEOUT=12000;
const GROQ_URL='https://api.groq.com/openai/v1/chat/completions';

// In-memory session store (fallback if MongoDB fails)
const memoryStore=new Map();

// ═══════════════════════════════════════════════════════════════════
// QUESTION BANK - Comprehensive fallback questions
// ═══════════════════════════════════════════════════════════════════
const QUESTION_BANK={
    technical: {
        frontend: [
            {q: "Explain the difference between CSS Flexbox and Grid. When would you use each?", points: ["Layout systems", "Use cases", "Browser support"]},
            {q: "What is the Virtual DOM and how does React use it to optimize performance?", points: ["DOM diffing", "Reconciliation", "Performance benefits"]},
            {q: "How do you handle state management in a large React application?", points: ["Redux/Context", "State patterns", "Performance"]},
            {q: "Explain event delegation and why it's useful in JavaScript.", points: ["Event bubbling", "Performance", "Dynamic elements"]},
            {q: "What are Web Vitals and how do you optimize for them?", points: ["LCP", "FID", "CLS", "Optimization techniques"]},
            {q: "Describe the CSS box model and how box-sizing affects it.", points: ["Content/padding/border/margin", "box-sizing values"]},
            {q: "How would you implement lazy loading for images in a web app?", points: ["Intersection Observer", "Loading attribute", "Performance"]},
            {q: "What is CORS and how do you handle cross-origin requests?", points: ["Same-origin policy", "Headers", "Preflight requests"]},
        ],
        backend: [
            {q: "Explain RESTful API design principles. What makes an API RESTful?", points: ["HTTP methods", "Statelessness", "Resource URIs"]},
            {q: "How would you design a caching strategy for a high-traffic API?", points: ["Cache layers", "Invalidation", "TTL strategies"]},
            {q: "What is database indexing and when should you use it?", points: ["B-tree indexes", "Query optimization", "Trade-offs"]},
            {q: "Explain the difference between SQL and NoSQL databases.", points: ["ACID vs BASE", "Use cases", "Scaling"]},
            {q: "How do you handle authentication and authorization in APIs?", points: ["JWT", "OAuth", "Session management"]},
            {q: "What is rate limiting and how would you implement it?", points: ["Algorithms", "Distributed systems", "DDoS protection"]},
            {q: "Describe connection pooling and why it matters for databases.", points: ["Resource management", "Performance", "Configuration"]},
            {q: "How would you design an API for handling file uploads?", points: ["Multipart", "Streaming", "Storage strategies"]},
        ],
        fullstack: [
            {q: "How would you architect a real-time chat application?", points: ["WebSockets", "Message queues", "Scaling"]},
            {q: "Explain the trade-offs between SSR, CSR, and SSG.", points: ["Performance", "SEO", "Use cases"]},
            {q: "How do you handle database migrations in production?", points: ["Version control", "Rollback strategies", "Zero downtime"]},
            {q: "Describe microservices architecture and its challenges.", points: ["Service boundaries", "Communication", "Data consistency"]},
            {q: "How would you implement user authentication across services?", points: ["Single sign-on", "Token management", "Security"]},
            {q: "What strategies do you use for API versioning?", points: ["URL versioning", "Header versioning", "Deprecation"]},
        ],
        'data-science': [
            {q: "Explain the bias-variance tradeoff in machine learning.", points: ["Underfitting", "Overfitting", "Model complexity"]},
            {q: "How do you handle missing data in a dataset?", points: ["Imputation methods", "Deletion strategies", "Impact analysis"]},
            {q: "What is cross-validation and why is it important?", points: ["K-fold", "Stratified", "Preventing overfitting"]},
            {q: "Explain the difference between supervised and unsupervised learning.", points: ["Labeled data", "Algorithms", "Use cases"]},
            {q: "How would you approach feature engineering for a predictive model?", points: ["Feature selection", "Transformation", "Domain knowledge"]},
        ],
        devops: [
            {q: "Explain the CI/CD pipeline and its key components.", points: ["Build", "Test", "Deploy", "Automation"]},
            {q: "How do you implement blue-green deployments?", points: ["Zero downtime", "Rollback", "Load balancing"]},
            {q: "What is Infrastructure as Code and why is it important?", points: ["Terraform/Ansible", "Version control", "Reproducibility"]},
            {q: "Describe container orchestration with Kubernetes.", points: ["Pods", "Services", "Scaling"]},
            {q: "How do you monitor and troubleshoot production systems?", points: ["Logging", "Metrics", "Alerting"]},
        ],
        mobile: [
            {q: "Compare native vs cross-platform mobile development.", points: ["Performance", "Development speed", "Platform features"]},
            {q: "How do you handle offline functionality in mobile apps?", points: ["Local storage", "Sync strategies", "Conflict resolution"]},
            {q: "Explain mobile app lifecycle management.", points: ["Background states", "Memory management", "Push notifications"]},
            {q: "What security considerations are unique to mobile apps?", points: ["Data storage", "Network security", "Authentication"]},
        ],
    },
    behavioral: {
        all: [
            {q: "Tell me about a challenging project you worked on. How did you overcome obstacles?", points: ["Problem description", "Actions taken", "Results"]},
            {q: "Describe a time when you had to learn a new technology quickly.", points: ["Learning approach", "Application", "Outcome"]},
            {q: "How do you handle disagreements with team members?", points: ["Communication", "Compromise", "Resolution"]},
            {q: "Tell me about a time you made a mistake. How did you handle it?", points: ["Accountability", "Learning", "Prevention"]},
            {q: "Describe your approach to prioritizing tasks when everything is urgent.", points: ["Prioritization method", "Communication", "Delivery"]},
            {q: "How do you stay updated with industry trends?", points: ["Learning resources", "Practice", "Application"]},
            {q: "Tell me about a time you helped a struggling team member.", points: ["Empathy", "Support", "Outcome"]},
            {q: "Describe a situation where you had to meet a tight deadline.", points: ["Planning", "Execution", "Results"]},
        ],
    },
    coding: {
        easy: [
            {q: "Write a function to reverse a string.", starter: "function reverseString(str) {\n  // Your code here\n}", hints: ["Use array methods", "Or iterate backwards"]},
            {q: "Write a function to check if a number is palindrome.", starter: "function isPalindrome(num) {\n  // Your code here\n}", hints: ["Convert to string", "Compare reversed"]},
            {q: "Write a function to find the maximum element in an array.", starter: "function findMax(arr) {\n  // Your code here\n}", hints: ["Use Math.max", "Or iterate"]},
            {q: "Write a function to count vowels in a string.", starter: "function countVowels(str) {\n  // Your code here\n}", hints: ["Define vowels", "Iterate and count"]},
        ],
        medium: [
            {q: "Write a function to find the two numbers in an array that add up to a target.", starter: "function twoSum(nums, target) {\n  // Return indices of the two numbers\n}", hints: ["Use a hash map", "One pass solution"]},
            {q: "Write a function to check if two strings are anagrams.", starter: "function isAnagram(s1, s2) {\n  // Your code here\n}", hints: ["Sort and compare", "Or use frequency count"]},
            {q: "Write a function to find the longest substring without repeating characters.", starter: "function longestSubstring(str) {\n  // Return length of longest substring\n}", hints: ["Sliding window", "Track seen characters"]},
            {q: "Implement a function to merge two sorted arrays.", starter: "function mergeSorted(arr1, arr2) {\n  // Return merged sorted array\n}", hints: ["Two pointers", "Compare and merge"]},
        ],
        hard: [
            {q: "Implement a LRU Cache with get and put operations.", starter: "class LRUCache {\n  constructor(capacity) {\n    // Initialize\n  }\n  get(key) { }\n  put(key, value) { }\n}", hints: ["Use Map for O(1)", "Track access order"]},
            {q: "Write a function to find the median of two sorted arrays.", starter: "function findMedian(nums1, nums2) {\n  // Your code here\n}", hints: ["Binary search", "Partition arrays"]},
            {q: "Implement a trie (prefix tree) with insert and search.", starter: "class Trie {\n  constructor() { }\n  insert(word) { }\n  search(word) { }\n  startsWith(prefix) { }\n}", hints: ["Node with children map", "End-of-word marker"]},
        ],
    },
    'system-design': {
        all: [
            {q: "Design a URL shortening service like bit.ly.", points: ["Hashing algorithm", "Database design", "Scaling", "Analytics"]},
            {q: "Design a real-time notification system.", points: ["Push vs Pull", "WebSockets", "Message queues", "Scaling"]},
            {q: "Design a rate limiter for an API.", points: ["Algorithms", "Distributed systems", "Storage", "Fairness"]},
            {q: "Design a file storage service like Dropbox.", points: ["Chunking", "Sync", "Deduplication", "CDN"]},
            {q: "Design a social media feed system.", points: ["Fan-out", "Caching", "Ranking", "Real-time updates"]},
        ],
    },
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════
function getQuestionCount(mode)
{
    const counts={quick: 5, real: 10, coding: 3, practice: 5, mock: 8, full: 12};
    return counts[mode]||5;
}

function getGreeting(role, type, count)
{
    const roleDisplay=(role||'developer').replace(/-/g, ' ');
    const greetings=[
        `Welcome! I'll be your interviewer today for the ${roleDisplay} position. We'll go through ${count} questions focusing on ${type}. Take your time and feel free to ask for clarification.`,
        `Hello! Let's begin your ${type} interview for the ${roleDisplay} role. I have ${count} questions prepared. Remember, there's no single right answer - I'm interested in your thought process.`,
        `Hi there! Ready for your ${type} practice session? We'll cover ${count} questions relevant to ${roleDisplay}. Let's get started!`,
    ];
    return greetings[Math.floor(Math.random()*greetings.length)];
}

function getFallbackQuestion(role, type, difficulty, questionNum)
{
    const bank=QUESTION_BANK[type]||QUESTION_BANK.technical;

    let questions;
    if (type==='behavioral')
    {
        questions=bank.all;
    } else if (type==='coding')
    {
        questions=bank[difficulty]||bank.medium;
    } else if (type==='system-design')
    {
        questions=bank.all;
    } else
    {
        questions=bank[role]||bank.fullstack||Object.values(bank)[0];
    }

    if (!questions||questions.length===0)
    {
        questions=QUESTION_BANK.technical.fullstack;
    }

    const idx=(questionNum-1)%questions.length;
    const q=questions[idx];

    return {
        question: q.q,
        type: type,
        expectedPoints: q.points||[],
        hints: q.hints||['Think step by step', 'Consider edge cases'],
        starterCode: q.starter||null,
        questionNumber: questionNum,
        difficulty: difficulty,
    };
}

async function callGroqSafe(messages, options={})
{
    if (!process.env.GROQ_API_KEY) return null;

    try
    {
        const response=await axios.post(GROQ_URL, {
            messages,
            model: options.model||'llama-3.1-8b-instant',
            temperature: options.temperature||0.7,
            max_tokens: options.max_tokens||800,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            },
            timeout: GROQ_TIMEOUT,
        });
        return response.data.choices[0]?.message?.content||null;
    } catch (err)
    {
        console.warn('[PRACTICE] AI call failed:', err.message);
        return null;
    }
}

function safeJSON(text)
{
    if (!text) return null;
    try
    {
        const cleaned=text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const match=cleaned.match(/\{[\s\S]*\}/);
        return match? JSON.parse(match[0]):null;
    } catch
    {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

// POST /start - Start a new practice session
router.post('/start', verifyAuth, async (req, res) =>
{
    try
    {
        const {sessionId, role, difficulty='medium', interviewType='technical', mode='quick'}=req.body;

        if (!sessionId||!role)
        {
            return APIResponse.error(res, 'sessionId and role are required', 400);
        }

        const questionCount=getQuestionCount(mode);
        const greeting=getGreeting(role, interviewType, questionCount);

        // Create session data
        const sessionData={
            sessionId,
            odorId: req.user?.id||'anonymous',
            role,
            difficulty,
            interviewType,
            mode,
            questionCount,
            currentQuestion: 0,
            questions: [],
            responses: [],
            scores: [],
            startTime: new Date(),
            status: 'active',
        };

        // Try MongoDB first, fall back to memory
        try
        {
            await PracticeSession.findOneAndUpdate(
                {sessionId},
                {
                    sessionId,
                    userId: req.user.id,
                    role,
                    difficulty,
                    interviewType,
                    mode,
                    status: 'active',
                    totalQuestions: questionCount,
                    questionsAnswered: 0,
                    questions: [],
                    responses: [],
                    startTime: new Date(),
                },
                {upsert: true, new: true}
            );
        } catch (dbErr)
        {
            console.warn('[PRACTICE] MongoDB save failed, using memory:', dbErr.message);
        }

        // Always store in memory as backup
        memoryStore.set(sessionId, sessionData);

        return APIResponse.success(res, {
            sessionId,
            greeting,
            totalQuestions: questionCount,
            mode,
            difficulty,
        }, 'Session started');

    } catch (error)
    {
        console.error('[PRACTICE] Start error:', error.message);
        return APIResponse.serverError(res, error.message);
    }
});

// POST /next-question - Get the next question
router.post('/next-question', verifyAuth, async (req, res) =>
{
    try
    {
        const {sessionId, previousAnswer}=req.body;

        if (!sessionId)
        {
            return APIResponse.error(res, 'sessionId is required', 400);
        }

        // Get session from memory or MongoDB
        let session=memoryStore.get(sessionId);
        if (!session)
        {
            const dbSession=await PracticeSession.findOne({sessionId}).lean();
            if (dbSession)
            {
                session={
                    ...dbSession,
                    questionCount: dbSession.totalQuestions||getQuestionCount(dbSession.mode),
                    currentQuestion: dbSession.questionsAnswered||0,
                };
                memoryStore.set(sessionId, session);
            } else
            {
                // Create minimal session from request
                session={
                    sessionId,
                    role: req.body.role||'fullstack',
                    difficulty: req.body.difficulty||'medium',
                    interviewType: req.body.type||'technical',
                    mode: req.body.mode||'quick',
                    questionCount: getQuestionCount(req.body.mode||'quick'),
                    currentQuestion: 0,
                    questions: [],
                    responses: [],
                };
                memoryStore.set(sessionId, session);
            }
        }

        // Increment question number
        session.currentQuestion=(session.currentQuestion||0)+1;
        const qNum=session.currentQuestion;

        // Check if session is complete
        if (qNum>session.questionCount)
        {
            return APIResponse.success(res, {
                finished: true,
                totalQuestions: session.questionCount,
                message: 'All questions completed!',
            });
        }

        // Adaptive difficulty
        let currentDifficulty=session.difficulty;
        if (previousAnswer&&session.responses.length>=2)
        {
            const recentScores=session.responses.slice(-2).map(r => r.score||5);
            const avgRecent=recentScores.reduce((a, b) => a+b, 0)/recentScores.length;
            if (avgRecent>=8&&currentDifficulty!=='hard')
            {
                currentDifficulty=currentDifficulty==='easy'? 'medium':'hard';
            } else if (avgRecent<=4&&currentDifficulty!=='easy')
            {
                currentDifficulty=currentDifficulty==='hard'? 'medium':'easy';
            }
            session.difficulty=currentDifficulty;
        }

        // Get question (try AI, fallback to bank)
        let question=getFallbackQuestion(session.role, session.interviewType, currentDifficulty, qNum);

        // Try AI generation for variety
        const aiResponse=await callGroqSafe([
            {role: 'system', content: `You are an expert ${session.interviewType} interviewer for ${session.role} positions. Generate one unique interview question.`},
            {
                role: 'user', content: `Generate a ${currentDifficulty} level ${session.interviewType} question for a ${session.role} position. This is question ${qNum} of ${session.questionCount}.
            
Return JSON only: {"question": "your question", "hints": ["hint1", "hint2"], "expectedPoints": ["point1", "point2"]}`},
        ], {temperature: 0.8, max_tokens: 500});

        const aiQuestion=safeJSON(aiResponse);
        if (aiQuestion?.question)
        {
            question={
                question: aiQuestion.question,
                type: session.interviewType,
                expectedPoints: aiQuestion.expectedPoints||[],
                hints: aiQuestion.hints||['Think step by step'],
                questionNumber: qNum,
                difficulty: currentDifficulty,
            };
        }

        // Store question in session
        session.questions.push({
            questionNumber: qNum,
            question: question.question,
            timestamp: new Date(),
        });
        memoryStore.set(sessionId, session);

        // Try to persist to MongoDB
        try
        {
            await PracticeSession.findOneAndUpdate(
                {sessionId},
                {
                    $push: {questions: {questionId: `q${qNum}`, question: question.question, timestamp: new Date()}},
                    $set: {difficulty: currentDifficulty, questionsAnswered: qNum},
                }
            );
        } catch {/* ignore */}

        return APIResponse.success(res, {
            question,
            questionNumber: qNum,
            totalQuestions: session.questionCount,
            currentDifficulty,
            transitionMessage: qNum===1? "Let's start with your first question.":'Moving to the next question.',
        });

    } catch (error)
    {
        console.error('[PRACTICE] Next question error:', error.message);

        // Ultimate fallback
        const fallback=getFallbackQuestion('fullstack', 'technical', 'medium', 1);
        return APIResponse.success(res, {
            question: fallback,
            questionNumber: 1,
            totalQuestions: 5,
            currentDifficulty: 'medium',
            transitionMessage: "Let's begin.",
        });
    }
});

// POST /evaluate-answer - Evaluate an answer
router.post('/evaluate-answer', verifyAuth, async (req, res) =>
{
    try
    {
        const {sessionId, questionId, answer}=req.body;

        if (!answer||answer.trim().length<5)
        {
            return APIResponse.error(res, 'Please provide a more detailed answer', 400);
        }

        let session=memoryStore.get(sessionId);
        const question=session?.questions?.find(q => q.questionNumber===questionId)||{};

        // Try AI evaluation
        const aiResponse=await callGroqSafe([
            {role: 'system', content: 'You are a strict but fair technical interviewer. Score answers HONESTLY based on correctness and relevance. Do NOT give high scores to wrong, irrelevant, or nonsense answers.'},
            {
                role: 'user', content: `Evaluate this interview answer STRICTLY:

Question: ${question.question||'Interview question'}
Candidate's Answer: ${answer}

SCORING GUIDELINES (be strict):
- 1-2: Completely wrong, nonsense, or irrelevant answer
- 3-4: Mostly wrong with minor relevant points
- 5-6: Partially correct, missing key concepts
- 7-8: Good answer with minor gaps
- 9-10: Excellent, comprehensive answer

Return JSON ONLY:
{"score": <number 1-10>, "feedback": "honest feedback", "strengths": ["list strengths or empty"], "improvements": ["what to improve"], "followUp": "follow-up question"}`},
        ], {temperature: 0.3, max_tokens: 600});

        let evaluation=safeJSON(aiResponse);

        // Validate and fix inconsistent evaluations
        if (evaluation&&typeof evaluation.score==='number')
        {
            // If feedback mentions negative words but score is high, cap it
            const feedbackLower=(evaluation.feedback||'').toLowerCase();
            const negativeIndicators=['nonsense', 'irrelevant', 'wrong', 'incorrect', 'does not address', 'not attempt', 'gibberish', 'random'];
            const hasNegativeFeedback=negativeIndicators.some(word => feedbackLower.includes(word));

            if (hasNegativeFeedback&&evaluation.score>4)
            {
                evaluation.score=Math.min(evaluation.score, 3);
            }

            // Clamp score to valid range
            evaluation.score=Math.max(1, Math.min(10, Math.round(evaluation.score)));
        }

        // Fallback evaluation based on answer quality
        if (!evaluation||typeof evaluation.score!=='number')
        {
            const len=answer.trim().length;
            const hasKeywords=/function|return|if|for|while|const|let|var|class|def|import/.test(answer);
            const isGibberish=!/[aeiou]{1,2}[^aeiou]{1,3}/i.test(answer)||/(.)\1{4,}/.test(answer);

            let score;
            if (isGibberish||len<20)
            {
                score=2;
            } else if (!hasKeywords&&len<50)
            {
                score=3;
            } else if (len<100)
            {
                score=5;
            } else if (len<300)
            {
                score=6;
            } else
            {
                score=7;
            }

            evaluation={
                score,
                feedback: isGibberish
                    ? 'Your answer does not appear to address the question. Please provide a relevant response.'
                    :len<100
                        ? 'Your answer is quite brief. Try to provide more detail and examples.'
                        :'Thank you for your detailed response. Good effort!',
                strengths: score>=5? ['Attempted the question']:[],
                improvements: ['Provide a clear, relevant answer', 'Include specific examples'],
                followUp: 'Can you try again with a more relevant response?',
            };
        }

        // Store response
        if (session)
        {
            session.responses.push({
                questionNumber: questionId,
                answer,
                score: evaluation.score,
                timestamp: new Date(),
            });
            session.scores.push(evaluation.score);
            memoryStore.set(sessionId, session);
        }

        // Persist to MongoDB
        try
        {
            await PracticeSession.findOneAndUpdate(
                {sessionId},
                {
                    $push: {responses: {question: question.question, userAnswer: answer, score: evaluation.score, timestamp: new Date()}},
                }
            );
        } catch {/* ignore */}

        return APIResponse.success(res, {evaluation});

    } catch (error)
    {
        console.error('[PRACTICE] Evaluate error:', error.message);
        return APIResponse.success(res, {
            evaluation: {
                score: 5,
                feedback: 'Your answer has been recorded.',
                strengths: ['Good effort'],
                improvements: ['Continue practicing'],
                followUp: 'Would you like to move to the next question?',
            },
        });
    }
});

// POST /finish - Complete the session
router.post('/finish', verifyAuth, async (req, res) =>
{
    try
    {
        const {sessionId}=req.body;

        let session=memoryStore.get(sessionId);
        if (!session)
        {
            const dbSession=await PracticeSession.findOne({sessionId}).lean();
            session=dbSession||{responses: [], questions: []};
        }

        const responses=session.responses||[];
        const scores=responses.map(r => r.score||5);
        const avgScore=scores.length>0? scores.reduce((a, b) => a+b, 0)/scores.length:5;

        // Calculate category scores
        const feedback={
            overallScore: Math.round(avgScore*10),
            questionsAnswered: responses.length,
            totalQuestions: session.questionCount||session.totalQuestions||5,
            scores: {
                technical: Math.round((avgScore+Math.random())*10),
                communication: Math.round((avgScore+Math.random()*0.5)*10),
                problemSolving: Math.round((avgScore-0.5+Math.random())*10),
                confidence: Math.round((avgScore+Math.random()*0.3)*10),
            },
            strengths: ['Good understanding of fundamentals', 'Clear communication'],
            improvements: ['Provide more specific examples', 'Consider edge cases'],
            recommendation: avgScore>=7? 'Strong candidate':avgScore>=5? 'Shows potential':'Needs more preparation',
            nextSteps: ['Practice more coding problems', 'Review system design concepts', 'Work on behavioral questions'],
        };

        // Try AI feedback
        const aiFeedback=await callGroqSafe([
            {role: 'system', content: 'Generate brief interview feedback.'},
            {
                role: 'user', content: `Generate feedback for interview with avg score ${avgScore.toFixed(1)}/10 and ${responses.length} questions answered.
Return JSON: {"strengths": ["s1", "s2"], "improvements": ["i1", "i2"], "recommendation": "brief recommendation"}`},
        ], {temperature: 0.6, max_tokens: 400});

        const aiData=safeJSON(aiFeedback);
        if (aiData)
        {
            feedback.strengths=aiData.strengths||feedback.strengths;
            feedback.improvements=aiData.improvements||feedback.improvements;
            feedback.recommendation=aiData.recommendation||feedback.recommendation;
        }

        // Cleanup and persist
        memoryStore.delete(sessionId);
        try
        {
            await PracticeSession.findOneAndUpdate(
                {sessionId},
                {status: 'completed', endTime: new Date(), score: avgScore}
            );
        } catch {/* ignore */}

        return APIResponse.success(res, {feedback});

    } catch (error)
    {
        console.error('[PRACTICE] Finish error:', error.message);
        return APIResponse.success(res, {
            feedback: {
                overallScore: 50,
                questionsAnswered: 0,
                totalQuestions: 5,
                scores: {technical: 50, communication: 50, problemSolving: 50, confidence: 50},
                strengths: ['Completed the session'],
                improvements: ['Practice more questions'],
                recommendation: 'Keep practicing!',
                nextSteps: ['Try more practice sessions'],
            },
        });
    }
});

// GET /history - Get user's practice history
router.get('/history', verifyAuth, async (req, res) =>
{
    try
    {
        const sessions=await PracticeSession.find({userId: req.user.id})
            .sort({startTime: -1})
            .limit(20)
            .select('sessionId role interviewType difficulty status startTime endTime score questionsAnswered totalQuestions')
            .lean();

        return APIResponse.success(res, {sessions});
    } catch (error)
    {
        console.error('[PRACTICE] History error:', error.message);
        return APIResponse.success(res, {sessions: []});
    }
});

export default router;
