import mongoose from 'mongoose';

/**
 * FeatureConfig – stores admin-controlled feature toggles for Company and Student dashboards.
 * Uses a singleton pattern (single document with _id 'global').
 */
const featureConfigSchema=new mongoose.Schema({
  _id: {type: String, default: 'global'},

  company: {type: mongoose.Schema.Types.Mixed, default: {}},
  student: {type: mongoose.Schema.Types.Mixed, default: {}},

  updatedAt: {type: Date, default: Date.now},
  updatedBy: {type: String, default: null},
}, {
  timestamps: false,
  versionKey: false,
});

/**
 * Returns the singleton config, creating it with all-enabled defaults if it doesn't exist.
 */
featureConfigSchema.statics.getConfig=async function ()
{
  let config=await this.findById('global').lean();
  if (!config)
  {
    config=await this.create({_id: 'global', company: {}, student: {}});
    config=config.toObject();
  }

  const rawCompany = config.company instanceof Map? Object.fromEntries(config.company):(config.company||{});
  const rawStudent = config.student instanceof Map? Object.fromEntries(config.student):(config.student||{});

  const decodeKeys = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = key.replace(/__dot__/g, '.');
      result[newKey] = value;
    }
    return result;
  };

  return {
    company: decodeKeys(rawCompany),
    student: decodeKeys(rawStudent),
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
  };
};

const FeatureConfig=mongoose.model('FeatureConfig', featureConfigSchema);
export default FeatureConfig;
