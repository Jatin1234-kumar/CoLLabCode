import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import '../styles/home.css';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleGetStarted = () => {
    navigate(user ? '/dashboard' : '/login');
  };

  return (
    <div className="home-page">
      <nav className="home-nav">
        <div className="nav-logo">
          <span className="logo-icon">💻</span>
          <span className="logo-text">CodeCollab</span>
        </div>
        <div className="nav-links">
          {user ? (
            <>
              <span className="nav-user">👋 {user.displayName || user.username}</span>
              <button className="nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
            </>
          ) : (
            <>
              <button className="nav-btn-outline" onClick={() => navigate('/features')}>Features</button>
              <button className="nav-btn-outline" onClick={() => navigate('/login')}>Login</button>
              <button className="nav-btn" onClick={() => navigate('/register')}>Sign Up</button>
            </>
          )}
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-background" />
        <div className="hero-content">
          <div className="hero-badge">
            <svg className="badge-dot" viewBox="0 0 8 8" fill="none">
              <circle cx="4" cy="4" r="3" fill="#667eea" opacity="0.9"/>
              <circle cx="4" cy="4" r="3" fill="#667eea" className="badge-ping"/>
            </svg>
            <span>The Future of Collaborative Coding</span>
          </div>
          <h1 className="hero-title">
            Build Better
            <br />
            <span className="gradient-text">Together.</span>
          </h1>
          <p className="hero-description">
            A next-generation collaborative code editor built for teams.
            Code, execute, and collaborate in real-time with powerful features
            and seamless synchronization.
          </p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={handleGetStarted}>
              <span>Get Started</span>
              <span className="btn-icon">→</span>
            </button>
            <button className="btn-secondary" onClick={() => navigate('/features')}>
              <span>Explore Features</span>
            </button>
          </div>
          <div className="hero-stats">
            <div className="stat"><div className="stat-value">10+</div><div className="stat-label">Languages</div></div>
            <div className="stat"><div className="stat-value">∞</div><div className="stat-label">Collaborators</div></div>
            <div className="stat"><div className="stat-value">Real-time</div><div className="stat-label">Sync</div></div>
          </div>
        </div>
      </section>
    </div>
  );
}
