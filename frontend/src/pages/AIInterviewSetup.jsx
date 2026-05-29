import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';
import './AIInterviewSetup.css';

function AIInterviewSetup()
{
  const navigate=useNavigate();
  const [formData, setFormData]=useState({
    candidateName: '',
    role: '',
    experience: 'entry',
    topics: [],
    duration: 30
  });
  const [loading, setLoading]=useState(false);

  const availableTopics=[
    'JavaScript',
    'React',
    'Node.js',
    'Python',
    'Data Structures',
    'Algorithms',
    'System Design',
    'Databases',
    'APIs',
    'Web Development'
  ];

  const handleChange=(e) =>
  {
    const {name, value}=e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTopicToggle=(topic) =>
  {
    setFormData(prev => ({
      ...prev,
      topics: prev.topics.includes(topic)
        ? prev.topics.filter(t => t!==topic)
        :[...prev.topics, topic]
    }));
  };

  const handleSubmit=async (e) =>
  {
    e.preventDefault();

    if (formData.topics.length===0)
    {
      alert('Please select at least one topic');
      return;
    }

    setLoading(true);
    try
    {
      // Include candidateId from logged-in user
      let candidateId=null;
      try
      {
        const stored=localStorage.getItem('user');
        if (stored)
        {
          const user=JSON.parse(stored);
          candidateId=user._id||user.id||null;
        }
      } catch { /* ignore */}

      const response=await api.post('/ai-interview/create', {
        ...formData,
        candidateId,
      });
      const sessionId=response.data.sessionId;
      navigate(`/ai-interview/${sessionId}`);
    } catch (error)
    {
      console.error('Error creating AI interview:', error);
      alert('Failed to create interview session');
      setLoading(false);
    }
  };

  return (
    <div className="ai-interview-setup-container">
      <div className="ai-interview-setup-card">
        <h1>AI Interview Setup</h1>
        <p className="setup-subtitle">Configure your AI-powered interview session</p>

        <form onSubmit={handleSubmit} className="setup-form">
          <div className="form-group">
            <label htmlFor="candidateName">Your Name</label>
            <input
              type="text"
              id="candidateName"
              name="candidateName"
              value={formData.candidateName}
              onChange={handleChange}
              placeholder="Enter your name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Target Role</label>
            <input
              type="text"
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              placeholder="e.g., Frontend Developer, Backend Engineer"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="experience">Experience Level</label>
            <select
              id="experience"
              name="experience"
              value={formData.experience}
              onChange={handleChange}
              required
            >
              <option value="entry">Entry Level (0-2 years)</option>
              <option value="mid">Mid Level (3-5 years)</option>
              <option value="senior">Senior Level (5+ years)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Select Topics (Choose at least one)</label>
            <div className="topics-grid">
              {availableTopics.map(topic => (
                <button
                  key={topic}
                  type="button"
                  className={`topic-button ${formData.topics.includes(topic)? 'selected':''}`}
                  onClick={() => handleTopicToggle(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="duration">Interview Duration</label>
            <select
              id="duration"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              required
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>

          <button type="submit" className="start-button" disabled={loading}>
            {loading? 'Starting Interview...':'Start AI Interview'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AIInterviewSetup;
