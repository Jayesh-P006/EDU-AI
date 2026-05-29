import express from 'express';
import axios from 'axios';

const router = express.Router();

// AI Calling Python server URL (default localhost:8000)
const AI_CALLING_URL = process.env.AI_CALLING_URL || 'http://localhost:8000';

/* ═══════════════════════════════════════════════════════════════════
   AI CALLING ROUTES — Proxy to Python FastAPI server
   ═══════════════════════════════════════════════════════════════════ */

// Health check for AI Calling server
router.get('/health', async (req, res) => {
  try {
    const resp = await axios.get(`${AI_CALLING_URL}/`, { timeout: 5000 });
    return res.json({ status: 'online', server: resp.data });
  } catch (err) {
    return res.json({ status: 'offline', message: 'AI Calling server is not running' });
  }
});

// Get config info (ngrok URL from env)
router.get('/config', (req, res) => {
  const ngrokUrl = process.env.NGROK_URL || '';
  const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  return res.json({
    ngrokUrl: ngrokUrl ? `${ngrokUrl}` : '',
    hasTwilio,
    twilioPhone: process.env.TWILIO_PHONE_NUMBER || '',
  });
});

// Get available demo candidates
router.get('/candidates', async (req, res) => {
  try {
    const resp = await axios.get(`${AI_CALLING_URL}/demos`, { timeout: 5000 });
    return res.json(resp.data);
  } catch (err) {
    // Return built-in demo candidates if server is offline
    return res.json({
      demos: [
        { id: 'demo1', name: 'Rahul Sharma', position: 'Backend Developer' },
        { id: 'demo2', name: 'Priya Patel', position: 'Frontend Developer' },
        { id: 'demo3', name: 'Amit Kumar', position: 'Full Stack Developer' },
        { id: 'demo4', name: 'Sneha Reddy', position: 'Data Analyst' },
      ],
    });
  }
});

// Set active demo candidate
router.post('/set-candidate', async (req, res) => {
  try {
    const { candidateId } = req.body;
    if (!candidateId) {
      return res.status(400).json({ message: 'candidateId is required' });
    }

    const resp = await axios.post(`${AI_CALLING_URL}/demo`, { id: candidateId }, { timeout: 5000 });
    return res.json(resp.data);
  } catch (err) {
    console.error('[AI-CALLING] Set candidate error:', err.message);
    return res.status(500).json({ message: 'Failed to set candidate. Is the AI Calling server running?' });
  }
});

// Initiate a call via Twilio (ngrok URL is read from .env automatically)
router.post('/initiate-call', async (req, res) => {
  try {
    const { phoneNumber, candidateId } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Set the active candidate if provided
    if (candidateId) {
      try {
        await axios.post(`${AI_CALLING_URL}/demo`, { id: candidateId }, { timeout: 5000 });
      } catch (e) {
        console.warn('[AI-CALLING] Could not set candidate:', e.message);
      }
    }

    // Use Twilio credentials from env
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    const webhookUrl = process.env.NGROK_URL;

    if (!accountSid || !authToken || !twilioPhone) {
      return res.status(500).json({ message: 'Twilio credentials not configured in .env' });
    }

    if (!webhookUrl) {
      return res.status(500).json({ message: 'NGROK_URL not configured in .env' });
    }

    // Make Twilio API call directly
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', phoneNumber);
    formData.append('From', twilioPhone);
    formData.append('Url', `${webhookUrl}/answer`);
    formData.append('StatusCallback', `${webhookUrl}/status`);
    formData.append('StatusCallbackEvent', 'initiated ringing answered completed');

    const twilioResp = await axios.post(twilioUrl, formData.toString(), {
      auth: { username: accountSid, password: authToken },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    console.log(`[AI-CALLING] ✅ Call initiated to ${phoneNumber}, SID: ${twilioResp.data.sid}`);

    return res.json({
      message: 'Call initiated successfully',
      callSid: twilioResp.data.sid,
      status: twilioResp.data.status,
      to: phoneNumber,
      from: twilioPhone,
    });
  } catch (err) {
    console.error('[AI-CALLING] Initiate call error:', err.response?.data || err.message);
    return res.status(500).json({
      message: `Failed to initiate call: ${err.response?.data?.message || err.message}`,
    });
  }
});

// Get call conversation logs from the Python server
router.get('/conversation', async (req, res) => {
  try {
    const resp = await axios.get(`${AI_CALLING_URL}/logs`, { timeout: 5000 });
    const logs = resp.data.logs || [];
    // Get the latest call's conversation log
    if (logs.length > 0) {
      const latest = logs[logs.length - 1];
      return res.json({
        candidate: latest.candidate || '',
        log: latest.log || [],
      });
    }
    return res.json({ candidate: '', log: [] });
  } catch (err) {
    return res.json({ candidate: '', log: [] });
  }
});

// Get call logs from the AI Calling server
router.get('/logs', async (req, res) => {
  try {
    const resp = await axios.get(`${AI_CALLING_URL}/logs`, { timeout: 5000 });
    return res.json(resp.data);
  } catch (err) {
    return res.json({ logs: [], message: 'AI Calling server is offline' });
  }
});

// Get call status via Twilio
router.get('/call-status/:callSid', async (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return res.status(500).json({ message: 'Twilio credentials not configured' });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${req.params.callSid}.json`;
    const resp = await axios.get(twilioUrl, {
      auth: { username: accountSid, password: authToken },
      timeout: 10000,
    });

    return res.json({
      callSid: resp.data.sid,
      status: resp.data.status,
      duration: resp.data.duration,
      startTime: resp.data.start_time,
      endTime: resp.data.end_time,
      to: resp.data.to,
      from: resp.data.from,
    });
  } catch (err) {
    return res.status(500).json({ message: `Failed to get call status: ${err.message}` });
  }
});

export default router;
