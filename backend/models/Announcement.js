import mongoose from 'mongoose';

const announcementSchema=new mongoose.Schema({
    title: {type: String, required: true, trim: true},
    message: {type: String, required: true},
    priority: {type: String, enum: ['low', 'normal', 'important', 'urgent'], default: 'normal'},
    audience: {type: String, enum: ['all', 'candidates', 'companies', 'admins'], default: 'all'},
    createdBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    readBy: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    isActive: {type: Boolean, default: true},
}, {timestamps: true});

announcementSchema.index({createdAt: -1});
announcementSchema.index({audience: 1});
announcementSchema.index({isActive: 1});

export default mongoose.model('Announcement', announcementSchema);
