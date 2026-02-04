import { approveJoinRequest, rejectJoinRequest } from '../services/api.js';
import { USER_ROLES } from '../utils/constants.js';
import '../styles/components.css';

export default function JoinRequestsPanel({ joinRequests, roomId, onRequestHandled, onClose }) {
  const pendingRequests = joinRequests?.filter((r) => r.status === 'pending') || [];

  const handleApprove = async (requestId, overrideRole = null) => {
    try {
      // Pass the override role if specified, otherwise use requested role
      await approveJoinRequest(roomId, requestId, overrideRole);
      if (onRequestHandled) onRequestHandled();
    } catch (err) {
      console.error('Failed to approve request:', err);
      alert('Failed to approve request');
    }
  };

  const handleReject = async (requestId) => {
    try {
      await rejectJoinRequest(roomId, requestId);
      if (onRequestHandled) onRequestHandled();
    } catch (err) {
      console.error('Failed to reject request:', err);
      alert('Failed to reject request');
    }
  };

  if (pendingRequests.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="join-requests-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>📨 Join Requests</h3>
            <button onClick={onClose} className="close-modal-btn">✕</button>
          </div>
          <div className="no-requests">
            <p>No pending join requests</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="join-requests-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📨 Join Requests ({pendingRequests.length})</h3>
          <button onClick={onClose} className="close-modal-btn">✕</button>
        </div>
        
        <div className="requests-list">
          {pendingRequests.map((request) => (
            <div key={request._id} className="request-card">
              <div className="request-user-info">
                <div className="user-avatar">
                  {(request.userId?.displayName || request.userId?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <div className="user-name">
                    {request.userId?.displayName || request.userId?.username || 'Unknown User'}
                  </div>
                  <div className="user-email">
                    {request.userId?.email || ''}
                  </div>
                  <div className="requested-role-badge">
                    Requested: <strong>{request.requestedRole}</strong>
                  </div>
                </div>
              </div>
              
              <div className="request-actions-grid">
                <button 
                  onClick={() => handleApprove(request._id)}
                  className="action-btn accept-btn"
                  title="Accept with requested role"
                >
                  ✓ Accept
                </button>
                <button 
                  onClick={() => handleApprove(request._id, USER_ROLES.VIEWER)}
                  className="action-btn viewer-btn"
                  title="Accept as Viewer (read-only)"
                >
                  👁️ As Viewer
                </button>
                <button 
                  onClick={() => handleApprove(request._id, USER_ROLES.EDITOR)}
                  className="action-btn editor-btn"
                  title="Accept as Editor (can edit)"
                >
                  ✏️ As Editor
                </button>
                <button 
                  onClick={() => handleReject(request._id)}
                  className="action-btn reject-btn"
                  title="Reject request"
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
