import { approveJoinRequest, rejectJoinRequest } from '../services/api.js';
import '../styles/components.css';

export default function JoinRequestsPanel({ joinRequests, roomId }) {
  const pendingRequests = joinRequests?.filter((r) => r.status === 'pending') || [];

  const handleApprove = async (requestId) => {
    try {
      await approveJoinRequest(roomId, requestId);
      // Refresh requests
    } catch (err) {
      console.error('Failed to approve request:', err);
    }
  };

  const handleReject = async (requestId) => {
    try {
      await rejectJoinRequest(roomId, requestId);
      // Refresh requests
    } catch (err) {
      console.error('Failed to reject request:', err);
    }
  };

  if (pendingRequests.length === 0) {
    return <div className="join-requests">No pending join requests</div>;
  }

  return (
    <div className="join-requests">
      <h3>Join Requests ({pendingRequests.length})</h3>
      <ul>
        {pendingRequests.map((request) => (
          <li key={request._id} className="request-item">
            <div className="request-info">
              <span className="request-user">
                {request.userId?.displayName || request.userId?.username}
              </span>
              <span className="request-role">{request.requestedRole}</span>
            </div>
            <div className="request-actions">
              <button onClick={() => handleApprove(request._id)} className="approve-btn">
                ✓
              </button>
              <button onClick={() => handleReject(request._id)} className="reject-btn">
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
