import {useState, useEffect, useCallback} from 'react';
import CodeEditor from '../components/CodeEditor';
import api from '../services/api';
import
{
    Play, Send, ChevronDown, ChevronRight, CheckCircle, XCircle,
    Terminal, FlaskConical, Clock, Code2, FileText, RotateCcw, Maximize2, Minimize2,
    Sparkles, Lightbulb, Loader2, Filter, Eye, EyeOff, AlertCircle, Trophy,
    Shield, BarChart3, MessageSquare, Search, Zap, TrendingUp, TrendingDown
} from 'lucide-react';
import './CodingPractice.css';

const AI_TOPICS=['Arrays', 'Strings', 'Linked Lists', 'Trees', 'Graphs', 'Dynamic Programming',
    'Sorting', 'Searching', 'Hash Tables', 'Stacks & Queues', 'Recursion', 'Math', 'Greedy', 'Backtracking'];

function CodingPractice({embedded})
{
    const [questions, setQuestions]=useState([]);
    const [selectedQuestion, setSelectedQuestion]=useState(null);
    const [code, setCode]=useState('');
    const [language, setLanguage]=useState('javascript');
    const [output, setOutput]=useState('');
    const [loading, setLoading]=useState(false);
    const [submitting, setSubmitting]=useState(false);
    const [testResults, setTestResults]=useState(null);
    const [activeTab, setActiveTab]=useState('output');
    const [sidebarCollapsed, setSidebarCollapsed]=useState(false);
    const [outputExpanded, setOutputExpanded]=useState(false);
    const [runTime, setRunTime]=useState(null);

    // AI generation state
    const [showAIPanel, setShowAIPanel]=useState(false);
    const [aiDifficulty, setAiDifficulty]=useState('Medium');
    const [aiTopics, setAiTopics]=useState([]);
    const [generating, setGenerating]=useState(false);
    const [aiCustomPrompt, setAiCustomPrompt]=useState('');

    // Hint
    const [hint, setHint]=useState('');
    const [hintLoading, setHintLoading]=useState(false);

    // Filter
    const [difficultyFilter, setDifficultyFilter]=useState('');

    // Submit status
    const [submitStatus, setSubmitStatus]=useState(null); // 'accepted' | 'wrong' | null
    const [fetchingQuestions, setFetchingQuestions]=useState(true);
    const [fetchError, setFetchError]=useState('');

    // AI Prompt
    const [promptText, setPromptText]=useState('');
    const [promptResponse, setPromptResponse]=useState('');
    const [promptLoading, setPromptLoading]=useState(false);

    // AI Code Detection
    const [detection, setDetection]=useState(null);
    const [detectLoading, setDetectLoading]=useState(false);

    // AI Code Analysis
    const [analysis, setAnalysis]=useState(null);
    const [analysisLoading, setAnalysisLoading]=useState(false);

    useEffect(() => {fetchQuestions();}, []);

    const fetchQuestions=async () =>
    {
        setFetchingQuestions(true);
        setFetchError('');
        try
        {
            const response=await api.get('/coding-practice/questions');
            const qs=(response.data.questions||[]).map(q =>
            {
                const allTC=q.testCases||[];
                return {
                    ...q,
                    _allTestCases: allTC,
                    testCases: allTC.filter(tc => !tc.hidden),
                    totalTestCases: allTC.length,
                    hiddenTestCases: allTC.filter(tc => tc.hidden).length
                };
            });
            setQuestions(qs);
            if (qs.length>0) selectQuestion(qs[0]);
        } catch (error)
        {
            console.error('Error loading question:', error);
            setFetchError('Failed to load questions. Click AI Generate to create one.');
        } finally {setFetchingQuestions(false);}
    };

    const selectQuestion=(question) =>
    {
        setSelectedQuestion(question);
        setCode(getStarterCode(question, language));
        setOutput('');
        setTestResults(null);
        setRunTime(null);
        setHint('');
        setSubmitStatus(null);
    };

    const getStarterCode=(question, lang) =>
    {
        if (question.starterCode&&question.starterCode[lang]) return question.starterCode[lang];
        const starters={
            javascript: `// ${question.title}\nfunction solution() {\n  // Write your code here\n}\n`,
            python: `# ${question.title}\ndef solution():\n    # Write your code here\n    pass\n`,
            java: `// ${question.title}\npublic class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}`,
            cpp: `// ${question.title}\n#include <vector>\nusing namespace std;\n\n// Write your code here\n`
        };
        return starters[lang]||starters.javascript;
    };

    const handleLanguageChange=(newLang) =>
    {
        setLanguage(newLang);
        if (selectedQuestion) setCode(getStarterCode(selectedQuestion, newLang));
    };

    const handleReset=() =>
    {
        if (selectedQuestion)
        {
            setCode(getStarterCode(selectedQuestion, language));
            setOutput('');
            setTestResults(null);
            setRunTime(null);
            setHint('');
            setSubmitStatus(null);
        }
    };

    // ── Run (visible test cases only) ──
    const handleRunCode=async () =>
    {
        setLoading(true);
        setOutput('');
        setTestResults(null);
        setActiveTab('output');
        setSubmitStatus(null);
        const start=Date.now();
        try
        {
            const payload={code, language, questionId: selectedQuestion.id};
            if (selectedQuestion.isAIGenerated)
            {
                payload.testCases=selectedQuestion.testCases||[];
                payload.functionName=selectedQuestion.functionName||{};
            }
            const response=await api.post('/coding-practice/run', payload);
            setRunTime(Date.now()-start);
            if (response.data.results)
            {
                setTestResults(response.data.results);
                setActiveTab('tests');
                setOutput(response.data.output||'');
            } else
            {
                setOutput(response.data.output||'Code executed successfully (no output)');
            }
        } catch (error)
        {
            setRunTime(Date.now()-start);
            setOutput('Error: '+(error.response?.data?.error||'Failed to execute code'));
        } finally {setLoading(false);}
    };

    // ── Submit (all test cases including hidden) ──
    const handleSubmit=async () =>
    {
        setSubmitting(true);
        setTestResults(null);
        setActiveTab('tests');
        setSubmitStatus(null);
        const start=Date.now();
        try
        {
            const payload={code, language, questionId: selectedQuestion.id};
            if (selectedQuestion.isAIGenerated)
            {
                // For AI questions include ALL test cases (visible+hidden from generation)
                payload.testCases=selectedQuestion._allTestCases||selectedQuestion.testCases||[];
                payload.functionName=selectedQuestion.functionName||{};
            }
            const response=await api.post('/coding-practice/submit', payload);
            setRunTime(Date.now()-start);
            setTestResults(response.data.results);
            setSubmitStatus(response.data.solved? 'accepted':'wrong');
            setOutput(response.data.message||'');
        } catch (error)
        {
            setRunTime(Date.now()-start);
            setOutput('Error: '+(error.response?.data?.error||'Failed to submit code'));
            setSubmitStatus('wrong');
        } finally {setSubmitting(false);}
    };

    // ── AI Question Generation ──
    const handleGenerate=async () =>
    {
        setGenerating(true);
        try
        {
            const response=await api.post('/coding-practice/generate', {
                difficulty: aiDifficulty,
                topics: aiTopics.length>0? aiTopics:undefined,
                language,
                customPrompt: aiCustomPrompt.trim()||undefined
            });
            if (response.data.success&&response.data.question)
            {
                const q=response.data.question;
                // Store all test cases privately, expose only visible ones for display
                const allTC=q.testCases||[];
                q._allTestCases=allTC;
                q.testCases=allTC.filter(tc => !tc.hidden);
                q.totalTestCases=allTC.length;
                q.hiddenTestCases=allTC.filter(tc => tc.hidden).length;

                setQuestions(prev => [q, ...prev]);
                selectQuestion(q);
                setShowAIPanel(false);
            }
        } catch (error)
        {
            console.error('AI generation error:', error);
            setOutput('Failed to generate question: '+(error.response?.data?.error||error.message));
        } finally {setGenerating(false);}
    };

    // ── Get Hint ──
    const handleHint=async () =>
    {
        if (!selectedQuestion) return;
        setHintLoading(true);
        try
        {
            const response=await api.post('/coding-practice/hint', {
                code, language,
                title: selectedQuestion.title,
                description: selectedQuestion.description
            });
            setHint(response.data.hint||'No hint available.');
        } catch (error)
        {
            setHint('Could not load hint. Try breaking the problem into smaller parts.');
        } finally {setHintLoading(false);}
    };

    const toggleAiTopic=(topic) =>
    {
        setAiTopics(prev => prev.includes(topic)? prev.filter(t => t!==topic):[...prev, topic]);
    };

    // ── AI Prompt (ask AI for help) ──
    const handlePrompt=async () =>
    {
        if (!promptText.trim()) return;
        setPromptLoading(true);
        setPromptResponse('');
        try
        {
            const response=await api.post('/coding-practice/prompt', {
                prompt: promptText, language, currentCode: code,
                title: selectedQuestion?.title, description: selectedQuestion?.description
            });
            setPromptResponse(response.data.response||'No response.');
            setActiveTab('prompt');
        } catch (error)
        {
            setPromptResponse('Error: '+(error.response?.data?.error||'Failed to get AI response'));
        } finally {setPromptLoading(false);}
    };

    // ── AI Code Detection ──
    const handleDetect=async () =>
    {
        if (!code||code.trim().length<20) {setDetection({error: 'Write at least 20 characters of code first.'}); setActiveTab('detect'); return;}
        setDetectLoading(true);
        setDetection(null);
        setActiveTab('detect');
        try
        {
            const response=await api.post('/coding-practice/detect', {code, language});
            setDetection(response.data.detection);
        } catch (error)
        {
            setDetection({error: error.response?.data?.error||'Detection failed'});
        } finally {setDetectLoading(false);}
    };

    // ── AI Code Analysis ──
    const handleAnalyze=async () =>
    {
        if (!code||code.trim().length<10) {setAnalysis({error: 'Write some code first.'}); setActiveTab('analysis'); return;}
        setAnalysisLoading(true);
        setAnalysis(null);
        setActiveTab('analysis');
        try
        {
            const response=await api.post('/coding-practice/analyze', {
                code, language,
                title: selectedQuestion?.title, description: selectedQuestion?.description
            });
            setAnalysis(response.data.analysis);
        } catch (error)
        {
            setAnalysis({error: error.response?.data?.error||'Analysis failed'});
        } finally {setAnalysisLoading(false);}
    };

    const difficultyColor=(d) =>
    {
        const dl=d?.toLowerCase();
        if (dl==='easy') return '#22c55e';
        if (dl==='medium') return '#f59e0b';
        return '#ef4444';
    };

    const filteredQuestions=difficultyFilter
        ? questions.filter(q => q.difficulty?.toLowerCase()===difficultyFilter.toLowerCase())
        :questions;

    const visibleResults=testResults?.visibleTests||[];
    const hiddenResults=testResults?.hiddenTests||[];
    const passedCount=testResults? testResults.passedTests:0;
    const totalTests=testResults? testResults.totalTests:0;

    return (
        <div className={`cp-ide ${embedded? 'cp-ide-embedded':''}`}>
            {/* ── Sidebar ── */}
            <div className={`cp-ide-sidebar ${sidebarCollapsed? 'collapsed':''}`}>
                <div className="cp-ide-sidebar-header">
                    {!sidebarCollapsed&&<h3><FileText size={16} /> Problems</h3>}
                    <button className="cp-collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                        {sidebarCollapsed? <ChevronRight size={16} />:<ChevronDown size={16} />}
                    </button>
                </div>

                {!sidebarCollapsed&&(
                    <>
                        {/* Controls */}
                        <div className="cp-sidebar-controls">
                            <button className={`cp-ai-gen-btn ${showAIPanel? 'active':''}`} onClick={() => setShowAIPanel(!showAIPanel)}>
                                <Sparkles size={14} /> {showAIPanel? 'Close AI':'AI Generate'}
                            </button>
                            <select className="cp-filter-select" value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)}>
                                <option value="">All Levels</option>
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                        </div>

                        {/* AI Generation Panel */}
                        {showAIPanel&&(
                            <div className="cp-ai-panel">
                                <h4><Sparkles size={14} /> Generate AI Question</h4>
                                <div className="cp-ai-diff-btns">
                                    {['Easy', 'Medium', 'Hard'].map(d => (
                                        <button key={d} className={`cp-ai-diff-btn ${aiDifficulty===d? 'active':''}`}
                                            style={{
                                                borderColor: difficultyColor(d), color: aiDifficulty===d? '#fff':difficultyColor(d),
                                                background: aiDifficulty===d? difficultyColor(d):'transparent'
                                            }}
                                            onClick={() => setAiDifficulty(d)}>{d}</button>
                                    ))}
                                </div>
                                <div className="cp-ai-topics">
                                    {AI_TOPICS.map(t => (
                                        <button key={t} className={`cp-ai-topic-btn ${aiTopics.includes(t)? 'active':''}`}
                                            onClick={() => toggleAiTopic(t)}>{t}</button>
                                    ))}
                                </div>
                                <div className="cp-ai-prompt-section">
                                    <textarea
                                        className="cp-ai-prompt-input"
                                        value={aiCustomPrompt}
                                        onChange={e => setAiCustomPrompt(e.target.value)}
                                        placeholder="Optional: Add custom requirements... e.g. 'Include recursion' or 'Focus on edge cases'"
                                        rows={2}
                                    />
                                </div>
                                <button className="cp-ai-generate-btn" onClick={handleGenerate} disabled={generating}>
                                    {generating? <><Loader2 size={14} className="cp-spin" /> Generating...</>:<><Sparkles size={14} /> Generate Question</>}
                                </button>
                            </div>
                        )}

                        {/* Questions List */}
                        <div className="cp-ide-questions">
                            {fetchingQuestions? (
                                <div className="cp-no-questions">
                                    <Loader2 size={18} className="cp-spin" />
                                    <p>Loading questions...</p>
                                </div>
                            ):fetchError&&filteredQuestions.length===0? (
                                <div className="cp-no-questions">
                                    <AlertCircle size={18} />
                                    <p>{fetchError}</p>
                                    <button onClick={() => {setShowAIPanel(true); setDifficultyFilter('');}}>
                                        <Sparkles size={14} /> Generate with AI
                                    </button>
                                    <button onClick={fetchQuestions} className="cp-retry-btn">
                                        <RotateCcw size={14} /> Retry
                                    </button>
                                </div>
                            ):filteredQuestions.length===0? (
                                <div className="cp-no-questions">
                                    <p>No questions match filter.</p>
                                    <button onClick={() => {setShowAIPanel(true); setDifficultyFilter('');}}>
                                        <Sparkles size={14} /> Generate one with AI
                                    </button>
                                </div>
                            ):(
                                filteredQuestions.map(q => (
                                    <div key={q.id} className={`cp-ide-question ${selectedQuestion?.id===q.id? 'active':''}`}
                                        onClick={() => selectQuestion(q)}>
                                        <span className="cp-q-title">
                                            {q.isAIGenerated&&<Sparkles size={12} className="cp-ai-icon" />}
                                            {q.title}
                                        </span>
                                        <span className="cp-q-diff" style={{color: difficultyColor(q.difficulty), borderColor: difficultyColor(q.difficulty)}}>
                                            {q.difficulty}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ── Main Area ── */}
            <div className="cp-ide-main">
                {!selectedQuestion? (
                    <div className="cp-ide-empty">
                        <Code2 size={48} />
                        <h2>Select a Problem</h2>
                        <p>Choose from the sidebar or generate an AI question</p>
                        <button className="cp-ai-gen-btn-big" onClick={() => {setSidebarCollapsed(false); setShowAIPanel(true);}}>
                            <Sparkles size={16} /> Generate AI Question
                        </button>
                    </div>
                ):(
                    <>
                        {/* Problem Description */}
                        <div className="cp-ide-problem">
                            <div className="cp-ide-problem-header">
                                <h1>
                                    {selectedQuestion.isAIGenerated&&<Sparkles size={18} className="cp-ai-icon" />}
                                    {selectedQuestion.title}
                                </h1>
                                <span className="cp-ide-diff-badge" style={{color: difficultyColor(selectedQuestion.difficulty), borderColor: difficultyColor(selectedQuestion.difficulty)}}>
                                    {selectedQuestion.difficulty}
                                </span>
                            </div>

                            {/* Tags */}
                            {selectedQuestion.topics&&selectedQuestion.topics.length>0&&(
                                <div className="cp-ide-tags">
                                    {selectedQuestion.topics.map((t, i) => <span key={i} className="cp-ide-tag">{t}</span>)}
                                </div>
                            )}

                            <p className="cp-ide-desc">{selectedQuestion.description}</p>

                            {/* Examples */}
                            {selectedQuestion.examples&&selectedQuestion.examples.length>0&&(
                                <div className="cp-ide-example">
                                    <h4>Examples:</h4>
                                    {selectedQuestion.examples.map((ex, i) => (
                                        <div key={i} className="cp-ide-example-box">
                                            <div className="cp-ide-example-line"><span className="cp-label">Input:</span> <code>{typeof ex.input==='object'? JSON.stringify(ex.input):String(ex.input)}</code></div>
                                            <div className="cp-ide-example-line"><span className="cp-label">Output:</span> <code>{typeof ex.output==='object'? JSON.stringify(ex.output):String(ex.output)}</code></div>
                                            {ex.explanation&&<div className="cp-ide-example-line"><span className="cp-label">Explanation:</span> {ex.explanation}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Constraints */}
                            {selectedQuestion.constraints&&selectedQuestion.constraints.length>0&&(
                                <div className="cp-ide-constraints">
                                    <h4>Constraints:</h4>
                                    <ul>{selectedQuestion.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul>
                                </div>
                            )}

                            {/* Visible Test Cases */}
                            {selectedQuestion.testCases&&selectedQuestion.testCases.length>0&&(
                                <div className="cp-ide-testcases">
                                    <h4><FlaskConical size={14} /> Test Cases ({selectedQuestion.testCases.length} visible{selectedQuestion.hiddenTestCases>0&&`, ${selectedQuestion.hiddenTestCases} hidden`}):</h4>
                                    {selectedQuestion.testCases.map((tc, i) => (
                                        <div key={i} className="cp-ide-tc-box">
                                            <div className="cp-ide-tc-label">Test Case {i+1}</div>
                                            <div className="cp-ide-tc-row">
                                                <span className="cp-label">Input:</span>
                                                <code>{typeof tc.input==='object'? JSON.stringify(tc.input):String(tc.input)}</code>
                                            </div>
                                            <div className="cp-ide-tc-row">
                                                <span className="cp-label">Expected:</span>
                                                <code>{typeof tc.output==='object'? JSON.stringify(tc.output):String(tc.output)}</code>
                                            </div>
                                        </div>
                                    ))}
                                    {selectedQuestion.hiddenTestCases>0&&(
                                        <div className="cp-ide-tc-hidden-note">
                                            <EyeOff size={12} /> + {selectedQuestion.hiddenTestCases} hidden test cases will run on Submit
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Hint */}
                            <button className="cp-hint-btn" onClick={handleHint} disabled={hintLoading}>
                                {hintLoading? <Loader2 size={14} className="cp-spin" />:<Lightbulb size={14} />}
                                {hintLoading? 'Loading...':'Get Hint'}
                            </button>
                            {hint&&<div className="cp-hint-box">{hint}</div>}
                        </div>

                        {/* Code + Output */}
                        <div className={`cp-ide-workspace ${outputExpanded? 'output-expanded':''}`}>
                            <div className="cp-ide-toolbar">
                                <div className="cp-ide-toolbar-left">
                                    <div className="cp-ide-lang-select">
                                        <Code2 size={14} />
                                        <select value={language} onChange={e => handleLanguageChange(e.target.value)}>
                                            <option value="javascript">JavaScript</option>
                                            <option value="python">Python</option>
                                            <option value="java">Java</option>
                                            <option value="cpp">C++</option>
                                        </select>
                                    </div>
                                    <button className="cp-ide-tool-btn" onClick={handleReset} title="Reset Code">
                                        <RotateCcw size={14} />
                                    </button>
                                </div>
                                <div className="cp-ide-toolbar-right">
                                    <button className="cp-toolbar-detect-btn" onClick={handleDetect} disabled={detectLoading} title="Check if code is AI-generated">
                                        <Shield size={14} /> {detectLoading? '...':'Detect AI'}
                                    </button>
                                    <button className="cp-toolbar-analyze-btn" onClick={handleAnalyze} disabled={analysisLoading} title="Analyze code quality">
                                        <BarChart3 size={14} /> {analysisLoading? '...':'Analyze'}
                                    </button>
                                    <button className="cp-ide-run-btn" onClick={handleRunCode} disabled={loading||submitting}>
                                        {loading? <Loader2 size={14} className="cp-spin" />:<Play size={14} />} {loading? 'Running...':'Run'}
                                    </button>
                                    <button className="cp-ide-submit-btn" onClick={handleSubmit} disabled={loading||submitting}>
                                        {submitting? <Loader2 size={14} className="cp-spin" />:<Send size={14} />} {submitting? 'Submitting...':'Submit'}
                                    </button>
                                </div>
                            </div>

                            <div className="cp-ide-editor">
                                <CodeEditor code={code} onChange={setCode} language={language} />
                            </div>

                            {/* Output Panel */}
                            <div className={`cp-ide-output ${outputExpanded? 'expanded':''}`}>
                                <div className="cp-ide-output-header">
                                    <div className="cp-ide-output-tabs">
                                        <button className={`cp-ide-tab ${activeTab==='output'? 'active':''}`} onClick={() => setActiveTab('output')}>
                                            <Terminal size={13} /> Output
                                        </button>
                                        <button className={`cp-ide-tab ${activeTab==='tests'? 'active':''}`} onClick={() => setActiveTab('tests')}>
                                            <FlaskConical size={13} /> Tests
                                            {testResults&&(
                                                <span className={`cp-ide-tab-badge ${testResults.allPassed? 'pass':'fail'}`}>
                                                    {passedCount}/{totalTests}
                                                </span>
                                            )}
                                        </button>
                                        <button className={`cp-ide-tab ${activeTab==='prompt'? 'active':''}`} onClick={() => setActiveTab('prompt')}>
                                            <MessageSquare size={13} /> AI Prompt
                                        </button>
                                        <button className={`cp-ide-tab ${activeTab==='detect'? 'active':''}`} onClick={() => setActiveTab('detect')}>
                                            <Shield size={13} /> Detection
                                            {detection&&!detection.error&&(
                                                <span className="cp-ide-tab-badge" style={{background: detection.color||'#888'}}>{detection.finalScore}%</span>
                                            )}
                                        </button>
                                        <button className={`cp-ide-tab ${activeTab==='analysis'? 'active':''}`} onClick={() => setActiveTab('analysis')}>
                                            <BarChart3 size={13} /> Analysis
                                            {analysis&&!analysis.error&&(
                                                <span className="cp-ide-tab-badge" style={{background: analysis.overallScore>=70? '#22c55e':analysis.overallScore>=40? '#f59e0b':'#ef4444'}}>{analysis.overallScore}</span>
                                            )}
                                        </button>
                                    </div>
                                    <div className="cp-ide-output-controls">
                                        {runTime!=null&&<span className="cp-ide-runtime"><Clock size={12} /> {runTime}ms</span>}
                                        <button className="cp-ide-expand-btn" onClick={() => setOutputExpanded(!outputExpanded)}
                                            title={outputExpanded? 'Minimize':'Maximize'}>
                                            {outputExpanded? <Minimize2 size={14} />:<Maximize2 size={14} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="cp-ide-output-body">
                                    {/* Submit status banner */}
                                    {submitStatus&&(
                                        <div className={`cp-submit-status ${submitStatus}`}>
                                            {submitStatus==='accepted'? <><Trophy size={16} /> Accepted – All test cases passed!</>
                                                :<><AlertCircle size={16} /> Wrong Answer – Some test cases failed</>}
                                        </div>
                                    )}

                                    {activeTab==='output'&&(
                                        <div className="cp-ide-output-content">
                                            {loading? (
                                                <div className="cp-ide-output-loading"><div className="cp-ide-spinner" /><span>Executing code...</span></div>
                                            ):output? (<pre>{output}</pre>):(
                                                <p className="cp-ide-output-empty">Click "Run" to see output here</p>
                                            )}
                                        </div>
                                    )}

                                    {activeTab==='tests'&&(
                                        <div className="cp-ide-test-results">
                                            {!testResults? (
                                                <p className="cp-ide-output-empty">Click "Run" or "Submit" to run test cases</p>
                                            ):(
                                                <>
                                                    <div className="cp-ide-test-summary">
                                                        <span className={testResults.allPassed? 'pass':'fail'}>
                                                            {testResults.allPassed? <CheckCircle size={16} />:<XCircle size={16} />}
                                                            {passedCount}/{totalTests} test cases passed
                                                        </span>
                                                    </div>

                                                    {/* Visible Test Cases */}
                                                    <div className="cp-ide-test-list">
                                                        {visibleResults.map((result, index) => (
                                                            <div key={index} className={`cp-ide-test-case ${result.passed? 'passed':'failed'}`}>
                                                                <div className="cp-ide-test-header">
                                                                    {result.passed? <CheckCircle size={14} />:<XCircle size={14} />}
                                                                    <span>Test Case {result.caseNumber||index+1}</span>
                                                                    <span className="cp-ide-test-status">{result.passed? 'Passed':'Failed'}</span>
                                                                    {result.executionTime!=null&&<span className="cp-ide-test-time"><Clock size={11} /> {result.executionTime}ms</span>}
                                                                </div>
                                                                {result.input&&(
                                                                    <div className="cp-ide-test-detail">
                                                                        <span className="cp-label">Input:</span>
                                                                        <code>{typeof result.input==='object'? JSON.stringify(result.input):String(result.input)}</code>
                                                                    </div>
                                                                )}
                                                                {result.expectedOutput!==undefined&&(
                                                                    <div className="cp-ide-test-detail">
                                                                        <span className="cp-label">Expected:</span>
                                                                        <code>{typeof result.expectedOutput==='object'? JSON.stringify(result.expectedOutput):String(result.expectedOutput)}</code>
                                                                    </div>
                                                                )}
                                                                {result.actualOutput!==undefined&&!result.passed&&(
                                                                    <div className="cp-ide-test-detail">
                                                                        <span className="cp-label">Got:</span>
                                                                        <code className="error">{typeof result.actualOutput==='object'? JSON.stringify(result.actualOutput):String(result.actualOutput)}</code>
                                                                    </div>
                                                                )}
                                                                {result.error&&(
                                                                    <div className="cp-ide-test-detail">
                                                                        <span className="cp-label">Error:</span>
                                                                        <code className="error">{result.error}</code>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Hidden Test Cases Summary */}
                                                    {hiddenResults.length>0&&(
                                                        <div className="cp-hidden-tests-section">
                                                            <div className="cp-hidden-test-header">
                                                                <EyeOff size={14} /> Hidden Test Cases
                                                            </div>
                                                            <div className="cp-hidden-summary">
                                                                {hiddenResults.map((h, i) => (
                                                                    <div key={i} className={`cp-hidden-dot ${h.passed? 'pass':'fail'}`} title={`Hidden #${h.caseNumber}: ${h.passed? 'Passed':'Failed'}`}>
                                                                        {h.passed? <CheckCircle size={12} />:<XCircle size={12} />}
                                                                    </div>
                                                                ))}
                                                                <span className="cp-hidden-count">
                                                                    {hiddenResults.filter(h => h.passed).length}/{hiddenResults.length} passed
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* AI Prompt Tab */}
                                    {activeTab==='prompt'&&(
                                        <div className="cp-prompt-panel">
                                            <div className="cp-prompt-input-area">
                                                <textarea
                                                    className="cp-prompt-textarea"
                                                    value={promptText}
                                                    onChange={e => setPromptText(e.target.value)}
                                                    placeholder="Ask about your code... e.g. 'How can I optimize this?' or 'Explain the time complexity'"
                                                    rows={3}
                                                    onKeyDown={e => {if (e.key==='Enter'&&!e.shiftKey) {e.preventDefault(); handlePrompt();} }}
                                                />
                                                <button className="cp-prompt-send-btn" onClick={handlePrompt} disabled={promptLoading||!promptText.trim()}>
                                                    {promptLoading? <Loader2 size={16} className="cp-spin" />:<Send size={16} />}
                                                    {promptLoading? 'Thinking...':'Ask AI'}
                                                </button>
                                            </div>
                                            {promptResponse&&(
                                                <div className="cp-prompt-response">
                                                    <div className="cp-prompt-response-header">
                                                        <Sparkles size={14} /> AI Response
                                                    </div>
                                                    <div className="cp-prompt-response-body">
                                                        <pre className="cp-prompt-text">{promptResponse}</pre>
                                                    </div>
                                                </div>
                                            )}
                                            {!promptResponse&&!promptLoading&&(
                                                <div className="cp-prompt-hints">
                                                    <p className="cp-prompt-hints-title"><Lightbulb size={14} /> Try asking:</p>
                                                    <div className="cp-prompt-suggestions">
                                                        {['How can I optimize this solution?', 'Explain the time complexity', 'What edge cases should I handle?', 'Suggest a different approach'].map(s => (
                                                            <button key={s} className="cp-prompt-suggestion" onClick={() => {setPromptText(s);}}>{s}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* AI Detection Tab */}
                                    {activeTab==='detect'&&(
                                        <div className="cp-detect-panel">
                                            {detectLoading&&(
                                                <div className="cp-detect-loading">
                                                    <Loader2 size={24} className="cp-spin" />
                                                    <span>Analyzing code patterns...</span>
                                                </div>
                                            )}
                                            {!detection&&!detectLoading&&(
                                                <div className="cp-detect-empty">
                                                    <Shield size={32} />
                                                    <p>Click <strong>"Detect AI"</strong> in the toolbar to check if your code appears AI-generated.</p>
                                                </div>
                                            )}
                                            {detection&&!detection.error&&(
                                                <div className="cp-detect-results">
                                                    <div className="cp-detect-score-section">
                                                        <div className="cp-detect-gauge" style={{'--score-color': detection.color||'#888'}}>
                                                            <div className="cp-detect-score-circle">
                                                                <span className="cp-detect-score-value">{detection.finalScore}%</span>
                                                                <span className="cp-detect-score-label">AI Score</span>
                                                            </div>
                                                        </div>
                                                        <div className="cp-detect-verdict-box" style={{borderColor: detection.color||'#888'}}>
                                                            <span className="cp-detect-verdict">{detection.verdict}</span>
                                                            <span className="cp-detect-confidence">Confidence: {detection.confidence}</span>
                                                        </div>
                                                    </div>

                                                    {detection.details&&(
                                                        <div className="cp-detect-details">
                                                            <h4><Search size={14} /> Analysis Breakdown</h4>
                                                            {detection.details.heuristic!==undefined&&(
                                                                <div className="cp-detect-detail-row">
                                                                    <span className="cp-detect-detail-label">Heuristic Analysis</span>
                                                                    <div className="cp-detect-bar-track">
                                                                        <div className="cp-detect-bar-fill" style={{width: `${detection.details.heuristic}%`, background: detection.details.heuristic>60? '#ef4444':'#22c55e'}} />
                                                                    </div>
                                                                    <span className="cp-detect-detail-value">{detection.details.heuristic}%</span>
                                                                </div>
                                                            )}
                                                            {detection.details.behavior!==undefined&&(
                                                                <div className="cp-detect-detail-row">
                                                                    <span className="cp-detect-detail-label">Behavior Analysis</span>
                                                                    <div className="cp-detect-bar-track">
                                                                        <div className="cp-detect-bar-fill" style={{width: `${detection.details.behavior}%`, background: detection.details.behavior>60? '#ef4444':'#22c55e'}} />
                                                                    </div>
                                                                    <span className="cp-detect-detail-value">{detection.details.behavior}%</span>
                                                                </div>
                                                            )}
                                                            {detection.details.aiAnalysis!==undefined&&(
                                                                <div className="cp-detect-detail-row">
                                                                    <span className="cp-detect-detail-label">AI Pattern Detection</span>
                                                                    <div className="cp-detect-bar-track">
                                                                        <div className="cp-detect-bar-fill" style={{width: `${detection.details.aiAnalysis}%`, background: detection.details.aiAnalysis>60? '#ef4444':'#22c55e'}} />
                                                                    </div>
                                                                    <span className="cp-detect-detail-value">{detection.details.aiAnalysis}%</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {detection.suggestions&&detection.suggestions.length>0&&(
                                                        <div className="cp-detect-suggestions">
                                                            <h4><Lightbulb size={14} /> Suggestions</h4>
                                                            <ul>
                                                                {detection.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {detection&&detection.error&&(
                                                <div className="cp-detect-error">
                                                    <AlertCircle size={16} /> {detection.error}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* AI Analysis Tab */}
                                    {activeTab==='analysis'&&(
                                        <div className="cp-analysis-panel">
                                            {analysisLoading&&(
                                                <div className="cp-detect-loading">
                                                    <Loader2 size={24} className="cp-spin" />
                                                    <span>Analyzing code quality...</span>
                                                </div>
                                            )}
                                            {!analysis&&!analysisLoading&&(
                                                <div className="cp-detect-empty">
                                                    <BarChart3 size={32} />
                                                    <p>Click <strong>"Analyze"</strong> in the toolbar to get a detailed code quality analysis.</p>
                                                </div>
                                            )}
                                            {analysis&&!analysis.error&&(
                                                <div className="cp-analysis-results">
                                                    <div className="cp-analysis-header">
                                                        <div className="cp-analysis-score-ring" style={{'--ring-color': analysis.overallScore>=70? '#22c55e':analysis.overallScore>=40? '#f59e0b':'#ef4444'}}>
                                                            <span className="cp-analysis-score-num">{analysis.overallScore}</span>
                                                            <span className="cp-analysis-score-lbl">/100</span>
                                                        </div>
                                                        <div className="cp-analysis-metrics">
                                                            <div className="cp-analysis-metric">
                                                                <Zap size={14} /> <strong>Time:</strong> {analysis.timeComplexity||'N/A'}
                                                            </div>
                                                            <div className="cp-analysis-metric">
                                                                <Search size={14} /> <strong>Space:</strong> {analysis.spaceComplexity||'N/A'}
                                                            </div>
                                                            {analysis.approach&&(
                                                                <div className="cp-analysis-metric">
                                                                    <Code2 size={14} /> <strong>Approach:</strong> {analysis.approach}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="cp-analysis-bars">
                                                        {[{label: 'Readability', val: analysis.readability}, {label: 'Efficiency', val: analysis.efficiency}, {label: 'Correctness', val: analysis.correctness}].map(m => (
                                                            <div key={m.label} className="cp-analysis-bar-row">
                                                                <span className="cp-analysis-bar-label">{m.label}</span>
                                                                <div className="cp-detect-bar-track">
                                                                    <div className="cp-detect-bar-fill" style={{width: `${m.val||0}%`, background: (m.val||0)>=70? '#22c55e':(m.val||0)>=40? '#f59e0b':'#ef4444'}} />
                                                                </div>
                                                                <span className="cp-detect-detail-value">{m.val||0}%</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {analysis.strengths&&analysis.strengths.length>0&&(
                                                        <div className="cp-analysis-list cp-analysis-strengths">
                                                            <h4><TrendingUp size={14} /> Strengths</h4>
                                                            <ul>{analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                                        </div>
                                                    )}
                                                    {analysis.weaknesses&&analysis.weaknesses.length>0&&(
                                                        <div className="cp-analysis-list cp-analysis-weaknesses">
                                                            <h4><TrendingDown size={14} /> Weaknesses</h4>
                                                            <ul>{analysis.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                                        </div>
                                                    )}
                                                    {analysis.suggestions&&analysis.suggestions.length>0&&(
                                                        <div className="cp-analysis-list cp-analysis-suggestions">
                                                            <h4><Lightbulb size={14} /> Suggestions</h4>
                                                            <ul>{analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                                        </div>
                                                    )}
                                                    {analysis.codeSmells&&analysis.codeSmells.length>0&&(
                                                        <div className="cp-analysis-list cp-analysis-smells">
                                                            <h4><AlertCircle size={14} /> Code Smells</h4>
                                                            <ul>{analysis.codeSmells.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {analysis&&analysis.error&&(
                                                <div className="cp-detect-error">
                                                    <AlertCircle size={16} /> {analysis.error}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default CodingPractice;
