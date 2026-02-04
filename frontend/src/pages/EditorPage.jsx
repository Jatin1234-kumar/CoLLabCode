import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRoom, runCode } from '../services/api.js';
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

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    fetchRoom();
    initializeSocket();

    return () => {
      // Cleanup on unmount
    };
  }, [roomId, token, navigate]);

  const fetchRoom = async () => {
    try {
      const response = await getRoom(roomId);
      const room = response.data.data;
      setCurrentRoom(room);
      setCode(room.code);
      setLanguage(room.language);
      setParticipants(room.participants);

      // Determine if current user is read-only
      const userParticipant = room.participants.find((p) => {
        const pUserId = typeof p.userId === 'object' ? p.userId._id : p.userId;
        return pUserId === user.id;
      });
      const isReadOnly = userParticipant?.role === USER_ROLES.VIEWER;
      setEditorReadOnly(isReadOnly);
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

  const initializeSocket = async () => {
    const newSocket = initSocket(token);
    setSocket(newSocket);

    // Join room
    newSocket.emit('room:join', { roomId }, (response) => {
      if (response.success) {
        // Room joined successfully, data contains synced state
        if (response.data?.room) {
          setCode(response.data.room.code);
          setLanguage(response.data.room.language);
          setParticipants(response.data.room.participants);
        }
      } else {
        setError(`Failed to join room: ${response.message}`);
      }
    });

    // Listen for code updates
    newSocket.on('code:updated', (data) => {
      setCode(data.code);
    });

    // Listen for code restoration
    newSocket.on('code:restored', (data) => {
      setCode(data.code);
    });

    // Listen for user joined
    newSocket.on('user:joined', (data) => {
      console.log(`${data.user.username} joined`);
    });

    // Listen for user left
    newSocket.on('user:left', (data) => {
      console.log(`${data.username} left`);
    });

    // Listen for version saved
    newSocket.on('version:saved', (data) => {
      console.log('Version saved:', data);
    });
  };

  if (loading) {
    return <div className="editor-loading">Loading editor...</div>;
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
            {currentRoom?.owner === user?.id && (
              <JoinRequestsPanel joinRequests={currentRoom?.joinRequests || []} roomId={roomId} />
            )}
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
    </div>
  );
}
