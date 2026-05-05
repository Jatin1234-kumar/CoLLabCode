import { useEffect, useRef, useState } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';

import { useRoomStore } from '../store/roomStore.js';
import { useEditorStore } from '../store/editorStore.js';
import '../styles/editor-codemirror.css';

const getLanguageExtension = (language) => {
  const extensions = {
    javascript, typescript: javascript,
    python, java, cpp, csharp: cpp,
    html, css, sql,
    php: javascript, ruby: javascript, go: javascript, rust: javascript,
  };
  return (extensions[language] || javascript)();
};

export default function CodeEditor({ socket, roomId, currentUserId, activeFileId }) {
  const editorRef = useRef(null);
  const cursorOverlayRef = useRef(null);
  const viewRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const cursorThrottleRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingStartedRef = useRef(false);
  const isRemoteUpdateRef = useRef(false);
  const activeFileIdRef = useRef(activeFileId);

  const [cursorPositions, setCursorPositions] = useState({});
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());

  const { code, language, setCode } = useRoomStore();
  const { isReadOnly, setCursor, remoteCursors, setRemoteCursor, removeRemoteCursor, removeStaleRemoteCursors } = useEditorStore();

  // Keep activeFileId ref in sync so editor closure always reads latest value
  useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);

  /* -------- file:updated — only apply if it matches the open file -------- */
  useEffect(() => {
    if (!socket) return;
    const handler = (d) => {
      if (d.fileId && d.fileId === activeFileIdRef.current) {
        setCode(d.content);
      }
    };
    socket.on('file:updated', handler);
    return () => socket.off('file:updated', handler);
  }, [socket, setCode]);

  /* -------- cursor updates -------- */
  useEffect(() => {
    if (!socket) return;

    const handleCursorUpdated = ({ userId, username, position, line }) => {
      setRemoteCursor(userId, position, username);
    };
    const handleUserDisconnected = ({ userId }) => removeRemoteCursor(userId);
    const handleUserLeft = ({ userId }) => removeRemoteCursor(userId);
    const handleTypingStarted = ({ userId }) => setTypingUsers(prev => { const s = new Set(prev); s.add(userId); return s; });
    const handleTypingStopped = ({ userId }) => setTypingUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });

    socket.on('cursor:updated', handleCursorUpdated);
    socket.on('user:disconnected', handleUserDisconnected);
    socket.on('user:left', handleUserLeft);
    socket.on('user:typing:started', handleTypingStarted);
    socket.on('user:typing:stopped', handleTypingStopped);

    return () => {
      socket.off('cursor:updated', handleCursorUpdated);
      socket.off('user:disconnected', handleUserDisconnected);
      socket.off('user:left', handleUserLeft);
      socket.off('user:typing:started', handleTypingStarted);
      socket.off('user:typing:stopped', handleTypingStopped);
    };
  }, [socket, setRemoteCursor, removeRemoteCursor]);

  /* -------- typing state -------- */
  useEffect(() => {
    if (!socket) return;
    if (isUserTyping) socket.emit('typing:start', { roomId });
    else socket.emit('typing:stop', { roomId });
  }, [isUserTyping, socket, roomId]);

  /* -------- stale cursor cleanup -------- */
  useEffect(() => {
    const id = setInterval(() => removeStaleRemoteCursors(350), 100);
    return () => clearInterval(id);
  }, [removeStaleRemoteCursors]);

  /* -------- cursor overlay positions -------- */
  useEffect(() => {
    if (!viewRef.current || !cursorOverlayRef.current) return;
    const newPos = {};
    const wrapperRect = cursorOverlayRef.current.parentElement.getBoundingClientRect();
    const view = viewRef.current;
    Object.entries(remoteCursors).forEach(([userId, cursorData]) => {
      if (cursorData?.position === undefined) return;
      const position = Math.min(cursorData.position, view.state.doc.length);
      try {
        const coords = view.coordsAtPos(position);
        if (coords) {
          const top = coords.top - wrapperRect.top;
          const left = coords.left - wrapperRect.left;
          if (top >= -50 && top <= wrapperRect.height + 50 && left >= -50 && left <= wrapperRect.width + 50) {
            newPos[userId] = { top, left, username: cursorData.username, color: cursorData.color };
          }
        }
      } catch {}
    });
    setCursorPositions(newPos);
  }, [remoteCursors]);

  /* -------- scroll cursor sync -------- */
  useEffect(() => {
    if (!viewRef.current || !cursorOverlayRef.current) return;
    const scrollDOM = viewRef.current.scrollDOM;
    if (!scrollDOM) return;
    const handleScroll = () => {
      if (!viewRef.current || !cursorOverlayRef.current) return;
      const newPos = {};
      const wrapperRect = cursorOverlayRef.current.parentElement.getBoundingClientRect();
      Object.entries(remoteCursors).forEach(([userId, cursorData]) => {
        if (cursorData?.position === undefined) return;
        try {
          const coords = viewRef.current.coordsAtPos(cursorData.position);
          if (coords) newPos[userId] = { top: coords.top - wrapperRect.top, left: coords.left - wrapperRect.left, username: cursorData.username, color: cursorData.color };
        } catch {}
      });
      setCursorPositions(newPos);
    };
    scrollDOM.addEventListener('scroll', handleScroll);
    return () => scrollDOM.removeEventListener('scroll', handleScroll);
  }, [remoteCursors, currentUserId, cursorOverlayRef]);

  /* -------- initialize editor -------- */
  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: code ?? '',
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        keymap.of([...defaultKeymap, indentWithTab]),
        getLanguageExtension(language),
        oneDark,
        EditorView.editable.of(!isReadOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newCode = update.state.doc.toString();
            if (isRemoteUpdateRef.current) { isRemoteUpdateRef.current = false; return; }

            if (!typingStartedRef.current) { setIsUserTyping(true); typingStartedRef.current = true; }
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => { setIsUserTyping(false); typingStartedRef.current = false; }, 400);

            setCode(newCode);

            if (socket) {
              clearTimeout(debounceTimerRef.current);
              debounceTimerRef.current = setTimeout(() => {
                const fileId = activeFileIdRef.current;
                if (fileId) {
                  // Per-file sync — does NOT touch the room's global code
                  socket.emit('file:update', { roomId, fileId, content: newCode });
                } else {
                  // No file open — use legacy room-level code sync
                  socket.emit('code:update', { roomId, code: newCode, timestamp: Date.now() });
                }
              }, 500);
            }
          }

          const cursor = update.state.selection.main;
          const position = cursor.from;
          const line = update.state.doc.lineAt(position).number;
          setCursor({ from: cursor.from, to: cursor.to, line });

          if (socket && !isRemoteUpdateRef.current) {
            const now = Date.now();
            if (now - (cursorThrottleRef.current || 0) > 50) {
              cursorThrottleRef.current = now;
              socket.emit('cursor:update', { roomId, position, line });
            }
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [language, isReadOnly, socket, roomId, setCode, setCursor]);

  /* -------- sync external code changes into editor -------- */
  useEffect(() => {
    if (!viewRef.current) return;
    const currentDoc = viewRef.current.state.doc.toString();
    if (currentDoc === code) return;
    isRemoteUpdateRef.current = true;
    viewRef.current.dispatch({ changes: { from: 0, to: currentDoc.length, insert: code ?? '' } });
  }, [code]);

  return (
    <div className="code-editor-wrapper">
      <div ref={editorRef} className="code-editor" />
      <div ref={cursorOverlayRef} className="cursor-overlay">
        {Object.entries(cursorPositions)
          .filter(([userId]) => userId !== currentUserId)
          .map(([userId, pos]) => (
            <div key={userId} className="remote-cursor-indicator" style={{ top: `${pos.top}px`, left: `${pos.left}px` }}>
              <div className="remote-cursor-line" style={{ backgroundColor: pos.color }} />
              <div className="remote-cursor-label" style={{ backgroundColor: pos.color }}>{pos.username}</div>
            </div>
          ))}
      </div>
    </div>
  );
}
