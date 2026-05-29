import Joi from 'joi';

/**
 * Validation schemas for all API endpoints
 * Prevents invalid data from entering the system
 */

// Custom error messages
const messages={
    'any.required': '{#label} is required',
    'string.email': '{#label} must be a valid email',
    'string.min': '{#label} must have at least {#limit} characters',
    'string.max': '{#label} must not exceed {#limit} characters',
    'number.min': '{#label} must be at least {#limit}',
    'number.max': '{#label} must not exceed {#limit}',
    'any.only': '{#label} must be one of {#valids}',
};

// ── Authentication Schemas ──────────────────────────────────────────
export const authSchemas={
    sendOTP: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .messages(messages),
        purpose: Joi.string()
            .valid('register', 'forgot_password')
            .default('register'),
    }),

    verifyOTP: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .messages(messages),
        otp: Joi.string()
            .length(6)
            .pattern(/^\d+$/)
            .required()
            .messages({
                ...messages,
                'string.pattern.base': 'OTP must be 6 digits',
            }),
        purpose: Joi.string()
            .valid('register', 'forgot_password')
            .default('register'),
    }),

    register: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .messages(messages),
        username: Joi.string()
            .alphanum()
            .min(3)
            .max(30)
            .required()
            .messages(messages),
        password: Joi.string()
            .min(8)
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .required()
            .messages({
                ...messages,
                'string.pattern.base': 'Password must contain lowercase, uppercase, number, and special character',
            }),
        name: Joi.string()
            .max(100)
            .required()
            .messages(messages),
        role: Joi.string()
            .valid('candidate', 'recruiter', 'company_admin', 'company_hr')
            .required(),
    }),

    login: Joi.object({
        username: Joi.string()
            .required()
            .messages(messages),
        password: Joi.string()
            .required()
            .messages(messages),
    }),

    faceLogin: Joi.object({
        descriptor: Joi.array()
            .items(Joi.number())
            .length(128)
            .required()
            .messages({
                ...messages,
                'array.length': 'Face descriptor must have exactly 128 dimensions',
            }),
    }),

    passwordReset: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .messages(messages),
        password: Joi.string()
            .min(8)
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .required()
            .messages({
                ...messages,
                'string.pattern.base': 'Password must contain lowercase, uppercase, number, and special character',
            }),
    }),
};

// ── Interview Schemas ──────────────────────────────────────────────
export const interviewSchemas={
    create: Joi.object({
        candidateName: Joi.string()
            .max(100)
            .required()
            .messages(messages),
        role: Joi.string()
            .max(50)
            .required()
            .messages(messages),
        experience: Joi.string()
            .valid('entry', 'mid', 'senior')
            .default('entry'),
        topics: Joi.array()
            .items(Joi.string())
            .default([]),
        duration: Joi.number()
            .min(5)
            .max(480)
            .default(30)
            .messages({
                'number.min': 'Duration must be at least 5 minutes',
                'number.max': 'Duration must not exceed 480 minutes',
            }),
        notes: Joi.string()
            .allow('')
            .max(1000),
        sessionId: Joi.string()
            .max(100),
    }),

    addQuestion: Joi.object({
        question: Joi.string()
            .required()
            .messages(messages),
        metadata: Joi.object().unknown(true),
        answer: Joi.string()
            .required()
            .messages(messages),
    }),

    addSubmission: Joi.object({
        code: Joi.string()
            .required()
            .messages(messages),
        language: Joi.string()
            .valid('python', 'javascript', 'java', 'cpp', 'c', 'go', 'rust')
            .required(),
        questionId: Joi.string()
            .required()
            .messages(messages),
    }),

    end: Joi.object({
        feedback: Joi.string()
            .allow('')
            .max(2000),
        notes: Joi.string()
            .allow('')
            .max(2000),
        rating: Joi.number()
            .min(0)
            .max(10),
        score: Joi.number()
            .min(0)
            .max(100),
        recruiterScores: Joi.object({
            technical: Joi.number().min(0).max(10),
            problemSolving: Joi.number().min(0).max(10),
            communication: Joi.number().min(0).max(10),
            domain: Joi.number().min(0).max(10),
            aptitude: Joi.number().min(0).max(10),
            overallScore: Joi.number().min(0).max(10),
        }),
    }),
};

// ── Code Execution Schemas ────────────────────────────────────────
export const codeExecutionSchemas={
    execute: Joi.object({
        code: Joi.string()
            .required()
            .max(50000)
            .messages({
                ...messages,
                'string.max': 'Code must not exceed 50KB',
            }),
        language: Joi.string()
            .valid('python', 'javascript', 'java', 'cpp', 'c', 'go', 'rust')
            .required(),
        timeout: Joi.number()
            .min(1)
            .max(60)
            .default(5),
        questionId: Joi.string()
            .optional()
            .allow('', null),
        interviewId: Joi.string()
            .optional()
            .allow('', null),
    }),

    submit: Joi.object({
        code: Joi.string()
            .required()
            .max(50000)
            .messages({
                ...messages,
                'string.max': 'Code must not exceed 50KB',
            }),
        language: Joi.string()
            .valid('python', 'javascript', 'java', 'cpp', 'c', 'go', 'rust')
            .required(),
        questionId: Joi.string()
            .required()
            .messages(messages),
        interviewId: Joi.string()
            .optional()
            .allow('', null),
    }),
};

// ── Profile Schemas ───────────────────────────────────────────────
export const profileSchemas={
    updateProfile: Joi.object({
        name: Joi.string()
            .max(100),
        email: Joi.string()
            .email()
            .messages(messages),
        phone: Joi.string()
            .pattern(/^[\d\s\-\+\(\)]+$/)
            .max(20)
            .messages({
                'string.pattern.base': 'Phone number format is invalid',
            }),
        bio: Joi.string()
            .max(500),
        location: Joi.string()
            .max(100),
        skills: Joi.array()
            .items(Joi.string().max(50))
            .max(20),
        experience: Joi.string()
            .valid('entry', 'mid', 'senior'),
    }),

    uploadResume: Joi.object({
        // File validation should happen in middleware
        // This just validates the accompanying metadata
        title: Joi.string()
            .max(100),
    }),
};

// ── Proctoring Schemas ────────────────────────────────────────────
export const proctoringSchemas={
    recordEvent: Joi.object({
        interviewId: Joi.string()
            .required()
            .messages({'any.required': 'interviewId is required'}),
        eventType: Joi.string()
            .valid(
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
                'face_verified'
            )
            .required(),
        severity: Joi.string()
            .valid('low', 'medium', 'high', 'critical')
            .default('low'),
        description: Joi.string()
            .max(500)
            .allow(''),
        details: Joi.string()
            .max(500)
            .allow(''),
        metadata: Joi.object().unknown(true),
    }),

    updateStatus: Joi.object({
        status: Joi.string()
            .valid('not_started', 'in_progress', 'completed', 'flagged')
            .required(),
        notes: Joi.string()
            .max(1000),
    }),

    flag: Joi.object({
        reason: Joi.string()
            .max(500)
            .required()
            .messages(messages),
        severity: Joi.string()
            .valid('low', 'medium', 'high', 'critical')
            .default('medium'),
    }),
};

// ── Validation Middleware Factory ──────────────────────────────────
export function validateRequest(schema)
{
    return (req, res, next) =>
    {
        const {error, value}=schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error)
        {
            const messages=error.details.map(d => ({
                field: d.path.join('.'),
                message: d.message,
            }));
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: messages,
            });
        }

        req.validatedData=value;
        next();
    };
}

// ── Validation for query parameters ────────────────────────────────
export function validateQuery(schema)
{
    return (req, res, next) =>
    {
        const {error, value}=schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error)
        {
            const messages=error.details.map(d => ({
                field: d.path.join('.'),
                message: d.message,
            }));
            return res.status(400).json({
                success: false,
                error: 'Invalid query parameters',
                details: messages,
            });
        }

        req.validatedQuery=value;
        next();
    };
}

// ── Common query schemas ───────────────────────────────────────────
export const querySchemas={
    pagination: Joi.object({
        page: Joi.number()
            .min(1)
            .default(1),
        limit: Joi.number()
            .min(1)
            .max(100)
            .default(10),
        sort: Joi.string()
            .pattern(/^-?\w+$/)
            .default('-createdAt'),
    }),

    dateRange: Joi.object({
        startDate: Joi.date()
            .iso(),
        endDate: Joi.date()
            .iso()
            .min(Joi.ref('startDate')),
    }),

    search: Joi.object({
        q: Joi.string()
            .min(1)
            .max(100),
        type: Joi.string(),
    }),
};
