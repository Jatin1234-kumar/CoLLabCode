import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRoom, runCode, requestJoinRoom } from '../services/api.js';
import { initSocket, getSocket } from '../services/socket.js';
import { useAuthStore } from '../store/authStore.js';
import { useRoomStore } from '../store/roomStore.js';
import { useEditorStore } from '../store/editorStore.js';
import { USER_ROLES } from '../utils/constants.js';
import CodeEditor from '../components/CodeEditor.jsx';
import ParticipantList from '../components/ParticipantList.jsx';
import VersionHistory from '../components/VersionHistory.jsx';
import JoinRequestsPanel from '../components/JoinRequestsPanel.jsx';
import OutputPanel from '../components/OutputPanel.jsx';
import JoinRoomModal from '../components/JoinRoomModal.jsx';
import '../styles/editor.css';

export default function EditorPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const { currentRoom, code, language, setCurrentRoom, setCode, setLanguage, setParticipants, setReadOnly } = useRoomStore();
  const { setReadOnly: setEditorReadOnly } = useEditorStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionOutput, setExecutionOutput] = useState('');
  const [executionError, setExecutionError] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isParticipant, setIsParticipant] = useState(null); // null = not checked yet
  const [joinRequestPending, setJoinRequestPending] = useState(false);
  const [showJoinRequests, setShowJoinRequests] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    fetchRoom();

    return () => {
      // Cleanup on unmount
    };
  }, [roomId, token, navigate]);

  // Initialize socket only after we know user status
  useEffect(() => {
    console.log('🔄 EditorPage: Socket effect triggered. isParticipant:', isParticipant, 'socket:', !!socket);
    
    if (isParticipant === true && !socket) {
      console.log('✅ EditorPage: User is participant, initializing socket');
      initializeSocket();
    } else if (isParticipant === false && !socket) {
      console.log('⏳ EditorPage: User is NOT participant, setting up join:approved listener');
      // Non-participants also need socket connection to receive join:approved event
      const newSocket = initSocket(token);
      setSocket(newSocket);

      // Listen for join approval (for requester)
      newSocket.on('join:approved', (data) => {
        console.log('✅ EditorPage: Join request approved!', data);
        
        // Clean up the socket completely
        newSocket.removeAllListeners();
        newSocket.close();
        
        // Update state - clear error and pending status
        setError('');
        setJoinRequestPending(false);
        setSocket(null);
        
        // Wait a bit for backend to update, then refetch room data
        setTimeout(() => {
          fetchRoom().then(() => {
            console.log('✅ EditorPage: Room data refreshed after approval');
          });
        }, 500);
      });

      // Listen for room deletion
      newSocket.on('room:deleted', (data) => {
        console.log('❌ EditorPage: Room deleted:', data);
        alert(`This room "${data.roomName}" has been deleted by the owner`);
        navigate('/dashboard');
      });
    }

    return () => {
      // Cleanup on unmount or when isParticipant changes
      if (socket) {
        console.log('🧹 EditorPage: Cleaning up socket listeners');
        socket.removeAllListeners();
        if (isParticipant !== true) {
          // Only close socket if we're not going to reinitialize for a participant
          socket.close();
        }
      }
    };
  }, [isParticipant]);

  const fetchRoom = async () => {
    try {
      const response = await getRoom(roomId);
      const room = response.data.data;
      setCurrentRoom(room);
      setCode(room.code);
      setLanguage(room.language);
      setParticipants(room.participants);

      // Check if current user is a participant
      const userParticipant = room.participants.find((p) => {
        const pUserId = typeof p.userId === 'object' ? p.userId._id : p.userId;
        return pUserId === user.id;
      });

      if (!userParticipant) {
        // User is not a participant - check if they have a pending request
        const hasPendingRequest = room.joinRequests?.some((req) => {
          const reqUserId = typeof req.userId === 'object' ? req.userId._id : req.userId;
          return reqUserId === user.id && req.status === 'pending';
        });

        setIsParticipant(false);
        setJoinRequestPending(hasPendingRequest);
        
        if (!hasPendingRequest) {
          setShowJoinModal(true);
        }
      } else {
        setIsParticipant(true);
        // Determine if current user is read-only
        const isReadOnly = userParticipant.role === USER_ROLES.VIEWER;
        setEditorReadOnly(isReadOnly);
      }
    } catch (err) {
      setError('Failed to load room');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCode = async () => {
    if (!code || !language) {
      setExecutionError('Code and language are required');
      setShowOutput(true);
      return;
    }

    setExecutionLoading(true);
    setExecutionOutput('');
    setExecutionError('');
    setShowOutput(true);

    try {
      const response = await runCode(roomId, code, language);
      const result = response.data.data;

      if (result.statusName === 'Accepted') {
        setExecutionOutput(result.stdout || '(No output)');
        setExecutionError(result.stderr || result.compilationError || '');
      } else {
        setExecutionError(
          `Execution Error: ${result.statusName}\n${result.stderr || result.compilationError || ''}`
        );
        setExecutionOutput(result.stdout || '');
      }
    } catch (err) {
      setExecutionError(err.response?.data?.message || 'Failed to execute code');
    } finally {
      setExecutionLoading(false);
    }
  };

  const handleJoinRequest = async (requestedRole) => {
    try {
      await requestJoinRoom(roomId, requestedRole);
      setShowJoinModal(false);
      setJoinRequestPending(true);
      setError('Join request sent! Waiting for owner approval...');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send join request');
    }
  };

  const initializeSocket = async () => {
    console.log('🔌 EditorPage: Initializing socket for participant');
    const newSocket = initSocket(token);
    setSocket(newSocket);

    // Join room via socket
    newSocket.emit('room:join', { roomId }, (response) => {
      if (response.success) {
        console.log('✅ EditorPage: Successfully joined room via socket');
        // Room joined successfully, data contains synced state
        if (response.data?.room) {
          setCode(response.data.room.code);
          setLanguage(response.data.room.language);
          setParticipants(response.data.room.participants);
        }
      } else {
        console.error('❌ EditorPage: Failed to join room:', response.message);
        setError(`Failed to join room: ${response.message}`);
      }
    });

    // Listen for code updates
    newSocket.on('code:updated', (data) => {
      console.log('📝 EditorPage: Code updated');
      setCode(data.code);
    });

    // Listen for code restoration
    newSocket.on('code:restored', (data) => {
      console.log('↩️ EditorPage: Code restored from version');
      setCode(data.code);
    });

    // Listen for user joined
    newSocket.on('user:joined', (data) => {
      console.log(`👋 EditorPage: ${data.user.username} joined`);
    });

    // Listen for user left
    newSocket.on('user:left', (data) => {
      console.log(`👋 EditorPage: ${data.username} left`);
    });

    // Listen for join requests (for room owner)
    newSocket.on('join:request', (data) => {
      console.log('🔔 EditorPage: New join request received:', data);
      // Refresh room data to get updated join requests
      fetchRoom();
    });

    // Listen for room deletion
    newSocket.on('room:deleted', (data) => {
      console.log('❌ EditorPage: Room deleted:', data);
      alert(`This room "${data.roomName}" has been deleted by the owner`);
      navigate('/dashboard');
    });

    // Listen for version saved
    newSocket.on('version:saved', (data) => {
      console.log('💾 EditorPage: Version saved:', data);
    });
  };

  if (loading || isParticipant === null) {
    return <div className="editor-loading">Loading editor...</div>;
  }

  if (isParticipant === false && joinRequestPending) {
    return (
      <div className="editor-pending">
        <div className="pending-message">
          <h2>⏳ Join Request Pending</h2>
          <p>Your request to join "<strong>{currentRoom?.name}</strong>" is waiting for approval from the room owner.</p>
          <button onClick={() => navigate('/dashboard')} className="back-btn">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="editor-error">{error}</div>;
  }

  return (
    <div className="editor-container">
      <header className="editor-header">
        <div className="header-left">
          <button onClick={() => navigate('/dashboard')} className="back-btn">
            ← Back
          </button>
          <h1>{currentRoom?.name}</h1>
        </div>
        <div className="header-right">
          {currentRoom && (typeof currentRoom.owner === 'object' ? currentRoom.owner._id : currentRoom.owner) === user?.id && (
            <button 
              onClick={() => setShowJoinRequests(true)} 
              className="requests-btn"
              title="View join requests"
            >
              📨 Requests
              {currentRoom?.joinRequests?.filter(r => r.status === 'pending').length > 0 && (
                <span className="requests-badge">
                  {currentRoom.joinRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          )}
          <button onClick={() => setShowVersionHistory(!showVersionHistory)} className="version-btn">
            📚 History
          </button>
          <button onClick={handleRunCode} className="run-btn" disabled={executionLoading}>
            {executionLoading ? '⏳ Running...' : '▶️ Run'}
          </button>
        </div>
      </header>

      <div className="editor-body">
        <div className="editor-main">
          <CodeEditor socket={socket} roomId={roomId} />
        </div>

        <aside className="editor-sidebar">
          <div className="sidebar-tabs">
            <ParticipantList participants={currentRoom?.participants || []} socket={socket} />
          </div>
        </aside>

        {showVersionHistory && (
          <div className="version-panel">
            <VersionHistory roomId={roomId} socket={socket} />
          </div>
        )}
      </div>

      {showOutput && (
        <OutputPanel
          isLoading={executionLoading}
          output={executionOutput}
          error={executionError}
          onClose={() => setShowOutput(false)}
        />
      )}

      {showJoinModal && (
        <JoinRoomModal
          roomName={currentRoom?.name}
          onJoinRequest={handleJoinRequest}
          onCancel={() => navigate('/dashboard')}
        />
      )}

      {showJoinRequests && (
        <JoinRequestsPanel
          joinRequests={currentRoom?.joinRequests || []}
          roomId={roomId}
          onRequestHandled={fetchRoom}
          onClose={() => setShowJoinRequests(false)}
        />
      )}
    </div>
  );
}
