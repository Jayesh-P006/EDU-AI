import mongoose from 'mongoose';

const blockedIpSchema=new mongoose.Schema({
    ip: {type: String, required: true},
    reason: {type: String, default: ''},
    blockedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    blockedAt: {type: Date, default: Date.now},
    expiresAt: {type: Date, default: null},
    isActive: {type: Boolean, default: true},
}, {_id: true});

const securityControlSchema=new mongoose.Schema({
    key: {type: String, default: 'global', unique: true},
    blockedIps: {type: [blockedIpSchema], default: []},
    updatedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
}, {timestamps: true});

export default mongoose.model('SecurityControl', securityControlSchema);
