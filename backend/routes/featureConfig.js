import {Router} from 'express';
import {verifyAuth, verifyRole} from '../middleware/auth.js';
import FeatureConfig from '../models/FeatureConfig.js';

const router=Router();

/* ── PUBLIC: Get feature config for a role ────────────────────────── */
router.get('/:role', async (req, res) =>
{
  try
  {
    const {role}=req.params;
    if (!['company', 'student'].includes(role))
    {
      return res.status(400).json({success: false, message: 'Invalid role. Must be "company" or "student".'});
    }

    const config=await FeatureConfig.getConfig();
    res.json({success: true, features: config[role]||{}, updatedAt: config.updatedAt});
  } catch (err)
  {
    console.error('[FEATURE-CONFIG] GET /:role error:', err.message);
    res.status(500).json({success: false, message: 'Failed to fetch feature config'});
  }
});

/* ── ADMIN: Get full config (both roles) ─────────────────────────── */
router.get('/', verifyAuth, verifyRole('admin'), async (req, res) =>
{
  try
  {
    const config=await FeatureConfig.getConfig();
    res.json({success: true, ...config});
  } catch (err)
  {
    console.error('[FEATURE-CONFIG] GET / error:', err.message);
    res.status(500).json({success: false, message: 'Failed to fetch feature config'});
  }
});

/* ── ADMIN: Update feature config ────────────────────────────────── */
router.put('/', verifyAuth, verifyRole('admin'), async (req, res) =>
{
  console.log('[FEATURE-CONFIG] PUT / hit by user:', req.user?.userId || req.user?.id);
  console.log('[FEATURE-CONFIG] PUT payload company keys:', Object.keys(req.body?.company || {}));
  console.log('[FEATURE-CONFIG] PUT payload student keys:', Object.keys(req.body?.student || {}));

  try
  {
    const {company, student}=req.body;

    const update={updatedAt: new Date(), updatedBy: req.user?.id||req.user?.userId||null};

    const encodeKeys = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const newKey = key.replace(/\./g, '__dot__');
        result[newKey] = value;
      }
      return result;
    };

    // Only update the maps that were sent
    if (company&&typeof company==='object') update.company=encodeKeys(company);
    if (student&&typeof student==='object') update.student=encodeKeys(student);

    await FeatureConfig.findByIdAndUpdate('global', {$set: update}, {upsert: true, new: true});

    const config=await FeatureConfig.getConfig();
    console.log('[FEATURE-CONFIG] PUT / successfully updated configuration!');
    res.json({success: true, message: 'Feature config updated', ...config});
  } catch (err)
  {
    console.error('[FEATURE-CONFIG] PUT / error:', err);
    res.status(500).json({success: false, message: 'Failed to update feature config', error: err.message});
  }
});

export default router;
