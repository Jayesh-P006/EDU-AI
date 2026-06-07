import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, SlidersHorizontal, ChevronUp, ChevronDown,
  Eye, Play, FileText, Users, AlertTriangle, CheckCircle,
  XCircle, Clock, Shield, BarChart3, TrendingUp, Filter,
} from 'lucide-react';
import {
  fetchAllCandidates, analyzeCandidate,
  getTrustScoreColor, getTrustScoreLabel, getRiskColor, MOCK_CANDIDATES,
} from '../services/recruiterApi';
import './RecruiterCandidates.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function TrustScoreBar({ score }) {
  if (score === null || score === undefined) {
    return <span className="rc-no-score">Not analyzed</span>;
  }
  const color = getTrustScoreColor(score);
  return (
    <div className="rc-score-cell">
      <span className="rc-score-num" style={{ color }}>{score}</span>
      <div className="rc-score-bar-bg">
        <div className="rc-score-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="rc-score-label" style={{ color }}>{getTrustScoreLabel(score)}</span>
    </div>
  );
}

function AnalysisStatusBadge({ status }) {
  const map = {
    completed: { color: '#22c55e', label: 'Analyzed', icon: CheckCircle },
    in_progress: { color: '#3b82f6', label: 'Running', icon: Clock },
    pending: { color: '#eab308', label: 'Pending', icon: Clock },
    not_started: { color: '#737373', label: 'Not Started', icon: XCircle },
  };
  const s = map[status] || map.not_started;
  const Icon = s.icon;
  return (
    <span className="rc-status-badge" style={{ background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}30` }}>
      <Icon size={12} /> {s.label}
    </span>
  );
}

function RiskBadge({ level }) {
  if (!level) return <span className="rc-risk-none">—</span>;
  const color = getRiskColor(level);
  return (
    <span className="rc-risk-badge" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {level}
    </span>
  );
}

function ResumeStatusBadge({ status }) {
  if (status === 'uploaded') return <span className="rc-resume-badge uploaded"><CheckCircle size={12} /> Uploaded</span>;
  return <span className="rc-resume-badge missing"><XCircle size={12} /> Missing</span>;
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <div className="rc-sort-icons"><ChevronUp size={10} /><ChevronDown size={10} /></div>;
  return sortDir === 'asc'
    ? <ChevronUp size={13} color="#3b82f6" />
    : <ChevronDown size={13} color="#3b82f6" />;
}

const ROLES = ['All Roles', 'Backend Software Engineer', 'Frontend Developer', 'Data Scientist / ML Engineer', 'DevOps / Site Reliability Engineer', 'Full Stack Engineer', 'Cloud Solutions Architect'];
const STATUSES = ['All Status', 'completed', 'in_progress', 'pending', 'not_started'];
const RISKS = ['All Risk', 'NONE', 'LOW', 'MEDIUM', 'HIGH'];

export default function RecruiterCandidates() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [riskFilter, setRiskFilter] = useState('All Risk');
  const [trustMin, setTrustMin] = useState(0);
  const [sortCol, setSortCol] = useState('appliedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [selected, setSelected] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadCandidates();
    const f = searchParams.get('filter');
    if (f === 'high_risk') setRiskFilter('HIGH');
    if (f === 'pending') setStatusFilter('pending');
  }, []);

  async function loadCandidates() {
    try {
      const data = await fetchAllCandidates();
      setCandidates(Array.isArray(data) ? data : MOCK_CANDIDATES);
    } catch {
      setCandidates(MOCK_CANDIDATES);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleAnalyze(candidate) {
    setAnalyzing(candidate.id);
    try {
      await analyzeCandidate(candidate.id);
      showToast(`Analysis started for ${candidate.name}`);
      navigate(`/recruiter/analysis/${candidate.id}`);
    } catch {
      navigate(`/recruiter/analysis/${candidate.id}`);
    } finally {
      setAnalyzing(null);
    }
  }

  function toggleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  function toggleSelect(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const filtered = useMemo(() => {
    let list = [...candidates];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.appliedRole?.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== 'All Roles') list = list.filter(c => c.appliedRole === roleFilter);
    if (statusFilter !== 'All Status') list = list.filter(c => c.analysisStatus === statusFilter);
    if (riskFilter !== 'All Risk') list = list.filter(c => c.riskLevel === riskFilter);
    if (trustMin > 0) list = list.filter(c => c.trustScore !== null && c.trustScore >= trustMin);

    list.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (sortCol === 'trustScore') { av = av ?? -1; bv = bv ?? -1; }
      if (sortCol === 'appliedAt') { av = new Date(av); bv = new Date(bv); }
      if (sortCol === 'name') { av = (av || '').toLowerCase(); bv = (bv || '').toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [candidates, search, roleFilter, statusFilter, riskFilter, trustMin, sortCol, sortDir]);

  const activeFilters = [roleFilter !== 'All Roles', statusFilter !== 'All Status', riskFilter !== 'All Risk', trustMin > 0].filter(Boolean).length;

  if (loading) {
    return (
      <div className="rc-loading">
        <div className="rc-spinner" />
        <p>Loading candidates...</p>
      </div>
    );
  }

  return (
    <div className="rc-page">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div className={`rc-toast ${toast.type}`} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <CheckCircle size={15} /> {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="rc-header">
        <div className="rc-header-left">
          <button className="rc-back-btn" onClick={() => navigate('/recruiter-dashboard')}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="rc-title">Candidate Pool</h1>
            <p className="rc-sub">{filtered.length} of {candidates.length} candidates</p>
          </div>
        </div>
        <div className="rc-header-right">
          {selected.length >= 2 && (
            <button className="rc-compare-btn" onClick={() => navigate(`/recruiter/compare?ids=${selected.join(',')}`)}>
              <BarChart3 size={15} /> Compare {selected.length}
            </button>
          )}
          <button className="rc-filter-btn" onClick={() => setShowFilters(f => !f)}>
            <Filter size={15} />
            Filters
            {activeFilters > 0 && <span className="rc-filter-count">{activeFilters}</span>}
          </button>
        </div>
      </header>

      {/* Search + Filters */}
      <div className="rc-toolbar">
        <div className="rc-search-wrap">
          <Search size={15} className="rc-search-icon" />
          <input
            className="rc-search"
            placeholder="Search by name, email, or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div className="rc-filters" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="rc-filter-row">
                <div className="rc-filter-group">
                  <label>Applied Role</label>
                  <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="rc-filter-group">
                  <label>Analysis Status</label>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="rc-filter-group">
                  <label>Risk Level</label>
                  <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
                    {RISKS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="rc-filter-group">
                  <label>Min Trust Score: {trustMin}</label>
                  <input type="range" min={0} max={100} step={5} value={trustMin} onChange={e => setTrustMin(Number(e.target.value))} />
                </div>
                <button className="rc-clear-btn" onClick={() => { setRoleFilter('All Roles'); setStatusFilter('All Status'); setRiskFilter('All Risk'); setTrustMin(0); }}>
                  Clear All
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      <div className="rc-table-card">
        <div className="rc-table-wrap">
          <table className="rc-table">
            <thead>
              <tr>
                <th className="rc-th-check">
                  <input type="checkbox" onChange={e => setSelected(e.target.checked ? filtered.map(c => c.id) : [])} checked={selected.length === filtered.length && filtered.length > 0} />
                </th>
                <th className="rc-th-sort" onClick={() => toggleSort('name')}>
                  Candidate <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className="rc-th-sort" onClick={() => toggleSort('appliedRole')}>
                  Applied Role <SortIcon col="appliedRole" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th>Resume</th>
                <th>Analysis</th>
                <th className="rc-th-sort" onClick={() => toggleSort('trustScore')}>
                  Trust Score <SortIcon col="trustScore" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th>Risk Level</th>
                <th>Recommendation</th>
                <th className="rc-th-sort" onClick={() => toggleSort('appliedAt')}>
                  Applied <SortIcon col="appliedAt" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    className={selected.includes(c.id) ? 'rc-row-selected' : ''}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td className="rc-td-check">
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} />
                    </td>
                    <td>
                      <div className="rc-candidate-cell">
                        <div className="rc-avatar">{c.name?.[0] || '?'}</div>
                        <div>
                          <div className="rc-cand-name">{c.name || c.username}</div>
                          <div className="rc-cand-email">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="rc-role-cell">
                      <span className="rc-role">{c.appliedRole || '—'}</span>
                      {c.companyName && <span className="rc-company">{c.companyName}</span>}
                    </td>
                    <td><ResumeStatusBadge status={c.resumeStatus} /></td>
                    <td><AnalysisStatusBadge status={c.analysisStatus} /></td>
                    <td><TrustScoreBar score={c.trustScore} /></td>
                    <td><RiskBadge level={c.riskLevel} /></td>
                    <td>
                      <span className="rc-recommendation">
                        {c.recommendation || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </span>
                    </td>
                    <td className="rc-date-cell">
                      {c.appliedAt ? new Date(c.appliedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td>
                      <div className="rc-actions">
                        <button className="rc-action-btn" title="View Resume" onClick={() => navigate(`/recruiter/report/${c.id}`)}>
                          <FileText size={14} />
                        </button>
                        {c.analysisStatus !== 'completed' ? (
                          <button
                            className={`rc-action-btn analyze ${analyzing === c.id ? 'loading' : ''}`}
                            title="Analyze Candidate"
                            onClick={() => handleAnalyze(c)}
                            disabled={analyzing === c.id}
                          >
                            {analyzing === c.id ? <div className="rc-btn-spinner" /> : <Play size={14} />}
                          </button>
                        ) : (
                          <button className="rc-action-btn report" title="View Report" onClick={() => navigate(`/recruiter/report/${c.id}`)}>
                            <Eye size={14} />
                          </button>
                        )}
                        <button className="rc-action-btn compare" title="Add to Compare" onClick={() => toggleSelect(c.id)}>
                          <TrendingUp size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="rc-empty">
                    <div className="rc-empty-content">
                      <Users size={32} color="var(--text-tertiary)" />
                      <p>No candidates match your filters</p>
                      <button onClick={() => { setSearch(''); setRoleFilter('All Roles'); setStatusFilter('All Status'); setRiskFilter('All Risk'); setTrustMin(0); }}>
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer stats */}
        <div className="rc-table-footer">
          <span>{filtered.length} results</span>
          {selected.length > 0 && (
            <span className="rc-selected-info">{selected.length} selected
              {selected.length >= 2 && (
                <button className="rc-footer-compare" onClick={() => navigate(`/recruiter/compare?ids=${selected.join(',')}`)}>
                  Compare →
                </button>
              )}
            </span>
          )}
          <span className="rc-footer-sort">Sorted by {sortCol} ({sortDir})</span>
        </div>
      </div>
    </div>
  );
}
