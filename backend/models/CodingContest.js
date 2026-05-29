import mongoose from 'mongoose';

const testCaseSchema=new mongoose.Schema({
    input: {type: String, required: true},
    output: {type: String, required: true},
    hidden: {type: Boolean, default: false},
}, {_id: false});

const submissionSchema=new mongoose.Schema({
    challengeIndex: {type: Number, required: true},
    code: {type: String, default: ''},
    language: {type: String, default: 'javascript'},
    passed: {type: Number, default: 0},
    total: {type: Number, default: 0},
    pointsEarned: {type: Number, default: 0},
    timeMs: {type: Number, default: 0},
    submittedAt: {type: Date, default: Date.now},
}, {_id: false});

const proctoringViolationSchema=new mongoose.Schema({
    type: {type: String, required: true},
    severity: {type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium'},
    penalty: {type: Number, default: 0},
    timestamp: {type: Date, default: Date.now},
}, {_id: false});

const participantSchema=new mongoose.Schema({
    participantId: {type: String, required: true},
    name: {type: String, required: true},
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
    score: {type: Number, default: 0},
    solvedCount: {type: Number, default: 0},
    submissions: [submissionSchema],
    proctoringViolations: [proctoringViolationSchema],
    totalPenalty: {type: Number, default: 0},
    integrityScore: {type: Number, default: 100},
    joinedAt: {type: Date, default: Date.now},
}, {_id: false});

const challengeSchema=new mongoose.Schema({
    title: {type: String, required: true},
    description: {type: String, required: true},
    difficulty: {type: String, enum: ['easy', 'medium', 'hard'], default: 'medium'},
    points: {type: Number, default: 100},
    timeLimit: {type: Number, default: 30}, // minutes per problem
    examples: [{
        input: String,
        output: String,
        explanation: String,
    }],
    constraints: [String],
    testCases: [testCaseSchema],
    starterCode: {
        javascript: {type: String, default: ''},
        python: {type: String, default: ''},
        java: {type: String, default: ''},
        cpp: {type: String, default: ''},
    },
    functionName: {
        javascript: {type: String, default: 'solution'},
        python: {type: String, default: 'solution'},
        java: {type: String, default: 'solution'},
        cpp: {type: String, default: 'solution'},
    },
    hints: [String],
}, {_id: false});

const contestSchema=new mongoose.Schema({
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
        enum: ['draft', 'waiting', 'active', 'completed'],
        default: 'draft',
    },
    duration: {type: Number, default: 90}, // contest duration in minutes
    endsAt: {type: Date, default: null},
    challenges: [challengeSchema],
    participants: [participantSchema],
    settings: {
        showLeaderboardLive: {type: Boolean, default: true},
        allowLateJoin: {type: Boolean, default: true},
        partialScoring: {type: Boolean, default: true}, // partial points for passing some test cases
        allowedLanguages: {type: [String], default: ['javascript', 'python', 'java', 'cpp']},
    },
    startedAt: {type: Date, default: null},
    endedAt: {type: Date, default: null},
}, {timestamps: true});

export default mongoose.model('CodingContest', contestSchema);
