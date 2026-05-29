import {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import
  {
    ChevronLeft, Shield, AlertTriangle, CheckCircle, XCircle,
    Briefcase, Target, BarChart3, Clock, FileText, Play,
    Award, TrendingUp, Lock, Unlock, Eye, ChevronDown,
    ChevronUp, Layers, Zap, AlertCircle, Info
  } from 'lucide-react';
import api from '../services/api';
import './ResumeVerification.css';

function ResumeVerification()
{
  const navigate=useNavigate();
  const [user, setUser]=useState(null);
  const [loading, setLoading]=useState(true);
  const [running, setRunning]=useState(false);
  const [jdText, setJdText]=useState('');
  const [verification, setVerification]=useState(null);
  const [activeLayer, setActiveLayer]=useState(null);
  const [assessmentAnswers, setAssessmentAnswers]=useState({});
  const [submitting, setSubmitting]=useState(false);
  const [message, setMessage]=useState(null);
  const [creatingInterview, setCreatingInterview]=useState(false);

  useEffect(() =>
  {
    const stored=localStorage.getItem('user');
    if (stored)
    {
      const u=JSON.parse(stored);
      setUser(u);
      fetchResults(u.id||u._id);
    } else
    {
      navigate('/login');
    }
  }, []);

  const fetchResults=async (userId) =>
  {
    try
    {
      const res=await api.get(`/verification/${userId}/results`);
      if (res.data.verification)
      {
        setVerification(res.data.verification);
      }
    } catch (err)
    {
      console.error('Fetch verification error:', err);
    } finally
    {
      setLoading(false);
    }
  };

  const showMsg=(text, type='success') =>
  {
    setMessage({text, type});
    setTimeout(() => setMessage(null), 4000);
  };

  const handleRunVerification=async () =>
  {
    if (!jdText.trim()) return showMsg('Please paste a job description', 'error');
    setRunning(true);
    try
    {
      const userId=user.id||user._id;
      const res=await api.post(`/verification/${userId}/run`, {jdText});
      setVerification({
        layer1: res.data.layer1,
        layer2: res.data.layer2,
        layer3: null,
        gapAnalysis: res.data.gapAnalysis,
        resumeParsed: res.data.resumeParsed,
        pipelineComplete: false,
        lastRunAt: new Date().toISOString(),
      });
      setActiveLayer('layer1');
      showMsg('Verification pipeline started! Review each layer below.');
    } catch (err)
    {
      showMsg(err.response?.data?.error||'Verification failed', 'error');
    } finally
    {
      setRunning(false);
    }
  };

  const handleSubmitAssessment=async () =>
  {
    const questions=verification?.layer2?.questions||[];
    const answers=questions.map(q => ({
      skill: q.skill,
      type: q.type,
      questionId: q.id,
      score: Number(assessmentAnswers[q.id])||0,
    }));

    if (answers.every(a => a.score===0))
    {
      return showMsg('Please score at least one skill assessment', 'error');
    }

    setSubmitting(true);
    try
    {
      const userId=user.id||user._id;
      const res=await api.post(`/verification/${userId}/submit-assessment`, {answers});
      setVerification(prev => ({
        ...prev,
        layer3: res.data.layer3,
        pipelineComplete: true,
      }));
      setActiveLayer('layer3');
      showMsg('Assessment analyzed! View overclaim detection results.');
    } catch (err)
    {
      showMsg(err.response?.data?.error||'Submission failed', 'error');
    } finally
    {
      setSubmitting(false);
    }
  };

  const handleReset=async () =>
  {
    try
    {
      const userId=user.id||user._id;
      await api.delete(`/verification/${userId}/reset`);
      setVerification(null);
      setAssessmentAnswers({});
      setActiveLayer(null);
      showMsg('Verification reset.');
    } catch (err)
    {
      showMsg('Reset failed', 'error');
    }
  };

  const handleStartAutoInterview=async () =>
  {
    setCreatingInterview(true);
    try
    {
      const userId=user.id||user._id;
      const res=await api.post(`/verification/${userId}/auto-interview`);
      if (res.data.sessionId)
      {
        showMsg('AI Interview created! Redirecting...');
        // Set flag so AIInterviewRoom knows this is from verification
        sessionStorage.setItem('fromVerification', 'true');
        setTimeout(() =>
        {
          navigate(`/ai-interview/${res.data.sessionId}`);
        }, 1000);
      }
    } catch (err)
    {
      showMsg(err.response?.data?.error||'Failed to create AI Interview', 'error');
    } finally
    {
      setCreatingInterview(false);
    }
  };

  if (loading)
  {
    return (
      <div className="rv-page">
        <div className="rv-loading"><div className="rv-spinner" /><p>Loading...</p></div>
      </div>
    );
  }

  const decisionBadge=(decision) =>
  {
    const map={
      PASS: {icon: <CheckCircle size={14} />, cls: 'pass'},
      FLAG: {icon: <AlertTriangle size={14} />, cls: 'flag'},
      REJECT: {icon: <XCircle size={14} />, cls: 'reject'},
    };
    const d=map[decision]||map.PASS;
    return <span className={`rv-decision-badge ${d.cls}`}>{d.icon} {decision}</span>;
  };

  const riskBadge=(risk) =>
  {
    const colors={NONE: 'green', LOW: 'yellow', MEDIUM: 'orange', HIGH: 'red'};
    return <span className={`rv-risk-badge ${colors[risk]||'green'}`}>{risk}</span>;
  };

  const layer1=verification?.layer1;
  const layer2=verification?.layer2;
  const layer3=verification?.layer3;

  return (
    <div className="rv-page">
      {/* Header */}
      <header className="rv-header">
        <div className="rv-header-inner">
          <button className="rv-back-btn" onClick={() => navigate('/candidate-profile')}>
            <ChevronLeft size={20} /> Back to Profile
          </button>
          <h1><Shield size={24} /> Resume Verification</h1>
          <div className="rv-header-actions">
            {verification&&(
              <button className="rv-reset-btn" onClick={handleReset}>Reset</button>
            )}
          </div>
        </div>
      </header>

      {/* Toast */}
      {message&&(
        <div className={`rv-toast ${message.type}`}>
          {message.type==='success'? <CheckCircle size={16} />:<AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      <div className="rv-container">
        {/* Pipeline Overview */}
        <div className="rv-pipeline-overview">
          <div className={`rv-pipe-step ${layer1? 'done':''} ${activeLayer==='layer1'? 'active':''}`} onClick={() => layer1&&setActiveLayer('layer1')}>
            <div className="rv-pipe-icon"><Lock size={20} /></div>
            <span>Layer 1</span>
            <small>Experience Gate</small>
            {layer1&&decisionBadge(layer1.decision)}
          </div>
          <div className="rv-pipe-arrow">→</div>
          <div className={`rv-pipe-step ${layer2? 'done':''} ${activeLayer==='layer2'? 'active':''}`} onClick={() => layer2&&setActiveLayer('layer2')}>
            <div className="rv-pipe-icon"><Target size={20} /></div>
            <span>Layer 2</span>
            <small>Skill Proof</small>
            {layer2&&<span className="rv-pipe-count">{layer2.totalQuestions} Q</span>}
          </div>
          <div className="rv-pipe-arrow">→</div>
          <div className={`rv-pipe-step ${layer3? 'done':''} ${activeLayer==='layer3'? 'active':''}`} onClick={() => layer3&&setActiveLayer('layer3')}>
            <div className="rv-pipe-icon"><Eye size={20} /></div>
            <span>Layer 3</span>
            <small>Overclaim Detect</small>
            {layer3&&riskBadge(layer3.riskLevel)}
          </div>
        </div>

        {/* Start Section (if no verification run yet) */}
        {!verification&&(
          <div className="rv-start-section">
            <div className="rv-start-card">
              <Layers size={48} />
              <h2>3-Layer Resume Verification</h2>
              <p>
                Verify your resume against a job description using our 3-layer pipeline:
                Experience Gate, Skill Proof Assessment, and Overclaim Detection.
              </p>
              <div className="rv-layers-preview">
                <div className="rv-layer-preview">
                  <Lock size={20} />
                  <div>
                    <h4>Layer 1: Experience Gate</h4>
                    <p>Compares your experience level with job requirements. Instant pass/flag/reject.</p>
                  </div>
                </div>
                <div className="rv-layer-preview">
                  <Target size={20} />
                  <div>
                    <h4>Layer 2: Skill Proof</h4>
                    <p>Generates assessment questions for skills claimed in your resume.</p>
                  </div>
                </div>
                <div className="rv-layer-preview">
                  <Eye size={20} />
                  <div>
                    <h4>Layer 3: Overclaim Detection</h4>
                    <p>Analyzes assessment performance to identify overclaimed skills.</p>
                  </div>
                </div>
              </div>

              <div className="rv-jd-input">
                <label>Paste Job Description</label>
                <textarea
                  rows={8}
                  value={jdText}
                  onChange={e => setJdText(e.target.value)}
                  placeholder="Paste the complete job description here to start verification..."
                />
              </div>

              <button className="rv-start-btn" onClick={handleRunVerification} disabled={running}>
                <Play size={18} /> {running? 'Running Verification...':'Start Verification Pipeline'}
              </button>
            </div>
          </div>
        )}

        {/* Layer 1 Results */}
        {verification&&activeLayer==='layer1'&&layer1&&(
          <div className="rv-layer-section">
            <div className="rv-layer-header">
              <Lock size={22} />
              <div>
                <h2>Layer 1: Experience Gate</h2>
                <p>Automatic experience level comparison</p>
              </div>
              {decisionBadge(layer1.decision)}
            </div>

            <div className="rv-exp-comparison">
              <div className="rv-exp-card">
                <span className="rv-exp-label">JD Requirement</span>
                <span className="rv-exp-value">{layer1.jdYears??'N/A'}</span>
                <span className="rv-exp-unit">years</span>
              </div>
              <div className="rv-exp-vs">VS</div>
              <div className="rv-exp-card">
                <span className="rv-exp-label">Your Resume</span>
                <span className="rv-exp-value">{layer1.resumeYears??'N/A'}</span>
                <span className="rv-exp-unit">years</span>
              </div>
            </div>

            {layer1.gap!=null&&(
              <div className={`rv-gap-bar ${layer1.decision==='PASS'? 'pass':layer1.decision==='FLAG'? 'flag':'reject'}`}>
                <span>Gap: {layer1.gap>0? `${layer1.gap} years short`:`${Math.abs(layer1.gap)} years above`}</span>
              </div>
            )}

            <div className="rv-reason-card">
              <Info size={16} />
              <p>{layer1.reason}</p>
            </div>

            {layer1.decision!=='REJECT'&&layer2&&(
              <button className="rv-next-btn" onClick={() => setActiveLayer('layer2')}>
                Proceed to Layer 2: Skill Proof →
              </button>
            )}
          </div>
        )}

        {/* Layer 2 Results — Assessment */}
        {verification&&activeLayer==='layer2'&&layer2&&(
          <div className="rv-layer-section">
            <div className="rv-layer-header">
              <Target size={22} />
              <div>
                <h2>Layer 2: Skill Proof Assessment</h2>
                <p>{layer2.totalQuestions} questions · ~{layer2.estimatedTimeMinutes} minutes</p>
              </div>
            </div>

            <div className="rv-skills-tested">
              <h3>Skills Being Tested</h3>
              <div className="rv-skill-tags">
                {(layer2.skillsTested||[]).map((s, i) => (
                  <span key={i} className="rv-skill-tag">{s}</span>
                ))}
              </div>
            </div>

            <div className="rv-questions-list">
              {(layer2.questions||[]).map((q, idx) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={idx}
                  score={assessmentAnswers[q.id]}
                  onScoreChange={(score) => setAssessmentAnswers(prev => ({...prev, [q.id]: score}))}
                />
              ))}
            </div>

            <div className="rv-assessment-actions">
              <button className="rv-back-layer" onClick={() => setActiveLayer('layer1')}>← Back to Layer 1</button>
              <button className="rv-submit-btn" onClick={handleSubmitAssessment} disabled={submitting}>
                <Zap size={16} /> {submitting? 'Analyzing...':'Submit & Analyze Overclaims'}
              </button>
            </div>

            {/* Auto AI Interview */}
            <div className="rv-auto-interview-section">
              <div className="rv-auto-interview-card">
                <div className="rv-auto-interview-info">
                  <Play size={22} />
                  <div>
                    <h3>AI-Powered Skill Verification Interview</h3>
                    <p>Complete a 5-question AI interview to verify your resume skills. You need to score <strong>70% or above</strong> to pass verification.</p>
                  </div>
                </div>

                {/* ── Status Banner ── */}
                {verification?.autoInterview?.status==='passed'&&(
                  <div className="rv-interview-status passed">
                    <CheckCircle size={18} />
                    <span>Verification Passed! Score: <strong>{verification.autoInterview.lastScore}/100</strong></span>
                  </div>
                )}

                {verification?.autoInterview?.status==='failed'&&(
                  <div className="rv-interview-status failed">
                    <XCircle size={18} />
                    <span>Verification Failed — Score: <strong>{verification.autoInterview.lastScore}/100</strong> (Required: 70)</span>
                  </div>
                )}

                {verification?.autoInterview?.status==='incomplete'&&(
                  <div className="rv-interview-status incomplete">
                    <AlertCircle size={18} />
                    <span>Interview was not completed. All 5 questions must be answered.</span>
                  </div>
                )}

                {/* ── Attempt Counter ── */}
                {verification?.autoInterview?.attempts>0&&(
                  <div className="rv-attempt-counter">
                    <Clock size={14} />
                    <span>
                      Attempts used: <strong>{verification.autoInterview.attempts}</strong> / {verification.autoInterview.maxAttempts||5}
                      {verification.autoInterview.remainingAttempts>0&&verification.autoInterview.status!=='passed'&&(
                        <> &middot; <strong>{verification.autoInterview.remainingAttempts}</strong> remaining</>
                      )}
                    </span>
                  </div>
                )}

                {/* ── Action Buttons ── */}
                {verification?.autoInterview?.status==='passed'? (
                  <button className="rv-interview-btn passed" disabled>
                    <CheckCircle size={16} /> Verification Complete
                  </button>
                ):verification?.autoInterview?.remainingAttempts===0&&verification?.autoInterview?.attempts>=5? (
                  <div className="rv-interview-status no-attempts">
                    <XCircle size={18} />
                    <span>No more attempts remaining. Maximum 5 attempts reached.</span>
                  </div>
                ):verification?.autoInterview?.status==='in-progress'&&verification?.autoInterview?.sessionId? (
                  <button className="rv-interview-btn resume" onClick={() =>
                  {
                    sessionStorage.setItem('fromVerification', 'true');
                    navigate(`/ai-interview/${verification.autoInterview.sessionId}`);
                  }}>
                    <Play size={16} /> Continue Interview
                  </button>
                ):verification?.autoInterview?.status==='failed'||verification?.autoInterview?.status==='incomplete'? (
                  <button className="rv-interview-btn retry" onClick={handleStartAutoInterview} disabled={creatingInterview}>
                    <Zap size={16} /> {creatingInterview? 'Creating New Interview...':'Try Again'}
                  </button>
                ):(
                  <button className="rv-interview-btn" onClick={handleStartAutoInterview} disabled={creatingInterview}>
                    <Zap size={16} /> {creatingInterview? 'Creating Interview...':'Start AI Interview (5 Questions)'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Layer 3 Results — Overclaim Detection */}
        {verification&&activeLayer==='layer3'&&layer3&&(
          <div className="rv-layer-section">
            <div className="rv-layer-header">
              <Eye size={22} />
              <div>
                <h2>Layer 3: Overclaim Detection</h2>
                <p>Analysis of resume claims vs demonstrated skills</p>
              </div>
              {riskBadge(layer3.riskLevel)}
            </div>

            {/* Score Cards */}
            <div className="rv-score-cards">
              <div className="rv-score-card">
                <span className="rv-score-label">Overall Score</span>
                <span className="rv-score-value">{layer3.overallScore}%</span>
              </div>
              <div className="rv-score-card integrity">
                <span className="rv-score-label">Integrity Score</span>
                <span className="rv-score-value">{layer3.integrityScore}%</span>
              </div>
              <div className="rv-score-card">
                <span className="rv-score-label">Risk Level</span>
                {riskBadge(layer3.riskLevel)}
              </div>
            </div>

            {/* Summary */}
            <div className="rv-summary-grid">
              <div className="rv-summary-item verified">
                <CheckCircle size={20} />
                <span className="rv-sum-count">{layer3.summary?.verified||0}</span>
                <span className="rv-sum-label">Verified</span>
              </div>
              <div className="rv-summary-item partial">
                <AlertTriangle size={20} />
                <span className="rv-sum-count">{layer3.summary?.partial||0}</span>
                <span className="rv-sum-label">Partial</span>
              </div>
              <div className="rv-summary-item overclaim">
                <XCircle size={20} />
                <span className="rv-sum-count">{layer3.summary?.overclaimed||0}</span>
                <span className="rv-sum-label">Overclaimed</span>
              </div>
            </div>

            {/* Verdict */}
            <div className={`rv-verdict ${layer3.riskLevel==='NONE'||layer3.riskLevel==='LOW'? 'good':'warn'}`}>
              <Shield size={20} />
              <p>{layer3.verdict}</p>
            </div>

            {/* Skill Results */}
            <div className="rv-skill-results">
              <h3>Skill-wise Results</h3>
              {(layer3.results||[]).map((r, i) => (
                <div key={i} className={`rv-skill-result ${r.status}`}>
                  <div className="rv-skill-header-row">
                    <span className="rv-skill-name">{r.skill}</span>
                    <span className={`rv-skill-status ${r.status}`}>
                      {r.status==='verified'&&<><CheckCircle size={14} /> Verified</>}
                      {r.status==='partial'&&<><AlertTriangle size={14} /> Partial</>}
                      {r.status==='overclaim'&&<><XCircle size={14} /> Overclaimed</>}
                      {r.status==='strong_overclaim'&&<><XCircle size={14} /> Strong Overclaim</>}
                    </span>
                  </div>
                  <div className="rv-skill-bar-container">
                    <div className="rv-skill-bar">
                      <div className={`rv-skill-fill ${r.status}`} style={{width: `${r.score}%`}} />
                    </div>
                    <span className="rv-skill-score">{r.score}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Overclaimed Skills Detail */}
            {layer3.overclaimed_skills?.length>0&&(
              <div className="rv-alert-box overclaim">
                <h4><XCircle size={18} /> Overclaimed Skills</h4>
                <div className="rv-skill-tags">
                  {layer3.overclaimed_skills.map((s, i) => (
                    <span key={i} className="rv-skill-tag overclaim">{s}</span>
                  ))}
                </div>
                <p>These skills were claimed on your resume but could not be verified at the expected level.</p>
              </div>
            )}

            {layer3.verified_skills?.length>0&&(
              <div className="rv-alert-box verified">
                <h4><CheckCircle size={18} /> Verified Skills</h4>
                <div className="rv-skill-tags">
                  {layer3.verified_skills.map((s, i) => (
                    <span key={i} className="rv-skill-tag verified">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <button className="rv-back-layer" onClick={() => setActiveLayer('layer2')}>← Back to Assessment</button>
          </div>
        )}

        {/* Final summary when pipeline is complete */}
        {verification?.pipelineComplete&&(
          <div className="rv-final-summary">
            <h2><Award size={22} /> Verification Complete</h2>
            <div className="rv-final-grid">
              <div className="rv-final-card" onClick={() => setActiveLayer('layer1')}>
                <Lock size={24} />
                <h4>Experience Gate</h4>
                {layer1&&decisionBadge(layer1.decision)}
              </div>
              <div className="rv-final-card" onClick={() => setActiveLayer('layer2')}>
                <Target size={24} />
                <h4>Skill Proof</h4>
                <span className="rv-final-stat">{layer2?.totalQuestions||0} skills tested</span>
              </div>
              <div className="rv-final-card" onClick={() => setActiveLayer('layer3')}>
                <Eye size={24} />
                <h4>Overclaim Detect</h4>
                {layer3&&riskBadge(layer3.riskLevel)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Question Card Component ── */
function QuestionCard({question, index, score, onScoreChange})
{
  const [expanded, setExpanded]=useState(false);
  const q=question;

  const typeColors={
    mcq: {bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', color: '#3b82f6', label: 'MCQ'},
    coding: {bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.3)', color: '#a855f7', label: 'Coding'},
    scenario: {bg: 'rgba(20, 184, 166, 0.1)', border: 'rgba(20, 184, 166, 0.3)', color: '#14b8a6', label: 'Scenario'},
  };

  const tc=typeColors[q.type]||typeColors.mcq;

  return (
    <div className="rv-question-card">
      <div className="rv-q-top" onClick={() => setExpanded(!expanded)}>
        <div className="rv-q-info">
          <span className="rv-q-number">Q{index+1}</span>
          <span className="rv-q-skill">{q.skill}</span>
          <span className="rv-q-type" style={{background: tc.bg, borderColor: tc.border, color: tc.color}}>{tc.label}</span>
          {q.priority&&<span className={`rv-q-priority ${q.priority}`}>{q.priority}</span>}
        </div>
        {expanded? <ChevronUp size={18} />:<ChevronDown size={18} />}
      </div>

      {expanded&&(
        <div className="rv-q-body">
          <p className="rv-q-question">{q.question}</p>

          {q.options&&(
            <div className="rv-q-options">
              {q.options.map((opt, i) => (
                <div key={i} className="rv-q-option">{opt}</div>
              ))}
            </div>
          )}

          {q.example_input&&(
            <div className="rv-q-example">
              <p><strong>Example Input:</strong> {q.example_input}</p>
              <p><strong>Expected Output:</strong> {q.expected_output}</p>
            </div>
          )}

          {q.key_points&&(
            <div className="rv-q-keypoints">
              <p><strong>Key Points to Address:</strong></p>
              <ul>
                {q.key_points.map((kp, i) => <li key={i}>{kp}</li>)}
              </ul>
            </div>
          )}

          <div className="rv-q-score-section">
            <label>Self-Assessment Score (0-100)</label>
            <div className="rv-q-score-input">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={score||0}
                onChange={e => onScoreChange(Number(e.target.value))}
              />
              <span className="rv-q-score-value">{score||0}%</span>
            </div>
            <div className="rv-q-score-labels">
              <span>Can't answer</span>
              <span>Expert level</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResumeVerification;
