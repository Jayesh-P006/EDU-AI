import {useState, useEffect} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import
{
    BarChart3, Monitor, MessageSquare, Brain, Star,
    CheckCircle, XCircle, BookOpen, FileText, Search,
    Home, RefreshCw, TrendingUp
} from 'lucide-react';
import './PracticeFeedback.css';

const API_URL=import.meta.env.VITE_API_URL||'http://localhost:5000';

function PracticeFeedback()
{
    const {sessionId}=useParams();
    const navigate=useNavigate();
    const [feedback, setFeedback]=useState(null);
    const [loading, setLoading]=useState(true);

    useEffect(() =>
    {
        loadFeedback();
    }, []);

    const loadFeedback=async () =>
    {
        try
        {
            const response=await fetch(`${API_URL}/api/practice/finish`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({sessionId}),
            });
            const data=await response.json();
            const payload=data.data||data;
            const fb=payload.feedback||payload.finalReport||payload;
            // Normalize score fields: backend sends scores.technical (0-10) → convert to percentage
            if (fb&&fb.scores&&!fb.technicalScore)
            {
                fb.technicalScore=Math.round((fb.scores.technical||0)*10);
                fb.communicationScore=Math.round((fb.scores.communication||0)*10);
                fb.problemSolvingScore=Math.round((fb.scores.problemSolving||0)*10);
                fb.confidenceScore=Math.round((fb.scores.confidence||0)*10);
                fb.overallScore=Math.round(fb.overallScore||0);
                fb.detailedFeedback=fb.summary||fb.detailedFeedback||'';
                fb.questionsReview=fb.questionsReview||[];
            }
            setFeedback(fb);
        } catch (error)
        {
            console.error('Error loading feedback:', error);
        } finally
        {
            setLoading(false);
        }
    };

    const getScoreColor=(score) =>
    {
        if (score>=80) return 'excellent';
        if (score>=60) return 'good';
        if (score>=40) return 'average';
        return 'needs-improvement';
    };

    const getScoreLabel=(score) =>
    {
        if (score>=80) return 'Excellent';
        if (score>=60) return 'Good';
        if (score>=40) return 'Average';
        return 'Needs Improvement';
    };

    if (loading)
    {
        return (
            <div className="practice-feedback loading-screen">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Generating your feedback report...</p>
                </div>
            </div>
        );
    }

    if (!feedback)
    {
        return (
            <div className="practice-feedback error-screen">
                <h2><XCircle size={22} /> Error Loading Feedback</h2>
                <p>Unable to load your feedback report.</p>
                <button onClick={() => navigate('/')}>Go Home</button>
            </div>
        );
    }

    return (
        <div className="practice-feedback">
            {/* Header */}
            <div className="feedback-header">
                <h1><BarChart3 size={24} /> Performance Report</h1>
                <p>Session ID: {sessionId}</p>
            </div>

            {/* Overall Score */}
            <div className="overall-score-card">
                <h2>Overall Performance</h2>
                <div className="score-display">
                    <div className={`score-circle-large ${getScoreColor(feedback.overallScore)}`}>
                        <span className="score-number">{feedback.overallScore}</span>
                        <span className="score-total">/100</span>
                    </div>
                    <div className="score-label">
                        <span className={`label ${getScoreColor(feedback.overallScore)}`}>
                            {getScoreLabel(feedback.overallScore)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Score Breakdown */}
            <div className="score-breakdown">
                <h2><TrendingUp size={20} /> Score Breakdown</h2>
                <div className="score-grid">
                    <div className="score-item">
                        <div className="score-item-header">
                            <span className="score-icon"><Monitor size={18} /></span>
                            <span className="score-title">Technical Knowledge</span>
                        </div>
                        <div className="score-bar">
                            <div
                                className={`score-fill ${getScoreColor(feedback.technicalScore)}`}
                                style={{width: `${feedback.technicalScore}%`}}
                            >
                                {feedback.technicalScore}%
                            </div>
                        </div>
                    </div>

                    <div className="score-item">
                        <div className="score-item-header">
                            <span className="score-icon"><MessageSquare size={18} /></span>
                            <span className="score-title">Communication</span>
                        </div>
                        <div className="score-bar">
                            <div
                                className={`score-fill ${getScoreColor(feedback.communicationScore)}`}
                                style={{width: `${feedback.communicationScore}%`}}
                            >
                                {feedback.communicationScore}%
                            </div>
                        </div>
                    </div>

                    <div className="score-item">
                        <div className="score-item-header">
                            <span className="score-icon"><Brain size={18} /></span>
                            <span className="score-title">Problem Solving</span>
                        </div>
                        <div className="score-bar">
                            <div
                                className={`score-fill ${getScoreColor(feedback.problemSolvingScore)}`}
                                style={{width: `${feedback.problemSolvingScore}%`}}
                            >
                                {feedback.problemSolvingScore}%
                            </div>
                        </div>
                    </div>

                    <div className="score-item">
                        <div className="score-item-header">
                            <span className="score-icon"><Star size={18} /></span>
                            <span className="score-title">Confidence</span>
                        </div>
                        <div className="score-bar">
                            <div
                                className={`score-fill ${getScoreColor(feedback.confidenceScore)}`}
                                style={{width: `${feedback.confidenceScore}%`}}
                            >
                                {feedback.confidenceScore}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Strengths and Weaknesses */}
            <div className="feedback-sections">
                <div className="feedback-section strengths">
                    <h3><CheckCircle size={18} /> Key Strengths</h3>
                    <ul>
                        {feedback.strengths.map((strength, i) => (
                            <li key={i}>{strength}</li>
                        ))}
                    </ul>
                </div>

                <div className="feedback-section weaknesses">
                    <h3><TrendingUp size={18} /> Areas for Improvement</h3>
                    <ul>
                        {feedback.weaknesses.map((weakness, i) => (
                            <li key={i}>{weakness}</li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Suggested Topics */}
            {feedback.suggestedTopics&&feedback.suggestedTopics.length>0&&(
                <div className="suggested-topics">
                    <h3><BookOpen size={18} /> Recommended Study Topics</h3>
                    <div className="topics-grid">
                        {feedback.suggestedTopics.map((topic, i) => (
                            <div key={i} className="topic-tag">{topic}</div>
                        ))}
                    </div>
                </div>
            )}

            {/* Detailed Feedback */}
            <div className="detailed-feedback">
                <h3><FileText size={18} /> Detailed Feedback</h3>
                <p>{feedback.detailedFeedback}</p>
            </div>

            {/* Questions Review */}
            {feedback.questionsReview&&feedback.questionsReview.length>0&&(
                <div className="questions-review">
                    <h3><Search size={18} /> Question-by-Question Review</h3>
                    {feedback.questionsReview.map((review, i) => (
                        <div key={i} className="question-review-card">
                            <div className="question-review-header">
                                <h4>Question {i+1}</h4>
                                <div className="question-score">
                                    <span className="score-badge">{review.score}/10</span>
                                </div>
                            </div>
                            <div className="question-text">
                                <strong>Q:</strong> {review.question}
                            </div>
                            <div className="answer-text">
                                <strong>Your Answer:</strong> {review.answer}
                            </div>
                            <div className="review-feedback">
                                <strong>Feedback:</strong> {review.feedback}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Actions */}
            <div className="feedback-actions">
                <button
                    className="btn-secondary"
                    onClick={() => navigate('/')}
                >
                    <Home size={16} /> Go Home
                </button>
                <button
                    className="btn-primary"
                    onClick={() => navigate('/practice-setup')}
                >
                    <RefreshCw size={16} /> Practice Again
                </button>
            </div>
        </div>
    );
}

export default PracticeFeedback;
