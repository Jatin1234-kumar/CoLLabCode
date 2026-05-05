import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import '../styles/home.css';
import '../styles/features.css';

const features = [
  {
    title: 'Real-Time Collaboration',
    description: 'Code together with your team in real-time. See changes instantly as they happen.',
    color: '#3b82f6',
    svg: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  },
  {
    title: 'Role-Based Access',
    description: 'Owner, Editor, and Viewer roles with live permission changes.',
    color: '#a855f7',
    svg: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>),
  },
  {
    title: 'Version History',
    description: 'Save, restore, and manage code versions without losing progress.',
    color: '#22c55e',
    svg: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></svg>),
  },
  {
    title: 'Live Code Execution',
    description: 'Run code in 10+ languages instantly. Test and debug without leaving the editor.',
    color: '#f97316',
    svg: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>),
  },
  {
    title: 'AI Code Review',
    description: 'Ask the AI to review code and get actionable suggestions.',
    color: '#6366f1',
    svg: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/><circle cx="18" cy="5" r="3" fill="currentColor" stroke="none" opacity="0.7"/></svg>),
  },
  {
    title: 'Invite by Code',
    description: 'Share a secure 6-digit code to invite teammates instantly.',
    color: '#ec4899',
    svg: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>),
  },
];

const moreFeatures = ['Room search by name', 'Ownership transfer', 'Live notifications', 'Secure JWT auth', 'Participant role changes', 'Join request approvals'];

const comparisons = [
  {
    title: 'Typical Web Code Editors', tag: 'Baseline',
    items: [
      { label: 'Real-time sync', value: 'Limited' }, { label: 'Role management', value: 'Basic' },
      { label: 'Invite by code', value: 'No' }, { label: 'AI review', value: 'No' },
      { label: 'Ownership transfer', value: 'No' }, { label: 'Room notifications', value: 'Limited' },
      { label: 'Built-in execution', value: 'Varies' },
    ],
  },
  {
    title: 'CodeCollab', tag: 'Your Product', highlight: true,
    items: [
      { label: 'Real-time sync', value: 'Yes' }, { label: 'Role management', value: 'Owner/Editor/Viewer' },
      { label: 'Invite by code', value: 'Yes' }, { label: 'AI review', value: 'Yes' },
      { label: 'Ownership transfer', value: 'Yes' }, { label: 'Room notifications', value: 'Yes' },
      { label: 'Built-in execution', value: 'Yes (10+ langs)' },
    ],
  },
];

export default function FeaturesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleGetStarted = () => navigate(user ? '/dashboard' : '/login');

  return (
    <div className="home-page features-page">
      <nav className="home-nav">
        <div className="nav-logo" onClick={() => navigate('/')}>
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
              <button className="nav-btn-outline" onClick={() => navigate('/')}>← Home</button>
              <button className="nav-btn-outline" onClick={() => navigate('/login')}>Login</button>
              <button className="nav-btn" onClick={() => navigate('/register')}>Sign Up</button>
            </>
          )}
        </div>
      </nav>

      <div className="features-page-body">
        {/* Features */}
        <section className="features-section">
          <div className="section-header">
            <h2 className="section-title">Powerful Features</h2>
            <p className="section-subtitle">Everything you need to collaborate effectively</p>
          </div>
          <div className="features-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-card-inner">
                  <div className="feature-icon" style={{ color: f.color, borderColor: `${f.color}22`, background: `${f.color}12` }}>
                    {f.svg}
                  </div>
                  <h3 className="feature-title">{f.title}</h3>
                  <p className="feature-description">{f.description}</p>
                </div>
                <div className="feature-glow" style={{ background: `radial-gradient(circle, ${f.color}22, transparent)` }} />
              </div>
            ))}
          </div>
          <div className="more-features">
            <div className="more-title">More built-in capabilities</div>
            <div className="more-list">
              {moreFeatures.map((item, i) => <span key={i} className="more-pill">{item}</span>)}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="comparison-section">
          <div className="section-header">
            <h2 className="section-title">How We Compare</h2>
            <p className="section-subtitle">Built for teams that need more than a basic web editor</p>
          </div>
          <div className="comparison-grid">
            {comparisons.map((card, i) => (
              <div key={i} className={`comparison-card${card.highlight ? ' highlight' : ''}`}>
                <div className="comparison-header">
                  <h3 className="comparison-title">{card.title}</h3>
                  <span className="comparison-tag">{card.tag}</span>
                </div>
                <div className="comparison-list">
                  {card.items.map((item, j) => (
                    <div key={j} className="comparison-item">
                      <span className="comparison-label">{item.label}</span>
                      <span className="comparison-value">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="cta-section">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Start Coding?</h2>
            <p className="cta-description">Join developers around the world building amazing projects together</p>
            <button className="btn-cta" onClick={handleGetStarted}>
              <span>Get Started Now</span>
            </button>
          </div>
          <div className="cta-background">
            <div className="cta-circle" />
            <div className="cta-circle" />
          </div>
        </section>

        <footer className="home-footer">
          <p>Code Together, Build Better</p>
        </footer>
      </div>
    </div>
  );
}
