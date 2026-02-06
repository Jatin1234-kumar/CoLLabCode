import { useState } from 'react';
import { getRoomByCode, requestJoinRoom } from '../services/api.js';
import '../styles/modal.css';

export default function JoinByCodeModal({ onClose, onJoinSuccess }) {
  const [roomCode, setRoomCode] = useState('');
  const [selectedRole, setSelectedRole] = useState('viewer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [roomFound, setRoomFound] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!roomCode || roomCode.length !== 6) {
      setError('Please enter a valid 6-digit room code');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await getRoomByCode(roomCode);
      setRoomFound(response.data.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Room not found with this code');
      } else {
        setError(err.response?.data?.message || 'Failed to find room');
      }
      setRoomFound(null);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRequest = async () => {
    if (!roomFound) return;

    setLoading(true);
    setError('');

    try {
      await requestJoinRoom(roomFound._id, selectedRole);
      onJoinSuccess(roomFound);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send join request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Join Room by Code</h2>
        
        <form onSubmit={handleSearch}>
          <div className="form-group">
            <label htmlFor="roomCode">Room Code</label>
            <input
              id="roomCode"
              type="text"
              maxLength="6"
              placeholder="Enter 6-digit code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          {!roomFound && (
            <div className="modal-actions">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Searching...' : 'Search Room'}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          )}
        </form>

        {roomFound && (
          <div className="room-details">
            <div className="room-info">
              <h3>{roomFound.name}</h3>
              <p><strong>Owner:</strong> {roomFound.owner?.displayName || roomFound.owner?.username}</p>
              <p><strong>Language:</strong> {roomFound.language}</p>
              <p><strong>Participants:</strong> {roomFound.participants?.length || 0}</p>
            </div>

            <div className="form-group">
              <label htmlFor="role">Request Role</label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="viewer">Viewer (Read Only)</option>
                <option value="editor">Editor (Can Edit)</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn-primary" onClick={handleJoinRequest} disabled={loading}>
                {loading ? 'Sending...' : 'Send Join Request'}
              </button>
              <button className="btn-secondary" onClick={() => setRoomFound(null)}>
                Search Again
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
