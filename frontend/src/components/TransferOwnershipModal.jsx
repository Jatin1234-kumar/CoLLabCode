import { useState } from 'react';
import '../styles/modal.css';

export default function TransferOwnershipModal({ room, onTransfer, onDelete, onCancel }) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Get other participants (excluding owner)
  const otherParticipants = room.participants?.filter((p) => {
    const userId = typeof p.userId === 'object' ? p.userId._id : p.userId;
    const ownerId = typeof room.owner === 'object' ? room.owner._id : room.owner;
    return userId !== ownerId;
  }) || [];

  const hasOtherParticipants = otherParticipants.length > 0;

  const handleTransfer = () => {
    if (!selectedUserId) {
      alert('Please select a participant to transfer ownership to.');
      return;
    }
    onTransfer(selectedUserId);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${room.name}"? This action cannot be undone.`)) {
      setIsDeleting(true);
      onDelete();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Leave Room: {room.name}</h2>
        
        {hasOtherParticipants ? (
          <>
            <p className="modal-description">
              As the owner, you must transfer ownership to another participant before leaving.
            </p>
            
            <div className="form-group">
              <label htmlFor="new-owner">Select New Owner:</label>
              <select
                id="new-owner"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="transfer-select"
              >
                <option value="">-- Choose a participant --</option>
                {otherParticipants.map((participant) => {
                  const userId = typeof participant.userId === 'object' 
                    ? participant.userId._id 
                    : participant.userId;
                  const username = typeof participant.userId === 'object'
                    ? participant.userId.username || participant.userId.displayName
                    : 'Unknown';
                  
                  return (
                    <option key={userId} value={userId}>
                      {username} ({participant.role})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="modal-actions">
              <button onClick={handleTransfer} className="btn-primary">
                Transfer & Leave
              </button>
              <button onClick={onCancel} className="btn-secondary">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-description">
              You are the only participant in this room. You must delete the room to leave.
            </p>
            
            <div className="modal-warning">
              ⚠️ All code, versions, and history will be permanently deleted.
            </div>

            <div className="modal-actions">
              <button 
                onClick={handleDelete} 
                className="btn-danger"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Room'}
              </button>
              <button onClick={onCancel} className="btn-secondary">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
