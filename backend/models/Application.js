import mongoose from 'mongoose';

const applicationSchema=new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['applied', 'shortlisted', 'selected', 'screening', 'interview', 'assessment', 'offered', 'hired', 'rejected', 'withdrawn', 'not_eligible'],
    default: 'applied',
  },
  coverLetter: {
    type: String,
    default: '',
  },
  round: {
    type: String,
    default: 'Applied',
  },
  score: {
    type: Number,
    default: 0,
  },
  notes: {
    type: String,
    default: '',
  },

  // ── Resume ──
  resumeUrl: {type: String, default: ''},          // Cloudinary URL for uploaded resume
  resumePublicId: {type: String, default: ''},     // Cloudinary public ID (for deletion)

  // ── ATS Scoring ──
  atsScore: {type: Number, default: 0},           // overall ATS match 0–100
  skillMatchScore: {type: Number, default: 0},     // skill match % 0–100
  matchedSkills: [{type: String}],
  missingSkills: [{type: String}],
  cgpa: {type: Number, default: 0},
  experienceYears: {type: Number, default: 0},
  eligible: {type: Boolean, default: true},
  eligibilityReasons: [{type: String}],            // why not eligible
  resumeParsed: {type: mongoose.Schema.Types.Mixed, default: null},
  projectDetails: [{
    name: {type: String},
    description: {type: String},
    technologies: [{type: String}],
    relevanceScore: {type: Number, default: 0},
  }],

  statusHistory: [{
    status: {type: String},
    changedAt: {type: Date, default: Date.now},
    changedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    note: {type: String, default: ''},
  }],
  appliedAt: {type: Date, default: Date.now},
  shortlistedAt: {type: Date},
  selectedAt: {type: Date},
}, {
  timestamps: true,
});

// Prevent duplicate applications
applicationSchema.index({job: 1, candidate: 1}, {unique: true});
applicationSchema.index({candidate: 1, status: 1});
applicationSchema.index({job: 1, status: 1});
applicationSchema.index({job: 1, atsScore: -1});

const Application=mongoose.model('Application', applicationSchema);
export default Application;
