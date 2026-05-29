import express from 'express';
import {verifyAuth} from '../middleware/auth.js';
import Announcement from '../models/Announcement.js';
import User from '../models/User.js';

const router=express.Router();

router.get('/', verifyAuth, async (req, res) =>
{
    try
    {
        const limit=Math.min(100, Math.max(1, Number(req.query.limit||30)));
        const userId=req.user.userId;
        const user=await User.findById(userId).select('role').lean();
        const role=user?.role||'candidate';

        const audienceFilter={isActive: true, $or: [{audience: 'all'}]};
        if (role==='candidate') audienceFilter.$or.push({audience: 'candidates'});
        if (['company_admin', 'company_hr', 'recruiter'].includes(role)) audienceFilter.$or.push({audience: 'companies'});
        if (role==='admin') audienceFilter.$or.push({audience: 'admins'}, {audience: 'candidates'}, {audience: 'companies'});

        const announcements=await Announcement.find(audienceFilter)
            .populate('createdBy', 'username')
            .sort({createdAt: -1})
            .limit(limit)
            .lean();

        return res.json({
            announcements: announcements.map((a) => ({
                id: a._id,
                title: a.title,
                message: a.message,
                priority: a.priority,
                audience: a.audience,
                createdBy: a.createdBy?.username||'System',
                isRead: (a.readBy||[]).map(String).includes(String(userId)),
                createdAt: a.createdAt,
            })),
        });
    } catch (err)
    {
        return res.status(500).json({message: `Failed to fetch announcements: ${err.message}`});
    }
});

router.post('/', verifyAuth, async (req, res) =>
{
    try
    {
        const user=await User.findById(req.user.userId).select('role').lean();
        if (user?.role!=='admin')
        {
            return res.status(403).json({message: 'Admin access required'});
        }

        const {title, message, priority='normal', audience='all'}=req.body;
        if (!title||!message)
        {
            return res.status(400).json({message: 'Title and message are required'});
        }

        const announcement=await Announcement.create({
            title: String(title).trim(),
            message: String(message).trim(),
            priority,
            audience,
            createdBy: req.user.userId,
        });

        return res.status(201).json({
            message: 'Announcement created',
            announcement: {
                id: announcement._id,
                title: announcement.title,
                message: announcement.message,
                priority: announcement.priority,
                audience: announcement.audience,
                createdAt: announcement.createdAt,
            },
        });
    } catch (err)
    {
        return res.status(500).json({message: `Failed to create announcement: ${err.message}`});
    }
});

router.patch('/:id/read', verifyAuth, async (req, res) =>
{
    try
    {
        await Announcement.findByIdAndUpdate(req.params.id, {
            $addToSet: {readBy: req.user.userId},
        });
        return res.json({message: 'Marked as read'});
    } catch (err)
    {
        return res.status(500).json({message: `Failed to mark as read: ${err.message}`});
    }
});

router.patch('/read-all', verifyAuth, async (req, res) =>
{
    try
    {
        await Announcement.updateMany(
            {readBy: {$ne: req.user.userId}},
            {$addToSet: {readBy: req.user.userId}}
        );
        return res.json({message: 'All marked as read'});
    } catch (err)
    {
        return res.status(500).json({message: `Failed to mark all as read: ${err.message}`});
    }
});

router.delete('/:id', verifyAuth, async (req, res) =>
{
    try
    {
        const user=await User.findById(req.user.userId).select('role').lean();
        if (user?.role!=='admin')
        {
            return res.status(403).json({message: 'Admin access required'});
        }

        const deleted=await Announcement.findByIdAndDelete(req.params.id);
        if (!deleted)
        {
            return res.status(404).json({message: 'Announcement not found'});
        }

        return res.json({message: 'Announcement deleted'});
    } catch (err)
    {
        return res.status(500).json({message: `Failed to delete announcement: ${err.message}`});
    }
});

export default router;
