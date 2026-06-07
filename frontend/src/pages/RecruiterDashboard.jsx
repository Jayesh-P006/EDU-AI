import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Shield, AlertTriangle, CheckCircle, TrendingUp,
  Search, ChevronRight, BarChart3, Clock, Briefcase,
  LogOut, Bell, Settings, RefreshCw, Eye, Play, FileText,
  Award, Zap,
} from 'lucide-react';
import {
  fetchRecruiterStats, fetchAllCandidates,
  getTrustScoreColor, getTrustScoreLabel, getRiskColor, MOCK_CANDIDATES,
} from '../services/recruiterApi';
import './RecruiterDashboard.css';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }) {
  return (
    <motion.div className="rd-stat-card" variants={fadeUp} transition={{ delay }}>
      <div className="rd-stat-icon" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon size={22} color={color} />
      </div>
      <div className="rd-stat-body">
        <div className="rd-stat-value" style={{ color }}>{value}</div>
        <div className="rd-stat-label">{label}</div>
        {sub && <div className="rd-stat-sub">{sub}</div>}
      </div>
    </motion.div>
  );
}

function TrustBadge({ score }) {
  if (score === null || score === undefined) {
    return <span className="rd-trust-badge pending">— Pending</span>;
  }
  const color = getTrustScoreColor(score);
  return (
    <span className="rd-trust-badge" style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}>
      {score}/100
    </span>
  );
}

function RiskBadge({ level }) {
  if (!level) return <span className="rd-risk-badge none">—</span>;
  const color = getRiskColor(level);
  return (
    <span className="rd-risk-badge" style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}>
      {level}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    completed: { color: '#22c55e', label: 'Analyzed' },
    in_progress: { color: '#3b82f6', label: 'In Progress' },
    pending: { color: '#eab308', label: 'Pending' },
    not_started: { color: '#737373', label: 'Not Started' },
  };
  const s = map[status] || map.not_started;
  return (
    <span className="rd-status-badge" style={{ background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}30` }}>
      {s.label}
    </span>
  );
}

export default function RecruiterDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    loadData();
  }, []);

  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const [s, c] = await Promise.all([fetchRecruiterStats(), fetchAllCandidates()]);
      setStats(s);
      setCandidates(Array.isArray(c) ? c : MOCK_CANDIDATES);
    } catch {
      setStats({ totalApplicants: 24, pendingAnalysis: 8, verified: 12, highRisk: 3, avgTrustScore: 76 });
      setCandidates(MOCK_CANDIDATES);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('user');
    navigate('/login');
  }

  const filtered = candidates.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.appliedRole?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  const recent = [...candidates]
    .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="rd-loading">
        <div className="rd-spinner" />
        <p>Loading recruiter dashboard...</p>
      </div>
    );
  }

  return (
    <div className="rd-layout">
      {/* Sidebar */}
      <aside className="rd-sidebar">
        <div className="rd-sidebar-top">
          <div className="rd-brand">
            <Shield size={24} color="#3b82f6" />
            <span>HireSpec</span>
          </div>
          <nav className="rd-nav">
            <button className="rd-nav-item active" onClick={() => navigate('/recruiter-dashboard')}>
              <BarChart3 size={18} /> Dashboard
            </button>
            <button className="rd-nav-item" onClick={() => navigate('/recruiter/candidates')}>
              <Users size={18} /> Candidates
            </button>
            <button className="rd-nav-item" onClick={() => navigate('/recruiter/compare')}>
              <TrendingUp size={18} /> Compare & Rank
            </button>
            <button className="rd-nav-item" onClick={() => navigate('/company-dashboard')}>
              <Briefcase size={18} /> Jobs
            </button>
          </nav>
        </div>
        <div className="rd-sidebar-bottom">
          <div className="rd-user-info">
            <div className="rd-user-avatar">{user?.username?.[0]?.toUpperCase() || 'R'}</div>
            <div>
              <div className="rd-user-name">{user?.username || 'Recruiter'}</div>
              <div className="rd-user-role">{user?.companyName || 'Company'}</div>
            </div>
          </div>
          <button className="rd-logout-btn" onClick={handleLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="rd-main">
        {/* Header */}
        <header className="rd-header">
          <div>
            <h1 className="rd-header-title">Recruiter Dashboard</h1>
            <p className="rd-header-sub">Resume verification & candidate intelligence</p>
          </div>
          <div className="rd-header-actions">
            <button className={`rd-refresh-btn ${refreshing ? 'spinning' : ''}`} onClick={() => loadData(true)}>
              <RefreshCw size={16} />
            </button>
            <button className="rd-action-primary" onClick={() => navigate('/recruiter/candidates')}>
              <Users size={16} /> View All Candidates
            </button>
          </div>
        </header>

        {/* Stats */}
        <motion.div className="rd-stats-grid" variants={stagger} initial="hidden" animate="show">
          <StatCard icon={Users} label="Total Applicants" value={stats?.totalApplicants || 0} sub="Across all roles" color="#3b82f6" delay={0} />
          <StatCard icon={Clock} label="Pending Analysis" value={stats?.pendingAnalysis || 0} sub="Awaiting verification" color="#eab308" delay={0.08} />
          <StatCard icon={CheckCircle} label="Verified Candidates" value={stats?.verified || 0} sub="Analysis complete" color="#22c55e" delay={0.16} />
          <StatCard icon={AlertTriangle} label="High Risk" value={stats?.highRisk || 0} sub="Require review" color="#ef4444" delay={0.24} />
          <StatCard icon={Award} label="Avg Trust Score" value={stats?.avgTrustScore ? `${stats.avgTrustScore}/100` : '—'} sub="Platform average" color="#a855f7" delay={0.32} />
        </motion.div>

        {/* Quick Actions */}
        <motion.div className="rd-quick-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <button className="rd-quick-card" onClick={() => navigate('/recruiter/candidates')}>
            <Users size={20} color="#3b82f6" />
            <span>All Candidates</span>
            <ChevronRight size={16} className="rd-quick-arrow" />
          </button>
          <button className="rd-quick-card" onClick={() => navigate('/recruiter/compare')}>
            <TrendingUp size={20} color="#22c55e" />
            <span>Compare & Rank</span>
            <ChevronRight size={16} className="rd-quick-arrow" />
          </button>
          <button className="rd-quick-card" onClick={() => navigate('/recruiter/candidates?filter=high_risk')}>
            <AlertTriangle size={20} color="#ef4444" />
            <span>High Risk Candidates</span>
            <ChevronRight size={16} className="rd-quick-arrow" />
          </button>
          <button className="rd-quick-card" onClick={() => navigate('/recruiter/candidates?filter=pending')}>
            <Zap size={20} color="#eab308" />
            <span>Pending Analysis</span>
            <ChevronRight size={16} className="rd-quick-arrow" />
          </button>
        </motion.div>

        {/* Recent Candidates */}
        <motion.div className="rd-table-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <div className="rd-section-header">
            <h2 className="rd-section-title">Recent Applicants</h2>
            <div className="rd-search-wrap">
              <Search size={15} className="rd-search-icon" />
              <input
                className="rd-search"
                placeholder="Search candidates..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="rd-see-all" onClick={() => navigate('/recruiter/candidates')}>
              See all <ChevronRight size={14} />
            </button>
          </div>

          <div className="rd-table-wrap">
            <table className="rd-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Applied Role</th>
                  <th>Analysis</th>
                  <th>Trust Score</th>
                  <th>Risk</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(search ? filtered : recent).map((c, i) => (
                  <motion.tr key={c.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                    <td>
                      <div className="rd-candidate-cell">
                        <div className="rd-candidate-avatar">{c.name?.[0] || '?'}</div>
                        <div>
                          <div className="rd-candidate-name">{c.name || c.username}</div>
                          <div className="rd-candidate-email">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="rd-role-text">{c.appliedRole || c.jobTitle || '—'}</span>
                    </td>
                    <td><StatusBadge status={c.analysisStatus} /></td>
                    <td><TrustBadge score={c.trustScore} /></td>
                    <td><RiskBadge level={c.riskLevel} /></td>
                    <td>
                      <div className="rd-actions">
                        {c.analysisStatus === 'completed' ? (
                          <button className="rd-btn-sm primary" onClick={() => navigate(`/recruiter/report/${c.id}`)}>
                            <Eye size={13} /> Report
                          </button>
                        ) : (
                          <button className="rd-btn-sm accent" onClick={() => navigate(`/recruiter/analysis/${c.id}`)}>
                            <Play size={13} /> Analyze
                          </button>
                        )}
                        <button className="rd-btn-sm ghost" onClick={() => navigate(`/recruiter/report/${c.id}`)}>
                          <FileText size={13} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {(search ? filtered : recent).length === 0 && (
                  <tr>
                    <td colSpan={6} className="rd-empty">No candidates found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Trust Distribution */}
        <motion.div className="rd-dist-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <h2 className="rd-section-title">Trust Score Distribution</h2>
          <div className="rd-dist-grid">
            {[
              { label: 'Excellent', range: '90–100', color: '#22c55e', count: candidates.filter(c => c.trustScore >= 90).length },
              { label: 'Strong', range: '75–89', color: '#3b82f6', count: candidates.filter(c => c.trustScore >= 75 && c.trustScore < 90).length },
              { label: 'Moderate', range: '50–74', color: '#eab308', count: candidates.filter(c => c.trustScore >= 50 && c.trustScore < 75).length },
              { label: 'High Risk', range: '0–49', color: '#ef4444', count: candidates.filter(c => c.trustScore !== null && c.trustScore < 50).length },
            ].map(({ label, range, color, count }) => {
              const total = candidates.filter(c => c.trustScore !== null).length || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={label} className="rd-dist-card">
                  <div className="rd-dist-header">
                    <span className="rd-dist-label" style={{ color }}>{label}</span>
                    <span className="rd-dist-range">{range}</span>
                  </div>
                  <div className="rd-dist-count" style={{ color }}>{count}</div>
                  <div className="rd-dist-bar-bg">
                    <motion.div
                      className="rd-dist-bar-fill"
                      style={{ background: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.7, duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="rd-dist-pct">{pct}%</div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
