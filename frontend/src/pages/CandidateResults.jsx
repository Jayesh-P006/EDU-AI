import {useState, useEffect} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import
{
  BarChart3, Trophy, Award, Clock, TrendingUp, Star,
  ChevronRight, ArrowUp, ArrowDown, Minus, Target,
  CheckCircle2, XCircle, LogOut, Zap, Users, Home
} from 'lucide-react';
import
{
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';
import api from '../services/api';
import './CandidateResults.css';

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
function levelIcon(level)
{
  switch (level)
  {
    case 'Expert': return '🏆';
    case 'Advanced': return '🔷';
    case 'Intermediate': return '🔶';
    default: return '🔸';
  }
}

const SECTION_CHART_COLORS=['#6366f1', '#a855f7', '#14b8a6', '#f59e0b', '#ec4899'];

export default function CandidateResults()
{
  const navigate=useNavigate();
  const [user, setUser]=useState(null);
  const [results, setResults]=useState(null);
  const [leaderboard, setLeaderboard]=useState([]);
  const [loading, setLoading]=useState(true);
  const [activeTab, setActiveTab]=useState('overview'); // overview | sections | skills | leaderboard

  useEffect(() =>
  {
    const stored=localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    else navigate('/login');
  }, [navigate]);

  useEffect(() =>
  {
    if (!user) return;
    setLoading(true);
    Promise.all([
      api.get('/scoring/candidate/my-results'),
      api.get('/scoring/leaderboard/sde-fullstack'),
    ]).then(([resResults, resLB]) =>
    {
      setResults(resResults.data);
      setLeaderboard(resLB.data.leaderboard);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  if (loading) return (
    <div className="cres-page">
      <div className="cres-loading">
        <div className="cres-spinner" />
        <span>Loading your results…</span>
      </div>
    </div>
  );
  if (!results) return (
    <div className="cres-page">
      <div className="cres-loading"><span>No results found.</span></div>
    </div>
  );

  const {candidate, averages, percentile, strengths, improvements}=results;

  /* chart data */
  const sectionData=Object.entries(candidate.sections).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase()+k.slice(1),
    you: v,
    avg: averages[k]||0,
  }));

  const radarData=candidate.skills.map(s => ({
    skill: s.name,
    score: s.score,
    fullMark: 100,
  }));

  /* circular progress helper */
  const CircularProgress=({value, size=120, stroke=10, color}) =>
  {
    const r=(size-stroke)/2;
    const c=2*Math.PI*r;
    const offset=c-(value/100)*c;
    return (
      <svg width={size} height={size} className="cres-circle-svg">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1f1f1f" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{transition: 'stroke-dashoffset 1s ease'}}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={size*0.28} fontWeight="900">
          {value}
        </text>
      </svg>
    );
  };

  const initials=(user.username||'C').charAt(0).toUpperCase();

  return (
    <div className="cres-page">
      {/* ── Navbar ── */}
      <nav className="cres-navbar">
        <div className="cres-navbar-inner">
          <Link to="/candidate-dashboard" className="cres-logo">RecruitAI</Link>
          <div className="cres-nav-tabs">
            {[
              {id: 'overview', label: 'Overview', icon: <BarChart3 size={14} />},
              {id: 'sections', label: 'Sections', icon: <Target size={14} />},
              {id: 'skills', label: 'Skills', icon: <Star size={14} />},
              {id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={14} />},
            ].map(t => (
              <button key={t.id}
                className={`cres-tab-btn ${activeTab===t.id? 'active':''}`}
                onClick={() => setActiveTab(t.id)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="cres-nav-right">
            <button className="cres-icon-btn" onClick={() => navigate('/candidate-dashboard')} title="Dashboard"><Home size={18} /></button>
            <button className="cres-icon-btn" onClick={() => {localStorage.removeItem('user'); localStorage.removeItem('token'); window.dispatchEvent(new Event('storage')); navigate('/login');}} title="Logout"><LogOut size={18} /></button>
            <div className="cres-avatar">{initials}</div>
          </div>
        </div>
      </nav>

      <main className="cres-main">
        <div className="cres-container">

          {/* ═══ OVERVIEW ═══ */}
          {activeTab==='overview'&&(
            <>
              {/* Hero card */}
              <div className="cres-hero-card">
                <div className="cres-hero-left">
                  <CircularProgress value={candidate.overall} size={140} stroke={12} color={scoreColor(candidate.overall)} />
                  <div className="cres-hero-info">
                    <h1>{candidate.name}</h1>
                    <p>{candidate.email}</p>
                    <div className="cres-hero-badges">
                      <span className={`cres-status-pill ${candidate.status}`}>
                        {candidate.status==='qualified'? <CheckCircle2 size={14} />:<XCircle size={14} />}
                        {candidate.status==='qualified'? 'Qualified':'Not Qualified'}
                      </span>
                      <span className="cres-rank-badge"><Award size={14} /> Rank #{candidate.rank}</span>
                    </div>
                  </div>
                </div>
                <div className="cres-hero-stats">
                  <div className="cres-hero-stat">
                    <span className="cres-hero-stat-value">{percentile}th</span>
                    <span className="cres-hero-stat-label">Percentile</span>
                  </div>
                  <div className="cres-hero-stat">
                    <span className="cres-hero-stat-value">{candidate.timeSpent}m</span>
                    <span className="cres-hero-stat-label">Time Spent</span>
                  </div>
                  <div className="cres-hero-stat">
                    <span className="cres-hero-stat-value">{candidate.skills.length}</span>
                    <span className="cres-hero-stat-label">Skills Tested</span>
                  </div>
                </div>
              </div>

              {/* Quick comparison bar chart */}
              <div className="cres-section-card">
                <h3><BarChart3 size={16} /> Your Performance vs Average</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={sectionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                    <XAxis dataKey="name" tick={{fill: '#888', fontSize: 12}} />
                    <YAxis domain={[0, 100]} tick={{fill: '#888', fontSize: 12}} />
                    <Tooltip contentStyle={{background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 13}} />
                    <Bar dataKey="you" name="Your Score" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="avg" name="Average" fill="#333" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Strengths & Improvements */}
              <div className="cres-insights-row">
                <div className="cres-insight-card strengths">
                  <h3><TrendingUp size={16} /> Your Strengths</h3>
                  <ul>
                    {strengths.map((s, i) => (
                      <li key={i}><CheckCircle2 size={14} /> {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="cres-insight-card improvements">
                  <h3><Zap size={16} /> Areas to Improve</h3>
                  <ul>
                    {improvements.map((s, i) => (
                      <li key={i}><ArrowUp size={14} /> {s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          {/* ═══ SECTIONS ═══ */}
          {activeTab==='sections'&&(
            <>
              <div className="cres-tab-header">
                <h2><Target size={20} /> Section-wise Breakdown</h2>
                <p>Detailed performance in each assessment section</p>
              </div>
              <div className="cres-sections-grid">
                {sectionData.map((s, idx) =>
                {
                  const diff=s.you-s.avg;
                  return (
                    <div className="cres-section-detail-card" key={s.name}>
                      <div className="cres-sdc-top">
                        <div className="cres-sdc-icon" style={{background: `${SECTION_CHART_COLORS[idx]}18`, color: SECTION_CHART_COLORS[idx]}}>
                          <Target size={18} />
                        </div>
                        <div>
                          <h4>{s.name}</h4>
                          <span className="cres-sdc-diff" style={{color: diff>=0? '#22c55e':'#ef4444'}}>
                            {diff>=0? <ArrowUp size={12} />:<ArrowDown size={12} />}
                            {Math.abs(diff).toFixed(1)} vs avg
                          </span>
                        </div>
                      </div>
                      <div className="cres-sdc-score-row">
                        <CircularProgress value={s.you} size={80} stroke={8} color={SECTION_CHART_COLORS[idx]} />
                        <div className="cres-sdc-legend">
                          <div><span className="cres-dot" style={{background: SECTION_CHART_COLORS[idx]}} /> You: <strong>{s.you}</strong></div>
                          <div><span className="cres-dot" style={{background: '#555'}} /> Avg: <strong>{s.avg}</strong></div>
                        </div>
                      </div>
                      <div className="cres-sdc-bar-wrap">
                        <div className="cres-sdc-bar" style={{width: `${s.you}%`, background: SECTION_CHART_COLORS[idx]}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ═══ SKILLS ═══ */}
          {activeTab==='skills'&&(
            <>
              <div className="cres-tab-header">
                <h2><Star size={20} /> Skill Competency Map</h2>
                <p>Your proficiency across assessed skills</p>
              </div>

              {/* Radar chart */}
              <div className="cres-section-card">
                <h3>Radar Overview</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#262626" />
                    <PolarAngleAxis dataKey="skill" tick={{fill: '#aaa', fontSize: 11}} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{fill: '#555', fontSize: 10}} />
                    <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Skill cards */}
              <div className="cres-skills-grid">
                {candidate.skills.sort((a, b) => b.score-a.score).map(s => (
                  <div className="cres-skill-card" key={s.name}>
                    <div className="cres-sk-top">
                      <span className="cres-sk-emoji">{levelIcon(s.level)}</span>
                      <div>
                        <strong>{s.name}</strong>
                        <span className="cres-sk-level" style={{color: levelColor(s.level)}}>{s.level}</span>
                      </div>
                      <span className={`cres-sk-score ${scoreClass(s.score)}`}>{s.score}</span>
                    </div>
                    <div className="cres-progress-bar">
                      <div className="cres-progress-fill" style={{width: `${s.score}%`, background: levelColor(s.level)}} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══ LEADERBOARD ═══ */}
          {activeTab==='leaderboard'&&(
            <>
              <div className="cres-tab-header">
                <h2><Trophy size={20} /> Leaderboard</h2>
                <p>See how you compare against other candidates</p>
              </div>

              {/* top 3 podium */}
              {leaderboard.length>=3&&(
                <div className="cres-podium">
                  {[1, 0, 2].map(idx =>
                  {
                    const c=leaderboard[idx];
                    if (!c) return null;
                    const isYou=c.name===candidate.name;
                    return (
                      <div className={`cres-podium-card podium-${idx+1} ${isYou? 'is-you':''}`} key={c.rank}>
                        <div className="cres-podium-rank">{['🥇', '🥈', '🥉'][idx]}</div>
                        <div className="cres-podium-avatar">{c.name.charAt(0)}</div>
                        <strong>{isYou? 'You':c.name}</strong>
                        <span className="cres-podium-score">{c.overall}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* rest */}
              <div className="cres-lb-list">
                {leaderboard.slice(3).map(c =>
                {
                  const isYou=c.name===candidate.name;
                  return (
                    <div className={`cres-lb-row ${isYou? 'is-you':''}`} key={c.rank}>
                      <span className="cres-lb-rank">{c.rank}</span>
                      <div className="cres-lb-avatar">{c.name.charAt(0)}</div>
                      <span className="cres-lb-name">{isYou? 'You':c.name}</span>
                      <div className="cres-lb-bar-wrap">
                        <div className="cres-lb-bar" style={{width: `${c.overall}%`, background: scoreColor(c.overall)}} />
                      </div>
                      <span className={`cres-lb-score ${scoreClass(c.overall)}`}>{c.overall}</span>
                    </div>
                  );
                })}
              </div>

              {/* Your position highlight */}
              <div className="cres-your-pos">
                <Award size={18} />
                <span>Your Position: <strong>#{candidate.rank}</strong> out of {leaderboard.length} candidates</span>
                <span className="cres-your-percentile">{percentile}th percentile</span>
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
