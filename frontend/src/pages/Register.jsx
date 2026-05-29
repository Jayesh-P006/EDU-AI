import {useState, useRef, useCallback, useEffect} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import {AnimatePresence, motion} from 'framer-motion';
import Webcam from 'react-webcam';
import
{
  UserPlus, Mail, KeyRound, ScanFace, Check, ChevronDown,
  Camera, Loader2
} from 'lucide-react';
import ScannerOverlay from '../components/ScannerOverlay';
import {loadFaceModels, extractDescriptor} from '../services/faceRecognition';
import api from '../services/api';
import './Register.css';

const STEPS={
  INFO: 'info',
  EMAIL: 'email',
  OTP: 'otp',
  CENTER: 'center',
  LEFT: 'left',
  RIGHT: 'right',
  FORM: 'form',
};

const STEP_ORDER=[STEPS.INFO, STEPS.EMAIL, STEPS.OTP, STEPS.CENTER, STEPS.LEFT, STEPS.RIGHT, STEPS.FORM];

const ROLE_OPTIONS=[
  {value: 'candidate', label: 'Candidate', description: 'Take assessments & interviews'},
  {value: 'company_admin', label: 'Company Admin', description: 'Manage company & postings'},
];

const stepInfo=[
  'Email verification via OTP',
  'Standard facing scan',
  'Left profile capture',
  'Right profile capture',
];

function Register()
{
  const [step, setStep]=useState(STEPS.INFO);
  const [role, setRole]=useState('candidate');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen]=useState(false);
  const [email, setEmail]=useState('');
  const [otp, setOtp]=useState('');
  const [images, setImages]=useState([]);
  const [descriptors, setDescriptors]=useState([]);
  const [username, setUsername]=useState('');
  const [password, setPassword]=useState('');
  const [confirmPassword, setConfirmPassword]=useState('');
  const [error, setError]=useState('');
  const [loading, setLoading]=useState(false);
  const [scanStatus, setScanStatus]=useState('idle');
  const [modelsReady, setModelsReady]=useState(false);

  const webcamRef=useRef(null);
  const navigate=useNavigate();

  const currentStepIndex=STEP_ORDER.indexOf(step);

  // Pre-load face-api.js models before the camera steps
  useEffect(() =>
  {
    if ((step===STEPS.OTP||step===STEPS.CENTER)&&!modelsReady)
    {
      loadFaceModels()
        .then(() => setModelsReady(true))
        .catch(() => setError('Failed to load face recognition models. Please refresh.'));
    }
  }, [step, modelsReady]);

  // ── OTP Handlers ────────────────────────────────────────────────
  const handleSendOtp=async () =>
  {
    setError('');
    setLoading(true);
    try
    {
      await api.post('/auth/send-otp', {email, purpose: 'register'});
      setStep(STEPS.OTP);
    } catch (err)
    {
      setError(err.response?.data?.message||'Failed to send OTP');
    } finally
    {
      setLoading(false);
    }
  };

  const handleVerifyOtp=async () =>
  {
    setError('');
    setLoading(true);
    try
    {
      const res=await api.post('/auth/verify-otp', {email, otp, purpose: 'register'});
      if (res.data?.data?.verified||res.data?.verified)
      {
        setStep(STEPS.CENTER);
      }
    } catch (err)
    {
      setError(err.response?.data?.message||'Invalid OTP');
    } finally
    {
      setLoading(false);
    }
  };

  // ── Camera Capture (extract descriptor immediately) ─────────────
  const captureImage=useCallback(async () =>
  {
    if (!webcamRef.current) return;
    setError('');
    setScanStatus('scanning');

    const imageSrc=webcamRef.current.getScreenshot();
    if (!imageSrc)
    {
      setScanStatus('error');
      setError('Could not capture image');
      return;
    }

    // Extract face descriptor immediately so we can retry if face not detected
    try
    {
      const result=await extractDescriptor(imageSrc);
      if (!result)
      {
        setScanStatus('error');
        setError('No face detected — keep your face visible and try again');
        return;
      }
      console.log(`[REGISTER] Capture OK: confidence=${result.detection.score.toFixed(3)}, dim=${result.descriptor.length}`);

      setScanStatus('success');
      setImages(prev => [...prev, imageSrc]);
      setDescriptors(prev => [...prev, result.descriptor]);

      setTimeout(() =>
      {
        setScanStatus('idle');
        if (step===STEPS.CENTER) setStep(STEPS.LEFT);
        else if (step===STEPS.LEFT) setStep(STEPS.RIGHT);
        else if (step===STEPS.RIGHT) setStep(STEPS.FORM);
      }, 600);
    } catch (err)
    {
      setScanStatus('error');
      setError('Face detection failed — please try again');
      console.error('[REGISTER] Capture error:', err);
    }
  }, [step]);

  // ── Final Submit ────────────────────────────────────────────────
  const handleFinalSubmit=async (e) =>
  {
    e.preventDefault();
    setError('');

    if (password!==confirmPassword)
    {
      setError('Passwords do not match');
      return;
    }
    if (password.length<6)
    {
      setError('Password must be at least 6 characters');
      return;
    }
    if (descriptors.length<3)
    {
      setError('Please capture all 3 face images first');
      return;
    }

    setLoading(true);
    try
    {
      console.log(`[REGISTER] Submitting ${descriptors.length} descriptors, dim=${descriptors[0]?.length}`);

      const res=await api.post('/auth/register', {
        username,
        email,
        password,
        confirmPassword,
        descriptors,
        role,
      });
      console.log('[REGISTER] Success:', res.data);
      const userData=res.data.data?.user||res.data.data||res.data;
      localStorage.setItem('user', JSON.stringify(userData));
      const dashPath=['company_admin', 'company_hr', 'recruiter'].includes(userData.role)
        ? '/company-dashboard':'/candidate-dashboard';
      navigate(dashPath);
    } catch (err)
    {
      setError(err.response?.data?.message||'Registration failed');
    } finally
    {
      setLoading(false);
    }
  };

  // ── Camera Step Renderer ────────────────────────────────────────
  const renderCameraStep=(title, instruction) =>
  {
    const scanMessages={
      idle: instruction,
      scanning: 'Capturing...',
      success: 'Captured!',
      error: 'Try again',
    };

    return (
      <motion.div
        key={step}
        initial={{opacity: 0, y: 10}}
        animate={{opacity: 1, y: 0}}
        exit={{opacity: 0, y: -10}}
        transition={{duration: 0.25}}
      >
        <div className="register-card">
          <div className="reg-step-header">
            <div className="reg-icon-wrap reg-icon-purple">
              <ScanFace size={22} />
            </div>
            <h2>{title}</h2>
            <p>{instruction}</p>
          </div>

          <div className="reg-webcam-wrap">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{facingMode: 'user', width: 640, height: 480}}
              mirrored
            />
            <ScannerOverlay
              scanning={scanStatus==='scanning'}
              status={scanStatus}
              message={scanMessages[scanStatus]}
            />
          </div>

          <button
            className="reg-btn-primary"
            onClick={captureImage}
            disabled={scanStatus==='scanning'||scanStatus==='success'}
          >
            {scanStatus==='scanning'? (
              <span className="spinner" />
            ):(
              <>
                <Camera size={16} />
                Capture
              </>
            )}
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="register-page">
      <div style={{maxWidth: 480, width: '100%', position: 'relative'}}>
        {/* Progress bar */}
        <div className="reg-progress">
          {STEP_ORDER.map((s, i) => (
            <div
              key={s}
              className={`reg-progress-step ${i<currentStepIndex? 'done':''} ${i===currentStepIndex? 'active':''}`}
            />
          ))}
        </div>

        {error&&<div className="reg-error">{error}</div>}

        <AnimatePresence mode="wait">
          {/* ── Step 0: Info ─────────────────────────────────── */}
          {step===STEPS.INFO&&(
            <motion.div
              key="info"
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -10}}
            >
              <div className="register-card">
                <div className="reg-step-header">
                  <div className="reg-icon-wrap reg-icon-blue">
                    <UserPlus size={22} />
                  </div>
                  <h2>Create Identity</h2>
                  <p>Begin your secure registration process</p>
                </div>

                {/* Role dropdown */}
                <div className="reg-role-selector">
                  <label>Select Role</label>
                  <button
                    type="button"
                    className="reg-role-btn"
                    onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                  >
                    {ROLE_OPTIONS.find(r => r.value===role)?.label||'Select role'}
                    <ChevronDown size={16} />
                  </button>
                  {isRoleDropdownOpen&&(
                    <div className="reg-role-dropdown">
                      {ROLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`reg-role-option ${role===opt.value? 'selected':''}`}
                          onClick={() => {setRole(opt.value); setIsRoleDropdownOpen(false);}}
                        >
                          <div>
                            <span>{opt.label}</span>
                            <small>{opt.description}</small>
                          </div>
                          {role===opt.value&&<Check size={14} color="#3b82f6" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Steps overview */}
                <div className="reg-steps-list">
                  {stepInfo.map((text, i) => (
                    <div key={i} className="reg-step-item">
                      <div className="reg-step-num">{i+1}</div>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>

                <button className="reg-btn-primary" onClick={() => setStep(STEPS.EMAIL)}>
                  Start Process
                </button>

                <Link to="/" className="reg-back-link" style={{textDecoration: 'none'}}>
                  Cancel registration
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── Step 1: Email ────────────────────────────────── */}
          {step===STEPS.EMAIL&&(
            <motion.div
              key="email"
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -10}}
            >
              <div className="register-card">
                <div className="reg-step-header">
                  <div className="reg-icon-wrap reg-icon-blue">
                    <Mail size={22} />
                  </div>
                  <h2>Email Verification</h2>
                  <p>We'll send a one-time code to verify your email</p>
                </div>

                <div className="reg-form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  className="reg-btn-primary"
                  onClick={handleSendOtp}
                  disabled={!email||loading}
                >
                  {loading? <span className="spinner" />:'Send Verification Code'}
                </button>

                <button className="reg-back-link" onClick={() => setStep(STEPS.INFO)}>
                  Go back
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: OTP ──────────────────────────────────── */}
          {step===STEPS.OTP&&(
            <motion.div
              key="otp"
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -10}}
            >
              <div className="register-card">
                <div className="reg-step-header">
                  <div className="reg-icon-wrap reg-icon-amber">
                    <KeyRound size={22} />
                  </div>
                  <h2>Enter OTP</h2>
                  <p>A 6-digit code was sent to <strong style={{color: 'var(--text-primary)'}}>{email}</strong></p>
                </div>

                <div className="reg-form-group">
                  <label>Verification Code</label>
                  <input
                    className="reg-otp-input"
                    placeholder="000000"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>

                <button
                  className="reg-btn-primary"
                  onClick={handleVerifyOtp}
                  disabled={otp.length!==6||loading}
                >
                  {loading? <span className="spinner" />:'Verify Code'}
                </button>

                <button
                  className="reg-back-link"
                  onClick={() => {setOtp(''); handleSendOtp();}}
                >
                  Resend code
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Steps 3-5: Camera ────────────────────────────── */}
          {step===STEPS.CENTER&&renderCameraStep('Primary Angle', 'Look directly into the camera')}
          {step===STEPS.LEFT&&renderCameraStep('Left Profile', 'Turn your head slightly to the left')}
          {step===STEPS.RIGHT&&renderCameraStep('Right Profile', 'Turn your head slightly to the right')}

          {/* ── Step 6: Final Form ───────────────────────────── */}
          {step===STEPS.FORM&&(
            <motion.div
              key="form"
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
            >
              <div className="register-card">
                <div className="reg-step-header">
                  <div className="reg-icon-wrap reg-icon-green">
                    <Check size={22} />
                  </div>
                  <h2>Face Captured</h2>
                  <p>Finalize your account details</p>
                </div>

                {/* Face thumbnails */}
                <div className="reg-face-previews">
                  {images.map((img, i) => (
                    <div key={i} className="reg-face-thumb">
                      <img src={img} alt={`scan ${i+1}`} />
                    </div>
                  ))}
                </div>

                {/* Verified email badge */}
                <div className="reg-verified-badge">
                  <Check size={16} />
                  <span className="email">{email}</span>
                  <span className="status">Verified</span>
                </div>

                <form onSubmit={handleFinalSubmit}>
                  <div className="reg-form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      placeholder="e.g. jdoe"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="reg-form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="reg-form-group">
                    <label>Confirm Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="reg-btn-primary" disabled={loading}>
                    {loading? <span className="spinner" />:'Complete Registration'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="reg-bottom-link">
          Already have an account?<Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
