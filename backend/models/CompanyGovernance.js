import mongoose from 'mongoose';

const companyGovernanceSchema=new mongoose.Schema({
    companyName: {type: String, required: true, unique: true, trim: true},
    status: {type: String, enum: ['pending_review', 'approved', 'rejected', 'suspended'], default: 'pending_review'},
    notes: {type: String, default: ''},
    reviewedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
    reviewedAt: {type: Date, default: null},
}, {timestamps: true});

companyGovernanceSchema.index({status: 1});

export default mongoose.model('CompanyGovernance', companyGovernanceSchema);
