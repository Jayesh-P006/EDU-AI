import mongoose from 'mongoose';

const globalAIConfigSchema=new mongoose.Schema({
    key: {type: String, default: 'global', unique: true},
    integrityThresholds: {
        lowRiskMin: {type: Number, default: 74},
        mediumRiskMin: {type: Number, default: 56},
        criticalMax: {type: Number, default: 38},
    },
    skillWeightDistribution: {
        technical: {type: Number, default: 35},
        problemSolving: {type: Number, default: 25},
        communication: {type: Number, default: 15},
        domain: {type: Number, default: 15},
        aptitude: {type: Number, default: 10},
    },
    fraudSensitivityLevel: {type: String, enum: ['low', 'medium', 'high'], default: 'medium'},
    aiDifficultyScaling: {
        entry: {type: Number, default: 1.0},
        mid: {type: Number, default: 1.15},
        senior: {type: Number, default: 1.3},
    },
    updatedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
}, {timestamps: true});

export default mongoose.model('GlobalAIConfig', globalAIConfigSchema);
