import mongoose from 'mongoose';

const questionAnswerSchema=new mongoose.Schema({
  question: String,
  questionMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  answer: String,
  evaluation: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  followUps: [{
    question: String,
    answer: String,
  }],
  timestamp: {type: Date, default: Date.now},
}, {_id: false});

const aiInterviewSchema=new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  candidateName: {
    type: String,
    required: true,
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    default: null,
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    default: null,
  },
  scheduledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  scheduledAt: {
    type: Date,
    default: null,
  },
  interviewLink: {
    type: String,
    default: null,
  },
  role: {
    type: String,
    required: true,
  },
  experience: {
    type: String,
    enum: ['entry', 'mid', 'senior'],
    default: 'entry',
  },
  topics: [{
    type: String,
  }],
  duration: {
    type: Number,
    default: 30,
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'completed', 'ended'],
    default: 'active',
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
    default: null,
  },
  currentQuestionIndex: {
    type: Number,
    default: 0,
  },
  totalQuestions: {
    type: Number,
    default: 5,
  },
  questions: [{
    id: Number,
    question: String,
    topic: String,
    difficulty: String,
  }],
  questionAnswerPairs: [questionAnswerSchema],
  codeSubmissions: [{
    code: String,
    language: String,
    questionId: String,
    passed: Number,
    total: Number,
    timestamp: {type: Date, default: Date.now},
  }],
  proctoringEvents: [{
    eventType: String,
    severity: String,
    description: String,
    timestamp: {type: Date, default: Date.now},
  }],
  notes: {
    type: String,
    default: '',
  },
  feedback: {
    type: String,
    default: '',
  },
  rating: {
    type: Number,
    default: null,
  },
  score: {
    type: Number,
    default: null,
  },
  recruiterScores: {
    technical: {type: Number, default: 0},
    problemSolving: {type: Number, default: 0},
    communication: {type: Number, default: 0},
    domain: {type: Number, default: 0},
    aptitude: {type: Number, default: 0},
    overallScore: {type: Number, default: 0},
  },
  hiringDecision: {
    type: String,
    enum: ['', 'strong-hire', 'hire', 'maybe', 'no-hire', 'strong-no-hire'],
    default: '',
  },
  greeting: String,
  useAI: {
    type: Boolean,
    default: true,
  },
  hasFollowUp: {
    type: Boolean,
    default: false,
  },
  report: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  // Scores extracted for analytics
  overallScore: {
    type: Number,
    default: null,
  },
  sectionScores: {
    technical: {type: Number, default: 0},
    communication: {type: Number, default: 0},
    problemSolving: {type: Number, default: 0},
    domain: {type: Number, default: 0},
    aptitude: {type: Number, default: 0},
  },
}, {
  timestamps: true,
});

// Indexes for analytics queries
aiInterviewSchema.index({candidateId: 1, createdAt: -1});
aiInterviewSchema.index({status: 1});
aiInterviewSchema.index({role: 1});
aiInterviewSchema.index({overallScore: -1});
aiInterviewSchema.index({jobId: 1, status: 1});
aiInterviewSchema.index({scheduledBy: 1, status: 1});

const AIInterview=mongoose.model('AIInterview', aiInterviewSchema);
export default AIInterview;
