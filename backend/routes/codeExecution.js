import express from 'express';
import {verifyAuth} from '../middleware/auth.js';
import {validateRequest, codeExecutionSchemas} from '../middleware/validation.js';
import {APIResponse} from '../middleware/response.js';
import testRunner from '../services/testRunner.js';
import questionBank from '../services/questionBank.js';
import {customQuestions} from './questions.js';
import AIInterview from '../models/AIInterview.js';

const router=express.Router();

// Helper: find question in questionBank OR customQuestions
function findQuestion(questionId)
{
    if (!questionId) return null;
    let q=questionBank.getQuestionById(questionId);
    if (q) return q;
    q=customQuestions.find(cq => cq.id===questionId);
    return q||null;
}

// Execute code (run without full submission — for "Run Code" button)
router.post('/execute', verifyAuth, async (req, res) =>
{
    const {code, language, questionId, interviewId}=req.body;

    if (!code||typeof code!=='string')
    {
        return APIResponse.error(res, 'code is required and must be a string', 400);
    }
    if (!language||typeof language!=='string')
    {
        return APIResponse.error(res, 'language is required', 400);
    }

    try
    {
        // If a questionId is provided, run against visible test cases only
        if (questionId)
        {
            const question=findQuestion(questionId);
            if (question&&question.testCases&&question.testCases.length>0)
            {
                const visibleTests=question.testCases.filter(tc => !tc.hidden);
                if (visibleTests.length>0)
                {
                    const results=await testRunner.runTests(code, language, visibleTests, question.functionName);
                    const output=formatTestResults(results, false);
                    return APIResponse.success(res, {
                        output,
                        passed: results.passedTests,
                        total: results.totalTests,
                        results: results.testResults.map(r => ({
                            testCase: r.caseNumber,
                            passed: r.passed,
                            expected: String(r.expectedOutput),
                            actual: String(r.actualOutput||r.error||'No output'),
                            runtime: `${r.executionTime||0}ms`,
                        })),
                        executionTime: `${results.testResults.reduce((s, r) => s+(r.executionTime||0), 0)}ms`,
                    });
                }
            }
        }

        // No question / no test cases — just run the code directly
        const result=await testRunner.executeCode(code, language);
        APIResponse.success(res, {
            output: result.error? `Error: ${result.error}`:(result.output||'No output'),
            executionTime: '—',
            status: result.error? 'Error':'Accepted',
        });

    } catch (error)
    {
        console.error('Code execution error:', error);
        APIResponse.serverError(res, 'Code execution failed');
    }
});

// Submit code — run against ALL test cases (visible + hidden), save to interview
router.post('/submit', verifyAuth, validateRequest(codeExecutionSchemas.submit), async (req, res) =>
{
    try
    {
        const {code, language, questionId, interviewId}=req.body;

        if (!code||typeof code!=='string')
        {
            return APIResponse.error(res, 'code is required', 400);
        }

        // Look up question from question bank or custom questions
        const question=findQuestion(questionId);

        // If question has test cases, run against them
        if (question&&question.testCases&&question.testCases.length>0)
        {
            // Run code against ALL test cases (visible + hidden)
            const results=await testRunner.runTests(code, language, question.testCases, question.functionName);

            // Build per-test-case results (hide hidden test details)
            const testResults=results.testResults.map(r => ({
                testCase: r.caseNumber,
                passed: r.passed,
                expected: r.hidden? 'Hidden':String(r.expectedOutput),
                actual: r.hidden? (r.passed? 'Correct':'Wrong'):String(r.actualOutput||r.error||'No output'),
                runtime: `${r.executionTime||0}ms`,
                hidden: r.hidden,
            }));

            // Save submission to interview record if interviewId is provided
            await saveSubmission(interviewId, code, language, questionId, results.passedTests, results.totalTests);

            return APIResponse.success(res, {
                passed: results.passedTests,
                total: results.totalTests,
                allPassed: results.allPassed,
                results: testResults,
                executionTime: `${results.testResults.reduce((s, r) => s+(r.executionTime||0), 0)}ms`,
                score: Math.round((results.passedTests/results.totalTests)*100),
            });
        }

        // No test cases (AI-generated / custom question) — just execute the code
        const result=await testRunner.executeCode(code, language);
        const hasError=!!result.error;

        await saveSubmission(interviewId, code, language, questionId, hasError? 0:1, 1);

        APIResponse.success(res, {
            passed: hasError? 0:1,
            total: 1,
            allPassed: !hasError,
            results: [{
                testCase: 1,
                passed: !hasError,
                expected: 'Successful execution',
                actual: hasError? result.error:(result.output||'No output'),
                runtime: '—',
                hidden: false,
            }],
            output: hasError? `Error: ${result.error}`:(result.output||'No output'),
            executionTime: '—',
            score: hasError? 0:100,
        });

    } catch (error)
    {
        console.error('Code submission error:', error);
        APIResponse.serverError(res, 'Code submission failed');
    }
});

// Helper: save code submission to interview record
async function saveSubmission(interviewId, code, language, questionId, passed, total)
{
    if (!interviewId) return;
    try
    {
        const interview=await AIInterview.findOne({
            $or: [{sessionId: interviewId}, ...(interviewId.match(/^[0-9a-fA-F]{24}$/)? [{_id: interviewId}]:[])]
        });
        if (interview&&interview.status==='active')
        {
            interview.codeSubmissions.push({
                code, language, questionId,
                passed, total,
                timestamp: new Date(),
            });
            await interview.save();
        }
    } catch (dbErr)
    {
        console.error('[CODE-EXEC] Failed to save submission to interview:', dbErr.message);
    }
}

// Helper: format test results into readable output string
function formatTestResults(results, includeHidden=false)
{
    let output=`Test Results: ${results.passedTests}/${results.totalTests} passed\n\n`;
    for (const r of results.testResults)
    {
        if (r.hidden&&!includeHidden)
        {
            output+=`Test ${r.caseNumber} (Hidden): ${r.passed? '✓ Passed':'✗ Failed'}\n`;
        } else
        {
            output+=`Test ${r.caseNumber}: ${r.passed? '✓ Passed':'✗ Failed'}\n`;
            output+=`  Input: ${JSON.stringify(r.input)}\n`;
            output+=`  Expected: ${JSON.stringify(r.expectedOutput)}\n`;
            output+=`  Actual: ${r.actualOutput||r.error||'No output'}\n`;
        }
        output+='\n';
    }
    return output;
}

export default router;
