import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRooms, createRoom, deleteRoom } from '../services/api.js';
import { initSocket } from '../services/socket.js';
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

    // Initialize socket for real-time updates
    const socket = initSocket(token);

    console.log('📡 Dashboard: Setting up socket listeners');

    // Listen for new rooms being created
    socket.on('room:created', (data) => {
      console.log('🆕 Dashboard: New room created:', data.room);
      setRooms((prevRooms) => {
        const roomsArray = Array.isArray(prevRooms) ? prevRooms : [];
        // Check if room already exists to avoid duplicates
        const exists = roomsArray.some(room => room._id === data.room._id);
        if (exists) {
          console.log('⚠️ Dashboard: Room already exists, skipping duplicate');
          return roomsArray;
        }
        return [data.room, ...roomsArray];
      });
    });

    // Listen for rooms being deleted
    socket.on('room:deleted', (data) => {
      console.log('🗑️ Dashboard: Room deleted:', data.roomId);
      setRooms((prevRooms) => (Array.isArray(prevRooms) ? prevRooms.filter((room) => room._id !== data.roomId) : []));
    });

    return () => {
      console.log('🧹 Dashboard: Cleaning up socket listeners');
      socket.off('room:created');
      socket.off('room:deleted');
    };
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
      const newRoom = response.data.data;
      setShowCreateModal(false);
      
      // Don't add locally - socket broadcast will handle it for all users
      // Just navigate to the room
      navigate(`/editor/${newRoom._id}`);
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
      setRooms((prevRooms) => (Array.isArray(prevRooms) ? prevRooms.filter(room => room._id !== roomId) : []));
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
        ) : !Array.isArray(rooms) || rooms.length === 0 ? (
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
