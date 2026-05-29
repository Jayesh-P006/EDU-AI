import {useState, useEffect, useRef} from 'react';
import socketService from '../services/socket';
import {MessageCircle as ChatIcon} from 'lucide-react';
import './ChatPanel.css';

function ChatPanel({interviewId, userName})
{
    const [messages, setMessages]=useState([]);
    const [inputMessage, setInputMessage]=useState('');
    const messagesEndRef=useRef(null);
    const processedIdsRef=useRef(new Set());

    useEffect(() =>
    {
        const socket=socketService.socket;
        if (!socket) return;

        const handleChatMessage=(data) =>
        {
            // Don't add our own messages (we already added them locally)
            if (data.from===socket.id) return;
            // Deduplicate by messageId if available
            const msgKey=data.messageId||`${data.from}-${data.timestamp}`;
            if (processedIdsRef.current.has(msgKey)) return;
            processedIdsRef.current.add(msgKey);

            setMessages(prev => [...prev, data]);
        };

        socket.on('chat-message', handleChatMessage);

        return () =>
        {
            // Remove only our specific listener, not ALL chat-message listeners
            socket.off('chat-message', handleChatMessage);
        };
    }, []);

    useEffect(() =>
    {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom=() =>
    {
        messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
    };

    const handleSendMessage=() =>
    {
        const trimmed=inputMessage.trim();
        if (!trimmed) return;
        // Enforce message length limit (5000 chars)
        if (trimmed.length>5000) return;

        const message={
            message: trimmed,
            userName,
            timestamp: new Date(),
            from: 'me',
        };

        setMessages(prev => [...prev, message]);
        socketService.sendChatMessage(interviewId, trimmed, userName);
        setInputMessage('');
    };

    // Use onKeyDown instead of deprecated onKeyPress
    const handleKeyDown=(e) =>
    {
        if (e.key==='Enter'&&!e.shiftKey)
        {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="chat-panel">
            <div className="chat-header">
                <h3><ChatIcon size={18} /> Chat</h3>
            </div>

            <div className="chat-messages">
                {messages.length===0? (
                    <div className="no-messages">
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                ):(
                    messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`chat-message ${msg.from==='me'? 'own':'other'}`}
                        >
                            <div className="message-header">
                                <span className="message-user">{msg.userName}</span>
                                <span className="message-time">
                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <div className="message-body">
                                {msg.message}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input">
                <input
                    type="text"
                    className="input"
                    placeholder="Type a message..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button
                    className="btn btn-primary send-btn"
                    onClick={handleSendMessage}
                >
                    Send
                </button>
            </div>
        </div>
    );
}

export default ChatPanel;
