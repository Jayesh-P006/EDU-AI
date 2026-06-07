import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, CheckCircle, Clock, GitBranch, FileText, BarChart3,
  AlertTriangle, AlertCircle, RefreshCw, ArrowLeft, Home,
  TrendingUp, Award, Layers, Code, Star,
} from 'lucide-react';
import './CandidateStatus.css';

const MOCK_STATUS = {
  candidateName: 'John Doe',
  appliedRole: 'Backend Software Engineer',
  company: 'Google India',
  appliedAt: '2026-06-07T10:30:00Z',
  applicationStatus: 'under_review',
  analysisStatus: 'completed',
  resumeScore: 84,
  githubScore: 91,
  overallScore: 88,
  riskLevel: 'LOW',
  recommendation: 'Proceed to Technical Interview',
  authenticityScore: 87,
  verifiedClaims: 5,
  totalClaims: 7,
  steps: [
    { id: 'resume_parsed', label: 'Resume Parsed', done: true, ts: '10:30:12' },
    { id: 'repo_downloaded', label: 'Repository Downloaded', done: true, ts: '10:30:45' },
    { id: 'ast_analysis', label: 'AST Analysis Complete', done: true, ts: '10:31:20' },
    { id: 'claims_extracted', label: 'Claims Extracted', done: true, ts: '10:31:55' },
    { id: 'claims_verified', label: 'Claim Verification Complete', done: true, ts: '10:33:10' },
    { id: 'trust_score', label: 'Trust Score Generated', done: true, ts: '10:33:30' },
    { id: 'report_generated', label: 'Report Generated', done: true, ts: '10:33:42' },
  ],
};

const STATUS_MAP = {
  applied: { label: 'Application Received', color: '#3b82f6' },
  under_review: { label: 'Under Review', color: '#eab308' },
  interview: { label: 'Interview Stage', color: '#a855f7' },
  offered: { label: 'Offer Extended', color: '#22c55e' },
  rejected: { label: 'Not Selected', color: '#ef4444' },
  selected: { label: 'Selected', color: '#22c55e' },
  screening: { label: 'Screening', color: '#f97316' },
};

function ScoreRing({ score, label, color, size = 110 }) {
  const radius = (size / 2) - 10;
  const circ = 2 * Math.PI * radius;
  const pct = score !== null && score !== undefined ? Math.min(100, Math.max(0, score)) : 0;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="cs-ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--bg-tertiary)" strokeWidth="8"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: score !== null ? offset : circ }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="cs-ring-inner">
        {score !== null && score !== undefined ? (
          <>
            <div className="cs-ring-score" style={{ color }}>{score}</div>
            <div className="cs-ring-max">/100</div>
          </>
        ) : (
          <div className="cs-ring-pending">—</div>
        )}
      </div>
      <div className="cs-ring-label">{label}</div>
    </div>
  );
}

function StepRow({ step, index }) {
  return (
    <motion.div
      className={`cs-step ${step.done ? 'done' : 'pending'}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <div className="cs-step-icon-wrap">
        {step.done
          ? <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: index * 0.06 + 0.1 }}>
              <CheckCircle size={18} color="#22c55e" />
            </motion.div>
          : <Clock size={18} color="var(--text-tertiary)" />}
      </div>
      <div className="cs-step-body">
        <span className="cs-step-label">{step.label}</span>
        {step.ts && <span className="cs-step-time">{step.ts}</span>}
      </div>
      {step.done
        ? <span className="cs-step-badge done">Done</span>
        : <span className="cs-step-badge pending">Pending</span>}
    </motion.div>
  );
}

export default function CandidateStatus() {
  const navigate = useNavigate();
  const [data, setData] = useState(MOCK_STATUS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const pollRef = useRef(null);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();

  useEffect(() => {
    loadStatus();

    if (data.analysisStatus !== 'completed') {
      pollRef.current = setInterval(() => loadStatus(true), 3000);
    }

    return () => clearInterval(pollRef.current);
  }, []);

  async function loadStatus(silent = false) {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    try {
      // In production: const res = await api.get(`/candidate/${user.id}/status`);
      // For demo: use mock
      await new Promise(r => setTimeout(r, 400));
      setData(MOCK_STATUS);
      setLastUpdated(new Date());
    } catch {
      setData(MOCK_STATUS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="cs-loading">
        <div className="cs-spinner" />
        <p>Loading application status...</p>
      </div>
    );
  }

  const appStatus = STATUS_MAP[data.applicationStatus] || STATUS_MAP.applied;
  const doneSteps = data.steps?.filter(s => s.done).length || 0;
  const totalSteps = data.steps?.length || 7;
  const progress = Math.round((doneSteps / totalSteps) * 100);
  const isCompleted = data.analysisStatus === 'completed';
  const claimPct = data.totalClaims > 0 ? Math.round((data.verifiedClaims / data.totalClaims) * 100) : 0;

  const riskColor = { NONE: '#22c55e', LOW: '#3b82f6', MEDIUM: '#eab308', HIGH: '#ef4444' }[data.riskLevel] || '#737373';

  return (
    <div className="cs-page">
      {/* Header */}
      <header className="cs-header">
        <div className="cs-header-inner">
          <button className="cs-back-btn" onClick={() => navigate('/')}>
            <Home size={15} /> Home
          </button>
          <div className="cs-header-title-block">
            <h1 className="cs-header-title">Application Status</h1>
            <p className="cs-header-sub">
              {data.appliedRole} · {data.company}
            </p>
          </div>
          <button
            className={`cs-refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={() => loadStatus(true)}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      <div className="cs-body">
        {/* Application Status Banner */}
        <motion.div
          className="cs-status-banner"
          style={{ borderColor: `${appStatus.color}30`, background: `${appStatus.color}08` }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="cs-status-dot" style={{ background: appStatus.color }} />
          <div>
            <div className="cs-status-label" style={{ color: appStatus.color }}>{appStatus.label}</div>
            <div className="cs-status-sub">
              Applied {new Date(data.appliedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' · '}Last updated {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
          {isCompleted && (
            <div className="cs-status-complete-pill">
              <CheckCircle size={12} color="#22c55e" /> Analysis Complete
            </div>
          )}
        </motion.div>

        {/* Score Cards */}
        <motion.div
          className="cs-scores-section"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="cs-section-title">Your Scores</h2>
          <div className="cs-scores-grid">
            <div className="cs-score-card">
              <ScoreRing
                score={isCompleted ? data.resumeScore : null}
                label="Resume Score"
                color="#3b82f6"
              />
              <div className="cs-score-info">
                <span className="cs-score-card-label">Resume Quality</span>
                <span className="cs-score-card-sub">
                  {isCompleted ? 'Parsed & verified' : 'Processing...'}
                </span>
              </div>
            </div>

            <div className="cs-score-card cs-score-card--main">
              <ScoreRing
                score={isCompleted ? data.overallScore : null}
                label="Overall Score"
                color={data.overallScore >= 80 ? '#22c55e' : data.overallScore >= 60 ? '#eab308' : '#ef4444'}
                size={130}
              />
              <div className="cs-score-info">
                <span className="cs-score-card-label">Trust Score</span>
                <span className="cs-score-card-sub" style={{ color: data.overallScore >= 80 ? '#22c55e' : '#eab308' }}>
                  {isCompleted ? data.recommendation : 'Analyzing...'}
                </span>
              </div>
            </div>

            <div className="cs-score-card">
              <ScoreRing
                score={isCompleted ? data.githubScore : null}
                label="GitHub Score"
                color="#a855f7"
              />
              <div className="cs-score-info">
                <span className="cs-score-card-label">GitHub Analysis</span>
                <span className="cs-score-card-sub">
                  {isCompleted ? 'Repository verified' : 'Analyzing...'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        {isCompleted && (
          <motion.div
            className="cs-stats-row"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="cs-stat-pill">
              <CheckCircle size={14} color="#22c55e" />
              <span className="cs-stat-pill-val" style={{ color: '#22c55e' }}>{data.verifiedClaims}</span>
              <span className="cs-stat-pill-label">Claims Verified</span>
            </div>
            <div className="cs-stat-pill">
              <Shield size={14} color="#3b82f6" />
              <span className="cs-stat-pill-val" style={{ color: '#3b82f6' }}>{data.authenticityScore}</span>
              <span className="cs-stat-pill-label">Authenticity Score</span>
            </div>
            <div className="cs-stat-pill">
              <AlertTriangle size={14} color={riskColor} />
              <span className="cs-stat-pill-val" style={{ color: riskColor }}>{data.riskLevel}</span>
              <span className="cs-stat-pill-label">Risk Level</span>
            </div>
            <div className="cs-stat-pill">
              <TrendingUp size={14} color="#f59e0b" />
              <span className="cs-stat-pill-val" style={{ color: '#f59e0b' }}>{claimPct}%</span>
              <span className="cs-stat-pill-label">Claim Success Rate</span>
            </div>
          </motion.div>
        )}

        <div className="cs-two-col">
          {/* Verification Steps */}
          <motion.div
            className="cs-steps-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="cs-card-header">
              <h2 className="cs-section-title">Verification Progress</h2>
              <div className="cs-progress-mini">
                <div className="cs-progress-mini-bar-bg">
                  <motion.div
                    className="cs-progress-mini-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    style={{ background: isCompleted ? '#22c55e' : '#3b82f6' }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                  />
                </div>
                <span className="cs-progress-mini-pct" style={{ color: isCompleted ? '#22c55e' : '#3b82f6' }}>
                  {progress}%
                </span>
              </div>
            </div>

            <div className="cs-steps-list">
              {(data.steps || []).map((step, i) => (
                <StepRow key={step.id} step={step} index={i} />
              ))}
            </div>

            {!isCompleted && (
              <div className="cs-steps-polling">
                <div className="cs-polling-dot" />
                <span>Polling for updates every 3 seconds...</span>
              </div>
            )}
          </motion.div>

          {/* Right Column */}
          <div className="cs-right-col">
            {/* Recommendation */}
            {isCompleted && (
              <motion.div
                className="cs-rec-card"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="cs-rec-header">
                  <Award size={16} color="#f59e0b" />
                  <h3>Recruiter Recommendation</h3>
                </div>
                <div
                  className="cs-rec-badge"
                  style={{
                    background: `${data.overallScore >= 80 ? '#22c55e' : '#eab308'}18`,
                    borderColor: `${data.overallScore >= 80 ? '#22c55e' : '#eab308'}30`,
                    color: data.overallScore >= 80 ? '#22c55e' : '#eab308',
                  }}
                >
                  {data.recommendation}
                </div>
                <p className="cs-rec-desc">
                  This recommendation is based on your resume analysis, GitHub verification, and trust score combined.
                </p>
              </motion.div>
            )}

            {/* Claims Summary */}
            {isCompleted && (
              <motion.div
                className="cs-claims-card"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <div className="cs-claims-header">
                  <Code size={15} color="#a855f7" />
                  <h3>Claim Verification</h3>
                </div>
                <div className="cs-claims-bar-wrap">
                  <div className="cs-claims-bar-bg">
                    <motion.div
                      className="cs-claims-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${claimPct}%` }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                    />
                  </div>
                  <span className="cs-claims-pct">{claimPct}%</span>
                </div>
                <div className="cs-claims-stat-row">
                  <div className="cs-claims-stat green">
                    <span className="cs-claims-stat-num">{data.verifiedClaims}</span>
                    <span className="cs-claims-stat-lbl">Verified</span>
                  </div>
                  <div className="cs-claims-stat red">
                    <span className="cs-claims-stat-num">{data.totalClaims - data.verifiedClaims}</span>
                    <span className="cs-claims-stat-lbl">Unverified</span>
                  </div>
                  <div className="cs-claims-stat blue">
                    <span className="cs-claims-stat-num">{data.totalClaims}</span>
                    <span className="cs-claims-stat-lbl">Total</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Authenticity */}
            {isCompleted && (
              <motion.div
                className="cs-auth-card"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="cs-auth-header">
                  <Shield size={15} color="#3b82f6" />
                  <h3>Authenticity Analysis</h3>
                </div>
                <div className="cs-auth-score-row">
                  <div className="cs-auth-score" style={{ color: '#3b82f6' }}>
                    {data.authenticityScore}
                    <span className="cs-auth-max">/100</span>
                  </div>
                  <div className="cs-auth-risk" style={{ color: riskColor, background: `${riskColor}12`, borderColor: `${riskColor}25` }}>
                    {data.riskLevel} RISK
                  </div>
                </div>
                <p className="cs-auth-desc">
                  Your GitHub code has been analyzed for genuine authorship. Score reflects originality, complexity, and consistency.
                </p>
              </motion.div>
            )}

            {/* Processing State */}
            {!isCompleted && (
              <motion.div
                className="cs-processing-card"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="cs-processing-anim">
                  <div className="cs-processing-spinner" />
                  <Shield size={24} color="#3b82f6" />
                </div>
                <h3>Analysis In Progress</h3>
                <p>Your resume and GitHub repository are being analyzed by our AI engine. This typically takes 2–5 minutes.</p>
                <div className="cs-eta">
                  <Clock size={13} />
                  <span>Estimated: 2–5 minutes</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Bottom Help */}
        <motion.div
          className="cs-help-row"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <AlertCircle size={14} color="var(--text-tertiary)" />
          <span>
            Analysis results are shown to recruiters as a detailed report. If you have questions about your application status, contact the recruiter directly.
          </span>
        </motion.div>
      </div>
    </div>
  );
}
