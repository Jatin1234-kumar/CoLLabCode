import { useState } from 'react';
import { USER_ROLES } from '../utils/constants.js';
import '../styles/components.css';

export default function JoinRoomModal({ roomName, onJoinRequest, onCancel }) {
  const [selectedRole, setSelectedRole] = useState(USER_ROLES.VIEWER);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onJoinRequest(selectedRole);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Request to Join Room</h2>
        <p className="modal-description">
          You are not a participant of "<strong>{roomName}</strong>". 
          <br />Please select a role and request access from the room owner.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="role">Requested Role:</label>
            <select
              id="role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="form-input"
            >
              <option value={USER_ROLES.VIEWER}>Viewer (Read-only)</option>
              <option value={USER_ROLES.EDITOR}>Editor (Can edit code)</option>
            </select>
            <small className="form-hint">
              {selectedRole === USER_ROLES.VIEWER 
                ? "You'll be able to view code but not make changes"
                : "You'll be able to view and edit code"}
            </small>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onCancel}
              className="cancel-btn"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={loading}
            >
              {loading ? 'Requesting...' : 'Send Join Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
