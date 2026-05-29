import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import InterviewRoom from './pages/InterviewRoom'
import PracticeMode from './pages/PracticeMode'
import SecondaryCameraView from './pages/SecondaryCameraView'
import ProctorDashboard from './pages/ProctorDashboard'
import PracticeSessionSetup from './pages/PracticeSessionSetup'
import PracticeInterviewRoom from './pages/PracticeInterviewRoom'
import PracticeFeedback from './pages/PracticeFeedback'
import AxiomChat from './pages/AxiomChat'
import AIInterviewSetup from './pages/AIInterviewSetup'
import AIInterviewRoom from './pages/AIInterviewRoom'
import AIInterviewReport from './pages/AIInterviewReport'
import RecruiterDashboard from './pages/RecruiterDashboard'
import CodingPractice from './pages/CodingPractice'
import CandidateDashboard from './pages/CandidateDashboard'
import CompanyDashboard from './pages/CompanyDashboard'
import AdminScoring from './pages/AdminScoring'
import CandidateResults from './pages/CandidateResults'
import CandidateAnalytics from './pages/CandidateAnalytics'
import CandidateProfile from './pages/CandidateProfile'
import ResumeVerification from './pages/ResumeVerification'
import NotFound from './pages/NotFound'
import './App.css'

// Paths that should NOT show the global navbar (because they have their own)
const NO_NAVBAR_PATHS = [
    '/',
    '/candidate-dashboard',
    '/company-dashboard',
    '/admin-scoring',
    '/candidate-results',
    '/candidate-analytics',
    '/candidate-profile',
    '/resume-verification',
    '/proctor-dashboard',
    '/recruiter-dashboard'
];

function AppLayout() {
    const location = useLocation();
    const hideNavbar = NO_NAVBAR_PATHS.some(p => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p));

    return (
        <div className="App">
            {!hideNavbar && <Navbar />}
            <div className={!hideNavbar ? 'page-content' : ''}>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />

                    {/* Protected: Candidate Only */}
                    <Route path="/candidate-dashboard" element={<ProtectedRoute allowedRoles={['candidate']}><CandidateDashboard /></ProtectedRoute>} />
                    <Route path="/candidate-profile" element={<ProtectedRoute allowedRoles={['candidate']}><CandidateProfile /></ProtectedRoute>} />
                    <Route path="/candidate-results" element={<ProtectedRoute allowedRoles={['candidate']}><CandidateResults /></ProtectedRoute>} />
                    <Route path="/candidate-analytics" element={<ProtectedRoute allowedRoles={['candidate']}><CandidateAnalytics /></ProtectedRoute>} />
                    <Route path="/resume-verification" element={<ProtectedRoute allowedRoles={['candidate']}><ResumeVerification /></ProtectedRoute>} />

                    {/* Protected: Company/Recruiter Only */}
                    <Route path="/company-dashboard" element={<ProtectedRoute allowedRoles={['company_admin', 'company_hr', 'recruiter']}><CompanyDashboard /></ProtectedRoute>} />
                    <Route path="/admin-scoring" element={<ProtectedRoute allowedRoles={['company_admin', 'company_hr', 'recruiter']}><AdminScoring /></ProtectedRoute>} />
                    <Route path="/proctor-dashboard" element={<ProtectedRoute allowedRoles={['company_admin', 'company_hr', 'recruiter']}><ProctorDashboard /></ProtectedRoute>} />
                    <Route path="/recruiter-dashboard" element={<ProtectedRoute allowedRoles={['company_admin', 'company_hr', 'recruiter']}><RecruiterDashboard /></ProtectedRoute>} />

                    {/* Protected: Common or Mixed */}
                    <Route path="/interview/:interviewId" element={<ProtectedRoute><InterviewRoom /></ProtectedRoute>} />
                    <Route path="/secondary-camera" element={<ProtectedRoute><SecondaryCameraView /></ProtectedRoute>} />
                    <Route path="/practice" element={<ProtectedRoute><PracticeMode /></ProtectedRoute>} />
                    <Route path="/practice-setup" element={<ProtectedRoute><PracticeSessionSetup /></ProtectedRoute>} />
                    <Route path="/practice-interview/:sessionId" element={<ProtectedRoute><PracticeInterviewRoom /></ProtectedRoute>} />
                    <Route path="/practice-feedback/:sessionId" element={<ProtectedRoute><PracticeFeedback /></ProtectedRoute>} />
                    <Route path="/axiom-chat" element={<ProtectedRoute><AxiomChat /></ProtectedRoute>} />
                    <Route path="/ai-interview-setup" element={<ProtectedRoute><AIInterviewSetup /></ProtectedRoute>} />
                    <Route path="/ai-interview/:sessionId" element={<ProtectedRoute><AIInterviewRoom /></ProtectedRoute>} />
                    <Route path="/ai-interview-report/:sessionId" element={<ProtectedRoute><AIInterviewReport /></ProtectedRoute>} />
                    <Route path="/coding-practice" element={<ProtectedRoute><CodingPractice /></ProtectedRoute>} />

                    {/* Catch-all */}
                    <Route path="/404" element={<NotFound />} />
                    <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
            </div>
        </div>
    )
}

function App() {
    return (
        <ErrorBoundary>
            <Router>
                <AppLayout />
            </Router>
        </ErrorBoundary>
    )
}

export default App
