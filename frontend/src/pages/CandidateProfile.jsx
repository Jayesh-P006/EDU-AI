import {useState, useEffect, useRef} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import
  {
    User, Mail, Phone, MapPin, Linkedin, Github, Globe, Briefcase,
    GraduationCap, FolderOpen, Award, Languages, Upload, FileText,
    ChevronLeft, Save, Trash2, CheckCircle, AlertCircle, Star,
    BarChart3, Target, Shield, Clock, Building2, Edit3, Plus, X, TrendingUp
  } from 'lucide-react';
import api from '../services/api';
import './CandidateProfile.css';

function CandidateProfile()
{
  const navigate=useNavigate();
  const fileInputRef=useRef(null);
  const [user, setUser]=useState(null);
  const [profile, setProfile]=useState(null);
  const [loading, setLoading]=useState(true);
  const [saving, setSaving]=useState(false);
  const [activeSection, setActiveSection]=useState('basic');
  const [resumeText, setResumeText]=useState('');
  const [atsResult, setAtsResult]=useState(null);
  const [jdText, setJdText]=useState('');
  const [atsLoading, setAtsLoading]=useState(false);
  const [uploadLoading, setUploadLoading]=useState(false);
  const [message, setMessage]=useState(null);

  useEffect(() =>
  {
    const stored=localStorage.getItem('user');
    if (stored)
    {
      const u=JSON.parse(stored);
      setUser(u);
      fetchProfile(u.id||u._id);
    } else
    {
      navigate('/login');
    }
  }, []);

  const fetchProfile=async (userId) =>
  {
    try
    {
      const res=await api.get(`/profile/${userId}`);
      setProfile(res.data.profile);
      if (res.data.profile.resumeText)
      {
        setResumeText(res.data.profile.resumeText);
      }
    } catch (err)
    {
      console.error('Profile fetch error:', err);
      // Initialize empty profile
      setProfile({
        fullName: '', phone: '', location: '', linkedIn: '', github: '',
        portfolio: '', headline: '', bio: '', skills: [], education: [],
        experience: [], projects: [], certifications: [], languages: [],
        desiredRole: '', desiredSalary: '', availability: 'immediate',
        workPreference: 'remote',
      });
    } finally
    {
      setLoading(false);
    }
  };

  const showMessage=(text, type='success') =>
  {
    setMessage({text, type});
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSave=async () =>
  {
    setSaving(true);
    try
    {
      const userId=user.id||user._id;
      const res=await api.put(`/profile/${userId}`, profile);
      setProfile(res.data.profile);
      showMessage('Profile saved successfully!');
    } catch (err)
    {
      showMessage(err.response?.data?.error||'Failed to save profile', 'error');
    } finally
    {
      setSaving(false);
    }
  };

  const handleResumeUpload=async () =>
  {
    if (!resumeText.trim()) return showMessage('Please paste your resume text', 'error');
    setUploadLoading(true);
    try
    {
      const userId=user.id||user._id;
      const res=await api.post(`/profile/${userId}/resume`, {resumeText});
      setProfile(res.data.profile);
      showMessage('Resume uploaded and parsed successfully!');
    } catch (err)
    {
      showMessage(err.response?.data?.error||'Failed to upload resume', 'error');
    } finally
    {
      setUploadLoading(false);
    }
  };

  const handleFileUpload=async (e) =>
  {
    const file=e.target.files?.[0];
    if (!file) return;

    const isPdf=file.type==='application/pdf'||file.name.endsWith('.pdf');
    const isTxt=file.type==='text/plain'||file.name.endsWith('.txt');

    if (isPdf)
    {
      // Upload PDF directly to backend for server-side parsing
      setUploadLoading(true);
      try
      {
        const userId=user.id||user._id;
        const formData=new FormData();
        formData.append('resume', file);
        const res=await api.post(`/profile/${userId}/resume/file`, formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });
        setProfile(res.data.profile);
        if (res.data.profile?.resumeText)
        {
          setResumeText(res.data.profile.resumeText);
        }
        showMessage('PDF resume uploaded and parsed successfully!');
      } catch (err)
      {
        showMessage(err.response?.data?.error||'Failed to parse PDF', 'error');
      } finally
      {
        setUploadLoading(false);
      }
    } else if (isTxt)
    {
      const reader=new FileReader();
      reader.onload=(ev) =>
      {
        setResumeText(ev.target.result);
        showMessage('File loaded. Click "Upload & Parse" to process.');
      };
      reader.readAsText(file);
    } else
    {
      showMessage('Please upload a .pdf or .txt file', 'error');
    }
  };

  const handleDeleteResume=async () =>
  {
    try
    {
      const userId=user.id||user._id;
      await api.delete(`/profile/${userId}/resume`);
      setResumeText('');
      fetchProfile(userId);
      showMessage('Resume deleted');
    } catch (err)
    {
      showMessage('Failed to delete resume', 'error');
    }
  };

  const handleATSCheck=async (withJd=false) =>
  {
    if (withJd&&!jdText.trim()) return showMessage('Please paste a job description for JD comparison', 'error');
    setAtsLoading(true);
    try
    {
      const userId=user.id||user._id;
      const res=await api.post(`/profile/${userId}/resume-analyze`, {jdText: withJd? jdText:''});
      setAtsResult(res.data.report);
      showMessage('Resume analysis complete!');
    } catch (err)
    {
      showMessage(err.response?.data?.error||'Resume analysis failed', 'error');
    } finally
    {
      setAtsLoading(false);
    }
  };

  const updateField=(field, value) =>
  {
    setProfile(prev => ({...prev, [field]: value}));
  };

  // Education helpers
  const addEducation=() =>
  {
    setProfile(prev => ({
      ...prev,
      education: [...(prev.education||[]), {institution: '', degree: '', field: '', startYear: '', endYear: '', grade: ''}]
    }));
  };
  const removeEducation=(idx) =>
  {
    setProfile(prev => ({...prev, education: prev.education.filter((_, i) => i!==idx)}));
  };
  const updateEducation=(idx, field, value) =>
  {
    setProfile(prev =>
    {
      const edu=[...prev.education];
      edu[idx]={...edu[idx], [field]: value};
      return {...prev, education: edu};
    });
  };

  // Experience helpers
  const addExperience=() =>
  {
    setProfile(prev => ({
      ...prev,
      experience: [...(prev.experience||[]), {company: '', title: '', startDate: '', endDate: '', current: false, description: ''}]
    }));
  };
  const removeExperience=(idx) =>
  {
    setProfile(prev => ({...prev, experience: prev.experience.filter((_, i) => i!==idx)}));
  };
  const updateExperience=(idx, field, value) =>
  {
    setProfile(prev =>
    {
      const exp=[...prev.experience];
      exp[idx]={...exp[idx], [field]: value};
      return {...prev, experience: exp};
    });
  };

  // Project helpers
  const addProject=() =>
  {
    setProfile(prev => ({
      ...prev,
      projects: [...(prev.projects||[]), {name: '', description: '', technologies: '', link: ''}]
    }));
  };
  const removeProject=(idx) =>
  {
    setProfile(prev => ({...prev, projects: prev.projects.filter((_, i) => i!==idx)}));
  };
  const updateProject=(idx, field, value) =>
  {
    setProfile(prev =>
    {
      const proj=[...prev.projects];
      proj[idx]={...proj[idx], [field]: value};
      return {...prev, projects: proj};
    });
  };

  // Skills helpers
  const [skillInput, setSkillInput]=useState('');
  const addSkill=() =>
  {
    if (!skillInput.trim()) return;
    const newSkills=skillInput.split(',').map(s => s.trim()).filter(s => s&&!(profile.skills||[]).includes(s));
    setProfile(prev => ({...prev, skills: [...(prev.skills||[]), ...newSkills]}));
    setSkillInput('');
  };
  const removeSkill=(skill) =>
  {
    setProfile(prev => ({...prev, skills: (prev.skills||[]).filter(s => s!==skill)}));
  };

  if (loading||!profile)
  {
    return (
      <div className="cp-page">
        <div className="cp-loading">
          <div className="cp-spinner" />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  const profileCompletion=profile.profileComplete||10;

  const sections=[
    {key: 'basic', label: 'Basic Info', icon: <User size={16} />},
    {key: 'resume', label: 'Resume', icon: <FileText size={16} />},
    {key: 'skills', label: 'Skills', icon: <Target size={16} />},
    {key: 'education', label: 'Education', icon: <GraduationCap size={16} />},
    {key: 'experience', label: 'Experience', icon: <Briefcase size={16} />},
    {key: 'projects', label: 'Projects', icon: <FolderOpen size={16} />},
    {key: 'ats', label: 'Resume Analyzer', icon: <BarChart3 size={16} />},
    {key: 'preferences', label: 'Preferences', icon: <Star size={16} />},
  ];

  return (
    <div className="cp-page">
      {/* Header */}
      <header className="cp-header">
        <div className="cp-header-inner">
          <button className="cp-back-btn" onClick={() => navigate('/candidate-dashboard')}>
            <ChevronLeft size={20} /> Back to Dashboard
          </button>
          <h1>My Profile</h1>
          <div className="cp-header-actions">
            <button className="cp-verify-btn" onClick={() => navigate('/resume-verification')}>
              <Shield size={16} /> Resume Verification
            </button>
            <button className="cp-save-btn" onClick={handleSave} disabled={saving}>
              <Save size={16} /> {saving? 'Saving...':'Save Profile'}
            </button>
          </div>
        </div>
      </header>

      {/* Toast Message */}
      {message&&(
        <div className={`cp-toast ${message.type}`}>
          {message.type==='success'? <CheckCircle size={16} />:<AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      <div className="cp-layout">
        {/* Sidebar */}
        <aside className="cp-sidebar">
          <div className="cp-profile-card">
            <div className="cp-avatar">{(profile.fullName||user?.username||'U').charAt(0).toUpperCase()}</div>
            <h3>{profile.fullName||user?.username||'User'}</h3>
            <p className="cp-headline">{profile.headline||'Add a headline'}</p>
            <div className="cp-completion">
              <div className="cp-completion-header">
                <span>Profile Completion</span>
                <span>{profileCompletion}%</span>
              </div>
              <div className="cp-completion-bar">
                <div className="cp-completion-fill" style={{width: `${profileCompletion}%`}} />
              </div>
            </div>
          </div>

          <nav className="cp-nav">
            {sections.map(s => (
              <button
                key={s.key}
                className={`cp-nav-item ${activeSection===s.key? 'active':''}`}
                onClick={() => setActiveSection(s.key)}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="cp-main">
          {/* ── Basic Info ── */}
          {activeSection==='basic'&&(
            <div className="cp-section">
              <h2><User size={20} /> Basic Information</h2>
              <div className="cp-form-grid">
                <div className="cp-field">
                  <label><User size={14} /> Full Name</label>
                  <input value={profile.fullName||''} onChange={e => updateField('fullName', e.target.value)} placeholder="John Doe" />
                </div>
                <div className="cp-field">
                  <label><Mail size={14} /> Email</label>
                  <input value={user?.email||''} disabled className="cp-disabled" />
                </div>
                <div className="cp-field">
                  <label><Phone size={14} /> Phone</label>
                  <input value={profile.phone||''} onChange={e => updateField('phone', e.target.value)} placeholder="+91 9876543210" />
                </div>
                <div className="cp-field">
                  <label><MapPin size={14} /> Location</label>
                  <input value={profile.location||''} onChange={e => updateField('location', e.target.value)} placeholder="City, State, Country" />
                </div>
                <div className="cp-field">
                  <label><Linkedin size={14} /> LinkedIn</label>
                  <input value={profile.linkedIn||''} onChange={e => updateField('linkedIn', e.target.value)} placeholder="https://linkedin.com/in/..." />
                </div>
                <div className="cp-field">
                  <label><Github size={14} /> GitHub</label>
                  <input value={profile.github||''} onChange={e => updateField('github', e.target.value)} placeholder="https://github.com/..." />
                </div>
                <div className="cp-field">
                  <label><Globe size={14} /> Portfolio</label>
                  <input value={profile.portfolio||''} onChange={e => updateField('portfolio', e.target.value)} placeholder="https://myportfolio.com" />
                </div>
                <div className="cp-field">
                  <label><Edit3 size={14} /> Headline</label>
                  <input value={profile.headline||''} onChange={e => updateField('headline', e.target.value)} placeholder="Full Stack Developer | React | Node.js" />
                </div>
              </div>
              <div className="cp-field cp-full">
                <label><Edit3 size={14} /> Bio / Summary</label>
                <textarea rows={4} value={profile.bio||''} onChange={e => updateField('bio', e.target.value)} placeholder="Write a brief professional summary..." />
              </div>
            </div>
          )}

          {/* ── Resume ── */}
          {activeSection==='resume'&&(
            <div className="cp-section">
              <h2><FileText size={20} /> Resume</h2>
              {profile.resumeFileName&&(
                <div className="cp-resume-status">
                  <CheckCircle size={16} />
                  <span>Resume uploaded: <strong>{profile.resumeFileName}</strong></span>
                  <span className="cp-resume-date">
                    {profile.resumeUploadedAt? new Date(profile.resumeUploadedAt).toLocaleDateString():''}
                  </span>
                  <button className="cp-delete-resume" onClick={handleDeleteResume}>
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              )}

              <div className="cp-resume-upload">
                <div className="cp-upload-area" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={40} />
                  <h3>Upload Resume</h3>
                  <p>Click to upload a <strong>.pdf</strong> or .txt file, or paste your resume text below</p>
                  <span className="cp-upload-formats">Supported: PDF, TXT (max 10 MB)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,application/pdf,text/plain"
                    onChange={handleFileUpload}
                    style={{display: 'none'}}
                  />
                </div>

                <div className="cp-field cp-full">
                  <label>Paste Resume Text</label>
                  <textarea
                    rows={12}
                    value={resumeText}
                    onChange={e => setResumeText(e.target.value)}
                    placeholder="Paste your entire resume text here... The system will auto-extract skills, experience, education, and contact information."
                    className="cp-resume-textarea"
                  />
                </div>

                <button className="cp-upload-btn" onClick={handleResumeUpload} disabled={uploadLoading}>
                  <Upload size={16} /> {uploadLoading? 'Parsing...':'Upload & Parse Resume'}
                </button>
              </div>

              {/* Parsed Resume Data */}
              {profile.resumeParsed&&(
                <div className="cp-parsed-data">
                  <h3>Parsed Resume Data</h3>
                  <div className="cp-parsed-grid">
                    {profile.resumeParsed.candidate&&(
                      <div className="cp-parsed-card">
                        <h4><User size={16} /> Contact Info</h4>
                        <div className="cp-parsed-items">
                          {profile.resumeParsed.candidate.name&&<p><strong>Name:</strong> {profile.resumeParsed.candidate.name}</p>}
                          {profile.resumeParsed.candidate.email&&<p><strong>Email:</strong> {profile.resumeParsed.candidate.email}</p>}
                          {profile.resumeParsed.candidate.phone&&<p><strong>Phone:</strong> {profile.resumeParsed.candidate.phone}</p>}
                          {profile.resumeParsed.candidate.linkedin&&<p><strong>LinkedIn:</strong> {profile.resumeParsed.candidate.linkedin}</p>}
                          {profile.resumeParsed.candidate.github&&<p><strong>GitHub:</strong> {profile.resumeParsed.candidate.github}</p>}
                        </div>
                      </div>
                    )}
                    {profile.resumeParsed.experience&&(
                      <div className="cp-parsed-card">
                        <h4><Briefcase size={16} /> Experience</h4>
                        <div className="cp-parsed-items">
                          <p><strong>Years:</strong> {profile.resumeParsed.experience.years??'N/A'}</p>
                          <p><strong>Seniority:</strong> {profile.resumeParsed.experience.seniority||'N/A'}</p>
                        </div>
                      </div>
                    )}
                    {profile.resumeParsed.skills?.technical?.length>0&&(
                      <div className="cp-parsed-card cp-full-card">
                        <h4><Target size={16} /> Detected Skills</h4>
                        <div className="cp-skill-tags">
                          {profile.resumeParsed.skills.technical.map((s, i) => (
                            <span key={i} className="cp-skill-tag technical">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {profile.resumeParsed.skills?.soft?.length>0&&(
                      <div className="cp-parsed-card cp-full-card">
                        <h4><Star size={16} /> Soft Skills</h4>
                        <div className="cp-skill-tags">
                          {profile.resumeParsed.skills.soft.map((s, i) => (
                            <span key={i} className="cp-skill-tag soft">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Skills ── */}
          {activeSection==='skills'&&(
            <div className="cp-section">
              <h2><Target size={20} /> Skills</h2>
              <div className="cp-skills-input">
                <input
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => e.key==='Enter'&&(e.preventDefault(), addSkill())}
                  placeholder="Add skills (comma separated)"
                />
                <button onClick={addSkill}><Plus size={16} /> Add</button>
              </div>
              <div className="cp-skill-tags">
                {(profile.skills||[]).map((skill, i) => (
                  <span key={i} className="cp-skill-tag editable">
                    {skill}
                    <button onClick={() => removeSkill(skill)}><X size={12} /></button>
                  </span>
                ))}
                {(!profile.skills||profile.skills.length===0)&&(
                  <p className="cp-empty-hint">No skills added. Add skills above or upload your resume to auto-detect.</p>
                )}
              </div>

              {/* Categorized skills from resume */}
              {profile.resumeParsed?.skills?.categorized&&Object.keys(profile.resumeParsed.skills.categorized).length>0&&(
                <div className="cp-categorized-skills">
                  <h3>Skills by Category (from Resume)</h3>
                  {Object.entries(profile.resumeParsed.skills.categorized).map(([cat, skills]) => (
                    <div key={cat} className="cp-skill-category">
                      <h4>{cat}</h4>
                      <div className="cp-skill-tags">
                        {skills.map((s, i) => <span key={i} className="cp-skill-tag category">{s}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Education ── */}
          {activeSection==='education'&&(
            <div className="cp-section">
              <h2><GraduationCap size={20} /> Education</h2>
              {(profile.education||[]).map((edu, idx) => (
                <div className="cp-entry-card" key={idx}>
                  <button className="cp-remove-entry" onClick={() => removeEducation(idx)}><X size={16} /></button>
                  <div className="cp-form-grid">
                    <div className="cp-field">
                      <label>Institution</label>
                      <input value={edu.institution||''} onChange={e => updateEducation(idx, 'institution', e.target.value)} placeholder="University name" />
                    </div>
                    <div className="cp-field">
                      <label>Degree</label>
                      <input value={edu.degree||''} onChange={e => updateEducation(idx, 'degree', e.target.value)} placeholder="B.Tech, M.S., etc." />
                    </div>
                    <div className="cp-field">
                      <label>Field of Study</label>
                      <input value={edu.field||''} onChange={e => updateEducation(idx, 'field', e.target.value)} placeholder="Computer Science" />
                    </div>
                    <div className="cp-field">
                      <label>Grade / GPA</label>
                      <input value={edu.grade||''} onChange={e => updateEducation(idx, 'grade', e.target.value)} placeholder="8.5 / 10" />
                    </div>
                    <div className="cp-field">
                      <label>Start Year</label>
                      <input value={edu.startYear||''} onChange={e => updateEducation(idx, 'startYear', e.target.value)} placeholder="2020" />
                    </div>
                    <div className="cp-field">
                      <label>End Year</label>
                      <input value={edu.endYear||''} onChange={e => updateEducation(idx, 'endYear', e.target.value)} placeholder="2024" />
                    </div>
                  </div>
                </div>
              ))}
              <button className="cp-add-btn" onClick={addEducation}><Plus size={16} /> Add Education</button>
            </div>
          )}

          {/* ── Experience ── */}
          {activeSection==='experience'&&(
            <div className="cp-section">
              <h2><Briefcase size={20} /> Work Experience</h2>
              {(profile.experience||[]).map((exp, idx) => (
                <div className="cp-entry-card" key={idx}>
                  <button className="cp-remove-entry" onClick={() => removeExperience(idx)}><X size={16} /></button>
                  <div className="cp-form-grid">
                    <div className="cp-field">
                      <label>Company</label>
                      <input value={exp.company||''} onChange={e => updateExperience(idx, 'company', e.target.value)} placeholder="Company name" />
                    </div>
                    <div className="cp-field">
                      <label>Job Title</label>
                      <input value={exp.title||''} onChange={e => updateExperience(idx, 'title', e.target.value)} placeholder="Software Engineer" />
                    </div>
                    <div className="cp-field">
                      <label>Start Date</label>
                      <input type="month" value={exp.startDate||''} onChange={e => updateExperience(idx, 'startDate', e.target.value)} />
                    </div>
                    <div className="cp-field">
                      <label>End Date</label>
                      <input type="month" value={exp.endDate||''} onChange={e => updateExperience(idx, 'endDate', e.target.value)} disabled={exp.current} />
                    </div>
                  </div>
                  <label className="cp-checkbox">
                    <input type="checkbox" checked={exp.current||false} onChange={e => updateExperience(idx, 'current', e.target.checked)} />
                    Currently working here
                  </label>
                  <div className="cp-field cp-full">
                    <label>Description</label>
                    <textarea rows={3} value={exp.description||''} onChange={e => updateExperience(idx, 'description', e.target.value)} placeholder="Describe your role and achievements..." />
                  </div>
                </div>
              ))}
              <button className="cp-add-btn" onClick={addExperience}><Plus size={16} /> Add Experience</button>
            </div>
          )}

          {/* ── Projects ── */}
          {activeSection==='projects'&&(
            <div className="cp-section">
              <h2><FolderOpen size={20} /> Projects</h2>
              {(profile.projects||[]).map((proj, idx) => (
                <div className="cp-entry-card" key={idx}>
                  <button className="cp-remove-entry" onClick={() => removeProject(idx)}><X size={16} /></button>
                  <div className="cp-form-grid">
                    <div className="cp-field">
                      <label>Project Name</label>
                      <input value={proj.name||''} onChange={e => updateProject(idx, 'name', e.target.value)} placeholder="Project name" />
                    </div>
                    <div className="cp-field">
                      <label>Link</label>
                      <input value={proj.link||''} onChange={e => updateProject(idx, 'link', e.target.value)} placeholder="https://github.com/..." />
                    </div>
                    <div className="cp-field">
                      <label>Technologies</label>
                      <input value={proj.technologies||''} onChange={e => updateProject(idx, 'technologies', e.target.value)} placeholder="React, Node.js, MongoDB" />
                    </div>
                  </div>
                  <div className="cp-field cp-full">
                    <label>Description</label>
                    <textarea rows={3} value={proj.description||''} onChange={e => updateProject(idx, 'description', e.target.value)} placeholder="Describe the project..." />
                  </div>
                </div>
              ))}
              <button className="cp-add-btn" onClick={addProject}><Plus size={16} /> Add Project</button>
            </div>
          )}

          {/* ── Resume Analyzer ── */}
          {activeSection==='ats'&&(
            <div className="cp-section">
              <h2><BarChart3 size={20} /> Resume Analyzer</h2>
              <p className="cp-section-desc">
                Get a detailed analysis of your resume's strengths, weaknesses, and improvement areas. Optionally paste a job description for targeted comparison.
              </p>

              {!profile.resumeText&&(
                <div className="cp-warning">
                  <AlertCircle size={16} />
                  Please upload your resume first in the Resume section.
                </div>
              )}

              <div className="cp-analyzer-actions">
                <button className="cp-ats-btn" onClick={() => handleATSCheck(false)} disabled={atsLoading||!profile.resumeText}>
                  <BarChart3 size={16} /> {atsLoading? 'Analyzing...':'Analyze My Resume'}
                </button>
              </div>

              <div className="cp-jd-optional">
                <details>
                  <summary><Target size={14} /> Compare with Job Description (optional)</summary>
                  <div className="cp-field cp-full" style={{marginTop: '1rem'}}>
                    <textarea
                      rows={6}
                      value={jdText}
                      onChange={e => setJdText(e.target.value)}
                      placeholder="Paste a job description to see how well your resume matches..."
                      className="cp-jd-textarea"
                    />
                  </div>
                  <button className="cp-ats-btn secondary" onClick={() => handleATSCheck(true)} disabled={atsLoading||!profile.resumeText}>
                    <Target size={16} /> {atsLoading? 'Comparing...':'Compare with JD'}
                  </button>
                </details>
              </div>

              {atsResult&&(
                <div className="cp-analyzer-results">
                  {/* Overall Score + Grade */}
                  <div className="cp-analyzer-hero">
                    <div className={`cp-ats-circle ${atsResult.overallScore>=70? 'good':atsResult.overallScore>=45? 'fair':'poor'}`}>
                      <span className="cp-ats-number">{atsResult.overallScore}</span>
                      <span className="cp-ats-label">Overall Score</span>
                    </div>
                    <div className={`cp-grade-badge grade-${atsResult.grade}`}>
                      <span className="grade-letter">{atsResult.grade}</span>
                      <span className="grade-label">Grade</span>
                    </div>
                    <div className="cp-hero-meta">
                      <p className="cp-word-count">{atsResult.wordCount} words &middot; {atsResult.charCount} characters</p>
                    </div>
                  </div>

                  {/* Section Scores */}
                  <div className="cp-analyzer-sections">
                    {/* Contact Info */}
                    <div className="cp-analyzer-card">
                      <div className="cp-analyzer-card-header">
                        <h4><User size={16} /> Contact Information</h4>
                        <span className={`cp-section-score ${atsResult.contactAnalysis?.score>=70? 'good':atsResult.contactAnalysis?.score>=40? 'fair':'poor'}`}>
                          {atsResult.contactAnalysis?.score}%
                        </span>
                      </div>
                      <div className="cp-score-bar"><div className={`cp-score-fill ${atsResult.contactAnalysis?.score>=70? 'good':atsResult.contactAnalysis?.score>=40? 'fair':'poor'}`} style={{width: `${atsResult.contactAnalysis?.score||0}%`}} /></div>
                      {atsResult.contactAnalysis?.present?.length>0&&(
                        <div className="cp-analyzer-tags">
                          {atsResult.contactAnalysis.present.map((f, i) => (
                            <span key={i} className="cp-skill-tag matched"><CheckCircle size={10} /> {f}</span>
                          ))}
                        </div>
                      )}
                      {atsResult.contactAnalysis?.missing?.length>0&&(
                        <div className="cp-analyzer-tags">
                          {atsResult.contactAnalysis.missing.map((f, i) => (
                            <span key={i} className="cp-skill-tag missing"><AlertCircle size={10} /> {f}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Skills */}
                    <div className="cp-analyzer-card">
                      <div className="cp-analyzer-card-header">
                        <h4><Target size={16} /> Skills Analysis</h4>
                        <span className={`cp-section-score ${atsResult.skillsAnalysis?.score>=70? 'good':atsResult.skillsAnalysis?.score>=40? 'fair':'poor'}`}>
                          {atsResult.skillsAnalysis?.strength}
                        </span>
                      </div>
                      <div className="cp-score-bar"><div className={`cp-score-fill ${atsResult.skillsAnalysis?.score>=70? 'good':atsResult.skillsAnalysis?.score>=40? 'fair':'poor'}`} style={{width: `${Math.min(100, atsResult.skillsAnalysis?.score||0)}%`}} /></div>
                      <p className="cp-analyzer-stat">{atsResult.skillsAnalysis?.technicalCount} technical &middot; {atsResult.skillsAnalysis?.softCount} soft &middot; {atsResult.skillsAnalysis?.totalUnique} total</p>
                      {atsResult.skillsAnalysis?.technical?.length>0&&(
                        <div className="cp-analyzer-tags">
                          {atsResult.skillsAnalysis.technical.slice(0, 15).map((s, i) => (
                            <span key={i} className="cp-skill-tag technical">{s}</span>
                          ))}
                          {atsResult.skillsAnalysis.technical.length>15&&(
                            <span className="cp-skill-tag more">+{atsResult.skillsAnalysis.technical.length-15} more</span>
                          )}
                        </div>
                      )}
                      {atsResult.skillsAnalysis?.soft?.length>0&&(
                        <div className="cp-analyzer-tags" style={{marginTop: '0.5rem'}}>
                          {atsResult.skillsAnalysis.soft.map((s, i) => (
                            <span key={i} className="cp-skill-tag soft">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Experience */}
                    <div className="cp-analyzer-card">
                      <div className="cp-analyzer-card-header">
                        <h4><Briefcase size={16} /> Experience</h4>
                        <span className={`cp-section-score ${atsResult.experienceAnalysis?.score>=60? 'good':atsResult.experienceAnalysis?.score>=30? 'fair':'poor'}`}>
                          {atsResult.experienceAnalysis?.strength}
                        </span>
                      </div>
                      <div className="cp-score-bar"><div className={`cp-score-fill ${atsResult.experienceAnalysis?.score>=60? 'good':atsResult.experienceAnalysis?.score>=30? 'fair':'poor'}`} style={{width: `${atsResult.experienceAnalysis?.score||0}%`}} /></div>
                      <p className="cp-analyzer-stat">
                        {atsResult.experienceAnalysis?.years!=null? `${atsResult.experienceAnalysis.years} years`:'Not detected'}
                        {atsResult.experienceAnalysis?.seniority!=='Not specified'? ` · ${atsResult.experienceAnalysis.seniority}`:''}
                      </p>
                    </div>

                    {/* Education */}
                    <div className="cp-analyzer-card">
                      <div className="cp-analyzer-card-header">
                        <h4><GraduationCap size={16} /> Education</h4>
                        <span className={`cp-section-score ${atsResult.educationAnalysis?.score>=60? 'good':atsResult.educationAnalysis?.score>=30? 'fair':'poor'}`}>
                          {atsResult.educationAnalysis?.strength}
                        </span>
                      </div>
                      <div className="cp-score-bar"><div className={`cp-score-fill ${atsResult.educationAnalysis?.score>=60? 'good':atsResult.educationAnalysis?.score>=30? 'fair':'poor'}`} style={{width: `${atsResult.educationAnalysis?.score||0}%`}} /></div>
                      {atsResult.educationAnalysis?.qualifications?.length>0&&(
                        <div className="cp-analyzer-tags">
                          {atsResult.educationAnalysis.qualifications.map((q, i) => (
                            <span key={i} className="cp-skill-tag category">{q}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Content Quality */}
                    <div className="cp-analyzer-card">
                      <div className="cp-analyzer-card-header">
                        <h4><FileText size={16} /> Content Quality</h4>
                        <span className={`cp-section-score ${atsResult.contentAnalysis?.score>=60? 'good':atsResult.contentAnalysis?.score>=30? 'fair':'poor'}`}>
                          {atsResult.contentAnalysis?.strength}
                        </span>
                      </div>
                      <div className="cp-score-bar"><div className={`cp-score-fill ${atsResult.contentAnalysis?.score>=60? 'good':atsResult.contentAnalysis?.score>=30? 'fair':'poor'}`} style={{width: `${atsResult.contentAnalysis?.score||0}%`}} /></div>
                      <div className="cp-content-checks">
                        <span className={atsResult.contentAnalysis?.hasQuantifiableResults? 'check-pass':'check-fail'}>
                          {atsResult.contentAnalysis?.hasQuantifiableResults? <CheckCircle size={12} />:<AlertCircle size={12} />} Quantifiable results
                        </span>
                        <span className={atsResult.contentAnalysis?.hasProjects? 'check-pass':'check-fail'}>
                          {atsResult.contentAnalysis?.hasProjects? <CheckCircle size={12} />:<AlertCircle size={12} />} Project descriptions
                        </span>
                        <span className={atsResult.contentAnalysis?.hasCertifications? 'check-pass':'check-fail'}>
                          {atsResult.contentAnalysis?.hasCertifications? <CheckCircle size={12} />:<AlertCircle size={12} />} Certifications
                        </span>
                        <span className={atsResult.contentAnalysis?.hasAchievements? 'check-pass':'check-fail'}>
                          {atsResult.contentAnalysis?.hasAchievements? <CheckCircle size={12} />:<AlertCircle size={12} />} Achievements
                        </span>
                      </div>
                      {atsResult.contentAnalysis?.actionVerbs?.length>0&&(
                        <div className="cp-analyzer-tags" style={{marginTop: '0.5rem'}}>
                          <small style={{color: 'var(--text-secondary)', marginRight: '0.5rem'}}>Action verbs found:</small>
                          {atsResult.contentAnalysis.actionVerbs.map((v, i) => (
                            <span key={i} className="cp-skill-tag matched" style={{fontSize: '0.7rem'}}>{v}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* JD Comparison */}
                  {atsResult.jdComparison&&(
                    <div className="cp-analyzer-jd-section">
                      <h3><Target size={18} /> Job Description Match</h3>
                      <div className="cp-analyzer-jd-score">
                        <div className={`cp-ats-circle small ${atsResult.jdComparison.matchPercentage>=70? 'good':atsResult.jdComparison.matchPercentage>=40? 'fair':'poor'}`}>
                          <span className="cp-ats-number">{atsResult.jdComparison.matchPercentage}</span>
                          <span className="cp-ats-label">Match %</span>
                        </div>
                        <div className="cp-jd-meta">
                          <p><strong>Role:</strong> {atsResult.jdComparison.jdRole}</p>
                          <p><strong>Experience:</strong> {atsResult.jdComparison.experienceMatch} ({atsResult.jdComparison.jdYears??'?'}yr required / {atsResult.jdComparison.resumeYears??'?'}yr on resume)</p>
                        </div>
                      </div>
                      {atsResult.jdComparison.matched?.length>0&&(
                        <div className="cp-ats-detail-card cp-full-card">
                          <h4><CheckCircle size={16} /> Matched Skills ({atsResult.jdComparison.matched.length})</h4>
                          <div className="cp-skill-tags">
                            {atsResult.jdComparison.matched.map((s, i) => (
                              <span key={i} className="cp-skill-tag matched">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(atsResult.jdComparison.missing?.critical?.length>0||atsResult.jdComparison.missing?.medium?.length>0)&&(
                        <div className="cp-ats-detail-card cp-full-card">
                          <h4><AlertCircle size={16} /> Missing Skills</h4>
                          <div className="cp-skill-tags">
                            {(atsResult.jdComparison.missing.critical||[]).map((s, i) => (
                              <span key={`c-${i}`} className="cp-skill-tag missing critical">{s}</span>
                            ))}
                            {(atsResult.jdComparison.missing.medium||[]).map((s, i) => (
                              <span key={`m-${i}`} className="cp-skill-tag missing">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recommendations */}
                  {atsResult.recommendations?.length>0&&(
                    <div className="cp-analyzer-recommendations">
                      <h3><TrendingUp size={18} /> Recommendations</h3>
                      <ul>
                        {atsResult.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Preferences ── */}
          {activeSection==='preferences'&&(
            <div className="cp-section">
              <h2><Star size={20} /> Job Preferences</h2>
              <div className="cp-form-grid">
                <div className="cp-field">
                  <label><Briefcase size={14} /> Desired Role</label>
                  <input value={profile.desiredRole||''} onChange={e => updateField('desiredRole', e.target.value)} placeholder="Frontend Developer" />
                </div>
                <div className="cp-field">
                  <label>Expected Salary</label>
                  <input value={profile.desiredSalary||''} onChange={e => updateField('desiredSalary', e.target.value)} placeholder="e.g., 8-12 LPA" />
                </div>
                <div className="cp-field">
                  <label>Availability</label>
                  <select value={profile.availability||'immediate'} onChange={e => updateField('availability', e.target.value)}>
                    <option value="immediate">Immediate</option>
                    <option value="2-weeks">2 Weeks Notice</option>
                    <option value="1-month">1 Month Notice</option>
                    <option value="2-months">2 Months Notice</option>
                    <option value="3-months">3 Months Notice</option>
                    <option value="not-looking">Not Looking</option>
                  </select>
                </div>
                <div className="cp-field">
                  <label>Work Preference</label>
                  <select value={profile.workPreference||'remote'} onChange={e => updateField('workPreference', e.target.value)}>
                    <option value="remote">Remote</option>
                    <option value="onsite">On-site</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>
              </div>

              <div className="cp-field cp-full" style={{marginTop: '1.5rem'}}>
                <label><Award size={14} /> Certifications (comma separated)</label>
                <input
                  value={(profile.certifications||[]).join(', ')}
                  onChange={e => updateField('certifications', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="AWS Certified, Google Cloud, etc."
                />
              </div>

              <div className="cp-field cp-full">
                <label><Languages size={14} /> Languages Spoken (comma separated)</label>
                <input
                  value={(profile.languages||[]).join(', ')}
                  onChange={e => updateField('languages', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="English, Hindi, etc."
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default CandidateProfile;
