import {Link, useNavigate} from 'react-router-dom';
import {LogOut} from 'lucide-react';
import {useState, useEffect} from 'react';
import './Navbar.css';

function Navbar()
{
  const [user, setUser]=useState(null);
  const navigate=useNavigate();

  useEffect(() =>
  {
    try
    {
      const stored=localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch { /* ignore */}

    const handleStorage=() =>
    {
      try
      {
        const stored=localStorage.getItem('user');
        setUser(stored? JSON.parse(stored):null);
      } catch {setUser(null);}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLogout=() =>
  {
    // Clear all auth-related data
    localStorage.removeItem('user');
    localStorage.removeItem('practiceSession');
    localStorage.removeItem('token');
    // Cancel any speech synthesis
    window.speechSynthesis?.cancel();
    setUser(null);
    // Dispatch storage event so other components in the same tab also update
    window.dispatchEvent(new Event('storage'));
    navigate('/login');
  };

  const getDashboardPath=() =>
  {
    if (!user) return '/';
    return ['company_admin', 'company_hr', 'recruiter'].includes(user.role)
      ? '/company-dashboard':'/candidate-dashboard';
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to={user? getDashboardPath():'/'} className="navbar-logo">
          EDU-AI
        </Link>
        <ul className="navbar-menu">
          {user? (
            <>
              <li className="navbar-item">
                <Link to={getDashboardPath()} className="navbar-link">Dashboard</Link>
              </li>
              <li className="navbar-item">
                <Link to="/quiz/dashboard" className="navbar-link">Quiz</Link>
              </li>
              <li className="navbar-item">
                <button onClick={handleLogout} className="navbar-link navbar-logout-btn">
                  <LogOut size={16} />
                  Logout
                </button>
              </li>
            </>
          ):(
            <>
              <li className="navbar-item">
                <Link to="/login" className="navbar-link">Login</Link>
              </li>
              <li className="navbar-item">
                <Link to="/register" className="navbar-link navbar-register">Register</Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
