import mongoose from 'mongoose';

const answerSchema=new mongoose.Schema({
    questionIndex: {type: Number, required: true},
    answer: {type: String, default: ''},
    correct: {type: Boolean, default: false},
    pointsEarned: {type: Number, default: 0},
    timeMs: {type: Number, default: 0},
}, {_id: false});

const proctoringViolationSchema=new mongoose.Schema({
    type: {type: String, required: true}, // no_face, multiple_faces, tab_switch, window_blur, etc.
    severity: {type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium'},
    penalty: {type: Number, default: 0}, // points deducted
    timestamp: {type: Date, default: Date.now},
}, {_id: false});

const participantSchema=new mongoose.Schema({
    participantId: {type: String, required: true}, // socket id or user id
    name: {type: String, required: true},
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
    score: {type: Number, default: 0},
    streak: {type: Number, default: 0},
    answers: [answerSchema],
    proctoringViolations: [proctoringViolationSchema],
    totalPenalty: {type: Number, default: 0}, // total points deducted
    integrityScore: {type: Number, default: 100}, // 0-100
    joinedAt: {type: Date, default: Date.now},
}, {_id: false});

const questionSchema=new mongoose.Schema({
    text: {type: String, required: true},
    type: {type: String, enum: ['mcq', 'short'], default: 'mcq'},
    options: [String], // for MCQ only
    correctAnswer: {type: String, required: true},
    explanation: {type: String, default: ''},
    points: {type: Number, default: 10},
    timeLimit: {type: Number, default: 20}, // seconds
    difficulty: {type: String, enum: ['easy', 'medium', 'hard'], default: 'medium'},
}, {_id: false});

const quizSchema=new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        index: true,
    },
    title: {type: String, required: true},
    topic: {type: String, required: true},
    description: {type: String, default: ''},
    difficulty: {type: String, enum: ['easy', 'medium', 'hard'], default: 'medium'},
    hostId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    hostName: {type: String, required: true},
    status: {
        type: String,
        enum: ['draft', 'waiting', 'active', 'question_open', 'question_closed', 'completed'],
        default: 'draft',
    },
    currentQuestionIndex: {type: Number, default: -1},
    questionTimeLimit: {type: Number, default: 20},
    duration: {type: Number, default: 60}, // quiz window duration in minutes
    endsAt: {type: Date, default: null}, // auto-computed: startedAt + duration
    questions: [questionSchema],
    participants: [participantSchema],
    settings: {
        showLeaderboardAfterEach: {type: Boolean, default: true},
        allowLateJoin: {type: Boolean, default: true},
        shuffleQuestions: {type: Boolean, default: false},
        shuffleOptions: {type: Boolean, default: false},
    },
    startedAt: {type: Date, default: null},
    endedAt: {type: Date, default: null},
}, {timestamps: true});

export default mongoose.model('Quiz', quizSchema);
