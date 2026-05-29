import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import
{
    Palette, Server, Layers, BarChart3, Wrench, Smartphone,
    Monitor, MessageSquare, Code, Building2,
    Zap, Target, Terminal, ArrowRight, Check,
    ChevronRight
} from 'lucide-react';
import './PracticeSessionSetup.css';

function PracticeSessionSetup()
{
    const navigate=useNavigate();
    const [config, setConfig]=useState({
        role: '',
        difficulty: 'medium',
        interviewType: 'technical',
        mode: 'quick',
        duration: 20,
    });

    const roles=[
        {id: 'frontend', name: 'Frontend Developer', icon: Palette},
        {id: 'backend', name: 'Backend Developer', icon: Server},
        {id: 'fullstack', name: 'Full Stack Developer', icon: Layers},
        {id: 'data-science', name: 'Data Scientist', icon: BarChart3},
        {id: 'devops', name: 'DevOps Engineer', icon: Wrench},
        {id: 'mobile', name: 'Mobile Developer', icon: Smartphone},
    ];

    const interviewTypes=[
        {id: 'technical', name: 'Technical Interview', desc: 'Concepts, architecture and problem solving', icon: Monitor},
        {id: 'behavioral', name: 'Behavioral Interview', desc: 'Situational questions and communication', icon: MessageSquare},
        {id: 'coding', name: 'Coding Round', desc: 'Live coding with test cases', icon: Code},
        {id: 'system-design', name: 'System Design', desc: 'Architecture and scalability discussions', icon: Building2},
    ];

    const modes=[
        {
            id: 'quick',
            name: 'Quick Practice',
            desc: '5 questions, 10-15 min',
            features: ['Fast feedback', 'No strict scoring', 'Basic evaluation'],
            duration: 15,
            icon: Zap,
        },
        {
            id: 'real',
            name: 'Full Simulation',
            desc: '10-15 questions, 30-40 min',
            features: ['Timed session', 'Adaptive difficulty', 'Detailed scorecard', 'Follow-up questions'],
            duration: 35,
            icon: Target,
        },
        {
            id: 'coding',
            name: 'Coding Challenge',
            desc: '2-3 problems, 45-60 min',
            features: ['Code editor', 'Run & test', 'Time complexity analysis', 'Code quality review'],
            duration: 50,
            icon: Terminal,
        },
    ];

    const handleStartPractice=async () =>
    {
        if (!config.role)
        {
            alert('Please select a role');
            return;
        }

        // Create practice session
        const sessionId=`practice-${Date.now()}`;
        const sessionData={
            ...config,
            sessionId,
            startTime: new Date().toISOString(),
        };

        // Store in localStorage
        localStorage.setItem('practiceSession', JSON.stringify(sessionData));

        // Navigate to practice interview room
        navigate(`/practice-interview/${sessionId}?role=${config.role}&difficulty=${config.difficulty}&type=${config.interviewType}&mode=${config.mode}`);
    };

    return (
        <div className="practice-setup">
            <div className="setup-container">
                <div className="setup-header">
                    <h1>Interview Practice</h1>
                    <p>Sharpen your skills with mock interviews tailored to your target role</p>
                </div>

                {/* Step 1: Select Role */}
                <section className="setup-section">
                    <div className="section-step"><span className="step-number">1</span><h2>Select Your Target Role</h2></div>
                    <div className="role-grid">
                        {roles.map(r =>
                        {
                            const Icon=r.icon;
                            return (
                                <div
                                    key={r.id}
                                    className={`role-card ${config.role===r.id? 'selected':''}`}
                                    onClick={() => setConfig({...config, role: r.id})}
                                >
                                    <div className="role-icon"><Icon size={28} /></div>
                                    <div className="role-name">{r.name}</div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Step 2: Select Interview Type */}
                <section className="setup-section">
                    <div className="section-step"><span className="step-number">2</span><h2>Choose Interview Type</h2></div>
                    <div className="type-grid">
                        {interviewTypes.map(type =>
                        {
                            const Icon=type.icon;
                            return (
                                <div
                                    key={type.id}
                                    className={`type-card ${config.interviewType===type.id? 'selected':''}`}
                                    onClick={() => setConfig({...config, interviewType: type.id})}
                                >
                                    <div className="type-icon"><Icon size={26} /></div>
                                    <h3>{type.name}</h3>
                                    <p>{type.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Step 3: Select Difficulty */}
                <section className="setup-section">
                    <div className="section-step"><span className="step-number">3</span><h2>Select Difficulty Level</h2></div>
                    <div className="difficulty-selector">
                        <button
                            className={`difficulty-btn easy ${config.difficulty==='easy'? 'selected':''}`}
                            onClick={() => setConfig({...config, difficulty: 'easy'})}
                        >
                            <span className="diff-indicator diff-easy-indicator"></span>
                            <span className="diff-name">Easy</span>
                            <span className="diff-desc">Entry level questions</span>
                        </button>
                        <button
                            className={`difficulty-btn medium ${config.difficulty==='medium'? 'selected':''}`}
                            onClick={() => setConfig({...config, difficulty: 'medium'})}
                        >
                            <span className="diff-indicator diff-medium-indicator"></span>
                            <span className="diff-name">Medium</span>
                            <span className="diff-desc">Intermediate concepts</span>
                        </button>
                        <button
                            className={`difficulty-btn hard ${config.difficulty==='hard'? 'selected':''}`}
                            onClick={() => setConfig({...config, difficulty: 'hard'})}
                        >
                            <span className="diff-indicator diff-hard-indicator"></span>
                            <span className="diff-name">Hard</span>
                            <span className="diff-desc">Advanced challenges</span>
                        </button>
                    </div>
                </section>

                {/* Step 4: Select Mode */}
                <section className="setup-section">
                    <div className="section-step"><span className="step-number">4</span><h2>Choose Practice Mode</h2></div>
                    <div className="mode-grid">
                        {modes.map(m =>
                        {
                            const Icon=m.icon;
                            return (
                                <div
                                    key={m.id}
                                    className={`mode-card ${config.mode===m.id? 'selected':''}`}
                                    onClick={() => setConfig({...config, mode: m.id, duration: m.duration})}
                                >
                                    <div className="mode-icon"><Icon size={28} /></div>
                                    <h3>{m.name}</h3>
                                    <p className="mode-desc">{m.desc}</p>
                                    <ul className="mode-features">
                                        {m.features.map((feature, i) => (
                                            <li key={i}><Check size={14} /> {feature}</li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Summary and Start */}
                <section className="setup-summary">
                    <div className="summary-box">
                        <h3>Session Summary</h3>
                        <div className="summary-details">
                            <div className="summary-item">
                                <strong>Role:</strong>
                                <span>{roles.find(r => r.id===config.role)?.name||'Not selected'}</span>
                            </div>
                            <div className="summary-item">
                                <strong>Type:</strong>
                                <span>{interviewTypes.find(t => t.id===config.interviewType)?.name}</span>
                            </div>
                            <div className="summary-item">
                                <strong>Difficulty:</strong>
                                <span className={`badge-${config.difficulty}`}>{config.difficulty}</span>
                            </div>
                            <div className="summary-item">
                                <strong>Mode:</strong>
                                <span>{modes.find(m => m.id===config.mode)?.name}</span>
                            </div>
                            <div className="summary-item">
                                <strong>Duration:</strong>
                                <span>~{config.duration} minutes</span>
                            </div>
                        </div>
                    </div>
                    <button
                        className="start-btn"
                        onClick={handleStartPractice}
                        disabled={!config.role}
                    >
                        Start Practice <ArrowRight size={20} />
                    </button>
                </section>
            </div>
        </div>
    );
}

export default PracticeSessionSetup;
