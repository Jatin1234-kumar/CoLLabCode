import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import '../styles/home.css';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleGetStarted = () => {
    if (user) {
      // User is logged in, go to dashboard
      navigate('/dashboard');
    } else {
      // User not logged in, go to login page
      navigate('/login');
    }
  };

  const features = [
    {
      icon: '🚀',
      title: 'Real-Time Collaboration',
      description: 'Code together with your team in real-time. See changes instantly as they happen.',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: '🎯',
      title: 'Smart Role Management',
      description: 'Control access with Owner, Editor, and Viewer roles. Assign permissions on the fly.',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: '💾',
      title: 'Version Control',
      description: 'Save, restore, and manage code versions effortlessly. Never lose your progress.',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      icon: '⚡',
      title: 'Live Code Execution',
      description: 'Run code in 10+ languages instantly. Test and debug without leaving the editor.',
      gradient: 'from-orange-500 to-red-500'
    },
    {
      icon: '🔒',
      title: 'Secure & Private',
      description: 'Your code is protected with JWT authentication and secure room access controls.',
      gradient: 'from-indigo-500 to-purple-500'
    },
    {
      icon: '🎨',
      title: 'Beautiful Editor',
      description: 'Powered by CodeMirror 6 with syntax highlighting and dark theme support.',
      gradient: 'from-pink-500 to-rose-500'
    }
  ];

  return (
    <div className="home-page">
      {/* Navigation Header */}
      <nav className="home-nav">
        <div className="nav-logo">
          <span className="logo-icon">💻</span>
          <span className="logo-text">CodeCollab</span>
        </div>
        <div className="nav-links">
          {user ? (
            <>
              <span className="nav-user">👋 {user.displayName || user.username}</span>
              <button className="nav-btn" onClick={() => navigate('/dashboard')}>
                Dashboard
              </button>
            </>
          ) : (
            <>
              <button className="nav-btn-outline" onClick={() => navigate('/login')}>
                Login
              </button>
              <button className="nav-btn" onClick={() => navigate('/register')}>
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-icon">✨</span>
            <span>The Future of Collaborative Coding</span>
          </div>
          
          <h1 className="hero-title">
            Code Together,
            <br />
            <span className="gradient-text">Build Better</span>
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
            <button className="btn-secondary" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
              <span>Explore Features</span>
            </button>
          </div>

          <div className="hero-stats">
            <div className="stat">
              <div className="stat-value">10+</div>
              <div className="stat-label">Languages</div>
            </div>
            <div className="stat">
              <div className="stat-value">∞</div>
              <div className="stat-label">Collaborators</div>
            </div>
            <div className="stat">
              <div className="stat-value">Real-time</div>
              <div className="stat-label">Sync</div>
            </div>
          </div>
        </div>

        {/* Animated Background Elements */}
        <div className="hero-background">
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
          <div className="floating-shape shape-3"></div>
          <div className="code-lines">
            <div className="code-line"></div>
            <div className="code-line"></div>
            <div className="code-line"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2 className="section-title">Powerful Features</h2>
          <p className="section-subtitle">
            Everything you need to collaborate effectively
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card" data-index={index}>
              <div className="feature-card-inner">
                <div className={`feature-icon gradient-${feature.gradient}`}>
                  <span>{feature.icon}</span>
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
              <div className="feature-glow"></div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2 className="cta-title">Ready to Start Coding?</h2>
          <p className="cta-description">
            Join developers around the world building amazing projects together
          </p>
          <button className="btn-cta" onClick={handleGetStarted}>
            <span>Get Started Now</span>
            <span className="btn-icon">🚀</span>
          </button>
        </div>
        <div className="cta-background">
          <div className="cta-circle"></div>
          <div className="cta-circle"></div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <p>Built with ❤️ using React, Socket.io, and CodeMirror</p>
      </footer>
    </div>
  );
}
