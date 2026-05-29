import {useState, useEffect, useRef} from 'react';
import socketService from '../services/socket';
import {Smartphone as PhoneIcon, AlertCircle as AlertIcon, Clipboard as ClipboardIcon, Check as CheckIcon} from 'lucide-react';
import './SecondaryCamera.css';

// Module-level cache: survives component remounts so QR code stays valid
const connectionCodeCache=new Map();

function SecondaryCamera({interviewId, userName, isPhone=false})
{
    const [stream, setStream]=useState(null);
    const [isConnected, setIsConnected]=useState(false);
    const [connectionCode, setConnectionCode]=useState('');
    const [showQR, setShowQR]=useState(false);
    const [cameraError, setCameraError]=useState(null);
    const [invalidCode, setInvalidCode]=useState(false);
    const [linkCopied, setLinkCopied]=useState(false);
    const videoRef=useRef();
    // Use ref for stream to avoid stale closure in cleanup
    const streamRef=useRef(null);
    // Track snapshot interval for cleanup
    const snapshotIntervalRef=useRef(null);
    // Track reconnect cleanup
    const reconnectCleanupRef=useRef(null);
    // Ref to store the connection code for re-registration on reconnect
    const connectionCodeRef=useRef('');

    useEffect(() =>
    {
        let cleanupSocket=null;
        const socket=socketService.connect();
        if (isPhone)
        {
            // Wait for socket connection before starting camera
            if (socket.connected)
            {
                startPhoneCamera();
            } else
            {
                socket.once('connect', () =>
                {
                    console.log('[SecondaryCamera] Socket connected on phone, starting camera...');
                    startPhoneCamera();
                });
            }
            // Handle phone socket reconnection — re-emit connect event
            const handlePhoneReconnect=() =>
            {
                const urlParams=new URLSearchParams(window.location.search);
                const code=urlParams.get('code');
                if (code)
                {
                    console.log('[SecondaryCamera] Phone socket reconnected, re-connecting...');
                    socketService.connectSecondaryCamera(code, 'connected');
                }
            };
            socket.on('reconnect', handlePhoneReconnect);
            // Listen for ack from server
            const handleAck=(data) =>
            {
                if (data.connected)
                {
                    setIsConnected(true);
                    setInvalidCode(false);
                    console.log('[SecondaryCamera] Server acknowledged phone connection');
                } else
                {
                    setIsConnected(false);
                    setCameraError(data.error||'Failed to connect to interview session');
                    if (data.error==='Invalid connection code')
                    {
                        setInvalidCode(true);
                    }
                }
            };
            socket.on('secondary-camera-ack', handleAck);
            // Listen for interview ended — stop camera and show message
            const handleInterviewEnded=(data) =>
            {
                console.log('[SecondaryCamera] Interview ended, stopping camera');
                if (streamRef.current)
                {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current=null;
                }
                if (snapshotIntervalRef.current)
                {
                    clearInterval(snapshotIntervalRef.current);
                    snapshotIntervalRef.current=null;
                }
                setIsConnected(false);
                setStream(null);
                setCameraError('Interview has ended. You can close this page.');
            };
            socket.on('interview-ended', handleInterviewEnded);
            cleanupSocket=() =>
            {
                socket.off('reconnect', handlePhoneReconnect);
                socket.off('secondary-camera-ack', handleAck);
                socket.off('interview-ended', handleInterviewEnded);
            };
        } else
        {
            // Desktop logic
            if (interviewId&&!connectionCodeRef.current)
            {
                // Generate code only if we don't have one for this component instance
                const randomPart=crypto.randomUUID? crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
                const code=`${interviewId}-${randomPart}`;
                setConnectionCode(code);
                connectionCodeRef.current=code;
                console.log('[SecondaryCamera] Generated stable connection code:', code);
                socketService.registerSecondaryCamera(interviewId, code);
            } else if (connectionCodeRef.current)
            {
                // Re-register existing code (e.g. on interviewId change if we kept component)
                socketService.registerSecondaryCamera(interviewId, connectionCodeRef.current);
            }

            const handleReconnect=() =>
            {
                if (connectionCodeRef.current)
                {
                    console.log('[SecondaryCamera] Desktop socket reconnected, re-registering code...');
                    socketService.registerSecondaryCamera(interviewId, connectionCodeRef.current);
                }
            };
            socket.on('reconnect', handleReconnect);
            reconnectCleanupRef.current=() => socket.off('reconnect', handleReconnect);
            cleanupSocket=listenForSecondaryCamera();
        }
        return () =>
        {
            if (streamRef.current)
            {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (snapshotIntervalRef.current)
            {
                clearInterval(snapshotIntervalRef.current);
            }
            if (cleanupSocket) cleanupSocket();
            if (reconnectCleanupRef.current) reconnectCleanupRef.current();
        };
    }, [interviewId]);

    const startPhoneCamera=async () =>
    {
        try
        {
            // Request back/environment camera for phone
            const mediaStream=await navigator.mediaDevices.getUserMedia({
                video: {
                    width: {ideal: 1280},
                    height: {ideal: 720},
                    facingMode: {ideal: 'environment'} // Back camera
                },
                audio: false
            });

            setStream(mediaStream);
            streamRef.current=mediaStream;

            // Set video srcObject — use a small delay to ensure ref is attached
            const attachStream=() =>
            {
                if (videoRef.current)
                {
                    videoRef.current.srcObject=mediaStream;
                    videoRef.current.play().catch(err => console.warn('Video autoplay failed:', err));
                } else
                {
                    // Retry once after a short delay (ref may not be attached yet)
                    setTimeout(() =>
                    {
                        if (videoRef.current)
                        {
                            videoRef.current.srcObject=mediaStream;
                            videoRef.current.play().catch(err => console.warn('Video autoplay retry failed:', err));
                        }
                    }, 200);
                }
            };
            attachStream();

            // Notify server about secondary camera connection
            const urlParams=new URLSearchParams(window.location.search);
            const code=urlParams.get('code');

            if (code)
            {
                // Ensure socket is connected before emitting
                const socket=socketService.getSocket();
                if (socket&&socket.connected)
                {
                    socketService.connectSecondaryCamera(code, 'connected');
                    setIsConnected(true);
                    console.log('[SecondaryCamera] Phone connected with code:', code);
                    // Send periodic snapshots for proctoring
                    startSnapshotCapture(mediaStream);
                } else
                {
                    console.warn('[SecondaryCamera] Socket not connected yet, waiting...');
                    // Wait for socket to connect then emit
                    const s=socketService.connect();
                    s.once('connect', () =>
                    {
                        socketService.connectSecondaryCamera(code, 'connected');
                        setIsConnected(true);
                        console.log('[SecondaryCamera] Phone connected (delayed) with code:', code);
                        startSnapshotCapture(mediaStream);
                    });
                }
            } else
            {
                setCameraError('No connection code found. Please scan the QR code again.');
            }
        } catch (error)
        {
            console.error('Failed to start phone camera:', error);
            if (error.name==='NotAllowedError')
            {
                setCameraError('Camera permission denied. Please allow camera access in your browser settings and reload.');
            } else if (error.name==='NotFoundError')
            {
                setCameraError('No camera found on this device.');
            } else
            {
                setCameraError(`Error accessing camera: ${error.message}. Please allow camera permissions.`);
            }
        }
    };

    const startSnapshotCapture=(mediaStream) =>
    {
        const canvas=document.createElement('canvas');
        const context=canvas.getContext('2d');

        // Store interval ID for cleanup
        snapshotIntervalRef.current=setInterval(() =>
        {
            if (videoRef.current&&videoRef.current.readyState===4)
            {
                canvas.width=videoRef.current.videoWidth;
                canvas.height=videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0);

                // Convert to base64 and send snapshot
                const snapshot=canvas.toDataURL('image/jpeg', 0.5);
                const urlParams=new URLSearchParams(window.location.search);
                const code=urlParams.get('code');

                socketService.sendSecondarySnapshot(code, snapshot);
            }
        }, 3000); // Send snapshot every 3 seconds
    };

    const listenForSecondaryCamera=() =>
    {
        const socket=socketService.connect();

        const handleConnected=(data) =>
        {
            console.log('Secondary camera connected');
            setIsConnected(true);
        };

        const handleDisconnected=(data) =>
        {
            console.log('Secondary camera disconnected:', data?.reason);
            setIsConnected(false);
        };

        const handleSnapshot=(data) =>
        {
            console.log('Received snapshot from secondary camera');
        };

        socket.on('secondary-camera-connected', handleConnected);
        socket.on('secondary-camera-disconnected', handleDisconnected);
        socket.on('secondary-snapshot', handleSnapshot);

        // Return cleanup function
        return () =>
        {
            socket.off('secondary-camera-connected', handleConnected);
            socket.off('secondary-camera-disconnected', handleDisconnected);
            socket.off('secondary-snapshot', handleSnapshot);
        };
    };

    const getQRCodeURL=() =>
    {
        const phoneURL=`${window.location.origin}/secondary-camera?code=${connectionCode}`;
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(phoneURL)}`;
    };

    const copyLinkToClipboard=async () =>
    {
        const phoneURL=`${window.location.origin}/secondary-camera?code=${connectionCode}`;
        try
        {
            await navigator.clipboard.writeText(phoneURL);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 3000);
        } catch (err)
        {
            // Fallback: select text from a temporary input
            console.warn('Clipboard API unavailable, using fallback');
            const tempInput=document.createElement('input');
            tempInput.value=phoneURL;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 3000);
        }
    };

    if (isPhone)
    {
        // Phone view - show camera stream
        return (
            <div className="secondary-camera-phone">
                <div className="phone-header">
                    <h2><PhoneIcon size={20} /> Secondary Camera</h2>
                    {isConnected&&<span className="connected-badge"><CheckIcon size={14} /> Connected</span>}
                </div>
                {cameraError&&(
                    <div style={{padding: '16px', color: '#ef4444', textAlign: 'center'}}>{cameraError}</div>
                )}
                {invalidCode&&(
                    <div style={{padding: '16px', color: '#ef4444', textAlign: 'center'}}>
                        Invalid connection code.<br />
                        <button style={{marginTop: '8px'}} onClick={() => window.location.reload()}>Retry</button>
                        <div style={{marginTop: '8px', fontSize: '14px'}}>
                            Please rescan the QR code or reload the desktop page.
                        </div>
                    </div>
                )}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="phone-video"
                />
                <div className="phone-instructions">
                    <p>Position your phone to show:</p>
                    <ul>
                        <li>Your workspace from the side</li>
                        <li>Your hands and keyboard</li>
                        <li>Room environment</li>
                    </ul>
                    <p className="warning"><AlertIcon size={14} /> Keep this window open during the interview</p>
                </div>
            </div>
        );
    }

    // Main device view - show connection setup
    return (
        <div className="secondary-camera-setup">
            <div className="setup-header">
                <h4><PhoneIcon size={18} /> Secondary Camera Setup</h4>
                {isConnected? (
                    <span className="status connected"><CheckIcon size={14} /> Connected</span>
                ):(
                    <span className="status disconnected">○ Not Connected</span>
                )}
            </div>

            {!isConnected&&(
                <div className="connection-methods">
                    <div className="method">
                        <h5>Option 1: Scan QR Code</h5>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowQR(!showQR)}
                        >
                            {showQR? 'Hide QR Code':'Show QR Code'}
                        </button>
                        {showQR&&(
                            <div className="qr-container">
                                <img
                                    src={getQRCodeURL()}
                                    alt="QR Code"
                                    className="qr-code"
                                />
                                <p className="qr-instruction">Scan with your phone camera</p>
                            </div>
                        )}
                    </div>

                    <div className="method-divider">OR</div>

                    <div className="method">
                        <h5>Option 2: Copy Link</h5>
                        <button
                            className="btn btn-secondary"
                            onClick={copyLinkToClipboard}
                        >
                            <ClipboardIcon size={16} /> {linkCopied? 'Link Copied!':'Copy Connection Link'}
                        </button>
                        <p className="method-instruction">Open the link on your phone browser</p>
                    </div>
                </div>
            )}

            {isConnected&&(
                <div className="connected-info">
                    <div className="info-icon"><CheckIcon size={18} /></div>
                    <div className="info-text">
                        <p>Secondary camera is active</p>
                        <small>Receiving snapshots every 3 seconds</small>
                    </div>
                </div>
            )}

            <div className="setup-instructions">
                <h5>Instructions:</h5>
                <ol>
                    <li>Use your phone as a secondary camera</li>
                    <li>Position it to show your workspace from the side</li>
                    <li>Keep the camera active throughout the interview</li>
                </ol>
            </div>
        </div>
    );
}

export default SecondaryCamera;
