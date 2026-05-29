import {useState, useEffect, useRef} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import {motion, AnimatePresence, useInView} from 'framer-motion';
import
{
  BarChart3, Trophy, Award, Clock, TrendingUp, Star,
  ChevronRight, ArrowUp, ArrowDown, Target, Download,
  CheckCircle2, XCircle, LogOut, Zap, Users, Home,
  Brain, Shield, MessageSquare, Lightbulb, Layers, Eye,
  FileText, Sparkles, Activity, PieChart as PieIcon
} from 'lucide-react';
import Chart from 'react-apexcharts';
import html2canvas from 'html2canvas';
import {jsPDF} from 'jspdf';
import api from '../services/api';
import {useFeature} from '../services/FeatureContext';
import './CandidateAnalytics.css';

/* ─── colour helpers ─── */
const scoreColor=s => s>=80? '#22c55e':s>=60? '#f59e0b':'#ef4444';
const scoreLabel=s => s>=80? 'Excellent':s>=60? 'Good':'Needs Work';
const levelColor=l => ({Expert: '#22c55e', Advanced: '#3b82f6', Intermediate: '#f59e0b', Beginner: '#ef4444'}[l]||'#888');

/* ─── animated counter ─── */
function AnimatedNumber({value, duration=1200, suffix=''})
{
  const [display, setDisplay]=useState(0);
  const ref=useRef(null);
  const inView=useInView(ref, {once: true, margin: '-40px'});

  useEffect(() =>
  {
    if (!inView) return;
    let start=0;
    const end=Number(value);
    const step=end/(duration/16);
    const timer=setInterval(() =>
    {
      start+=step;
      if (start>=end) {setDisplay(end); clearInterval(timer);}
      else setDisplay(Math.round(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value, inView, duration]);

  return <span ref={ref}>{display}{suffix}</span>;
}

/* ─── animated circular progress ─── */
function CircularProgress({value, size=140, strokeWidth=12, color, delay=0})
{
  const r=(size-strokeWidth)/2;
  const circ=2*Math.PI*r;
  const ref=useRef(null);
  const inView=useInView(ref, {once: true, margin: '-30px'});

  return (
    <svg ref={ref} width={size} height={size} className="ca-circle-svg">
      {/* track */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      {/* progress */}
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{strokeDashoffset: circ}}
        animate={inView? {strokeDashoffset: circ-(value/100)*circ}:{}}
        transition={{duration: 1.2, delay, ease: [0.65, 0, 0.35, 1]}}
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      {/* text */}
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize={size*0.26} fontWeight="900" className="ca-circle-number">
        {inView? <AnimatedNumber value={value} />:0}
      </text>
      <text x="50%" y="68%" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={11} fontWeight="600">
        / 100
      </text>
    </svg>
  );
}

/* ─── star display ─── */
function StarRating({count})
{
  return (
    <div className="ca-stars">
      {[1, 2, 3, 4, 5].map(i => (
        <motion.span key={i}
          initial={{scale: 0, rotate: -180}}
          animate={{scale: 1, rotate: 0}}
          transition={{delay: 0.6+i*0.1, type: 'spring', stiffness: 260, damping: 20}}>
          <Star size={20} fill={i<=count? '#fbbf24':'none'} color={i<=count? '#fbbf24':'#555'} />
        </motion.span>
      ))}
    </div>
  );
}

/* ─── reveal wrapper ─── */
function Reveal({children, delay=0, className=''})
{
  return (
    <motion.div
      initial={{opacity: 0, y: 30}}
      whileInView={{opacity: 1, y: 0}}
      viewport={{once: true, margin: '-60px'}}
      transition={{duration: 0.6, delay, ease: [0.22, 1, 0.36, 1]}}
      className={className}>
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function CandidateAnalytics()
{
  const navigate=useNavigate();
  const isEnabled=useFeature('student.analytics');

  const dashboardRef=useRef(null);
  const [user, setUser]=useState(null);
  const [data, setData]=useState(null);
  const [loading, setLoading]=useState(true);
  const [pdfLoading, setPdfLoading]=useState(false);
  const [activeSection, setActiveSection]=useState('overview');

  /* redirect if feature disabled */
  useEffect(() =>
  {
    if (!isEnabled)
    {
      navigate('/candidate-dashboard');
    }
  }, [isEnabled, navigate]);

  /* auth */
  useEffect(() =>
  {
    const stored=localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    else navigate('/login');
  }, [navigate]);

  /* fetch analytics data */
  useEffect(() =>
  {
    if (!user) return;
    setLoading(true);
    api.get('/scoring/candidate/analytics')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  /* PDF export */
  const exportPDF=async () =>
  {
    if (!dashboardRef.current) return;
    setPdfLoading(true);
    try
    {
      const canvas=await html2canvas(dashboardRef.current, {
        scale: 2, backgroundColor: '#0a0a0f', useCORS: true,
        logging: false, windowWidth: 1400,
      });
      const imgData=canvas.toDataURL('image/png');
      const pdf=new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4'});
      const w=pdf.internal.pageSize.getWidth();
      const h=(canvas.height*w)/canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, w, h);
      pdf.save(`analytics-${data?.candidate?.name?.replace(/\s/g, '_')||'report'}.pdf`);
    } catch (e) {console.error('PDF export error', e);}
    setPdfLoading(false);
  };

  if (!user) return null;
  if (loading) return (
    <div className="ca-page">
      <div className="ca-loader">
        <motion.div className="ca-loader-ring"
          animate={{rotate: 360}}
          transition={{repeat: Infinity, duration: 1.1, ease: 'linear'}} />
        <span>Loading analytics…</span>
      </div>
    </div>
  );
  if (!data) return (
    <div className="ca-page"><div className="ca-loader"><span>No analytics data available.</span></div></div>
  );

  const {candidate, roleLabel, sectionAverages, sectionComparison, timeline,
    top5, strengths, weaknesses, timeAnalytics, skillRadar,
    overallDistribution, totalCandidates, threshold}=data;

  const initials=(user.username||'C').charAt(0).toUpperCase();

  /* ── ApexChart configs ── */
  const apexDark={
    chart: {background: 'transparent', toolbar: {show: false}, fontFamily: 'Inter, sans-serif'},
    theme: {mode: 'dark'},
    grid: {borderColor: '#1f1f2e', strokeDashArray: 4},
    tooltip: {
      theme: 'dark',
      style: {fontSize: '12px'},
      y: {formatter: v => `${v}`},
    },
    xaxis: {labels: {style: {colors: '#888', fontSize: '11px'}}, axisBorder: {show: false}, axisTicks: {show: false}},
    yaxis: {labels: {style: {colors: '#888', fontSize: '11px'}}},
  };

  /* timeline area chart */
  const timelineChart={
    options: {
      ...apexDark,
      chart: {...apexDark.chart, type: 'area', height: 280, animations: {enabled: true, speed: 1200, easing: 'easeinout'}},
      stroke: {curve: 'smooth', width: 3},
      fill: {type: 'gradient', gradient: {shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100]}},
      colors: ['#6366f1', '#a855f7', '#14b8a6'],
      xaxis: {...apexDark.xaxis, categories: timeline.map(t => t.week)},
      yaxis: {...apexDark.yaxis, min: 0, max: 100},
      legend: {labels: {colors: '#aaa'}, fontSize: '12px', position: 'top'},
      dataLabels: {enabled: false},
    },
    series: [
      {name: 'Overall', data: timeline.map(t => t.score)},
      {name: 'Technical', data: timeline.map(t => t.technical)},
      {name: 'Domain', data: timeline.map(t => t.domain)},
    ],
  };

  /* section comparison bar chart */
  const comparisonChart={
    options: {
      ...apexDark,
      chart: {...apexDark.chart, type: 'bar', height: 300, animations: {enabled: true, speed: 800}},
      plotOptions: {bar: {horizontal: false, columnWidth: '55%', borderRadius: 6, borderRadiusApplication: 'end'}},
      colors: ['#6366f1', '#555', '#22c55e'],
      xaxis: {...apexDark.xaxis, categories: sectionComparison.map(s => s.section)},
      yaxis: {...apexDark.yaxis, min: 0, max: 100},
      legend: {labels: {colors: '#aaa'}, fontSize: '12px', position: 'top'},
      dataLabels: {enabled: false},
    },
    series: [
      {name: 'You', data: sectionComparison.map(s => s.you)},
      {name: 'Average', data: sectionComparison.map(s => s.average)},
      {name: 'Top 10%', data: sectionComparison.map(s => s.top10)},
    ],
  };

  /* radar chart for skills */
  const radarChart={
    options: {
      ...apexDark,
      chart: {...apexDark.chart, type: 'radar', height: 320},
      colors: ['#6366f1'],
      fill: {opacity: 0.2},
      stroke: {width: 2},
      markers: {size: 4, colors: ['#6366f1'], strokeColors: '#6366f1', strokeWidth: 1},
      xaxis: {categories: skillRadar.map(s => s.skill)},
      yaxis: {show: false, min: 0, max: 100},
      plotOptions: {radar: {polygons: {strokeColors: '#1f1f2e', fill: {colors: ['transparent']}}}},
    },
    series: [{name: 'Score', data: skillRadar.map(s => s.score)}],
  };

  /* overall distribution donut */
  const donutChart={
    options: {
      ...apexDark,
      chart: {...apexDark.chart, type: 'donut', height: 240},
      labels: ['0-20', '21-40', '41-60', '61-80', '81-100'],
      colors: ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#22c55e'],
      plotOptions: {pie: {donut: {size: '60%', labels: {show: true, name: {color: '#ccc'}, value: {color: '#fff', fontSize: '18px', fontWeight: 700}, total: {show: true, label: 'Total', color: '#888', fontSize: '12px', formatter: () => totalCandidates}}}}},
      dataLabels: {enabled: false},
      legend: {labels: {colors: '#aaa'}, fontSize: '11px', position: 'bottom'},
      stroke: {width: 0},
    },
    series: overallDistribution,
  };

  /* top 5 horizontal bar */
  const top5Chart={
    options: {
      ...apexDark,
      chart: {...apexDark.chart, type: 'bar', height: 220},
      plotOptions: {bar: {horizontal: true, borderRadius: 6, barHeight: '55%'}},
      colors: ['#6366f1'],
      xaxis: {...apexDark.xaxis, categories: top5.map(c => c.name), max: 100},
      dataLabels: {enabled: true, style: {fontSize: '12px', fontWeight: 700, colors: ['#fff']}, offsetX: 0},
    },
    series: [{name: 'Score', data: top5.map(c => c.overall)}],
  };

  /* nav sections */
  const NAV=[
    {id: 'overview', label: 'Overview', icon: <Eye size={15} />},
    {id: 'performance', label: 'Performance', icon: <Activity size={15} />},
    {id: 'skills', label: 'Skills', icon: <Brain size={15} />},
    {id: 'comparison', label: 'Comparison', icon: <Users size={15} />},
    {id: 'insights', label: 'Insights', icon: <Lightbulb size={15} />},
  ];

  const sectionIcons={
    Technical: <Brain size={18} />,
    Aptitude: <Lightbulb size={18} />,
    Domain: <Layers size={18} />,
    Communication: <MessageSquare size={18} />,
    ProblemSolving: <Target size={18} />,
  };

  return (
    <div className="ca-page">
      {/* ── Navbar ── */}
      <nav className="ca-navbar">
        <div className="ca-navbar-inner">
          <Link to="/candidate-dashboard" className="ca-logo">
            <Sparkles size={20} /> EDU-AI
          </Link>
          <div className="ca-nav-pills">
            {NAV.map(n => (
              <button key={n.id}
                className={`ca-pill ${activeSection===n.id? 'active':''}`}
                onClick={() => {setActiveSection(n.id); document.getElementById(`ca-${n.id}`)?.scrollIntoView({behavior: 'smooth', block: 'start'});}}>
                {n.icon} <span>{n.label}</span>
              </button>
            ))}
          </div>
          <div className="ca-nav-right">
            <motion.button className="ca-btn-pdf" onClick={exportPDF} disabled={pdfLoading}
              whileHover={{scale: 1.04}} whileTap={{scale: 0.96}}>
              <Download size={15} /> {pdfLoading? 'Exporting…':'Export PDF'}
            </motion.button>
            <button className="ca-icon-btn" onClick={() => navigate('/candidate-dashboard')} title="Dashboard"><Home size={18} /></button>
            <button className="ca-icon-btn" onClick={() => {localStorage.removeItem('user'); localStorage.removeItem('token'); window.dispatchEvent(new Event('storage')); navigate('/login');}} title="Logout"><LogOut size={18} /></button>
            <div className="ca-avatar">{initials}</div>
          </div>
        </div>
      </nav>

      <main className="ca-main" ref={dashboardRef}>
        <div className="ca-container">

          {/* ═══════════════════════════════════════════
              1. HERO SECTION — Candidate Overview Card
              ═══════════════════════════════════════════ */}
          <section id="ca-overview">
            <motion.div className="ca-hero"
              initial={{opacity: 0, y: 40, scale: 0.97}}
              animate={{opacity: 1, y: 0, scale: 1}}
              transition={{duration: 0.8, ease: [0.22, 1, 0.36, 1]}}>

              {/* gradient mesh background */}
              <div className="ca-hero-mesh">
                <div className="ca-mesh-orb ca-mesh-1" />
                <div className="ca-mesh-orb ca-mesh-2" />
                <div className="ca-mesh-orb ca-mesh-3" />
              </div>

              <div className="ca-hero-content">
                {/* Left: Avatar + Info */}
                <div className="ca-hero-left">
                  <motion.div className="ca-hero-avatar"
                    initial={{scale: 0, rotate: -30}}
                    animate={{scale: 1, rotate: 0}}
                    transition={{delay: 0.3, type: 'spring', stiffness: 200, damping: 18}}>
                    <div className="ca-hero-avatar-ring" />
                    <span>{candidate.name.charAt(0)}</span>
                  </motion.div>
                  <motion.div
                    initial={{opacity: 0, x: -20}}
                    animate={{opacity: 1, x: 0}}
                    transition={{delay: 0.4, duration: 0.6}}>
                    <h1 className="ca-hero-name">{candidate.name}</h1>
                    <p className="ca-hero-role">{roleLabel}</p>
                    <div className="ca-hero-tags">
                      <span className="ca-tag-glass"><Trophy size={13} /> Rank #{candidate.rank}</span>
                      <span className="ca-tag-glass"><Users size={13} /> {totalCandidates} candidates</span>
                      <span className="ca-tag-glass"><Clock size={13} /> {candidate.timeSpent} min</span>
                    </div>
                  </motion.div>
                </div>

                {/* Right: Three metric cards */}
                <div className="ca-hero-metrics">
                  {/* Overall Score */}
                  <motion.div className="ca-metric-card ca-metric-score"
                    initial={{opacity: 0, y: 30}}
                    animate={{opacity: 1, y: 0}}
                    transition={{delay: 0.5, duration: 0.6}}
                    whileHover={{scale: 1.05, y: -4}}>
                    <div className="ca-metric-label">Overall Score</div>
                    <CircularProgress value={candidate.overall} size={130} strokeWidth={11}
                      color={scoreColor(candidate.overall)} delay={0.6} />
                    <span className="ca-metric-sublabel" style={{color: scoreColor(candidate.overall)}}>
                      {scoreLabel(candidate.overall)}
                    </span>
                  </motion.div>

                  {/* Percentile */}
                  <motion.div className="ca-metric-card ca-metric-percentile"
                    initial={{opacity: 0, y: 30}}
                    animate={{opacity: 1, y: 0}}
                    transition={{delay: 0.65, duration: 0.6}}
                    whileHover={{scale: 1.05, y: -4}}>
                    <div className="ca-metric-label">Percentile Rank</div>
                    <div className="ca-metric-big">
                      Top <AnimatedNumber value={100-candidate.percentile} suffix="%" />
                    </div>
                    <StarRating count={candidate.starRating} />
                  </motion.div>

                  {/* Qualification */}
                  <motion.div className={`ca-metric-card ca-metric-qual ${candidate.status}`}
                    initial={{opacity: 0, y: 30}}
                    animate={{opacity: 1, y: 0}}
                    transition={{delay: 0.8, duration: 0.6}}
                    whileHover={{scale: 1.05, y: -4}}>
                    <div className="ca-metric-label">Qualification Status</div>
                    <motion.div className="ca-qual-icon"
                      initial={{scale: 0}}
                      animate={{scale: 1}}
                      transition={{delay: 1.2, type: 'spring', stiffness: 300, damping: 15}}>
                      {candidate.status==='qualified'
                        ? <CheckCircle2 size={48} />
                        :<XCircle size={48} />}
                    </motion.div>
                    <span className="ca-qual-text">
                      {candidate.status==='qualified'? '✓ QUALIFIED':'✗ NOT QUALIFIED'}
                    </span>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ═══════════════════════════════════════════
              2. SECTION-WISE PERFORMANCE CARDS
              ═══════════════════════════════════════════ */}
          <section id="ca-performance" className="ca-section">
            <Reveal>
              <div className="ca-section-header">
                <h2><Activity size={22} /> Performance Breakdown</h2>
                <p>Detailed scores across all assessment sections</p>
              </div>
            </Reveal>

            <div className="ca-perf-grid">
              {sectionComparison.map((sec, idx) =>
              {
                const diff=sec.you-sec.average;
                return (
                  <Reveal key={sec.section} delay={idx*0.1}>
                    <motion.div className="ca-perf-card" whileHover={{y: -6, scale: 1.02}}>
                      <div className="ca-perf-card-header">
                        <div className="ca-perf-icon" style={{background: `${scoreColor(sec.you)}15`, color: scoreColor(sec.you)}}>
                          {sectionIcons[sec.section]||<Target size={18} />}
                        </div>
                        <div>
                          <h4>{sec.section}</h4>
                          <span className="ca-perf-diff" style={{color: diff>=0? '#22c55e':'#ef4444'}}>
                            {diff>=0? <ArrowUp size={13} />:<ArrowDown size={13} />}
                            {Math.abs(diff).toFixed(0)} vs avg
                          </span>
                        </div>
                      </div>
                      <div className="ca-perf-card-body">
                        <CircularProgress value={sec.you} size={90} strokeWidth={9}
                          color={scoreColor(sec.you)} delay={0.2+idx*0.1} />
                        <div className="ca-perf-legend">
                          <div className="ca-perf-legend-row">
                            <span className="ca-dot" style={{background: scoreColor(sec.you)}} /> Your Score <strong>{sec.you}</strong>
                          </div>
                          <div className="ca-perf-legend-row">
                            <span className="ca-dot" style={{background: '#555'}} /> Average <strong>{sec.average}</strong>
                          </div>
                          <div className="ca-perf-legend-row">
                            <span className="ca-dot" style={{background: '#22c55e'}} /> Top 10% <strong>{sec.top10}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="ca-perf-bar-track">
                        <motion.div className="ca-perf-bar-fill"
                          style={{background: scoreColor(sec.you)}}
                          initial={{width: 0}}
                          whileInView={{width: `${sec.you}%`}}
                          viewport={{once: true}}
                          transition={{duration: 1, delay: 0.3+idx*0.1, ease: [0.22, 1, 0.36, 1]}} />
                      </div>
                    </motion.div>
                  </Reveal>
                );
              })}
            </div>

            {/* Grouped comparison chart */}
            <Reveal delay={0.2}>
              <div className="ca-chart-card">
                <h3><BarChart3 size={16} /> Section Comparison — You vs Average vs Top 10%</h3>
                <Chart options={comparisonChart.options} series={comparisonChart.series} type="bar" height={300} />
              </div>
            </Reveal>
          </section>

          {/* ═══════════════════════════════════════════
              3. SKILLS — Radar + Grid
              ═══════════════════════════════════════════ */}
          <section id="ca-skills" className="ca-section">
            <Reveal>
              <div className="ca-section-header">
                <h2><Brain size={22} /> Skill Competency Map</h2>
                <p>Your proficiency levels across evaluated skills</p>
              </div>
            </Reveal>

            <div className="ca-skills-layout">
              <Reveal delay={0.1}>
                <div className="ca-chart-card ca-radar-card">
                  <h3>Radar Overview</h3>
                  <Chart options={radarChart.options} series={radarChart.series} type="radar" height={320} />
                </div>
              </Reveal>

              <div className="ca-skill-cards">
                {skillRadar.sort((a, b) => b.score-a.score).map((s, idx) => (
                  <Reveal key={s.skill} delay={0.1+idx*0.08}>
                    <motion.div className="ca-skill-card" whileHover={{y: -4, scale: 1.03}}>
                      <div className="ca-skill-top">
                        <div>
                          <strong>{s.skill}</strong>
                          <span className="ca-skill-level" style={{color: levelColor(s.level)}}>
                            <Star size={11} fill={levelColor(s.level)} /> {s.level}
                          </span>
                        </div>
                        <span className="ca-skill-score" style={{color: scoreColor(s.score)}}>
                          <AnimatedNumber value={s.score} />
                        </span>
                      </div>
                      <div className="ca-skill-bar-track">
                        <motion.div className="ca-skill-bar-fill"
                          style={{background: `linear-gradient(90deg, ${levelColor(s.level)}, ${scoreColor(s.score)})`}}
                          initial={{width: 0}}
                          whileInView={{width: `${s.score}%`}}
                          viewport={{once: true}}
                          transition={{duration: 0.9, delay: 0.1+idx*0.06, ease: [0.22, 1, 0.36, 1]}} />
                      </div>
                    </motion.div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════
              4. COMPARISON — Timeline + Distribution + Top 5
              ═══════════════════════════════════════════ */}
          <section id="ca-comparison" className="ca-section">
            <Reveal>
              <div className="ca-section-header">
                <h2><Users size={22} /> Comparison & Trends</h2>
                <p>Your progress over time and how you compare with other candidates</p>
              </div>
            </Reveal>

            {/* Timeline area chart */}
            <Reveal delay={0.1}>
              <div className="ca-chart-card">
                <h3><TrendingUp size={16} /> Performance Timeline</h3>
                <Chart options={timelineChart.options} series={timelineChart.series} type="area" height={280} />
              </div>
            </Reveal>

            <div className="ca-comparison-row">
              {/* Distribution donut */}
              <Reveal delay={0.15}>
                <div className="ca-chart-card">
                  <h3><PieIcon size={16} /> Score Distribution</h3>
                  <Chart options={donutChart.options} series={donutChart.series} type="donut" height={240} />
                </div>
              </Reveal>

              {/* Top 5 */}
              <Reveal delay={0.2}>
                <div className="ca-chart-card">
                  <h3><Trophy size={16} /> Top 5 Candidates</h3>
                  <Chart options={top5Chart.options} series={top5Chart.series} type="bar" height={220} />
                </div>
              </Reveal>
            </div>

            {/* Time analytics */}
            <Reveal delay={0.15}>
              <div className="ca-time-row">
                {[
                  {label: 'Your Time', value: `${timeAnalytics.yours}m`, icon: <Clock size={20} />, color: '#6366f1'},
                  {label: 'Average Time', value: `${timeAnalytics.average}m`, icon: <Users size={20} />, color: '#a855f7'},
                  {label: 'Fastest Time', value: `${timeAnalytics.fastest}m`, icon: <Zap size={20} />, color: '#14b8a6'},
                ].map((t, i) => (
                  <motion.div className="ca-time-card" key={t.label}
                    initial={{opacity: 0, y: 20}}
                    whileInView={{opacity: 1, y: 0}}
                    viewport={{once: true}}
                    transition={{delay: 0.1+i*0.1}}
                    whileHover={{y: -3}}>
                    <div className="ca-time-icon" style={{background: `${t.color}15`, color: t.color}}>{t.icon}</div>
                    <div className="ca-time-info">
                      <span className="ca-time-value">{t.value}</span>
                      <span className="ca-time-label">{t.label}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Reveal>
          </section>

          {/* ═══════════════════════════════════════════
              5. INSIGHTS — Strengths + Weaknesses + Recommendations
              ═══════════════════════════════════════════ */}
          <section id="ca-insights" className="ca-section">
            <Reveal>
              <div className="ca-section-header">
                <h2><Lightbulb size={22} /> Performance Insights</h2>
                <p>Key strengths, improvement areas, and actionable recommendations</p>
              </div>
            </Reveal>

            <div className="ca-insights-grid">
              {/* Strengths */}
              <Reveal delay={0.1}>
                <div className="ca-insight-card ca-insight-strengths">
                  <div className="ca-insight-header">
                    <div className="ca-insight-icon strengths"><TrendingUp size={20} /></div>
                    <h3>Key Strengths</h3>
                  </div>
                  {strengths.length===0? (
                    <p className="ca-insight-empty">Keep practicing to build your strengths!</p>
                  ):(
                    <ul className="ca-insight-list">
                      {strengths.map((s, i) => (
                        <motion.li key={s.name}
                          initial={{opacity: 0, x: -10}}
                          whileInView={{opacity: 1, x: 0}}
                          viewport={{once: true}}
                          transition={{delay: 0.2+i*0.08}}>
                          <CheckCircle2 size={16} className="ca-insight-check" />
                          <div>
                            <strong>{s.name}</strong>
                            <span>Score: {s.score} · {s.level}</span>
                          </div>
                          <span className="ca-insight-score" style={{color: scoreColor(s.score)}}>{s.score}</span>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </div>
              </Reveal>

              {/* Improvement areas */}
              <Reveal delay={0.15}>
                <div className="ca-insight-card ca-insight-weak">
                  <div className="ca-insight-header">
                    <div className="ca-insight-icon weak"><ArrowUp size={20} /></div>
                    <h3>Areas to Improve</h3>
                  </div>
                  {weaknesses.length===0? (
                    <p className="ca-insight-empty">Great job — no critical weaknesses!</p>
                  ):(
                    <ul className="ca-insight-list">
                      {weaknesses.map((s, i) => (
                        <motion.li key={s.name}
                          initial={{opacity: 0, x: -10}}
                          whileInView={{opacity: 1, x: 0}}
                          viewport={{once: true}}
                          transition={{delay: 0.2+i*0.08}}>
                          <Zap size={16} className="ca-insight-zap" />
                          <div>
                            <strong>{s.name}</strong>
                            <span>Score: {s.score} · {s.level}</span>
                          </div>
                          <span className="ca-insight-score" style={{color: scoreColor(s.score)}}>{s.score}</span>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </div>
              </Reveal>

              {/* Recommendations */}
              <Reveal delay={0.2}>
                <div className="ca-insight-card ca-insight-recs">
                  <div className="ca-insight-header">
                    <div className="ca-insight-icon recs"><Sparkles size={20} /></div>
                    <h3>Recommendations</h3>
                  </div>
                  <ul className="ca-rec-list">
                    {candidate.overall<threshold&&(
                      <li className="ca-rec critical">
                        <Shield size={16} />
                        <span>Focus on reaching the qualification threshold of <strong>{threshold}</strong>. You need <strong>{threshold-candidate.overall}</strong> more points.</span>
                      </li>
                    )}
                    {weaknesses.slice(0, 3).map(w => (
                      <li key={w.name} className="ca-rec warn">
                        <Target size={16} />
                        <span>Improve <strong>{w.name}</strong> — currently at <strong>{w.score}</strong>. Practice more in this area.</span>
                      </li>
                    ))}
                    {strengths.slice(0, 2).map(s => (
                      <li key={s.name} className="ca-rec good">
                        <Award size={16} />
                        <span>Excellent <strong>{s.name}</strong> skills at <strong>{s.score}</strong>. Keep leveraging this strength!</span>
                      </li>
                    ))}
                    <li className="ca-rec info">
                      <Clock size={16} />
                      <span>Your assessment time was <strong>{timeAnalytics.yours}m</strong> vs average <strong>{timeAnalytics.average}m</strong>. {timeAnalytics.yours<=timeAnalytics.average? 'Good pace!':'Consider managing time better.'}</span>
                    </li>
                  </ul>
                </div>
              </Reveal>
            </div>
          </section>

          {/* Footer */}
          <div className="ca-footer">
            <span>EDU-AI Analytics · Generated {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
