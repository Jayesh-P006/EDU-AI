import {useState, useEffect} from 'react';
import {useParams, useSearchParams, useNavigate} from 'react-router-dom';
import {getInterviewReport} from '../services/api';
import {Award as AwardIcon, BarChart2 as ChartIcon, Shield as ShieldIcon, Code as CodeIcon, MessageCircle as CommIcon, Brain as BrainIcon, Clock as ClockIcon, CheckCircle as CheckIcon, XCircle as XIcon, ArrowLeft as BackIcon, Download as DownloadIcon, TrendingUp as TrendIcon, Star as StarIcon} from 'lucide-react';
import './InterviewReport.css';

function InterviewReport()
{
    const {interviewId}=useParams();
    const [searchParams]=useSearchParams();
    const navigate=useNavigate();
    const role=searchParams.get('role')||'candidate';

    const [report, setReport]=useState(null);
    const [loading, setLoading]=useState(true);
    const [error, setError]=useState(null);

    useEffect(() =>
    {
        fetchReport();
    }, [interviewId]);

    const fetchReport=async () =>
    {
        try
        {
            setLoading(true);
            const response=await getInterviewReport(interviewId);
            setReport(response?.data?.data||response?.data);
        } catch (err)
        {
            console.error('Failed to fetch report:', err);
            setError(err?.response?.data?.error||'Failed to load report');
        } finally
        {
            setLoading(false);
        }
    };

    const getScoreColor=(score) =>
    {
        if (score>=8) return '#10b981';
        if (score>=6) return '#f59e0b';
        if (score>=4) return '#f97316';
        return '#ef4444';
    };

    const getScoreColor100=(score) =>
    {
        if (score>=80) return '#10b981';
        if (score>=60) return '#f59e0b';
        if (score>=40) return '#f97316';
        return '#ef4444';
    };

    const getGradeColor=(grade) =>
    {
        if (grade.startsWith('A')) return '#10b981';
        if (grade.startsWith('B')) return '#3b82f6';
        if (grade.startsWith('C')) return '#f59e0b';
        return '#ef4444';
    };

    const handleBack=() =>
    {
        navigate(role==='recruiter'? '/company-dashboard':'/candidate-dashboard');
    };

    const handleDownload=() =>
    {
        if (!report?.reportText) return;
        const blob=new Blob([report.reportText], {type: 'text/plain'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download=`interview-report-${interviewId}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading)
    {
        return (
            <div className="report-page">
                <div className="report-loading">
                    <div className="spinner" />
                    <p>Generating report...</p>
                </div>
            </div>
        );
    }

    if (error)
    {
        return (
            <div className="report-page">
                <div className="report-error">
                    <XIcon size={48} />
                    <h2>Report Unavailable</h2>
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={handleBack}>Go Back</button>
                </div>
            </div>
        );
    }

    if (!report) return null;

    const sections=[
        {key: 'technical', label: 'Technical', icon: CodeIcon, score: Math.round((report.sectionScores?.technical||0)/10)},
        {key: 'problemSolving', label: 'Problem Solving', icon: BrainIcon, score: Math.round((report.sectionScores?.problemSolving||0)/10)},
        {key: 'communication', label: 'Communication', icon: CommIcon, score: Math.round((report.sectionScores?.communication||0)/10)},
        {key: 'domain', label: 'Domain', icon: ChartIcon, score: Math.round((report.sectionScores?.domain||0)/10)},
        {key: 'aptitude', label: 'Aptitude', icon: ClockIcon, score: Math.round((report.sectionScores?.aptitude||0)/10)},
    ];

    return (
        <div className="report-page">
            <div className="report-container">
                {/* Header */}
                <div className="report-header">
                    <div className="report-header-left">
                        <button className="btn-icon" onClick={handleBack}><BackIcon size={20} /></button>
                        <div>
                            <h1>Interview Report</h1>
                            <p className="report-subtitle">{report.candidateName} — {report.role}</p>
                        </div>
                    </div>
                    <div className="report-header-right">
                        <span className="report-date">{new Date(report.completedAt).toLocaleDateString()}</span>
                        <button className="btn btn-secondary" onClick={handleDownload}><DownloadIcon size={16} /> Download</button>
                    </div>
                </div>

                {/* Overall Score Card */}
                <div className="score-hero">
                    <div className="score-circle" style={{borderColor: getScoreColor(Math.round(report.overallScore/10))}}>
                        <div className="score-number" style={{color: getScoreColor(Math.round(report.overallScore/10))}}>{Math.round(report.overallScore/10)}</div>
                        <div className="score-label">Overall /10</div>
                    </div>
                    <div className="grade-badge" style={{background: getGradeColor(report.grade), color: '#fff'}}>
                        {report.grade}
                    </div>
                    <div className="score-meta">
                        <div className="meta-item"><ClockIcon size={14} /> {report.duration} min</div>
                        <div className="meta-item"><CodeIcon size={14} /> {report.summary?.totalSubmissions||0} submissions</div>
                        <div className="meta-item"><ShieldIcon size={14} /> {report.summary?.integrityScore||0}% integrity</div>
                    </div>
                </div>

                {/* Section Scores */}
                <div className="section-scores">
                    <h2><ChartIcon size={18} /> Section Scores (Interviewer Rated)</h2>
                    <div className="scores-grid">
                        {sections.map(s => (
                            <div key={s.key} className="score-card">
                                <div className="score-card-header">
                                    <s.icon size={16} />
                                    <span>{s.label}</span>
                                </div>
                                <div className="score-card-value" style={{color: getScoreColor(s.score)}}>{s.score}<span className="score-out-of">/10</span></div>
                                <div className="score-card-stars">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
                                        <StarIcon key={star} size={14} fill={star<=s.score? getScoreColor(s.score):'none'} color={star<=s.score? getScoreColor(s.score):'#444'} />
                                    ))}
                                </div>
                                <div className="score-card-bar">
                                    <div className="score-card-fill" style={{width: `${s.score*10}%`, background: getScoreColor(s.score)}} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Test Results Summary */}
                <div className="test-summary">
                    <h2><CheckIcon size={18} /> Code Submission Results</h2>
                    <div className="test-stats">
                        <div className="test-stat">
                            <div className="test-stat-value">{report.summary?.totalTestsPassed||0}</div>
                            <div className="test-stat-label">Tests Passed</div>
                        </div>
                        <div className="test-stat">
                            <div className="test-stat-value">{report.summary?.totalTestsRun||0}</div>
                            <div className="test-stat-label">Total Tests</div>
                        </div>
                        <div className="test-stat">
                            <div className="test-stat-value" style={{color: getScoreColor100(report.summary?.passRate||0)}}>{report.summary?.passRate||0}%</div>
                            <div className="test-stat-label">Pass Rate</div>
                        </div>
                        <div className="test-stat">
                            <div className="test-stat-value">{report.summary?.totalSubmissions||0}</div>
                            <div className="test-stat-label">Submissions</div>
                        </div>
                    </div>

                    {/* Individual submissions */}
                    {report.submissions&&report.submissions.length>0&&(
                        <div className="submissions-list">
                            {report.submissions.map((sub, i) => (
                                <div key={i} className="submission-item">
                                    <div className="submission-info">
                                        <span className="submission-q">Q: {sub.questionId}</span>
                                        <span className="submission-lang">{sub.language}</span>
                                    </div>
                                    <div className="submission-result">
                                        <span className={`submission-score ${sub.score>=100? 'perfect':sub.score>=50? 'partial':'failed'}`}>
                                            {sub.passed}/{sub.total} ({sub.score}%)
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Proctoring Summary */}
                <div className="proctoring-summary-section">
                    <h2><ShieldIcon size={18} /> Proctoring Summary</h2>
                    <div className="proctor-stats">
                        <div className="proctor-stat">
                            <span className="proctor-stat-label">Integrity Score</span>
                            <span className="proctor-stat-value" style={{color: getScoreColor100(report.summary?.integrityScore||0)}}>{report.summary?.integrityScore||0}/100</span>
                        </div>
                        <div className="proctor-stat">
                            <span className="proctor-stat-label">Total Violations</span>
                            <span className="proctor-stat-value">{report.summary?.proctoringViolations||0}</span>
                        </div>
                        <div className="proctor-stat">
                            <span className="proctor-stat-label">Critical Violations</span>
                            <span className="proctor-stat-value" style={{color: (report.summary?.criticalViolations||0)>0? '#ef4444':'#10b981'}}>{report.summary?.criticalViolations||0}</span>
                        </div>
                    </div>
                </div>

                {/* Recruiter Scores */}
                {report.recruiterScores&&Object.values(report.recruiterScores).some(v => v>0)&&(
                    <div className="recruiter-scores-section">
                        <h3><StarIcon size={18} /> Interviewer Evaluation (out of 10)</h3>
                        <div className="recruiter-scores-grid">
                            {[
                                {key: 'technical', label: 'Technical'},
                                {key: 'problemSolving', label: 'Problem Solving'},
                                {key: 'communication', label: 'Communication'},
                                {key: 'domain', label: 'Domain'},
                                {key: 'aptitude', label: 'Aptitude'},
                                {key: 'overallScore', label: 'Overall Score'},
                            ].map(item => (
                                <div key={item.key} className={`recruiter-score-row ${item.key==='overallScore'? 'recruiter-score-overall':''}`}>
                                    <span className="recruiter-score-label">{item.label}</span>
                                    <div className="recruiter-stars">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                                            <StarIcon key={s} size={14} fill={s<=(report.recruiterScores[item.key]||0)? '#f59e0b':'none'} color={s<=(report.recruiterScores[item.key]||0)? '#f59e0b':'#555'} />
                                        ))}
                                        <span className="recruiter-score-num">{report.recruiterScores[item.key]||0}/10</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {report.feedback&&(
                            <div className="recruiter-feedback-text">
                                <strong>Interviewer Feedback:</strong>
                                <p>{report.feedback}</p>
                            </div>
                        )}
                        {role==='recruiter'&&report.notes&&(
                            <div className="recruiter-notes-text">
                                <strong>Internal Notes:</strong>
                                <p>{report.notes}</p>
                            </div>
                        )}
                        {report.hiringDecision&&(
                            <div className={`hiring-decision-badge decision-${report.hiringDecision}`}>
                                <strong>Hiring Decision:</strong>
                                <span className="decision-label">
                                    {report.hiringDecision==='strong-hire'&&'⭐ Strong Hire'}
                                    {report.hiringDecision==='hire'&&'✅ Hire'}
                                    {report.hiringDecision==='maybe'&&'🤔 Maybe'}
                                    {report.hiringDecision==='no-hire'&&'❌ No Hire'}
                                    {report.hiringDecision==='strong-no-hire'&&'⛔ Strong No Hire'}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Strengths & Improvements */}
                <div className="feedback-section">
                    {report.strengths&&report.strengths.length>0&&(
                        <div className="feedback-card strengths">
                            <h3><TrendIcon size={16} /> Strengths</h3>
                            <ul>
                                {report.strengths.map((s, i) => (
                                    <li key={i}><CheckIcon size={14} color="#10b981" /> {s}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {report.improvements&&report.improvements.length>0&&(
                        <div className="feedback-card improvements">
                            <h3><AwardIcon size={16} /> Areas for Improvement</h3>
                            <ul>
                                {report.improvements.map((s, i) => (
                                    <li key={i}><XIcon size={14} color="#f59e0b" /> {s}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Back button */}
                <div className="report-footer">
                    <button className="btn btn-primary" onClick={handleBack}>
                        <BackIcon size={16} /> Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}

export default InterviewReport;
