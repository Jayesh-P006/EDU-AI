import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle, Shield, Clock, GitBranch, FileText,
  BarChart3, ArrowRight, Home, User,
} from 'lucide-react';
import './ApplicationSuccess.css';

const PROCESSING_STEPS = [
  { id: 'resume_stored', label: 'Resume Stored', desc: 'Your resume has been securely uploaded', icon: FileText, color: '#22c55e', delay: 500 },
  { id: 'repo_queued', label: 'Repository Verification Queued', desc: 'GitHub analysis job has been dispatched', icon: GitBranch, color: '#3b82f6', delay: 1800 },
  { id: 'analysis_started', label: 'Resume Analysis Started', desc: 'Extracting skills and claims from resume', icon: BarChart3, color: '#a855f7', delay: 3200 },
  { id: 'trust_queued', label: 'Trust Score Generation', desc: 'Verification engine initializing...', icon: Shield, color: '#eab308', delay: 4800 },
];

export default function ApplicationSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const candidateName = state.candidateName || 'Candidate';
  const jobTitle = state.jobTitle || 'Software Engineer';
  const company = state.company || 'the company';

  const [completedSteps, setCompletedSteps] = useState([]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);

    const timeouts = PROCESSING_STEPS.map(step =>
      setTimeout(() => {
        setCompletedSteps(prev => [...prev, step.id]);
      }, step.delay)
    );

    return () => {
      clearInterval(timer);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const formatElapsed = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const progress = Math.round((completedSteps.length / PROCESSING_STEPS.length) * 100);
  const allDone = completedSteps.length === PROCESSING_STEPS.length;

  return (
    <div className="as-page">
      <div className="as-content">
        {/* Success Icon */}
        <motion.div
          className="as-success-icon"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          <div className="as-icon-ring as-ring-1" />
          <div className="as-icon-ring as-ring-2" />
          <div className="as-icon-ring as-ring-3" />
          <CheckCircle size={52} color="#22c55e" />
        </motion.div>

        {/* Title */}
        <motion.div className="as-title-block" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h1 className="as-title">Application Submitted Successfully!</h1>
          <p className="as-sub">
            Hi <strong>{candidateName}</strong>, your application for{' '}
            <strong>{jobTitle}</strong> at <strong>{company}</strong> has been received.
          </p>
        </motion.div>

        {/* Timer */}
        <motion.div className="as-timer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <Clock size={13} />
          <span>Processing for {formatElapsed(elapsed)}</span>
        </motion.div>

        {/* Progress Bar */}
        <motion.div className="as-progress-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <div className="as-progress-header">
            <span className="as-progress-label">
              {allDone ? 'Initial Processing Complete' : 'Processing your application...'}
            </span>
            <span className="as-progress-pct" style={{ color: allDone ? '#22c55e' : '#3b82f6' }}>
              {progress}%
            </span>
          </div>
          <div className="as-progress-bar-bg">
            <motion.div
              className="as-progress-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              style={{ background: allDone ? '#22c55e' : 'linear-gradient(90deg, #3b82f6, #a855f7)' }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="as-progress-sub">
            {completedSteps.length} of {PROCESSING_STEPS.length} initial steps completed
          </div>
        </motion.div>

        {/* Processing Steps */}
        <motion.div className="as-steps-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          {PROCESSING_STEPS.map((step, i) => {
            const isDone = completedSteps.includes(step.id);
            const isActive = !isDone && completedSteps.length === i;
            const Icon = step.icon;
            return (
              <motion.div
                key={step.id}
                className={`as-step ${isDone ? 'done' : isActive ? 'active' : 'waiting'}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.75 + i * 0.08 }}
              >
                <div className="as-step-icon-wrap" style={{ background: isDone ? `${step.color}18` : 'var(--bg-tertiary)', borderColor: isDone ? `${step.color}30` : 'var(--border-primary)' }}>
                  {isDone ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <CheckCircle size={18} color={step.color} />
                    </motion.div>
                  ) : isActive ? (
                    <div className="as-step-spinner" style={{ borderTopColor: step.color }} />
                  ) : (
                    <Icon size={16} color="var(--text-tertiary)" />
                  )}
                </div>
                <div className="as-step-body">
                  <div className="as-step-label" style={{ color: isDone ? 'var(--text-primary)' : isActive ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {step.label}
                  </div>
                  <div className="as-step-desc">{step.desc}</div>
                </div>
                <div className="as-step-status">
                  {isDone && <span className="as-step-badge done">Done</span>}
                  {isActive && <span className="as-step-badge running">Running</span>}
                  {!isDone && !isActive && <span className="as-step-badge queued">Queued</span>}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Full Analysis Note */}
        <motion.div className="as-note-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
          <Shield size={16} color="#3b82f6" />
          <div>
            <strong>Full Analysis in Progress</strong>
            <p>GitHub repository analysis and trust score generation typically complete within 2–5 minutes. You will receive a notification once the report is ready.</p>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div className="as-actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
          <button className="as-btn-primary" onClick={() => navigate('/candidate/status')}>
            <BarChart3 size={16} /> Check Application Status
            <ArrowRight size={15} />
          </button>
          <button className="as-btn-ghost" onClick={() => navigate('/')}>
            <Home size={15} /> Back to Home
          </button>
        </motion.div>

        {/* Application ID */}
        <motion.div className="as-app-id" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>
          <span>Application ID:</span>
          <code>{`APP-${Date.now().toString(36).toUpperCase().slice(-8)}`}</code>
        </motion.div>
      </div>
    </div>
  );
}
