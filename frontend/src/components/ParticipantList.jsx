import { useState } from 'react';
import { updateParticipantRole } from '../services/api.js';
import { USER_ROLES } from '../utils/constants.js';
import '../styles/components.css';

export default function ParticipantList({ participants, socket, currentRoom, currentUser, onRoleChange }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [loading, setLoading] = useState(false);

  const isOwner = currentRoom && (typeof currentRoom.owner === 'object' ? currentRoom.owner._id : currentRoom.owner) === currentUser?.id;

  const handleRoleChange = async (participantId, newRole) => {
    if (!currentRoom) return;
    
    setLoading(true);
    try {
      await updateParticipantRole(currentRoom._id, participantId, newRole);
      
      // Emit socket event for real-time update
      if (socket) {
        socket.emit('participant:role-changed', {
          roomId: currentRoom._id,
          userId: participantId,
          newRole,
        });
      }
      
      setOpenMenuId(null);
      if (onRoleChange) {
        onRoleChange();
      }
    } catch (err) {
      console.error('Failed to update role:', err);
      alert('Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="participant-list">
      <h3>Participants ({participants.length})</h3>
      <ul>
        {participants.map((participant) => {
          const participantId = participant.userId?._id || participant.userId;
          const participantName = participant.userId?.displayName || participant.userId?.username || 'Unknown';
          const isCurrentUser = participantId === currentUser?.id;

          return (
            <li key={participantId} className="participant-item">
              <div className="participant-info">
                <span className="participant-name">{participantName}</span>
                <span
                  className={`role-badge role-${participant.role?.toLowerCase() || 'viewer'}`}
                >
                  {participant.role?.charAt(0).toUpperCase() + participant.role?.slice(1)}
                </span>
              </div>
              <div className="participant-actions">
                <span className="status-dot online"></span>
                {isOwner && !isCurrentUser && (
                  <div className="menu-container">
                    <button
                      className="menu-btn"
                      onClick={() => setOpenMenuId(openMenuId === participantId ? null : participantId)}
                      title="Manage role"
                    >
                      ⋮
                    </button>
                    {openMenuId === participantId && (
                      <div className="role-menu">
                        <button
                          className={`role-option ${participant.role === USER_ROLES.EDITOR ? 'active' : ''}`}
                          onClick={() => handleRoleChange(participantId, USER_ROLES.EDITOR)}
                          disabled={loading}
                        >
                          👨‍💻 Editor
                        </button>
                        <button
                          className={`role-option ${participant.role === USER_ROLES.VIEWER ? 'active' : ''}`}
                          onClick={() => handleRoleChange(participantId, USER_ROLES.VIEWER)}
                          disabled={loading}
                        >
                          👁️ Viewer
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
