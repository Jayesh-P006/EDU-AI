import mongoose from 'mongoose';

const auditLogSchema=new mongoose.Schema({
    actionType: {type: String, required: true, index: true},
    category: {type: String, default: 'general', index: true},
    status: {type: String, enum: ['success', 'failed', 'pending'], default: 'success'},
    actorId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
    actorRole: {type: String, default: ''},
    actorLabel: {type: String, default: ''},
    targetType: {type: String, default: ''},
    targetId: {type: mongoose.Schema.Types.ObjectId, default: null},
    targetLabel: {type: String, default: ''},
    ipAddress: {type: String, default: ''},
    userAgent: {type: String, default: ''},
    metadata: {type: mongoose.Schema.Types.Mixed, default: {}},
}, {timestamps: true});

auditLogSchema.index({createdAt: -1});
auditLogSchema.index({actorId: 1});
auditLogSchema.index({ipAddress: 1});
auditLogSchema.index({category: 1, createdAt: -1});

export default mongoose.model('AuditLog', auditLogSchema);
