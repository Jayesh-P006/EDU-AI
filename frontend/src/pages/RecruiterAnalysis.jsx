import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, Circle, Clock, ArrowLeft, RefreshCw,
  Shield, FileText, GitBranch, Search, Zap, BarChart3,
  Award, AlertCircle,
} from 'lucide-react';
import { analyzeCandidate, getVerificationResults, MOCK_CANDIDATES } from '../services/recruiterApi';
import './RecruiterAnalysis.css';

const STEPS = [
  { id: 'resume_parsed', label: 'Resume Parsed', desc: 'Extracting text and skills from resume', icon: FileText, duration: 1200 },
  { id: 'repo_downloaded', label: 'GitHub Repository Downloaded', desc: 'Cloning and indexing candidate repository', icon: GitBranch, duration: 2000 },
  { id: 'repo_scanned', label: 'Repository Scanned', desc: 'Scanning files for claimed technologies', icon: Search, duration: 1800 },
  { id: 'claims_extracted', label: 'Claims Extracted', desc: 'Parsing resume claims for verification', icon: FileText, duration: 1000 },
  { id: 'features_verified', label: 'Feature Verification Completed', desc: 'Cross-referencing claims with code evidence', icon: Zap, duration: 2500 },
  { id: 'authenticity_analyzed', label: 'Authenticity Analysis Completed', desc: 'Running AI-powered authenticity checks', icon: Shield, duration: 2000 },
  { id: 'trust_score_generated', label: 'Trust Score Generated', desc: 'Computing final trust score and risk level', icon: BarChart3, duration: 1200 },
  { id: 'report_generated', label: 'Report Generated', desc: 'Building comprehensive verification report', icon: Award, duration: 800 },
];

export default function RecruiterAnalysis() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState('running'); // running | completed | failed
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [jdText, setJdText] = useState('');
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const stepTimerRef = useRef(null);

  useEffect(() => {
    const c = MOCK_CANDIDATES.find(x => x.id === candidateId);
    setCandidate(c || { id: candidateId, name: 'Candidate', email: '' });

    if (c?.analysisStatus === 'completed') {
      simulateAllCompleted();
    }

    return () => {
      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
      clearTimeout(stepTimerRef.current);
    };
  }, [candidateId]);

  function simulateAllCompleted() {
    setCompletedSteps(STEPS.map(s => s.id));
    setCurrentStep(STEPS.length);
    setStatus('completed');
  }

  function startAnalysis() {
    setStarted(true);
    setCompletedSteps([]);
    setCurrentStep(0);
    setStatus('running');
    setElapsedSeconds(0);

    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);

    try {
      analyzeCandidate(candidateId, jdText).catch(() => {});
    } catch {}

    runSimulatedSteps(0);

    pollRef.current = setInterval(async () => {
      try {
        const data = await getVerificationResults(candidateId);
        if (data?.verification?.pipelineComplete) {
          clearInterval(pollRef.current);
        }
      } catch {}
    }, 4000);
  }

  function runSimulatedSteps(idx) {
    if (idx >= STEPS.length) {
      clearInterval(timerRef.current);
      setStatus('completed');
      return;
    }
    const step = STEPS[idx];
    setCurrentStep(idx);
    stepTimerRef.current = setTimeout(() => {
      setCompletedSteps(prev => [...prev, step.id]);
      runSimulatedSteps(idx + 1);
    }, step.duration);
  }

  function handleRetry() {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    clearTimeout(stepTimerRef.current);
    setCompletedSteps([]);
    setCurrentStep(0);
    setStatus('running');
    setElapsedSeconds(0);
    setError(null);
    setTimeout(() => runSimulatedSteps(0), 500);
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
  }

  const progress = Math.round((completedSteps.length / STEPS.length) * 100);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!started) {
    return (
      <div className="ra-page">
        <header className="ra-header">
          <button className="ra-back-btn" onClick={() => navigate('/recruiter/candidates')}>
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="ra-title">Analyze Candidate</h1>
        </header>

        <div className="ra-start-container">
          <motion.div className="ra-start-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="ra-start-icon">
              <Shield size={36} color="#3b82f6" />
            </div>
            <h2>{candidate?.name || 'Candidate'}</h2>
            <p className="ra-start-sub">{candidate?.appliedRole || 'Software Engineer'} · {candidate?.email}</p>

            <div className="ra-start-steps-preview">
              {STEPS.map((s, i) => (
                <div key={s.id} className="ra-preview-step">
                  <div className="ra-preview-step-num">{i + 1}</div>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>

            <div className="ra-jd-section">
              <label className="ra-jd-label">Job Description (optional — improves accuracy)</label>
              <textarea
                className="ra-jd-input"
                rows={5}
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                placeholder="Paste the job description here to compare candidate's skills against requirements..."
              />
            </div>

            <button className="ra-start-btn" onClick={startAnalysis}>
              <Zap size={18} /> Start Verification Analysis
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="ra-page">
      {/* Header */}
      <header className="ra-header">
        <button className="ra-back-btn" onClick={() => navigate('/recruiter/candidates')}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="ra-header-info">
          <h1 className="ra-title">Analyzing: {candidate?.name}</h1>
          <span className="ra-header-role">{candidate?.appliedRole}</span>
        </div>
        {status === 'running' && (
          <div className="ra-timer">
            <Clock size={14} />
            {formatTime(elapsedSeconds)}
          </div>
        )}
      </header>

      <div className="ra-content">
        {/* Progress Bar */}
        <motion.div className="ra-progress-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="ra-progress-header">
            <span className="ra-progress-label">
              {status === 'completed' ? 'Analysis Complete' : status === 'failed' ? 'Analysis Failed' : 'Analyzing...'}
            </span>
            <span className="ra-progress-pct" style={{ color: status === 'completed' ? '#22c55e' : status === 'failed' ? '#ef4444' : '#3b82f6' }}>
              {progress}%
            </span>
          </div>
          <div className="ra-progress-bar-bg">
            <motion.div
              className="ra-progress-bar-fill"
              style={{ background: status === 'completed' ? '#22c55e' : status === 'failed' ? '#ef4444' : 'linear-gradient(90deg, #3b82f6, #a855f7)' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <div className="ra-progress-sub">
            {completedSteps.length} of {STEPS.length} steps completed
          </div>
        </motion.div>

        {/* Steps */}
        <div className="ra-steps-card">
          {STEPS.map((step, i) => {
            const isDone = completedSteps.includes(step.id);
            const isActive = currentStep === i && status === 'running' && !isDone;
            const Icon = step.icon;

            return (
              <motion.div
                key={step.id}
                className={`ra-step ${isDone ? 'done' : isActive ? 'active' : 'waiting'}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="ra-step-icon-wrap">
                  <AnimatePresence mode="wait">
                    {isDone ? (
                      <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} className="ra-step-check">
                        <CheckCircle size={20} color="#22c55e" />
                      </motion.div>
                    ) : isActive ? (
                      <motion.div key="active" className="ra-step-active-icon">
                        <div className="ra-step-spinner" />
                      </motion.div>
                    ) : (
                      <motion.div key="wait" className="ra-step-wait-icon">
                        <Circle size={20} color="var(--text-tertiary)" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="ra-step-body">
                  <div className="ra-step-label">{step.label}</div>
                  <div className="ra-step-desc">{isActive ? step.desc : isDone ? step.desc : '—'}</div>
                </div>

                <div className="ra-step-right">
                  {isDone && <span className="ra-step-done-badge">Done</span>}
                  {isActive && <span className="ra-step-running-badge">Running</span>}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Completed Action */}
        <AnimatePresence>
          {status === 'completed' && (
            <motion.div className="ra-complete-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="ra-complete-icon"><CheckCircle size={40} color="#22c55e" /></div>
              <h2>Analysis Complete!</h2>
              <p>Verification report is ready for <strong>{candidate?.name}</strong></p>
              <div className="ra-complete-actions">
                <button className="ra-view-report-btn" onClick={() => navigate(`/recruiter/report/${candidateId}`)}>
                  <Shield size={18} /> View Verification Report
                </button>
                <button className="ra-back-list-btn" onClick={() => navigate('/recruiter/candidates')}>
                  Back to Candidates
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        {error && (
          <div className="ra-error-card">
            <AlertCircle size={24} color="#ef4444" />
            <p>{error}</p>
            <button className="ra-retry-btn" onClick={handleRetry}>
              <RefreshCw size={14} /> Retry Analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
