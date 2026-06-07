import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Shield, CheckCircle, AlertTriangle, XCircle, Clock,
  Loader, Code, GitBranch, ExternalLink, ChevronDown, ChevronUp,
  BarChart3, Award, TrendingUp, RefreshCw, FileText, Layers,
  AlertCircle, X, Search, Cpu, Database, Server, Star, Eye,
  Mail, Github, Linkedin, User, Sparkles, Activity, ThumbsUp,
} from 'lucide-react';
import {
  fetchMultiProjectAnalysis, fetchCandidateProfile, getTrustScoreColor, getTrustScoreLabel, getRiskColor,
} from '../services/recruiterApi';
import './MultiProjectDashboard.css';

// ── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 80, strokeWidth = 7 }) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const color = getTrustScoreColor(score);
  const offset = score != null ? circ - (Math.min(100, score) / 100) * circ : circ;
  return (
    <div className="mpd-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: score != null ? offset : circ }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.3 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="mpd-ring-inner">
        {score != null
          ? <span className="mpd-ring-score" style={{ color }}>{score}</span>
          : <Loader size={14} color="var(--text-tertiary)" className="mpd-ring-spin" />}
      </div>
    </div>
  );
}

// ── Project Status Badge ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    completed: { label: 'Verified', color: '#22c55e', icon: CheckCircle },
    partial: { label: 'Partial', color: '#eab308', icon: AlertTriangle },
    running: { label: 'Analyzing', color: '#3b82f6', icon: Loader },
    pending: { label: 'Queued', color: '#737373', icon: Clock },
    failed: { label: 'Failed', color: '#ef4444', icon: XCircle },
  }[status] || { label: 'Unknown', color: '#737373', icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span className="mpd-status-badge" style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
      <Icon size={12} className={status === 'running' ? 'mpd-spin-icon' : ''} /> {cfg.label}
    </span>
  );
}

// ── Claim Row (in evidence drawer) ──────────────────────────────────────────
function ClaimDrawerRow({ claim }) {
  const [open, setOpen] = useState(false);
  const confColor = claim.confidence >= 80 ? '#22c55e' : claim.confidence >= 50 ? '#eab308' : '#ef4444';
  const statusIcon = { verified: CheckCircle, partial: AlertTriangle, failed: XCircle }[claim.status] || AlertCircle;
  const StatusIcon = statusIcon;

  return (
    <div className={`mpd-claim-row ${open ? 'open' : ''}`}>
      <div className="mpd-claim-header" onClick={() => setOpen(o => !o)}>
        <div className="mpd-claim-left">
          <StatusIcon size={15} color={claim.status === 'verified' ? '#22c55e' : claim.status === 'partial' ? '#eab308' : '#ef4444'} />
          <span className="mpd-claim-name">{claim.claim}</span>
          <span className={`mpd-claim-tag ${claim.status}`}>{claim.status}</span>
        </div>
        <div className="mpd-claim-right">
          <div className="mpd-conf-bar-bg">
            <motion.div
              className="mpd-conf-bar-fill"
              style={{ background: confColor }}
              initial={{ width: 0 }}
              animate={{ width: open || true ? `${claim.confidence}%` : 0 }}
              transition={{ duration: 0.6 }}
            />
          </div>
          <span className="mpd-conf-pct" style={{ color: confColor }}>{claim.confidence}%</span>
          <span className="mpd-evidence-count">{claim.evidence?.length || 0} files</span>
          {open ? <ChevronUp size={14} className="mpd-expand-icon" /> : <ChevronDown size={14} className="mpd-expand-icon" />}
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="mpd-evidence-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {(claim.evidence || []).length === 0 ? (
              <div className="mpd-evidence-empty">
                <AlertCircle size={14} /> No code evidence found for this claim
              </div>
            ) : (claim.evidence || []).map((ev, i) => (
              <div key={i} className="mpd-evidence-item">
                <div className="mpd-evidence-file">
                  <Code size={12} color="#3b82f6" />
                  <code>{ev.file}</code>
                </div>
                <div className="mpd-evidence-reason">{ev.reason}</div>
                {ev.snippet && <pre className="mpd-evidence-snippet"><code>{ev.snippet}</code></pre>}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Evidence Drawer ──────────────────────────────────────────────────────────
function EvidenceDrawer({ project, onClose }) {
  return (
    <motion.div
      className="mpd-drawer-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="mpd-drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="mpd-drawer-header">
          <div className="mpd-drawer-title-row">
            <div>
              <h2 className="mpd-drawer-title">{project.name}</h2>
              <a
                className="mpd-drawer-url"
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitBranch size={12} /> {project.githubUrl.replace('https://github.com/', '')}
                <ExternalLink size={11} />
              </a>
            </div>
            <button className="mpd-drawer-close" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="mpd-drawer-scores">
            <div className="mpd-drawer-score-item">
              <span className="mpd-drawer-score-val" style={{ color: getTrustScoreColor(project.trustScore) }}>
                {project.trustScore ?? '—'}
              </span>
              <span className="mpd-drawer-score-lbl">Trust Score</span>
            </div>
            <div className="mpd-drawer-score-item">
              <span className="mpd-drawer-score-val" style={{ color: '#a855f7' }}>
                {project.authenticityScore ?? '—'}
              </span>
              <span className="mpd-drawer-score-lbl">Authenticity</span>
            </div>
            <div className="mpd-drawer-score-item">
              <span className="mpd-drawer-score-val" style={{ color: '#3b82f6' }}>
                {project.architectureScore ?? '—'}
              </span>
              <span className="mpd-drawer-score-lbl">Architecture</span>
            </div>
            <div className="mpd-drawer-score-item">
              <span className="mpd-drawer-score-val" style={{ color: project.claimsVerified > 0 ? '#22c55e' : '#737373' }}>
                {project.claimsVerified != null ? `${project.claimsVerified}/${project.totalClaims}` : '—'}
              </span>
              <span className="mpd-drawer-score-lbl">Verified Claims</span>
            </div>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="mpd-drawer-body">
          {/* Languages */}
          {Object.keys(project.languages || {}).length > 0 && (
            <div className="mpd-drawer-section">
              <h3 className="mpd-drawer-section-title">Languages</h3>
              <div className="mpd-lang-list">
                {Object.entries(project.languages || {}).map(([lang, pct]) => {
                  const pctVal = typeof pct === 'object' ? (pct?.percentage ?? 0) : (pct ?? 0);
                  return (
                    <div key={lang} className="mpd-lang-row">
                      <span className="mpd-lang-name">{lang}</span>
                      <div className="mpd-lang-bar-bg">
                        <motion.div
                          className="mpd-lang-bar-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${pctVal}%` }}
                          transition={{ duration: 0.7 }}
                        />
                      </div>
                      <span className="mpd-lang-pct">{pctVal}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Technologies */}
          {(project.technologies || []).length > 0 && (
            <div className="mpd-drawer-section">
              <h3 className="mpd-drawer-section-title">Technologies Detected</h3>
              <div className="mpd-tech-pills">
                {(project.technologies || []).map((t, i) => (
                  <span key={i} className="mpd-tech-pill">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Claim Verification */}
          <div className="mpd-drawer-section">
            <div className="mpd-claims-header-row">
              <h3 className="mpd-drawer-section-title">Claim Verification</h3>
              <div className="mpd-claims-legend">
                <span className="mpd-legend-item verified"><CheckCircle size={10} /> Verified</span>
                <span className="mpd-legend-item partial"><AlertTriangle size={10} /> Partial</span>
                <span className="mpd-legend-item failed"><XCircle size={10} /> Failed</span>
              </div>
            </div>
            <div className="mpd-claims-list">
              {(project.claimVerification || []).length === 0 ? (
                <div className="mpd-no-claims">
                  {project.status === 'running' || project.status === 'pending'
                    ? 'Analysis in progress...'
                    : 'No claims to verify'}
                </div>
              ) : (
                (project.claimVerification || []).map((c, i) => (
                  <ClaimDrawerRow key={i} claim={c} />
                ))
              )}
            </div>
          </div>

          {/* Repo Stats */}
          {project.files != null && (
            <div className="mpd-drawer-section">
              <h3 className="mpd-drawer-section-title">Repository Stats</h3>
              <div className="mpd-repo-stats">
                <div className="mpd-repo-stat">
                  <span className="mpd-repo-stat-val">{project.files}</span>
                  <span className="mpd-repo-stat-lbl">Files</span>
                </div>
                <div className="mpd-repo-stat">
                  <span className="mpd-repo-stat-val">{(project.linesOfCode || 0).toLocaleString()}</span>
                  <span className="mpd-repo-stat-lbl">Lines of Code</span>
                </div>
                <div className="mpd-repo-stat">
                  <span className="mpd-repo-stat-val">{project.commitCount}</span>
                  <span className="mpd-repo-stat-lbl">Commits</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, index, onViewEvidence }) {
  const isRunning = project.status === 'running' || project.status === 'pending';
  const trustColor = getTrustScoreColor(project.trustScore);

  return (
    <motion.div
      className={`mpd-project-card ${project.status}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
    >
      {/* Card Header */}
      <div className="mpd-card-header">
        <div className="mpd-card-header-left">
          <div className="mpd-card-avatar">
            {project.name?.[0]?.toUpperCase() || '#'}
          </div>
          <div>
            <h3 className="mpd-card-title">{project.name}</h3>
            <a
              className="mpd-card-url"
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              <GitBranch size={11} />
              {project.githubUrl.replace('https://github.com/', '')}
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {/* Scores Row */}
      <div className="mpd-card-scores">
        <div className="mpd-card-score-item">
          <ScoreRing score={project.trustScore} size={64} strokeWidth={5} />
          <span className="mpd-card-score-lbl">Trust</span>
        </div>
        <div className="mpd-card-score-item">
          <ScoreRing score={project.authenticityScore} size={64} strokeWidth={5} />
          <span className="mpd-card-score-lbl">Authenticity</span>
        </div>
        <div className="mpd-card-score-item">
          <ScoreRing score={project.architectureScore} size={64} strokeWidth={5} />
          <span className="mpd-card-score-lbl">Architecture</span>
        </div>
      </div>

      {/* Technologies */}
      {(project.technologies || []).length > 0 && (
        <div className="mpd-card-tech">
          {project.technologies.slice(0, 4).map((t, i) => (
            <span key={i} className="mpd-card-tech-pill">{t}</span>
          ))}
          {project.technologies.length > 4 && (
            <span className="mpd-card-tech-more">+{project.technologies.length - 4}</span>
          )}
        </div>
      )}

      {/* Claims mini bar */}
      {!isRunning && project.claimsVerified != null && (
        <div className="mpd-card-claims-bar">
          <div className="mpd-card-claims-text">
            <CheckCircle size={12} color="#22c55e" />
            <span>{project.claimsVerified}/{project.totalClaims} claims verified</span>
          </div>
          <div className="mpd-card-bar-bg">
            <div
              className="mpd-card-bar-fill"
              style={{
                width: `${project.totalClaims > 0 ? (project.claimsVerified / project.totalClaims) * 100 : 0}%`,
                background: trustColor,
              }}
            />
          </div>
        </div>
      )}

      {/* Running state */}
      {isRunning && (
        <div className="mpd-card-running">
          <div className="mpd-running-dots">
            {[0, 1, 2].map(i => <div key={i} className="mpd-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}
          </div>
          <span>Repository analysis in progress...</span>
        </div>
      )}

      {/* Action */}
      <button
        className="mpd-card-evidence-btn"
        onClick={() => onViewEvidence(project)}
        disabled={isRunning && project.status !== 'partial'}
      >
        <Eye size={14} />
        {isRunning ? 'Analyzing...' : 'View Evidence'}
      </button>
    </motion.div>
  );
}

// ── Pipeline Steps ────────────────────────────────────────────────────────────
function PipelineStep({ step, index, isLast }) {
  return (
    <motion.div
      className={`mpd-pipeline-step ${step.done ? 'done' : step.running ? 'running' : 'pending'}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <div className="mpd-step-icon-col">
        <div className="mpd-step-icon-wrap">
          {step.done ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <CheckCircle size={16} color="#22c55e" />
            </motion.div>
          ) : step.running ? (
            <Loader size={16} color="#3b82f6" className="mpd-spin-icon" />
          ) : (
            <div className="mpd-step-pending-dot" />
          )}
        </div>
        {!isLast && <div className={`mpd-step-connector ${step.done ? 'done' : ''}`} />}
      </div>
      <div className="mpd-step-body">
        <div className="mpd-step-label">{step.label}</div>
        {step.detail && <div className="mpd-step-detail">{step.detail}</div>}
        {step.ts && <div className="mpd-step-ts">{step.ts}</div>}
      </div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MultiProjectDashboard() {
  const { candidateId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    load();
    fetchCandidateProfile(candidateId).then(setProfile).catch(() => setProfile(null));
    return () => clearInterval(pollRef.current);
  }, [candidateId]);

  async function load(silent = false) {
    if (!silent) { setLoading(true); setLoadError(null); }
    else setRefreshing(true);
    try {
      const result = await fetchMultiProjectAnalysis(candidateId);
      setData(result || null);
      setLoadError(null);
      // Keep polling while analysis is in progress OR while projects list is still empty (queued)
      const status = result?.overallStatus || result?.analysisStatus;
      const projectsEmpty = !result?.projects?.length;
      const stillRunning = result && status !== 'completed' && status !== 'failed' && status !== 'partial_failure';
      if (stillRunning || projectsEmpty) {
        clearInterval(pollRef.current);
        pollRef.current = setInterval(() => load(true), 4000);
      } else {
        clearInterval(pollRef.current);
      }
    } catch (err) {
      clearInterval(pollRef.current);
      const status = err?.response?.status;
      let message = 'Could not reach the verification service. Please check your connection and try again.';
      if (status === 429) message = 'GitHub API rate limit reached. Verification will resume automatically — please try again shortly.';
      else if (status === 404) message = 'No verification data found for this candidate yet.';
      else if (status >= 500) message = 'The verification service is temporarily unavailable. Please try again in a moment.';
      setLoadError(message);
      if (!silent) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filtered = (data?.projects || []).filter(p => {
    const matchFilter = activeFilter === 'all' || p.status === activeFilter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.githubUrl.includes(search);
    return matchFilter && matchSearch;
  });

  if (loading) {
    return (
      <div className="mpd-loading">
        <div className="mpd-spinner" />
        <p>Loading project analysis...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mpd-loading">
        <AlertTriangle size={40} color="var(--danger)" style={{ marginBottom: 16 }} />
        <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Could not load verification data</p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, maxWidth: 360, textAlign: 'center' }}>{loadError}</p>
        <button className="mpd-refresh-btn" style={{ marginTop: 24 }} onClick={() => load()}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  if (!data || (Array.isArray(data.projects) && data.projects.length === 0)) {
    const status = data?.overallStatus;
    const isFailed = status === 'failed' || status === 'partial_failure';
    // Analysis ran to completion but discovered zero repos — distinct from "still queued"
    const isEmptyResult = status === 'completed' && (data?.totalProjects ?? 0) === 0;
    const isPending = !isFailed && !isEmptyResult && (status === 'pending' || status === 'in_progress' || data?.message?.includes('No analysis'));

    let body;
    if (isFailed) {
      body = (
        <>
          <XCircle size={40} color="var(--danger)" style={{ marginBottom: 16 }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>GitHub verification failed</p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, maxWidth: 380, textAlign: 'center' }}>
            This can happen when repositories are <strong>private</strong>, the GitHub API <strong>rate limit</strong> was hit,
            or the verification service encountered an error while cloning/analyzing the code. Try again in a few minutes.
          </p>
        </>
      );
    } else if (isEmptyResult) {
      body = (
        <>
          <GitBranch size={40} color="var(--text-tertiary)" style={{ marginBottom: 16 }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>No public repositories found</p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, maxWidth: 380, textAlign: 'center' }}>
            The resume was parsed but no verifiable GitHub projects were discovered — the candidate's profile may have
            <strong> no public repositories</strong>, the listed projects may be in <strong>private repos</strong>, or no GitHub
            links were present in the resume.
          </p>
        </>
      );
    } else if (isPending) {
      body = (
        <>
          <div className="mpd-spinner" style={{ marginBottom: 16 }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Analysis queued — waiting for results</p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            GitHub repositories are being discovered from the resume.<br />
            This usually takes 30–60 seconds. The page auto-refreshes.
          </p>
        </>
      );
    } else {
      body = (
        <>
          <GitBranch size={40} color="var(--text-tertiary)" style={{ marginBottom: 16 }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>No GitHub verification started yet</p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            GitHub repos will appear here once the candidate's resume is analyzed.<br/>
            Make sure the candidate has submitted their application with a resume and a GitHub URL.
          </p>
        </>
      );
    }

    return (
      <div className="mpd-loading">
        {body}
        <button className="mpd-refresh-btn" style={{ marginTop: 24 }} onClick={() => load()}>
          <RefreshCw size={14} /> Check Again
        </button>
      </div>
    );
  }

  const d = data;
  const trustColor = getTrustScoreColor(d.overallTrustScore);
  const riskColor = getRiskColor(d.riskLevel);

  const completedCount = (d.projects || []).filter(p => p.status === 'completed').length;
  const partialCount = (d.projects || []).filter(p => p.status === 'partial').length;
  const runningCount = (d.projects || []).filter(p => p.status === 'running' || p.status === 'pending').length;
  const totalProjects = (d.projects || []).length;
  const analysisProgress = totalProjects > 0 ? Math.round(((completedCount + partialCount) / totalProjects) * 100) : 0;

  // ── Authenticity Analysis — derived from real per-project verification scores ──
  const scoredProjects = (d.projects || []).filter(p => p.trustScore != null);
  const claimTotals = scoredProjects.reduce((acc, p) => ({
    verified: acc.verified + (p.claimsVerified || 0),
    total: acc.total + (p.totalClaims || 0),
  }), { verified: 0, total: 0 });
  const avg = (key) => {
    const vals = scoredProjects.map(p => p[key]).filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const githubAuthenticityScore = d.authenticityScore;
  // Resume authenticity = how much of what the candidate claimed was actually verified in their repos
  const resumeAuthenticityScore = claimTotals.total > 0
    ? Math.round((claimTotals.verified / claimTotals.total) * 100)
    : null;
  // AI-generated probability is the inverse of the code-authenticity signal the
  // pipeline already computes (low authenticity ⇒ higher likelihood of templated/AI code)
  const aiGeneratedProbability = githubAuthenticityScore != null
    ? Math.max(0, Math.min(100, Math.round(100 - githubAuthenticityScore)))
    : null;
  // Project completion approximated from architecture-completeness scores across analyzed repos
  const projectCompletionScore = avg('architectureScore');
  const hasAuthenticityData = totalProjects > 0 && d.overallTrustScore != null;

  const pipelineSteps = [
    { id: 'resume_uploaded', label: 'Resume Uploaded', detail: 'Resume stored securely', done: true, ts: '10:30:00' },
    { id: 'resume_parsed', label: 'Resume Parsed', detail: 'Skills & projects extracted', done: d.pipelineSteps?.find(s => s.id === 'resume_parsed')?.done ?? true, ts: '10:30:12' },
    { id: 'projects_discovered', label: `Projects Discovered`, detail: `${totalProjects} GitHub repos found`, done: d.pipelineSteps?.find(s => s.id === 'projects_discovered')?.done ?? true, ts: '10:30:15' },
    { id: 'workers_dispatched', label: 'Workers Dispatched', detail: `${totalProjects} parallel jobs started`, done: d.pipelineSteps?.find(s => s.id === 'repos_queued')?.done ?? true, ts: '10:30:16' },
    { id: 'analysis_running', label: 'Repository Analysis', detail: `${completedCount + partialCount}/${totalProjects} complete`, running: runningCount > 0, done: runningCount === 0, ts: runningCount === 0 ? '10:33:40' : null },
    { id: 'aggregation', label: 'Score Aggregation', detail: 'Computing final trust score', done: runningCount === 0 && d.overallTrustScore != null, running: runningCount === 0 && d.overallTrustScore == null },
    { id: 'report', label: 'Report Generated', detail: 'Full recruiter report ready', done: runningCount === 0 && d.overallTrustScore != null },
  ];

  const FILTER_TABS = [
    { key: 'all', label: 'All', count: totalProjects },
    { key: 'completed', label: 'Verified', count: completedCount },
    { key: 'partial', label: 'Partial', count: partialCount },
    { key: 'running', label: 'Analyzing', count: runningCount },
  ];

  return (
    <div className="mpd-page">
      {/* Header */}
      <header className="mpd-header">
        <div className="mpd-header-inner">
          <button className="mpd-back-btn" onClick={() => navigate('/recruiter/candidates')}>
            <ArrowLeft size={16} /> Candidates
          </button>
          <div className="mpd-header-info">
            <h1 className="mpd-header-name">{d.candidateName}</h1>
            <span className="mpd-header-role">{d.appliedRole}</span>
          </div>
          <div className="mpd-header-badges">
            {d.overallTrustScore != null && (
              <span className="mpd-trust-badge" style={{ color: trustColor, background: `${trustColor}15`, border: `1px solid ${trustColor}30` }}>
                <Shield size={13} /> {d.overallTrustScore}/100
              </span>
            )}
            {d.riskLevel && (
              <span className="mpd-risk-badge" style={{ color: riskColor, background: `${riskColor}15`, border: `1px solid ${riskColor}30` }}>
                {d.riskLevel} RISK
              </span>
            )}
          </div>
          <div className="mpd-header-actions">
            <button className={`mpd-refresh-btn ${refreshing ? 'spinning' : ''}`} onClick={() => load(true)}>
              <RefreshCw size={15} />
            </button>
            {d.overallTrustScore != null && (
              <button className="mpd-report-btn" onClick={() => navigate(`/recruiter/report/${candidateId}`)}>
                <FileText size={14} /> Full Report
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mpd-body">
        {/* Left Sidebar */}
        <aside className="mpd-sidebar">
          {/* Candidate Overview */}
          <motion.div className="mpd-sidebar-card mpd-overview-card" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
            <h3 className="mpd-sidebar-card-title">CANDIDATE OVERVIEW</h3>
            <ul className="mpd-overview-list">
              <li>
                <User size={13} color="var(--text-tertiary)" />
                <span className="mpd-overview-label">Name</span>
                <span className="mpd-overview-value">{profile?.name || d.candidateName || '—'}</span>
              </li>
              <li>
                <Mail size={13} color="var(--text-tertiary)" />
                <span className="mpd-overview-label">Email</span>
                <span className="mpd-overview-value">{profile?.email || '—'}</span>
              </li>
              <li>
                <Github size={13} color="var(--text-tertiary)" />
                <span className="mpd-overview-label">GitHub</span>
                {profile?.github
                  ? <a className="mpd-overview-link" href={profile.github} target="_blank" rel="noreferrer">
                      {profile.github.replace(/^https?:\/\/(www\.)?/, '')} <ExternalLink size={11} />
                    </a>
                  : <span className="mpd-overview-value">—</span>}
              </li>
              <li>
                <Linkedin size={13} color="var(--text-tertiary)" />
                <span className="mpd-overview-label">LinkedIn</span>
                {profile?.linkedin
                  ? <a className="mpd-overview-link" href={profile.linkedin} target="_blank" rel="noreferrer">
                      View profile <ExternalLink size={11} />
                    </a>
                  : <span className="mpd-overview-value">—</span>}
              </li>
              <li>
                <FileText size={13} color="var(--text-tertiary)" />
                <span className="mpd-overview-label">Resume Score</span>
                <span className="mpd-overview-value" style={{ color: profile?.resumeScore != null ? getTrustScoreColor(profile.resumeScore) : undefined }}>
                  {profile?.resumeScore != null ? `${profile.resumeScore}/100` : '—'}
                </span>
              </li>
              <li>
                <Shield size={13} color="var(--text-tertiary)" />
                <span className="mpd-overview-label">Verification Score</span>
                <span className="mpd-overview-value" style={{ color: d.overallTrustScore != null ? trustColor : undefined }}>
                  {d.overallTrustScore != null ? `${d.overallTrustScore}/100` : 'Computing…'}
                </span>
              </li>
            </ul>
          </motion.div>

          {/* Overall Score */}
          <motion.div className="mpd-sidebar-card mpd-score-card" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
            <h3 className="mpd-sidebar-card-title mpd-score-card-title">CANDIDATE TRUST SCORE</h3>
            <div className="mpd-overall-score-ring">
              {d.overallTrustScore == null ? (
                <div className="mpd-trust-computing-ring">
                  <svg width={120} height={120} viewBox="0 0 120 120">
                    <circle cx={60} cy={60} r={51} fill="none" stroke="var(--bg-tertiary)" strokeWidth={9} />
                  </svg>
                  <div className="mpd-trust-computing-inner">
                    <Loader size={28} className="mpd-ring-spin" color="var(--text-tertiary)" />
                  </div>
                </div>
              ) : (
                <ScoreRing score={d.overallTrustScore} size={120} strokeWidth={9} />
              )}
            </div>
            <div className="mpd-score-grade" style={{ color: d.overallTrustScore != null ? trustColor : 'var(--text-secondary)' }}>
              {d.overallTrustScore != null ? getTrustScoreLabel(d.overallTrustScore) : 'Computing...'}
            </div>
            {d.recommendation && (
              <div className="mpd-recommendation">{d.recommendation}</div>
            )}
            {d.riskLevel && (
              <div className="mpd-risk-pill" style={{ color: riskColor, background: `${riskColor}12`, border: `1px solid ${riskColor}25` }}>
                {d.riskLevel} RISK
              </div>
            )}
          </motion.div>

          {/* Quick Stats */}
          <motion.div className="mpd-sidebar-card" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}>
            {[
              { label: 'Projects Found', val: totalProjects, color: '#3b82f6' },
              { label: 'Verified', val: completedCount + partialCount, color: '#22c55e' },
              { label: 'Analyzing', val: runningCount, color: '#eab308' },
              { label: 'Authenticity', val: d.authenticityScore != null ? `${d.authenticityScore}/100` : '—', color: '#a855f7' },
            ].map(({ label, val, color }) => (
              <div key={label} className="mpd-quick-stat">
                <span className="mpd-quick-stat-val" style={{ color }}>{val}</span>
                <span className="mpd-quick-stat-lbl">{label}</span>
              </div>
            ))}
          </motion.div>

          {/* Pipeline Steps */}
          <motion.div className="mpd-sidebar-card" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.14 }}>
            <div className="mpd-sidebar-card-header">
              <h3 className="mpd-sidebar-card-title">Verification Pipeline</h3>
              <span className="mpd-pipeline-pct" style={{ color: analysisProgress === 100 ? '#22c55e' : '#3b82f6' }}>
                {analysisProgress}%
              </span>
            </div>
            <div className="mpd-pipeline-steps">
              {pipelineSteps.map((step, i) => (
                <PipelineStep key={step.id} step={step} index={i} isLast={i === pipelineSteps.length - 1} />
              ))}
            </div>
          </motion.div>

          {/* Aggregated Skills */}
          {(d.aggregatedSkills || []).length > 0 && (
            <motion.div className="mpd-sidebar-card" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="mpd-sidebar-card-title">Detected Skills</h3>
              <div className="mpd-skill-pills">
                {(d.aggregatedSkills || []).map((s, i) => (
                  <span key={i} className="mpd-skill-pill">{s}</span>
                ))}
              </div>
            </motion.div>
          )}
        </aside>

        {/* Main Area */}
        <main className="mpd-main">
          {/* Section Header */}
          <div className="mpd-main-header">
            <div className="mpd-main-header-left">
              <h2 className="mpd-main-title">
                <GitBranch size={18} color="#3b82f6" />
                Discovered Projects <span className="mpd-count-pill">{totalProjects}</span>
              </h2>
              <p className="mpd-main-sub">All GitHub projects extracted from resume — verified in parallel</p>
            </div>

            {/* Progress Bar */}
            <div className="mpd-analysis-progress">
              <div className="mpd-analysis-progress-bar-bg">
                <motion.div
                  className="mpd-analysis-progress-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${analysisProgress}%` }}
                  style={{ background: analysisProgress === 100 ? '#22c55e' : 'linear-gradient(90deg, #3b82f6, #a855f7)' }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="mpd-analysis-progress-text">
                {completedCount + partialCount}/{totalProjects} analyzed
              </span>
            </div>
          </div>

          {/* Filter Tabs + Search */}
          <div className="mpd-toolbar">
            <div className="mpd-filter-tabs">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.key}
                  className={`mpd-filter-tab ${activeFilter === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveFilter(tab.key)}
                >
                  {tab.label}
                  <span className="mpd-tab-count">{tab.count}</span>
                </button>
              ))}
            </div>
            <div className="mpd-search-wrap">
              <Search size={14} className="mpd-search-icon" />
              <input
                className="mpd-search"
                placeholder="Search projects..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Project Cards Grid */}
          <div className="mpd-projects-grid">
            {filtered.length === 0 ? (
              <div className="mpd-empty">
                <GitBranch size={32} color="var(--text-tertiary)" />
                <p>No projects match your filter</p>
              </div>
            ) : (
              filtered.map((project, i) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={i}
                  onViewEvidence={setSelectedProject}
                />
              ))
            )}
          </div>

          {/* Authenticity Analysis */}
          {hasAuthenticityData && (
            <motion.div className="mpd-aggregate-card mpd-authenticity-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
              <h2 className="mpd-aggregate-title">
                <Sparkles size={16} color="#a855f7" /> Authenticity Analysis
              </h2>
              <div className="mpd-authenticity-grid">
                <div className="mpd-auth-metric">
                  <div className="mpd-auth-metric-head">
                    <FileText size={14} color="#3b82f6" />
                    <span>Resume Authenticity Score</span>
                  </div>
                  <div className="mpd-auth-metric-val" style={{ color: resumeAuthenticityScore != null ? getTrustScoreColor(resumeAuthenticityScore) : 'var(--text-tertiary)' }}>
                    {resumeAuthenticityScore != null ? `${resumeAuthenticityScore}/100` : '—'}
                  </div>
                  <p className="mpd-auth-metric-note">Share of resume claims verified against the candidate's repositories ({claimTotals.verified}/{claimTotals.total} claims)</p>
                </div>

                <div className="mpd-auth-metric">
                  <div className="mpd-auth-metric-head">
                    <Github size={14} color="#e2e8f0" />
                    <span>GitHub Authenticity Score</span>
                  </div>
                  <div className="mpd-auth-metric-val" style={{ color: githubAuthenticityScore != null ? getTrustScoreColor(githubAuthenticityScore) : 'var(--text-tertiary)' }}>
                    {githubAuthenticityScore != null ? `${githubAuthenticityScore}/100` : '—'}
                  </div>
                  <p className="mpd-auth-metric-note">How original and authored (vs. copied/templated) the analyzed code appears to be</p>
                </div>

                <div className="mpd-auth-metric">
                  <div className="mpd-auth-metric-head">
                    <Cpu size={14} color="#eab308" />
                    <span>AI-Generated Code Probability</span>
                  </div>
                  <div className="mpd-auth-metric-val" style={{ color: aiGeneratedProbability != null ? getRiskColor(aiGeneratedProbability > 60 ? 'HIGH' : aiGeneratedProbability > 30 ? 'MEDIUM' : 'LOW') : 'var(--text-tertiary)' }}>
                    {aiGeneratedProbability != null ? `${aiGeneratedProbability}%` : '—'}
                  </div>
                  <p className="mpd-auth-metric-note">Derived from the code-authenticity signal — lower authenticity raises the likelihood of templated or AI-generated code</p>
                </div>

                <div className="mpd-auth-metric">
                  <div className="mpd-auth-metric-head">
                    <Layers size={14} color="#22c55e" />
                    <span>Project Completion Score</span>
                  </div>
                  <div className="mpd-auth-metric-val" style={{ color: projectCompletionScore != null ? getTrustScoreColor(projectCompletionScore) : 'var(--text-tertiary)' }}>
                    {projectCompletionScore != null ? `${projectCompletionScore}/100` : '—'}
                  </div>
                  <p className="mpd-auth-metric-note">Average architecture &amp; completeness score across all analyzed repositories</p>
                </div>
              </div>

              {d.recommendation && (
                <div className="mpd-auth-recommendation" style={{ borderColor: `${trustColor}40`, background: `${trustColor}10` }}>
                  <ThumbsUp size={16} color={trustColor} />
                  <div>
                    <div className="mpd-auth-rec-label">Recruiter Recommendation</div>
                    <div className="mpd-auth-rec-text" style={{ color: trustColor }}>{d.recommendation}</div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Aggregated Score Table */}
          {d.overallTrustScore != null && (
            <motion.div className="mpd-aggregate-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <h2 className="mpd-aggregate-title">
                <Award size={16} color="#f59e0b" /> Score Aggregation
              </h2>
              <div className="mpd-aggregate-table-wrap">
                <table className="mpd-aggregate-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Trust Score</th>
                      <th>Authenticity</th>
                      <th>Architecture</th>
                      <th>Verified Claims</th>
                      <th>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(d.projects || []).filter(p => p.trustScore != null).map((p, i) => (
                      <tr key={p.id}>
                        <td>
                          <div className="mpd-agg-name-cell">
                            <div className="mpd-agg-avatar">{p.name?.[0]}</div>
                            <div>
                              <div className="mpd-agg-name">{p.name}</div>
                              <StatusBadge status={p.status} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="mpd-agg-score" style={{ color: getTrustScoreColor(p.trustScore) }}>
                            {p.trustScore}
                          </span>
                        </td>
                        <td>
                          <span className="mpd-agg-score" style={{ color: '#a855f7' }}>{p.authenticityScore}</span>
                        </td>
                        <td>
                          <span className="mpd-agg-score" style={{ color: '#3b82f6' }}>{p.architectureScore}</span>
                        </td>
                        <td>
                          <span className="mpd-agg-claims">
                            {p.claimsVerified}/{p.totalClaims}
                          </span>
                        </td>
                        <td>
                          <span className="mpd-agg-weight">
                            {Math.round(100 / (d.projects.filter(x => x.trustScore != null).length))}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="mpd-agg-total-row">
                      <td><strong>Final Candidate Score</strong></td>
                      <td colSpan={4}>
                        <strong style={{ color: trustColor, fontSize: 18 }}>{d.overallTrustScore}/100</strong>
                        <span className="mpd-agg-label" style={{ color: trustColor }}> · {getTrustScoreLabel(d.overallTrustScore)}</span>
                      </td>
                      <td><strong>100%</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </motion.div>
          )}
        </main>
      </div>

      {/* Evidence Drawer */}
      <AnimatePresence>
        {selectedProject && (
          <EvidenceDrawer
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
