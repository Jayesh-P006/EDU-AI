import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import {registerFace, verifyFace, checkFaceExists} from '../services/faceService.js';
import {APIResponse} from '../middleware/response.js';
import sendEmail, {isEmailConfigured} from '../services/sendEmail.js';

const router=express.Router();

// ── JWT Configuration ──────────────────────────────────────────────
const JWT_SECRET=process.env.JWT_SECRET||'dev-secret-key-change-in-production';
const JWT_EXPIRY='7d';

// ── Helper functions ────────────────────────────────────────────────
function generateToken(userId)
{
  return jwt.sign({userId, iat: Math.floor(Date.now()/1000)}, JWT_SECRET, {expiresIn: JWT_EXPIRY});
}

function setTokenCookie(res, token)
{
  // Set HTTP-only cookie (cannot be accessed by JavaScript)
  res.cookie('authToken', token, {
    httpOnly: true,         // Prevent JS access (XSS protection)
    secure: process.env.NODE_ENV==='production',  // Only send over HTTPS in production
    sameSite: 'None',     // CSRF protection
    path: '/',
    maxAge: 7*24*60*60*1000, // 7 days
  });
}



// ── Helpers ─────────────────────────────────────────────────────────
function generateOTP(length=6)
{
  return Array.from({length}, () => Math.floor(Math.random()*10)).join('');
}

function hashPassword(password)
{
  const salt=crypto.randomBytes(16).toString('hex');
  const hash=crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');  // Increased from 10000 to 100000 iterations
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored)
{
  const [salt, hash]=stored.split(':');
  const verify=crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');  // Increased from 10000 to 100000 iterations
  return hash===verify;
}

// ── Send OTP ────────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) =>
{
  try
  {
    const email=(req.body.email||'').trim().toLowerCase();
    const purpose=req.body.purpose||'register';

    if (!email)
    {
      return APIResponse.error(res, 'Email is required', 400);
    }

    if (purpose==='register')
    {
      const existing=await User.findOne({email});
      if (existing)
      {
        return APIResponse.error(res, 'Email is already registered', 400);
      }
    }

    if (purpose==='forgot_password')
    {
      const existing=await User.findOne({email});
      if (!existing)
      {
        return APIResponse.error(res, 'No account found with this email', 404);
      }
    }

    const otp=generateOTP();
    const expiresAt=new Date(Date.now()+10*60*1000);

    // Upsert OTP (replace any existing OTP for same email+purpose)
    await Otp.findOneAndUpdate(
      {email, purpose},
      {otp, expiresAt, used: false},
      {upsert: true, new: true}
    );

    // Try to send email
    const subject=purpose==='register'? 'Your Registration OTP – RecruitAI':'Password Reset OTP – RecruitAI';
    const html=`
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 30px; background: #0a0a0a; color: #fff; border-radius: 12px;">
        <h2 style="text-align: center; color: #fff;">🛡️ RecruitAI</h2>
        <p style="text-align: center; color: #a3a3a3;">Your verification code</p>
        <div style="text-align: center; font-size: 36px; font-weight: 700; letter-spacing: 6px; padding: 20px; background: #1a1a1a; border-radius: 8px; margin: 20px 0;">${otp}</div>
        <p style="text-align: center; color: #737373; font-size: 12px;">This code expires in 10 minutes</p>
      </div>
    `;

    try
    {
      await sendEmail(email, subject, `Your RecruitAI OTP is: ${otp}`, html);
    } catch (mailErr)
    {
      console.error(`[AUTH] Mail send failed: ${mailErr.message} for ${email}`);
    }

    return APIResponse.success(res, {}, 'OTP sent successfully');
  } catch (err)
  {
    console.error('[AUTH] send-otp error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Verify OTP ──────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) =>
{
  try
  {
    const email=(req.body.email||'').trim().toLowerCase();
    const otp=req.body.otp||'';
    const purpose=req.body.purpose||'register';

    if (!email||!otp)
    {
      return APIResponse.error(res, 'Email and OTP are required', 400);
    }

    const stored=await Otp.findOne({email, purpose, used: false});

    if (!stored)
    {
      return APIResponse.error(res, 'Invalid or expired OTP', 400);
    }

    if (new Date()>stored.expiresAt)
    {
      await Otp.deleteOne({_id: stored._id});
      return APIResponse.error(res, 'OTP has expired', 400);
    }

    if (stored.otp!==otp)
    {
      return APIResponse.error(res, 'Invalid OTP', 400);
    }

    stored.used=true;
    await stored.save();
    return APIResponse.success(res, {verified: true}, 'OTP verified');
  } catch (err)
  {
    console.error('[AUTH] verify-otp error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Register (with face descriptors) ─────────────────────────────────
router.post('/register', async (req, res) =>
{
  try
  {
    const {username, email: rawEmail, password, confirmPassword, descriptors, role: rawRole, companyName}=req.body;
    const email=(rawEmail||'').trim().toLowerCase();
    const role=['candidate', 'company_admin', 'company_hr', 'recruiter', 'proctor'].includes(rawRole)? rawRole:'candidate';

    if (!username||!email||!password)
    {
      console.log('[AUTH] Register 400: missing fields', {username: !!username, email: !!email, password: !!password});
      return APIResponse.error(res, 'Username, email and password are required', 400);
    }

    if (password!==confirmPassword)
    {
      console.log('[AUTH] Register 400: passwords do not match');
      return APIResponse.error(res, 'Passwords do not match', 400);
    }

    if (password.length<6)
    {
      console.log('[AUTH] Register 400: password too short');
      return APIResponse.error(res, 'Password must be at least 6 characters', 400);
    }

    if (!descriptors||descriptors.length<3)
    {
      console.log('[AUTH] Register 400: insufficient descriptors', {count: descriptors?.length||0});
      return APIResponse.error(res, 'Please provide at least 3 face descriptors', 400);
    }

    // Check uniqueness in MongoDB
    const existingUser=await User.findOne({$or: [{username: username.toLowerCase()}, {email}]});
    if (existingUser)
    {
      if (existingUser.username===username.toLowerCase())
      {
        console.log(`[AUTH] Register 400: username already exists: ${username}`);
        return APIResponse.error(res, 'Username already exists', 400);
      }
      console.log(`[AUTH] Register 400: email already registered: ${email}`);
      return APIResponse.error(res, 'Email is already registered', 400);
    }

    // Check if face already exists in Pinecone
    try
    {
      const {exists, userId: existingFaceUser}=await checkFaceExists(descriptors[0]);
      if (exists)
      {
        console.log(`[AUTH] Face already registered to: ${existingFaceUser}`);
        return APIResponse.error(res, 'This face is already registered', 409);
      }
    } catch (faceCheckErr)
    {
      console.log(`[AUTH] Face duplicate check skipped: ${faceCheckErr.message}`);
    }

    // Register face descriptors in Pinecone
    const {result: faceResult, error: faceError}=await registerFace(username.toLowerCase(), descriptors);
    if (faceError)
    {
      console.error(`[AUTH] Face registration failed: ${faceError}`);
    }

    // Create user in MongoDB
    const user=await User.create({
      username: username.toLowerCase(),
      email,
      password: hashPassword(password),
      role,
      companyName: companyName||'',
      faceRegistered: !!faceResult,
    });

    console.log(`[AUTH] ✅ User registered: ${username} (${role}) with ${descriptors.length} face descriptors | Pinecone: ${faceResult? 'stored':'skipped'}`);

    // Generate JWT token and set HTTP-only cookie
    const token=generateToken(user._id.toString());
    setTokenCookie(res, token);

    // Return user data (no token in response)
    return APIResponse.success(res, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        faceRegistered: user.faceRegistered,
        createdAt: user.createdAt,
      },
    }, 'User registered successfully', 201);
  } catch (err)
  {
    console.error('[AUTH] register error:', err);
    if (err.code===11000)
    {
      return APIResponse.error(res, 'Username or email already exists', 400);
    }
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Login (password) ────────────────────────────────────────────────
router.post('/login', async (req, res) =>
{
  try
  {
    const {username, password}=req.body;

    if (!username||!password)
    {
      return APIResponse.error(res, 'Username and password are required', 401);
    }

    const user=await User.findOne({username: username.toLowerCase()});
    if (!user||!verifyPassword(password, user.password))
    {
      return APIResponse.error(res, 'Invalid username or password', 401);
    }

    console.log(`[AUTH] ✅ Login successful: ${username}`);

    // Generate JWT token and set HTTP-only cookie
    const token=generateToken(user._id.toString());
    setTokenCookie(res, token);

    // Return user data (no token in response)
    return APIResponse.success(res, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        createdAt: user.createdAt,
      },
    }, 'Login successful');
  } catch (err)
  {
    console.error('[AUTH] login error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Face Login ──────────────────────────────────────────────────────
router.post('/face-login', async (req, res) =>
{
  try
  {
    const {descriptor}=req.body;

    if (!descriptor||!Array.isArray(descriptor))
    {
      return APIResponse.error(res, 'No face descriptor provided', 401);
    }

    // Verify face against Pinecone
    const {result: faceMatch, error: faceError}=await verifyFace(descriptor);

    if (faceError||!faceMatch)
    {
      console.log(`[AUTH] 🔍 Face login failed: ${faceError||'No match'}`);
      return APIResponse.error(res, faceError||'No matching face found. Please register first.', 401);
    }

    const matchedUsername=faceMatch.user_id;
    const matchScore=faceMatch.score;

    // Look up user in MongoDB
    const user=await User.findOne({username: matchedUsername});
    if (!user)
    {
      console.log(`[AUTH] 🔍 Face matched ${matchedUsername} (score: ${matchScore.toFixed(3)}) but user not found in DB`);
      return APIResponse.error(res, 'Face recognized but user account not found. You may need to register again.', 401);
    }

    console.log(`[AUTH] 🔍 Face login successful: ${matchedUsername} (score: ${matchScore.toFixed(3)})`);

    // Generate JWT token and set HTTP-only cookie
    const token=generateToken(user._id.toString());
    setTokenCookie(res, token);

    // Return user data (no token in response)
    return APIResponse.success(res, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        faceScore: matchScore,
        createdAt: user.createdAt,
      },
    }, 'Face login successful');
  } catch (err)
  {
    console.error('[AUTH] face-login error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Verify Session ──────────────────────────────────────────────────
router.get('/verify', async (req, res) =>
{
  try
  {
    const token=req.cookies.authToken;
    if (!token)
    {
      return APIResponse.error(res, 'No active session', 401);
    }

    // Verify token
    let decoded;
    try
    {
      decoded=jwt.verify(token, JWT_SECRET);
    } catch (verifyErr)
    {
      return APIResponse.error(res, 'Invalid token', 401);
    }

    // Fetch user from database
    const user=await User.findById(decoded.userId).select('-password');
    if (!user)
    {
      return APIResponse.error(res, 'User not found', 404);
    }

    return APIResponse.success(res, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        faceRegistered: user.faceRegistered,
        createdAt: user.createdAt,
      },
    }, 'Session verified');
  } catch (err)
  {
    console.error('[AUTH] verify error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Refresh Token ────────────────────────────────────────────────────
router.post('/refresh', async (req, res) =>
{
  try
  {
    const token=req.cookies.authToken;
    if (!token)
    {
      return APIResponse.error(res, 'No active session', 401);
    }

    let decoded;
    try
    {
      decoded=jwt.verify(token, JWT_SECRET);
    } catch (verifyErr)
    {
      return APIResponse.error(res, 'Invalid token', 401);
    }

    // Generate new token
    const newToken=generateToken(decoded.userId);
    setTokenCookie(res, newToken);

    return APIResponse.success(res, {}, 'Token refreshed');
  } catch (err)
  {
    console.error('[AUTH] refresh error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Logout ────────────────────────────────────────────────────────────
router.post('/logout', (req, res) =>
{
  try
  {
    // Clear HTTP-only cookie
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV==='production',
      sameSite: 'None',
      path: '/',
    });

    console.log('[AUTH] ✅ User logged out');
    return APIResponse.success(res, {}, 'Logged out successfully');
  } catch (err)
  {
    console.error('[AUTH] logout error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Forgot Password ─────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) =>
{
  try
  {
    const email=(req.body.email||'').trim().toLowerCase();

    if (!email)
    {
      return APIResponse.error(res, 'Email is required', 400);
    }

    const user=await User.findOne({email});
    if (!user)
    {
      return APIResponse.error(res, 'No account found with this email', 404);
    }

    const otp=generateOTP();
    const expiresAt=new Date(Date.now()+10*60*1000);

    await Otp.findOneAndUpdate(
      {email, purpose: 'forgot_password'},
      {otp, expiresAt, used: false},
      {upsert: true, new: true}
    );

    if (transporter)
    {
      try
      {
        await transporter.sendMail({
          from: process.env.MAIL_USERNAME,
          to: email,
          subject: 'Password Reset OTP – RecruitAI',
          html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 30px; background: #0a0a0a; color: #fff; border-radius: 12px;">
              <h2 style="text-align: center;">🔑 Password Reset</h2>
              <div style="text-align: center; font-size: 36px; font-weight: 700; letter-spacing: 6px; padding: 20px; background: #1a1a1a; border-radius: 8px; margin: 20px 0;">${otp}</div>
              <p style="text-align: center; color: #737373;">Expires in 10 minutes</p>
            </div>
          `,
        });
      } catch (mailErr)
      {
        console.log(`[AUTH] Mail send failed, OTP: ${otp}`);
      }
    } else
    {
      console.log(`[AUTH] 📧 Reset OTP for ${email}: ${otp}`);
    }

    return APIResponse.success(res, {}, 'Reset OTP sent to your email');
  } catch (err)
  {
    console.error('[AUTH] forgot-password error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Reset Password ──────────────────────────────────────────────────
router.post('/reset-password', async (req, res) =>
{
  try
  {
    const email=(req.body.email||'').trim().toLowerCase();
    const {password, confirmPassword}=req.body;

    if (!email||!password)
    {
      return APIResponse.error(res, 'Email and new password are required', 400);
    }
    if (password!==confirmPassword)
    {
      return APIResponse.error(res, 'Passwords do not match', 400);
    }
    if (password.length<6)
    {
      return APIResponse.error(res, 'Password must be at least 6 characters', 400);
    }

    const user=await User.findOne({email});
    if (!user)
    {
      return APIResponse.error(res, 'User not found', 404);
    }

    user.password=hashPassword(password);
    await user.save();

    console.log(`[AUTH] 🔑 Password reset for ${email}`);
    return APIResponse.success(res, {}, 'Password reset successfully');
  } catch (err)
  {
    console.error('[AUTH] reset-password error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Get current user ────────────────────────────────────────────────
router.get('/me', async (req, res) =>
{
  try
  {
    const token=req.cookies.authToken;
    if (!token)
    {
      return APIResponse.success(res, null, 'Not authenticated');
    }

    let decoded;
    try
    {
      decoded=jwt.verify(token, JWT_SECRET);
    } catch (verifyErr)
    {
      res.clearCookie('authToken'); // Clear invalid token
      return APIResponse.success(res, null, 'Not authenticated');
    }

    const user=await User.findById(decoded.userId).select('-password');
    if (!user)
    {
      return APIResponse.success(res, null, 'Not authenticated');
    }

    return APIResponse.success(res, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        faceRegistered: user.faceRegistered,
        createdAt: user.createdAt,
      },
    });
  } catch (err)
  {
    console.error('[AUTH] me error:', err);
    return APIResponse.success(res, null, 'Not authenticated');
  }
});

// ── Seed Demo Accounts ──────────────────────────────────────────────
const DEMO_ACCOUNTS=[
  {
    username: 'demo_student',
    email: 'student@hirespec.demo',
    password: 'demo123',
    role: 'candidate',
    companyName: '',
    bio: 'Computer Science student passionate about full-stack development.',
    skills: ['JavaScript', 'React', 'Node.js', 'Python', 'MongoDB'],
    profileComplete: 85,
  },
  {
    username: 'demo_company',
    email: 'company@hirespec.demo',
    password: 'demo123',
    role: 'company_admin',
    companyName: 'TechCorp Solutions',
    bio: 'Leading tech company specializing in AI and cloud solutions.',
    skills: [],
    profileComplete: 90,
  },
  {
    username: 'demo_recruiter',
    email: 'recruiter@hirespec.demo',
    password: 'demo123',
    role: 'recruiter',
    companyName: 'TechCorp Solutions',
    bio: 'Senior Technical Recruiter at TechCorp Solutions.',
    skills: [],
    profileComplete: 80,
  },
  {
    username: 'demo_admin',
    email: 'admin@hirespec.demo',
    password: 'demo123',
    role: 'admin',
    companyName: 'RecruitAI',
    bio: 'Platform administrator with full access to all admin features.',
    skills: [],
    profileComplete: 100,
  },
];

router.post('/seed-demo', async (req, res) =>
{
  try
  {
    const results=[];

    for (const acct of DEMO_ACCOUNTS)
    {
      const existing=await User.findOne({username: acct.username});
      if (existing)
      {
        results.push({username: acct.username, status: 'already exists', role: acct.role});
        continue;
      }

      const user=await User.create({
        username: acct.username,
        email: acct.email,
        password: hashPassword(acct.password),
        role: acct.role,
        companyName: acct.companyName,
        faceRegistered: false,
        bio: acct.bio,
        skills: acct.skills,
        profileComplete: acct.profileComplete,
      });

      results.push({username: user.username, status: 'created', role: user.role});
      console.log(`[AUTH] ✅ Demo account created: ${user.username} (${user.role})`);
    }

    return APIResponse.success(res, {accounts: results}, 'Demo accounts ready');
  } catch (err)
  {
    console.error('[AUTH] seed-demo error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// GET demo accounts info (no passwords)
router.get('/demo-accounts', (req, res) =>
{
  APIResponse.success(res, {
    accounts: DEMO_ACCOUNTS.map(a => ({
      username: a.username,
      password: a.password,
      role: a.role,
      companyName: a.companyName,
      label: a.role==='candidate'? '🎓 Student':a.role==='company_admin'? '🏢 Company Admin':'👤 Recruiter',
    })),
  });
});

export default router;
