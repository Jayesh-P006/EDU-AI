import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Shield, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Code, FileText, GitBranch,
  Layers, Database, Server, Award, TrendingUp, AlertCircle,
  Clock, Download, Share2, BarChart3,
} from 'lucide-react';
import {
  fetchCandidateReport, fetchMultiProjectAnalysis,
  getTrustScoreColor, getTrustScoreLabel,
  getRiskColor, MOCK_REPORT, MOCK_CANDIDATES,
} from '../services/recruiterApi';
import './RecruiterReport.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

// ── Trust Score Ring ─────────────────────────────────────────────────────────
function TrustScoreRing({ score }) {
  const color = getTrustScoreColor(score);
  const label = getTrustScoreLabel(score);
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score));
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="rr-ring-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--bg-tertiary)" strokeWidth="10" />
        <motion.circle
          cx="70" cy="70" r={radius}
          fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="rr-ring-inner">
        <div className="rr-ring-score" style={{ color }}>{score}</div>
        <div className="rr-ring-max">/100</div>
      </div>
    </div>
  );
}

// ── Claim Status Icon ────────────────────────────────────────────────────────
function ClaimIcon({ status }) {
  if (status === 'verified') return <CheckCircle size={16} color="#22c55e" />;
  if (status === 'partial') return <AlertTriangle size={16} color="#eab308" />;
  return <XCircle size={16} color="#ef4444" />;
}

// ── Evidence Row ─────────────────────────────────────────────────────────────
function EvidencePanel({ claim, evidenceMap }) {
  const items = evidenceMap?.[claim] || [];
  if (!items.length) return (
    <div className="rr-evidence-empty">
      <AlertCircle size={16} color="var(--text-tertiary)" /> No code evidence found for this claim
    </div>
  );
  return (
    <div className="rr-evidence-list">
      {items.map((e, i) => (
        <div key={i} className="rr-evidence-item">
          <div className="rr-evidence-file">
            <Code size={13} color="#3b82f6" />
            <code>{e.file}</code>
          </div>
          <div className="rr-evidence-reason">{e.reason}</div>
          {e.snippet && (
            <pre className="rr-evidence-snippet"><code>{e.snippet}</code></pre>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Claim Verification Row ───────────────────────────────────────────────────
function ClaimRow({ claim, evidenceMap }) {
  const [open, setOpen] = useState(false);
  const conf = claim.confidence;
  const confColor = conf >= 80 ? '#22c55e' : conf >= 50 ? '#eab308' : '#ef4444';

  return (
    <div className={`rr-claim-row ${open ? 'open' : ''}`}>
      <div className="rr-claim-main" onClick={() => setOpen(o => !o)}>
        <div className="rr-claim-left">
          <ClaimIcon status={claim.status} />
          <span className="rr-claim-name">{claim.claim}</span>
          <span className={`rr-claim-status-badge ${claim.status}`}>{claim.status}</span>
        </div>
        <div className="rr-claim-right">
          <div className="rr-conf-bar-wrap">
            <div className="rr-conf-bar-bg">
              <motion.div
                className="rr-conf-bar-fill"
                style={{ background: confColor }}
                initial={{ width: 0 }}
                animate={{ width: `${conf}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
            <span className="rr-conf-pct" style={{ color: confColor }}>{conf}%</span>
          </div>
          <span className="rr-evidence-count">{claim.evidenceCount} evidence</span>
          {open ? <ChevronUp size={15} className="rr-expand-icon" /> : <ChevronDown size={15} className="rr-expand-icon" />}
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="rr-evidence-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <EvidencePanel claim={claim.claim} evidenceMap={evidenceMap} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Architecture Donut ───────────────────────────────────────────────────────
function ArchCard({ label, count, color }) {
  return (
    <div className="rr-arch-card">
      <span className="rr-arch-count" style={{ color }}>{count}</span>
      <span className="rr-arch-label">{label}</span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function RecruiterReport() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [multiProjects, setMultiProjects] = useState(null);
  const [multiLoading, setMultiLoading] = useState(false);

  useEffect(() => {
    const c = MOCK_CANDIDATES.find(x => x.id === candidateId);
    setCandidate(c);
    loadReport();
  }, [candidateId]);

  // Poll multi-project analysis when the projects tab is active
  useEffect(() => {
    if (activeTab !== 'projects') return;
    let alive = true;

    async function poll() {
      if (!alive) return;
      setMultiLoading(prev => multiProjects === null ? true : prev);
      const data = await fetchMultiProjectAnalysis(candidateId);
      if (!alive) return;
      setMultiProjects(data);
      setMultiLoading(false);
      if (data?.overallStatus !== 'completed' && data?.analysisStatus !== 'completed') {
        setTimeout(poll, 3000);
      }
    }
    poll();
    return () => { alive = false; };
  }, [activeTab, candidateId]);

  async function loadReport() {
    try {
      const data = await fetchCandidateReport(candidateId);
      setReport(data);
    } catch {
      setReport(MOCK_REPORT);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rr-loading">
        <div className="rr-spinner" />
        <p>Loading verification report...</p>
      </div>
    );
  }

  const r = report || MOCK_REPORT;
  const trustColor = getTrustScoreColor(r.trustScore);
  const riskColor = getRiskColor(r.riskLevel);
  const verifiedCount = r.claimVerification?.filter(c => c.status === 'verified').length || 0;
  const failedCount = r.claimVerification?.filter(c => c.status === 'failed').length || 0;
  const partialCount = r.claimVerification?.filter(c => c.status === 'partial').length || 0;

  const TABS = ['overview', 'projects', 'claims', 'repository', 'architecture', 'authenticity'];

  return (
    <div className="rr-page">
      {/* Header */}
      <header className="rr-header">
        <button className="rr-back-btn" onClick={() => navigate('/recruiter/candidates')}>
          <ArrowLeft size={16} /> Candidates
        </button>
        <div className="rr-header-title-wrap">
          <h1 className="rr-header-title">{r.candidateName}</h1>
          <span className="rr-header-role">{r.appliedRole}</span>
        </div>
        <div className="rr-header-badges">
          <span className="rr-trust-badge-sm" style={{ color: trustColor, background: `${trustColor}18`, border: `1px solid ${trustColor}40` }}>
            <Shield size={12} /> {r.trustScore}/100
          </span>
          <span className="rr-risk-badge-sm" style={{ color: riskColor, background: `${riskColor}18`, border: `1px solid ${riskColor}40` }}>
            {r.riskLevel} RISK
          </span>
        </div>
        <div className="rr-header-actions">
          <button className="rr-compare-btn" onClick={() => navigate(`/recruiter/compare?ids=${candidateId}`)}>
            <BarChart3 size={14} /> Compare
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="rr-hero">
        <motion.div className="rr-hero-left" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="rr-candidate-avatar-lg">{r.candidateName?.[0] || '?'}</div>
          <div>
            <h2 className="rr-candidate-name">{r.candidateName}</h2>
            <p className="rr-candidate-email">{r.email}</p>
            <p className="rr-candidate-role">{r.appliedRole}</p>
          </div>
        </motion.div>

        <div className="rr-hero-scores">
          {/* Trust Score Card */}
          <motion.div className="rr-trust-main-card" style={{ borderColor: `${trustColor}40` }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}>
            <TrustScoreRing score={r.trustScore} />
            <div className="rr-trust-detail">
              <div className="rr-trust-grade" style={{ color: trustColor }}>{getTrustScoreLabel(r.trustScore)}</div>
              <div className="rr-trust-rec">{r.recommendation}</div>
              <div className="rr-risk-pill" style={{ background: `${riskColor}18`, color: riskColor, border: `1px solid ${riskColor}30` }}>
                {r.riskLevel} RISK
              </div>
            </div>
          </motion.div>

          {/* Mini Stats */}
          <div className="rr-mini-stats">
            <motion.div className="rr-mini-stat" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.2 } }}>
              <span className="rr-mini-val" style={{ color: '#22c55e' }}>{verifiedCount}</span>
              <span className="rr-mini-label">Verified Claims</span>
            </motion.div>
            <motion.div className="rr-mini-stat" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.25 } }}>
              <span className="rr-mini-val" style={{ color: '#eab308' }}>{partialCount}</span>
              <span className="rr-mini-label">Partial Claims</span>
            </motion.div>
            <motion.div className="rr-mini-stat" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.3 } }}>
              <span className="rr-mini-val" style={{ color: '#ef4444' }}>{failedCount}</span>
              <span className="rr-mini-label">Failed Claims</span>
            </motion.div>
            <motion.div className="rr-mini-stat" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.35 } }}>
              <span className="rr-mini-val" style={{ color: '#a855f7' }}>{r.repositorySummary?.commitCount || '—'}</span>
              <span className="rr-mini-label">Total Commits</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Verified Claims Pills */}
      <motion.div className="rr-verified-claims-section" variants={fadeUp} initial="hidden" animate="show">
        <h3 className="rr-section-title"><CheckCircle size={16} color="#22c55e" /> Verified Claims</h3>
        <div className="rr-claims-pills">
          {(r.verifiedClaims || []).map((claim, i) => (
            <motion.span
              key={i}
              className="rr-claim-pill"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
            >
              <CheckCircle size={13} color="#22c55e" /> {claim}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="rr-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`rr-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="rr-body">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div className="rr-tab-content" variants={fadeUp} initial="hidden" animate="show">
            {/* Layer 1 */}
            {r.layer1 && (
              <div className="rr-panel">
                <h3 className="rr-panel-title">Experience Gate</h3>
                <div className="rr-exp-row">
                  <div className="rr-exp-box">
                    <span className="rr-exp-lbl">JD Requirement</span>
                    <span className="rr-exp-val">{r.layer1.jdYears} <small>years</small></span>
                  </div>
                  <div className="rr-exp-vs">VS</div>
                  <div className="rr-exp-box">
                    <span className="rr-exp-lbl">Candidate</span>
                    <span className="rr-exp-val" style={{ color: '#22c55e' }}>{r.layer1.resumeYears} <small>years</small></span>
                  </div>
                  <div className={`rr-decision-badge ${r.layer1.decision.toLowerCase()}`}>{r.layer1.decision}</div>
                </div>
                <p className="rr-exp-reason">{r.layer1.reason}</p>
              </div>
            )}

            {/* Risk Indicators */}
            {r.riskIndicators?.length > 0 && (
              <div className="rr-panel">
                <h3 className="rr-panel-title"><AlertTriangle size={15} color="#eab308" /> Risk Indicators</h3>
                <div className="rr-risk-list">
                  {r.riskIndicators.map((risk, i) => (
                    <motion.div key={i} className="rr-risk-item" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
                      <AlertCircle size={14} color="#ef4444" />
                      <span>{risk}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Overclaim summary */}
            {r.layer3 && (
              <div className="rr-panel">
                <h3 className="rr-panel-title">Verification Summary</h3>
                <div className="rr-summary-row">
                  <div className="rr-summary-box verified">
                    <CheckCircle size={20} />
                    <span className="rr-summary-num">{r.layer3.summary?.verified || 0}</span>
                    <span className="rr-summary-lbl">Verified</span>
                  </div>
                  <div className="rr-summary-box partial">
                    <AlertTriangle size={20} />
                    <span className="rr-summary-num">{r.layer3.summary?.partial || 0}</span>
                    <span className="rr-summary-lbl">Partial</span>
                  </div>
                  <div className="rr-summary-box overclaim">
                    <XCircle size={20} />
                    <span className="rr-summary-num">{r.layer3.summary?.overclaimed || 0}</span>
                    <span className="rr-summary-lbl">Overclaimed</span>
                  </div>
                  <div className="rr-summary-box neutral">
                    <BarChart3 size={20} />
                    <span className="rr-summary-num">{r.layer3.overallScore}%</span>
                    <span className="rr-summary-lbl">Overall Score</span>
                  </div>
                </div>
                <p className="rr-verdict">{r.layer3.verdict}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* GitHub Projects Tab */}
        {activeTab === 'projects' && (
          <motion.div className="rr-tab-content" variants={fadeUp} initial="hidden" animate="show">
            {multiLoading && !multiProjects ? (
              <div className="rr-loading" style={{ minHeight: 200 }}>
                <div className="rr-spinner" />
                <p>Loading GitHub verification...</p>
              </div>
            ) : !multiProjects || (!multiProjects.projects?.length && !multiProjects.totalProjects) ? (
              <div className="rr-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <GitBranch size={40} color="var(--text-tertiary)" style={{ marginBottom: 12 }} />
                <h3 style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>No GitHub projects verified yet</h3>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                  GitHub links will be auto-discovered from the candidate's resume once submitted.
                </p>
              </div>
            ) : (
              <>
                {/* Aggregated Score Banner */}
                {(multiProjects.overallTrustScore != null || multiProjects.aggregated?.overallTrustScore != null) && (
                  <div className="rr-panel rr-github-banner">
                    <div className="rr-github-banner-left">
                      <Shield size={18} color="#a855f7" />
                      <div>
                        <div className="rr-github-banner-label">GitHub Trust Score</div>
                        <div className="rr-github-banner-sub">
                          {multiProjects.completedProjects ?? multiProjects.verifiedCount ?? '—'} of{' '}
                          {multiProjects.totalProjects ?? multiProjects.projectCount ?? multiProjects.projects?.length ?? '—'} repos verified
                        </div>
                      </div>
                    </div>
                    <div className="rr-github-banner-score" style={{ color: getTrustScoreColor(multiProjects.overallTrustScore ?? multiProjects.aggregated?.overallTrustScore) }}>
                      {multiProjects.overallTrustScore ?? multiProjects.aggregated?.overallTrustScore ?? '—'}
                      <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>/100</span>
                    </div>
                    {(multiProjects.overallStatus === 'in_progress' || multiProjects.analysisStatus === 'in_progress') && (
                      <div className="rr-github-running">
                        <span className="rr-dot-pulse" />
                        <span style={{ fontSize: 12, color: '#f59e0b' }}>Analyzing…</span>
                      </div>
                    )}
                    <button
                      className="rr-compare-btn"
                      onClick={() => navigate(`/recruiter/projects/${candidateId}`)}
                    >
                      <Layers size={13} /> Full Report
                    </button>
                  </div>
                )}

                {/* Per-project cards */}
                <div className="rr-project-cards-grid">
                  {(multiProjects.projects || []).map((proj, i) => {
                    const score = proj.trustScore ?? proj.trust_score ?? null;
                    const status = proj.status || 'pending';
                    const statusColors = { completed: '#22c55e', partial: '#eab308', running: '#3b82f6', failed: '#ef4444', pending: '#6b7280' };
                    const sColor = statusColors[status] || '#6b7280';
                    const name = proj.projectName || proj.name || `Project ${i + 1}`;
                    const url = proj.githubUrl || proj.github_url || '';
                    const circ = 2 * Math.PI * 28;
                    const pct = score != null ? Math.min(100, score) : 0;
                    const offset = circ - (pct / 100) * circ;
                    return (
                      <motion.div
                        key={proj.id || proj.analysisId || i}
                        className="rr-project-card"
                        style={{ borderColor: `${sColor}40` }}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                      >
                        <div className="rr-project-card-top">
                          <div className="rr-project-avatar">{name[0]?.toUpperCase() || '?'}</div>
                          <div className="rr-project-info">
                            <div className="rr-project-name">{name}</div>
                            {url && (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="rr-project-url">
                                <GitBranch size={11} /> {url.replace('https://github.com/', '')}
                              </a>
                            )}
                          </div>
                          <span className="rr-project-status-badge" style={{ color: sColor, background: `${sColor}18`, border: `1px solid ${sColor}30` }}>
                            {status === 'running' ? (
                              <><span className="rr-dot-pulse" style={{ background: sColor }} /> Analyzing</>
                            ) : status}
                          </span>
                        </div>
                        <div className="rr-project-card-bottom">
                          {score != null ? (
                            <div className="rr-project-score-wrap">
                              <svg width="72" height="72" viewBox="0 0 72 72">
                                <circle cx="36" cy="36" r="28" fill="none" stroke="var(--bg-tertiary)" strokeWidth="5" />
                                <motion.circle
                                  cx="36" cy="36" r="28"
                                  fill="none" stroke={getTrustScoreColor(score)} strokeWidth="5"
                                  strokeLinecap="round"
                                  strokeDasharray={circ}
                                  initial={{ strokeDashoffset: circ }}
                                  animate={{ strokeDashoffset: offset }}
                                  transition={{ duration: 0.9, ease: 'easeOut' }}
                                  transform="rotate(-90 36 36)"
                                />
                              </svg>
                              <div className="rr-project-score-inner">
                                <span style={{ fontSize: 16, fontWeight: 700, color: getTrustScoreColor(score) }}>{score}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="rr-project-score-wrap rr-project-score-pending">
                              <Clock size={22} color="var(--text-tertiary)" />
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Pending</span>
                            </div>
                          )}
                          <div className="rr-project-meta">
                            {proj.claimsVerified != null && (
                              <div className="rr-project-meta-row">
                                <CheckCircle size={12} color="#22c55e" />
                                <span>{proj.claimsVerified}/{proj.totalClaims ?? proj.claimsTotal ?? '?'} claims verified</span>
                              </div>
                            )}
                            {proj.riskLevel && (
                              <div className="rr-project-meta-row">
                                <AlertTriangle size={12} color={getRiskColor(proj.riskLevel)} />
                                <span style={{ color: getRiskColor(proj.riskLevel) }}>{proj.riskLevel} risk</span>
                              </div>
                            )}
                            {proj.authenticityScore != null && (
                              <div className="rr-project-meta-row">
                                <Award size={12} color="#a855f7" />
                                <span>Auth: {proj.authenticityScore}/100</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Claims Tab */}
        {activeTab === 'claims' && (
          <motion.div className="rr-tab-content" variants={fadeUp} initial="hidden" animate="show">
            <div className="rr-panel no-pad">
              <div className="rr-panel-header">
                <h3 className="rr-panel-title">Claim Verification</h3>
                <div className="rr-claim-legend">
                  <span className="rr-legend-item verified"><CheckCircle size={11} /> Verified</span>
                  <span className="rr-legend-item partial"><AlertTriangle size={11} /> Partial</span>
                  <span className="rr-legend-item failed"><XCircle size={11} /> Failed</span>
                </div>
              </div>
              <div className="rr-claims-table-head">
                <span>Claim</span>
                <span>Confidence</span>
                <span>Evidence</span>
                <span></span>
              </div>
              <div className="rr-claims-rows">
                {(r.claimVerification || []).map((claim, i) => (
                  <ClaimRow key={i} claim={claim} evidenceMap={r.evidence} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Repository Tab */}
        {activeTab === 'repository' && r.repositorySummary && (
          <motion.div className="rr-tab-content" variants={fadeUp} initial="hidden" animate="show">
            <div className="rr-panel">
              <h3 className="rr-panel-title"><GitBranch size={15} /> Repository Summary</h3>
              <div className="rr-repo-stats-row">
                <div className="rr-repo-stat">
                  <span className="rr-repo-stat-val">{r.repositorySummary.totalFiles}</span>
                  <span className="rr-repo-stat-lbl">Files</span>
                </div>
                <div className="rr-repo-stat">
                  <span className="rr-repo-stat-val">{(r.repositorySummary.linesOfCode || 0).toLocaleString()}</span>
                  <span className="rr-repo-stat-lbl">Lines of Code</span>
                </div>
                <div className="rr-repo-stat">
                  <span className="rr-repo-stat-val">{r.repositorySummary.commitCount}</span>
                  <span className="rr-repo-stat-lbl">Commits</span>
                </div>
              </div>
            </div>

            <div className="rr-panel">
              <h3 className="rr-panel-title">Tech Stack</h3>
              <div className="rr-tech-pills">
                {(r.repositorySummary.techStack || []).map((t, i) => (
                  <span key={i} className="rr-tech-pill">{t}</span>
                ))}
              </div>
            </div>

            <div className="rr-panel">
              <h3 className="rr-panel-title">Languages</h3>
              <div className="rr-lang-list">
                {Object.entries(r.repositorySummary.languages || {}).map(([lang, pct]) => (
                  <div key={lang} className="rr-lang-row">
                    <span className="rr-lang-name">{lang}</span>
                    <div className="rr-lang-bar-bg">
                      <motion.div
                        className="rr-lang-bar-fill"
                        style={{ background: '#3b82f6' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7 }}
                      />
                    </div>
                    <span className="rr-lang-pct">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rr-panel">
              <h3 className="rr-panel-title">Infrastructure & Databases</h3>
              <div className="rr-infra-grid">
                <div>
                  <h4 className="rr-infra-label"><Database size={13} /> Databases</h4>
                  <div className="rr-tech-pills">{(r.repositorySummary.database || []).map((d, i) => <span key={i} className="rr-tech-pill db">{d}</span>)}</div>
                </div>
                <div>
                  <h4 className="rr-infra-label"><Server size={13} /> Infrastructure</h4>
                  <div className="rr-tech-pills">{(r.repositorySummary.infrastructure || []).map((d, i) => <span key={i} className="rr-tech-pill infra">{d}</span>)}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Architecture Tab */}
        {activeTab === 'architecture' && r.architectureAnalysis && (
          <motion.div className="rr-tab-content" variants={fadeUp} initial="hidden" animate="show">
            <div className="rr-panel">
              <div className="rr-arch-score-row">
                <div>
                  <h3 className="rr-panel-title">Architecture Score</h3>
                  <p className="rr-arch-sub">How well structured is the codebase?</p>
                </div>
                <div className="rr-arch-score-circle">
                  <span style={{ color: getTrustScoreColor(r.architectureAnalysis.score) }}>
                    {r.architectureAnalysis.score}
                  </span>
                  <small>/100</small>
                </div>
              </div>
              <div className="rr-arch-grid">
                {Object.entries(r.architectureAnalysis.structure || {}).map(([k, v]) => (
                  <ArchCard key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} count={v} color="#3b82f6" />
                ))}
              </div>
            </div>
            {r.architectureAnalysis.patterns?.length > 0 && (
              <div className="rr-panel">
                <h3 className="rr-panel-title">Design Patterns Detected</h3>
                <div className="rr-tech-pills">
                  {r.architectureAnalysis.patterns.map((p, i) => <span key={i} className="rr-tech-pill pattern">{p}</span>)}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Authenticity Tab */}
        {activeTab === 'authenticity' && r.authenticityAnalysis && (
          <motion.div className="rr-tab-content" variants={fadeUp} initial="hidden" animate="show">
            <div className="rr-panel">
              <div className="rr-auth-score-row">
                <div>
                  <h3 className="rr-panel-title">Authenticity Score</h3>
                  <p className="rr-arch-sub">Likelihood that code is genuinely written by the candidate</p>
                </div>
                <div className="rr-auth-score-big" style={{ color: getTrustScoreColor(r.authenticityAnalysis.score) }}>
                  {r.authenticityAnalysis.score}<span className="rr-auth-max">/100</span>
                </div>
              </div>
            </div>

            <div className="rr-panel">
              <h3 className="rr-panel-title"><CheckCircle size={14} color="#22c55e" /> Positive Findings</h3>
              <div className="rr-findings-list">
                {(r.authenticityAnalysis.findings || []).map((f, i) => (
                  <motion.div key={i} className="rr-finding-item positive" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                    <CheckCircle size={14} color="#22c55e" /><span>{f}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {r.authenticityAnalysis.risks?.length > 0 && (
              <div className="rr-panel">
                <h3 className="rr-panel-title"><AlertTriangle size={14} color="#eab308" /> Concerns</h3>
                <div className="rr-findings-list">
                  {r.authenticityAnalysis.risks.map((risk, i) => (
                    <motion.div key={i} className="rr-finding-item concern" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                      <AlertTriangle size={14} color="#eab308" /><span>{risk}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
