import mongoose from 'mongoose';

const proctoringEventSchema=new mongoose.Schema({
    eventType: {
        type: String,
        enum: [
            'window_blur',
            'window_focus',
            'tab_switch',
            'copy',
            'paste',
            'right_click',
            'face_not_detected',
            'multiple_faces',
            'face_obscured',
            'noise_detected',
            'suspicious_activity',
            'looking_away',
            'eyes_closed',
            'no_face',
            'fullscreen_exit',
            'copy_paste_attempt',
            'large_paste',
            'ai_generated_code',
            'suspicious_typing',
            'screen_change',
            'auto_terminate',
            'face_mismatch',
            'face_verified',
        ],
        required: true,
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low',
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    description: String,
    metadata: mongoose.Schema.Types.Mixed,
}, {_id: false});

const interviewProctoringSchema=new mongoose.Schema({
    interviewId: {
        type: String,
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'flagged'],
        default: 'not_started',
        index: true,
    },
    startTime: {
        type: Date,
        default: Date.now,
    },
    endTime: Date,

    // Integrity metrics
    integrityScore: {
        type: Number,
        default: 100,
        min: 0,
        max: 100,
    },
    violationCount: {
        type: Number,
        default: 0,
    },
    warningCount: {
        type: Number,
        default: 0,
    },

    // Proctoring events
    events: [proctoringEventSchema],

    // Face tracking
    faceDetectionStatus: {
        type: String,
        enum: ['detected', 'not_detected', 'multiple', 'obscured'],
        default: 'detected',
    },
    faceLostCount: {
        type: Number,
        default: 0,
    },
    faceLostDuration: {
        type: Number,
        default: 0, // in seconds
    },

    // Face identity verification
    faceVerifiedCount: {
        type: Number,
        default: 0,
    },
    faceMismatchCount: {
        type: Number,
        default: 0,
    },
    lastFaceVerifiedAt: Date,
    identityConfirmed: {
        type: Boolean,
        default: false,
    },

    // Environment monitoring
    environmentnoise: {
        type: Boolean,
        default: false,
    },
    multipleFaces: {
        type: Boolean,
        default: false,
    },
    suspiciousActivity: {
        type: Boolean,
        default: false,
    },

    // Activity tracking
    mouseMovement: {
        type: Number,
        default: 0,
    },
    keyPresses: {
        type: Number,
        default: 0,
    },
    windowBlurCount: {
        type: Number,
        default: 0,
    },

    // Proctor notes
    proctoringNotes: String,
    proctoredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    // Flags
    isFlagged: {
        type: Boolean,
        default: false,
    },
    flagReason: String,
    requiresReview: {
        type: Boolean,
        default: false,
    },
}, {timestamps: true});

// Indexes for efficient queries
interviewProctoringSchema.index({userId: 1, createdAt: -1});
interviewProctoringSchema.index({status: 1, createdAt: -1});
interviewProctoringSchema.index({isFlagged: 1});
interviewProctoringSchema.index({requiresReview: 1});

export default mongoose.model('InterviewProctoring', interviewProctoringSchema);
