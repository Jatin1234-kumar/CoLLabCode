import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRooms, createRoom, deleteRoom, leaveRoom, transferOwnership } from '../services/api.js';
import { initSocket } from '../services/socket.js';
import { useAuthStore } from '../store/authStore.js';
import { useRoomStore } from '../store/roomStore.js';
import RoomCard from '../components/RoomCard.jsx';
import CreateRoomModal from '../components/CreateRoomModal.jsx';
import TransferOwnershipModal from '../components/TransferOwnershipModal.jsx';
import JoinByCodeModal from '../components/JoinByCodeModal.jsx';
import Toast from '../components/Toast.jsx';
import '../styles/dashboard.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, token } = useAuthStore();
  const { rooms, setRooms, setLoading, isLoading } = useRoomStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showJoinByCodeModal, setShowJoinByCodeModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

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

    // Listen for join request approval
    socket.on('join:approved', (data) => {
      console.log('✅ Dashboard: Join request approved:', data);
      setToast({
        message: `Your join request for "${data.roomName}" has been approved! 🎉`,
        type: 'success'
      });
      // Refresh rooms to show the newly joined room
      fetchRooms();
    });

    // Listen for participant leaving (notification for owner)
    socket.on('participant:left', (data) => {
      console.log('🚪 Dashboard: Participant left:', data);
      setToast({
        message: `${data.userName} left "${data.roomName}"`,
        type: 'info'
      });
      // Refresh rooms to get updated participant count
      fetchRooms();
    });

    return () => {
      console.log('🧹 Dashboard: Cleaning up socket listeners');
      socket.off('room:created');
      socket.off('room:deleted');
      socket.off('join:approved');
      socket.off('participant:left');
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

  const handleLeaveRoom = async (roomId, room) => {
    // If user is the owner, show transfer modal
    if (room && room.owner._id === user?.id) {
      setSelectedRoom(room);
      setShowTransferModal(true);
      return;
    }

    // For regular participants, confirm and leave directly
    if (window.confirm('Are you sure you want to leave this room?')) {
      try {
        await leaveRoom(roomId);
        // Don't remove room from dashboard - just leave it
        // Room will be refetched on next load showing updated participant list
        setError('');
        // Optionally refresh rooms to show updated participant count
        fetchRooms();
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to leave room');
      }
    }
  };

  const handleTransferOwnership = async (newOwnerId) => {
    if (!selectedRoom) return;

    try {
      await transferOwnership(selectedRoom._id, newOwnerId);
      // After transfer, leave the room
      await leaveRoom(selectedRoom._id);
      // Don't remove room from dashboard - refresh to show updated ownership
      fetchRooms();
      setShowTransferModal(false);
      setSelectedRoom(null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to transfer ownership');
      setShowTransferModal(false);
    }
  };

  const handleDeleteAfterTransfer = async () => {
    if (!selectedRoom) return;
    
    try {
      await deleteRoom(selectedRoom._id);
      setRooms((prevRooms) => (Array.isArray(prevRooms) ? prevRooms.filter(room => room._id !== selectedRoom._id) : []));
      setShowTransferModal(false);
      setSelectedRoom(null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete room');
      setShowTransferModal(false);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const exactMatches = normalizedQuery
    ? (rooms || []).filter((room) => room.name?.toLowerCase() === normalizedQuery)
    : [];
  const partialMatches = normalizedQuery
    ? (rooms || []).filter((room) => room.name?.toLowerCase().includes(normalizedQuery))
    : [];
  const showExactMatches = normalizedQuery && exactMatches.length > 0;
  const filteredRooms = normalizedQuery
    ? (showExactMatches ? exactMatches : partialMatches)
    : rooms;

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
          <div className="dashboard-actions">
            <button onClick={() => setShowJoinByCodeModal(true)} className="join-code-btn">
              🔑 Join by Code
            </button>
            <button onClick={() => setShowCreateModal(true)} className="create-btn">
              + Create Room
            </button>
          </div>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search rooms by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              Clear
            </button>
          )}
        </div>

        {normalizedQuery && !showExactMatches && partialMatches.length > 0 && (
          <div className="search-hint">
            No exact match found. Showing similar rooms.
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {isLoading ? (
          <div className="loading">Loading rooms...</div>
        ) : !Array.isArray(filteredRooms) || filteredRooms.length === 0 ? (
          <div className="empty-state">
            <p>
              {normalizedQuery
                ? 'No rooms found for your search.'
                : 'No rooms yet. Create one to get started!'}
            </p>
          </div>
        ) : (
          <div className="rooms-grid">
            {filteredRooms.map((room) => (
              <RoomCard 
                key={room._id} 
                room={room} 
                onSelectRoom={() => navigate(`/editor/${room._id}`)}
                onDeleteRoom={handleDeleteRoom}
                onLeaveRoom={handleLeaveRoom}
                isOwner={room.owner._id === user?.id}
                currentUserId={user?.id}
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

      {showJoinByCodeModal && (
        <JoinByCodeModal
          onClose={() => setShowJoinByCodeModal(false)}
          onJoinSuccess={(room) => {
            setShowJoinByCodeModal(false);
            setError(`Join request sent to "${room.name}"`);
            setTimeout(() => setError(''), 3000);
          }}
        />
      )}

      {showTransferModal && selectedRoom && (
        <TransferOwnershipModal
          room={selectedRoom}
          onTransfer={handleTransferOwnership}
          onDelete={handleDeleteAfterTransfer}
          onCancel={() => {
            setShowTransferModal(false);
            setSelectedRoom(null);
          }}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={5000}
        />
      )}
    </div>
  );
}
