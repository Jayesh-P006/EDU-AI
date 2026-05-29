import mongoose from 'mongoose';

const practiceSessionSchema=new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    role: {
        type: String,
        required: true,
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium',
    },
    interviewType: {
        type: String,
        default: 'technical',
    },
    mode: {
        type: String,
        default: 'practice',
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'completed'],
        default: 'active',
        index: true,
    },
    startTime: {
        type: Date,
        default: Date.now,
        index: true,
    },
    endTime: {
        type: Date,
        default: null,
    },
    duration: {
        type: Number,
        required: true, // in minutes
    },
    questionsAnswered: {
        type: Number,
        default: 0,
    },
    totalQuestions: {
        type: Number,
        required: true,
    },
    questions: [
        {
            questionId: String,
            question: String,
            answer: String,
            score: Number,
            feedback: String,
            timestamp: {type: Date, default: Date.now},
        },
    ],
    responses: [
        {
            question: String,
            userAnswer: String,
            expectedAnswer: String,
            isCorrect: Boolean,
            score: Number,
            timestamp: {type: Date, default: Date.now},
        },
    ],
    score: {
        type: Number,
        default: 0,
    },
    feedback: String,
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
}, {timestamps: true});

// Index for efficient queries
practiceSessionSchema.index({userId: 1, createdAt: -1});
practiceSessionSchema.index({status: 1, createdAt: -1});
practiceSessionSchema.index({userId: 1, status: 1});

export default mongoose.model('PracticeSession', practiceSessionSchema);
