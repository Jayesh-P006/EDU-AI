import express from 'express';
import {v4 as uuidv4} from 'uuid';
import {verifyAuth} from '../middleware/auth.js';
import questionBank from '../services/questionBank.js';

const router=express.Router();

// Custom questions added via API (supplement the question bank)
export const customQuestions=[];

// Get all questions (from question bank + any custom ones)
router.get('/', verifyAuth, (req, res) =>
{
    try
    {
        const {difficulty, category}=req.query;
        // Merge question bank questions with custom questions
        const bankQuestions=questionBank.getAllQuestions({difficulty, domain: category});
        let allQuestions=[...bankQuestions, ...customQuestions];

        if (difficulty&&customQuestions.length)
        {
            allQuestions=allQuestions.filter(q => q.difficulty===difficulty);
        }
        if (category&&customQuestions.length)
        {
            allQuestions=allQuestions.filter(q => (q.category||q.domain)===category);
        }

        res.json({success: true, data: allQuestions});
    } catch (error)
    {
        console.error('[QUESTIONS] Fetch error:', error.message);
        res.status(500).json({success: false, error: 'Failed to fetch questions'});
    }
});

// IMPORTANT: Specific routes MUST come before parameterized /:id route
// Get random questions
router.get('/random/:count', verifyAuth, (req, res) =>
{
    const count=parseInt(req.params.count);
    if (isNaN(count)||count<1)
    {
        return res.status(400).json({error: 'Invalid count parameter'});
    }
    const allQuestions=[...questionBank.getAllQuestions(), ...customQuestions];
    const shuffled=allQuestions.sort(() => 0.5-Math.random());
    res.json(shuffled.slice(0, Math.min(count, shuffled.length)));
});

// Get question by ID — must come AFTER /random/:count
router.get('/:id', verifyAuth, (req, res) =>
{
    // Look up in question bank first, then custom questions
    let question=questionBank.getQuestionById(req.params.id);
    if (!question)
    {
        question=customQuestions.find(q => q.id===req.params.id);
    }
    if (!question)
    {
        return res.status(404).json({error: 'Question not found'});
    }
    res.json(question);
});

// Create custom question — use explicit fields, not ...req.body spread
router.post('/', verifyAuth, (req, res) =>
{
    // Support both flat body and nested {question: {...}} format
    const data=req.body.question||req.body;
    const {title, difficulty, category, description, examples, starterCode}=data;

    if (!title||!description)
    {
        return res.status(400).json({error: 'title and description are required'});
    }

    const question={
        id: uuidv4(),
        title,
        difficulty: difficulty||'medium',
        category: category||'general',
        description,
        examples: Array.isArray(examples)? examples:[],
        starterCode: starterCode||{},
        testCases: Array.isArray(data.testCases)? data.testCases:[],
        functionName: data.functionName||null,
        constraints: Array.isArray(data.constraints)? data.constraints:[],
        hints: Array.isArray(data.hints)? data.hints:[],
        createdAt: new Date(),
        isCustom: true,
    };
    customQuestions.push(question);
    res.status(201).json(question);
});

// Update question — only custom questions can be edited
router.put('/:id', verifyAuth, (req, res) =>
{
    const index=customQuestions.findIndex(q => q.id===req.params.id);
    if (index===-1)
    {
        return res.status(404).json({error: 'Question not found or is a built-in question'});
    }

    const {title, difficulty, category, description, examples, starterCode}=req.body;
    if (title) customQuestions[index].title=title;
    if (difficulty) customQuestions[index].difficulty=difficulty;
    if (category) customQuestions[index].category=category;
    if (description) customQuestions[index].description=description;
    if (examples) customQuestions[index].examples=examples;
    if (starterCode) customQuestions[index].starterCode=starterCode;
    customQuestions[index].updatedAt=new Date();

    res.json(customQuestions[index]);
});

// Delete question — only custom questions can be deleted
router.delete('/:id', verifyAuth, (req, res) =>
{
    const index=customQuestions.findIndex(q => q.id===req.params.id);
    if (index===-1)
    {
        return res.status(404).json({error: 'Question not found or is a built-in question'});
    }

    customQuestions.splice(index, 1);
    res.json({success: true, message: 'Question deleted'});
});

export default router;
