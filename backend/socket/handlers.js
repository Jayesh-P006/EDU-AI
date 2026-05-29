import geminiAI from '../services/geminiAI.js';
import pineconeService from '../services/pineconeService.js';
import {addMessage, getChatMessages} from '../routes/axiomChat.js';
import {setupQuizSocketHandlers} from './quizHandlers.js';

export function setupSocketHandlers(io)
{
    // Store secondary camera mappings
    const secondaryCameraMappings=new Map(); // code -> {interviewId, socketId}

    // Store proctor dashboard sockets
    const proctorDashboardSockets=new Set();

    // Track which rooms each socket has joined (for cleanup on disconnect)
    const socketRooms=new Map(); // socketId -> { interviewId, userName, role }

    io.on('connection', (socket) =>
    {
        console.log(`User connected: ${socket.id}`);

        // Join proctor dashboard room
        socket.on('join-proctor-dashboard', () =>
        {
            socket.join('proctor-dashboard');
            proctorDashboardSockets.add(socket.id);
            console.log(`Proctor joined dashboard: ${socket.id}`);
        });

        // Join interview room
        socket.on('join-interview', (data) =>
        {
            if (!data||!data.interviewId)
            {
                socket.emit('error', {message: 'interviewId is required'});
                return;
            }
            const {interviewId, userName='Anonymous', role='candidate'}=data;
            socket.join(interviewId);

            // Track room membership for cleanup
            socketRooms.set(socket.id, {interviewId, userName, role});

            console.log(`${userName} (${role}) joined interview ${interviewId}`);

            // Send existing room members to the new joiner
            // so they know who is already in the room
            const existingUsers=[];
            for (const [sid, info] of socketRooms.entries())
            {
                if (info.interviewId===interviewId&&sid!==socket.id)
                {
                    existingUsers.push({userId: sid, userName: info.userName, role: info.role});
                }
            }
            if (existingUsers.length>0)
            {
                socket.emit('room-users', {users: existingUsers});
            }

            // Notify others in the room
            socket.to(interviewId).emit('user-joined', {
                userId: socket.id,
                userName,
                role,
            });

            // Notify proctor dashboard of new session
            io.to('proctor-dashboard').emit('session-update', {
                interviewId,
                type: 'user-joined',
                userName,
                role,
            });
        });

        // Leave interview room
        socket.on('leave-interview', (data) =>
        {
            const {interviewId}=data||{};
            if (!interviewId) return;
            socket.leave(interviewId);

            const roomInfo=socketRooms.get(socket.id);
            socketRooms.delete(socket.id);

            socket.to(interviewId).emit('user-left', {
                userId: socket.id,
                userName: roomInfo?.userName,
            });

            // Notify proctor dashboard
            io.to('proctor-dashboard').emit('session-update', {
                interviewId,
                type: 'user-left',
                userName: roomInfo?.userName,
                role: roomInfo?.role,
            });
        });

        // WebRTC signaling - offer
        socket.on('webrtc-offer', (data) =>
        {
            const {offer, to}=data;
            io.to(to).emit('webrtc-offer', {
                offer,
                from: socket.id,
            });
        });

        // Recruiter starts the interview — notify candidate(s)
        socket.on('start-interview', (data) =>
        {
            const {interviewId}=data||{};
            if (!interviewId) return;
            console.log(`Interview started: ${interviewId}`);
            socket.to(interviewId).emit('interview-started', {interviewId});
        });

        // Recruiter ends the interview — notify candidate(s) to redirect
        socket.on('end-interview', (data) =>
        {
            const {interviewId}=data||{};
            if (!interviewId) return;
            console.log(`Interview ended by recruiter: ${interviewId}`);
            socket.to(interviewId).emit('interview-ended', {interviewId});

            // Also notify any secondary camera phones for this interview
            for (const [code, mapping] of secondaryCameraMappings.entries())
            {
                if (mapping.interviewId===interviewId&&mapping.phoneSocketId)
                {
                    io.to(mapping.phoneSocketId).emit('interview-ended', {interviewId});
                    console.log(`📱 Notified secondary camera phone to stop: ${code}`);
                    secondaryCameraMappings.delete(code);
                }
            }
        });

        // WebRTC signaling - answer
        socket.on('webrtc-answer', (data) =>
        {
            const {answer, to}=data;
            io.to(to).emit('webrtc-answer', {
                answer,
                from: socket.id,
            });
        });

        // WebRTC signaling - ICE candidate
        socket.on('webrtc-ice-candidate', (data) =>
        {
            const {candidate, to}=data;
            io.to(to).emit('webrtc-ice-candidate', {
                candidate,
                from: socket.id,
            });
        });

        // Code updates (real-time collaboration)
        socket.on('code-update', (data) =>
        {
            if (!data||!data.interviewId) return;
            const {interviewId, code, language}=data;
            // Only broadcast if code is a string and not excessively large (50KB max)
            if (typeof code!=='string'||code.length>50000) return;
            socket.to(interviewId).emit('code-update', {
                code,
                language,
                from: socket.id,
            });
        });

        // Language change (sync dropdown selection)
        socket.on('language-update', (data) =>
        {
            if (!data||!data.interviewId||!data.language) return;
            const {interviewId, language, code}=data;
            socket.to(interviewId).emit('language-update', {
                language,
                code,
                from: socket.id,
            });
        });

        // Output updates (sync run/submit results)
        socket.on('output-update', (data) =>
        {
            if (!data||!data.interviewId) return;
            const {interviewId, output}=data;
            if (typeof output!=='string'||output.length>100000) return;
            socket.to(interviewId).emit('output-update', {
                output,
                from: socket.id,
            });
        });

        // Question updates (interviewer changes question)
        socket.on('question-update', (data) =>
        {
            if (!data||!data.interviewId||!data.question) return;
            const {interviewId, question}=data;
            console.log(`Question updated in interview ${interviewId}:`, question.title||'untitled');
            socket.to(interviewId).emit('question-update', {
                question,
                from: socket.id,
            });
        });

        // Chat messages
        socket.on('chat-message', (data) =>
        {
            if (!data||!data.interviewId||!data.message||!data.userName) return;
            const {interviewId, message, userName}=data;

            // Validate message length (max 5000 chars)
            if (typeof message!=='string'||message.length>5000) return;
            // Validate userName
            if (typeof userName!=='string'||userName.length>100) return;

            io.to(interviewId).emit('chat-message', {
                message,
                userName,
                timestamp: new Date(),
                from: socket.id,
            });
        });

        // Proctoring events
        socket.on('proctoring-event', (data) =>
        {
            if (!data||!data.interviewId) return;
            const {interviewId, event}=data;
            if (!event||typeof event!=='object') return;

            // Notify recruiter about the event
            socket.to(interviewId).emit('proctoring-alert', {
                event,
                timestamp: new Date(),
            });

            // Notify proctor dashboard
            io.to('proctor-dashboard').emit('proctoring-alert', {
                interviewId,
                event,
                timestamp: new Date(),
            });
        });

        // Secondary camera - register mapping
        socket.on('register-secondary-camera', (data, ack) =>
        {
            const {interviewId, code}=data;
            secondaryCameraMappings.set(code, {
                interviewId,
                mainSocketId: socket.id
            });
            console.log(`📱 Secondary camera registered: ${code} for interview ${interviewId} (socket: ${socket.id})`);
            // Send acknowledgment if callback provided
            if (typeof ack==='function') ack({ok: true});
        });

        // Secondary camera - phone connection
        socket.on('connect-secondary-camera', (data) =>
        {
            const {code, status}=data;
            const mapping=secondaryCameraMappings.get(code);

            if (mapping)
            {
                // Store phone socket ID
                mapping.phoneSocketId=socket.id;
                secondaryCameraMappings.set(code, mapping);

                // Join phone socket into the interview room so it can receive events
                socket.join(mapping.interviewId);

                // Notify main device directly AND via room (handles stale socket IDs after reconnect)
                io.to(mapping.mainSocketId).emit('secondary-camera-connected', {
                    status,
                    timestamp: new Date()
                });
                // Also broadcast to the interview room so desktop gets it even after reconnect
                socket.to(mapping.interviewId).emit('secondary-camera-connected', {
                    status,
                    timestamp: new Date()
                });

                // Acknowledge to the phone that connection succeeded
                socket.emit('secondary-camera-ack', {connected: true, interviewId: mapping.interviewId});

                console.log(`📱 Secondary camera connected: ${code} (phone socket: ${socket.id})`);
            } else
            {
                console.warn(`📱 Secondary camera code not found: ${code}`);
                socket.emit('secondary-camera-ack', {connected: false, error: 'Invalid connection code'});
            }
        });

        // Secondary camera - receive snapshot
        socket.on('secondary-snapshot', (data) =>
        {
            if (!data||!data.code) return;
            const {code, snapshot}=data;

            // Limit snapshot size to 500KB (base64 JPEG ~150-300KB typical)
            if (typeof snapshot!=='string'||snapshot.length>500000) return;

            const mapping=secondaryCameraMappings.get(code);

            if (mapping)
            {
                // console.log(`📱 Snapshot from ${code} forwarding to ${mapping.interviewId}`);

                // Forward snapshot to main device and every one in the room (including recruiter)
                // Use io.to() instead of socket.to() to ensure reliable delivery even if socket paths vary
                io.to(mapping.mainSocketId).emit('secondary-snapshot', {
                    snapshot,
                    timestamp: new Date()
                });

                // Also send to interview room for recruiter
                io.to(mapping.interviewId).emit('secondary-snapshot', {
                    snapshot,
                    timestamp: new Date()
                });
            }
        });

        // Disconnect — clean up all state for this socket
        socket.on('disconnect', () =>
        {
            console.log(`User disconnected: ${socket.id}`);

            // Clean up interview room membership
            const roomInfo=socketRooms.get(socket.id);
            if (roomInfo)
            {
                socket.to(roomInfo.interviewId).emit('user-left', {
                    userId: socket.id,
                    userName: roomInfo.userName,
                });
                io.to('proctor-dashboard').emit('session-update', {
                    interviewId: roomInfo.interviewId,
                    type: 'user-disconnected',
                    userName: roomInfo.userName,
                    role: roomInfo.role,
                });
                socketRooms.delete(socket.id);
            }

            // Clean up proctor dashboard membership
            proctorDashboardSockets.delete(socket.id);

            // Clean up secondary camera mappings (both main and phone sockets)
            for (const [code, mapping] of secondaryCameraMappings.entries())
            {
                if (mapping.phoneSocketId===socket.id)
                {
                    // Phone disconnected — notify desktop that secondary camera is gone
                    io.to(mapping.mainSocketId).emit('secondary-camera-disconnected', {
                        reason: 'phone-disconnected',
                        timestamp: new Date()
                    });
                    // Also notify via interview room (in case mainSocketId is stale)
                    io.to(mapping.interviewId).emit('secondary-camera-disconnected', {
                        reason: 'phone-disconnected',
                        timestamp: new Date()
                    });
                    console.log(`📱 Secondary camera phone disconnected: ${code}`);
                    secondaryCameraMappings.delete(code);
                } else if (mapping.mainSocketId===socket.id)
                {
                    // Desktop disconnected — notify phone to stop
                    if (mapping.phoneSocketId)
                    {
                        io.to(mapping.phoneSocketId).emit('interview-ended', {
                            interviewId: mapping.interviewId,
                            reason: 'main-disconnected'
                        });
                    }
                    // Don't delete mapping immediately — desktop might reconnect and re-register
                    // Mappings are cleaned up on 'end-interview'
                    // secondaryCameraMappings.delete(code);
                }
            }
        });

        // ========================================
        // Axiom AI Chat Handlers
        // ========================================

        // Handle AI chat messages
        socket.on('ai-message', async (data) =>
        {
            try
            {
                const {chatId, content, userId='anonymous'}=data;

                if (!chatId||!content)
                {
                    socket.emit('ai-error', {error: 'Missing chatId or content'});
                    return;
                }

                console.log(`📨 AI message from ${userId} in chat ${chatId}`);

                // Add user message
                const userMessage=addMessage(chatId, {
                    role: 'user',
                    content,
                    userId
                });

                // Generate embedding for user message
                const userVector=await geminiAI.generateEmbedding(content);

                // Store in Pinecone
                await pineconeService.createMemory(
                    userVector,
                    {
                        chatId,
                        userId,
                        role: 'user',
                        text: content
                    },
                    userMessage.id
                );

                // Query long-term memory (similar past conversations)
                const memories=await pineconeService.queryMemory(
                    userVector,
                    3,
                    {chatId}
                );

                // Get recent chat history (short-term memory)
                const chatHistory=getChatMessages(chatId).slice(-10);

                // Format context for AI
                const memoryContext=memories.length>0
                    ? `\n\nRelevant past context:\n${memories.map(m => m.metadata?.text||'').join('\n')}`
                    :'';

                const conversationHistory=chatHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

                // Add memory context as system message
                if (memoryContext)
                {
                    conversationHistory.unshift({
                        role: 'user',
                        content: `Here's some relevant context from previous conversations:${memoryContext}\n\nNow, let's continue our current conversation.`
                    });
                }

                // Generate AI response
                const aiResponse=await geminiAI.generateResponse(
                    conversationHistory,
                    "You are Spec AI, a helpful and knowledgeable AI assistant built into the RecruitAI recruitment platform. Be conversational, friendly, and provide clear, accurate information."
                );

                // Add AI message
                const aiMessage=addMessage(chatId, {
                    role: 'model',
                    content: aiResponse,
                    userId: 'aurora'
                });

                // Generate embedding for AI response
                const aiVector=await geminiAI.generateEmbedding(aiResponse);

                // Store AI response in Pinecone
                await pineconeService.createMemory(
                    aiVector,
                    {
                        chatId,
                        userId,
                        role: 'model',
                        text: aiResponse
                    },
                    aiMessage.id
                );

                // Send response back to client
                socket.emit('ai-response', {
                    content: aiResponse,
                    chatId,
                    messageId: aiMessage.id,
                    timestamp: aiMessage.timestamp
                });

                console.log(`✅ AI response sent for chat ${chatId}`);
            } catch (error)
            {
                console.error('AI message error:', error);
                socket.emit('ai-error', {
                    error: 'Failed to process message',
                    details: error.message
                });
            }
        });
    });

    // Quiz real-time events
    setupQuizSocketHandlers(io);
}
