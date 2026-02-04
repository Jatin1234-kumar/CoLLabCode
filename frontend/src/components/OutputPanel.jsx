import { useState } from 'react';
import '../styles/components.css';

export default function OutputPanel({ isLoading, output, error, onClose }) {
  const [activeTab, setActiveTab] = useState('output');

  return (
    <div className="output-panel">
      <div className="output-header">
        <div className="output-tabs">
          <button
            className={`output-tab ${activeTab === 'output' ? 'active' : ''}`}
            onClick={() => setActiveTab('output')}
          >
            📤 Output
          </button>
          <button
            className={`output-tab ${activeTab === 'error' ? 'active' : ''}`}
            onClick={() => setActiveTab('error')}
          >
            ⚠️ Error
          </button>
        </div>
        <button onClick={onClose} className="close-btn">
          ✕
        </button>
      </div>

      <div className="output-content">
        {isLoading && <div className="loading-spinner">Executing code...</div>}

        {!isLoading && activeTab === 'output' && (
          <pre className="output-text">
            {output || '(No output)'}
          </pre>
        )}

        {!isLoading && activeTab === 'error' && (
          <pre className={`output-text ${error ? 'error' : ''}`}>
            {error || '(No errors)'}
          </pre>
        )}
      </div>
    </div>
  );
}
