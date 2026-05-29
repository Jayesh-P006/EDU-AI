import {useState, useEffect, useRef} from 'react';
import api from '../services/api';
import './AxiomChat.css';

function AxiomChat()
{
  const [messages, setMessages]=useState([]);
  const [input, setInput]=useState('');
  const [loading, setLoading]=useState(false);
  const messagesEndRef=useRef(null);

  const scrollToBottom=() =>
  {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
  };

  useEffect(() =>
  {
    scrollToBottom();
  }, [messages]);

  const handleSubmit=async (e) =>
  {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage={role: 'user', content: input};
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try
    {
      const response=await api.post('/spec-ai/chat', {
        message: input,
        conversationHistory: messages
      });

      const assistantMessage={
        role: 'assistant',
        content: response.data.response
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error)
    {
      console.error('Error sending message:', error);
      const errorMessage={
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally
    {
      setLoading(false);
    }
  };

  const clearChat=() =>
  {
    setMessages([]);
  };

  return (
    <div className="axiom-chat-container">
      <div className="axiom-chat-header">
        <h1>Spec AI Assistant</h1>
        <p>Your personalized AI assistant for career guidance & interview preparation</p>
        {messages.length>0&&(
          <button onClick={clearChat} className="clear-button">
            Clear Chat
          </button>
        )}
      </div>

      <div className="axiom-chat-messages">
        {messages.length===0? (
          <div className="welcome-message">
            <h2>👋 Welcome to Spec AI!</h2>
            <p>I'm your personalized AI assistant for career guidance and interview preparation.</p>
            <div className="suggestions">
              <h3>Try asking me:</h3>
              <ul>
                <li>Explain binary search algorithm</li>
                <li>How to prepare for system design interviews?</li>
                <li>Best practices for React development</li>
                <li>Common data structures and their use cases</li>
              </ul>
            </div>
          </div>
        ):(
          messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-content">
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading&&(
          <div className="message assistant">
            <div className="message-content typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="axiom-chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button type="submit" disabled={loading||!input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default AxiomChat;
