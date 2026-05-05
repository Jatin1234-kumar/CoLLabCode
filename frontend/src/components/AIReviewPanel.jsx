import { useEffect, useRef, useState } from 'react';
import { requestAiReview } from '../services/api.js';

export default function AIReviewPanel({ roomId, code, canUse, compact }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Ask me to review your code or ask anything about it.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async (overrideMessage = null) => {
    if (!canUse || loading) return;

    const message = (overrideMessage ?? input).trim();
    if (!message) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setLoading(true);

    try {
      const response = await requestAiReview(roomId, message, code);
      const reply = response.data?.data?.reply || 'No response from AI.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'AI request failed.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${errorMessage}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  if (!canUse) {
    return <div className={compact ? 'ai-locked' : 'ai-panel-locked'}>Editor or owner access required.</div>;
  }

  if (compact) {
    return (
      <div>
        <button
          className="ai-review-btn"
          onClick={() => sendMessage('Review my code and suggest improvements.')}
          disabled={loading}
        >
          {loading ? '⏳ Reviewing...' : '🔍 Request full Review'}
        </button>
        <div className="ai-messages-new">
          {messages.map((msg, i) => (
            <div key={i} className={`ai-msg ${msg.role}`}>
              <div className="ai-msg-role">{msg.role === 'assistant' ? 'AI' : 'You'}</div>
              {msg.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="ai-input-row">
          <textarea
            placeholder="Ask about your code..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <button className="ai-send-btn" onClick={() => sendMessage()} disabled={loading}>
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <span>AI Code Review</span>
        <button className="ai-quick-review" onClick={() => sendMessage('Review my code and suggest improvements.')} disabled={loading}>
          {loading ? 'Reviewing...' : 'Quick Review'}
        </button>
      </div>
      <div className="ai-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`ai-message ${msg.role}`}>
            <div className="ai-message-role">{msg.role === 'assistant' ? 'AI' : 'You'}</div>
            <div className="ai-message-content">{msg.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="ai-input">
        <textarea placeholder="Ask for a review..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} rows={3} />
        <button onClick={() => sendMessage()} disabled={loading}>{loading ? 'Sending...' : 'Send'}</button>
      </div>
    </div>
  );
}
