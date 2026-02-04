import '../styles/components.css';

export default function RoomCard({ room, onSelectRoom }) {
  const participantCount = room.participants?.length || 0;

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
      </div>
    </div>
  );
}
