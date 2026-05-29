import {useState, useEffect, useRef, useCallback} from 'react';
import Peer from 'simple-peer';
import socketService from '../services/socket';
import {Video as VideoIcon, VideoOff as VideoOffIcon, Mic as MicIcon, MicOff as MicOffIcon, Loader2 as LoadingIcon, Smartphone as PhoneIcon, Monitor as ScreenIcon, MonitorOff as ScreenOffIcon} from 'lucide-react';
import './VideoPanel.css';

function VideoPanel({interviewId, userName, role, videoRef, onVideoReady, secondaryCamSnapshot, onScreenShareChange})
{
    const [localStream, setLocalStream]=useState(null);
    const [remoteStream, setRemoteStream]=useState(null);
    const [isVideoOn, setIsVideoOn]=useState(true);
    const [isAudioOn, setIsAudioOn]=useState(true);
    const [isScreenSharing, setIsScreenSharing]=useState(false);
    const [remotePeerId, setRemotePeerId]=useState(null);
    const [isLoading, setIsLoading]=useState(true);
    const [cameraError, setCameraError]=useState(null);
    const [connectionStatus, setConnectionStatus]=useState('waiting');

    const internalVideoRef=useRef();
    const localVideoRef=videoRef||internalVideoRef;
    const remoteVideoRef=useRef();
    const screenVideoRef=useRef();
    const peerRef=useRef(null);
    const localStreamRef=useRef(null);
    const screenStreamRef=useRef(null);
    const pendingPeerRef=useRef(null);
    const pendingSignalsRef=useRef([]);
    const roleRef=useRef(role);
    const remotePeerIdRef=useRef(null);
    const originalVideoTrackRef=useRef(null);
    const reconnectTimerRef=useRef(null);
    const reconnectAttemptsRef=useRef(0);
    const MAX_RECONNECT_ATTEMPTS=5;

    useEffect(() => {roleRef.current=role;}, [role]);

    // When localStream becomes available, process any queued peer connection
    useEffect(() =>
    {
        if (!localStream) return;
        if (pendingPeerRef.current&&roleRef.current==='recruiter')
        {
            console.log('[WebRTC] Stream ready — initiating queued call to', pendingPeerRef.current);
            createPeer(true, pendingPeerRef.current);
            pendingPeerRef.current=null;
        }
        if (pendingSignalsRef.current.length>0)
        {
            console.log('[WebRTC] Stream ready — processing', pendingSignalsRef.current.length, 'queued signals');
            const signals=[...pendingSignalsRef.current];
            pendingSignalsRef.current=[];
            for (const {signal, from} of signals)
            {
                handleIncomingSignal(signal, from);
            }
        }
    }, [localStream]);

    useEffect(() =>
    {
        startLocalStream();
        const cleanupWebRTC=setupWebRTC();

        return () =>
        {
            if (localStreamRef.current)
            {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (screenStreamRef.current)
            {
                screenStreamRef.current.getTracks().forEach(track => track.stop());
            }
            clearTimeout(reconnectTimerRef.current);
            if (peerRef.current)
            {
                try {peerRef.current.destroy();} catch (e) {/* already destroyed */}
                peerRef.current=null;
            }
            if (cleanupWebRTC) cleanupWebRTC();
        };
    }, []);

    // Attach remote stream to remoteVideoRef after React renders the <video>
    useEffect(() =>
    {
        if (remoteVideoRef.current&&remoteStream)
        {
            remoteVideoRef.current.srcObject=remoteStream;
        }
    }, [remoteStream]);

    // Attach screen stream to screenVideoRef once it renders
    useEffect(() =>
    {
        if (isScreenSharing&&screenVideoRef.current&&screenStreamRef.current)
        {
            screenVideoRef.current.srcObject=screenStreamRef.current;
        }
    }, [isScreenSharing]);

    const startLocalStream=async () =>
    {
        try
        {
            const stream=await navigator.mediaDevices.getUserMedia({
                video: {
                    width: {ideal: 1280},
                    height: {ideal: 720},
                    facingMode: 'user'
                },
                audio: true,
            });

            setLocalStream(stream);
            localStreamRef.current=stream;
            if (localVideoRef.current)
            {
                localVideoRef.current.srcObject=stream;

                const handleLoadedMetadata=() =>
                {
                    console.log('Video metadata loaded, dimensions:', localVideoRef.current.videoWidth, 'x', localVideoRef.current.videoHeight);
                    setIsLoading(false);

                    localVideoRef.current.play().then(() =>
                    {
                        console.log('Video playing');
                        if (onVideoReady) onVideoReady(stream);
                    }).catch(err =>
                    {
                        console.error('Error playing video:', err);
                        if (onVideoReady) onVideoReady(stream);
                    });
                };

                localVideoRef.current.onloadedmetadata=handleLoadedMetadata;
                if (localVideoRef.current.readyState>=1) handleLoadedMetadata();
            }
        } catch (error)
        {
            console.error('Error accessing media devices:', error);
            setIsLoading(false);
            setCameraError('Camera access denied. Please allow camera permissions to join the interview.');
        }
    };

    // ---- Unified signal handler: routes SDP vs ICE to correct peer ----
    const handleIncomingSignal=(signal, fromPeerId) =>
    {
        // If peer exists, just forward signal to it (ICE candidates, etc.)
        if (peerRef.current)
        {
            console.log('[WebRTC] Forwarding signal to existing peer, type:', signal.type||'candidate');
            try {peerRef.current.signal(signal);} catch (e) {console.error('[WebRTC] signal() error:', e);}
            return;
        }
        // No peer yet — only create one for an SDP offer (responder side)
        if (signal.type==='offer')
        {
            console.log('[WebRTC] Creating responder peer for offer from', fromPeerId);
            remotePeerIdRef.current=fromPeerId;
            setRemotePeerId(fromPeerId);
            createPeer(false, fromPeerId, signal);
        }
        else
        {
            // ICE candidate arrived before peer was created — queue it
            console.log('[WebRTC] Queuing signal (no peer yet), type:', signal.type||'candidate');
            pendingSignalsRef.current.push({signal, from: fromPeerId});
        }
    };

    // ---- Create peer (initiator or responder) ----
    const createPeer=(initiator, targetPeerId, initialSignal) =>
    {
        const stream=localStreamRef.current;
        if (!stream) {console.warn('[WebRTC] createPeer — no local stream'); return;}
        console.log('[WebRTC] Creating peer, initiator:', initiator, 'target:', targetPeerId);

        if (peerRef.current) {peerRef.current.destroy(); peerRef.current=null;}

        const peer=new Peer({
            initiator,
            trickle: true,
            stream,
            config: {
                iceServers: [
                    {urls: 'stun:stun.l.google.com:19302'},
                    {urls: 'stun:stun1.l.google.com:19302'},
                    {urls: 'stun:stun2.l.google.com:19302'},
                    {urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject'},
                    {urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject'},
                    {urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject'},
                ]
            },
        });

        peer.on('signal', (sig) =>
        {
            // Route outgoing signals based on type
            if (sig.type==='offer')
            {
                console.log('[WebRTC] Sending SDP offer to', targetPeerId);
                socketService.sendOffer(sig, targetPeerId);
            }
            else if (sig.type==='answer')
            {
                console.log('[WebRTC] Sending SDP answer to', targetPeerId);
                socketService.sendAnswer(sig, targetPeerId);
            }
            else if (sig.candidate)
            {
                console.log('[WebRTC] Sending ICE candidate to', targetPeerId);
                socketService.sendIceCandidate(sig, targetPeerId);
            }
        });

        peer.on('stream', (remStream) =>
        {
            console.log('[WebRTC] Got remote stream, tracks:', remStream.getTracks().map(t => t.kind));
            setRemoteStream(remStream);
            setConnectionStatus('connected');
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject=remStream;
        });

        peer.on('connect', () =>
        {
            console.log('[WebRTC] Peer connected!');
            reconnectAttemptsRef.current=0;
            setConnectionStatus('connected');
        });

        peer.on('error', (err) =>
        {
            console.error('[WebRTC] Peer error:', err);
            setConnectionStatus('error');
            // Safely destroy peer to prevent _readableState crashes
            try {if (peerRef.current) {peerRef.current.destroy(); peerRef.current=null;} } catch (e) {/* already destroyed */}
            attemptReconnect(targetPeerId);
        });

        peer.on('close', () =>
        {
            console.log('[WebRTC] Peer connection closed');
            // Guard against _readableState crash by nulling ref immediately
            peerRef.current=null;
            setConnectionStatus('disconnected');
        });

        peerRef.current=peer;

        // Catch unhandled stream errors from simple-peer internals (_readableState)
        if (peer._channel) {try {peer._channel.onerror=(e) => console.warn('[WebRTC] DataChannel error (suppressed):', e);} catch (e) {/* ignore */} }

        // If we have an initial offer to process (responder), signal it
        if (initialSignal) peer.signal(initialSignal);

        // Process any queued signals
        if (pendingSignalsRef.current.length>0)
        {
            console.log('[WebRTC] Processing', pendingSignalsRef.current.length, 'queued signals');
            const queued=[...pendingSignalsRef.current];
            pendingSignalsRef.current=[];
            for (const {signal} of queued) {try {peer.signal(signal);} catch (e) {console.error('[WebRTC] queued signal error:', e);} }
        }
    };

    // ---- Reconnection with exponential backoff ----
    const attemptReconnect=(targetPeerId) =>
    {
        const target=targetPeerId||remotePeerIdRef.current;
        if (!target) {console.warn('[WebRTC] No target peer for reconnect'); return;}
        if (reconnectAttemptsRef.current>=MAX_RECONNECT_ATTEMPTS)
        {
            console.error('[WebRTC] Max reconnect attempts reached');
            setConnectionStatus('error');
            return;
        }
        const delay=Math.min(1000*Math.pow(2, reconnectAttemptsRef.current), 16000);
        reconnectAttemptsRef.current++;
        console.log(`[WebRTC] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
        setConnectionStatus('reconnecting');
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current=setTimeout(() =>
        {
            if (roleRef.current==='recruiter'&&localStreamRef.current)
            {
                createPeer(true, target);
            }
        }, delay);
    };

    const setupWebRTC=() =>
    {
        const socket=socketService.getSocket()||socketService.connect();
        if (!socket) {console.warn('[WebRTC] No socket available'); return null;}

        const handleUserJoined=(data) =>
        {
            console.log('[WebRTC] User joined:', data);
            setRemotePeerId(data.userId);
            remotePeerIdRef.current=data.userId;

            // Recruiter initiates the call
            if (roleRef.current==='recruiter')
            {
                if (localStreamRef.current)
                {
                    createPeer(true, data.userId);
                }
                else
                {
                    console.log('[WebRTC] Stream not ready yet — queuing call to', data.userId);
                    pendingPeerRef.current=data.userId;
                }
            }
        };

        const handleWebRTCOffer=(data) =>
        {
            console.log('[WebRTC] Received offer/signal from:', data.from, 'type:', data.offer?.type||'candidate');
            if (localStreamRef.current)
            {
                handleIncomingSignal(data.offer, data.from);
            }
            else
            {
                console.log('[WebRTC] Stream not ready yet — queuing signal from', data.from);
                pendingSignalsRef.current.push({signal: data.offer, from: data.from});
            }
        };

        const handleWebRTCAnswer=(data) =>
        {
            console.log('[WebRTC] Received answer from:', data.from, 'type:', data.answer?.type||'candidate');
            if (peerRef.current)
            {
                try {peerRef.current.signal(data.answer);} catch (e) {console.error('[WebRTC] answer signal error:', e);}
            }
            else
            {
                console.log('[WebRTC] No peer for answer — queuing');
                pendingSignalsRef.current.push({signal: data.answer, from: data.from});
            }
        };

        const handleICECandidate=(data) =>
        {
            console.log('[WebRTC] Received ICE candidate from:', data.from);
            if (peerRef.current)
            {
                try {peerRef.current.signal(data.candidate);} catch (e) {console.error('[WebRTC] ICE signal error:', e);}
            }
            else
            {
                console.log('[WebRTC] No peer for ICE — queuing');
                pendingSignalsRef.current.push({signal: data.candidate, from: data.from});
            }
        };

        const handleUserLeft=(data) =>
        {
            console.log('[WebRTC] User left:', data?.userId);
            setRemoteStream(null);
            setRemotePeerId(null);
            remotePeerIdRef.current=null;
            setConnectionStatus('waiting');
            if (peerRef.current)
            {
                peerRef.current.destroy();
                peerRef.current=null;
            }
        };

        // Handle list of users already in the room (sent on join)
        const handleRoomUsers=(data) =>
        {
            console.log('[WebRTC] Existing room users:', data.users);
            if (data.users&&data.users.length>0)
            {
                const otherUser=data.users[0]; // first other user
                setRemotePeerId(otherUser.userId);
                remotePeerIdRef.current=otherUser.userId;

                // Recruiter always initiates the call
                if (roleRef.current==='recruiter')
                {
                    if (localStreamRef.current)
                    {
                        createPeer(true, otherUser.userId);
                    }
                    else
                    {
                        console.log('[WebRTC] Stream not ready — queuing call to existing user', otherUser.userId);
                        pendingPeerRef.current=otherUser.userId;
                    }
                }
            }
        };

        socket.on('user-joined', handleUserJoined);
        socket.on('room-users', handleRoomUsers);
        socket.on('webrtc-offer', handleWebRTCOffer);
        socket.on('webrtc-answer', handleWebRTCAnswer);
        socket.on('webrtc-ice-candidate', handleICECandidate);
        socket.on('user-left', handleUserLeft);

        return () =>
        {
            socket.off('user-joined', handleUserJoined);
            socket.off('room-users', handleRoomUsers);
            socket.off('webrtc-offer', handleWebRTCOffer);
            socket.off('webrtc-answer', handleWebRTCAnswer);
            socket.off('webrtc-ice-candidate', handleICECandidate);
            socket.off('user-left', handleUserLeft);
        };
    };

    // ---- Screen Sharing ----
    const toggleScreenShare=async () =>
    {
        if (isScreenSharing)
        {
            // Stop screen sharing — restore camera track
            if (screenStreamRef.current)
            {
                screenStreamRef.current.getTracks().forEach(t => t.stop());
                screenStreamRef.current=null;
            }
            const camTrack=originalVideoTrackRef.current;
            if (camTrack&&peerRef.current)
            {
                try
                {
                    const currentVideoTrack=localStreamRef.current?.getVideoTracks()?.[0]||null;
                    if (currentVideoTrack)
                    {
                        peerRef.current.replaceTrack(currentVideoTrack, camTrack, localStreamRef.current);
                    }
                }
                catch (e) {console.error('[ScreenShare] replaceTrack restore error:', e);}
            }
            if (localStreamRef.current&&camTrack)
            {
                const tracks=localStreamRef.current.getVideoTracks();
                if (tracks.length>0)
                {
                    localStreamRef.current.removeTrack(tracks[0]);
                }
                localStreamRef.current.addTrack(camTrack);
            }
            // Restore local video to camera
            if (localVideoRef.current&&localStreamRef.current) localVideoRef.current.srcObject=localStreamRef.current;
            if (screenVideoRef.current) screenVideoRef.current.srcObject=null;
            setIsScreenSharing(false);
            if (onScreenShareChange) onScreenShareChange(false);
        }
        else
        {
            // Notify proctoring BEFORE the picker dialog opens (prevents false positives)
            if (onScreenShareChange) onScreenShareChange(true);

            try
            {
                // Force ENTIRE SCREEN only — no tab/window options
                const screenStream=await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        displaySurface: 'monitor',
                    },
                    audio: false,
                    selfBrowserSurface: 'exclude',
                    surfaceSwitching: 'exclude',
                    systemAudio: 'exclude',
                });

                // Verify user selected entire screen (not tab/window)
                const screenTrack=screenStream.getVideoTracks()[0];
                const settings=screenTrack.getSettings();
                if (settings.displaySurface&&settings.displaySurface!=='monitor')
                {
                    // User selected a window or tab — reject it
                    screenStream.getTracks().forEach(t => t.stop());
                    alert('Please share your entire screen, not a window or tab.');
                    if (onScreenShareChange) onScreenShareChange(false);
                    return;
                }

                screenStreamRef.current=screenStream;
                // Save original camera track for restoration
                if (!originalVideoTrackRef.current)
                {
                    originalVideoTrackRef.current=localStreamRef.current?.getVideoTracks()[0];
                }

                // Replace the video track in the peer connection
                if (peerRef.current)
                {
                    try
                    {
                        const currentVideoTrack=localStreamRef.current?.getVideoTracks()?.[0]||null;
                        if (currentVideoTrack)
                        {
                            peerRef.current.replaceTrack(currentVideoTrack, screenTrack, localStreamRef.current);
                        }
                    }
                    catch (e) {console.error('[ScreenShare] replaceTrack error:', e);}
                }

                if (localStreamRef.current)
                {
                    const tracks=localStreamRef.current.getVideoTracks();
                    if (tracks.length>0)
                    {
                        localStreamRef.current.removeTrack(tracks[0]);
                    }
                    localStreamRef.current.addTrack(screenTrack);
                }

                // Set state first — useEffect will attach stream to video element after render
                setIsScreenSharing(true);

                // When user stops sharing via browser UI
                screenTrack.onended=() =>
                {
                    toggleScreenShare();
                };
            }
            catch (err)
            {
                console.error('[ScreenShare] Error:', err);
                // User cancelled the picker
                if (onScreenShareChange) onScreenShareChange(false);
            }
        }
    };

    const toggleVideo=() =>
    {
        if (localStream)
        {
            localStream.getVideoTracks().forEach(track => {track.enabled=!track.enabled;});
            setIsVideoOn(!isVideoOn);
        }
    };

    const toggleAudio=() =>
    {
        if (localStream)
        {
            localStream.getAudioTracks().forEach(track => {track.enabled=!track.enabled;});
            setIsAudioOn(!isAudioOn);
        }
    };

    return (
        <div className="video-panel card">
            <div className="video-header">
                <h3><VideoIcon size={18} /> Video Call</h3>
                {connectionStatus==='connected'&&<span className="connection-badge connected">Connected</span>}
                {connectionStatus==='reconnecting'&&<span className="connection-badge reconnecting">Reconnecting…</span>}
                {connectionStatus==='error'&&<span className="connection-badge error">Error</span>}
                {connectionStatus==='disconnected'&&<span className="connection-badge disconnected">Disconnected</span>}
            </div>

            <div className="videos">
                {/* Screen Share - full width when active */}
                {isScreenSharing&&(
                    <div className="video-container screen-share-main">
                        <video
                            ref={screenVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="video"
                        />
                        <div className="video-label">Your Screen</div>
                    </div>
                )}

                {/* Local Video (camera) */}
                <div className={`video-container local ${isScreenSharing? 'pip-mode':''}`}>
                    {cameraError&&(
                        <div className="camera-error" style={{padding: '16px', color: '#ef4444', textAlign: 'center', fontSize: '14px'}}>
                            <p>{cameraError}</p>
                        </div>
                    )}
                    {isLoading&&!cameraError&&(
                        <div className="waiting">
                            <div className="waiting-icon"><LoadingIcon size={24} /></div>
                            <p>Starting camera...</p>
                        </div>
                    )}
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="video"
                        style={{display: isLoading? 'none':'block'}}
                    />
                    {!isLoading&&!isScreenSharing&&<div className="video-label">You ({userName})</div>}
                </div>

                {/* Remote Video */}
                <div className="video-container remote">
                    {remoteStream? (
                        <>
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="video"
                            />
                            <div className="video-label">Remote User</div>
                        </>
                    ):(
                        <div className="waiting">
                            <div className="waiting-icon"><LoadingIcon size={24} /></div>
                            <p>Waiting for participant...</p>
                        </div>
                    )}
                </div>

                {/* Secondary Camera Feed - Only visible to recruiter */}
                {secondaryCamSnapshot&&role==='recruiter'&&(
                    <div className="video-container secondary-cam">
                        <img
                            src={secondaryCamSnapshot}
                            alt="Secondary Camera"
                            className="video"
                        />
                        <div className="video-label"><PhoneIcon size={10} /> Cam 2</div>
                    </div>
                )}
            </div>

            <div className="video-controls">
                <button
                    className={`control-btn ${!isVideoOn? 'off':''}`}
                    onClick={toggleVideo}
                    title="Toggle Video"
                    disabled={isScreenSharing}
                >
                    {isVideoOn? <VideoIcon size={18} />:<VideoOffIcon size={18} />}
                </button>
                <button
                    className={`control-btn ${!isAudioOn? 'off':''}`}
                    onClick={toggleAudio}
                    title="Toggle Audio"
                >
                    {isAudioOn? <MicIcon size={18} />:<MicOffIcon size={18} />}
                </button>
                <button
                    className={`control-btn screen-share-btn ${isScreenSharing? 'active':''}`}
                    onClick={toggleScreenShare}
                    title={isScreenSharing? 'Stop Screen Share':'Share Screen'}
                >
                    {isScreenSharing? <ScreenOffIcon size={18} />:<ScreenIcon size={18} />}
                </button>
            </div>
        </div>
    );
}

export default VideoPanel;
