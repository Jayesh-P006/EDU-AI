import {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {getRandomQuestions, executeCode, submitCode, interviewChat} from '../services/api';
import CodeEditor from '../components/CodeEditor';
import
{
    Bot, Home, Lightbulb, Play, CheckCircle, XCircle, AlertTriangle,
    ChevronLeft, ChevronRight, Send
} from 'lucide-react';
import './PracticeMode.css';

function PracticeMode()
{
    const navigate=useNavigate();
    const [questions, setQuestions]=useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex]=useState(0);
    const [code, setCode]=useState('');
    const [language, setLanguage]=useState('javascript');
    const [output, setOutput]=useState('');
    const [feedback, setFeedback]=useState('');
    const [loading, setLoading]=useState(false);
    const [showHint, setShowHint]=useState(false);
    const [aiMessages, setAiMessages]=useState([]);
    const [userMessage, setUserMessage]=useState('');

    useEffect(() =>
    {
        loadQuestions();
    }, []);

    useEffect(() =>
    {
        if (questions.length>0)
        {
            const currentQuestion=questions[currentQuestionIndex];
            setCode(currentQuestion.starterCode[language]||'');
        }
    }, [currentQuestionIndex, language, questions]);

    const loadQuestions=async () =>
    {
        try
        {
            const response=await getRandomQuestions(5);
            setQuestions(response.data);

            // Welcome message from AI
            setAiMessages([{
                role: 'ai',
                message: "Hello! I'm your AI interviewer. Let's start with some coding problems. Take your time and feel free to ask questions!",
                timestamp: new Date(),
            }]);
        } catch (error)
        {
            console.error('Error loading questions:', error);
        }
    };

    const currentQuestion=questions[currentQuestionIndex];

    const handleRunCode=async () =>
    {
        setLoading(true);
        try
        {
            const response=await executeCode({code, language});
            setOutput(response.data.output||'No output');

            // AI comment
            addAIMessage("Good! Your code executed successfully. Now try submitting it to run against all test cases.");
        } catch (error)
        {
            setOutput('Error executing code');
        } finally
        {
            setLoading(false);
        }
    };

    const handleSubmitCode=async () =>
    {
        setLoading(true);
        try
        {
            const response=await submitCode({
                code,
                language,
                questionId: currentQuestion.id,
            });

            const results=response.data;
            const summary=`Test Results: ${results.passed}/${results.total} passed\n\n`+
                results.results.map((r, i) =>
                    `Test ${i+1}: ${r.passed? 'Passed':'Failed'} - ${r.runtime}`
                ).join('\n');

            setOutput(summary);

            // Generate AI feedback
            if (results.passed===results.total)
            {
                setFeedback('All test cases passed. Great job!');
                addAIMessage("Perfect! You solved it correctly. Let's move to the next question.");
            } else
            {
                setFeedback(`${results.passed}/${results.total} test cases passed. Review the failed cases.`);
                addAIMessage("Good attempt! Some test cases failed. Think about edge cases and try again.");
            }
        } catch (error)
        {
            setOutput('Error submitting code');
        } finally
        {
            setLoading(false);
        }
    };

    const handleNextQuestion=() =>
    {
        if (currentQuestionIndex<questions.length-1)
        {
            setCurrentQuestionIndex(currentQuestionIndex+1);
            setOutput('');
            setFeedback('');
            setShowHint(false);
            addAIMessage("Here's your next question. Take your time to understand it first.");
        } else
        {
            addAIMessage("Congratulations! You've completed all the questions. Great practice session!");
        }
    };

    const handlePreviousQuestion=() =>
    {
        if (currentQuestionIndex>0)
        {
            setCurrentQuestionIndex(currentQuestionIndex-1);
            setOutput('');
            setFeedback('');
            setShowHint(false);
        }
    };

    const addAIMessage=(message) =>
    {
        setAiMessages(prev => [...prev, {
            role: 'ai',
            message,
            timestamp: new Date(),
        }]);
    };

    const handleSendMessage=async () =>
    {
        if (!userMessage.trim()) return;

        // Add user message
        setAiMessages(prev => [...prev, {
            role: 'user',
            message: userMessage,
            timestamp: new Date(),
        }]);

        try
        {
            const response=await interviewChat({message: userMessage});
            addAIMessage(response.data.response);
        } catch (error)
        {
            addAIMessage("I'm here to help! Keep working on the problem.");
        }

        setUserMessage('');
    };

    if (!currentQuestion)
    {
        return <div className="loading">Loading questions...</div>;
    }

    return (
        <div className="practice-mode">
            {/* Header */}
            <div className="practice-header">
                <div>
                    <h2><Bot size={20} /> Practice Interview</h2>
                    <span className="question-counter">
                        Question {currentQuestionIndex+1} of {questions.length}
                    </span>
                </div>
                <div>
                    <button className="btn btn-secondary" onClick={() => navigate('/')}>
                        <Home size={16} /> Home
                    </button>
                </div>
            </div>

            <div className="practice-content">
                {/* AI Chat Panel */}
                <div className="ai-panel card">
                    <div className="ai-header">
                        <div className="ai-avatar"><Bot size={24} /></div>
                        <div>
                            <h3>AI Interviewer</h3>
                            <p>I'm here to help you practice!</p>
                        </div>
                    </div>

                    <div className="ai-messages">
                        {aiMessages.map((msg, index) => (
                            <div key={index} className={`message ${msg.role}`}>
                                <div className="message-content">{msg.message}</div>
                                <div className="message-time">
                                    {msg.timestamp.toLocaleTimeString()}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="ai-input">
                        <input
                            type="text"
                            className="input"
                            placeholder="Ask the AI for help..."
                            value={userMessage}
                            onChange={(e) => setUserMessage(e.target.value)}
                            onKeyPress={(e) => e.key==='Enter'&&handleSendMessage()}
                        />
                        <button className="btn btn-primary" onClick={handleSendMessage}>
                            Send
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="practice-main">
                    {/* Question */}
                    <div className="card question-card">
                        <div className="question-header-section">
                            <h3>{currentQuestion.title}</h3>
                            <span className={`badge badge-${currentQuestion.difficulty}`}>
                                {currentQuestion.difficulty}
                            </span>
                        </div>

                        <p className="question-description">{currentQuestion.description}</p>

                        <div className="examples">
                            <h4>Examples:</h4>
                            {currentQuestion.examples.map((ex, i) => (
                                <div key={i} className="example">
                                    <div><strong>Input:</strong> {typeof ex.input==='object'? JSON.stringify(ex.input):String(ex.input)}</div>
                                    <div><strong>Output:</strong> {typeof ex.output==='object'? JSON.stringify(ex.output):String(ex.output)}</div>
                                </div>
                            ))}
                        </div>

                        {feedback&&(
                            <div className={`alert ${feedback.includes('passed. Great')? 'alert-success':'alert-warning'}`}>
                                {feedback}
                            </div>
                        )}

                        <div className="question-actions">
                            <button className="btn btn-secondary" onClick={() => setShowHint(!showHint)}>
                                <Lightbulb size={14} /> {showHint? 'Hide':'Show'} Hint
                            </button>
                            <button className="btn btn-secondary" onClick={handlePreviousQuestion}
                                disabled={currentQuestionIndex===0}>
                                <ChevronLeft size={14} /> Previous
                            </button>
                            <button className="btn btn-primary" onClick={handleNextQuestion}
                                disabled={currentQuestionIndex===questions.length-1}>
                                Next <ChevronRight size={14} />
                            </button>
                        </div>

                        {showHint&&(
                            <div className="hint alert alert-info" style={{marginTop: '12px', background: '#dbeafe', color: '#1e40af'}}>
                                <Lightbulb size={14} /> Try using a hash map to store values for O(n) time complexity.
                            </div>
                        )}
                    </div>

                    {/* Code Editor */}
                    <div className="editor-card card">
                        <div className="editor-header">
                            <select
                                className="select"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                            >
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                            </select>

                            <div className="editor-actions">
                                <button className="btn btn-secondary" onClick={handleRunCode} disabled={loading}>
                                    <Play size={14} /> Run
                                </button>
                                <button className="btn btn-success" onClick={handleSubmitCode} disabled={loading}>
                                    <CheckCircle size={14} /> Submit
                                </button>
                            </div>
                        </div>

                        <CodeEditor
                            code={code}
                            language={language}
                            onChange={setCode}
                        />

                        <div className="output-section">
                            <div className="output-header">Output:</div>
                            <pre className="output-content">{output||'Run your code to see results...'}</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PracticeMode;
