import mongoose from 'mongoose';

const educationSchema=new mongoose.Schema({
  degree: String,
  field: String,
  institution: String,
  year: String,
  startYear: String,
  endYear: String,
  grade: String,
}, {_id: false});

const experienceSchema=new mongoose.Schema({
  title: String,
  company: String,
  location: String,
  startDate: String,
  endDate: String,
  current: {type: Boolean, default: false},
  description: String,
}, {_id: false});

const projectSchema=new mongoose.Schema({
  name: String,
  description: String,
  technologies: {type: mongoose.Schema.Types.Mixed, default: []},
  url: String,
  link: String,
}, {_id: false});

const userSchema=new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['candidate', 'company_admin', 'company_hr', 'recruiter', 'proctor'],
    default: 'candidate',
  },
  companyName: {
    type: String,
    default: '',
  },
  faceRegistered: {
    type: Boolean,
    default: false,
  },

  // ── Profile fields ──
  fullName: {type: String, default: ''},
  phone: {type: String, default: ''},
  location: {type: String, default: ''},
  linkedIn: {type: String, default: ''},
  github: {type: String, default: ''},
  portfolio: {type: String, default: ''},
  headline: {type: String, default: ''},
  bio: {type: String, default: ''},
  skills: [{type: String}],
  education: [educationSchema],
  experience: [experienceSchema],
  projects: [projectSchema],
  certifications: [{type: String}],
  languages: [{type: String}],
  desiredRole: {type: String, default: ''},
  desiredSalary: {type: String, default: ''},
  availability: {type: String, enum: ['immediate', '2weeks', '1month', '3months', ''], default: ''},
  workPreference: {type: String, enum: ['remote', 'onsite', 'hybrid', ''], default: ''},

  // ── Resume ──
  resumeText: {type: String, default: ''},
  resumeFileName: {type: String, default: ''},
  resumeUploadedAt: {type: Date, default: null},
  resumeParsed: {type: mongoose.Schema.Types.Mixed, default: null},
  atsScore: {type: Number, default: null},

  // ── Verification ──
  verification: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },

  profileComplete: {
    type: Number,
    default: 10,
  },
}, {
  timestamps: true,
});

// Indexes
userSchema.index({role: 1, createdAt: -1});

const User=mongoose.model('User', userSchema);
export default User;
