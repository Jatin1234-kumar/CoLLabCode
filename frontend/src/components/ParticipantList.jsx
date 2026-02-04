import { USER_ROLES } from '../utils/constants.js';
import '../styles/components.css';

export default function ParticipantList({ participants, socket }) {
  return (
    <div className="participant-list">
      <h3>Participants ({participants.length})</h3>
      <ul>
        {participants.map((participant) => (
          <li key={participant.userId?._id || participant.userId} className="participant-item">
            <div className="participant-info">
              <span className="participant-name">
                {participant.userId?.displayName || participant.userId?.username || 'Unknown'}
              </span>
              <span
                className={`role-badge role-${participant.role?.toLowerCase() || 'viewer'}`}
              >
                {participant.role?.charAt(0).toUpperCase() + participant.role?.slice(1)}
              </span>
            </div>
            <div className="participant-status">
              <span className="status-dot online"></span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
