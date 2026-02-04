import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRooms, createRoom, deleteRoom } from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';
import { useRoomStore } from '../store/roomStore.js';
import RoomCard from '../components/RoomCard.jsx';
import CreateRoomModal from '../components/CreateRoomModal.jsx';
import '../styles/dashboard.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, token } = useAuthStore();
  const { rooms, setRooms, setLoading, isLoading } = useRoomStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    fetchRooms();
  }, [token, navigate]);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const response = await getAllRooms();
      setRooms(response.data.data);
    } catch (err) {
      setError('Failed to load rooms');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (name, language) => {
    try {
      const response = await createRoom(name, language);
      setShowCreateModal(false);
      navigate(`/editor/${response.data.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create room');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteRoom = async (roomId) => {
    try {
      await deleteRoom(roomId);
      setRooms(rooms.filter(room => room._id !== roomId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete room');
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Collaborative Code Editor</h1>
        </div>
        <div className="header-right">
          <span className="user-name">{user?.displayName || user?.username}</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-top">
          <h2>Your Rooms</h2>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            + Create Room
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {isLoading ? (
          <div className="loading">Loading rooms...</div>
        ) : rooms.length === 0 ? (
          <div className="empty-state">
            <p>No rooms yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="rooms-grid">
            {rooms.map((room) => (
              <RoomCard 
                key={room._id} 
                room={room} 
                onSelectRoom={() => navigate(`/editor/${room._id}`)}
                onDeleteRoom={handleDeleteRoom}
                isOwner={room.owner._id === user?.id}
              />
            ))}
          </div>
        )}
      </main>

      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateRoom}
        />
      )}
    </div>
  );
}
