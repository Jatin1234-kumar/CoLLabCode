import '../styles/components.css';

export default function RoomCard({ room, onSelectRoom, onDeleteRoom, isOwner }) {
  const participantCount = room.participants?.length || 0;

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${room.name}"? This action cannot be undone.`)) {
      onDeleteRoom(room._id);
    }
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
        {isOwner && (
          <button 
            onClick={handleDeleteClick}
            className="delete-room-btn"
            title="Delete this room"
          >
            🗑️ Delete
          </button>
        )}
      </div>
    </div>
  );
}
