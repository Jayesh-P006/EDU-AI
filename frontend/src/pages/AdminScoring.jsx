import {useState, useEffect, useMemo, useCallback} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import
  {
    Search, Bell, LogOut, Users, BarChart3, Briefcase, Trophy, Settings,
    ChevronDown, ChevronUp, Download, Eye, Filter, ArrowUpRight,
    Target, Award, Clock, TrendingUp, CheckCircle2, XCircle, X,
    Percent, Zap, Star, ChevronRight
  } from 'lucide-react';
import
  {
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
  } from 'recharts';
import api from '../services/api';
import BrandLogo from '../components/BrandLogo';
import './AdminScoring.css';

/* ─── helpers ─────────────────────────────────────────────── */
function scoreColor(score)
{
  if (score>=80) return '#22c55e';
  if (score>=60) return '#eab308';
  return '#ef4444';
}
function scoreClass(score)
{
  if (score>=80) return 'high';
  if (score>=60) return 'mid';
  return 'low';
}
function levelColor(level)
{
  switch (level)
  {
    case 'Expert': return '#22c55e';
    case 'Advanced': return '#3b82f6';
    case 'Intermediate': return '#eab308';
    default: return '#ef4444';
  }
}

const CHART_COLORS=['#3b82f6', '#a855f7', '#14b8a6', '#eab308', '#ef4444', '#ec4899'];

export default function AdminScoring()
{
  const navigate=useNavigate();
  const [user, setUser]=useState(null);
  const [roles, setRoles]=useState([]);
  const [selectedRole, setSelectedRole]=useState('');
  const [candidates, setCandidates]=useState([]);
  const [config, setConfig]=useState({threshold: 60, liveEnabled: false, topN: 10, weights: {}});
  const [stats, setStats]=useState({});
  const [loading, setLoading]=useState(false);
  const [searchQ, setSearchQ]=useState('');
  const [sortKey, setSortKey]=useState('rank');
  const [sortDir, setSortDir]=useState('asc');
  const [statusFilter, setStatusFilter]=useState('all');
  const [selectedCandidate, setSelectedCandidate]=useState(null);
  const [showConfig, setShowConfig]=useState(false);
  const [activeView, setActiveView]=useState('results'); // results | leaderboard
  const [leaderboard, setLeaderboard]=useState([]);
  const [page, setPage]=useState(1);
  const PER_PAGE=15;

  /* auth */
  useEffect(() =>
  {
    const stored=localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    else navigate('/login');
  }, [navigate]);

  /* fetch roles */
  useEffect(() =>
  {
    api.get('/scoring/roles').then(r =>
    {
      setRoles(r.data.roles);
      if (r.data.roles.length) setSelectedRole(r.data.roles[0].id);
    }).catch(() => {});
  }, []);

  /* fetch data when role changes */
  useEffect(() =>
  {
    if (!selectedRole) return;
    setLoading(true);
    Promise.all([
      api.get(`/scoring/admin/scores/${selectedRole}`),
      api.get(`/scoring/admin/stats/${selectedRole}`),
      api.get(`/scoring/leaderboard/${selectedRole}`),
    ]).then(([scoresRes, statsRes, lbRes]) =>
    {
      setCandidates(scoresRes.data.candidates);
      setConfig(scoresRes.data.config);
      setStats(statsRes.data);
      setLeaderboard(lbRes.data.leaderboard);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedRole]);

  /* sorting */
  const handleSort=(key) =>
  {
    if (sortKey===key) setSortDir(d => d==='asc'? 'desc':'asc');
    else {setSortKey(key); setSortDir('asc');}
  };

  /* filtered + sorted candidates */
  const displayed=useMemo(() =>
  {
    let list=[...candidates];
    if (searchQ)
    {
      const q=searchQ.toLowerCase();
      list=list.filter(c => c.name.toLowerCase().includes(q)||c.email.toLowerCase().includes(q));
    }
    if (statusFilter!=='all') list=list.filter(c => c.status===statusFilter);
    list.sort((a, b) =>
    {
      let aVal=sortKey==='name'? a.name:(sortKey==='overall'? a.overall:a.rank);
      let bVal=sortKey==='name'? b.name:(sortKey==='overall'? b.overall:b.rank);
      if (typeof aVal==='string') return sortDir==='asc'? aVal.localeCompare(bVal):bVal.localeCompare(aVal);
      return sortDir==='asc'? aVal-bVal:bVal-aVal;
    });
    return list;
  }, [candidates, searchQ, statusFilter, sortKey, sortDir]);

  const paginated=displayed.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const totalPages=Math.ceil(displayed.length/PER_PAGE);

  /* threshold save */
  const saveThreshold=async (val) =>
  {
    const newThreshold=Number(val);
    try
    {
      await api.put('/scoring/admin/thresholds', {jobRole: selectedRole, threshold: newThreshold});
      setConfig(prev => ({...prev, threshold: newThreshold}));
      setCandidates(prev => prev.map(c => ({...c, status: c.overall>=newThreshold? 'qualified':'not-qualified'})));
    } catch {}
  };

  /* toggle live */
  const toggleLive=async () =>
  {
    try
    {
      const res=await api.put('/scoring/admin/leaderboard-config', {jobRole: selectedRole, liveEnabled: !config.liveEnabled});
      setConfig(prev => ({...prev, liveEnabled: res.data.config.liveEnabled}));
    } catch {}
  };

  /* export CSV */
  const exportCSV=async () =>
  {
    try
    {
      const res=await api.get(`/scoring/admin/export/${selectedRole}`);
      const rows=res.data.data;
      if (!rows.length) return;
      const headers=Object.keys(rows[0]);
      const csv=[headers.join(','), ...rows.map(r => headers.map(h => `"${r[h]}"`).join(','))].join('\n');
      const blob=new Blob([csv], {type: 'text/csv'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url; a.download=`scores-${selectedRole}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  /* candidate detail */
  const openDetail=async (candidateId) =>
  {
    try
    {
      const res=await api.get(`/scoring/admin/candidate/${candidateId}`);
      setSelectedCandidate(res.data.candidate);
    } catch {}
  };

  const SortIcon=({col}) =>
  {
    if (sortKey!==col) return <ChevronDown size={12} style={{opacity: 0.3}} />;
    return sortDir==='asc'? <ChevronUp size={14} />:<ChevronDown size={14} />;
  };

  if (!user) return null;
  const initials=(user.username||'A').charAt(0).toUpperCase();

  /* ── chart data for detail modal ── */
  const radarData=selectedCandidate
    ? selectedCandidate.skills.map(s => ({skill: s.name, score: s.score, fullMark: 100}))
    :[];
  const sectionData=selectedCandidate
    ? Object.entries(selectedCandidate.sections).map(([k, v]) => ({name: k.charAt(0).toUpperCase()+k.slice(1), score: v}))
    :[];

  /* pie data for stats */
  const pieCandidateStatus=[
    {name: 'Qualified', value: stats.qualified||0, color: '#22c55e'},
    {name: 'Not Qualified', value: stats.notQualified||0, color: '#ef4444'},
  ];

  return (
    <div className="ascr-page">
      {/* ── Navbar ── */}
      <nav className="ascr-navbar">
        <div className="ascr-navbar-inner">
            <Link to="/admin-dashboard" className="ascr-logo"><BrandLogo /></Link>
          <div className="ascr-nav-center">
            <button className={`ascr-view-btn ${activeView==='results'? 'active':''}`} onClick={() => setActiveView('results')}>
              <BarChart3 size={15} /> Results
            </button>
            <button className={`ascr-view-btn ${activeView==='leaderboard'? 'active':''}`} onClick={() => setActiveView('leaderboard')}>
              <Trophy size={15} /> Leaderboard
            </button>
          </div>
          <div className="ascr-nav-right">
            <button className="ascr-icon-btn" onClick={() => setShowConfig(!showConfig)} title="Settings"><Settings size={18} /></button>
            <button className="ascr-icon-btn" title="Logout" onClick={() => {localStorage.removeItem('user'); localStorage.removeItem('token'); window.dispatchEvent(new Event('storage')); navigate('/login');}}><LogOut size={18} /></button>
            <div className="ascr-avatar">{initials}</div>
          </div>
        </div>
      </nav>

      <main className="ascr-main">
        <div className="ascr-container">

          {/* ── Header ── */}
          <div className="ascr-header">
            <div>
              <h1>Scoring & Rankings</h1>
              <p>Manage candidate evaluations, thresholds, and leaderboards</p>
            </div>
            <div className="ascr-header-actions">
              <select className="ascr-role-select" value={selectedRole} onChange={e => {setSelectedRole(e.target.value); setPage(1);}}>
                {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <button className="ascr-btn-export" onClick={exportCSV}><Download size={15} /> Export CSV</button>
            </div>
          </div>

          {/* ── Stats Row ── */}
          <div className="ascr-stats-row">
            {[
              {label: 'TOTAL CANDIDATES', value: stats.total||0, icon: <Users size={20} />, color: '#3b82f6'},
              {label: 'QUALIFIED', value: stats.qualified||0, icon: <CheckCircle2 size={20} />, color: '#22c55e'},
              {label: 'AVG SCORE', value: stats.avgScore||0, icon: <BarChart3 size={20} />, color: '#a855f7'},
              {label: 'TOP SCORE', value: stats.topScore||0, icon: <Award size={20} />, color: '#eab308'},
              {label: 'THRESHOLD', value: config.threshold, icon: <Target size={20} />, color: '#14b8a6'},
              {label: 'AVG TIME', value: `${stats.avgTime||0}m`, icon: <Clock size={20} />, color: '#ec4899'},
            ].map(s => (
              <div className="ascr-stat-card" key={s.label}>
                <div className="ascr-stat-icon" style={{color: s.color, background: `${s.color}15`}}>{s.icon}</div>
                <div className="ascr-stat-info">
                  <span className="ascr-stat-label">{s.label}</span>
                  <span className="ascr-stat-value">{s.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Configuration Panel ── */}
          {showConfig&&(
            <div className="ascr-config-panel">
              <div className="ascr-config-header">
                <h3><Settings size={18} /> Configuration</h3>
                <button className="ascr-close-btn" onClick={() => setShowConfig(false)}><X size={16} /></button>
              </div>
              <div className="ascr-config-body">
                <div className="ascr-config-group">
                  <label>Qualification Threshold (0–100)</label>
                  <input type="number" min={0} max={100} value={config.threshold} onChange={e => saveThreshold(e.target.value)} />
                </div>
                <div className="ascr-config-group">
                  <label>Leaderboard Mode</label>
                  <div className="ascr-toggle-row">
                    <span>{config.liveEnabled? 'Live':'Static'}</span>
                    <button className={`ascr-toggle ${config.liveEnabled? 'on':''}`} onClick={toggleLive}>
                      <div className="ascr-toggle-knob" />
                    </button>
                  </div>
                </div>
                <div className="ascr-config-group">
                  <label>Leaderboard Top N</label>
                  <input type="number" min={5} max={100} value={config.topN}
                    onChange={e =>
                    {
                      const v=Number(e.target.value);
                      setConfig(prev => ({...prev, topN: v}));
                      api.put('/scoring/admin/leaderboard-config', {jobRole: selectedRole, topN: v}).catch(() => {});
                    }} />
                </div>
                <div className="ascr-config-group">
                  <label>Section Weights</label>
                  <div className="ascr-weights-grid">
                    {Object.entries(config.weights||{}).map(([k, v]) => (
                      <div key={k} className="ascr-weight-item">
                        <span>{k}</span>
                        <span>{v}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ RESULTS VIEW ═══ */}
          {activeView==='results'&&(
            <>
              {/* Charts row: Qualification Pie + Score Distribution */}
              <div className="ascr-charts-row">
                <div className="ascr-chart-card">
                  <h3><PieChart size={16} /> Qualification Split</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieCandidateStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={4} strokeWidth={0}>
                        {pieCandidateStatus.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 13}} />
                      <Legend formatter={(val) => <span style={{color: '#ccc', fontSize: 12}}>{val}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="ascr-chart-card ascr-chart-wide">
                  <h3><BarChart3 size={16} /> Score Distribution</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={(() =>
                    {
                      const buckets=[
                        {range: '0-20', count: 0}, {range: '21-40', count: 0},
                        {range: '41-60', count: 0}, {range: '61-80', count: 0},
                        {range: '81-100', count: 0},
                      ];
                      candidates.forEach(c =>
                      {
                        if (c.overall<=20) buckets[0].count++;
                        else if (c.overall<=40) buckets[1].count++;
                        else if (c.overall<=60) buckets[2].count++;
                        else if (c.overall<=80) buckets[3].count++;
                        else buckets[4].count++;
                      });
                      return buckets;
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="range" tick={{fill: '#888', fontSize: 12}} />
                      <YAxis tick={{fill: '#888', fontSize: 12}} />
                      <Tooltip contentStyle={{background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 13}} />
                      <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Filter + Search */}
              <div className="ascr-toolbar">
                <div className="ascr-search-box">
                  <Search size={16} />
                  <input placeholder="Search candidates..." value={searchQ} onChange={e => {setSearchQ(e.target.value); setPage(1);}} />
                </div>
                <div className="ascr-filter-row">
                  {['all', 'qualified', 'not-qualified'].map(f => (
                    <button key={f} className={`ascr-filter-btn ${statusFilter===f? 'active':''}`} onClick={() => {setStatusFilter(f); setPage(1);}}>
                      {f==='all'? 'All':f==='qualified'? 'Qualified':'Not Qualified'}
                    </button>
                  ))}
                </div>
                <span className="ascr-result-count">{displayed.length} candidates</span>
              </div>

              {/* Table */}
              <div className="ascr-table-card">
                {loading? (
                  <div className="ascr-loading">Loading…</div>
                ):(
                  <table className="ascr-table">
                    <thead>
                      <tr>
                        <th onClick={() => handleSort('rank')} className="sortable">Rank <SortIcon col="rank" /></th>
                        <th onClick={() => handleSort('name')} className="sortable">Candidate <SortIcon col="name" /></th>
                        <th onClick={() => handleSort('overall')} className="sortable">Overall Score <SortIcon col="overall" /></th>
                        <th>Sections</th>
                        <th>Skills</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.length===0? (
                        <tr><td colSpan="7" className="ascr-empty">No candidates found</td></tr>
                      ):paginated.map(c => (
                        <tr key={c.id}>
                          <td className="ascr-rank">
                            {c.rank<=3? (
                              <span className={`ascr-medal medal-${c.rank}`}>{c.rank}</span>
                            ):c.rank}
                          </td>
                          <td>
                            <div className="ascr-cand-cell">
                              <div className="ascr-cand-avatar">{c.name.charAt(0)}</div>
                              <div>
                                <strong>{c.name}</strong>
                                <span>{c.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="ascr-score-cell">
                              <span className={`ascr-score-val ${scoreClass(c.overall)}`}>{c.overall}</span>
                              <div className="ascr-progress-bar">
                                <div className="ascr-progress-fill" style={{width: `${c.overall}%`, background: scoreColor(c.overall)}} />
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="ascr-sections-mini">
                              {Object.entries(c.sections).map(([k, v]) => (
                                <span key={k} className="ascr-section-tag" title={`${k}: ${v}`} style={{borderColor: scoreColor(v)}}>
                                  {k.slice(0, 3).toUpperCase()} {v}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="ascr-skills-mini">
                              {c.skills.slice(0, 3).map(s => (
                                <span key={s.name} className="ascr-skill-tag" style={{background: `${levelColor(s.level)}18`, color: levelColor(s.level), borderColor: `${levelColor(s.level)}40`}}>
                                  {s.name}
                                </span>
                              ))}
                              {c.skills.length>3&&<span className="ascr-skill-more">+{c.skills.length-3}</span>}
                            </div>
                          </td>
                          <td>
                            <span className={`ascr-status-pill ${c.status}`}>
                              {c.status==='qualified'? <CheckCircle2 size={13} />:<XCircle size={13} />}
                              {c.status==='qualified'? 'Qualified':'Not Qualified'}
                            </span>
                          </td>
                          <td>
                            <button className="ascr-action-btn" onClick={() => openDetail(c.id)}>
                              <Eye size={14} /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {totalPages>1&&(
                <div className="ascr-pagination">
                  <button disabled={page<=1} onClick={() => setPage(p => p-1)}>Prev</button>
                  <span>Page {page} of {totalPages}</span>
                  <button disabled={page>=totalPages} onClick={() => setPage(p => p+1)}>Next</button>
                </div>
              )}
            </>
          )}

          {/* ═══ LEADERBOARD VIEW ═══ */}
          {activeView==='leaderboard'&&(
            <div className="ascr-leaderboard">
              <div className="ascr-lb-header">
                <h2><Trophy size={22} /> Leaderboard — {roles.find(r => r.id===selectedRole)?.label}</h2>
                <div className="ascr-lb-badge">{config.liveEnabled? '🟢 Live':'⚪ Static'}</div>
              </div>

              {/* Top 3 podium */}
              {leaderboard.length>=3&&(
                <div className="ascr-podium">
                  {[1, 0, 2].map(idx =>
                  {
                    const c=leaderboard[idx];
                    if (!c) return null;
                    return (
                      <div className={`ascr-podium-card podium-${idx+1}`} key={c.rank}>
                        <div className="ascr-podium-rank">{['🥇', '🥈', '🥉'][idx]}</div>
                        <div className="ascr-podium-avatar">{c.name.charAt(0)}</div>
                        <strong>{c.name}</strong>
                        <span className="ascr-podium-score">{c.overall}</span>
                        <span className={`ascr-status-pill ${c.status}`}>{c.status==='qualified'? 'Qualified':'Not Qualified'}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Remaining list */}
              <div className="ascr-lb-list">
                {leaderboard.slice(3).map(c => (
                  <div className="ascr-lb-row" key={c.rank}>
                    <span className="ascr-lb-rank">{c.rank}</span>
                    <div className="ascr-lb-avatar">{c.name.charAt(0)}</div>
                    <span className="ascr-lb-name">{c.name}</span>
                    <div className="ascr-lb-bar-wrap">
                      <div className="ascr-lb-bar" style={{width: `${c.overall}%`, background: scoreColor(c.overall)}} />
                    </div>
                    <span className={`ascr-score-val ${scoreClass(c.overall)}`}>{c.overall}</span>
                    <span className={`ascr-status-pill sm ${c.status}`}>
                      {c.status==='qualified'? 'Q':'NQ'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ═══ CANDIDATE DETAIL MODAL ═══ */}
      {selectedCandidate&&(
        <div className="ascr-modal-overlay" onClick={() => setSelectedCandidate(null)}>
          <div className="ascr-modal" onClick={e => e.stopPropagation()}>
            <button className="ascr-modal-close" onClick={() => setSelectedCandidate(null)}><X size={18} /></button>

            <div className="ascr-modal-header">
              <div className="ascr-modal-avatar">{selectedCandidate.name.charAt(0)}</div>
              <div>
                <h2>{selectedCandidate.name}</h2>
                <span>{selectedCandidate.email}</span>
              </div>
              <div className={`ascr-modal-score-badge ${scoreClass(selectedCandidate.overall)}`}>
                <span className="ascr-big-score">{selectedCandidate.overall}</span>
                <span>/100</span>
              </div>
            </div>

            <div className="ascr-modal-row">
              <span className={`ascr-status-pill ${selectedCandidate.status}`}>
                {selectedCandidate.status==='qualified'? <CheckCircle2 size={14} />:<XCircle size={14} />}
                {selectedCandidate.status==='qualified'? 'Qualified':'Not Qualified'}
              </span>
              <span className="ascr-modal-meta"><Clock size={14} /> {selectedCandidate.timeSpent} min</span>
              <span className="ascr-modal-meta"><Award size={14} /> Rank #{selectedCandidate.rank}</span>
            </div>

            {/* Section-wise bar chart */}
            <div className="ascr-modal-section">
              <h3>Section-wise Performance</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sectionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{fill: '#888', fontSize: 12}} />
                  <YAxis dataKey="name" type="category" tick={{fill: '#ccc', fontSize: 12}} width={110} />
                  <Tooltip contentStyle={{background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 13}} />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                    {sectionData.map((entry, idx) => <Cell key={idx} fill={CHART_COLORS[idx%CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Radar chart */}
            <div className="ascr-modal-section">
              <h3>Skill Competency Map</h3>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="skill" tick={{fill: '#aaa', fontSize: 11}} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{fill: '#666', fontSize: 10}} />
                  <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Skill tags */}
            <div className="ascr-modal-section">
              <h3>Skill Proficiency Levels</h3>
              <div className="ascr-skill-grid">
                {selectedCandidate.skills.map(s => (
                  <div className="ascr-skill-card" key={s.name}>
                    <div className="ascr-skill-card-top">
                      <span>{s.name}</span>
                      <span className={`ascr-score-val ${scoreClass(s.score)}`}>{s.score}</span>
                    </div>
                    <div className="ascr-skill-level" style={{color: levelColor(s.level)}}>
                      <Star size={12} /> {s.level}
                    </div>
                    <div className="ascr-progress-bar">
                      <div className="ascr-progress-fill" style={{width: `${s.score}%`, background: levelColor(s.level)}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
