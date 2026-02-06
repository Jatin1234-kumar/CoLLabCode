import '../styles/components.css';

export default function RoomCard({ room, onSelectRoom, onDeleteRoom, onLeaveRoom, isOwner, currentUserId }) {
  const participantCount = room.participants?.length || 0;
  
  // Check if current user is a participant (not owner)
  const isParticipant = room.participants?.some((p) => {
    const userId = typeof p.userId === 'object' ? p.userId._id : p.userId;
    const ownerId = typeof room.owner === 'object' ? room.owner._id : room.owner;
    return userId === currentUserId && userId !== ownerId;
  });

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${room.name}"? This action cannot be undone.`)) {
      onDeleteRoom(room._id);
    }
  };

  const handleLeaveClick = (e) => {
    e.stopPropagation();
    onLeaveRoom(room._id, room);
  };

  return (
    <div className="room-card" onClick={onSelectRoom}>
      <div className="room-card-header">
        <h3>{room.name}</h3>
        <span className="language-badge">{room.language}</span>
      </div>
      <div className="room-card-body">
        <p className="room-owner">Owner: {room.owner?.displayName || room.owner?.username}</p>
        <p className="participant-count">{participantCount} participants</p>
      </div>
      <div className="room-card-footer">
        <small>{new Date(room.updatedAt).toLocaleDateString()}</small>
        <div className="room-actions">
          {isOwner && (
            <button 
              onClick={handleLeaveClick}
              className="leave-room-btn"
              title="Leave or delete this room"
            >
              🚪 Leave
            </button>
          )}
          {isParticipant && (
            <button 
              onClick={handleLeaveClick}
              className="leave-room-btn"
              title="Leave this room"
            >
              🚪 Leave
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
