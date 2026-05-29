import {useState, useEffect, useRef} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import api from '../services/api';
import './AIInterviewReport.css';

/* ── Tiny radar chart drawn on <canvas> ── */
function RadarChart({data, size=300})
{
  const canvasRef=useRef(null);

  useEffect(() =>
  {
    const canvas=canvasRef.current;
    if (!canvas||!data?.length) return;
    const ctx=canvas.getContext('2d');
    const dpr=window.devicePixelRatio||1;
    canvas.width=size*dpr;
    canvas.height=size*dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width=size+'px';
    canvas.style.height=size+'px';

    const cx=size/2, cy=size/2, r=size*0.38;
    const n=data.length;
    const angle=(2*Math.PI)/n;

    ctx.clearRect(0, 0, size, size);

    // Grid rings
    for (let ring=1;ring<=5;ring++)
    {
      ctx.beginPath();
      const rr=(r*ring)/5;
      for (let i=0;i<=n;i++)
      {
        const a=i*angle-Math.PI/2;
        const x=cx+rr*Math.cos(a);
        const y=cy+rr*Math.sin(a);
        i===0? ctx.moveTo(x, y):ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle='rgba(102,126,234,0.15)';
      ctx.lineWidth=1;
      ctx.stroke();
    }

    // Axis lines
    for (let i=0;i<n;i++)
    {
      const a=i*angle-Math.PI/2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a));
      ctx.strokeStyle='rgba(102,126,234,0.2)';
      ctx.stroke();
    }

    // Data polygon
    ctx.beginPath();
    data.forEach((d, i) =>
    {
      const val=Math.min(d.value, 100)/100;
      const a=i*angle-Math.PI/2;
      const x=cx+r*val*Math.cos(a);
      const y=cy+r*val*Math.sin(a);
      i===0? ctx.moveTo(x, y):ctx.lineTo(x, y);
    });
    ctx.closePath();
    const grad=ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(102,126,234,0.35)');
    grad.addColorStop(1, 'rgba(118,75,162,0.25)');
    ctx.fillStyle=grad;
    ctx.fill();
    ctx.strokeStyle='#667eea';
    ctx.lineWidth=2;
    ctx.stroke();

    // Data points + labels
    data.forEach((d, i) =>
    {
      const val=Math.min(d.value, 100)/100;
      const a=i*angle-Math.PI/2;
      const x=cx+r*val*Math.cos(a);
      const y=cy+r*val*Math.sin(a);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2*Math.PI);
      ctx.fillStyle='#667eea';
      ctx.fill();
      ctx.strokeStyle='#fff';
      ctx.lineWidth=2;
      ctx.stroke();

      // Label
      const lx=cx+(r+22)*Math.cos(a);
      const ly=cy+(r+22)*Math.sin(a);
      ctx.fillStyle='#555';
      ctx.font='11px Inter, system-ui, sans-serif';
      ctx.textAlign=Math.cos(a)>0.1? 'left':Math.cos(a)<-0.1? 'right':'center';
      ctx.textBaseline='middle';
      ctx.fillText(`${d.label} (${d.value})`, lx, ly);
    });
  }, [data, size]);

  return <canvas ref={canvasRef} />;
}

/* ── Circular progress gauge ── */
function ScoreGauge({score, label, size=120})
{
  const pct=Math.min(score, 100);
  const color=pct>=80? '#4caf50':pct>=60? '#ff9800':'#f44336';
  const circum=2*Math.PI*46;
  return (
    <div className="score-gauge">
      <svg width={size} height={size} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="46" fill="none" stroke="#eee" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="46" fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circum}
          strokeDashoffset={circum-(circum*pct)/100}
          transform="rotate(-90 60 60)"
          style={{transition: 'stroke-dashoffset 1s ease'}}
        />
        <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>
          {score}
        </text>
        <text x="60" y="74" textAnchor="middle" fontSize="10" fill="#888">/100</text>
      </svg>
      {label&&<span className="gauge-label">{label}</span>}
    </div>
  );
}

/* ── Horizontal bar ── */
function HBar({label, value, max=100})
{
  const pct=Math.min(value, max);
  const color=pct>=80? '#4caf50':pct>=60? '#ff9800':'#f44336';
  return (
    <div className="hbar-row">
      <span className="hbar-label">{label}</span>
      <div className="hbar-track">
        <div className="hbar-fill" style={{width: `${pct}%`, background: color}} />
      </div>
      <span className="hbar-value">{value}</span>
    </div>
  );
}

/* ── Performance Trend mini line chart ── */
function TrendChart({scores, size=280})
{
  const canvasRef=useRef(null);
  useEffect(() =>
  {
    const canvas=canvasRef.current;
    if (!canvas||!scores?.length) return;
    const ctx=canvas.getContext('2d');
    const dpr=window.devicePixelRatio||1;
    const h=100;
    canvas.width=size*dpr;
    canvas.height=h*dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width=size+'px';
    canvas.style.height=h+'px';
    ctx.clearRect(0, 0, size, h);

    const pad=20;
    const w=size-pad*2;
    const ht=h-pad*2;
    const step=scores.length>1? w/(scores.length-1):0;

    // Background grid
    for (let i=0;i<=4;i++)
    {
      const y=pad+(ht*i)/4;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(size-pad, y);
      ctx.strokeStyle='rgba(0,0,0,0.06)';
      ctx.stroke();
    }

    // Line
    ctx.beginPath();
    scores.forEach((s, i) =>
    {
      const x=pad+i*step;
      const y=pad+ht-(Math.min(s, 100)/100)*ht;
      i===0? ctx.moveTo(x, y):ctx.lineTo(x, y);
    });
    ctx.strokeStyle='#667eea';
    ctx.lineWidth=2.5;
    ctx.lineJoin='round';
    ctx.stroke();

    // Fill under line
    const lastX=pad+(scores.length-1)*step;
    ctx.lineTo(lastX, pad+ht);
    ctx.lineTo(pad, pad+ht);
    ctx.closePath();
    const grad=ctx.createLinearGradient(0, pad, 0, pad+ht);
    grad.addColorStop(0, 'rgba(102,126,234,0.25)');
    grad.addColorStop(1, 'rgba(102,126,234,0.02)');
    ctx.fillStyle=grad;
    ctx.fill();

    // Dots + labels
    scores.forEach((s, i) =>
    {
      const x=pad+i*step;
      const y=pad+ht-(Math.min(s, 100)/100)*ht;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI*2);
      ctx.fillStyle='#667eea';
      ctx.fill();
      ctx.strokeStyle='#fff';
      ctx.lineWidth=2;
      ctx.stroke();

      ctx.fillStyle='#555';
      ctx.font='10px Inter, system-ui, sans-serif';
      ctx.textAlign='center';
      ctx.fillText(`Q${i+1}`, x, pad+ht+14);
    });
  }, [scores, size]);

  return <canvas ref={canvasRef} />;
}

/* ════════════════════════════════════════════════════
   Main Report Component
   ════════════════════════════════════════════════════ */
function AIInterviewReport()
{
  const {sessionId}=useParams();
  const navigate=useNavigate();
  const [report, setReport]=useState(null);
  const [loading, setLoading]=useState(true);
  const [verificationResult, setVerificationResult]=useState(null);
  const [checkingVerification, setCheckingVerification]=useState(false);

  // Detect if this interview is from verification flow
  const isFromVerification=sessionStorage.getItem('verificationInterviewComplete')==='true';

  // Determine correct dashboard path based on user role
  const getDashboardPath=() =>
  {
    try
    {
      const stored=localStorage.getItem('user');
      if (stored)
      {
        const user=JSON.parse(stored);
        return ['company_admin', 'company_hr', 'recruiter'].includes(user.role)
          ? '/company-dashboard':'/candidate-dashboard';
      }
    } catch { /* ignore */}
    return '/candidate-dashboard';
  };

  useEffect(() =>
  {
    fetchReport();
  }, [sessionId]);

  // After report loads, check verification result if from verification flow
  useEffect(() =>
  {
    if (report&&isFromVerification&&!verificationResult&&!checkingVerification)
    {
      checkVerificationResult();
    }
  }, [report, isFromVerification]);

  const checkVerificationResult=async () =>
  {
    setCheckingVerification(true);
    try
    {
      const stored=localStorage.getItem('user');
      if (!stored) return;
      const u=JSON.parse(stored);
      const userId=u.id||u._id;
      const res=await api.post(`/verification/${userId}/verify-interview-result`, {sessionId});
      setVerificationResult(res.data);
    } catch (err)
    {
      console.error('Failed to check verification result:', err);
    } finally
    {
      setCheckingVerification(false);
    }
  };

  const handleBackToVerification=() =>
  {
    sessionStorage.removeItem('fromVerification');
    sessionStorage.removeItem('verificationInterviewComplete');
    sessionStorage.removeItem('verificationSessionId');
    navigate('/resume-verification');
  };

  const fetchReport=async () =>
  {
    try
    {
      const response=await api.get(`/ai-interview/${sessionId}/report`);
      setReport(response.data);
    } catch (error)
    {
      console.error('Error fetching report:', error);
    } finally
    {
      setLoading(false);
    }
  };

  if (loading)
  {
    return (
      <div className="report-loading">
        <div className="report-spinner" />
        <p>Generating your detailed interview report&hellip;</p>
      </div>
    );
  }

  if (!report)
  {
    return (
      <div className="report-loading">
        <p>Report not found. <button onClick={() => navigate(getDashboardPath())}>Go Home</button></p>
      </div>
    );
  }

  const scores=report.scores||{};
  const radarData=[
    {label: 'Technical', value: scores.technicalKnowledge||0},
    {label: 'Communication', value: scores.communication||0},
    {label: 'Problem Solving', value: scores.problemSolving||0},
    {label: 'Confidence', value: scores.confidence||0},
    {label: 'Consistency', value: scores.consistency||0},
  ];

  const rec=report.recommendation||{};
  const recColor=
    rec.recommendation==='Strongly Recommend'? '#4caf50'
      :rec.recommendation==='Recommend'? '#8bc34a'
        :rec.recommendation==='Maybe'? '#ff9800':'#f44336';

  return (
    <div className="ai-interview-report">
      {/* ── Verification Result Banner ── */}
      {isFromVerification&&(
        <div className={`verification-result-banner ${verificationResult?.verified? 'passed':verificationResult?.status==='failed'? 'failed':'checking'}`}>
          {checkingVerification? (
            <div className="vr-banner-content">
              <span className="vr-banner-icon">⏳</span>
              <div>
                <h3>Checking Verification Result...</h3>
                <p>Evaluating your interview performance against the verification threshold.</p>
              </div>
            </div>
          ):verificationResult?.verified? (
            <div className="vr-banner-content">
              <span className="vr-banner-icon">✅</span>
              <div>
                <h3>Resume Verification Passed!</h3>
                <p>You scored <strong>{verificationResult.score}/100</strong> (required: {verificationResult.passThreshold}). Your resume skills have been verified.</p>
              </div>
              <button className="vr-banner-btn success" onClick={handleBackToVerification}>
                Back to Verification
              </button>
            </div>
          ):verificationResult? (
            <div className="vr-banner-content">
              <span className="vr-banner-icon">❌</span>
              <div>
                <h3>Verification Failed</h3>
                <p>You scored <strong>{verificationResult.score}/100</strong> (required: {verificationResult.passThreshold}).{' '}
                  {verificationResult.remainingAttempts>0
                    ? `You have ${verificationResult.remainingAttempts} attempt(s) remaining.`
                    :'No more attempts remaining.'}
                </p>
              </div>
              <button className="vr-banner-btn" onClick={handleBackToVerification}>
                {verificationResult.remainingAttempts>0? 'Try Again':'Back to Verification'}
              </button>
            </div>
          ):null}
        </div>
      )}

      {/* Header */}
      <div className="report-header">
        <div>
          <h1>Interview Performance Report</h1>
          <p className="report-subtitle">
            {report.candidateName} &middot; {report.role} &middot;{' '}
            {report.experience==='entry'? 'Entry Level':report.experience==='mid'? 'Mid Level':report.experience==='senior'? 'Senior Level':report.experience||''} &middot;{' '}
            {new Date(report.interviewDate).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>
          {report.topics?.length>0&&(
            <div className="report-topics">
              {report.topics.map((t, i) => <span key={i} className="report-topic-tag">{t}</span>)}
            </div>
          )}
        </div>
        <div className="header-actions">
          <button onClick={() => window.print()} className="print-button">🖨️ Print</button>
          <button onClick={() => navigate(getDashboardPath())} className="home-button">Dashboard</button>
        </div>
      </div>

      <div className="report-body">
        {/* ── Overview cards ── */}
        <section className="report-section overview-section">
          <div className="overview-cards">
            <div className="overview-card main-score">
              <ScoreGauge score={report.overallScore||0} size={150} />
              <span className="card-title">Overall Score</span>
            </div>
            <div className="overview-card">
              <div className="card-big">{report.duration||'—'}</div>
              <span className="card-title">Minutes</span>
            </div>
            <div className="overview-card">
              <div className="card-big">{report.questionsAnswered||0}/{report.totalQuestions||0}</div>
              <span className="card-title">Questions Answered</span>
            </div>
            <div className="overview-card rec-card" style={{borderColor: recColor}}>
              <div className="card-big" style={{color: recColor, fontSize: '1.3rem'}}>{rec.recommendation||'—'}</div>
              <span className="card-title">Hiring Recommendation</span>
            </div>
          </div>
        </section>

        {/* ── Skill radar + score bars ── */}
        <section className="report-section scores-section">
          <h2>📊 Skill Breakdown</h2>
          <div className="scores-grid">
            <div className="radar-container">
              <RadarChart data={radarData} size={300} />
            </div>
            <div className="bars-container">
              {radarData.map((d) => (
                <HBar key={d.label} label={d.label} value={d.value} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Topic-wise Performance ── */}
        {report.topicPerformance?.length>0&&(
          <section className="report-section topic-section">
            <h2>📚 Topic-wise Performance</h2>
            <div className="topic-grid">
              {report.topicPerformance.map((tp) =>
              {
                const color=tp.averageScore>=80? '#4caf50':tp.averageScore>=60? '#ff9800':'#f44336';
                return (
                  <div key={tp.topic} className="topic-card">
                    <div className="topic-name">{tp.topic}</div>
                    <div className="topic-score" style={{color}}>{tp.averageScore}<span>/100</span></div>
                    <div className="topic-meta">
                      <span>{tp.questionsCount} question{tp.questionsCount>1? 's':''}</span>
                      {tp.questionsCount>1&&<span>Range: {tp.minScore}–{tp.maxScore}</span>}
                    </div>
                    <div className="topic-bar">
                      <div className="topic-bar-fill" style={{width: `${tp.averageScore}%`, background: color}} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Performance Trend + Difficulty Breakdown ── */}
        <div className="two-col">
          {report.performanceTrend?.scores?.length>1&&(
            <section className="report-section">
              <h2>📈 Performance Trend</h2>
              <div className="trend-container">
                <TrendChart scores={report.performanceTrend.scores} size={320} />
                <div className={`trend-badge ${report.performanceTrend.direction}`}>
                  {report.performanceTrend.direction==='improving'? '↗ Improving':
                    report.performanceTrend.direction==='declining'? '↘ Declining':'→ Stable'}
                </div>
                <div className="trend-info">
                  <span>First half avg: <strong>{report.performanceTrend.firstHalfAvg}</strong></span>
                  <span>Second half avg: <strong>{report.performanceTrend.secondHalfAvg}</strong></span>
                </div>
              </div>
            </section>
          )}
          {report.difficultyBreakdown?.length>0&&(
            <section className="report-section">
              <h2>🎯 Difficulty Breakdown</h2>
              <div className="difficulty-list">
                {report.difficultyBreakdown.map((d) =>
                {
                  const icon=d.difficulty==='Easy'? '🟢':d.difficulty==='Hard'? '🔴':'🟡';
                  return (
                    <div key={d.difficulty} className="diff-row">
                      <span className="diff-icon">{icon}</span>
                      <span className="diff-label">{d.difficulty}</span>
                      <HBar label="" value={d.averageScore} />
                      <span className="diff-count">{d.count}Q</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* ── Per-question performance ── */}
        {report.questionResults?.length>0&&(
          <section className="report-section questions-section">
            <h2>📝 Question-by-Question Analysis</h2>
            <div className="questions-chart">
              {report.questionResults.map((q) => (
                <div className="q-bar-group" key={q.number}>
                  <span className="q-num">Q{q.number}</span>
                  <div className="q-bar-track">
                    <div
                      className="q-bar-fill"
                      style={{
                        width: `${Math.min(q.score, 100)}%`,
                        background: q.score>=80? '#4caf50':q.score>=60? '#ff9800':'#f44336',
                      }}
                    />
                  </div>
                  <span className="q-score">{q.score}</span>
                </div>
              ))}
            </div>

            <div className="question-cards">
              {report.questionResults.map((q) => (
                <details key={q.number} className="question-card">
                  <summary>
                    <span className="qc-num">Q{q.number}</span>
                    <span className="qc-question">{q.question}</span>
                    <div className="qc-badges">
                      {q.topic&&<span className="qc-topic-badge">{q.topic}</span>}
                      {q.difficulty&&(
                        <span className={`qc-diff-badge diff-${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
                      )}
                      <span
                        className="qc-badge"
                        style={{
                          background: q.score>=80? '#e8f5e9':q.score>=60? '#fff3e0':'#fbe9e7',
                          color: q.score>=80? '#2e7d32':q.score>=60? '#e65100':'#c62828',
                        }}
                      >
                        {q.score}/100
                      </span>
                    </div>
                  </summary>
                  <div className="qc-body">
                    <div className="qc-answer">
                      <strong>Your Answer:</strong>
                      <p>{q.answer||'No answer recorded'}</p>
                    </div>
                    <div className="qc-feedback">
                      <strong>AI Feedback:</strong>
                      <p>{q.feedback}</p>
                    </div>
                    <div className="qc-mini-scores">
                      <div className="qc-score-item">
                        <span className="qc-score-label">Technical</span>
                        <div className="qc-score-bar"><div style={{width: `${q.technicalKnowledge}%`, background: q.technicalKnowledge>=70? '#4caf50':'#ff9800'}} /></div>
                        <span>{q.technicalKnowledge}</span>
                      </div>
                      <div className="qc-score-item">
                        <span className="qc-score-label">Communication</span>
                        <div className="qc-score-bar"><div style={{width: `${q.communication}%`, background: q.communication>=70? '#4caf50':'#ff9800'}} /></div>
                        <span>{q.communication}</span>
                      </div>
                      <div className="qc-score-item">
                        <span className="qc-score-label">Problem Solving</span>
                        <div className="qc-score-bar"><div style={{width: `${q.problemSolving}%`, background: q.problemSolving>=70? '#4caf50':'#ff9800'}} /></div>
                        <span>{q.problemSolving}</span>
                      </div>
                      <div className="qc-score-item">
                        <span className="qc-score-label">Confidence</span>
                        <div className="qc-score-bar"><div style={{width: `${q.confidence}%`, background: q.confidence>=70? '#4caf50':'#ff9800'}} /></div>
                        <span>{q.confidence}</span>
                      </div>
                    </div>
                    {q.expectedSkills?.length>0&&(
                      <div className="qc-tags">
                        <strong>Expected Skills:</strong>
                        {q.expectedSkills.map((s, i) => <span key={i} className="tag blue">{s}</span>)}
                      </div>
                    )}
                    {q.strengths?.length>0&&(
                      <div className="qc-tags">
                        <strong>Strengths:</strong>
                        {q.strengths.map((s, i) => <span key={i} className="tag green">{s}</span>)}
                      </div>
                    )}
                    {q.weaknesses?.length>0&&(
                      <div className="qc-tags">
                        <strong>To Improve:</strong>
                        {q.weaknesses.map((w, i) => <span key={i} className="tag orange">{w}</span>)}
                      </div>
                    )}
                    {q.followUps?.length>0&&(
                      <div className="qc-followups">
                        <strong>Follow-up Questions:</strong>
                        {q.followUps.map((fu, i) => (
                          <div key={i} className="followup-item">
                            <p className="fu-q">🤖 {fu.question}</p>
                            {fu.answer&&<p className="fu-a">👤 {fu.answer}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* ── Strengths & Improvements ── */}
        <div className="two-col">
          <section className="report-section">
            <h2>💪 Strengths</h2>
            <ul className="tag-list green-list">
              {(report.strengths?.length? report.strengths:['No specific strengths identified']).map((s, i) => (
                <li key={i}><span className="tag-icon">✓</span> {s}</li>
              ))}
            </ul>
          </section>
          <section className="report-section">
            <h2>🎯 Areas for Improvement</h2>
            <ul className="tag-list orange-list">
              {(report.improvements?.length? report.improvements:['No specific areas identified']).map((s, i) => (
                <li key={i}><span className="tag-icon">→</span> {s}</li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Recommendation ── */}
        <section className="report-section rec-section" style={{borderLeft: `4px solid ${recColor}`}}>
          <h2>🏆 Hiring Recommendation</h2>
          <div className="rec-content">
            <div className="rec-badge" style={{background: recColor}}>
              {rec.recommendation||'Pending'}
            </div>
            <div className="rec-details">
              <p><strong>Reasoning:</strong> {rec.reasoning||'—'}</p>
              <p><strong>Fit Score:</strong> {rec.fitScore||report.overallScore}/100</p>
              <p><strong>Next Steps:</strong> {rec.nextSteps||'—'}</p>
            </div>
          </div>
        </section>

        {/* ── Detailed Feedback ── */}
        {report.detailedFeedback&&(
          <section className="report-section">
            <h2>📋 Detailed Feedback</h2>
            <div className="feedback-block">{report.detailedFeedback}</div>
          </section>
        )}

        {/* ── Actions ── */}
        <div className="report-actions">
          <button onClick={() => navigate('/ai-interview-setup')} className="retry-button">
            Take Another Interview
          </button>
          <button onClick={() => window.print()} className="print-button">
            Print / Save PDF
          </button>
          <button onClick={() => navigate(getDashboardPath())} className="home-button">
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIInterviewReport;
