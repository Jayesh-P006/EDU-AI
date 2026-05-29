import {useState, useEffect} from 'react';
import {Shield as ShieldIcon, UserX as NoFaceIcon, Users as UsersIcon, Eye as EyeIcon, Moon as SleepIcon, ArrowRightLeft as TabSwitchIcon, Minimize2 as FullscreenExitIcon, Clipboard as ClipboardIcon, Bot as RobotIcon, FileText as DocumentIcon, AlertCircle as AlertIcon, CheckCircle as CheckCircleIcon, X as XIcon, User as UserIcon, Smartphone as PhoneIcon, Circle as RecordIcon, Fingerprint as FingerprintIcon, ShieldAlert as ShieldAlertIcon} from 'lucide-react';
import './ProctoringMonitor.css';

function ProctoringMonitor({interviewId, events=[], suspicionScore=0, integrityScore: propIntegrityScore, secondaryCamActive=false})
{
    const [integrityScore, setIntegrityScore]=useState(100);
    const [alertCount, setAlertCount]=useState(0);
    const [criticalAlerts, setCriticalAlerts]=useState(0);
    const [newEventPulse, setNewEventPulse]=useState(false);

    useEffect(() =>
    {
        // Use prop if provided, otherwise calculate from events
        if (propIntegrityScore!==undefined)
        {
            setIntegrityScore(propIntegrityScore);
        } else
        {
            // Calculate score based on events
            let score=100;
            events.forEach(event =>
            {
                switch (event.severity)
                {
                    case 'low':
                        score-=5;
                        break;
                    case 'medium':
                        score-=10;
                        break;
                    case 'high':
                        score-=20;
                        break;
                    case 'critical':
                        score-=30;
                        break;
                }
            });
            setIntegrityScore(Math.max(0, score));
        }

        setAlertCount(events.length);
        setCriticalAlerts(events.filter(e => e.severity==='critical').length);

        // Trigger pulse animation for new events
        if (events.length>0)
        {
            setNewEventPulse(true);
            const timer=setTimeout(() => setNewEventPulse(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [events, propIntegrityScore]);

    const getScoreColor=() =>
    {
        if (integrityScore>=80) return '#10b981';
        if (integrityScore>=60) return '#f59e0b';
        return '#ef4444';
    };

    const getSeverityBadge=(severity) =>
    {
        const colors={
            low: '#60a5fa',
            medium: '#f59e0b',
            high: '#ef4444',
            critical: '#dc2626',
        };
        return colors[severity]||'#64748b';
    };

    const formatEventType=(event) =>
    {
        const typeMap={
            'no_face': 'No Face Detected',
            'multiple_faces': 'Multiple Faces',
            'looking_away': 'Looking Away',
            'eyes_closed': 'Eyes Closed',
            'window_blur': 'Window Focus Lost',
            'tab_switch': 'Tab Switched',
            'fullscreen_exit': 'Fullscreen Exited',
            'copy_paste_attempt': 'Copy/Paste Blocked',
            'ai_generated_code': 'AI-Generated Code',
            'large_paste': 'Large Code Paste',
            'suspicious_typing': 'Suspicious Typing',
            'auto_terminate': 'Interview Terminated',
            'face_mismatch': '⚠️ Face Identity Mismatch',
            'face_verified': '✅ Identity Confirmed',
        };
        return typeMap[event.type]||event.description||event.type||'Unknown Event';
    };

    // Derive face identity status from events
    const faceVerifications=events.filter(e => e.type==='face_verified').length;
    const faceMismatches=events.filter(e => e.type==='face_mismatch').length;
    const identityStatus=faceMismatches>0? 'mismatch':faceVerifications>0? 'verified':'pending';

    return (
        <div className="proctoring-monitor card">
            <div className="proctoring-header">
                <h3><ShieldIcon size={14} /> Proctoring</h3>
                <div className="header-badges">
                    <span className="feature-badge" title="Face detection"><UserIcon size={10} /> Face</span>
                    <span className="feature-badge" title="Eye tracking"><EyeIcon size={10} /> Eyes</span>
                    <span className="feature-badge" title="AI detection"><RobotIcon size={10} /> AI</span>
                    <span className="feature-badge" title="Tab monitoring"><TabSwitchIcon size={10} /> Focus</span>
                    <span className={`feature-badge ${secondaryCamActive? 'badge-active':''}`} title="Secondary camera"><PhoneIcon size={10} /> Cam2</span>
                    <span className={`feature-badge ${identityStatus==='verified'? 'badge-active':identityStatus==='mismatch'? 'badge-danger':''}`} title="Face identity verification">
                        <FingerprintIcon size={10} /> ID
                    </span>
                </div>
            </div>

            <div className="proctoring-summary">
                <div className="summary-score">
                    <div className="score-value" style={{color: getScoreColor()}}>{integrityScore}<span className="score-max">/100</span></div>
                    <div className="score-bar">
                        <div className="score-fill" style={{width: `${integrityScore}%`, background: getScoreColor()}} />
                    </div>
                </div>
                <div className="summary-stat">
                    <div className="stat-num">{alertCount}</div>
                    <div className="stat-lbl">Alerts</div>
                </div>
                <div className="summary-stat">
                    <div className="stat-num" style={{color: criticalAlerts>0? '#ef4444':'#10b981'}}>{criticalAlerts}</div>
                    <div className="stat-lbl">Critical</div>
                </div>
                <div className="summary-stat">
                    <div className="stat-num status-icon">
                        {integrityScore>=80? <><CheckCircleIcon size={14} color="#10b981" /></>:integrityScore>=60? <><AlertIcon size={14} color="#f59e0b" /></>:<><XIcon size={14} color="#ef4444" /></>}
                    </div>
                    <div className="stat-lbl">{integrityScore>=80? 'Good':integrityScore>=60? 'Warn':'Risk'}</div>
                </div>
            </div>

            {/* Face Identity Status Banner */}
            {identityStatus==='mismatch'&&(
                <div className="identity-alert identity-alert-danger">
                    <ShieldAlertIcon size={14} />
                    <span>Face Identity Mismatch ({faceMismatches}x) — Possible impersonation</span>
                </div>
            )}
            {identityStatus==='verified'&&(
                <div className="identity-alert identity-alert-success">
                    <FingerprintIcon size={14} />
                    <span>Identity Confirmed ({faceVerifications} checks passed)</span>
                </div>
            )}

            <div className="events-list">
                <div className="events-header">
                    Events {newEventPulse&&<span className="live-indicator"><RecordIcon size={10} color="#ef4444" /> LIVE</span>}
                </div>
                {events.length===0? (
                    <div className="no-events">
                        <CheckCircleIcon size={16} /> No violations
                    </div>
                ):(
                    <div className="events">
                        {events.slice(-10).reverse().map((event, index) => (
                            <div key={index} className="event-item">
                                <div className="event-severity" style={{background: getSeverityBadge(event.severity)}} />
                                <div className="event-content">
                                    <div className="event-type">{formatEventType(event)}</div>
                                    <div className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ProctoringMonitor;
