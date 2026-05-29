import AuditLog from '../models/AuditLog.js';

export async function writeAuditLog(req, {actionType, category='general', status='success', actorId, actorRole, actorLabel, targetType, targetId, targetLabel, metadata={}})
{
    try
    {
        const ip=req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()||req?.ip||req?.connection?.remoteAddress||'';
        const userAgent=req?.headers?.['user-agent']||'';

        const logEntry=new AuditLog({
            actionType,
            category,
            status,
            actorId: actorId||req?.user?.userId||null,
            actorRole: actorRole||req?.user?.role||'',
            actorLabel: actorLabel||req?.user?.username||'',
            targetType: targetType||'',
            targetId: targetId||null,
            targetLabel: targetLabel||'',
            ipAddress: ip,
            userAgent,
            metadata,
        });

        await logEntry.save();
        return logEntry;
    } catch (err)
    {
        console.error('[AuditLog] Failed to write audit log:', err.message);
        return null;
    }
}
