import {useState, useRef, useCallback, useEffect} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import {AnimatePresence, motion} from 'framer-motion';
import Webcam from 'react-webcam';
import {Shield, Lock, ScanFace, Loader2, GraduationCap, Building2, UserCheck} from 'lucide-react';
import ScannerOverlay from '../components/ScannerOverlay';
import {loadFaceModels, extractDescriptor} from '../services/faceRecognition';
import {authService} from '../services/authService';
import api from '../services/api';
import './Login.css';

function Login()
{
  const [mode, setMode]=useState('password'); // 'password' | 'biometric'
  const [username, setUsername]=useState('');
  const [password, setPassword]=useState('');
  const [loading, setLoading]=useState(false);
  const [error, setError]=useState('');
  const [scanStatus, setScanStatus]=useState('idle'); // idle | loading-models | scanning | success | error
  const [modelsReady, setModelsReady]=useState(false);
  const webcamRef=useRef(null);
  const navigate=useNavigate();
  const [demoSeeded, setDemoSeeded]=useState(false);

  // Seed demo accounts on first load
  useEffect(() =>
  {
    if (!demoSeeded)
    {
      api.post('/auth/seed-demo').then(() => setDemoSeeded(true)).catch(() => {});
    }
  }, [demoSeeded]);

  // Pre-load face-api.js models when biometric tab is selected
  useEffect(() =>
  {
    if (mode==='biometric'&&!modelsReady)
    {
      setScanStatus('loading-models');
      loadFaceModels()
        .then(() =>
        {
          setModelsReady(true);
          setScanStatus('idle');
        })
        .catch((err) =>
        {
          setError('Failed to load face recognition models. Please refresh.');
          setScanStatus('error');
        });
    }
  }, [mode, modelsReady]);

  const getDashboardPath=(role) =>
  {
    return ['company_admin', 'company_hr', 'recruiter'].includes(role)
      ? '/company-dashboard':'/candidate-dashboard';
  };

  // ── Password Login ──────────────────────────────────────────────
  const handlePasswordLogin=async (e) =>
  {
    e.preventDefault();
    setError('');
    setLoading(true);

    try
    {
      const res=await api.post('/auth/login', {username, password});
      console.log('[LOGIN] Success:', res.data);
      const userData=res.data.data?.user||res.data.data||res.data;
      authService.setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      navigate(getDashboardPath(userData.role));
    } catch (err)
    {
      setError(err.response?.data?.message||'Login failed');
    } finally
    {
      setLoading(false);
    }
  };

  // ── Face Login ──────────────────────────────────────────────────
  const handleFaceLogin=useCallback(async () =>
  {
    if (!webcamRef.current||!modelsReady) return;
    setError('');
    setScanStatus('scanning');

    const imageSrc=webcamRef.current.getScreenshot();
    if (!imageSrc)
    {
      setScanStatus('error');
      setError('Could not capture image from camera');
      return;
    }

    try
    {
      // Extract 128-dim face descriptor using face-api.js neural network
      const result=await extractDescriptor(imageSrc);
      if (!result)
      {
        setScanStatus('error');
        setError('No face detected. Please position your face clearly in the frame.');
        setTimeout(() => setScanStatus('idle'), 2000);
        return;
      }

      console.log(`[FACE-LOGIN] Descriptor extracted (dim=${result.descriptor.length}, confidence=${result.detection.score.toFixed(3)})`);

      // Send the descriptor (NOT the image) to the backend
      const res=await api.post('/auth/face-login', {descriptor: result.descriptor});
      setScanStatus('success');
      console.log('[FACE-LOGIN] Success:', res.data);
      const userData=res.data.data?.user||res.data.data||res.data;
      authService.setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      setTimeout(() => navigate(getDashboardPath(userData.role)), 800);
    } catch (err)
    {
      setScanStatus('error');
      setError(err.response?.data?.message||'Face recognition failed');
      setTimeout(() => setScanStatus('idle'), 2000);
    }
  }, [navigate, modelsReady]);

  // ── Demo Login ───────────────────────────────────────────────
  const handleDemoLogin=async (demoUsername) =>
  {
    setError('');
    setLoading(true);
    try
    {
      const res=await api.post('/auth/login', {username: demoUsername, password: 'demo123'});
      console.log('[DEMO-LOGIN] Success:', res.data);
      const userData=res.data.data?.user||res.data.data||res.data;
      authService.setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      navigate(getDashboardPath(userData.role));
    } catch (err)
    {
      setError(err.response?.data?.message||'Demo login failed');
    } finally
    {
      setLoading(false);
    }
  };

  const scanMessages={
    idle: 'Position your face in the frame',
    'loading-models': 'Loading face recognition models...',
    scanning: 'Analyzing biometric data...',
    success: 'Identity verified',
    error: 'Recognition failed',
  };

  return (
    <div className="login-page">
      <motion.div
        className="login-card"
        initial={{opacity: 0, y: 20}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.4}}
      >
        {/* Header */}
        <div className="login-header">
          <div className="login-icon-wrap">
            <Shield size={24} />
          </div>
          <h1>Welcome Back</h1>
          <p>Sign in to continue to HireSpec</p>
        </div>

        {/* Mode Tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab ${mode==='password'? 'active':''}`}
            onClick={() => {setMode('password'); setError('');}}
          >
            <Lock size={16} />
            Password
          </button>
          <button
            className={`login-tab ${mode==='biometric'? 'active':''}`}
            onClick={() => {setMode('biometric'); setError(''); setScanStatus('idle');}}
          >
            <ScanFace size={16} />
            Biometric
          </button>
        </div>

        {/* Error */}
        {error&&<div className="login-error">{error}</div>}

        <AnimatePresence mode="wait">
          {/* ── Password Tab ─────────────────────────────────── */}
          {mode==='password'&&(
            <motion.div
              key="password"
              initial={{opacity: 0, x: -10}}
              animate={{opacity: 1, x: 0}}
              exit={{opacity: 0, x: 10}}
              transition={{duration: 0.2}}
            >
              <form onSubmit={handlePasswordLogin} className="login-form">
                <div className="login-form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                  />
                </div>

                <div className="login-form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>

                <div className="login-form-footer">
                  <Link to="/forgot-password">Forgot Password?</Link>
                </div>

                <button type="submit" className="login-submit-btn" disabled={loading}>
                  {loading? <span className="spinner" />:'Sign In'}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Biometric Tab ────────────────────────────────── */}
          {mode==='biometric'&&(
            <motion.div
              key="biometric"
              initial={{opacity: 0, x: 10}}
              animate={{opacity: 1, x: 0}}
              exit={{opacity: 0, x: -10}}
              transition={{duration: 0.2}}
            >
              <div className="face-login-section">
                <div className="face-login-webcam-wrap">
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
                  className="login-submit-btn"
                  onClick={handleFaceLogin}
                  disabled={!modelsReady||scanStatus==='scanning'||scanStatus==='success'}
                >
                  {scanStatus==='loading-models'? (
                    <>
                      <Loader2 size={16} className="spinner" style={{border: 'none', animation: 'spin 1s linear infinite'}} />
                      Loading Models...
                    </>
                  ):scanStatus==='scanning'? (
                    <>
                      <Loader2 size={16} className="spinner" style={{border: 'none', animation: 'spin 1s linear infinite'}} />
                      Scanning...
                    </>
                  ):scanStatus==='success'? (
                    'Verified!'
                  ):(
                    <>
                      <ScanFace size={16} />
                      Scan Face
                    </>
                  )}
                </button>

                <p className="face-login-hint">
                  Look directly at the camera and ensure good lighting.<br />
                  Your face data is processed securely.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Demo Accounts */}
        <div className="demo-accounts-section">
          <div className="demo-divider">
            <span>or try a demo account</span>
          </div>
          <div className="demo-buttons">
            <button
              className="demo-btn demo-btn-student"
              onClick={() => handleDemoLogin('demo_student')}
              disabled={loading}
            >
              <GraduationCap size={18} />
              <div>
                <span className="demo-btn-title">Student</span>
                <span className="demo-btn-sub">Candidate Dashboard</span>
              </div>
            </button>
            <button
              className="demo-btn demo-btn-company"
              onClick={() => handleDemoLogin('demo_company')}
              disabled={loading}
            >
              <Building2 size={18} />
              <div>
                <span className="demo-btn-title">Company</span>
                <span className="demo-btn-sub">Admin Dashboard</span>
              </div>
            </button>
            <button
              className="demo-btn demo-btn-recruiter"
              onClick={() => handleDemoLogin('demo_recruiter')}
              disabled={loading}
            >
              <UserCheck size={18} />
              <div>
                <span className="demo-btn-title">Recruiter</span>
                <span className="demo-btn-sub">Hiring Dashboard</span>
              </div>
            </button>
          </div>
        </div>

        <p className="login-bottom-link">
          Don't have an account?<Link to="/register">Sign up</Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Login;
