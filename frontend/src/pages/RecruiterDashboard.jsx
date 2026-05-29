import {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import api, {createInterview} from '../services/api';
import './RecruiterDashboard.css';

function RecruiterDashboard()
{
  const navigate=useNavigate();
  const [interviews, setInterviews]=useState([]);
  const [candidates, setCandidates]=useState([]);
  const [loading, setLoading]=useState(true);
  const [activeTab, setActiveTab]=useState('interviews');
  const [creatingInterview, setCreatingInterview]=useState(false);

  const handleCreateInterview=async () =>
  {
    if (creatingInterview) return;
    setCreatingInterview(true);
    try
    {
      const sessionId=`interview-${Date.now()}`;
      await createInterview({
        candidateName: 'Pending Candidate',
        role: 'Software Engineer',
        experience: 'entry',
        topics: [],
        duration: 30,
        notes: 'Created by recruiter',
        sessionId,
      });
      navigate(`/interview/${sessionId}?mode=recruiter&name=Recruiter&role=recruiter`);
    } catch (error)
    {
      console.error('Failed to create interview:', error);
      alert('Failed to create interview session. Please try again.');
    } finally
    {
      setCreatingInterview(false);
    }
  };

  useEffect(() =>
  {
    fetchData();
  }, []);

  const fetchData=async () =>
  {
    try
    {
      // TODO: Implement actual API calls
      // Mock data for now
      setInterviews([
        {id: 1, candidate: 'John Doe', role: 'Frontend Developer', status: 'completed', score: 85, date: '2024-01-15'},
        {id: 2, candidate: 'Jane Smith', role: 'Backend Engineer', status: 'in-progress', score: null, date: '2024-01-16'},
        {id: 3, candidate: 'Bob Johnson', role: 'Full Stack Developer', status: 'scheduled', score: null, date: '2024-01-17'},
      ]);

      setCandidates([
        {id: 1, name: 'John Doe', email: 'john@example.com', role: 'Frontend Developer', appliedDate: '2024-01-10'},
        {id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'Backend Engineer', appliedDate: '2024-01-12'},
        {id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'Full Stack Developer', appliedDate: '2024-01-14'},
      ]);
    } catch (error)
    {
      console.error('Error fetching data:', error);
    } finally
    {
      setLoading(false);
    }
  };

  const getStatusClass=(status) =>
  {
    switch (status)
    {
      case 'completed': return 'status-completed';
      case 'in-progress': return 'status-in-progress';
      case 'scheduled': return 'status-scheduled';
      default: return '';
    }
  };

  if (loading)
  {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="recruiter-dashboard">
      <div className="dashboard-header">
        <h1>Recruiter Dashboard</h1>
        <button className="create-interview-button" onClick={handleCreateInterview} disabled={creatingInterview}>
          {creatingInterview? 'Creating...':'Create New Interview'}
        </button>
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab==='interviews'? 'active':''}`}
          onClick={() => setActiveTab('interviews')}
        >
          Interviews
        </button>
        <button
          className={`tab ${activeTab==='candidates'? 'active':''}`}
          onClick={() => setActiveTab('candidates')}
        >
          Candidates
        </button>
        <button
          className={`tab ${activeTab==='analytics'? 'active':''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab==='interviews'&&(
          <div className="interviews-section">
            <h2>Interview Sessions</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Role</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.map(interview => (
                    <tr key={interview.id}>
                      <td>{interview.candidate}</td>
                      <td>{interview.role}</td>
                      <td>{interview.date}</td>
                      <td>
                        <span className={`status ${getStatusClass(interview.status)}`}>
                          {interview.status}
                        </span>
                      </td>
                      <td>{interview.score||'-'}</td>
                      <td>
                        <button className="action-button">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab==='candidates'&&(
          <div className="candidates-section">
            <h2>Candidate Pool</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Applied Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map(candidate => (
                    <tr key={candidate.id}>
                      <td>{candidate.name}</td>
                      <td>{candidate.email}</td>
                      <td>{candidate.role}</td>
                      <td>{candidate.appliedDate}</td>
                      <td>
                        <button className="action-button">Schedule</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab==='analytics'&&(
          <div className="analytics-section">
            <h2>Analytics Overview</h2>
            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>Total Interviews</h3>
                <div className="analytics-value">{interviews.length}</div>
              </div>
              <div className="analytics-card">
                <h3>Completed</h3>
                <div className="analytics-value">
                  {interviews.filter(i => i.status==='completed').length}
                </div>
              </div>
              <div className="analytics-card">
                <h3>In Progress</h3>
                <div className="analytics-value">
                  {interviews.filter(i => i.status==='in-progress').length}
                </div>
              </div>
              <div className="analytics-card">
                <h3>Average Score</h3>
                <div className="analytics-value">
                  {interviews.filter(i => i.score).length>0
                    ? Math.round(
                      interviews
                        .filter(i => i.score)
                        .reduce((acc, i) => acc+i.score, 0)/
                      interviews.filter(i => i.score).length
                    )
                    :'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecruiterDashboard;
