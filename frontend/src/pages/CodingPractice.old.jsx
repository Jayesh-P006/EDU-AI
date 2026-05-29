import {useState, useEffect} from 'react';
import CodeEditor from '../components/CodeEditor';
import api from '../services/api';
import
  {
    Play, Send, ChevronDown, ChevronRight, CheckCircle, XCircle,
    Terminal, FlaskConical, Clock, Code2, FileText, RotateCcw, Maximize2, Minimize2
  } from 'lucide-react';
import './CodingPractice.css';

function CodingPractice()
{
  const [questions, setQuestions]=useState([]);
  const [selectedQuestion, setSelectedQuestion]=useState(null);
  const [code, setCode]=useState('');
  const [language, setLanguage]=useState('javascript');
  const [output, setOutput]=useState('');
  const [loading, setLoading]=useState(false);
  const [testResults, setTestResults]=useState(null);
  const [activeTab, setActiveTab]=useState('output');
  const [sidebarCollapsed, setSidebarCollapsed]=useState(false);
  const [outputExpanded, setOutputExpanded]=useState(false);
  const [runTime, setRunTime]=useState(null);

  useEffect(() =>
  {
    fetchQuestions();
  }, []);

  const fetchQuestions=async () =>
  {
    try
    {
      const response=await api.get('/coding-practice/questions');
      setQuestions(response.data.questions||[]);
      if (response.data.questions&&response.data.questions.length>0)
      {
        selectQuestion(response.data.questions[0]);
      }
    } catch (error)
    {
      console.error('Error fetching questions:', error);
      const mockQuestions=[
        {
          id: 1,
          title: 'Two Sum',
          difficulty: 'Easy',
          description: 'Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.',
          exampleInput: '[2, 7, 11, 15], target = 9',
          exampleOutput: '[0, 1]',
          testCases: []
        }
      ];
      setQuestions(mockQuestions);
      selectQuestion(mockQuestions[0]);
    }
  };

  const selectQuestion=(question) =>
  {
    setSelectedQuestion(question);
    setCode(getStarterCode(question, language));
    setOutput('');
    setTestResults(null);
    setRunTime(null);
  };

  const getStarterCode=(question, lang) =>
  {
    const starters={
      javascript: `// ${question.title}\nfunction solution() {\n  // Write your code here\n  \n}\n\nsolution();`,
      python: `# ${question.title}\ndef solution():\n    # Write your code here\n    pass\n\nsolution()`,
      java: `// ${question.title}\npublic class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}`
    };
    return starters[lang]||starters.javascript;
  };

  const handleLanguageChange=(newLanguage) =>
  {
    setLanguage(newLanguage);
    if (selectedQuestion)
    {
      setCode(getStarterCode(selectedQuestion, newLanguage));
    }
  };

  const handleReset=() =>
  {
    if (selectedQuestion)
    {
      setCode(getStarterCode(selectedQuestion, language));
      setOutput('');
      setTestResults(null);
      setRunTime(null);
    }
  };

  const handleRunCode=async () =>
  {
    setLoading(true);
    setOutput('');
    setActiveTab('output');
    const start=Date.now();

    try
    {
      const response=await api.post('/coding-practice/run', {
        code, language,
        questionId: selectedQuestion.id
      });

      setRunTime(Date.now()-start);
      setOutput(response.data.output||'Code executed successfully (no output)');
      setTestResults(response.data.testResults);
    } catch (error)
    {
      setRunTime(Date.now()-start);
      setOutput('Error: '+(error.response?.data?.error||'Failed to execute code'));
    } finally
    {
      setLoading(false);
    }
  };

  const handleSubmit=async () =>
  {
    setLoading(true);
    setActiveTab('tests');
    const start=Date.now();

    try
    {
      const response=await api.post('/coding-practice/submit', {
        code, language,
        questionId: selectedQuestion.id
      });

      setRunTime(Date.now()-start);
      setTestResults(response.data.testResults);
      if (response.data.allPassed)
      {
        setOutput('All test cases passed! Great job!');
      } else
      {
        setOutput('Some test cases failed. Keep trying!');
      }
    } catch (error)
    {
      setRunTime(Date.now()-start);
      setOutput('Error: '+(error.response?.data?.error||'Failed to submit code'));
    } finally
    {
      setLoading(false);
    }
  };

  const difficultyColor=(d) =>
  {
    const dl=d?.toLowerCase();
    if (dl==='easy') return '#22c55e';
    if (dl==='medium') return '#f59e0b';
    return '#ef4444';
  };

  const passedCount=testResults? testResults.filter(r => r.passed).length:0;
  const totalTests=testResults? testResults.length:0;

  return (
    <div className="cp-ide">
      {/* ── Problem Sidebar ── */}
      <div className={`cp-ide-sidebar ${sidebarCollapsed? 'collapsed':''}`}>
        <div className="cp-ide-sidebar-header">
          {!sidebarCollapsed&&<h3><FileText size={16} /> Problems</h3>}
          <button className="cp-collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            {sidebarCollapsed? <ChevronRight size={16} />:<ChevronDown size={16} />}
          </button>
        </div>
        {!sidebarCollapsed&&(
          <div className="cp-ide-questions">
            {questions.map(q => (
              <div
                key={q.id}
                className={`cp-ide-question ${selectedQuestion?.id===q.id? 'active':''}`}
                onClick={() => selectQuestion(q)}
              >
                <span className="cp-q-title">{q.title}</span>
                <span className="cp-q-diff" style={{color: difficultyColor(q.difficulty), borderColor: difficultyColor(q.difficulty)}}>
                  {q.difficulty}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Main Area ── */}
      <div className="cp-ide-main">
        {selectedQuestion&&(
          <>
            {/* Problem Description */}
            <div className="cp-ide-problem">
              <div className="cp-ide-problem-header">
                <h1>{selectedQuestion.title}</h1>
                <span className="cp-ide-diff-badge" style={{color: difficultyColor(selectedQuestion.difficulty), borderColor: difficultyColor(selectedQuestion.difficulty)}}>
                  {selectedQuestion.difficulty}
                </span>
              </div>
              <p className="cp-ide-desc">{selectedQuestion.description}</p>
              <div className="cp-ide-example">
                <h4>Example:</h4>
                <div className="cp-ide-example-box">
                  <div className="cp-ide-example-line"><span className="cp-label">Input:</span> <code>{selectedQuestion.exampleInput}</code></div>
                  <div className="cp-ide-example-line"><span className="cp-label">Output:</span> <code>{selectedQuestion.exampleOutput}</code></div>
                </div>
              </div>
            </div>

            {/* Code Editor + Output */}
            <div className={`cp-ide-workspace ${outputExpanded? 'output-expanded':''}`}>
              {/* Toolbar */}
              <div className="cp-ide-toolbar">
                <div className="cp-ide-toolbar-left">
                  <div className="cp-ide-lang-select">
                    <Code2 size={14} />
                    <select value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                      <option value="java">Java</option>
                    </select>
                  </div>
                  <button className="cp-ide-tool-btn" onClick={handleReset} title="Reset Code">
                    <RotateCcw size={14} />
                  </button>
                </div>
                <div className="cp-ide-toolbar-right">
                  <button className="cp-ide-run-btn" onClick={handleRunCode} disabled={loading}>
                    <Play size={14} /> {loading? 'Running...':'Run'}
                  </button>
                  <button className="cp-ide-submit-btn" onClick={handleSubmit} disabled={loading}>
                    <Send size={14} /> Submit
                  </button>
                </div>
              </div>

              {/* Editor */}
              <div className="cp-ide-editor">
                <CodeEditor
                  code={code}
                  onChange={setCode}
                  language={language}
                />
              </div>

              {/* Output Panel */}
              <div className={`cp-ide-output ${outputExpanded? 'expanded':''}`}>
                <div className="cp-ide-output-header">
                  <div className="cp-ide-output-tabs">
                    <button
                      className={`cp-ide-tab ${activeTab==='output'? 'active':''}`}
                      onClick={() => setActiveTab('output')}
                    >
                      <Terminal size={13} /> Output
                    </button>
                    <button
                      className={`cp-ide-tab ${activeTab==='tests'? 'active':''}`}
                      onClick={() => setActiveTab('tests')}
                    >
                      <FlaskConical size={13} /> Test Results
                      {testResults&&(
                        <span className={`cp-ide-tab-badge ${passedCount===totalTests? 'pass':'fail'}`}>
                          {passedCount}/{totalTests}
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="cp-ide-output-controls">
                    {runTime!=null&&(
                      <span className="cp-ide-runtime">
                        <Clock size={12} /> {runTime}ms
                      </span>
                    )}
                    <button className="cp-ide-expand-btn" onClick={() => setOutputExpanded(!outputExpanded)} title={outputExpanded? 'Minimize':'Maximize'}>
                      {outputExpanded? <Minimize2 size={14} />:<Maximize2 size={14} />}
                    </button>
                  </div>
                </div>

                <div className="cp-ide-output-body">
                  {activeTab==='output'&&(
                    <div className="cp-ide-output-content">
                      {loading? (
                        <div className="cp-ide-output-loading">
                          <div className="cp-ide-spinner" />
                          <span>Executing code...</span>
                        </div>
                      ):output? (
                        <pre>{output}</pre>
                      ):(
                        <p className="cp-ide-output-empty">Click "Run" to see output here</p>
                      )}
                    </div>
                  )}

                  {activeTab==='tests'&&(
                    <div className="cp-ide-test-results">
                      {!testResults? (
                        <p className="cp-ide-output-empty">Click "Submit" to run test cases</p>
                      ):(
                        <>
                          <div className="cp-ide-test-summary">
                            <span className={passedCount===totalTests? 'pass':'fail'}>
                              {passedCount===totalTests? <CheckCircle size={16} />:<XCircle size={16} />}
                              {passedCount}/{totalTests} test cases passed
                            </span>
                          </div>
                          <div className="cp-ide-test-list">
                            {testResults.map((result, index) => (
                              <div key={index} className={`cp-ide-test-case ${result.passed? 'passed':'failed'}`}>
                                <div className="cp-ide-test-header">
                                  {result.passed? <CheckCircle size={14} />:<XCircle size={14} />}
                                  <span>Test Case {index+1}</span>
                                  <span className="cp-ide-test-status">{result.passed? 'Passed':'Failed'}</span>
                                </div>
                                {result.input&&(
                                  <div className="cp-ide-test-detail">
                                    <span className="cp-label">Input:</span> <code>{JSON.stringify(result.input)}</code>
                                  </div>
                                )}
                                {result.expected!==undefined&&(
                                  <div className="cp-ide-test-detail">
                                    <span className="cp-label">Expected:</span> <code>{JSON.stringify(result.expected)}</code>
                                  </div>
                                )}
                                {result.actual!==undefined&&!result.passed&&(
                                  <div className="cp-ide-test-detail">
                                    <span className="cp-label">Got:</span> <code className="error">{JSON.stringify(result.actual)}</code>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
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
