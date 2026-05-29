import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  department: {
    type: String,
    required: true,
    trim: true,
  },
  location: {
    type: String,
    required: true,
    enum: ['Remote', 'On-site', 'Hybrid'],
    default: 'Remote',
  },
  type: {
    type: String,
    required: true,
    enum: ['Full-Time', 'Part-Time', 'Contract', 'Internship'],
    default: 'Full-Time',
  },
  description: {
    type: String,
    default: '',
  },
  requirements: {
    type: String,
    default: '',
  },
  skills: [{
    type: String,
  }],
  salary: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  companyName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'draft', 'paused'],
    default: 'active',
  },
  applicantCount: {
    type: Number,
    default: 0,
  },

  // ── ATS / Eligibility Criteria ──
  eligibilityCriteria: {
    minCGPA: { type: Number, default: 0 },
    requiredSkills: [{ type: String }],      // must-have skills
    preferredSkills: [{ type: String }],     // nice-to-have skills
    minExperience: { type: Number, default: 0 },  // years
    maxExperience: { type: Number, default: 0 },
    requiredEducation: [{ type: String }],   // e.g. ['B.Tech', "Bachelor's"]
    autoShortlist: { type: Boolean, default: false },
    minATSScore: { type: Number, default: 0 },    // 0–100 threshold
  },
}, {
  timestamps: true,
});

// Indexes
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ postedBy: 1 });
jobSchema.index({ companyName: 1 });

const Job = mongoose.model('Job', jobSchema);
export default Job;
