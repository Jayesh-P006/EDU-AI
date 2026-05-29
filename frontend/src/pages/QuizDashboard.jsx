import {useState, useEffect, useCallback} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import './QuizDashboard.css';

const API_URL=import.meta.env.VITE_API_URL||'http://localhost:5000';

const DIFFICULTY_COLORS={easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444'};
const STATUS_LABELS={draft: 'Draft', waiting: 'Open', active: 'Live', question_open: 'Live', question_closed: 'Live', completed: 'Ended'};

async function apiFetch(path, opts={})
{
    const res=await fetch(`${API_URL}${path}`, {
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        ...opts,
    });
    if (!res.ok)
    {
        const err=await res.json().catch(() => ({}));
        throw new Error(err.error||`Request failed (${res.status})`);
    }
    return res.json();
}

export default function QuizDashboard()
{
    const navigate=useNavigate();
    const [searchParams]=useSearchParams();
    const [quizzes, setQuizzes]=useState([]);
    const [loading, setLoading]=useState(true);
    const [view, setView]=useState(searchParams.get('view')||(searchParams.get('code')? 'join':'list')); // list | create | edit | browse | join
    const [selectedQuiz, setSelectedQuiz]=useState(null);
    const [publicQuizzes, setPublicQuizzes]=useState([]);
    const [browseLoading, setBrowseLoading]=useState(false);
    const [error, setError]=useState('');
    const [successMsg, setSuccessMsg]=useState('');

    // Join quiz state
    const [joinCode, setJoinCode]=useState(searchParams.get('code')||'');
    const [joinName, setJoinName]=useState('');
    const [joinLoading, setJoinLoading]=useState(false);
    const [joinQuizInfo, setJoinQuizInfo]=useState(null);

    // Create form state
    const [form, setForm]=useState({title: '', topic: '', description: '', difficulty: 'medium', questionTimeLimit: 20, duration: 60});

    // Question builder
    const [questions, setQuestions]=useState([]);
    const [genPanel, setGenPanel]=useState(false);
    const [genForm, setGenForm]=useState({topic: '', count: 5, difficulty: 'medium', type: 'mcq'});
    const [generating, setGenerating]=useState(false);
    const [savingQ, setSavingQ]=useState(false);

    // Manual question form
    const [qForm, setQForm]=useState({text: '', type: 'mcq', options: ['', '', '', ''], correctAnswer: '', explanation: '', points: 10, timeLimit: 20});
    const [showQForm, setShowQForm]=useState(false);

    const flash=(msg, isError=false) =>
    {
        if (isError) setError(msg);
        else setSuccessMsg(msg);
        setTimeout(() => {setError(''); setSuccessMsg('');}, 4000);
    };

    const fetchQuizzes=useCallback(async () =>
    {
        try
        {
            setLoading(true);
            const data=await apiFetch('/api/quiz/my-quizzes');
            setQuizzes(data.quizzes||[]);
        } catch (e)
        {
            flash(e.message, true);
        } finally {setLoading(false);}
    }, []);

    useEffect(() => {fetchQuizzes();}, [fetchQuizzes]);

    const fetchPublicQuizzes=useCallback(async () =>
    {
        setBrowseLoading(true);
        try
        {
            const data=await apiFetch('/api/quiz/browse');
            setPublicQuizzes(data.quizzes||[]);
        } catch (e)
        {
            flash(e.message, true);
        } finally {setBrowseLoading(false);}
    }, []);

    useEffect(() =>
    {
        if (view==='browse') fetchPublicQuizzes();
    }, [view, fetchPublicQuizzes]);

    // ─ Create quiz ─────────────────────────────────────────────────────────────
    const handleCreate=async (e) =>
    {
        e.preventDefault();
        if (!form.title.trim()||!form.topic.trim()) return flash('Title and topic are required', true);
        try
        {
            setLoading(true);
            const data=await apiFetch('/api/quiz/create', {method: 'POST', body: JSON.stringify(form)});
            flash(`Quiz "${data.quiz.title}" created! Room code: ${data.quiz.code}`);
            setSelectedQuiz(data.quiz);
            setQuestions([]);
            setView('edit');
            fetchQuizzes();
        } catch (e) {flash(e.message, true);}
        finally {setLoading(false);}
    };

    // ─ AI generation ───────────────────────────────────────────────────────────
    const handleGenerate=async () =>
    {
        if (!genForm.topic.trim()) return flash('Enter a topic for generation', true);
        setGenerating(true);
        try
        {
            const data=await apiFetch('/api/quiz/generate-questions', {
                method: 'POST',
                body: JSON.stringify({...genForm, existingQuestions: questions}),
            });
            setQuestions(prev => [...prev, ...data.questions]);
            flash(`Generated ${data.questions.length} questions!`);
            setGenPanel(false);
        } catch (e) {flash(e.message, true);}
        finally {setGenerating(false);}
    };

    // ─ Save questions to quiz ──────────────────────────────────────────────────
    const saveQuestions=async (replace=false) =>
    {
        if (!selectedQuiz) return;
        if (questions.length===0) return flash('No questions to save', true);
        setSavingQ(true);
        try
        {
            await apiFetch(`/api/quiz/${selectedQuiz.id}/questions`, {
                method: 'POST',
                body: JSON.stringify({questions, replace}),
            });
            flash('Questions saved!');
        } catch (e) {flash(e.message, true);}
        finally {setSavingQ(false);}
    };

    // ─ Remove question from local list ────────────────────────────────────────
    const removeQuestion=(idx) => setQuestions(prev => prev.filter((_, i) => i!==idx));

    const editQuestionOption=(qi, oi, val) => setQuestions(prev =>
    {
        const q=[...prev];
        const opts=[...q[qi].options];
        opts[oi]=val;
        q[qi]={...q[qi], options: opts};
        return q;
    });

    const editQuestionField=(qi, field, val) => setQuestions(prev =>
    {
        const q=[...prev];
        q[qi]={...q[qi], [field]: val};
        return q;
    });

    // ─ Add manual question ─────────────────────────────────────────────────────
    const addManualQuestion=() =>
    {
        if (!qForm.text.trim()||!qForm.correctAnswer.trim()) return flash('Question text and correct answer are required', true);
        if (qForm.type==='mcq'&&qForm.options.some(o => !o.trim()))
            return flash('Fill all 4 options for MCQ', true);
        setQuestions(prev => [...prev, {
            ...qForm,
            options: qForm.type==='mcq'? qForm.options:[],
        }]);
        setQForm({text: '', type: 'mcq', options: ['', '', '', ''], correctAnswer: '', explanation: '', points: 10, timeLimit: 20});
        setShowQForm(false);
        flash('Question added!');
    };

    // ─ Publish ──────────────────────────────────────────────────────────────────
    const handlePublish=async (quizId) =>
    {
        try
        {
            await apiFetch(`/api/quiz/${quizId}/publish`, {method: 'POST'});
            flash('Quiz published! Participants can now join.');
            fetchQuizzes();
        } catch (e) {flash(e.message, true);}
    };

    // ─ Delete ───────────────────────────────────────────────────────────────────
    const handleDelete=async (quizId) =>
    {
        if (!confirm('Delete this quiz? This cannot be undone.')) return;
        try
        {
            await apiFetch(`/api/quiz/${quizId}`, {method: 'DELETE'});
            flash('Quiz deleted');
            fetchQuizzes();
            if (view==='edit') setView('list');
        } catch (e) {flash(e.message, true);}
    };

    // ─ Open quiz for editing ──────────────────────────────────────────────────
    const openEdit=async (quiz) =>
    {
        try
        {
            const data=await apiFetch(`/api/quiz/${quiz.id}`);
            setSelectedQuiz(data.quiz);
            setQuestions(data.quiz.questions||[]);
            setView('edit');
        } catch (e) {flash(e.message, true);}
    };

    // ─ Join quiz handlers ──────────────────────────────────────────────────────
    const handleJoinLookup=async (e) =>
    {
        e.preventDefault();
        if (!joinCode.trim()) return flash('Enter a room code', true);
        setJoinLoading(true);
        try
        {
            const res=await fetch(`${API_URL}/api/quiz/room/${joinCode.trim().toUpperCase()}`, {credentials: 'include'});
            const data=await res.json();
            if (!data.success) throw new Error(data.error);
            setJoinQuizInfo(data.quiz);
        } catch (e) {flash(e.message, true);}
        finally {setJoinLoading(false);}
    };

    const handleJoinSubmit=(e) =>
    {
        e.preventDefault();
        if (!joinName.trim()) return flash('Enter your name', true);
        navigate(`/quiz/play?code=${joinCode.trim().toUpperCase()}&name=${encodeURIComponent(joinName.trim())}`);
    };

    // ── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className="qd-root">
            {/* Sidebar */}
            <aside className="qd-sidebar">
                <div className="qd-brand">🎯 Quiz Manager</div>
                <nav className="qd-nav">
                    <button className={`qd-nav-btn ${view==='list'? 'active':''}`} onClick={() => setView('list')}>📋 My Quizzes</button>
                    <button className={`qd-nav-btn ${view==='create'? 'active':''}`} onClick={() => {setView('create'); setForm({title: '', topic: '', description: '', difficulty: 'medium', questionTimeLimit: 20, duration: 60});}}>➕ New Quiz</button>
                    <button className={`qd-nav-btn ${view==='browse'? 'active':''}`} onClick={() => setView('browse')}>🌐 Browse Quizzes</button>
                    <button className={`qd-nav-btn ${view==='join'? 'active':''}`} onClick={() => {setView('join'); setJoinQuizInfo(null);}}>🎮 Join Quiz</button>
                </nav>
            </aside>

            {/* Main */}
            <main className="qd-main">
                {/* Toast */}
                {(error||successMsg)&&(
                    <div className={`qd-toast ${error? 'error':'success'}`}>{error||successMsg}</div>
                )}

                {/* LIST VIEW */}
                {view==='list'&&(
                    <div className="qd-section">
                        <h2 className="qd-heading">My Quizzes</h2>
                        {loading
                            ? <div className="qd-spinner">Loading…</div>
                            :quizzes.length===0
                                ? (
                                    <div className="qd-empty">
                                        <span className="qd-empty-icon">📝</span>
                                        <p>No quizzes yet. Create your first one!</p>
                                        <button className="qd-btn-primary" onClick={() => setView('create')}>Create Quiz</button>
                                    </div>
                                )
                                :(
                                    <div className="qd-grid">
                                        {quizzes.map(q => (
                                            <div className="qd-card" key={q.id}>
                                                <div className="qd-card-header">
                                                    <span className="qd-code"># {q.code}</span>
                                                    <span className={`qd-status qd-status-${q.status}`}>{STATUS_LABELS[q.status]||q.status}</span>
                                                </div>
                                                <h3 className="qd-card-title">{q.title}</h3>
                                                <p className="qd-card-topic">{q.topic}</p>
                                                <div className="qd-card-meta">
                                                    <span style={{color: DIFFICULTY_COLORS[q.difficulty]}}>● {q.difficulty}</span>
                                                    <span>📝 {q.questionCount} Q</span>
                                                    <span>👥 {q.participantCount}</span>
                                                    <span>⏱ {q.duration||60}min</span>
                                                </div>
                                                <div className="qd-card-actions">
                                                    {q.status==='draft'&&(
                                                        <>
                                                            <button className="qd-btn-sm" onClick={() => openEdit(q)}>Edit</button>
                                                            {q.questionCount>0&&(
                                                                <button className="qd-btn-sm qd-btn-publish" onClick={() => handlePublish(q.id)}>Publish</button>
                                                            )}
                                                        </>
                                                    )}
                                                    {q.status==='waiting'&&(
                                                        <button className="qd-btn-sm qd-btn-start" onClick={() => navigate(`/quiz/host/${q.id}`)}>Open Lobby</button>
                                                    )}
                                                    {['active', 'question_open', 'question_closed'].includes(q.status)&&(
                                                        <button className="qd-btn-sm qd-btn-start" onClick={() => navigate(`/quiz/host/${q.id}`)}>Rejoin Live</button>
                                                    )}
                                                    {q.status==='completed'&&(
                                                        <button className="qd-btn-sm" onClick={() => navigate(`/quiz/results/${q.id}`)}>Results</button>
                                                    )}
                                                    {!['active', 'question_open', 'question_closed'].includes(q.status)&&(
                                                        <button className="qd-btn-sm qd-btn-delete" onClick={() => handleDelete(q.id)}>Delete</button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                        }
                    </div>
                )}

                {/* BROWSE VIEW */}
                {view==='browse'&&(
                    <div className="qd-section">
                        <div className="qd-browse-header">
                            <h2 className="qd-heading">Browse Quizzes</h2>
                            <button className="qd-btn-secondary" onClick={fetchPublicQuizzes} disabled={browseLoading}>
                                {browseLoading? '⏳ Refreshing…':'🔄 Refresh'}
                            </button>
                        </div>
                        <p className="qd-browse-hint">All open and live quizzes — click Join to enter a room.</p>
                        {browseLoading
                            ? <div className="qd-spinner">Loading…</div>
                            :publicQuizzes.length===0
                                ? (
                                    <div className="qd-empty">
                                        <span className="qd-empty-icon">🔍</span>
                                        <p>No active quizzes right now. Check back soon, or join directly with a room code.</p>
                                        <button className="qd-btn-primary" onClick={() => setView('join')}>Join by Code</button>
                                    </div>
                                )
                                : (
                                    <div className="qd-grid">
                                        {publicQuizzes.map(q => (
                                            <div className="qd-card" key={q.id}>
                                                <div className="qd-card-header">
                                                    <span className="qd-code"># {q.code}</span>
                                                    <span className={`qd-status qd-status-${q.status}`}>{STATUS_LABELS[q.status]||q.status}</span>
                                                </div>
                                                <h3 className="qd-card-title">{q.title}</h3>
                                                <p className="qd-card-topic">{q.topic}</p>
                                                <div className="qd-card-meta">
                                                    <span style={{color: DIFFICULTY_COLORS[q.difficulty]}}>● {q.difficulty}</span>
                                                    <span>📝 {q.questionCount} Q</span>
                                                    <span>👥 {q.participantCount}</span>
                                                    <span>🎙 {q.hostName}</span>
                                                </div>
                                                <div className="qd-card-actions">
                                                    <button
                                                        className="qd-btn-sm qd-btn-start"
                                                        onClick={() => navigate(`/quiz/join?code=${q.code}`)}
                                                    >
                                                        🎮 Join Quiz
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                        }
                    </div>
                )}

                {/* CREATE VIEW */}
                {view==='create'&&(
                    <div className="qd-section">
                        <h2 className="qd-heading">Create New Quiz</h2>
                        <form className="qd-form" onSubmit={handleCreate}>
                            <div className="qd-form-row">
                                <label>Title *</label>
                                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. JavaScript Fundamentals Quiz" required />
                            </div>
                            <div className="qd-form-row">
                                <label>Topic *</label>
                                <input value={form.topic} onChange={e => setForm(f => ({...f, topic: e.target.value}))} placeholder="e.g. JavaScript, React Hooks, SQL..." required />
                            </div>
                            <div className="qd-form-row">
                                <label>Description</label>
                                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={3} placeholder="Optional description" />
                            </div>
                            <div className="qd-form-row-group">
                                <div className="qd-form-row">
                                    <label>Difficulty</label>
                                    <select value={form.difficulty} onChange={e => setForm(f => ({...f, difficulty: e.target.value}))}>
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                                <div className="qd-form-row">
                                    <label>Time per Question (sec)</label>
                                    <input type="number" min={10} max={120} value={form.questionTimeLimit} onChange={e => setForm(f => ({...f, questionTimeLimit: Number(e.target.value)}))} />
                                </div>
                                <div className="qd-form-row">
                                    <label>Quiz Duration (minutes)</label>
                                    <input type="number" min={1} max={1440} value={form.duration} onChange={e => setForm(f => ({...f, duration: Number(e.target.value)}))} />
                                    <span className="qd-form-hint" style={{fontSize:'12px',color:'#888',marginTop:'4px'}}>How long the quiz stays open for participants (default: 60 min)</span>
                                </div>
                            </div>
                            <div className="qd-form-actions">
                                <button type="button" className="qd-btn-secondary" onClick={() => setView('list')}>Cancel</button>
                                <button type="submit" className="qd-btn-primary" disabled={loading}>
                                    {loading? 'Creating…':'Create & Add Questions →'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* EDIT VIEW */}
                {view==='edit'&&selectedQuiz&&(
                    <div className="qd-section">
                        <div className="qd-edit-header">
                            <div>
                                <h2 className="qd-heading">{selectedQuiz.title||selectedQuiz.code}</h2>
                                <p className="qd-edit-meta">Room code: <strong>{selectedQuiz.code}</strong> · {questions.length} questions</p>
                            </div>
                            <div className="qd-edit-actions">
                                {(selectedQuiz.status==='draft'||!selectedQuiz.status)&&questions.length>0&&(
                                    <button className="qd-btn-publish" onClick={() => handlePublish(selectedQuiz.id||selectedQuiz._id)}>Publish Quiz</button>
                                )}
                                {selectedQuiz.status==='waiting'&&(
                                    <button className="qd-btn-start" onClick={() => navigate(`/quiz/host/${selectedQuiz.id||selectedQuiz._id}`)}>Open Lobby ›</button>
                                )}
                                <button className="qd-btn-secondary" onClick={() => setView('list')}>‹ Back</button>
                            </div>
                        </div>

                        {/* AI Generation Panel */}
                        <div className="qd-gen-bar">
                            <button className="qd-btn-ai" onClick={() => setGenPanel(v => !v)}>
                                ✨ {genPanel? 'Hide AI Generator':'Generate with AI'}
                            </button>
                            <button className="qd-btn-secondary" onClick={() => setShowQForm(v => !v)}>
                                ➕ {showQForm? 'Hide Manual Form':'Add Question Manually'}
                            </button>
                        </div>

                        {genPanel&&(
                            <div className="qd-gen-panel">
                                <h3>✨ AI Question Generator</h3>
                                <div className="qd-form-row-group">
                                    <div className="qd-form-row">
                                        <label>Topic</label>
                                        <input value={genForm.topic||selectedQuiz.topic} onChange={e => setGenForm(f => ({...f, topic: e.target.value}))} placeholder={selectedQuiz.topic} />
                                    </div>
                                    <div className="qd-form-row">
                                        <label>Count</label>
                                        <input type="number" min={1} max={20} value={genForm.count} onChange={e => setGenForm(f => ({...f, count: Number(e.target.value)}))} />
                                    </div>
                                    <div className="qd-form-row">
                                        <label>Difficulty</label>
                                        <select value={genForm.difficulty} onChange={e => setGenForm(f => ({...f, difficulty: e.target.value}))}>
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                    </div>
                                    <div className="qd-form-row">
                                        <label>Type</label>
                                        <select value={genForm.type} onChange={e => setGenForm(f => ({...f, type: e.target.value}))}>
                                            <option value="mcq">Multiple Choice</option>
                                            <option value="short">Short Answer</option>
                                        </select>
                                    </div>
                                </div>
                                <button className="qd-btn-ai" onClick={handleGenerate} disabled={generating}>
                                    {generating? '⏳ Generating…':'✨ Generate Questions'}
                                </button>
                            </div>
                        )}

                        {/* Manual question form */}
                        {showQForm&&(
                            <div className="qd-manual-form">
                                <h3>Add Question</h3>
                                <div className="qd-form-row">
                                    <label>Question *</label>
                                    <textarea value={qForm.text} onChange={e => setQForm(f => ({...f, text: e.target.value}))} rows={2} placeholder="Enter question text" />
                                </div>
                                <div className="qd-form-row-group">
                                    <div className="qd-form-row">
                                        <label>Type</label>
                                        <select value={qForm.type} onChange={e => setQForm(f => ({...f, type: e.target.value}))}>
                                            <option value="mcq">Multiple Choice</option>
                                            <option value="short">Short Answer</option>
                                        </select>
                                    </div>
                                    <div className="qd-form-row">
                                        <label>Points</label>
                                        <input type="number" min={1} value={qForm.points} onChange={e => setQForm(f => ({...f, points: Number(e.target.value)}))} />
                                    </div>
                                    <div className="qd-form-row">
                                        <label>Time (sec)</label>
                                        <input type="number" min={5} max={120} value={qForm.timeLimit} onChange={e => setQForm(f => ({...f, timeLimit: Number(e.target.value)}))} />
                                    </div>
                                </div>
                                {qForm.type==='mcq'&&(
                                    <div className="qd-options-grid">
                                        {qForm.options.map((opt, i) => (
                                            <input key={i} className="qd-option-input" value={opt} onChange={e => setQForm(f => {const o=[...f.options]; o[i]=e.target.value; return {...f, options: o};})} placeholder={`Option ${String.fromCharCode(65+i)}`} />
                                        ))}
                                    </div>
                                )}
                                <div className="qd-form-row">
                                    <label>Correct Answer *</label>
                                    {qForm.type==='mcq'
                                        ? (
                                            <select value={qForm.correctAnswer} onChange={e => setQForm(f => ({...f, correctAnswer: e.target.value}))}>
                                                <option value="">— Select correct option —</option>
                                                {qForm.options.filter(Boolean).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                            </select>
                                        )
                                        :<input value={qForm.correctAnswer} onChange={e => setQForm(f => ({...f, correctAnswer: e.target.value}))} placeholder="Ideal answer" />
                                    }
                                </div>
                                <div className="qd-form-row">
                                    <label>Explanation</label>
                                    <input value={qForm.explanation} onChange={e => setQForm(f => ({...f, explanation: e.target.value}))} placeholder="Why is this the correct answer?" />
                                </div>
                                <button className="qd-btn-primary" onClick={addManualQuestion}>Add Question</button>
                            </div>
                        )}

                        {/* Questions list */}
                        {questions.length>0&&(
                            <div className="qd-questions">
                                <div className="qd-questions-header">
                                    <h3>{questions.length} Question{questions.length!==1? 's':''}</h3>
                                    <div>
                                        <button className="qd-btn-sm" onClick={() => saveQuestions(true)} disabled={savingQ}>
                                            {savingQ? 'Saving…':'💾 Save All'}
                                        </button>
                                    </div>
                                </div>
                                <div className="qd-q-list">
                                    {questions.map((q, i) => (
                                        <div className="qd-q-item" key={i}>
                                            <div className="qd-q-num">{i+1}</div>
                                            <div className="qd-q-body">
                                                <div className="qd-q-text-row">
                                                    <textarea
                                                        className="qd-q-text"
                                                        value={q.text}
                                                        onChange={e => editQuestionField(i, 'text', e.target.value)}
                                                        rows={2}
                                                    />
                                                </div>
                                                <div className="qd-q-meta">
                                                    <span className="qd-badge">{q.type==='mcq'? 'MCQ':'Short'}</span>
                                                    <span className="qd-badge">{q.points} pts</span>
                                                    <span className="qd-badge">⏱ {q.timeLimit}s</span>
                                                    <span className="qd-badge" style={{color: DIFFICULTY_COLORS[q.difficulty]}}>● {q.difficulty}</span>
                                                </div>
                                                {q.type==='mcq'&&(
                                                    <div className="qd-options-grid">
                                                        {q.options.map((opt, oi) => (
                                                            <input
                                                                key={oi}
                                                                className={`qd-option-input ${opt===q.correctAnswer? 'correct':''}`}
                                                                value={opt}
                                                                onChange={e => editQuestionOption(i, oi, e.target.value)}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="qd-q-answer">
                                                    ✅ <strong>{q.correctAnswer}</strong>
                                                    {q.explanation&&<span className="qd-q-exp"> — {q.explanation}</span>}
                                                </div>
                                            </div>
                                            <button className="qd-q-delete" onClick={() => removeQuestion(i)} title="Remove">✕</button>
                                        </div>
                                    ))}
                                </div>
                                <div className="qd-save-bar">
                                    <button className="qd-btn-primary" onClick={() => saveQuestions(true)} disabled={savingQ}>
                                        {savingQ? '⏳ Saving…':`💾 Save ${questions.length} Questions`}
                                    </button>
                                </div>
                            </div>
                        )}

                        {questions.length===0&&!genPanel&&!showQForm&&(
                            <div className="qd-empty">
                                <span className="qd-empty-icon">💡</span>
                                <p>No questions yet. Use AI generation or add manually.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* JOIN VIEW */}
                {view==='join'&&(
                    <div className="qd-section">
                        <h2 className="qd-heading">Join a Quiz</h2>
                        <div className="qd-join-container">
                            <div className="qd-join-card">
                                <div className="qd-join-icon">🎯</div>

                                {!joinQuizInfo
                                    ? (
                                        <form className="qd-join-form" onSubmit={handleJoinLookup}>
                                            <p className="qd-join-hint">Enter the room code provided by the quiz host</p>
                                            <input
                                                className="qd-join-code-input"
                                                value={joinCode}
                                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                                placeholder="ROOM CODE"
                                                maxLength={6}
                                                autoFocus
                                            />
                                            <button className="qd-btn-primary" type="submit" disabled={joinLoading}>
                                                {joinLoading? '⏳ Checking…':'Find Quiz →'}
                                            </button>
                                        </form>
                                    )
                                    :(
                                        <div className="qd-join-found">
                                            <div className="qd-join-quiz-info">
                                                <h3>{joinQuizInfo.title}</h3>
                                                <div className="qd-join-meta">
                                                    <span className={`qd-badge qd-badge-${joinQuizInfo.difficulty}`}>{joinQuizInfo.difficulty}</span>
                                                    <span>📝 {joinQuizInfo.questionCount} questions</span>
                                                    <span>🎙 Host: {joinQuizInfo.hostName}</span>
                                                </div>
                                            </div>
                                            <form className="qd-join-form" onSubmit={handleJoinSubmit}>
                                                <input
                                                    className="qd-join-name-input"
                                                    value={joinName}
                                                    onChange={e => setJoinName(e.target.value)}
                                                    placeholder="Your name"
                                                    maxLength={30}
                                                    autoFocus
                                                />
                                                <button className="qd-btn-primary" type="submit">Join Now 🚀</button>
                                                <button className="qd-btn-secondary" type="button" onClick={() => {setJoinQuizInfo(null); setJoinCode('');}}>
                                                    ‹ Different code
                                                </button>
                                            </form>
                                        </div>
                                    )
                                }
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
