import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Github, Search, ShieldCheck, Loader2, CheckCircle2,
  AlertTriangle, RefreshCw, X, Sparkles, GitCommit, Code2, Award,
} from 'lucide-react';
import './ResumeAnalysisPipeline.css';

const GITHUB_SUBTASKS = [
  { id: 'repos', label: 'Fetching repositories', icon: Github },
  { id: 'authenticity', label: 'Checking project authenticity', icon: ShieldCheck },
  { id: 'tech', label: 'Verifying technologies', icon: Code2 },
  { id: 'ai-patterns', label: 'Detecting AI-generated code patterns', icon: Sparkles },
  { id: 'commits', label: 'Checking commit history', icon: GitCommit },
  { id: 'features', label: 'Verifying claimed features', icon: CheckCircle2 },
  { id: 'score', label: 'Calculating authenticity score', icon: Award },
];

/**
 * Animates through the GitHub-analysis subtask checklist while verification
 * is running. Real completion is driven by `done` (derived from polled
 * backend status) — this only paces *which* subtask looks active so the
 * workflow reads as a coherent pipeline rather than a single spinner.
 */
function useSubtaskProgress(active, done) {
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!active || done) {
      clearInterval(timerRef.current);
      if (done) setActiveIndex(GITHUB_SUBTASKS.length);
      return;
    }
    setActiveIndex(0);
    timerRef.current = setInterval(() => {
      setActiveIndex((i) => (i < GITHUB_SUBTASKS.length - 1 ? i + 1 : i));
    }, 2600);
    return () => clearInterval(timerRef.current);
  }, [active, done]);

  return activeIndex;
}

function StageIcon({ status, icon: Icon }) {
  if (status === 'done') return <CheckCircle2 size={18} color="var(--success)" />;
  if (status === 'error') return <AlertTriangle size={18} color="var(--danger)" />;
  if (status === 'active') return <Loader2 size={18} className="rap-spin" color="var(--accent-orange)" />;
  return <Icon size={18} color="var(--text-tertiary)" />;
}

/**
 * Professional staged loading workflow for the resume -> GitHub verification
 * pipeline. Purely presentational — driven entirely by real upload/parse/
 * verification state passed in from the parent.
 *
 * stage: 'uploading' | 'parsing' | 'parsed' | 'verifying' | 'complete' | 'error'
 */
export default function ResumeAnalysisPipeline({
  stage,
  uploadProgress = 0,
  parsedData = null,
  githubUrl = '',
  verification = null,        // { isRunning, status, data, error }
  error = null,
  onRetry,
  onCancel,
}) {
  const verifying = stage === 'verifying';
  const verificationDone = stage === 'complete';
  const activeSubtask = useSubtaskProgress(verifying, verificationDone);

  const stages = [
    {
      id: 'parsing',
      label: 'Parsing Resume',
      detail: stage === 'uploading'
        ? `Uploading file… ${uploadProgress}%`
        : 'Extracting name, contact info, skills & projects',
      icon: FileText,
      status: stage === 'uploading' || stage === 'parsing'
        ? 'active'
        : (stage === 'error' && !parsedData ? 'error' : 'done'),
    },
    {
      id: 'github_extracted',
      label: 'GitHub Link Extracted',
      detail: githubUrl ? githubUrl.replace(/^https?:\/\//, '') : 'No GitHub URL found in resume',
      icon: Github,
      status: !parsedData
        ? 'pending'
        : (githubUrl ? 'done' : 'error'),
    },
    {
      id: 'verifying',
      label: 'Analyzing GitHub Profile',
      detail: verifying
        ? 'Repository analysis running — this can take a minute or two'
        : (verificationDone ? 'Verification complete' : 'Waiting for resume parsing to finish'),
      icon: Search,
      status: verificationDone
        ? 'done'
        : (verifying ? 'active' : (stage === 'error' && parsedData && !githubUrl ? 'error' : 'pending')),
    },
  ];

  return (
    <div className="rap-panel">
      <div className="rap-header">
        <div className="rap-header-icon"><Loader2 size={16} className={stage === 'complete' ? '' : 'rap-spin'} /></div>
        <div>
          <h3 className="rap-title">
            {stage === 'complete' ? 'Verification pipeline complete' : 'Analyzing your application…'}
          </h3>
          <p className="rap-subtitle">
            {stage === 'complete'
              ? 'Your resume and GitHub profile have been analyzed.'
              : 'No need to wait here — we\'ll keep working in the background.'}
          </p>
        </div>
        {onCancel && stage !== 'complete' && (
          <button type="button" className="rap-cancel-btn" onClick={onCancel} title="Cancel">
            <X size={15} />
          </button>
        )}
      </div>

      <ol className="rap-stage-list">
        {stages.map((s, i) => (
          <li key={s.id} className={`rap-stage rap-stage--${s.status}`}>
            <div className="rap-stage-icon"><StageIcon status={s.status} icon={s.icon} /></div>
            <div className="rap-stage-body">
              <div className="rap-stage-label">{s.label}</div>
              <div className="rap-stage-detail">{s.detail}</div>

              {/* Upload progress bar */}
              {s.id === 'parsing' && stage === 'uploading' && (
                <div className="rap-progress-track">
                  <motion.div
                    className="rap-progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.3 }}
                  />
                </div>
              )}

              {/* GitHub analysis subtask checklist */}
              {s.id === 'verifying' && (verifying || verificationDone) && (
                <ul className="rap-subtask-list">
                  {GITHUB_SUBTASKS.map((task, idx) => {
                    const subStatus = verificationDone || idx < activeSubtask
                      ? 'done'
                      : (idx === activeSubtask ? 'active' : 'pending');
                    return (
                      <li key={task.id} className={`rap-subtask rap-subtask--${subStatus}`}>
                        {subStatus === 'done' && <CheckCircle2 size={13} color="var(--success)" />}
                        {subStatus === 'active' && <Loader2 size={13} className="rap-spin" color="var(--accent-orange)" />}
                        {subStatus === 'pending' && <span className="rap-subtask-dot" />}
                        <span>{task.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Verification error surfaced inline on its stage */}
              {s.id === 'verifying' && verification?.error && (
                <div className="rap-inline-error">
                  <AlertTriangle size={13} /> {verification.error}
                </div>
              )}
            </div>
            {i < stages.length - 1 && <div className={`rap-connector ${s.status === 'done' ? 'done' : ''}`} />}
          </li>
        ))}
      </ol>

      {/* Parsed candidate summary */}
      <AnimatePresence>
        {parsedData && (
          <motion.div
            className="rap-parsed-summary"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="rap-parsed-title">Extracted from your resume</div>
            <div className="rap-parsed-grid">
              {parsedData.candidate?.name && <span><strong>Name:</strong> {parsedData.candidate.name}</span>}
              {parsedData.candidate?.email && <span><strong>Email:</strong> {parsedData.candidate.email}</span>}
              {parsedData.candidate?.phone && <span><strong>Phone:</strong> {parsedData.candidate.phone}</span>}
              {parsedData.candidate?.linkedin && <span><strong>LinkedIn:</strong> linked</span>}
              {Array.isArray(parsedData.skills) && parsedData.skills.length > 0 && (
                <span className="rap-parsed-full"><strong>Skills:</strong> {parsedData.skills.slice(0, 8).join(', ')}{parsedData.skills.length > 8 ? '…' : ''}</span>
              )}
              {Array.isArray(parsedData.projects) && parsedData.projects.length > 0 && (
                <span className="rap-parsed-full"><strong>Projects detected:</strong> {parsedData.projects.length}</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-level error + retry */}
      <AnimatePresence>
        {error && (
          <motion.div className="rap-error-banner" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AlertTriangle size={15} color="var(--danger)" />
            <span>{error}</span>
            {onRetry && (
              <button type="button" className="rap-retry-btn" onClick={onRetry}>
                <RefreshCw size={13} /> Retry
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {parsedData?.discoveryError && !error && (
        <div className="rap-warning-banner">
          <AlertTriangle size={14} color="var(--warning)" />
          <span>{parsedData.discoveryError}</span>
        </div>
      )}
    </div>
  );
}
