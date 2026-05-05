import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRoom, runCode, requestJoinRoom, getRoomVersions, updateParticipantRole, approveJoinRequest, rejectJoinRequest } from '../services/api.js';
import { initSocket, getSocket } from '../services/socket.js';
import { useAuthStore } from '../store/authStore.js';
import { useRoomStore } from '../store/roomStore.js';
import { useEditorStore } from '../store/editorStore.js';
import { USER_ROLES } from '../utils/constants.js';
import CodeEditor from '../components/CodeEditor.jsx';
import AIReviewPanel from '../components/AIReviewPanel.jsx';
import FileTree from '../components/FileTree.jsx';
import JoinRoomModal from '../components/JoinRoomModal.jsx';
import Toast from '../components/Toast.jsx';
import { getRoomFiles, createRoomFile, updateRoomFile, deleteRoomFile } from '../services/api.js';
import '../styles/editor.css';

/* ── helpers ── */
const getInitials = (name = '') => name.slice(0, 2).toUpperCase() || '??';
const formatTime = (d) => {
  const diff = Date.now() - new Date(d);
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}h ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(d).toLocaleDateString();
};

export default function EditorPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const { currentRoom, code, language, setCurrentRoom, setCode, setLanguage, setParticipants } = useRoomStore();
  const { setReadOnly: setEditorReadOnly, lastSyncTime, setLastSyncTime } = useEditorStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [isParticipant, setIsParticipant] = useState(null);
  const [joinRequestPending, setJoinRequestPending] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [toast, setToast] = useState(null);

  // terminal
  const [terminalLines, setTerminalLines] = useState([]);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(true);

  // right panels
  const [usersOpen, setUsersOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(true);

  // version history
  const [versions, setVersions] = useState([]);

  // join requests (sidebar)
  const [joinRequests, setJoinRequests] = useState([]);

  // file system
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [openTabs, setOpenTabs] = useState([]); // [{id, name, icon}]
  const pendingOpenPath = useRef(null);
  const activeFileIdRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);

  const isOwner = currentRoom &&
    (typeof currentRoom.owner === 'object' ? currentRoom.owner._id : currentRoom.owner) === user?.id;

  const myRole = currentRoom?.participants?.find(p => {
    const id = typeof p.userId === 'object' ? p.userId._id : p.userId;
    return id === user?.id;
  })?.role;

  /* ── auth guard ── */
  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchRoom();
  }, [roomId, token]);

  /* ── socket init ── */
  useEffect(() => {
    if (isParticipant === true) {
      const s = initSocket(token);
      setSocket(s);
      initializeSocket(s);
    } else if (isParticipant === false) {
      const s = initSocket(token);
      setSocket(s);
      s.on('join:approved', (data) => {
        setToast({ message: `Join request for "${data.roomName}" approved! 🎉`, type: 'success' });
        s.removeAllListeners(); s.close();
        setError(''); setJoinRequestPending(false); setSocket(null);
        setTimeout(() => fetchRoom(), 500);
      });
      s.on('room:deleted', (data) => {
        alert(`Room "${data.roomName}" was deleted`);
        navigate('/dashboard');
      });
    }
    return () => {
      if (socket && isParticipant !== true) { socket.removeAllListeners(); socket.close(); }
    };
  }, [isParticipant, token]);

  const fetchRoom = async () => {
    try {
      const res = await getRoom(roomId);
      const room = res.data.data;
      setCurrentRoom(room);
      const roomTs = room.lastModified ? new Date(room.lastModified).getTime() : 0;
      if (!lastSyncTime || roomTs >= lastSyncTime) { setCode(room.code); setLastSyncTime(roomTs); }
      setLanguage(room.language);
      setParticipants(room.participants);
      setJoinRequests(room.joinRequests?.filter(r => r.status === 'pending') || []);

      const me = room.participants.find(p => {
        const id = typeof p.userId === 'object' ? p.userId._id : p.userId;
        return id === user.id;
      });
      if (!me) {
        const pending = room.joinRequests?.some(r => {
          const id = typeof r.userId === 'object' ? r.userId._id : r.userId;
          return id === user.id && r.status === 'pending';
        });
        setIsParticipant(false);
        setJoinRequestPending(pending);
        if (!pending) setShowJoinModal(true);
      } else {
        setIsParticipant(true);
        setEditorReadOnly(me.role === USER_ROLES.VIEWER);
      }
    } catch (e) {
      setError('Failed to load room');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async () => {
    try {
      const res = await getRoomVersions(roomId);
      setVersions(res.data.data || []);
    } catch {}
  };

  useEffect(() => {
    if (isParticipant === true) {
      fetchVersions();
      fetchFiles();
    }
  }, [isParticipant]);

  const fetchFiles = async () => {
    try {
      const res = await getRoomFiles(roomId);
      setFiles(res.data.data || []);
    } catch {}
  };

  const getFileIcon = (name = '') => {
    const ext = name.split('.').pop()?.toLowerCase();
    const map = { js:'📜',ts:'📘',py:'🐍',java:'☕',cpp:'⚙️',cs:'🔷',go:'🐹',rs:'🦀',php:'🐘',rb:'💎',html:'🌐',css:'🎨',sql:'🗄️' };
    return map[ext] || '📄';
  };

  const handleFileClick = (file) => {
    // Save current file's content back into files state before switching
    if (activeFileId) {
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: code } : f));
    }
    setActiveFileId(file.id);
    setOpenTabs(prev => prev.find(t => t.id === file.id) ? prev : [...prev, { id: file.id, name: file.displayName || file.name, icon: getFileIcon(file.displayName || file.name) }]);
    setCode(file.content || '');
  };

  const handleCloseTab = (fileId) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t.id !== fileId);
      if (activeFileId === fileId) {
        const last = next[next.length - 1];
        if (last) {
          setActiveFileId(last.id);
          const f = files.find(f => f.id === last.id);
          if (f) setCode(f.content || '');
        } else {
          setActiveFileId(null);
          setCode('');
        }
      }
      return next;
    });
  };

  const handleCreateFile = async (name, path) => {
    try {
      const ext = name.split('.').pop()?.toLowerCase();
      const langMap = { js:'javascript',ts:'typescript',py:'python',java:'java',cpp:'cpp',cs:'csharp',go:'go',rs:'rust',php:'php',rb:'ruby',html:'html',css:'css',sql:'sql' };
      const lang = langMap[ext] || 'javascript';
      pendingOpenPath.current = path; // mark this path to auto-open when socket event arrives
      await createRoomFile(roomId, { name, path, language: lang, isFolder: false });
    } catch (e) { pendingOpenPath.current = null; setToast({ message: e.response?.data?.message || 'Failed to create file', type: 'error' }); }
  };

  const handleCreateFolder = async (name, path) => {
    try {
      await createRoomFile(roomId, { name, path, isFolder: true });
      // State update handled by file:created socket event for all users including creator
    } catch (e) { setToast({ message: e.response?.data?.message || 'Failed to create folder', type: 'error' }); }
  };

  // Rename a regular file
  const handleRenameFile = async (fileId, oldName, newName, oldPath) => {
    try {
      const dir = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = dir ? `${dir}/${newName}` : `/${newName}`;
      const res = await updateRoomFile(roomId, fileId, { name: newName, path: newPath });
      setFiles(res.data.data);
      setOpenTabs(prev => prev.map(t => t.id === fileId ? { ...t, name: newName, icon: getFileIcon(newName) } : t));
    } catch (e) { setToast({ message: 'Failed to rename file', type: 'error' }); }
  };

  // Rename a folder — must cascade all child paths (handled server-side)
  const handleRenameFolder = async (node, newName) => {
    try {
      const oldPath = node.folderPath;
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = parentPath ? `${parentPath}/${newName}` : `/${newName}`;
      const fileId = node.folderFile?.id;

      if (fileId) {
        // Folder has a DB record — update it with oldPath for cascade
        const res = await updateRoomFile(roomId, fileId, { name: newName, path: newPath, oldPath });
        setFiles(res.data.data);
      } else {
        // Folder was created implicitly (no DB record) — rename all children
        // by updating each child's path
        const updates = files
          .filter(f => f.path.startsWith(oldPath + '/') || f.path === oldPath)
          .map(f => updateRoomFile(roomId, f.id, { path: f.path.replace(oldPath, newPath) }));
        await Promise.all(updates);
        await fetchFiles();
      }
      // Update any open tabs whose files were inside this folder
      setOpenTabs(prev => prev.map(t => {
        const f = files.find(f => f.id === t.id);
        if (f && f.path.startsWith(oldPath + '/')) {
          return { ...t }; // name stays same, path updated in files state
        }
        return t;
      }));
    } catch (e) { setToast({ message: 'Failed to rename folder', type: 'error' }); }
  };

  const handleDeleteFile = async (fileId, path, isFolder) => {
    if (!window.confirm(`Delete "${path}"?`)) return;
    try {
      await deleteRoomFile(roomId, fileId);
      // collect all ids being removed (the item + any children if folder)
      const removedIds = new Set(
        files
          .filter(f => f.id === fileId || (isFolder && f.path.startsWith(path + '/')))
          .map(f => f.id)
      );
      setFiles(prev => prev.filter(f => !removedIds.has(f.id)));
      setOpenTabs(prev => {
        const next = prev.filter(t => !removedIds.has(t.id));
        // if active tab was removed, switch to last remaining or clear
        if (removedIds.has(activeFileId)) {
          const last = next[next.length - 1];
          if (last) {
            setActiveFileId(last.id);
            const f = files.find(f => f.id === last.id);
            if (f) setCode(f.content || '');
          } else {
            setActiveFileId(null);
            setCode('');
          }
        }
        return next;
      });
    } catch (e) { setToast({ message: 'Failed to delete', type: 'error' }); }
  };

  const initializeSocket = (s) => {
    ['code:updated','code:restored','user:joined','user:left','participant:left',
     'participant:role-updated','my:role-changed','join:request','room:deleted','version:saved'].forEach(e => s.off(e));

    const joinRoom = () => {
      s.emit('room:join', { roomId }, (res) => {
        if (res.success && res.data?.room) {
          setCode(res.data.room.code);
          setLanguage(res.data.room.language);
          setParticipants(res.data.room.participants);
        }
      });
    };
    s.on('connect', joinRoom);
    if (s.connected) joinRoom();

    s.on('code:updated', (d) => {
      // Only apply room-level code sync when no file is open
      if (!activeFileIdRef.current) {
        setCode(d.code);
        if (d.timestamp) setLastSyncTime(d.timestamp);
      }
    });
    s.on('code:restored', (d) => { if (!activeFileIdRef.current) setCode(d.code); });
    s.on('participant:left', (d) => {
      if (d.userName) setToast({ message: `${d.userName} left the room`, type: 'info' });
      setParticipants(prev => prev.filter(p => {
        const id = typeof p.userId === 'object' ? p.userId._id : p.userId;
        return id !== d.userId;
      }));
      fetchRoom();
    });
    s.on('participant:role-updated', () => fetchRoom());
    s.on('my:role-changed', () => fetchRoom());
    s.on('join:request', () => fetchRoom());
    s.on('room:deleted', (d) => { alert(`Room "${d.roomName}" was deleted`); navigate('/dashboard'); });
    s.on('version:saved', () => fetchVersions());
    s.on('files:reloaded', (d) => { if (d.files) setFiles(d.files); });
    // Update file content in local files state when any file is edited
    s.on('file:updated', (d) => {
      if (!d.fileId) return;
      setFiles(prev => prev.map(f => f.id === d.fileId ? { ...f, content: d.content } : f));
    });
    s.on('file:created', (d) => {
      if (!d.file) return;
      setFiles(prev => {
        // deduplicate — ignore if already present
        if (prev.some(f => f.id === d.file.id)) return prev;
        return [...prev, d.file];
      });
      // auto-open tab if this is the file the current user just created
      if (!d.file.isFolder && pendingOpenPath.current === d.file.path) {
        pendingOpenPath.current = null;
        const displayName = d.file.path.split('/').pop();
        setActiveFileId(d.file.id);
        setOpenTabs(prev => prev.find(t => t.id === d.file.id) ? prev : [...prev, {
          id: d.file.id,
          name: displayName,
          icon: (() => { const ext = displayName.split('.').pop()?.toLowerCase(); const m = {js:'📜',ts:'📘',py:'🐍',java:'☕',cpp:'⚙️',cs:'🔷',go:'🐹',rs:'🦀',php:'🐘',rb:'💎',html:'🌐',css:'🎨',sql:'🗄️'}; return m[ext]||'📄'; })()
        }]);
        setCode(d.file.content || '');
      }
    });
    s.on('file:deleted', (d) => {
      if (!d.fileId) return;
      setFiles(prev => prev.filter(f => f.id !== d.fileId && !f.path.startsWith(d.path + '/')));
      setOpenTabs(prev => {
        const next = prev.filter(t => t.id !== d.fileId && !files.find(f => f.id === t.id && f.path.startsWith(d.path + '/')));
        if (next.length !== prev.length) {
          const last = next[next.length - 1];
          if (last) { setActiveFileId(last.id); }
          else { setActiveFileId(null); setCode(''); }
        }
        return next;
      });
    });
  };

  const handleRunCode = async () => {
    if (!code || !language) return;
    setExecutionLoading(true);
    setShowTerminal(true);
    setTerminalLines([{ text: '$ Run Code', cls: 'prompt' }]);
    try {
      const res = await runCode(roomId, code, language);
      const r = res.data.data;
      const lines = [];
      if (r.stdout) lines.push(...r.stdout.split('\n').map(t => ({ text: t, cls: 'success' })));
      if (r.stderr || r.compilationError) {
        lines.push(...(r.stderr || r.compilationError).split('\n').map(t => ({ text: t, cls: 'error' })));
      }
      if (!lines.length) lines.push({ text: '(No output)', cls: 'info' });
      lines.push({ text: '$ ', cls: 'prompt' });
      setTerminalLines(prev => [...prev, ...lines]);
    } catch (e) {
      setTerminalLines(prev => [...prev,
        { text: e.response?.data?.message || 'Execution failed', cls: 'error' },
        { text: '$ ', cls: 'prompt' }
      ]);
    } finally {
      setExecutionLoading(false);
    }
  };

  const handleJoinRequest = async (role) => {
    try {
      await requestJoinRoom(roomId, role);
      setShowJoinModal(false);
      setJoinRequestPending(true);
      setError('Join request sent! Waiting for owner approval...');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to send join request');
    }
  };

  const handleApproveRequest = async (reqId) => {
    try {
      await approveJoinRequest(roomId, reqId);
      fetchRoom();
    } catch {}
  };

  const handleRejectRequest = async (reqId) => {
    try {
      await rejectJoinRequest(roomId, reqId);
      fetchRoom();
    } catch {}
  };

  const handleSaveVersion = () => {
    if (!socket) return;
    socket.emit('version:save', { roomId }, (res) => {
      if (res.success) fetchVersions();
    });
  };

  const handleRestoreVersion = (versionId) => {
    if (!socket) return;
    socket.emit('version:restore', { roomId, versionId }, (res) => {
      if (!res.success) alert(`Failed to restore: ${res.message}`);
    });
  };

  const handleDeleteVersion = (versionId) => {
    if (!window.confirm('Delete this version?')) return;
    if (!socket) return;
    socket.emit('version:delete', { roomId, versionId }, (res) => {
      if (res.success) fetchVersions();
    });
  };

  const handleRoleChange = async (participantId, newRole) => {
    try {
      await updateParticipantRole(currentRoom._id, participantId, newRole);
      if (socket) socket.emit('participant:role-changed', { roomId: currentRoom._id, userId: participantId, newRole });
      fetchRoom();
    } catch {}
  };

  /* ── guards ── */
  if (loading || isParticipant === null)
    return <div className="editor-loading">Loading editor...</div>;

  if (isParticipant === false && joinRequestPending)
    return (
      <div className="editor-pending">
        <div className="pending-message">
          <h2>⏳ Join Request Pending</h2>
          <p>Your request to join "<strong>{currentRoom?.name}</strong>" is waiting for owner approval.</p>
          <button onClick={() => navigate('/dashboard')} className="back-btn">← Back to Dashboard</button>
        </div>
      </div>
    );

  if (error && isParticipant === false)
    return <div className="editor-error">{error}</div>;

  const participants = currentRoom?.participants || [];

  return (
    <div className="editor-container">

      {/* ── Top Bar ── */}
      <header className="editor-header">
        <div className="header-left">
          <div className="header-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            CollabCode
          </div>
          <span className="header-title">
            Collaborative Code Editor: {currentRoom?.name || 'Loading...'}
          </span>
        </div>

        <div className="header-right">
          <button className="run-btn" onClick={handleRunCode} disabled={executionLoading}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {executionLoading ? 'Running...' : 'Run Code'}
          </button>

          {isOwner && (
            <button className="header-icon-btn" title="Join Requests" onClick={() => {}}>
              🔔
              {joinRequests.length > 0 && <span className="header-badge">{joinRequests.length}</span>}
            </button>
          )}

          <div className="header-user">
            <div className="header-avatar">{getInitials(user?.displayName || user?.username)}</div>
            <div className="header-user-info">
              <span className="header-user-name">{user?.displayName || user?.username}</span>
              <span className="header-user-role">{myRole || 'Member'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="editor-body">

        {/* ── Left Sidebar ── */}
        <aside className="editor-left-sidebar">

          {/* Files */}
          <div className="sidebar-section files-section">
            <div className="sidebar-section-header"><span>Files</span></div>
            <FileTree
              files={files}
              activeFileId={activeFileId}
              onFileClick={handleFileClick}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onRenameFile={handleRenameFile}
              onRenameFolder={handleRenameFolder}
              onDelete={handleDeleteFile}
              canEdit={myRole === USER_ROLES.OWNER || myRole === USER_ROLES.EDITOR}
            />
          </div>

          {/* Incoming Join Requests */}
          {isOwner && joinRequests.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span>Incoming Join Requests</span>
                <span className="join-req-badge">{joinRequests.length}</span>
              </div>
              <div className="sidebar-join-requests">
                {joinRequests.map((req) => {
                  const name = typeof req.userId === 'object'
                    ? (req.userId.displayName || req.userId.username)
                    : 'User';
                  return (
                    <div key={req._id} className="sidebar-req-item">
                      <div className="sidebar-user-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                        {getInitials(name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="sidebar-req-name">{name}</div>
                        <div className="sidebar-req-role">{req.requestedRole}</div>
                      </div>
                      <div className="sidebar-req-actions">
                        <button className="req-approve-btn" onClick={() => handleApproveRequest(req._id)} title="Approve">✓</button>
                        <button className="req-reject-btn" onClick={() => handleRejectRequest(req._id)} title="Reject">✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current Active Users */}
          <div className="sidebar-section" style={{ flex: 1 }}>
            <div className="sidebar-section-header">
              <span>Current Active Users</span>
            </div>
            <div className="sidebar-users">
              {participants.map((p) => {
                const id = typeof p.userId === 'object' ? p.userId._id : p.userId;
                const name = typeof p.userId === 'object'
                  ? (p.userId.displayName || p.userId.username)
                  : 'User';
                return (
                  <div key={id} className="sidebar-user-item">
                    <div className="sidebar-user-avatar">{getInitials(name)}</div>
                    <span className="sidebar-user-name">{name}</span>
                    <span className={`sidebar-role-badge ${p.role?.toLowerCase()}`}>{p.role}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom action */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button className="back-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/dashboard')}>
              ← Dashboard
            </button>
          </div>
        </aside>

        {/* ── Center ── */}
        <div className="editor-center">

          {/* Tab bar */}
          <div className="editor-tab-bar">
            <div className="editor-tabs">
              {openTabs.length === 0 && (
                <div className="editor-tab active">
                  <span>⚙️</span>
                  <span>{currentRoom?.name || 'Editor'}</span>
                </div>
              )}
              {openTabs.map(tab => (
                <div
                  key={tab.id}
                  className={`editor-tab${activeFileId === tab.id ? ' active' : ''}`}
                  onClick={() => {
                    if (activeFileId && activeFileId !== tab.id) {
                      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: code } : f));
                    }
                    setActiveFileId(tab.id);
                    const f = files.find(f => f.id === tab.id);
                    if (f) setCode(f.content || '');
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                  <button className="editor-tab-close" onClick={e => { e.stopPropagation(); handleCloseTab(tab.id); }}>✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Editor */}
          <CodeEditor socket={socket} roomId={roomId} currentUserId={user?.id} activeFileId={activeFileId} />

          {/* Terminal */}
          {showTerminal && (
            <div className="terminal-panel">
              <div className="terminal-header">
                <span className="terminal-title">Terminal</span>
                <div className="terminal-actions">
                  <button className="terminal-btn" onClick={() => setTerminalLines([])}>⊘</button>
                  <button className="terminal-btn" onClick={() => setShowTerminal(false)}>✕</button>
                </div>
              </div>
              <div className="terminal-body">
                {executionLoading && <div className="terminal-loading">Executing...</div>}
                {terminalLines.map((l, i) => (
                  <pre key={i} className={`terminal-line ${l.cls}`}>{l.text}</pre>
                ))}
                {!executionLoading && terminalLines.length === 0 && (
                  <pre className="terminal-line prompt">$ Ready</pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Sidebar ── */}
        <aside className="editor-right-sidebar">

          {/* Connected Users */}
          <div className="right-panel-section">
            <div className="right-panel-header" onClick={() => setUsersOpen(o => !o)}>
              <div className="right-panel-title">
                <span className="panel-icon">👥</span>
                Connected Users
              </div>
              <span className={`right-panel-chevron ${usersOpen ? 'open' : ''}`}>▲</span>
            </div>
            {usersOpen && (
              <div className="right-panel-body">
                {participants.map((p) => {
                  const id = typeof p.userId === 'object' ? p.userId._id : p.userId;
                  const name = typeof p.userId === 'object'
                    ? (p.userId.displayName || p.userId.username)
                    : 'User';
                  const isMe = id === user?.id;
                  return (
                    <div key={id} className="connected-user-item">
                      <div className="connected-user-avatar">{getInitials(name)}</div>
                      <div className="connected-user-details">
                        <div className="connected-user-name">{name}</div>
                        <div className="connected-user-status">Status</div>
                      </div>
                      <div className="connected-user-controls">
                        <div className="role-select-row">
                          <span>Status</span>
                          <select
                            value={p.role}
                            disabled={!isOwner || isMe}
                            onChange={e => handleRoleChange(id, e.target.value)}
                          >
                            <option value="owner">Owner</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </div>
                        <div className="role-select-row">
                          <span>Access Level</span>
                          <select
                            value={p.role === 'owner' ? 'editor' : p.role}
                            disabled={!isOwner || isMe || p.role === 'owner'}
                            onChange={e => handleRoleChange(id, e.target.value)}
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Version History */}
          <div className="right-panel-section">
            <div className="right-panel-header" onClick={() => setHistoryOpen(o => !o)}>
              <div className="right-panel-title">
                <span className="panel-icon">🕐</span>
                Version History
              </div>
              <span className={`right-panel-chevron ${historyOpen ? 'open' : ''}`}>▲</span>
            </div>
            {historyOpen && (
              <div className="right-panel-body">
                {(myRole === USER_ROLES.OWNER || myRole === USER_ROLES.EDITOR) && (
                  <button className="save-version-btn-new" onClick={handleSaveVersion}>
                    💾 Save Version
                  </button>
                )}
                {versions.length === 0 && (
                  <div style={{ color: '#8b949e', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
                    No versions saved yet
                  </div>
                )}
                {versions.map((v, i) => (
                  <div key={v._id} className="version-item-new">
                    <div className="version-dot" />
                    <div className="version-item-info">
                      <div className="version-item-time">{formatTime(v.createdAt)}</div>
                      <div className="version-item-desc">
                        {v.label || `Version ${versions.length - i}`}
                      </div>
                    </div>
                    <div className="version-item-actions">
                      <button className="v-restore-btn" onClick={() => handleRestoreVersion(v._id)}>↩</button>
                      <button className="v-delete-btn" onClick={() => handleDeleteVersion(v._id)}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Code Review */}
          <div className="right-panel-section">
            <div className="right-panel-header" onClick={() => setAiOpen(o => !o)}>
              <div className="right-panel-title">
                <span className="panel-icon">🤖</span>
                AI Code Review Options
              </div>
              <span className={`right-panel-chevron ${aiOpen ? 'open' : ''}`}>▲</span>
            </div>
            {aiOpen && (
              <div className="right-panel-body">
                <AIReviewPanel
                  roomId={roomId}
                  code={code}
                  compact
                  canUse={myRole === USER_ROLES.OWNER || myRole === USER_ROLES.EDITOR}
                />
              </div>
            )}
          </div>

        </aside>
      </div>

      {/* ── Modals / Toasts ── */}
      {showJoinModal && (
        <JoinRoomModal
          roomName={currentRoom?.name}
          onJoinRequest={handleJoinRequest}
          onCancel={() => navigate('/dashboard')}
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
