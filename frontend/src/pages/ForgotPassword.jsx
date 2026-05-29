import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { KeyRound, Mail, Lock, Check } from 'lucide-react';
import api from '../services/api';
import './ForgotPassword.css';

const FSTEPS = { EMAIL: 'email', OTP: 'otp', RESET: 'reset', DONE: 'done' };
const FSTEP_ORDER = [FSTEPS.EMAIL, FSTEPS.OTP, FSTEPS.RESET, FSTEPS.DONE];

function ForgotPassword() {
  const [step, setStep] = useState(FSTEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const currentIdx = FSTEP_ORDER.indexOf(step);

  const handleSendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setStep(FSTEPS.OTP);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, otp, purpose: 'forgot_password' });
      if (res.data?.verified) {
        setStep(FSTEPS.RESET);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, password, confirmPassword });
      setStep(FSTEPS.DONE);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-page">
      <div style={{ maxWidth: 440, width: '100%' }}>
        {/* Progress */}
        <div className="forgot-progress">
          {FSTEP_ORDER.map((s, i) => (
            <div
              key={s}
              className={`forgot-progress-step ${i < currentIdx ? 'done' : ''} ${i === currentIdx ? 'active' : ''}`}
            />
          ))}
        </div>

        {error && <div className="forgot-error">{error}</div>}

        <AnimatePresence mode="wait">
          {/* ── Step 1: Email ─────────────────────────────────── */}
          {step === FSTEPS.EMAIL && (
            <motion.div key="email" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="forgot-card">
                <div className="forgot-header">
                  <div className="forgot-icon-wrap">
                    <Mail size={22} />
                  </div>
                  <h2>Forgot Password?</h2>
                  <p>Enter your email and we'll send you a reset code</p>
                </div>

                <div className="forgot-form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button className="forgot-btn" onClick={handleSendOtp} disabled={!email || loading}>
                  {loading ? <span className="spinner" /> : 'Send Reset Code'}
                </button>

                <Link to="/login" className="forgot-back-link">← Back to Login</Link>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: OTP ──────────────────────────────────── */}
          {step === FSTEPS.OTP && (
            <motion.div key="otp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="forgot-card">
                <div className="forgot-header">
                  <div className="forgot-icon-wrap">
                    <KeyRound size={22} />
                  </div>
                  <h2>Enter Reset Code</h2>
                  <p>A 6-digit code was sent to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong></p>
                </div>

                <div className="forgot-form-group">
                  <label>Verification Code</label>
                  <input
                    className="forgot-otp-input"
                    placeholder="000000"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>

                <button className="forgot-btn" onClick={handleVerifyOtp} disabled={otp.length !== 6 || loading}>
                  {loading ? <span className="spinner" /> : 'Verify Code'}
                </button>

                <button
                  className="forgot-back-link"
                  style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                  onClick={() => { setOtp(''); handleSendOtp(); }}
                >
                  Resend code
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: New Password ─────────────────────────── */}
          {step === FSTEPS.RESET && (
            <motion.div key="reset" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="forgot-card">
                <div className="forgot-header">
                  <div className="forgot-icon-wrap" style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)', color: '#3b82f6' }}>
                    <Lock size={22} />
                  </div>
                  <h2>Set New Password</h2>
                  <p>Create a strong password for your account</p>
                </div>

                <form onSubmit={handleResetPassword}>
                  <div className="forgot-form-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="forgot-form-group">
                    <label>Confirm Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="forgot-btn" disabled={loading}>
                    {loading ? <span className="spinner" /> : 'Reset Password'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Done ─────────────────────────────────── */}
          {step === FSTEPS.DONE && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="forgot-card" style={{ textAlign: 'center' }}>
                <div className="forgot-header">
                  <div className="forgot-icon-wrap" style={{ background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>
                    <Check size={22} />
                  </div>
                  <h2>Password Reset!</h2>
                  <p>Your password has been updated. You can now log in.</p>
                </div>

                <button className="forgot-btn" onClick={() => navigate('/login')}>
                  Go to Login
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ForgotPassword;
