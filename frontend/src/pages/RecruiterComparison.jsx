import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Trophy, Medal, TrendingUp, CheckCircle, XCircle,
  AlertTriangle, Shield, Users, ChevronRight, BarChart3, Award,
} from 'lucide-react';
import { fetchAllCandidates, getTrustScoreColor, getTrustScoreLabel, getRiskColor, MOCK_CANDIDATES } from '../services/recruiterApi';
import './RecruiterComparison.css';

const COMPARE_ATTRS = [
  { key: 'trustScore', label: 'Trust Score', higher: true },
  { key: 'atsScore', label: 'ATS Score', higher: true },
  { key: 'riskLevel', label: 'Risk Level', higher: false, render: v => v || '—' },
  { key: 'analysisStatus', label: 'Analysis Status', higher: false, render: v => v || '—' },
  { key: 'appliedRole', label: 'Applied Role', higher: false, render: v => v || '—' },
];

function TrustBadge({ score }) {
  if (score === null || score === undefined) return <span className="rcomp-na">N/A</span>;
  const color = getTrustScoreColor(score);
  return <span style={{ color, fontWeight: 700 }}>{score}/100</span>;
}

function RiskBadge({ level }) {
  if (!level) return <span className="rcomp-na">—</span>;
  const color = getRiskColor(level);
  return <span style={{ color, fontWeight: 600, fontSize: 13 }}>{level}</span>;
}

function RankMedal({ rank }) {
  if (rank === 1) return <Trophy size={20} color="#f59e0b" />;
  if (rank === 2) return <Medal size={20} color="#94a3b8" />;
  if (rank === 3) return <Medal size={20} color="#b45309" />;
  return <span className="rcomp-rank-num">#{rank}</span>;
}

export default function RecruiterComparison() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [allCandidates, setAllCandidates] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await fetchAllCandidates();
      const list = Array.isArray(data) ? data : MOCK_CANDIDATES;
      setAllCandidates(list);

      const idsParam = searchParams.get('ids');
      if (idsParam) {
        const ids = idsParam.split(',');
        setSelected(ids.slice(0, 4));
      }
    } catch {
      setAllCandidates(MOCK_CANDIDATES);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 4 ? [...prev, id] : prev
    );
  }

  const ranked = useMemo(() =>
    [...allCandidates]
      .filter(c => c.trustScore !== null && c.trustScore !== undefined)
      .sort((a, b) => b.trustScore - a.trustScore)
      .map((c, i) => ({ ...c, rank: i + 1 })),
    [allCandidates]
  );

  const compareList = useMemo(() =>
    selected.map(id => allCandidates.find(c => c.id === id)).filter(Boolean),
    [selected, allCandidates]
  );

  const getBest = (attr) => {
    if (!compareList.length) return null;
    const vals = compareList.map(c => ({ id: c.id, val: c[attr] })).filter(x => x.val !== null && x.val !== undefined);
    if (!vals.length) return null;
    return vals.reduce((best, x) => (x.val > best.val ? x : best)).id;
  };

  if (loading) {
    return (
      <div className="rcomp-loading">
        <div className="rcomp-spinner" />
        <p>Loading candidates...</p>
      </div>
    );
  }

  return (
    <div className="rcomp-page">
      {/* Header */}
      <header className="rcomp-header">
        <button className="rcomp-back-btn" onClick={() => navigate('/recruiter-dashboard')}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="rcomp-title">Compare & Rank</h1>
          <p className="rcomp-sub">Select up to 4 candidates to compare side by side</p>
        </div>
      </header>

      <div className="rcomp-body">
        {/* Leaderboard */}
        <motion.div className="rcomp-section" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rcomp-section-header">
            <h2 className="rcomp-section-title"><Trophy size={16} color="#f59e0b" /> Candidate Ranking</h2>
            <span className="rcomp-section-sub">{ranked.length} candidates ranked by trust score</span>
          </div>

          <div className="rcomp-leaderboard">
            {ranked.map((c, i) => {
              const color = getTrustScoreColor(c.trustScore);
              const isSelected = selected.includes(c.id);
              return (
                <motion.div
                  key={c.id}
                  className={`rcomp-rank-row ${isSelected ? 'selected' : ''} ${i < 3 ? 'top3' : ''}`}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="rcomp-rank-medal"><RankMedal rank={c.rank} /></div>
                  <div className="rcomp-rank-avatar">{c.name?.[0] || '?'}</div>
                  <div className="rcomp-rank-info">
                    <span className="rcomp-rank-name">{c.name}</span>
                    <span className="rcomp-rank-role">{c.appliedRole || '—'}</span>
                  </div>
                  <div className="rcomp-rank-score-wrap">
                    <div className="rcomp-rank-bar-bg">
                      <motion.div
                        className="rcomp-rank-bar-fill"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${c.trustScore}%` }}
                        transition={{ delay: i * 0.04 + 0.2, duration: 0.6 }}
                      />
                    </div>
                    <span className="rcomp-rank-score-num" style={{ color }}>{c.trustScore}</span>
                    <span className="rcomp-rank-score-label" style={{ color }}>{getTrustScoreLabel(c.trustScore)}</span>
                  </div>
                  <span className="rcomp-risk-mini" style={{ color: getRiskColor(c.riskLevel) }}>{c.riskLevel || '—'}</span>
                  <div className="rcomp-rank-actions">
                    <button
                      className={`rcomp-select-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSelect(c.id)}
                      disabled={!isSelected && selected.length >= 4}
                    >
                      {isSelected ? <CheckCircle size={13} /> : <span>+</span>}
                      {isSelected ? 'Selected' : 'Compare'}
                    </button>
                    <button className="rcomp-view-btn" onClick={() => navigate(`/recruiter/report/${c.id}`)}>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Comparison Table */}
        {compareList.length >= 2 && (
          <motion.div className="rcomp-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="rcomp-section-header">
              <h2 className="rcomp-section-title"><BarChart3 size={16} color="#3b82f6" /> Side-by-Side Comparison</h2>
              <span className="rcomp-section-sub">Comparing {compareList.length} candidates</span>
            </div>

            <div className="rcomp-compare-table-wrap">
              <table className="rcomp-table">
                <thead>
                  <tr>
                    <th className="rcomp-th-attr">Attribute</th>
                    {compareList.map(c => (
                      <th key={c.id} className="rcomp-th-cand">
                        <div className="rcomp-th-inner">
                          <div className="rcomp-th-avatar">{c.name?.[0]}</div>
                          <div>
                            <div className="rcomp-th-name">{c.name}</div>
                            <div className="rcomp-th-email">{c.email}</div>
                          </div>
                          <button className="rcomp-remove-btn" onClick={() => toggleSelect(c.id)}>×</button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Trust Score */}
                  <tr className="rcomp-tr-highlight">
                    <td className="rcomp-td-attr">
                      <Shield size={13} /> Trust Score
                    </td>
                    {compareList.map(c => {
                      const isBest = getBest('trustScore') === c.id;
                      return (
                        <td key={c.id} className={`rcomp-td-val ${isBest ? 'best' : ''}`}>
                          <TrustBadge score={c.trustScore} />
                          {isBest && <span className="rcomp-best-badge">Best</span>}
                        </td>
                      );
                    })}
                  </tr>

                  {/* ATS Score */}
                  <tr>
                    <td className="rcomp-td-attr"><Award size={13} /> ATS Score</td>
                    {compareList.map(c => {
                      const isBest = getBest('atsScore') === c.id;
                      return (
                        <td key={c.id} className={`rcomp-td-val ${isBest ? 'best' : ''}`}>
                          <span style={{ color: isBest ? '#22c55e' : 'var(--text-secondary)', fontWeight: isBest ? 700 : 400 }}>
                            {c.atsScore ?? '—'}
                          </span>
                          {isBest && <span className="rcomp-best-badge">Best</span>}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Risk Level */}
                  <tr>
                    <td className="rcomp-td-attr"><AlertTriangle size={13} /> Risk Level</td>
                    {compareList.map(c => (
                      <td key={c.id} className="rcomp-td-val">
                        <RiskBadge level={c.riskLevel} />
                      </td>
                    ))}
                  </tr>

                  {/* Recommendation */}
                  <tr>
                    <td className="rcomp-td-attr"><CheckCircle size={13} /> Recommendation</td>
                    {compareList.map(c => (
                      <td key={c.id} className="rcomp-td-val">
                        <span className="rcomp-rec-text">{c.recommendation || '—'}</span>
                      </td>
                    ))}
                  </tr>

                  {/* Analysis Status */}
                  <tr>
                    <td className="rcomp-td-attr"><BarChart3 size={13} /> Analysis</td>
                    {compareList.map(c => (
                      <td key={c.id} className="rcomp-td-val">
                        <span className={`rcomp-status-dot ${c.analysisStatus}`}>{c.analysisStatus?.replace('_', ' ') || '—'}</span>
                      </td>
                    ))}
                  </tr>

                  {/* Skills */}
                  <tr>
                    <td className="rcomp-td-attr"><TrendingUp size={13} /> Key Skills</td>
                    {compareList.map(c => (
                      <td key={c.id} className="rcomp-td-val rcomp-skills-cell">
                        {(c.skills || []).slice(0, 4).map((s, i) => (
                          <span key={i} className="rcomp-skill-tag">{s}</span>
                        ))}
                        {(c.skills || []).length > 4 && <span className="rcomp-skill-more">+{c.skills.length - 4}</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Actions Row */}
                  <tr className="rcomp-tr-actions">
                    <td className="rcomp-td-attr">Actions</td>
                    {compareList.map(c => (
                      <td key={c.id} className="rcomp-td-val">
                        <button className="rcomp-view-report" onClick={() => navigate(`/recruiter/report/${c.id}`)}>
                          View Report →
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {compareList.length < 2 && (
          <motion.div className="rcomp-empty-compare" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Users size={40} color="var(--text-tertiary)" />
            <p>Select at least 2 candidates from the ranking above to compare them side by side</p>
            <span>{selected.length}/4 selected</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
