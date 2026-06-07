import { useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Github, Linkedin, Globe, FileText, User, Mail, Phone,
  GraduationCap, Briefcase, CheckCircle, AlertCircle, X,
  Shield, Loader, ArrowLeft, Lock, Star, ChevronRight, Zap, Search,
} from 'lucide-react';
import api from '../services/api';
import './CandidateApply.css';

const MOCK_JOBS = {
  default: { title: 'Software Engineer', company: 'TechCorp Solutions', location: 'Bangalore, India', type: 'Full-time', department: 'Engineering' },
  'backend-go': { title: 'Backend Engineer (Go)', company: 'Google India', location: 'Hyderabad, India', type: 'Full-time', department: 'Backend' },
  'senior-fullstack': { title: 'Senior Full-Stack Engineer', company: 'TechCorp Solutions', location: 'Remote', type: 'Full-time', department: 'Platform' },
};

function FieldGroup({ label, required, children, error, hint }) {
  return (
    <div className="ca-field-group">
      <label className="ca-label">
        {label}
        {required && <span className="ca-required">*</span>}
        {hint && <span className="ca-hint">{hint}</span>}
      </label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.span className="ca-field-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AlertCircle size={12} /> {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function FileUploadZone({ file, onFile, onRemove, error }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const handleDragLeave = useCallback(() => setDragging(false), []);
  const handleChange = useCallback((e) => { if (e.target.files[0]) onFile(e.target.files[0]); }, [onFile]);

  if (file) {
    return (
      <motion.div className="ca-file-uploaded" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="ca-file-icon"><FileText size={22} color="#22c55e" /></div>
        <div className="ca-file-info">
          <span className="ca-file-name">{file.name}</span>
          <span className="ca-file-size">{(file.size / 1024).toFixed(1)} KB · PDF</span>
        </div>
        <div className="ca-file-check"><CheckCircle size={18} color="#22c55e" /></div>
        <button type="button" className="ca-file-remove" onClick={onRemove}>
          <X size={15} />
        </button>
      </motion.div>
    );
  }

  return (
    <div
      className={`ca-upload-zone ${dragging ? 'dragging' : ''} ${error ? 'has-error' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div className={`ca-upload-icon-wrap ${dragging ? 'dragging' : ''}`}>
        <Upload size={28} />
      </div>
      <p className="ca-upload-text">
        Drag & drop your resume or{' '}
        <span className="ca-upload-browse">browse files</span>
      </p>
      <p className="ca-upload-hint">PDF, DOC or DOCX · Max 10MB</p>
    </div>
  );
}

export default function CandidateApply() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const job = MOCK_JOBS[jobId] || MOCK_JOBS.default;

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    college: '',
    experience: '',
    githubUrl: '',
    linkedinUrl: '',
    portfolioUrl: '',
    coverLetter: '',
  });
  const [resume, setResume] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
  }

  function validate() {
    const errs = {};
    if (!form.fullName.trim() || form.fullName.trim().length < 2)
      errs.fullName = 'Full name is required (min 2 characters)';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'A valid email address is required';
    if (!form.college.trim())
      errs.college = 'College / University is required';
    if (!form.experience.trim() || isNaN(Number(form.experience)) || Number(form.experience) < 0)
      errs.experience = 'Please enter valid years of experience';
    if (!resume)
      errs.resume = 'Resume is required';
    if (form.githubUrl.trim() && !/^https?:\/\/(www\.)?github\.com\/.+/.test(form.githubUrl.trim())) {
      errs.githubUrl = 'Enter a valid GitHub URL (e.g. https://github.com/username)';
    }
    if (form.linkedinUrl && !/^https?:\/\/(www\.)?linkedin\.com\/.+/.test(form.linkedinUrl))
      errs.linkedinUrl = 'Enter a valid LinkedIn URL';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstErr = document.querySelector('.ca-field-error, .has-error');
      firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    fd.append('resume', resume);

    try {
      await api.post(`/jobs/${jobId || 'default'}/apply`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch {
      // In demo mode navigate anyway
    } finally {
      setSubmitting(false);
      navigate('/application/success', {
        state: { candidateName: form.fullName, jobTitle: job.title, company: job.company },
      });
    }
  }

  return (
    <div className="ca-page">
      {/* Job Header */}
      <header className="ca-job-header">
        <div className="ca-job-header-inner">
          <button type="button" className="ca-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>
          <div className="ca-job-info">
            <div className="ca-verified-badge">
              <Shield size={13} color="#3b82f6" /> AI-Verified Application
            </div>
            <h1 className="ca-job-title">{job.title}</h1>
            <div className="ca-job-meta">
              <span>{job.company}</span>
              <span className="ca-meta-dot">·</span>
              <span>{job.location}</span>
              <span className="ca-meta-dot">·</span>
              <span>{job.type}</span>
            </div>
          </div>
          <div className="ca-secure-note">
            <Lock size={13} />
            <span>256-bit encrypted · Secure</span>
          </div>
        </div>
      </header>

      <div className="ca-body">
        <form className="ca-form" onSubmit={handleSubmit} noValidate>

          {/* Personal Information */}
          <motion.section className="ca-section" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="ca-section-header">
              <div className="ca-section-icon" style={{ background: '#3b82f618' }}>
                <User size={16} color="#3b82f6" />
              </div>
              <h2>Personal Information</h2>
            </div>
            <div className="ca-fields-grid">
              <FieldGroup label="Full Name" required error={errors.fullName}>
                <input
                  className={`ca-input ${errors.fullName ? 'error' : ''}`}
                  placeholder="John Doe"
                  value={form.fullName}
                  onChange={e => setField('fullName', e.target.value)}
                />
              </FieldGroup>
              <FieldGroup label="Email Address" required error={errors.email}>
                <input
                  className={`ca-input ${errors.email ? 'error' : ''}`}
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                />
              </FieldGroup>
              <FieldGroup label="Phone Number" error={errors.phone} hint="Optional">
                <input
                  className="ca-input"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                />
              </FieldGroup>
              <FieldGroup label="College / University" required error={errors.college}>
                <input
                  className={`ca-input ${errors.college ? 'error' : ''}`}
                  placeholder="IIT Delhi"
                  value={form.college}
                  onChange={e => setField('college', e.target.value)}
                />
              </FieldGroup>
            </div>
          </motion.section>

          {/* Professional Details */}
          <motion.section className="ca-section" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="ca-section-header">
              <div className="ca-section-icon" style={{ background: '#a855f718' }}>
                <Briefcase size={16} color="#a855f7" />
              </div>
              <h2>Professional Details</h2>
            </div>
            <div className="ca-fields-grid ca-fields-grid--narrow">
              <FieldGroup label="Years of Experience" required error={errors.experience}>
                <input
                  className={`ca-input ${errors.experience ? 'error' : ''}`}
                  type="number"
                  min="0"
                  max="50"
                  placeholder="e.g. 2"
                  value={form.experience}
                  onChange={e => setField('experience', e.target.value)}
                />
              </FieldGroup>
            </div>
          </motion.section>

          {/* Resume Upload */}
          <motion.section className="ca-section" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="ca-section-header">
              <div className="ca-section-icon" style={{ background: '#22c55e18' }}>
                <FileText size={16} color="#22c55e" />
              </div>
              <h2>Resume <span className="ca-required">*</span></h2>
            </div>
            <FileUploadZone file={resume} onFile={setResume} onRemove={() => setResume(null)} error={errors.resume} />
            <AnimatePresence>
              {errors.resume && (
                <motion.span className="ca-field-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <AlertCircle size={12} /> {errors.resume}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.section>

          {/* GitHub Auto-Discovery Notice */}
          <motion.section className="ca-section ca-autodiscover-section" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="ca-section-header">
              <div className="ca-section-icon" style={{ background: '#3b82f618' }}>
                <Zap size={16} color="#3b82f6" />
              </div>
              <h2>Automatic GitHub Discovery</h2>
            </div>
            <div className="ca-autodiscover-callout">
              <div className="ca-autodiscover-icon-wrap">
                <Search size={22} color="#3b82f6" />
              </div>
              <div className="ca-autodiscover-body">
                <strong>No manual entry required.</strong>
                <p>
                  After you upload your resume, our AI engine will automatically scan it for GitHub repository
                  URLs and project references. All discovered repositories are verified in <strong>parallel</strong> —
                  generating individual scores for each project and an aggregated Candidate Trust Score.
                </p>
                <div className="ca-autodiscover-flow">
                  {['Resume Parsed', 'GitHub Links Extracted', 'Parallel Verification', 'Trust Score'].map((step, i, arr) => (
                    <span key={step} className="ca-flow-item">
                      <span>{step}</span>
                      {i < arr.length - 1 && <span className="ca-flow-arrow">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <FieldGroup label="GitHub Profile URL" hint="Optional — helps if resume doesn't contain explicit links" error={errors.githubUrl}>
              <div className="ca-url-input-wrap">
                <Github size={15} className="ca-url-icon" />
                <input
                  className="ca-input ca-url-input"
                  placeholder="https://github.com/yourusername (optional)"
                  value={form.githubUrl}
                  onChange={e => setField('githubUrl', e.target.value)}
                />
              </div>
            </FieldGroup>
          </motion.section>

          {/* Additional Links */}
          <motion.section className="ca-section" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="ca-section-header">
              <div className="ca-section-icon" style={{ background: '#eab30818' }}>
                <Globe size={16} color="#eab308" />
              </div>
              <h2>Additional Links <span className="ca-optional-tag">Optional</span></h2>
            </div>
            <div className="ca-fields-grid">
              <FieldGroup label="LinkedIn Profile" error={errors.linkedinUrl}>
                <div className="ca-url-input-wrap">
                  <Linkedin size={15} className="ca-url-icon" style={{ color: '#0077b5' }} />
                  <input
                    className="ca-input ca-url-input"
                    placeholder="https://linkedin.com/in/yourname"
                    value={form.linkedinUrl}
                    onChange={e => setField('linkedinUrl', e.target.value)}
                  />
                </div>
              </FieldGroup>
              <FieldGroup label="Portfolio / Website" error={errors.portfolioUrl}>
                <div className="ca-url-input-wrap">
                  <Globe size={15} className="ca-url-icon" />
                  <input
                    className="ca-input ca-url-input"
                    placeholder="https://yourportfolio.dev"
                    value={form.portfolioUrl}
                    onChange={e => setField('portfolioUrl', e.target.value)}
                  />
                </div>
              </FieldGroup>
            </div>
          </motion.section>

          {/* Cover Letter */}
          <motion.section className="ca-section" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="ca-section-header">
              <div className="ca-section-icon" style={{ background: '#f9731618' }}>
                <Mail size={16} color="#f97316" />
              </div>
              <h2>Cover Letter <span className="ca-optional-tag">Optional</span></h2>
            </div>
            <textarea
              className="ca-textarea"
              rows={6}
              placeholder="Tell us why you're excited about this role and what makes you a great fit for the team..."
              value={form.coverLetter}
              onChange={e => setField('coverLetter', e.target.value)}
            />
            <div className="ca-char-count">{form.coverLetter.length} / 2000</div>
          </motion.section>

          {/* Submit Error */}
          <AnimatePresence>
            {submitError && (
              <motion.div className="ca-submit-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AlertCircle size={16} color="#ef4444" />
                <span>{submitError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.div className="ca-submit-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
            <div className="ca-submit-note">
              <Shield size={13} color="#22c55e" />
              <span>By submitting, you agree that your resume and GitHub repository will be analyzed by our AI verification engine to generate a trust score for recruiters.</span>
            </div>
            <button className="ca-submit-btn" type="submit" disabled={submitting}>
              {submitting
                ? <><Loader size={18} className="ca-btn-spinner" /> Submitting...</>
                : <><ChevronRight size={18} /> Apply Now</>}
            </button>
          </motion.div>
        </form>

        {/* Sidebar */}
        <aside className="ca-sidebar">
          <motion.div className="ca-sidebar-card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h3 className="ca-sidebar-title">What happens after you apply?</h3>
            <div className="ca-sidebar-steps">
              {[
                { icon: FileText, color: '#3b82f6', title: 'Resume Analysis', desc: 'Skills, projects and technologies are extracted automatically.' },
                { icon: Github, color: '#e2e8f0', title: 'GitHub Verification', desc: 'Repositories analyzed and cross-referenced with resume claims.' },
                { icon: Shield, color: '#22c55e', title: 'Trust Score', desc: 'AI-powered score (0–100) assigned to your profile.' },
                { icon: Star, color: '#f59e0b', title: 'Recruiter Review', desc: 'Recruiters get a detailed evidence-backed report.' },
              ].map(({ icon: Icon, color, title, desc }, i) => (
                <div key={i} className="ca-sidebar-step">
                  <div className="ca-sidebar-step-num" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                    <Icon size={14} color={color} />
                  </div>
                  <div className="ca-sidebar-step-body">
                    <div className="ca-sidebar-step-title">{title}</div>
                    <div className="ca-sidebar-step-desc">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div className="ca-sidebar-card ca-checklist-card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <h3 className="ca-sidebar-title">Application Checklist</h3>
            <ul className="ca-checklist">
              {[
                { label: 'Resume (PDF or DOCX)', done: !!resume },
                { label: 'Public GitHub profile', done: /github\.com/.test(form.githubUrl) },
                { label: 'Personal information', done: form.fullName.length > 1 && form.email.includes('@') },
                { label: 'College / University', done: form.college.length > 1 },
                { label: 'Experience (years)', done: form.experience.length > 0 },
              ].map(({ label, done }, i) => (
                <li key={i} className={`ca-checklist-item ${done ? 'done' : ''}`}>
                  {done
                    ? <CheckCircle size={14} color="#22c55e" />
                    : <div className="ca-checklist-circle" />}
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div className="ca-sidebar-card ca-stats-mini-card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
            <div className="ca-stat-mini">
              <span className="ca-stat-mini-val" style={{ color: '#3b82f6' }}>24</span>
              <span className="ca-stat-mini-lbl">Applicants</span>
            </div>
            <div className="ca-stat-mini">
              <span className="ca-stat-mini-val" style={{ color: '#22c55e' }}>76</span>
              <span className="ca-stat-mini-lbl">Avg Trust Score</span>
            </div>
            <div className="ca-stat-mini">
              <span className="ca-stat-mini-val" style={{ color: '#f59e0b' }}>~2 min</span>
              <span className="ca-stat-mini-lbl">Analysis Time</span>
            </div>
          </motion.div>
        </aside>
      </div>
    </div>
  );
}
