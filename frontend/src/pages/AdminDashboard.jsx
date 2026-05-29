import {useEffect, useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {
  Shield, Users, Building2, Briefcase,
  AlertTriangle, LogOut, RefreshCw, Search, Filter, SlidersHorizontal, Radar, BarChart3,
  Eye, UserRoundSearch, Pencil, Trash2, Power, X, Megaphone, Send, Bell, CheckCircle, ToggleLeft, ToggleRight,
} from 'lucide-react';
import api from '../services/api';
import BrandLogo from '../components/BrandLogo';
import NotificationBell from '../components/NotificationBell';
import './AdminDashboard.css';

const TABS=[
  {id: 'overview', label: 'Overview', icon: <Shield size={16} />},
  {id: 'users', label: 'Users', icon: <Users size={16} />},
  {id: 'companies', label: 'Companies', icon: <Building2 size={16} />},
  {id: 'ai-config', label: 'AI Config', icon: <SlidersHorizontal size={16} />},
  {id: 'security', label: 'Security', icon: <Radar size={16} />},
  {id: 'candidate-oversight', label: 'Candidate Oversight', icon: <BarChart3 size={16} />},
  {id: 'jobs', label: 'Jobs', icon: <Briefcase size={16} />},
  {id: 'flags', label: 'Proctoring Flags', icon: <AlertTriangle size={16} />},
  {id: 'announcements', label: 'Announcements', icon: <Megaphone size={16} />},
  {id: 'features', label: 'Features', icon: <ToggleLeft size={16} />},
];

const JOB_STATUS_OPTIONS=[
  {id: 'all', label: 'All Statuses'},
  {id: 'active', label: 'Active'},
  {id: 'closed', label: 'Closed'},
  {id: 'draft', label: 'Draft'},
  {id: 'paused', label: 'Paused'},
];

const JOB_TYPE_OPTIONS=['Full-Time', 'Part-Time', 'Contract', 'Internship'];
const JOB_LOCATION_OPTIONS=['Remote', 'On-site', 'Hybrid'];
const GOVERNANCE_OPTIONS=[
  {id: 'approved', label: 'Approve Access', hint: 'Enable company team access'},
  {id: 'pending_review', label: 'Move to Review', hint: 'Keep account under manual review'},
  {id: 'suspended', label: 'Suspend Access', hint: 'Temporarily block company users'},
  {id: 'rejected', label: 'Reject Company', hint: 'Permanently reject onboarding'},
];
const USER_VIEW_OPTIONS=[
  {
    id: 'all-candidates',
    label: 'All Candidates',
    hint: 'Load all candidate accounts (up to 200) with status control',
  },
  {
    id: 'skill-based',
    label: 'Skill-Based Segregation',
    hint: 'Filter candidate list by specific skills before loading',
  },
];
const FRAUD_ACTION_OPTIONS=[
  {id: 'view', label: 'View Case Details', hint: 'Open full timeline, candidate snapshot, and evidence trail'},
  {id: 'override', label: 'Override Flag', hint: 'Mark case as reviewed and approved by admin'},
  {id: 'suspend', label: 'Suspend Candidate', hint: 'Suspend candidate access due to integrity concerns'},
  {id: 'reassess', label: 'Request Reassessment', hint: 'Trigger reassessment after manual review'},
];

function AdminDashboard()
{
  const navigate=useNavigate();
  const [user, setUser]=useState(null);
  const [activeTab, setActiveTab]=useState('overview');
  const [loading, setLoading]=useState(true);
  const [refreshing, setRefreshing]=useState(false);

  const [overview, setOverview]=useState({summary: {}, recentGrowth: {}});
  const [analyticsOverview, setAnalyticsOverview]=useState({
    total_companies: 0,
    total_candidates: 0,
    total_jobs: 0,
    total_assessments_completed: 0,
    fraud_flag_rate: 0,
    avg_score: null,
    avg_integrity_score: null,
    completion_rate: 0,
  });
  const [analyticsTrends, setAnalyticsTrends]=useState({
    jobs_created: [],
    candidates_registered: [],
    assessments_completed: [],
    average_scores: [],
    fraud_signals: {
      tab_switch: 0,
      multiple_faces: 0,
      copy_paste: 0,
      suspicious_activity: 0,
    },
  });
  const [users, setUsers]=useState([]);
  const [companies, setCompanies]=useState([]);
  const [jobs, setJobs]=useState([]);
  const [flags, setFlags]=useState([]);
  const [fraudSummary, setFraudSummary]=useState({total: 0, critical: 0, high: 0, medium: 0, low: 0});
  const [fraudCases, setFraudCases]=useState([]);
  const [fraudCompanies, setFraudCompanies]=useState([]);
  const [fraudCompanyFilter, setFraudCompanyFilter]=useState('all');
  const [fraudCenterLoading, setFraudCenterLoading]=useState(false);
  const [aiConfig, setAiConfig]=useState({
    integrityThresholds: {lowRiskMin: 75, mediumRiskMin: 55, criticalMax: 39},
    skillWeightDistribution: {technical: 35, problemSolving: 25, communication: 15, domain: 15, aptitude: 10},
    fraudSensitivityLevel: 'medium',
    aiDifficultyScaling: {entry: 1.0, mid: 1.15, senior: 1.3},
  });
  const [savingAiConfig, setSavingAiConfig]=useState(false);
  const [securityOverview, setSecurityOverview]=useState({
    summary: {
      blockedIpCount: 0,
      suspiciousIpCount: 0,
      repeatedAuthFailureCount: 0,
      abnormalLoginUsers: 0,
      concurrentSessionRiskUsers: 0,
    },
    suspiciousIps: [],
    blockedIps: [],
    abnormalLoginUsers: [],
    concurrentSessionRisks: [],
    recentSecurityEvents: [],
  });
  const [candidateOversight, setCandidateOversight]=useState({
    summary: {totalCandidatesAssessed: 0, totalAssessments: 0, averageOverallScore: 0},
    skillBenchmarks: {technical: 0, problemSolving: 0, communication: 0, domain: 0, aptitude: 0},
    performanceDistribution: {},
    integrityScoreTrend: [],
    anomalyInsights: {lowIntegrityHighScoreCount: 0, highVarianceCandidates: [], repeatedFlaggedCandidates: []},
  });
  const [securityIp, setSecurityIp]=useState('');
  const [securityReason, setSecurityReason]=useState('');
  const [jobContainerFilter, setJobContainerFilter]=useState('all');
  const [jobSearch, setJobSearch]=useState('');
  const [jobStatusFilter, setJobStatusFilter]=useState('all');
  const [jobDepartmentFilter, setJobDepartmentFilter]=useState('all');
  const [jobLocationFilter, setJobLocationFilter]=useState('all');
  const [jobActionLoading, setJobActionLoading]=useState('');
  const [jobEditState, setJobEditState]=useState(null);
  const [jobApplicantsModal, setJobApplicantsModal]=useState({
    open: false,
    loading: false,
    error: '',
    job: null,
    applicants: [],
  });

  const [search, setSearch]=useState('');
  const [statusFilter, setStatusFilter]=useState('all');
  const [userViewMode, setUserViewMode]=useState('');
  const [usersLoading, setUsersLoading]=useState(false);
  const [selectedUserSkills, setSelectedUserSkills]=useState([]);
  const [placementFilter, setPlacementFilter]=useState('all');
  const [candidateSkills, setCandidateSkills]=useState([]);
  const [riskFilter, setRiskFilter]=useState('all');
  const [selectedFraudDetails, setSelectedFraudDetails]=useState(null);
  const [detailsLoading, setDetailsLoading]=useState(false);
  const [selectedSignalType, setSelectedSignalType]=useState('');
  const [selectedSignalLabel, setSelectedSignalLabel]=useState('');
  const [signalStudents, setSignalStudents]=useState([]);
  const [signalStudentsLoading, setSignalStudentsLoading]=useState(false);
  const [signalDrilldownOpen, setSignalDrilldownOpen]=useState(false);
  const [signalTotalStudents, setSignalTotalStudents]=useState(0);
  const [signalTotalEvents, setSignalTotalEvents]=useState(0);
  const [companyActionDrafts, setCompanyActionDrafts]=useState({});
  const [companyActionLoading, setCompanyActionLoading]=useState('');
  const [fraudActionDrafts, setFraudActionDrafts]=useState({});
  const [fraudActionLoading, setFraudActionLoading]=useState('');

  // Announcements state
  const [announcements, setAnnouncements]=useState([]);
  const [announcementsLoading, setAnnouncementsLoading]=useState(false);
  const [announcementForm, setAnnouncementForm]=useState({title: '', message: '', audience: 'all', priority: 'normal'});
  const [announcementSending, setAnnouncementSending]=useState(false);

  // Feature config state
  const [featureConfig, setFeatureConfig]=useState({company: {}, student: {}});
  const [featureConfigLoading, setFeatureConfigLoading]=useState(false);
  const [featureConfigSaving, setFeatureConfigSaving]=useState(false);

  useEffect(() =>
  {
    try
    {
      const stored=localStorage.getItem('user');
      if (!stored)
      {
        navigate('/login');
        return;
      }

      const parsed=JSON.parse(stored);
      if (parsed.role!=='admin')
      {
        navigate('/company-dashboard');
        return;
      }

      setUser(parsed);
      fetchAll(parsed);
    } catch
    {
      navigate('/login');
    }
  }, [navigate]);

  const fetchAll=async () =>
  {
    setLoading(true);
    try
    {
      const [overviewRes, analyticsRes, trendsRes, fraudCenterRes, configRes, securityRes, candidateOversightRes, companiesRes, jobsRes]=await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/analytics/overview').catch(() => ({data: null})),
        api.get('/admin/analytics/trends').catch(() => ({data: null})),
        api.get('/admin/fraud/center', {params: {companyName: fraudCompanyFilter}}).catch(() => ({data: null})),
        api.get('/admin/config/global-ai').catch(() => ({data: null})),
        api.get('/admin/security/overview').catch(() => ({data: null})),
        api.get('/admin/candidates/oversight').catch(() => ({data: null})),
        api.get('/admin/companies'),
        api.get('/admin/jobs'),
      ]);

      setOverview(overviewRes.data||{summary: {}, recentGrowth: {}});
      setAnalyticsOverview(analyticsRes.data||{
        total_companies: 0,
        total_candidates: 0,
        total_jobs: 0,
        total_assessments_completed: 0,
        fraud_flag_rate: 0,
        avg_score: null,
        avg_integrity_score: null,
        completion_rate: 0,
      });
      setAnalyticsTrends(trendsRes.data||{
        jobs_created: [],
        candidates_registered: [],
        assessments_completed: [],
        average_scores: [],
        fraud_signals: {
          tab_switch: 0,
          multiple_faces: 0,
          copy_paste: 0,
          suspicious_activity: 0,
        },
      });
      setFraudSummary(fraudCenterRes.data?.summary||{total: 0, critical: 0, high: 0, medium: 0, low: 0});
      setFraudCases(fraudCenterRes.data?.cases||[]);
      if (fraudCompanyFilter==='all'||fraudCompanies.length===0)
      {
        setFraudCompanies(fraudCenterRes.data?.companies||[]);
      }
      setSecurityOverview(securityRes.data||{
        summary: {
          blockedIpCount: 0,
          suspiciousIpCount: 0,
          repeatedAuthFailureCount: 0,
          abnormalLoginUsers: 0,
          concurrentSessionRiskUsers: 0,
        },
        suspiciousIps: [],
        blockedIps: [],
        abnormalLoginUsers: [],
        concurrentSessionRisks: [],
        recentSecurityEvents: [],
      });
      setCandidateOversight(candidateOversightRes.data||{
        summary: {totalCandidatesAssessed: 0, totalAssessments: 0, averageOverallScore: 0},
        skillBenchmarks: {technical: 0, problemSolving: 0, communication: 0, domain: 0, aptitude: 0},
        performanceDistribution: {},
        integrityScoreTrend: [],
        anomalyInsights: {lowIntegrityHighScoreCount: 0, highVarianceCandidates: [], repeatedFlaggedCandidates: []},
      });
      if (configRes.data?.config)
      {
        setAiConfig({
          integrityThresholds: configRes.data.config.integrityThresholds||{lowRiskMin: 75, mediumRiskMin: 55, criticalMax: 39},
          skillWeightDistribution: configRes.data.config.skillWeightDistribution||{technical: 35, problemSolving: 25, communication: 15, domain: 15, aptitude: 10},
          fraudSensitivityLevel: configRes.data.config.fraudSensitivityLevel||'medium',
          aiDifficultyScaling: configRes.data.config.aiDifficultyScaling||{entry: 1.0, mid: 1.15, senior: 1.3},
        });
      }
      setCompanies(companiesRes.data?.companies||[]);
      setJobs(jobsRes.data?.jobs||[]);
    } catch (err)
    {
      console.error('Admin fetch error:', err);
    } finally
    {
      setLoading(false);
    }
  };

  const fetchFraudCenterData=async (companyName=fraudCompanyFilter) =>
  {
    try
    {
      setFraudCenterLoading(true);
      const res=await api.get('/admin/fraud/center', {params: {companyName}});
      setFraudSummary(res.data?.summary||{total: 0, critical: 0, high: 0, medium: 0, low: 0});
      setFraudCases(res.data?.cases||[]);
      if (companyName==='all'||fraudCompanies.length===0)
      {
        setFraudCompanies(res.data?.companies||[]);
      }
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to fetch company-wise proctoring flags');
    } finally
    {
      setFraudCenterLoading(false);
    }
  };

  const refreshData=async () =>
  {
    setRefreshing(true);
    await fetchAll();
    if (activeTab==='users'&&userViewMode)
    {
      await fetchUsersForManagement(userViewMode, selectedUserSkills);
    }
    setRefreshing(false);
  };

  const handleLogout=() =>
  {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('storage'));
    navigate('/login');
  };

  const handleUserStatus=async (userId, isActive) =>
  {
    try
    {
      await api.patch(`/admin/users/${userId}/status`, {isActive: !isActive});
      setUsers((prev) => prev.map((user) =>
        user.id===userId
          ? {...user, isActive: !isActive}
          : user
      ));

      try
      {
        await fetchUsersForManagement(userViewMode, selectedUserSkills);
      } catch
      {
      }
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to suspend/activate user');
    }
  };

  const fetchUserSkills=async () =>
  {
    try
    {
      const res=await api.get('/admin/users/skills');
      setCandidateSkills(res.data?.skills||[]);
    } catch
    {
      setCandidateSkills([]);
    }
  };

  const fetchUsersForManagement=async (mode=userViewMode, skills=selectedUserSkills) =>
  {
    if (!mode)
    {
      setUsers([]);
      return;
    }

    setUsersLoading(true);
    try
    {
      const params={
        view: mode==='skill-based'? 'skill_based':'all_candidates',
        status: statusFilter,
        placement: placementFilter,
        search: search.trim(),
      };

      if (skills.length)
      {
        params.skills=skills.join(',');
      }

      const res=await api.get('/admin/users', {params});
      setUsers(res.data?.users||[]);
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to load candidate users');
      setUsers([]);
    } finally
    {
      setUsersLoading(false);
    }
  };

  const handleJobStatus=async (jobId, status) =>
  {
    try
    {
      await api.patch(`/admin/jobs/${jobId}/status`, {status});
      await fetchAll();
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to update job status');
    }
  };

  const openJobEdit=(row) =>
  {
    setJobEditState({
      id: row.id,
      title: row.title||'',
      department: row.department||'',
      location: row.location||'Remote',
      type: row.type||'Full-Time',
      status: row.status||'active',
    });
  };

  const closeJobEdit=() => setJobEditState(null);

  const saveJobEdit=async () =>
  {
    if (!jobEditState?.id) return;
    const loadingKey=`edit-${jobEditState.id}`;
    setJobActionLoading(loadingKey);

    try
    {
      await api.patch(`/admin/jobs/${jobEditState.id}`, {
        title: jobEditState.title,
        department: jobEditState.department,
        location: jobEditState.location,
        type: jobEditState.type,
        status: jobEditState.status,
      });
      setJobEditState(null);
      await fetchAll();
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to update job');
    } finally
    {
      setJobActionLoading('');
    }
  };

  const deleteJob=async (jobId, title='this job') =>
  {
    if (!window.confirm(`Delete ${title} and its applications? This action cannot be undone.`)) return;

    const loadingKey=`delete-${jobId}`;
    setJobActionLoading(loadingKey);
    try
    {
      await api.delete(`/admin/jobs/${jobId}`);
      if (jobEditState?.id===jobId) setJobEditState(null);
      await fetchAll();
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to delete job');
    } finally
    {
      setJobActionLoading('');
    }
  };

  const toggleJobActiveStatus=async (row) =>
  {
    const nextStatus=row.status==='active'? 'closed':'active';
    const loadingKey=`toggle-${row.id}`;
    setJobActionLoading(loadingKey);
    try
    {
      await handleJobStatus(row.id, nextStatus);
    } finally
    {
      setJobActionLoading('');
    }
  };

  const viewJobApplicants=async (row) =>
  {
    const loadingKey=`view-${row.id}`;
    setJobActionLoading(loadingKey);
    setJobApplicantsModal({
      open: true,
      loading: true,
      error: '',
      job: {title: row.title, companyName: row.companyName, status: row.status},
      applicants: [],
    });

    try
    {
      const res=await api.get(`/admin/jobs/${row.id}/applicants`);
      setJobApplicantsModal({
        open: true,
        loading: false,
        error: '',
        job: res.data?.job||{title: row.title, companyName: row.companyName, status: row.status},
        applicants: res.data?.applicants||[],
      });
    } catch (err)
    {
      setJobApplicantsModal({
        open: true,
        loading: false,
        error: err.response?.data?.message||'Failed to load applicants',
        job: {title: row.title, companyName: row.companyName, status: row.status},
        applicants: [],
      });
    } finally
    {
      setJobActionLoading('');
    }
  };

  const closeJobApplicantsModal=() =>
  {
    setJobApplicantsModal({open: false, loading: false, error: '', job: null, applicants: []});
  };

  const filteredUsers=useMemo(() => users, [users]);

  useEffect(() =>
  {
    if (activeTab!=='users'||!userViewMode) return;

    const timer=setTimeout(() =>
    {
      fetchUsersForManagement(userViewMode, selectedUserSkills);
    }, 280);

    return () => clearTimeout(timer);
  }, [activeTab, userViewMode, selectedUserSkills, statusFilter, placementFilter, search]);

  useEffect(() =>
  {
    if (activeTab==='users'&&userViewMode&&candidateSkills.length===0)
    {
      fetchUserSkills();
    }
  }, [activeTab, userViewMode, candidateSkills.length]);

  const formatMetric=(value, suffix='') =>
  {
    if (value===null||value===undefined) return 'N/A';
    return `${value}${suffix}`;
  };

  const getTrendMax=(series=[]) => Math.max(1, ...series.map((i) => i.value||0));

  const getJobContainer=(title='', department='') =>
  {
    const text=`${title} ${department}`.toLowerCase();
    if (/data\s*analyst|data\s*science|analytics/.test(text)) return 'data-analyst';
    if (/frontend|web\s*developer|react|ui/.test(text)) return 'web-developer';
    if (/backend|api|node|server/.test(text)) return 'backend-developer';
    if (/devops|platform|cloud|sre/.test(text)) return 'devops';
    if (/qa|quality|test/.test(text)) return 'qa';
    if (/software\s*engineer|full\s*stack|engineer/.test(text)) return 'software-engineer';
    return 'other';
  };

  const buildLinePath=(series, maxValue, width=560, height=180) =>
  {
    if (!series.length) return '';
    const safeMax=Math.max(1, maxValue||1);
    return series.map((point, index) =>
    {
      const x=(index/(Math.max(1, series.length-1)))*width;
      const y=height-((Number(point.value||0)/safeMax)*height);
      return `${index===0? 'M':'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
  };

  const assessmentsSeries=analyticsTrends.assessments_completed||[];
  const averageScoreSeries=analyticsTrends.average_scores||[];
  const maxAssessments=getTrendMax(assessmentsSeries);
  const maxAverageScore=Math.max(100, getTrendMax(averageScoreSeries));
  const assessmentsPath=buildLinePath(assessmentsSeries, maxAssessments);
  const scorePath=buildLinePath(averageScoreSeries, maxAverageScore);

  const fraudSignalEntries=[
    {key: 'tab_switch', label: 'Tab Switch', value: analyticsTrends.fraud_signals.tab_switch||0, color: '#3b82f6'},
    {key: 'multiple_faces', label: 'Multi Face', value: analyticsTrends.fraud_signals.multiple_faces||0, color: '#ef4444'},
    {key: 'copy_paste', label: 'Copy/Paste', value: analyticsTrends.fraud_signals.copy_paste||0, color: '#a855f7'},
    {key: 'suspicious_activity', label: 'AI Pattern', value: analyticsTrends.fraud_signals.suspicious_activity||0, color: '#f59e0b'},
  ];

  const totalFraudSignals=Math.max(1, fraudSignalEntries.reduce((sum, row) => sum+row.value, 0));
  const fraudConic=fraudSignalEntries.reduce((acc, row, index) =>
  {
    const prev=index===0? 0:acc[index-1].end;
    const slice=(row.value/totalFraudSignals)*100;
    const end=prev+slice;
    acc.push({
      color: row.color,
      start: prev,
      end,
    });
    return acc;
  }, []);

  const fraudDonutStyle={
    background: `conic-gradient(${fraudConic.map((s) => `${s.color} ${s.start.toFixed(2)}% ${s.end.toFixed(2)}%`).join(', ')})`,
  };

  const filteredFraudCases=useMemo(() =>
  {
    if (riskFilter==='all') return fraudCases;
    return fraudCases.filter((c) => c.riskLevel===riskFilter);
  }, [fraudCases, riskFilter]);

  useEffect(() =>
  {
    if (!user) return;
    fetchFraudCenterData(fraudCompanyFilter);
  }, [fraudCompanyFilter]);

  const jobsWithContainer=useMemo(() =>
  {
    return jobs.map((job) => ({
      ...job,
      skillContainer: getJobContainer(job.title, job.department),
    }));
  }, [jobs]);

  const jobContainerOptions=useMemo(() =>
  {
    const base=[
      {id: 'all', label: 'All'},
      {id: 'data-analyst', label: 'Data Analyst'},
      {id: 'web-developer', label: 'Web Developer'},
      {id: 'backend-developer', label: 'Backend Developer'},
      {id: 'software-engineer', label: 'Software Engineer'},
      {id: 'devops', label: 'DevOps'},
      {id: 'qa', label: 'QA/Test'},
      {id: 'other', label: 'Other'},
    ];

    return base.map((item) => ({
      ...item,
      count: item.id==='all'
        ? jobsWithContainer.length
        : jobsWithContainer.filter((row) => row.skillContainer===item.id).length,
    }));
  }, [jobsWithContainer]);

  const jobDepartmentOptions=useMemo(() =>
  {
    const values=[...new Set(jobsWithContainer
      .map((row) => (row.department||'').trim())
      .filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [{id: 'all', label: 'All Departments'}, ...values.map((value) => ({id: value, label: value}))];
  }, [jobsWithContainer]);

  const jobLocationOptions=useMemo(() =>
  {
    const values=[...new Set(jobsWithContainer
      .map((row) => (row.location||'').trim())
      .filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [{id: 'all', label: 'All Locations'}, ...values.map((value) => ({id: value, label: value}))];
  }, [jobsWithContainer]);

  const filteredJobs=useMemo(() =>
  {
    const q=jobSearch.trim().toLowerCase();
    return jobsWithContainer.filter((row) =>
    {
      if (jobContainerFilter!=='all'&&row.skillContainer!==jobContainerFilter) return false;
      if (jobStatusFilter!=='all'&&row.status!==jobStatusFilter) return false;
      if (jobDepartmentFilter!=='all'&&row.department!==jobDepartmentFilter) return false;
      if (jobLocationFilter!=='all'&&row.location!==jobLocationFilter) return false;
      if (!q) return true;
      return (
        row.title?.toLowerCase().includes(q)
        ||row.companyName?.toLowerCase().includes(q)
        ||row.department?.toLowerCase().includes(q)
        ||row.location?.toLowerCase().includes(q)
      );
    });
  }, [jobsWithContainer, jobContainerFilter, jobSearch, jobStatusFilter, jobDepartmentFilter, jobLocationFilter]);

  const filteredJobStatusCounts=useMemo(() =>
  {
    return {
      total: filteredJobs.length,
      active: filteredJobs.filter((job) => job.status==='active').length,
      closed: filteredJobs.filter((job) => job.status==='closed').length,
      draft: filteredJobs.filter((job) => job.status==='draft').length,
      paused: filteredJobs.filter((job) => job.status==='paused').length,
    };
  }, [filteredJobs]);

  const overviewJobStatusMix=useMemo(() =>
  {
    const total=Math.max(1, jobs.length);
    const counts={
      active: jobs.filter((job) => job.status==='active').length,
      paused: jobs.filter((job) => job.status==='paused').length,
      closed: jobs.filter((job) => job.status==='closed').length,
      draft: jobs.filter((job) => job.status==='draft').length,
    };

    return [
      {id: 'active', label: 'Active', value: counts.active, color: '#22c55e'},
      {id: 'paused', label: 'Paused', value: counts.paused, color: '#ef4444'},
      {id: 'closed', label: 'Closed', value: counts.closed, color: '#94a3b8'},
      {id: 'draft', label: 'Draft', value: counts.draft, color: '#f59e0b'},
    ].map((row) => ({
      ...row,
      pct: Number(((row.value/total)*100).toFixed(1)),
    }));
  }, [jobs]);

  const overviewDepartmentMix=useMemo(() =>
  {
    const map=new Map();
    for (const job of jobs)
    {
      const key=(job.department||'General').trim()||'General';
      map.set(key, (map.get(key)||0)+1);
    }

    const rows=[...map.entries()]
      .map(([label, value]) => ({label, value}))
      .sort((a, b) => b.value-a.value)
      .slice(0, 6);

    return {
      rows,
      max: Math.max(1, ...rows.map((item) => item.value)),
      total: rows.reduce((sum, item) => sum+item.value, 0),
    };
  }, [jobs]);

  const overviewHiringFunnel=useMemo(() =>
  {
    const totals=companies.reduce((acc, row) =>
    {
      acc.totalJobs+=Number(row.totalJobs||0);
      acc.activeJobs+=Number(row.activeJobs||0);
      acc.inInterview+=Number(row.hiringActivity?.inInterview||0);
      acc.offered+=Number(row.hiringActivity?.offered||0);
      acc.hired+=Number(row.hiringActivity?.hired||0);
      return acc;
    }, {
      totalJobs: 0,
      activeJobs: 0,
      inInterview: 0,
      offered: 0,
      hired: 0,
    });

    const base=Math.max(1, totals.totalJobs);
    return [
      {id: 'jobs', label: 'Open Pipeline', value: totals.activeJobs, color: '#60a5fa'},
      {id: 'interview', label: 'In Interview', value: totals.inInterview, color: '#a78bfa'},
      {id: 'offer', label: 'Offers', value: totals.offered, color: '#f59e0b'},
      {id: 'hired', label: 'Hired', value: totals.hired, color: '#22c55e'},
    ].map((row) => ({
      ...row,
      pct: Number(((row.value/base)*100).toFixed(1)),
    }));
  }, [companies]);

  const handleFraudAction=async (action, proctoringId) =>
  {
    try
    {
      if (action==='override')
      {
        await api.patch(`/admin/fraud/${proctoringId}/override`, {note: 'Reviewed and approved by admin'});
      }
      if (action==='suspend')
      {
        await api.post(`/admin/fraud/${proctoringId}/suspend`, {reason: 'Suspended due to integrity risk after admin review'});
      }
      if (action==='reassess')
      {
        await api.post(`/admin/fraud/${proctoringId}/reassess`, {reason: 'Admin requested reassessment'});
      }
      await fetchAll();
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to perform fraud action');
    }
  };

  const openFraudDetails=async (proctoringId) =>
  {
    try
    {
      setDetailsLoading(true);
      const res=await api.get(`/admin/fraud/${proctoringId}/details`);
      setSelectedFraudDetails(res.data||null);
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to load fraud case details');
    } finally
    {
      setDetailsLoading(false);
    }
  };

  const closeFraudDetails=() => setSelectedFraudDetails(null);

  const handleCompanyGovernance=async (companyName, status) =>
  {
    try
    {
      const notes=window.prompt(`Add governance note for ${companyName} (${status})`, '')||'';
      await api.patch('/admin/companies/governance', {companyName, status, notes});
      await fetchAll();
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to update company governance');
    }
  };

  const getGovernanceMeta=(status='pending_review') =>
  {
    const found=GOVERNANCE_OPTIONS.find((option) => option.id===status);
    if (found) return found;
    return GOVERNANCE_OPTIONS.find((option) => option.id==='pending_review');
  };

  const getGovernancePillClass=(status='pending_review') =>
  {
    if (status==='approved') return 'ok';
    if (status==='pending_review') return 'muted';
    return 'warn';
  };

  const getCompanyActionSelection=(companyName, fallbackStatus='pending_review') =>
    companyActionDrafts[companyName]||fallbackStatus||'pending_review';

  const updateCompanyActionDraft=(companyName, status) =>
  {
    setCompanyActionDrafts((prev) => ({
      ...prev,
      [companyName]: status,
    }));
  };

  const applyCompanyAction=async (row) =>
  {
    const selectedStatus=getCompanyActionSelection(row.companyName, row.governanceStatus);
    const loadingKey=`${row.companyName}-${selectedStatus}`;
    setCompanyActionLoading(loadingKey);
    try
    {
      await handleCompanyGovernance(row.companyName, selectedStatus);
      setCompanyActionDrafts((prev) =>
      {
        const next={...prev};
        delete next[row.companyName];
        return next;
      });
    } finally
    {
      setCompanyActionLoading('');
    }
  };

  const getFraudActionMeta=(action='view') =>
  {
    const found=FRAUD_ACTION_OPTIONS.find((option) => option.id===action);
    if (found) return found;
    return FRAUD_ACTION_OPTIONS.find((option) => option.id==='view');
  };

  const getFraudActionSelection=(proctoringId) => fraudActionDrafts[proctoringId]||'view';

  const updateFraudActionDraft=(proctoringId, action) =>
  {
    setFraudActionDrafts((prev) => ({
      ...prev,
      [proctoringId]: action,
    }));
  };

  const applyFraudAction=async (row) =>
  {
    const selectedAction=getFraudActionSelection(row.proctoringId);
    const loadingKey=`${row.proctoringId}-${selectedAction}`;
    setFraudActionLoading(loadingKey);

    try
    {
      if (selectedAction==='view')
      {
        await openFraudDetails(row.proctoringId);
      } else
      {
        await handleFraudAction(selectedAction, row.proctoringId);
      }

      setFraudActionDrafts((prev) =>
      {
        const next={...prev};
        delete next[row.proctoringId];
        return next;
      });
    } finally
    {
      setFraudActionLoading('');
    }
  };

  const handleSaveGlobalConfig=async () =>
  {
    try
    {
      setSavingAiConfig(true);
      await api.put('/admin/config/global-ai', aiConfig);
      await fetchAll();
      alert('Global AI configuration updated successfully');
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to update global AI configuration');
    } finally
    {
      setSavingAiConfig(false);
    }
  };

  const handleSignalDrilldown=async (signalType, signalLabel) =>
  {
    try
    {
      setSelectedSignalType(signalType);
      setSelectedSignalLabel(signalLabel);
      setSignalDrilldownOpen(true);
      setSignalStudentsLoading(true);
      const res=await api.get(`/admin/analytics/fraud-signals/${signalType}/students`);
      setSignalStudents(res.data?.students||[]);
      setSignalTotalStudents(res.data?.totalStudents||0);
      setSignalTotalEvents(res.data?.totalSignalEvents||0);
    } catch (err)
    {
      setSignalStudents([]);
      setSignalTotalStudents(0);
      setSignalTotalEvents(0);
      alert(err.response?.data?.message||'Failed to load signal student list');
    } finally
    {
      setSignalStudentsLoading(false);
    }
  };

  const closeSignalDrilldown=() =>
  {
    setSignalDrilldownOpen(false);
  };

  const handleBlockIp=async () =>
  {
    try
    {
      if (!securityIp.trim())
      {
        alert('Enter an IP address');
        return;
      }
      await api.post('/admin/security/block-ip', {
        ip: securityIp.trim(),
        reason: securityReason.trim()||'Blocked by admin security monitoring',
      });
      setSecurityIp('');
      setSecurityReason('');
      await fetchAll();
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to block IP');
    }
  };

  const handleUnblockIp=async (ip) =>
  {
    try
    {
      await api.post('/admin/security/unblock-ip', {ip});
      await fetchAll();
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to unblock IP');
    }
  };

  const handleForceLogout=async (userId) =>
  {
    try
    {
      await api.post('/admin/security/force-logout', {userId, reason: 'Concurrent session risk'});
      await fetchAll();
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to force logout user');
    }
  };

  const handleSecuritySuspend=async (userId) =>
  {
    try
    {
      await api.post('/admin/security/suspend-account', {userId, reason: 'Suspicious behavior detected by security center'});
      await fetchAll();
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to suspend user');
    }
  };

  const downloadTextFile=(filename, content, mime='text/plain;charset=utf-8') =>
  {
    const blob=new Blob([content], {type: mime});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportTimelineJSON=() =>
  {
    if (!selectedFraudDetails) return;
    const payload={
      case: selectedFraudDetails.case,
      candidateProfile: selectedFraudDetails.candidateProfile,
      interview: selectedFraudDetails.interview,
      timeline: selectedFraudDetails.timeline||[],
      exportedAt: new Date().toISOString(),
    };
    const name=`fraud-timeline-${selectedFraudDetails.case?.proctoringId||'case'}.json`;
    downloadTextFile(name, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  };

  const handleExportTimelineCSV=() =>
  {
    if (!selectedFraudDetails) return;
    const timeline=selectedFraudDetails.timeline||[];
    const esc=(value) =>
    {
      const s=String(value??'');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const headers=['timestamp', 'event_type', 'severity', 'description', 'metadata_json'];
    const rows=timeline.map((evt) => [
      evt.timestamp,
      evt.eventType,
      evt.severity,
      evt.description||'',
      JSON.stringify(evt.metadata||{}),
    ]);

    const csv=[headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const name=`fraud-timeline-${selectedFraudDetails.case?.proctoringId||'case'}.csv`;
    downloadTextFile(name, csv, 'text/csv;charset=utf-8');
  };

  const handleExportCandidateOversightJSON=() =>
  {
    const payload={
      exportedAt: new Date().toISOString(),
      ...candidateOversight,
    };
    downloadTextFile('candidate-oversight.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  };

  const handleExportCandidateOversightCSV=() =>
  {
    const esc=(value) =>
    {
      const s=String(value??'');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines=[];
    lines.push(['metric', 'value'].join(','));
    lines.push(['total_candidates_assessed', candidateOversight.summary?.totalCandidatesAssessed||0].map(esc).join(','));
    lines.push(['total_assessments', candidateOversight.summary?.totalAssessments||0].map(esc).join(','));
    lines.push(['average_overall_score', candidateOversight.summary?.averageOverallScore||0].map(esc).join(','));
    lines.push(['low_integrity_high_score_count', candidateOversight.anomalyInsights?.lowIntegrityHighScoreCount||0].map(esc).join(','));

    lines.push('');
    lines.push(['skill_benchmark', 'score'].join(','));
    lines.push(['technical', candidateOversight.skillBenchmarks?.technical||0].map(esc).join(','));
    lines.push(['problem_solving', candidateOversight.skillBenchmarks?.problemSolving||0].map(esc).join(','));
    lines.push(['communication', candidateOversight.skillBenchmarks?.communication||0].map(esc).join(','));
    lines.push(['domain', candidateOversight.skillBenchmarks?.domain||0].map(esc).join(','));
    lines.push(['aptitude', candidateOversight.skillBenchmarks?.aptitude||0].map(esc).join(','));

    lines.push('');
    lines.push(['distribution_band', 'count', 'pct'].join(','));
    lines.push(['below40', candidateOversight.performanceDistribution?.below40?.count||0, candidateOversight.performanceDistribution?.below40?.pct||0].map(esc).join(','));
    lines.push(['between40And59', candidateOversight.performanceDistribution?.between40And59?.count||0, candidateOversight.performanceDistribution?.between40And59?.pct||0].map(esc).join(','));
    lines.push(['between60And79', candidateOversight.performanceDistribution?.between60And79?.count||0, candidateOversight.performanceDistribution?.between60And79?.pct||0].map(esc).join(','));
    lines.push(['atLeast80', candidateOversight.performanceDistribution?.atLeast80?.count||0, candidateOversight.performanceDistribution?.atLeast80?.pct||0].map(esc).join(','));

    lines.push('');
    lines.push(['integrity_day', 'integrity_value'].join(','));
    (candidateOversight.integrityScoreTrend||[]).forEach((row) =>
    {
      lines.push([row.day, row.value||0].map(esc).join(','));
    });

    downloadTextFile('candidate-oversight.csv', lines.join('\n'), 'text/csv;charset=utf-8');
  };

  /* ── Announcements ── */
  const fetchAnnouncements=async () =>
  {
    try
    {
      setAnnouncementsLoading(true);
      const res=await api.get('/announcements?limit=50');
      if (res.data?.success) setAnnouncements(res.data.data||[]);
    } catch (err)
    {
      console.error('[ADMIN] Failed to fetch announcements:', err.message);
    } finally
    {
      setAnnouncementsLoading(false);
    }
  };

  useEffect(() =>
  {
    if (activeTab==='announcements') fetchAnnouncements();
    if (activeTab==='features') fetchFeatureConfig();
  }, [activeTab]);

  /* ── Feature Config CRUD ───────────────────────────────────── */
  const fetchFeatureConfig=async () =>
  {
    try
    {
      setFeatureConfigLoading(true);
      const res=await api.get('/feature-config');
      if (res.data?.success)
      {
        setFeatureConfig({company: res.data.company||{}, student: res.data.student||{}});
      }
    } catch (err)
    {
      console.error('[ADMIN] Failed to fetch feature config:', err.message);
    } finally
    {
      setFeatureConfigLoading(false);
    }
  };

  const handleFeatureToggle=(role, featureId) =>
  {
    setFeatureConfig(prev =>
    {
      const current=prev[role]||{};
      const isCurrentlyEnabled=current[featureId]!==false;
      return {
        ...prev,
        [role]: {...current, [featureId]: !isCurrentlyEnabled},
      };
    });
  };

  const handleSaveFeatureConfig=async () =>
  {
    try
    {
      setFeatureConfigSaving(true);
      await api.put('/feature-config', featureConfig);
      alert('Feature configuration saved successfully!');
    } catch (err)
    {
      console.error('[ADMIN] Failed to save feature config:', err.message);
      alert('Failed to save feature configuration');
    } finally
    {
      setFeatureConfigSaving(false);
    }
  };

  const handleResetRole=(role) =>
  {
    setFeatureConfig(prev => ({...prev, [role]: {}}));
  };

  const handleCreateAnnouncement=async () =>
  {
    if (!announcementForm.title.trim()||!announcementForm.message.trim()) return;
    try
    {
      setAnnouncementSending(true);
      const res=await api.post('/announcements', announcementForm);
      if (res.data?.success)
      {
        setAnnouncementForm({title: '', message: '', audience: 'all', priority: 'normal'});
        fetchAnnouncements();
      }
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to create announcement');
    } finally
    {
      setAnnouncementSending(false);
    }
  };

  const handleDeleteAnnouncement=async (id) =>
  {
    if (!confirm('Delete this announcement?')) return;
    try
    {
      await api.delete(`/announcements/${id}`);
      setAnnouncements((prev) => prev.filter((a) => a._id!==id));
    } catch (err)
    {
      alert('Failed to delete announcement');
    }
  };

  if (!user) return null;

  return (
    <div className="adm-page">
      <nav className="adm-navbar">
        <div className="adm-navbar-inner">
          <Link to="/admin-dashboard" className="adm-logo"><BrandLogo /></Link>
          <div className="adm-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`adm-tab ${activeTab===tab.id? 'active':''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <div className="adm-actions">
            <button className="adm-icon-btn" onClick={refreshData} title="Refresh">
              <RefreshCw size={16} className={refreshing? 'spinning':''} />
            </button>
            <NotificationBell />
            <button className="adm-icon-btn" onClick={handleLogout} title="Logout"><LogOut size={16} /></button>
            <div className="adm-avatar">{(user.username||'A').charAt(0).toUpperCase()}</div>
          </div>
        </div>
      </nav>

      <main className="adm-main">
        {loading? (
          <div className="adm-loading">Loading admin dashboard...</div>
        ):(
          <div className="adm-container">
            {activeTab==='overview'&&(
              <section>
                <div className="adm-hero-panel">
                  <div>
                    <h1>Admin Dashboard</h1>
                    <p className="adm-subtitle">Full control across candidates, companies, jobs, and proctoring risk.</p>
                  </div>
                  <div className="adm-hero-badges">
                    <span className="adm-pill ok">Completion {formatMetric(analyticsOverview.completion_rate, '%')}</span>
                    <span className={`adm-pill ${Number(analyticsOverview.fraud_flag_rate||0)>20? 'warn':'ok'}`}>Fraud Flag {formatMetric(analyticsOverview.fraud_flag_rate, '%')}</span>
                    <span className="adm-pill">Integrity {formatMetric(analyticsOverview.avg_integrity_score)}</span>
                  </div>
                </div>

                <div className="adm-overview-split">
                  <div className="adm-overview-data">
                    <h2 style={{marginTop: '0.95rem'}}>Core Metrics</h2>

                    <div className="adm-kpi-grid adm-kpi-grid-quad">
                      <div className="adm-kpi-card"><span>Total Users</span><strong>{overview.summary.totalUsers||0}</strong></div>
                      <div className="adm-kpi-card"><span>Active Users</span><strong>{overview.summary.activeUsers||0}</strong></div>
                      <div className="adm-kpi-card"><span>Companies</span><strong>{overview.summary.totalCompanies?? analyticsOverview.total_companies?? 0}</strong></div>
                      <div className="adm-kpi-card"><span>Candidates</span><strong>{overview.summary.candidates||0}</strong></div>
                      <div className="adm-kpi-card"><span>Active Jobs</span><strong>{overview.summary.activeJobs||0}</strong></div>
                      <div className="adm-kpi-card"><span>Applications</span><strong>{overview.summary.totalApplications||0}</strong></div>
                      <div className="adm-kpi-card"><span>Interviews</span><strong>{overview.summary.totalInterviews||0}</strong></div>
                      <div className="adm-kpi-card"><span>Flagged Sessions</span><strong>{overview.summary.flaggedProctoring||0}</strong></div>
                    </div>

                    <div className="adm-growth-row">
                      <div className="adm-panel"><h3>Users (7d)</h3><strong>{overview.recentGrowth.users7d||0}</strong></div>
                      <div className="adm-panel"><h3>Jobs (7d)</h3><strong>{overview.recentGrowth.jobs7d||0}</strong></div>
                      <div className="adm-panel"><h3>Applications (7d)</h3><strong>{overview.recentGrowth.applications7d||0}</strong></div>
                    </div>

                    <h2 style={{marginTop: '0.95rem'}}>Analytics Overview</h2>
                    <div className="adm-kpi-grid adm-kpi-grid-quad">
                      <div className="adm-kpi-card"><span>Total Companies</span><strong>{analyticsOverview.total_companies||0}</strong></div>
                      <div className="adm-kpi-card"><span>Total Candidates</span><strong>{analyticsOverview.total_candidates||0}</strong></div>
                      <div className="adm-kpi-card"><span>Total Jobs</span><strong>{analyticsOverview.total_jobs||0}</strong></div>
                      <div className="adm-kpi-card"><span>Assessments Completed</span><strong>{analyticsOverview.total_assessments_completed||0}</strong></div>
                      <div className="adm-kpi-card"><span>Fraud Flag Rate</span><strong>{formatMetric(analyticsOverview.fraud_flag_rate, '%')}</strong></div>
                      <div className="adm-kpi-card"><span>Average Score</span><strong>{formatMetric(analyticsOverview.avg_score)}</strong></div>
                      <div className="adm-kpi-card"><span>Avg Integrity Score</span><strong>{formatMetric(analyticsOverview.avg_integrity_score)}</strong></div>
                      <div className="adm-kpi-card"><span>Completion Rate</span><strong>{formatMetric(analyticsOverview.completion_rate, '%')}</strong></div>
                    </div>

                    <div className="adm-growth-row" style={{marginTop: '0.65rem'}}>
                      <div className="adm-panel">
                        <h3>Assessments Completed (7d)</h3>
                        <div className="adm-trend-bars">
                          {analyticsTrends.assessments_completed.map((item) => (
                            <div key={item.day} className="adm-trend-row">
                              <span>{item.day.slice(5)}</span>
                              <div className="adm-trend-track"><div className="adm-trend-fill" style={{width: `${(item.value/getTrendMax(analyticsTrends.assessments_completed))*100}%`}} /></div>
                              <strong>{item.value}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="adm-panel">
                        <h3>Average Score Trend (7d)</h3>
                        <div className="adm-trend-bars">
                          {analyticsTrends.average_scores.map((item) => (
                            <div key={item.day} className="adm-trend-row">
                              <span>{item.day.slice(5)}</span>
                              <div className="adm-trend-track"><div className="adm-trend-fill" style={{width: `${Math.min(100, item.value||0)}%`}} /></div>
                              <strong>{item.value||0}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="adm-panel">
                        <h3>Fraud Signal Distribution</h3>
                        <div className="adm-signal-list">
                          <button className={`adm-signal-item adm-signal-btn ${selectedSignalType==='tab_switch'? 'active':''}`} onClick={() => handleSignalDrilldown('tab_switch', 'Tab Switch')}>
                            <span>Tab Switch</span><strong>{analyticsTrends.fraud_signals.tab_switch||0}</strong>
                          </button>
                          <button className={`adm-signal-item adm-signal-btn ${selectedSignalType==='multiple_faces'? 'active':''}`} onClick={() => handleSignalDrilldown('multiple_faces', 'Multi Face')}>
                            <span>Multi Face</span><strong>{analyticsTrends.fraud_signals.multiple_faces||0}</strong>
                          </button>
                          <button className={`adm-signal-item adm-signal-btn ${selectedSignalType==='copy_paste'? 'active':''}`} onClick={() => handleSignalDrilldown('copy_paste', 'Copy/Paste')}>
                            <span>Copy/Paste</span><strong>{analyticsTrends.fraud_signals.copy_paste||0}</strong>
                          </button>
                          <button className={`adm-signal-item adm-signal-btn ${selectedSignalType==='suspicious_activity'? 'active':''}`} onClick={() => handleSignalDrilldown('suspicious_activity', 'AI Pattern')}>
                            <span>AI Pattern</span><strong>{analyticsTrends.fraud_signals.suspicious_activity||0}</strong>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="adm-growth-row" style={{marginTop: '0.65rem'}}>
                      <div className="adm-panel">
                        <h3>Platform Health Snapshot</h3>
                        <div className="adm-health-list">
                          <div className="adm-health-item">
                            <div><span>Assessment Completion</span><strong>{formatMetric(analyticsOverview.completion_rate, '%')}</strong></div>
                            <div className="adm-health-track"><div className="adm-health-fill" style={{width: `${Math.min(100, Number(analyticsOverview.completion_rate||0))}%`}} /></div>
                          </div>
                          <div className="adm-health-item">
                            <div><span>Average Score</span><strong>{formatMetric(analyticsOverview.avg_score)}</strong></div>
                            <div className="adm-health-track"><div className="adm-health-fill purple" style={{width: `${Math.min(100, Number(analyticsOverview.avg_score||0))}%`}} /></div>
                          </div>
                          <div className="adm-health-item">
                            <div><span>Integrity Score</span><strong>{formatMetric(analyticsOverview.avg_integrity_score)}</strong></div>
                            <div className="adm-health-track"><div className="adm-health-fill green" style={{width: `${Math.min(100, Number(analyticsOverview.avg_integrity_score||0))}%`}} /></div>
                          </div>
                        </div>
                      </div>

                      <div className="adm-panel">
                        <h3>Job Status Mix</h3>
                        <div className="adm-signal-list">
                          {overviewJobStatusMix.map((row) => (
                            <div key={row.id} className="adm-insight-row">
                              <div className="adm-insight-head">
                                <span>{row.label}</span>
                                <strong>{row.value} · {row.pct}%</strong>
                              </div>
                              <div className="adm-insight-track">
                                <div className="adm-insight-fill" style={{width: `${Math.min(100, row.pct)}%`, background: row.color}} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="adm-panel">
                        <h3>Hiring Funnel Efficiency</h3>
                        <div className="adm-signal-list">
                          {overviewHiringFunnel.map((row) => (
                            <div key={row.id} className="adm-insight-row compact">
                              <div className="adm-insight-head">
                                <span>{row.label}</span>
                                <strong>{row.value}</strong>
                              </div>
                              <div className="adm-insight-track">
                                <div className="adm-insight-fill" style={{width: `${Math.min(100, row.pct)}%`, background: row.color}} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="adm-overview-visuals">
                    <h2 style={{marginTop: '0.95rem'}}>Graphical Analytics</h2>

                    <div className="adm-panel adm-chart-panel" style={{marginTop: '0.55rem'}}>
                      <h3>Assessment Throughput vs Average Score</h3>
                      <div className="adm-chart-legend">
                        <span><i className="adm-dot blue" /> Assessments</span>
                        <span><i className="adm-dot purple" /> Average Score</span>
                      </div>
                      <svg viewBox="0 0 560 180" className="adm-line-chart" role="img" aria-label="Assessments and average score trend">
                        <defs>
                          <linearGradient id="admAssessGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#60a5fa" />
                          </linearGradient>
                          <linearGradient id="admScoreGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#a855f7" />
                            <stop offset="100%" stopColor="#c084fc" />
                          </linearGradient>
                        </defs>
                        {[0, 1, 2, 3].map((step) => (
                          <line key={step} x1="0" y1={step*60} x2="560" y2={step*60} className="adm-grid-line" />
                        ))}
                        {assessmentsPath&&<path d={assessmentsPath} fill="none" stroke="url(#admAssessGradient)" strokeWidth="3" strokeLinecap="round" />}
                        {scorePath&&<path d={scorePath} fill="none" stroke="url(#admScoreGradient)" strokeWidth="3" strokeLinecap="round" />}
                      </svg>
                      <div className="adm-chart-label-row">
                        {assessmentsSeries.map((item) => <span key={item.day}>{item.day.slice(5)}</span>)}
                      </div>
                    </div>

                    <div className="adm-panel adm-chart-panel" style={{marginTop: '0.65rem'}}>
                      <h3>Fraud Signal Mix</h3>
                      <div className="adm-donut-wrap">
                        <div className="adm-donut" style={fraudDonutStyle}>
                          <div className="adm-donut-inner">
                            <strong>{fraudSignalEntries.reduce((sum, row) => sum+row.value, 0)}</strong>
                            <span>Signals</span>
                          </div>
                        </div>
                        <div className="adm-chart-legend-list">
                          {fraudSignalEntries.map((row) => (
                            <div key={row.key} className="adm-legend-item">
                              <span><i className="adm-dot" style={{background: row.color}} />{row.label}</span>
                              <strong>{row.value}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="adm-panel" style={{marginTop: '0.65rem'}}>
                      <h3>Top Department Demand</h3>
                      <div className="adm-signal-list">
                        {overviewDepartmentMix.rows.map((row) => (
                          <div key={row.label} className="adm-insight-row">
                            <div className="adm-insight-head">
                              <span>{row.label}</span>
                              <strong>{row.value}</strong>
                            </div>
                            <div className="adm-insight-track">
                              <div className="adm-insight-fill gradient" style={{width: `${(row.value/overviewDepartmentMix.max)*100}%`}} />
                            </div>
                          </div>
                        ))}
                        {overviewDepartmentMix.rows.length===0&&<p className="adm-subtitle">No department data available.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab==='users'&&(
              <section>
                <h2>Candidate Management</h2>
                <p className="adm-subtitle">Choose a viewing mode first to protect performance and load only the candidate dataset you need.</p>

                <div className="adm-user-mode-grid">
                  {USER_VIEW_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      className={`adm-user-mode-card ${userViewMode===option.id? 'active':''}`}
                      onClick={() =>
                      {
                        setUserViewMode(option.id);
                        setSearch('');
                        setStatusFilter('all');
                        setPlacementFilter('all');
                        setSelectedUserSkills([]);
                        if (option.id==='all-candidates')
                        {
                          setSelectedUserSkills([]);
                        }
                      }}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.hint}</span>
                    </button>
                  ))}
                </div>

                {!userViewMode&&(
                  <div className="adm-panel" style={{marginTop: '0.65rem'}}>
                    <h3>Select a candidate view mode</h3>
                    <p className="adm-subtitle">No candidate records are loaded until you choose a mode.</p>
                  </div>
                )}

                {userViewMode&&(
                  <>
                <div className="adm-filter-row">
                  <div className="adm-search"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by username/email/company" /></div>
                  <div className="adm-select-wrap"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select></div>
                  <div className="adm-select-wrap"><select value={placementFilter} onChange={(e) => setPlacementFilter(e.target.value)}>
                    <option value="all">All Placement</option>
                    <option value="placed">Placed</option>
                    <option value="unplaced">Unplaced</option>
                  </select></div>
                </div>

                {candidateSkills.length>0&&(
                  <div className="adm-skill-bubbles-wrap">
                    <span className="adm-skill-bubbles-label">Filter by skill:</span>
                    <div className="adm-skill-bubbles">
                      {candidateSkills.map((skill) => (
                        <button
                          key={skill.id}
                          className={`adm-skill-bubble ${selectedUserSkills.includes(skill.label)? 'active':''}`}
                          onClick={() =>
                          {
                            setSelectedUserSkills((prev) =>
                              prev.includes(skill.label)
                                ? prev.filter((s) => s!==skill.label)
                                : [...prev, skill.label]
                            );
                          }}
                        >
                          {skill.label}
                          <span className="adm-skill-bubble-count">{skill.count}</span>
                        </button>
                      ))}
                    </div>
                    {selectedUserSkills.length>0&&(
                      <button className="adm-skill-clear-btn" onClick={() => setSelectedUserSkills([])}>Clear all filters</button>
                    )}
                  </div>
                )}

                <div className="adm-kpi-grid" style={{marginBottom: '0.8rem'}}>
                  <div className="adm-kpi-card"><span>Loaded Candidates</span><strong>{filteredUsers.length}</strong></div>
                  <div className="adm-kpi-card"><span>Active</span><strong>{filteredUsers.filter((row) => row.isActive).length}</strong></div>
                  <div className="adm-kpi-card"><span>Suspended</span><strong>{filteredUsers.filter((row) => !row.isActive).length}</strong></div>
                  <div className="adm-kpi-card"><span>Placed</span><strong>{filteredUsers.filter((row) => row.isPlaced).length}</strong></div>
                  <div className="adm-kpi-card"><span>Unplaced</span><strong>{filteredUsers.filter((row) => !row.isPlaced).length}</strong></div>
                  <div className="adm-kpi-card"><span>View Type</span><strong>{userViewMode==='skill-based'? 'Skill-Based':'All Candidates'}</strong></div>
                </div>

                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead><tr><th>Candidate</th><th>Company</th><th>Top Skills</th><th>Account</th><th>Placement</th><th>Action</th></tr></thead>
                    <tbody>
                      {usersLoading&&(
                        <tr><td colSpan="6">Loading candidates...</td></tr>
                      )}
                      {!usersLoading&&filteredUsers.length===0&&(
                        <tr><td colSpan="6">No candidates found for the selected filters.</td></tr>
                      )}
                      {!usersLoading&&filteredUsers.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div className="adm-user-cell">
                              <strong>{row.username}</strong>
                              <span>{row.email}</span>
                            </div>
                          </td>
                          <td>{row.companyName||'-'}</td>
                          <td>
                            <div className="adm-chip-wrap">
                              {(row.skills||[]).slice(0, 3).map((skill) => (
                                <span key={`${row.id}-${skill}`} className="adm-chip">{skill}</span>
                              ))}
                              {(!row.skills||row.skills.length===0)&&<span className="adm-subtitle">No skills</span>}
                            </div>
                          </td>
                          <td><span className={`adm-pill ${row.isActive? 'ok':'warn'}`}>{row.isActive? 'Active':'Suspended'}</span></td>
                          <td><span className={`adm-pill ${row.isPlaced? 'ok':'muted'}`}>{row.isPlaced? 'Placed':'Unplaced'}</span></td>
                          <td><button className="adm-link-btn" onClick={() => handleUserStatus(row.id, row.isActive)}>{row.isActive? 'Suspend':'Activate'}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                  </>
                )}
              </section>
            )}

            {activeTab==='companies'&&(
              <section>
                <h2>Company Verification & Governance Panel</h2>
                <p className="adm-subtitle">Review companies, enforce platform policy, and control organization access.</p>

                <div className="adm-panel" style={{marginTop: '0.65rem', marginBottom: '0.65rem'}}>
                  <h3>Action Guide</h3>
                  <div className="adm-company-guide-grid">
                    {GOVERNANCE_OPTIONS.map((option) => (
                      <div key={option.id} className="adm-company-guide-item">
                        <strong>{option.label}</strong>
                        <span>{option.hint}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead><tr><th>Company</th><th>Status</th><th>Users</th><th>Jobs</th><th>Fraud Rate</th><th>Hiring Activity</th><th>Actions</th></tr></thead>
                    <tbody>
                      {companies.map((row) =>
                      {
                        const status=row.governanceStatus||'pending_review';
                        const statusMeta=getGovernanceMeta(status);
                        const selectedAction=getCompanyActionSelection(row.companyName, status);
                        const selectedMeta=getGovernanceMeta(selectedAction);
                        const loadingKey=`${row.companyName}-${selectedAction}`;

                        return (
                          <tr key={row.companyName}>
                            <td>{row.companyName}</td>
                            <td><span className={`adm-pill ${getGovernancePillClass(status)}`}>{statusMeta.label}</span></td>
                            <td>{row.activeUserCount}/{row.userCount}</td>
                            <td>{row.activeJobs}/{row.totalJobs}</td>
                            <td>{row.fraudRate||0}%</td>
                            <td>
                              <div className="adm-user-cell">
                                <span>Interview: {row.hiringActivity?.inInterview||0}</span>
                                <span>Offered: {row.hiringActivity?.offered||0} · Hired: {row.hiringActivity?.hired||0}</span>
                              </div>
                            </td>
                            <td>
                              <div className="adm-company-actions">
                                <select
                                  value={selectedAction}
                                  onChange={(e) => updateCompanyActionDraft(row.companyName, e.target.value)}
                                >
                                  {GOVERNANCE_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>{option.label}</option>
                                  ))}
                                </select>
                                <button
                                  className="adm-save-btn adm-company-action-btn"
                                  disabled={companyActionLoading===loadingKey}
                                  onClick={() => applyCompanyAction(row)}
                                >
                                  {companyActionLoading===loadingKey? 'Applying...':'Apply Action'}
                                </button>
                                <span className="adm-company-action-hint">{selectedMeta.hint}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab==='ai-config'&&(
              <section>
                <h2>Global AI Configuration Controls</h2>
                <p className="adm-subtitle">Adjust integrity thresholds, skill weights, fraud sensitivity, and difficulty scaling globally.</p>

                <div className="adm-config-grid">
                  <div className="adm-panel">
                    <h3>Integrity Thresholds</h3>
                    <div className="adm-form-grid">
                      <label>Low Risk Min
                        <input type="number" value={aiConfig.integrityThresholds.lowRiskMin} onChange={(e) => setAiConfig((prev) => ({...prev, integrityThresholds: {...prev.integrityThresholds, lowRiskMin: Number(e.target.value)}}))} />
                      </label>
                      <label>Medium Risk Min
                        <input type="number" value={aiConfig.integrityThresholds.mediumRiskMin} onChange={(e) => setAiConfig((prev) => ({...prev, integrityThresholds: {...prev.integrityThresholds, mediumRiskMin: Number(e.target.value)}}))} />
                      </label>
                      <label>Critical Max
                        <input type="number" value={aiConfig.integrityThresholds.criticalMax} onChange={(e) => setAiConfig((prev) => ({...prev, integrityThresholds: {...prev.integrityThresholds, criticalMax: Number(e.target.value)}}))} />
                      </label>
                    </div>
                  </div>

                  <div className="adm-panel">
                    <h3>Skill Weight Distribution (%)</h3>
                    <div className="adm-form-grid">
                      <label>Technical
                        <input type="number" value={aiConfig.skillWeightDistribution.technical} onChange={(e) => setAiConfig((prev) => ({...prev, skillWeightDistribution: {...prev.skillWeightDistribution, technical: Number(e.target.value)}}))} />
                      </label>
                      <label>Problem Solving
                        <input type="number" value={aiConfig.skillWeightDistribution.problemSolving} onChange={(e) => setAiConfig((prev) => ({...prev, skillWeightDistribution: {...prev.skillWeightDistribution, problemSolving: Number(e.target.value)}}))} />
                      </label>
                      <label>Communication
                        <input type="number" value={aiConfig.skillWeightDistribution.communication} onChange={(e) => setAiConfig((prev) => ({...prev, skillWeightDistribution: {...prev.skillWeightDistribution, communication: Number(e.target.value)}}))} />
                      </label>
                      <label>Domain
                        <input type="number" value={aiConfig.skillWeightDistribution.domain} onChange={(e) => setAiConfig((prev) => ({...prev, skillWeightDistribution: {...prev.skillWeightDistribution, domain: Number(e.target.value)}}))} />
                      </label>
                      <label>Aptitude
                        <input type="number" value={aiConfig.skillWeightDistribution.aptitude} onChange={(e) => setAiConfig((prev) => ({...prev, skillWeightDistribution: {...prev.skillWeightDistribution, aptitude: Number(e.target.value)}}))} />
                      </label>
                    </div>
                  </div>

                  <div className="adm-panel">
                    <h3>Fraud Sensitivity</h3>
                    <label className="adm-block-label">Sensitivity Level
                      <select value={aiConfig.fraudSensitivityLevel} onChange={(e) => setAiConfig((prev) => ({...prev, fraudSensitivityLevel: e.target.value}))}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                  </div>

                  <div className="adm-panel">
                    <h3>AI Difficulty Scaling</h3>
                    <div className="adm-form-grid">
                      <label>Entry
                        <input type="number" step="0.01" value={aiConfig.aiDifficultyScaling.entry} onChange={(e) => setAiConfig((prev) => ({...prev, aiDifficultyScaling: {...prev.aiDifficultyScaling, entry: Number(e.target.value)}}))} />
                      </label>
                      <label>Mid
                        <input type="number" step="0.01" value={aiConfig.aiDifficultyScaling.mid} onChange={(e) => setAiConfig((prev) => ({...prev, aiDifficultyScaling: {...prev.aiDifficultyScaling, mid: Number(e.target.value)}}))} />
                      </label>
                      <label>Senior
                        <input type="number" step="0.01" value={aiConfig.aiDifficultyScaling.senior} onChange={(e) => setAiConfig((prev) => ({...prev, aiDifficultyScaling: {...prev.aiDifficultyScaling, senior: Number(e.target.value)}}))} />
                      </label>
                    </div>
                  </div>
                </div>

                <button className="adm-save-btn" onClick={handleSaveGlobalConfig} disabled={savingAiConfig}>
                  {savingAiConfig? 'Saving...':'Save Global AI Configuration'}
                </button>
              </section>
            )}

            {activeTab==='security'&&(
              <section>
                <h2>Security Monitoring & Risk Control</h2>
                <p className="adm-subtitle">Detect anomalous authentication behavior and apply corrective controls in real time.</p>

                <div className="adm-kpi-grid" style={{marginBottom: '0.9rem'}}>
                  <div className="adm-kpi-card"><span>Blocked IPs</span><strong>{securityOverview.summary?.blockedIpCount||0}</strong></div>
                  <div className="adm-kpi-card"><span>Suspicious IPs</span><strong>{securityOverview.summary?.suspiciousIpCount||0}</strong></div>
                  <div className="adm-kpi-card"><span>Auth Failures (24h)</span><strong>{securityOverview.summary?.repeatedAuthFailureCount||0}</strong></div>
                  <div className="adm-kpi-card"><span>Abnormal Login Users</span><strong>{securityOverview.summary?.abnormalLoginUsers||0}</strong></div>
                  <div className="adm-kpi-card"><span>Concurrent Session Risks</span><strong>{securityOverview.summary?.concurrentSessionRiskUsers||0}</strong></div>
                </div>

                <div className="adm-panel" style={{marginBottom: '0.8rem'}}>
                  <h3>Block Suspicious IP</h3>
                  <div className="adm-security-controls">
                    <input placeholder="IP address" value={securityIp} onChange={(e) => setSecurityIp(e.target.value)} />
                    <input placeholder="Reason" value={securityReason} onChange={(e) => setSecurityReason(e.target.value)} />
                    <button className="adm-save-btn" onClick={handleBlockIp}>Block IP</button>
                  </div>
                </div>

                <div className="adm-growth-row">
                  <div className="adm-panel">
                    <h3>Top Failed-Auth IPs</h3>
                    <div className="adm-signal-list">
                      {(securityOverview.suspiciousIps||[]).slice(0, 8).map((row) => (
                        <div className="adm-signal-item" key={row.ip}>
                          <span>{row.ip}</span>
                          <strong>{row.failureCount}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="adm-panel">
                    <h3>Blocked IP List</h3>
                    <div className="adm-signal-list">
                      {(securityOverview.blockedIps||[]).map((row) => (
                        <div className="adm-signal-item" key={row.ip}>
                          <span>{row.ip}</span>
                          <button className="adm-link-btn" onClick={() => handleUnblockIp(row.ip)}>Unblock</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="adm-table-wrap" style={{marginTop: '0.85rem'}}>
                  <table className="adm-table">
                    <thead><tr><th>User</th><th>Risk</th><th>Sessions</th><th>IPs</th><th>Actions</th></tr></thead>
                    <tbody>
                      {(securityOverview.concurrentSessionRisks||[]).map((row) => (
                        <tr key={row.userId}>
                          <td>
                            <div className="adm-user-cell">
                              <strong>{row.username}</strong>
                              <span>{row.email}</span>
                            </div>
                          </td>
                          <td><span className="adm-pill warn">Concurrent Session</span></td>
                          <td>{row.sessionCount||0}</td>
                          <td>{row.distinctIpCount||0}</td>
                          <td>
                            <div className="adm-actions-inline">
                              <button className="adm-link-btn" onClick={() => handleForceLogout(row.userId)}>Force Logout</button>
                              <button className="adm-link-btn" onClick={() => handleSecuritySuspend(row.userId)}>Suspend</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab==='candidate-oversight'&&(
              <section>
                <h2>Candidate Performance Oversight</h2>
                <p className="adm-subtitle">Monitor platform-wide scoring integrity, skill benchmarks, distributions, and anomaly trends.</p>

                <div className="adm-actions-inline" style={{margin: '0.5rem 0 0.7rem'}}>
                  <button className="adm-link-btn" onClick={handleExportCandidateOversightJSON}>Export JSON</button>
                  <button className="adm-link-btn" onClick={handleExportCandidateOversightCSV}>Export CSV</button>
                </div>

                <div className="adm-kpi-grid" style={{marginBottom: '0.9rem'}}>
                  <div className="adm-kpi-card"><span>Candidates Assessed</span><strong>{candidateOversight.summary?.totalCandidatesAssessed||0}</strong></div>
                  <div className="adm-kpi-card"><span>Total Assessments</span><strong>{candidateOversight.summary?.totalAssessments||0}</strong></div>
                  <div className="adm-kpi-card"><span>Average Overall Score</span><strong>{candidateOversight.summary?.averageOverallScore||0}</strong></div>
                  <div className="adm-kpi-card"><span>Low Integrity + High Score</span><strong>{candidateOversight.anomalyInsights?.lowIntegrityHighScoreCount||0}</strong></div>
                </div>

                <div className="adm-growth-row">
                  {/* ── Skill Benchmarks: Radial Rings ── */}
                  <div className="adm-panel">
                    <h3>Skill Benchmarks</h3>
                    <div className="adm-radial-grid">
                      {[
                        {key: 'technical', label: 'Technical', color: '#3b82f6'},
                        {key: 'problemSolving', label: 'Problem\nSolving', color: '#a855f7'},
                        {key: 'communication', label: 'Communication', color: '#22d3ee'},
                        {key: 'domain', label: 'Domain', color: '#f59e0b'},
                        {key: 'aptitude', label: 'Aptitude', color: '#22c55e'},
                      ].map((skill) => {
                        const val = Number(candidateOversight.skillBenchmarks?.[skill.key]||0);
                        const circum = 2 * Math.PI * 36;
                        const offset = circum - (Math.min(val, 100) / 100) * circum;
                        return (
                          <div key={skill.key} className="adm-radial-item">
                            <div className="adm-radial-ring">
                              <svg viewBox="0 0 82 82">
                                <circle className="adm-radial-bg" />
                                <circle className="adm-radial-fg" stroke={skill.color} strokeDasharray={circum.toFixed(2)} strokeDashoffset={offset.toFixed(2)} />
                              </svg>
                              <div className="adm-radial-value">{val}</div>
                            </div>
                            <span className="adm-radial-label">{skill.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Performance Distribution: Donut ── */}
                  <div className="adm-panel">
                    <h3>Performance Distribution</h3>
                    {(() => {
                      const buckets = [
                        {key: 'below40', label: '< 40', color: '#ef4444', count: candidateOversight.performanceDistribution?.below40?.count||0},
                        {key: 'between40And59', label: '40–59', color: '#f59e0b', count: candidateOversight.performanceDistribution?.between40And59?.count||0},
                        {key: 'between60And79', label: '60–79', color: '#3b82f6', count: candidateOversight.performanceDistribution?.between60And79?.count||0},
                        {key: 'atLeast80', label: '80+', color: '#22c55e', count: candidateOversight.performanceDistribution?.atLeast80?.count||0},
                      ];
                      const total = Math.max(1, buckets.reduce((s, b) => s + b.count, 0));
                      const conicParts = [];
                      let cursor = 0;
                      buckets.forEach((b) => {
                        const pct = (b.count / total) * 100;
                        conicParts.push(`${b.color} ${cursor.toFixed(2)}% ${(cursor + pct).toFixed(2)}%`);
                        cursor += pct;
                      });
                      const donutBg = { background: `conic-gradient(${conicParts.join(', ')})` };
                      return (
                        <div className="adm-perf-donut-wrap">
                          <div className="adm-perf-donut" style={donutBg}>
                            <div className="adm-perf-donut-inner">
                              <strong>{buckets.reduce((s, b) => s + b.count, 0)}</strong>
                              <span>Total</span>
                            </div>
                          </div>
                          <div className="adm-perf-legend">
                            {buckets.map((b) => (
                              <div key={b.key} className="adm-perf-legend-item">
                                <span><i className="adm-dot" style={{background: b.color}} />{b.label}</span>
                                <strong>{b.count} ({((b.count / total) * 100).toFixed(0)}%)</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* ── Integrity Trend: SVG Area Chart ── */}
                  <div className="adm-panel">
                    <h3>Integrity Trend (7d)</h3>
                    {(() => {
                      const data = candidateOversight.integrityScoreTrend||[];
                      if (!data.length) return <p style={{color:'#6b7280', fontSize:'0.85rem'}}>No trend data</p>;
                      const w = 340, h = 140, pad = 18;
                      const maxVal = Math.max(100, ...data.map(d => d.value||0));
                      const pts = data.map((d, i) => ({
                        x: pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2),
                        y: pad + (1 - (d.value||0) / maxVal) * (h - pad * 2),
                      }));
                      const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                      const areaPath = linePath + ` L ${pts[pts.length - 1].x.toFixed(1)} ${(h - pad).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(h - pad).toFixed(1)} Z`;
                      return (
                        <div className="adm-area-chart-wrap">
                          <svg className="adm-area-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="integrityGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.02" />
                              </linearGradient>
                              <linearGradient id="integrityStroke" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor="#a855f7" />
                              </linearGradient>
                            </defs>
                            {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                              <line key={frac} className="grid-line" x1={pad} y1={pad + frac * (h - pad * 2)} x2={w - pad} y2={pad + frac * (h - pad * 2)} />
                            ))}
                            <path className="area-fill" d={areaPath} fill="url(#integrityGrad)" />
                            <path className="area-line" d={linePath} stroke="url(#integrityStroke)" />
                            {pts.map((p, i) => (
                              <circle key={i} className="area-dot" cx={p.x} cy={p.y} r="4" stroke="#a855f7" />
                            ))}
                          </svg>
                          <div className="adm-area-labels">
                            {data.map((d) => <span key={d.day}>{d.day.slice(5)}</span>)}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="adm-growth-row" style={{marginTop: '0.75rem'}}>
                  {/* ── High Variance Candidates: Card Layout ── */}
                  <div className="adm-panel">
                    <h3>High Variance Candidates</h3>
                    <div className="adm-anomaly-grid">
                      {(candidateOversight.anomalyInsights?.highVarianceCandidates||[]).slice(0, 8).map((row, idx) => (
                        <div className="adm-anomaly-card" key={row.userId}>
                          <div className="adm-anomaly-info">
                            <span className="adm-anomaly-name">{row.username}</span>
                            <span className="adm-anomaly-sub">{row.email}</span>
                            <div className="adm-anomaly-meter">
                              <div className="adm-anomaly-meter-fill warn" style={{width: `${Math.min(100, 40 + idx * 8)}%`}} />
                            </div>
                          </div>
                          <span className="adm-anomaly-badge variance">
                            <AlertTriangle size={13} /> Variance
                          </span>
                        </div>
                      ))}
                      {!(candidateOversight.anomalyInsights?.highVarianceCandidates||[]).length && (
                        <p style={{color:'#6b7280', fontSize:'0.85rem'}}>No high-variance candidates detected</p>
                      )}
                    </div>
                  </div>

                  {/* ── Repeated Flagged Candidates: Card Layout ── */}
                  <div className="adm-panel">
                    <h3>Repeated Flagged Candidates</h3>
                    <div className="adm-anomaly-grid">
                      {(candidateOversight.anomalyInsights?.repeatedFlaggedCandidates||[]).slice(0, 8).map((row) => {
                        const pct = Math.min(100, (row.flaggedCount / Math.max(1, ...(candidateOversight.anomalyInsights?.repeatedFlaggedCandidates||[]).map(r => r.flaggedCount))) * 100);
                        return (
                          <div className="adm-anomaly-card" key={row.userId}>
                            <div className="adm-anomaly-info">
                              <span className="adm-anomaly-name">{row.username}</span>
                              <span className="adm-anomaly-sub">{row.flaggedCount} flag{row.flaggedCount !== 1 ? 's' : ''}</span>
                              <div className="adm-anomaly-meter">
                                <div className="adm-anomaly-meter-fill danger" style={{width: `${pct}%`}} />
                              </div>
                            </div>
                            <span className="adm-anomaly-badge flagged">
                              <AlertTriangle size={13} /> Flagged
                            </span>
                          </div>
                        );
                      })}
                      {!(candidateOversight.anomalyInsights?.repeatedFlaggedCandidates||[]).length && (
                        <p style={{color:'#6b7280', fontSize:'0.85rem'}}>No repeat-flagged candidates</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab==='jobs'&&(
              <section>
                <h2>Job Moderation</h2>
                <p className="adm-subtitle">A focused moderation surface with smart filters, quick actions, and hiring health metrics.</p>

                <div className="adm-filter-row">
                  <div className="adm-search">
                    <Search size={15} />
                    <input
                      value={jobSearch}
                      onChange={(e) => setJobSearch(e.target.value)}
                      placeholder="Search title/company/department"
                    />
                  </div>

                  <div className="adm-select-wrap">
                    <Filter size={14} />
                    <select value={jobStatusFilter} onChange={(e) => setJobStatusFilter(e.target.value)}>
                      {JOB_STATUS_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="adm-select-wrap">
                    <Building2 size={14} />
                    <select value={jobDepartmentFilter} onChange={(e) => setJobDepartmentFilter(e.target.value)}>
                      {jobDepartmentOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="adm-select-wrap">
                    <Radar size={14} />
                    <select value={jobLocationFilter} onChange={(e) => setJobLocationFilter(e.target.value)}>
                      {jobLocationOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="adm-kpi-grid adm-job-kpi-grid">
                  <div className="adm-kpi-card"><span>Filtered Jobs</span><strong>{filteredJobStatusCounts.total}</strong></div>
                  <div className="adm-kpi-card"><span>Active</span><strong>{filteredJobStatusCounts.active}</strong></div>
                  <div className="adm-kpi-card"><span>Closed</span><strong>{filteredJobStatusCounts.closed}</strong></div>
                  <div className="adm-kpi-card"><span>Draft</span><strong>{filteredJobStatusCounts.draft}</strong></div>
                  <div className="adm-kpi-card"><span>Paused</span><strong>{filteredJobStatusCounts.paused}</strong></div>
                </div>

                <div className="adm-chip-filter-wrap">
                  {jobContainerOptions.map((opt) => (
                    <button
                      key={opt.id}
                      className={`adm-chip-filter ${jobContainerFilter===opt.id? 'active':''}`}
                      onClick={() => setJobContainerFilter(opt.id)}
                    >
                      <span>{opt.label}</span>
                      <strong>{opt.count}</strong>
                    </button>
                  ))}
                </div>

                <div className="adm-job-grid">
                  {filteredJobs.map((row) => (
                    <article key={row.id} className={`adm-job-card ${jobEditState?.id===row.id? 'editing':''}`}>
                      <div className="adm-job-head">
                        <h3>{row.title}</h3>
                        <span className={`adm-pill adm-pill-job-status ${row.status==='active'? 'ok':row.status==='draft'? 'draft':row.status==='closed'? 'muted':'warn'}`}>{row.status}</span>
                      </div>

                      <div className="adm-job-meta">
                        <span>{row.companyName}</span>
                        <span>{row.department||'General'}</span>
                        <span>{row.location||'Remote'}</span>
                        <span>{row.type||'Full-Time'}</span>
                        <span>{(jobContainerOptions.find((x) => x.id===row.skillContainer)?.label)||'Other'}</span>
                      </div>

                      <div className="adm-job-kpis">
                        <div className="adm-job-kpi-badge"><Eye size={14} /><div><span>Total Views</span><strong>{row.totalViews||0}</strong></div></div>
                        <div className="adm-job-kpi-badge"><Users size={14} /><div><span>Applications</span><strong>{row.applicationsReceived??(row.applicantCount||0)}</strong></div></div>
                        <div className="adm-job-kpi-badge"><BarChart3 size={14} /><div><span>Avg Score</span><strong>{row.avgCandidateScore===null||row.avgCandidateScore===undefined? '—':row.avgCandidateScore}</strong></div></div>
                      </div>

                      {jobEditState?.id===row.id&&(
                        <div className="adm-job-edit-grid">
                          <label>
                            Title
                            <input
                              value={jobEditState.title}
                              onChange={(e) => setJobEditState((prev) => ({...prev, title: e.target.value}))}
                            />
                          </label>
                          <label>
                            Department
                            <input
                              value={jobEditState.department}
                              onChange={(e) => setJobEditState((prev) => ({...prev, department: e.target.value}))}
                            />
                          </label>
                          <label>
                            Location
                            <select
                              value={jobEditState.location}
                              onChange={(e) => setJobEditState((prev) => ({...prev, location: e.target.value}))}
                            >
                              {JOB_LOCATION_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Job Type
                            <select
                              value={jobEditState.type}
                              onChange={(e) => setJobEditState((prev) => ({...prev, type: e.target.value}))}
                            >
                              {JOB_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Status
                            <select
                              value={jobEditState.status}
                              onChange={(e) => setJobEditState((prev) => ({...prev, status: e.target.value}))}
                            >
                              <option value="active">active</option>
                              <option value="paused">paused</option>
                              <option value="closed">closed</option>
                              <option value="draft">draft</option>
                            </select>
                          </label>

                          <div className="adm-job-edit-actions">
                            <button
                              className="adm-link-btn"
                              disabled={jobActionLoading===`edit-${row.id}`}
                              onClick={saveJobEdit}
                            >
                              {jobActionLoading===`edit-${row.id}`? 'Saving...':'Save'}
                            </button>
                            <button className="adm-link-btn" onClick={closeJobEdit}>Cancel</button>
                          </div>
                        </div>
                      )}

                      <div className="adm-job-actions">
                        <label>
                          Update Status
                          <select
                            value={row.status}
                            onChange={(e) => handleJobStatus(row.id, e.target.value)}
                          >
                            <option value="active">active</option>
                            <option value="paused">paused</option>
                            <option value="closed">closed</option>
                            <option value="draft">draft</option>
                          </select>
                        </label>
                      </div>

                      <div className="adm-job-quick-actions">
                        <button
                          className="adm-job-quick-btn"
                          onClick={() => openJobEdit(row)}
                          disabled={Boolean(jobActionLoading)}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          className="adm-job-quick-btn"
                          onClick={() => viewJobApplicants(row)}
                          disabled={jobActionLoading===`view-${row.id}`}
                        >
                          <UserRoundSearch size={14} /> {jobActionLoading===`view-${row.id}`? 'Loading...':'View Applicants'}
                        </button>
                        <button
                          className="adm-job-quick-btn"
                          onClick={() => toggleJobActiveStatus(row)}
                          disabled={jobActionLoading===`toggle-${row.id}`}
                        >
                          <Power size={14} /> {row.status==='active'? 'Set Closed':'Set Active'}
                        </button>
                        <button
                          className="adm-job-quick-btn danger"
                          onClick={() => deleteJob(row.id, row.title||'this job')}
                          disabled={jobActionLoading===`delete-${row.id}`}
                        >
                          <Trash2 size={14} /> {jobActionLoading===`delete-${row.id}`? 'Deleting...':'Delete'}
                        </button>
                      </div>
                    </article>
                  ))}

                  {filteredJobs.length===0&&(
                    <div className="adm-panel">
                      <h3>No jobs found</h3>
                      <p className="adm-subtitle">Try changing status, department, location, or search keywords.</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeTab==='flags'&&(
              <section>
                <h2>Fraud & Integrity Monitoring Center</h2>
                <p className="adm-subtitle">Review suspicious behavior, override flags, suspend accounts, or trigger reassessment.</p>

                <div className="adm-panel" style={{marginTop: '0.65rem', marginBottom: '0.65rem'}}>
                  <h3>Action Guide</h3>
                  <div className="adm-company-guide-grid">
                    {FRAUD_ACTION_OPTIONS.map((option) => (
                      <div key={option.id} className="adm-company-guide-item">
                        <strong>{option.label}</strong>
                        <span>{option.hint}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="adm-kpi-grid" style={{marginBottom: '0.9rem'}}>
                  <div className="adm-kpi-card"><span>Total Cases</span><strong>{fraudSummary.total||0}</strong></div>
                  <div className="adm-kpi-card"><span>Critical</span><strong>{fraudSummary.critical||0}</strong></div>
                  <div className="adm-kpi-card"><span>High</span><strong>{fraudSummary.high||0}</strong></div>
                  <div className="adm-kpi-card"><span>Medium</span><strong>{fraudSummary.medium||0}</strong></div>
                  <div className="adm-kpi-card"><span>Low</span><strong>{fraudSummary.low||0}</strong></div>
                </div>

                <div className="adm-filter-row">
                  <div className="adm-select-wrap">
                    <Filter size={14} />
                    <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
                      <option value="all">All Risks</option>
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>

                <div className="adm-company-container-grid">
                  <button
                    className={`adm-company-container ${fraudCompanyFilter==='all'? 'active':''}`}
                    onClick={() => setFraudCompanyFilter('all')}
                  >
                    <span>All Companies</span>
                    <strong>{fraudSummary.total||0}</strong>
                  </button>
                  {fraudCompanies.map((company) => (
                    <button
                      key={company.companyName}
                      className={`adm-company-container ${fraudCompanyFilter===company.companyName? 'active':''}`}
                      onClick={() => setFraudCompanyFilter(company.companyName)}
                    >
                      <span>{company.companyName}</span>
                      <strong>{company.count}</strong>
                    </button>
                  ))}
                </div>

                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead><tr><th>Candidate</th><th>Company</th><th>Risk</th><th>Integrity</th><th>Signals</th><th>Mismatch</th><th>Actions</th></tr></thead>
                    <tbody>
                      {fraudCenterLoading&&(
                        <tr><td colSpan="7">Loading proctoring flags...</td></tr>
                      )}
                      {!fraudCenterLoading&&filteredFraudCases.length===0&&(
                        <tr><td colSpan="7">No proctoring flags found for this company/risk filter.</td></tr>
                      )}
                      {!fraudCenterLoading&&filteredFraudCases.map((row) =>
                      {
                        const selectedAction=getFraudActionSelection(row.proctoringId);
                        const selectedMeta=getFraudActionMeta(selectedAction);
                        const loadingKey=`${row.proctoringId}-${selectedAction}`;

                        return (
                        <tr key={row.id}>
                          <td>
                            <div className="adm-user-cell">
                              <strong>{row.candidate}</strong>
                              <span>{row.email}</span>
                            </div>
                          </td>
                          <td>{row.companyName||'Unassigned'}</td>
                          <td><span className={`adm-pill ${['CRITICAL', 'HIGH'].includes(row.riskLevel)? 'warn':'ok'}`}>{row.riskLevel}</span></td>
                          <td>{row.integrityScore}</td>
                          <td>
                            <div className="adm-user-cell">
                              <span>Tab: {row.tabSwitchCount} · Multi-face: {row.multiFaceCount}</span>
                              <span>Copy/Paste: {row.copyPasteCount} · AI: {row.aiCodePatternCount}</span>
                            </div>
                          </td>
                          <td><span className={`adm-pill ${row.resumePerformanceMismatch? 'warn':'ok'}`}>{row.resumePerformanceMismatch? 'Yes':'No'}</span></td>
                          <td>
                            <div className="adm-company-actions">
                              <select
                                value={selectedAction}
                                onChange={(e) => updateFraudActionDraft(row.proctoringId, e.target.value)}
                              >
                                {FRAUD_ACTION_OPTIONS.map((option) => (
                                  <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                              </select>
                              <button
                                className="adm-save-btn adm-company-action-btn"
                                disabled={fraudActionLoading===loadingKey}
                                onClick={() => applyFraudAction(row)}
                              >
                                {fraudActionLoading===loadingKey? 'Applying...':'Apply Action'}
                              </button>
                              <span className="adm-company-action-hint">{selectedMeta.hint}</span>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab==='announcements'&&(
              <section>
                <h2>Announcements</h2>
                <p className="adm-subtitle">Create and broadcast announcements to students, companies, or everyone on the platform.</p>

                {/* ── Create Announcement Form ── */}
                <div className="adm-panel" style={{marginTop: '0.75rem'}}>
                  <h3><Megaphone size={16} /> New Announcement</h3>
                  <div className="adm-announce-form">
                    <div className="adm-announce-field">
                      <label>Title</label>
                      <input
                        type="text"
                        placeholder="Announcement title..."
                        value={announcementForm.title}
                        onChange={(e) => setAnnouncementForm((f) => ({...f, title: e.target.value}))}
                        maxLength={200}
                      />
                    </div>
                    <div className="adm-announce-field">
                      <label>Message</label>
                      <textarea
                        rows={4}
                        placeholder="Write your announcement message here..."
                        value={announcementForm.message}
                        onChange={(e) => setAnnouncementForm((f) => ({...f, message: e.target.value}))}
                        maxLength={2000}
                      />
                    </div>
                    <div className="adm-announce-row">
                      <div className="adm-announce-field">
                        <label>Audience</label>
                        <div className="adm-announce-chips">
                          {[{id: 'all', label: 'All Users', icon: <Users size={14} />}, {id: 'student', label: 'Students', icon: <Eye size={14} />}, {id: 'company', label: 'Companies', icon: <Building2 size={14} />}].map((opt) => (
                            <button
                              key={opt.id}
                              className={`adm-announce-chip ${announcementForm.audience===opt.id? 'active':''}`}
                              onClick={() => setAnnouncementForm((f) => ({...f, audience: opt.id}))}
                            >
                              {opt.icon} {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="adm-announce-field">
                        <label>Priority</label>
                        <div className="adm-announce-chips">
                          {[{id: 'normal', label: 'Normal', color: '#3b82f6'}, {id: 'important', label: 'Important', color: '#f59e0b'}, {id: 'urgent', label: 'Urgent', color: '#ef4444'}].map((opt) => (
                            <button
                              key={opt.id}
                              className={`adm-announce-chip ${announcementForm.priority===opt.id? 'active':''}`}
                              style={announcementForm.priority===opt.id? {borderColor: opt.color, color: opt.color}:{}}
                              onClick={() => setAnnouncementForm((f) => ({...f, priority: opt.id}))}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      className="adm-save-btn"
                      disabled={announcementSending||!announcementForm.title.trim()||!announcementForm.message.trim()}
                      onClick={handleCreateAnnouncement}
                      style={{marginTop: '0.5rem'}}
                    >
                      <Send size={15} />
                      {announcementSending? 'Sending...':'Broadcast Announcement'}
                    </button>
                  </div>
                </div>

                {/* ── Existing Announcements ── */}
                <div className="adm-panel" style={{marginTop: '0.75rem'}}>
                  <h3>Recent Announcements ({announcements.length})</h3>
                  {announcementsLoading&&<div className="adm-loading">Loading announcements...</div>}
                  {!announcementsLoading&&announcements.length===0&&(
                    <p className="adm-subtitle" style={{marginTop: '0.5rem'}}>No announcements created yet.</p>
                  )}
                  <div className="adm-announce-list">
                    {announcements.map((ann) => (
                      <div key={ann._id} className={`adm-announce-card adm-announce-card-${ann.priority}`}>
                        <div className="adm-announce-card-head">
                          <div className="adm-announce-card-title">
                            <span className={`adm-announce-prio-dot adm-announce-prio-${ann.priority}`} />
                            <strong>{ann.title}</strong>
                            {ann.priority==='urgent'&&<span className="adm-pill warn" style={{fontSize: '0.68rem'}}>URGENT</span>}
                            {ann.priority==='important'&&<span className="adm-pill draft" style={{fontSize: '0.68rem'}}>IMPORTANT</span>}
                          </div>
                          <button className="adm-icon-btn" onClick={() => handleDeleteAnnouncement(ann._id)} title="Delete"><Trash2 size={14} /></button>
                        </div>
                        <p className="adm-announce-card-msg">{ann.message}</p>
                        <div className="adm-announce-card-meta">
                          <span className="adm-pill muted" style={{fontSize: '0.72rem'}}>
                            {ann.audience==='all'? 'Everyone':ann.audience==='student'? 'Students':'Companies'}
                          </span>
                          <span>{new Date(ann.createdAt).toLocaleString()}</span>
                          <span>by {ann.createdBy}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

          {/* FEATURES TAB */}
          {activeTab==='features'&&(
            <div>
              <h2 className="adm-section-title">Feature Management</h2>
              <p className="adm-subtitle">Control which features are available to Company and Student dashboards. Disabled features will be hidden from those users.</p>

              {featureConfigLoading?(
                <div className="adm-loading">Loading feature configuration...</div>
              ):(
                <>
                  <div style={{display:'flex',gap:'12px',marginBottom:'1.5rem',flexWrap:'wrap'}}>
                    <button className="adm-btn adm-btn-primary" onClick={handleSaveFeatureConfig} disabled={featureConfigSaving}
                      style={{display:'flex',alignItems:'center',gap:'6px',padding:'10px 20px',background:'#6366f1',color:'#fff',border:'none',borderRadius:'8px',cursor:'pointer',fontWeight:600}}>
                      <CheckCircle size={16} /> {featureConfigSaving?'Saving...':'Save All Changes'}
                    </button>
                    <button onClick={()=>handleResetRole('company')}
                      style={{padding:'10px 16px',background:'transparent',color:'#94a3b8',border:'1px solid #334155',borderRadius:'8px',cursor:'pointer',fontSize:'0.85rem'}}>
                      Reset Company to All Enabled
                    </button>
                    <button onClick={()=>handleResetRole('student')}
                      style={{padding:'10px 16px',background:'transparent',color:'#94a3b8',border:'1px solid #334155',borderRadius:'8px',cursor:'pointer',fontSize:'0.85rem'}}>
                      Reset Student to All Enabled
                    </button>
                  </div>

                  {/* ═══ COMPANY FEATURES ═══ */}
                  <div className="adm-panel" style={{marginBottom:'1.5rem'}}>
                    <h3 style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'1rem'}}><Building2 size={18}/> Company Dashboard Features</h3>

                    {/* Overview Group */}
                    <div style={{marginBottom:'1.2rem'}}>
                      <h4 style={{fontSize:'0.85rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'0.6rem'}}>Overview Tab</h4>
                      <div className="adm-feature-grid">
                        {[
                          {id:'company.overview.kpi_cards',label:'KPI Cards with Sparklines',desc:'Active Jobs, Applicants, Offered, Hire Rate'},
                          {id:'company.overview.ai_fit_score',label:'AI Fit Score',desc:'Radial bar gauge of average AI fit'},
                          {id:'company.overview.hiring_pipeline',label:'Hiring Pipeline Funnel',desc:'Applied → Assessment → Interview → Offered → Hired'},
                          {id:'company.overview.skill_gap_radar',label:'AI Skill Gap Radar',desc:'Required vs Candidate Pool skill comparison'},
                          {id:'company.overview.assessment_heatmap',label:'Assessment Heatmap',desc:'Role × Assessment type performance matrix'},
                          {id:'company.overview.hiring_funnel',label:'Hiring Funnel (Real Data)',desc:'Horizontal bar with real pipeline data'},
                          {id:'company.overview.applicants_per_job',label:'Applicants per Job Chart',desc:'Bar chart of applicant distribution'},
                          {id:'company.overview.conversion_rates',label:'Conversion Rate Cards',desc:'Interview, Offer, and Hire rate progress bars'},
                          {id:'company.overview.recent_postings',label:'Recent Job Postings',desc:'Last 4 job postings with AI insights'},
                          {id:'company.overview.upcoming_interviews',label:'Upcoming Interviews',desc:'Scheduled interview list with join buttons'},
                          {id:'company.overview.leaderboard',label:'Candidate Leaderboard',desc:'Ranked table of top candidates'},
                          {id:'company.overview.scoring_link',label:'Scoring & Rankings Link',desc:'Link to external scoring page'},
                        ].map(f=>(
                          <FeatureToggleCard key={f.id} feature={f} role="company" config={featureConfig} onToggle={handleFeatureToggle}/>
                        ))}
                      </div>
                    </div>

                    {/* Candidates/ATS Group */}
                    <div style={{marginBottom:'1.2rem'}}>
                      <h4 style={{fontSize:'0.85rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'0.6rem'}}>Candidates & ATS</h4>
                      <div className="adm-feature-grid">
                        {[
                          {id:'company.candidates.ats_screening',label:'ATS Screening',desc:'AI-powered applicant tracking with scores'},
                          {id:'company.candidates.bulk_shortlist',label:'Bulk Shortlist',desc:'Auto-shortlist above threshold score'},
                          {id:'company.candidates.rescore',label:'Re-score All',desc:'Re-run ATS scoring on all applicants'},
                          {id:'company.candidates.schedule_interview',label:'Schedule Interview',desc:'Schedule recruiter interviews for candidates'},
                          {id:'company.candidates.job_wise_view',label:'Job-wise Candidate Cards',desc:'Card grid view when All Jobs selected'},
                        ].map(f=>(
                          <FeatureToggleCard key={f.id} feature={f} role="company" config={featureConfig} onToggle={handleFeatureToggle}/>
                        ))}
                      </div>
                    </div>

                    {/* Quiz & Contest Group */}
                    <div style={{marginBottom:'1.2rem'}}>
                      <h4 style={{fontSize:'0.85rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'0.6rem'}}>Quiz & Contest</h4>
                      <div className="adm-feature-grid">
                        {[
                          {id:'company.quiz.management',label:'Quiz Management',desc:'Create, view, manage quizzes'},
                          {id:'company.quiz.create_wizard',label:'Quiz Creation Wizard',desc:'AI-powered 3-step quiz creation'},
                          {id:'company.quiz.host',label:'Quiz Hosting',desc:'Live quiz hosting page'},
                          {id:'company.quiz.full_manager',label:'Full Quiz Manager',desc:'Advanced quiz dashboard'},
                          {id:'company.contest.management',label:'Contest Management',desc:'Create, view, manage coding contests'},
                          {id:'company.contest.create_wizard',label:'Contest Creation Wizard',desc:'AI-powered contest creation'},
                          {id:'company.contest.host',label:'Contest Hosting',desc:'Live contest hosting page'},
                        ].map(f=>(
                          <FeatureToggleCard key={f.id} feature={f} role="company" config={featureConfig} onToggle={handleFeatureToggle}/>
                        ))}
                      </div>
                    </div>

                    {/* Interviews Group */}
                    <div>
                      <h4 style={{fontSize:'0.85rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'0.6rem'}}>Interviews</h4>
                      <div className="adm-feature-grid">
                        {[
                          {id:'company.interviews.start',label:'Start Interview',desc:'Create and join live interview rooms'},
                          {id:'company.interviews.scheduled',label:'Scheduled Interviews',desc:'View and manage scheduled interviews'},
                        ].map(f=>(
                          <FeatureToggleCard key={f.id} feature={f} role="company" config={featureConfig} onToggle={handleFeatureToggle}/>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ═══ STUDENT FEATURES ═══ */}
                  <div className="adm-panel">
                    <h3 style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'1rem'}}><Users size={18}/> Student Dashboard Features</h3>

                    {/* Dashboard Tab */}
                    <div style={{marginBottom:'1.2rem'}}>
                      <h4 style={{fontSize:'0.85rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'0.6rem'}}>Dashboard Home</h4>
                      <div className="adm-feature-grid">
                        {[
                          {id:'student.dashboard.stats',label:'Dashboard Stats',desc:'Applied, Assessments, Pending, Available KPIs'},
                          {id:'student.dashboard.profile_card',label:'Profile Card',desc:'Profile summary with stats and completion bar'},
                          {id:'student.dashboard.recommended_jobs',label:'Recommended Jobs',desc:'Top 5 available jobs with quick apply'},
                          {id:'student.dashboard.my_applications',label:'My Applications',desc:'Recent applications with status tracking'},
                          {id:'student.dashboard.quick_actions',label:'Quick Actions Grid',desc:'Action cards linking to all features'},
                          {id:'student.dashboard.assessments',label:'My Assessments',desc:'Company-assigned assessment list'},
                        ].map(f=>(
                          <FeatureToggleCard key={f.id} feature={f} role="student" config={featureConfig} onToggle={handleFeatureToggle}/>
                        ))}
                      </div>
                    </div>

                    {/* Jobs Tab */}
                    <div style={{marginBottom:'1.2rem'}}>
                      <h4 style={{fontSize:'0.85rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'0.6rem'}}>Jobs</h4>
                      <div className="adm-feature-grid">
                        {[
                          {id:'student.jobs.kanban',label:'Kanban Board',desc:'Application status kanban view'},
                        ].map(f=>(
                          <FeatureToggleCard key={f.id} feature={f} role="student" config={featureConfig} onToggle={handleFeatureToggle}/>
                        ))}
                      </div>
                    </div>

                    {/* Quiz & Contest */}
                    <div style={{marginBottom:'1.2rem'}}>
                      <h4 style={{fontSize:'0.85rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'0.6rem'}}>Quiz & Contest</h4>
                      <div className="adm-feature-grid">
                        {[
                          {id:'student.quiz.browse',label:'Browse Quizzes',desc:'Auto-refreshing list of available quizzes'},
                          {id:'student.quiz.join_by_code',label:'Join Quiz by Code',desc:'Enter room code to join quiz'},
                          {id:'student.contest.browse',label:'Browse Contests',desc:'Auto-refreshing list of coding contests'},
                          {id:'student.contest.join_by_code',label:'Join Contest by Code',desc:'Enter contest code to join'},
                        ].map(f=>(
                          <FeatureToggleCard key={f.id} feature={f} role="student" config={featureConfig} onToggle={handleFeatureToggle}/>
                        ))}
                      </div>
                    </div>

                    {/* Interview */}
                    <div style={{marginBottom:'1.2rem'}}>
                      <h4 style={{fontSize:'0.85rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'0.6rem'}}>Interviews</h4>
                      <div className="adm-feature-grid">
                        {[
                          {id:'student.recruiter.scheduled',label:'Scheduled Interviews',desc:'View scheduled interviews with join buttons'},
                          {id:'student.recruiter.join',label:'Join Interview',desc:'Enter interview code to join session'},
                          {id:'student.recruiter.quick_join',label:'Quick Join (Demo)',desc:'Quick join a demo session'},
                          {id:'student.recruiter.features',label:'Interview Features Info',desc:'Feature info cards'},
                          {id:'student.recruiter.tips',label:'Interview Tips',desc:'Preparation tip cards'},
                        ].map(f=>(
                          <FeatureToggleCard key={f.id} feature={f} role="student" config={featureConfig} onToggle={handleFeatureToggle}/>
                        ))}
                      </div>
                    </div>

                    {/* Practice & Coding */}
                    <div style={{marginBottom:'1.2rem'}}>
                      <h4 style={{fontSize:'0.85rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'0.6rem'}}>Practice & Coding</h4>
                      <div className="adm-feature-grid">
                        {[
                          {id:'student.practice.setup',label:'Practice Interview Setup',desc:'Multi-step interview practice config'},
                          {id:'student.coding.practice',label:'Coding Practice',desc:'LeetCode-style coding environment'},
                        ].map(f=>(
                          <FeatureToggleCard key={f.id} feature={f} role="student" config={featureConfig} onToggle={handleFeatureToggle}/>
                        ))}
                      </div>
                    </div>

                    {/* AI Features */}
                    <div style={{marginBottom:'1.2rem'}}>
                      <h4 style={{fontSize:'0.85rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'0.6rem'}}>AI-Powered Features</h4>
                      <div className="adm-feature-grid">
                        {[
                          {id:'student.ai_interview.setup',label:'AI Interview',desc:'AI-powered mock interview session'},
                          {id:'student.ai_calling.phone_interview',label:'AI Phone Interview',desc:'AI voice call via Twilio'},
                          {id:'student.axiom.chat',label:'Spec AI Chat',desc:'AI career guidance assistant'},
                        ].map(f=>(
                          <FeatureToggleCard key={f.id} feature={f} role="student" config={featureConfig} onToggle={handleFeatureToggle}/>
                        ))}
                      </div>
                    </div>

                    {/* External Pages */}
                    <div>
                      <h4 style={{fontSize:'0.85rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'0.6rem'}}>External Pages</h4>
                      <div className="adm-feature-grid">
                        {[
                          {id:'student.resume_verification',label:'Resume Verification',desc:'3-layer resume verification system'},
                          {id:'student.results',label:'My Results',desc:'Scores, rankings & leaderboard'},
                          {id:'student.analytics',label:'Deep Analytics',desc:'Visual analytics & insights dashboard'},
                        ].map(f=>(
                          <FeatureToggleCard key={f.id} feature={f} role="student" config={featureConfig} onToggle={handleFeatureToggle}/>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          </div>
        )}
      </main>

      {(selectedFraudDetails||detailsLoading)&&(
        <div className="adm-modal-backdrop" onClick={closeFraudDetails}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            {detailsLoading&&<div className="adm-loading">Loading case details...</div>}

            {!detailsLoading&&selectedFraudDetails&&(
              <>
                <div className="adm-modal-head">
                  <h3>Fraud Case Drill-down</h3>
                  <div className="adm-modal-actions">
                    <button className="adm-link-btn" onClick={handleExportTimelineJSON}>Export JSON</button>
                    <button className="adm-link-btn" onClick={handleExportTimelineCSV}>Export CSV</button>
                    <button className="adm-icon-btn" onClick={closeFraudDetails} title="Close">✕</button>
                  </div>
                </div>

                <div className="adm-kpi-grid" style={{marginTop: '0.4rem'}}>
                  <div className="adm-kpi-card"><span>Risk Level</span><strong>{selectedFraudDetails.case?.riskLevel||'N/A'}</strong></div>
                  <div className="adm-kpi-card"><span>Integrity Score</span><strong>{selectedFraudDetails.case?.integrityScore?? 'N/A'}</strong></div>
                  <div className="adm-kpi-card"><span>Tab Switches</span><strong>{selectedFraudDetails.case?.tabSwitchCount||0}</strong></div>
                  <div className="adm-kpi-card"><span>Multi-face</span><strong>{selectedFraudDetails.case?.multiFaceCount||0}</strong></div>
                </div>

                <div className="adm-modal-grid">
                  <div className="adm-panel">
                    <h3>Candidate Profile Snapshot</h3>
                    <div className="adm-user-cell" style={{marginTop: '0.45rem'}}>
                      <strong>{selectedFraudDetails.candidateProfile?.fullName||selectedFraudDetails.candidateProfile?.username||'Unknown'}</strong>
                      <span>{selectedFraudDetails.candidateProfile?.email||''}</span>
                      <span>Profile Completion: {selectedFraudDetails.candidateProfile?.profileComplete||0}%</span>
                    </div>
                    <p style={{marginTop: '0.45rem'}}>{selectedFraudDetails.candidateProfile?.headline||'No headline available'}</p>
                    <p style={{color: '#a3a3a3'}}>{selectedFraudDetails.candidateProfile?.bio||'No profile bio available'}</p>
                    <div className="adm-chip-wrap">
                      {(selectedFraudDetails.candidateProfile?.skills||[]).slice(0, 10).map((skill) => (
                        <span key={skill} className="adm-chip">{skill}</span>
                      ))}
                    </div>
                  </div>

                  <div className="adm-panel">
                    <h3>Full Proctoring Timeline</h3>
                    <div className="adm-timeline">
                      {(selectedFraudDetails.timeline||[]).map((evt, idx) => (
                        <div key={`${evt.eventType}-${idx}`} className="adm-timeline-item">
                          <div>
                            <strong>{evt.eventType.replaceAll('_', ' ')}</strong>
                            <span className={`adm-pill ${['critical', 'high'].includes((evt.severity||'').toLowerCase())? 'warn':'ok'}`}>{evt.severity}</span>
                          </div>
                          <p>{evt.description||'No description'}</p>
                          <time>{new Date(evt.timestamp).toLocaleString()}</time>
                        </div>
                      ))}
                      {(selectedFraudDetails.timeline||[]).length===0&&<p style={{color: '#9ca3af'}}>No proctoring events found.</p>}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {signalDrilldownOpen&&(
        <div className="adm-modal-backdrop" onClick={closeSignalDrilldown}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-head">
              <h3>{selectedSignalLabel} — Student List</h3>
              <div className="adm-modal-actions">
                <button className="adm-icon-btn" onClick={closeSignalDrilldown} title="Close">✕</button>
              </div>
            </div>

            <div className="adm-kpi-grid" style={{marginTop: '0.4rem'}}>
              <div className="adm-kpi-card"><span>Total Students</span><strong>{signalTotalStudents||0}</strong></div>
              <div className="adm-kpi-card"><span>Total Events</span><strong>{signalTotalEvents||0}</strong></div>
            </div>

            {signalStudentsLoading&&<div className="adm-loading">Loading students...</div>}

            {!signalStudentsLoading&&(
              <div className="adm-table-wrap" style={{marginTop: '0.65rem'}}>
                <table className="adm-table">
                  <thead><tr><th>Student</th><th>Email</th><th>Signal Count</th><th>Sessions</th><th>Latest Event</th></tr></thead>
                  <tbody>
                    {signalStudents.map((row) => (
                      <tr key={row.studentId}>
                        <td>{row.fullName||row.username||'Unknown'}</td>
                        <td>{row.email||'-'}</td>
                        <td>{row.signalCount||0}</td>
                        <td>{row.sessionCount||0}</td>
                        <td>{row.latestEventAt? new Date(row.latestEventAt).toLocaleString():'-'}</td>
                      </tr>
                    ))}
                    {signalStudents.length===0&&(
                      <tr><td colSpan="5">No students found for this signal.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {jobApplicantsModal.open&&(
        <div className="adm-modal-backdrop" onClick={closeJobApplicantsModal}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-head">
              <h3>{jobApplicantsModal.job?.title||'Job'} — Applicants</h3>
              <div className="adm-modal-actions">
                <button className="adm-icon-btn" onClick={closeJobApplicantsModal} title="Close"><X size={16} /></button>
              </div>
            </div>

            <p className="adm-subtitle" style={{marginTop: '0.25rem'}}>
              {jobApplicantsModal.job?.companyName||'Company'} · Status: {jobApplicantsModal.job?.status||'N/A'}
            </p>

            {jobApplicantsModal.loading&&<div className="adm-loading">Loading applicants...</div>}
            {!jobApplicantsModal.loading&&jobApplicantsModal.error&&<p className="adm-subtitle">{jobApplicantsModal.error}</p>}

            {!jobApplicantsModal.loading&&!jobApplicantsModal.error&&(
              <div className="adm-table-wrap" style={{marginTop: '0.65rem'}}>
                <table className="adm-table">
                  <thead><tr><th>Candidate</th><th>Email</th><th>Status</th><th>Score</th><th>Applied</th></tr></thead>
                  <tbody>
                    {jobApplicantsModal.applicants.map((row) => (
                      <tr key={row.id}>
                        <td>{row.candidate?.fullName||row.candidate?.username||'Unknown'}</td>
                        <td>{row.candidate?.email||'-'}</td>
                        <td>{row.status||'-'}</td>
                        <td>{row.score??0}</td>
                        <td>{row.appliedAt? new Date(row.appliedAt).toLocaleDateString():'-'}</td>
                      </tr>
                    ))}
                    {jobApplicantsModal.applicants.length===0&&(
                      <tr><td colSpan="5">No applicants found for this job.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;

/* ── Feature Toggle Card (used in Features tab) ───────────────── */
function FeatureToggleCard({feature, role, config, onToggle})
{
  const isEnabled=config[role]?.[feature.id]!==false;

  return (
    <div
      className={`adm-feature-card ${isEnabled?'enabled':'disabled'}`}
      onClick={()=>onToggle(role, feature.id)}
      style={{
        display:'flex', alignItems:'center', gap:'14px',
        padding:'14px 18px', borderRadius:'12px', cursor:'pointer',
        background:isEnabled?'rgba(99,102,241,0.06)':'rgba(239,68,68,0.04)',
        border:`1px solid ${isEnabled?'rgba(99,102,241,0.2)':'rgba(239,68,68,0.15)'}`,
        transition:'all 0.2s',
      }}
    >
      <div style={{
        width:'44px', height:'26px', borderRadius:'13px', position:'relative',
        background:isEnabled?'#6366f1':'#334155', transition:'background 0.25s', flexShrink:0,
      }}>
        <div style={{
          width:'20px', height:'20px', borderRadius:'50%', background:'#fff',
          position:'absolute', top:'3px', left:isEnabled?'21px':'3px',
          transition:'left 0.25s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontWeight:600, fontSize:'0.9rem', color:isEnabled?'#e2e8f0':'#94a3b8'}}>
          {feature.label}
        </div>
        <div style={{fontSize:'0.78rem', color:'#64748b', marginTop:'2px', lineHeight:'1.35'}}>
          {feature.desc}
        </div>
      </div>
      <span style={{
        fontSize:'0.72rem', fontWeight:600, padding:'3px 8px', borderRadius:'6px',
        background:isEnabled?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.12)',
        color:isEnabled?'#4ade80':'#f87171', flexShrink:0,
      }}>
        {isEnabled?'ON':'OFF'}
      </span>
    </div>
  );
}
