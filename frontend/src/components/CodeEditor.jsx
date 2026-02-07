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

/* ------------------ language helper ------------------ */
const getLanguageExtension = (language) => {
  const extensions = {
    javascript,
    typescript: javascript,
    python,
    java,
    cpp,
    csharp: cpp,
    html,
    css,
    sql,
    php: javascript,
    ruby: javascript,
    go: javascript,
    rust: javascript,
  };

  return (extensions[language] || javascript)();
};

/* ------------------ component ------------------ */
export default function CodeEditor({ socket, roomId, currentUserId }) {
  const editorRef = useRef(null);
  const cursorOverlayRef = useRef(null);
  const viewRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const cursorThrottleRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingStartedRef = useRef(false); // Track if we've already sent typing:start
  const isRemoteUpdateRef = useRef(false);
  const [cursorPositions, setCursorPositions] = useState({});
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set()); // Track who is typing in room

  const { code, language, setCode } = useRoomStore();
  const { isReadOnly, setCursor, remoteCursors, setRemoteCursor, removeRemoteCursor, removeStaleRemoteCursors } = useEditorStore();

  /* -------- handle incoming cursor updates -------- */
  useEffect(() => {
    if (!socket) {
      console.log('⚠️ CodeEditor: No socket available');
      return;
    }

    const handleCursorUpdated = (data) => {
      const { userId, username, position, line } = data;
      console.log(`📨 Received cursor from ${username} - position: ${position}, line: ${line}`);
      setRemoteCursor(userId, position, username);
    };

    const handleUserDisconnected = (data) => {
      console.log(`❌ CodeEditor: User disconnected:`, data.userId);
      const { userId } = data;
      removeRemoteCursor(userId);
    };

    const handleUserLeft = (data) => {
      console.log(`👋 CodeEditor: User left:`, data.userId);
      const { userId } = data;
      removeRemoteCursor(userId);
    };

    const handleUserTypingStarted = (data) => {
      const { userId, username } = data;
      console.log(`✍️ ${username} started typing`);
      setTypingUsers((prev) => {
        const updated = new Set(prev);
        updated.add(userId);
        return updated;
      });
    };

    const handleUserTypingStopped = (data) => {
      const { userId, username } = data;
      console.log(`⏸️ ${username} stopped typing`);
      setTypingUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(userId);
        return updated;
      });
      // Keep their last cursor position visible for a moment
    };

    socket.on('cursor:updated', handleCursorUpdated);
    socket.on('user:disconnected', handleUserDisconnected);
    socket.on('user:left', handleUserLeft);
    socket.on('user:typing:started', handleUserTypingStarted);
    socket.on('user:typing:stopped', handleUserTypingStopped);

    return () => {
      socket.off('cursor:updated', handleCursorUpdated);
      socket.off('user:disconnected', handleUserDisconnected);
      socket.off('user:left', handleUserLeft);
      socket.off('user:typing:started', handleUserTypingStarted);
      socket.off('user:typing:stopped', handleUserTypingStopped);
    };
  }, [socket, setRemoteCursor, removeRemoteCursor]);

  /* -------- emit typing state changes to others -------- */
  useEffect(() => {
    if (!socket) return;

    if (isUserTyping) {
      socket.emit('typing:start', { roomId });
    } else {
      socket.emit('typing:stop', { roomId });
    }
  }, [isUserTyping, socket, roomId]);

  /* -------- clean up stale cursor positions -------- */
  useEffect(() => {
    // Clean up cursors that haven't been updated recently (user is idle)
    const cleanupInterval = setInterval(() => {
      removeStaleRemoteCursors(350); // Remove cursors not updated for 350ms (matches typing idle)
    }, 100); // Run cleanup every 100ms for snappier removal

    return () => clearInterval(cleanupInterval);
  }, [removeStaleRemoteCursors]);

  /* -------- update cursor overlay positions -------- */
  useEffect(() => {
    if (!viewRef.current || !cursorOverlayRef.current) return;

   const newCursorPositions = {};
   const wrapperRect = cursorOverlayRef.current.parentElement.getBoundingClientRect();
   const view = viewRef.current;
   
   Object.entries(remoteCursors).forEach(([userId, cursorData]) => {
     if (cursorData && cursorData.position !== undefined) {
       const position = Math.min(cursorData.position, view.state.doc.length);
       
       try {
         let coords = view.coordsAtPos(position);

         if (coords) {
           const top = coords.top - wrapperRect.top;
           const left = coords.left - wrapperRect.left;
           // Only show if coordinates are reasonable
           if (top >= -50 && top <= wrapperRect.height + 50 && left >= -50 && left <= wrapperRect.width + 50) {
             newCursorPositions[userId] = {
               top,
               left,
               username: cursorData.username,
               color: cursorData.color,
             };
           }
         }
       } catch (e) {
         // Silently ignore
       }
     }
   });
   
   setCursorPositions(newCursorPositions);
  }, [remoteCursors]);

  /* -------- listen to scroll events to update cursor positions -------- */
  useEffect(() => {
    if (!viewRef.current || !cursorOverlayRef.current) return;

    const scrollDOM = viewRef.current.scrollDOM;
    if (!scrollDOM) return;

    const handleScroll = () => {
      if (!viewRef.current || !cursorOverlayRef.current) return;

      const newCursorPositions = {};
      const wrapperRect = cursorOverlayRef.current.parentElement.getBoundingClientRect();

      Object.entries(remoteCursors).forEach(([userId, cursorData]) => {
        if (cursorData && cursorData.position !== undefined) {
          try {
            const coords = viewRef.current.coordsAtPos(cursorData.position);
            if (coords) {
              const top = coords.top - wrapperRect.top;
              const left = coords.left - wrapperRect.left;
              
              newCursorPositions[userId] = {
                top,
                left,
                username: cursorData.username,
                color: cursorData.color,
              };
            }
          } catch (e) {
            // Ignore scroll errors silently
          }
        }
      });

      setCursorPositions(newCursorPositions);
    };

    scrollDOM.addEventListener('scroll', handleScroll);
    return () => {
      scrollDOM.removeEventListener('scroll', handleScroll);
    };
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

            if (isRemoteUpdateRef.current) {
              isRemoteUpdateRef.current = false;
              return;
            }

            // ⚡ IMMEDIATE: Set typing state right away (no delay)
            if (!typingStartedRef.current) {
              setIsUserTyping(true);
              typingStartedRef.current = true;
            }

            // Clear previous typing timeout
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }

            // Set timeout to mark user as idle after 400ms of NO changes
            typingTimeoutRef.current = setTimeout(() => {
              setIsUserTyping(false);
              typingStartedRef.current = false;
            }, 400);

            setCode(newCode);

            if (socket) {
              clearTimeout(debounceTimerRef.current);
              debounceTimerRef.current = setTimeout(() => {
                console.log('📤 CodeEditor: Emitting code:update event');
                socket.emit('code:update', {
                  roomId: roomId,
                  code: newCode,
                  timestamp: Date.now(),
                });
              }, 500);
            }
          }

          // 🔴 CURSOR TRACKING: Emit cursor position updates VERY FREQUENTLY
          const cursor = update.state.selection.main;
          const position = cursor.from;
          const line = update.state.doc.lineAt(position).number;

          setCursor({ from: cursor.from, to: cursor.to, line });

          // Aggressive throttle: only wait 50ms between cursor updates
          if (socket && !isRemoteUpdateRef.current) {
            const now = Date.now();
            const lastUpdate = cursorThrottleRef.current || 0;

            if (now - lastUpdate > 50) {
              cursorThrottleRef.current = now;
              socket.emit('cursor:update', {
                roomId: roomId,
                position: position,
                line: line,
              });
            }
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      // Clean up typing timeout on unmount
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [language, isReadOnly, socket, roomId, setCode, setCursor]);

  /* -------- sync external code updates -------- */
  useEffect(() => {
    if (!viewRef.current) return;

    const currentDoc = viewRef.current.state.doc.toString();
    if (currentDoc === code) return;

    isRemoteUpdateRef.current = true;
    viewRef.current.dispatch({
      changes: {
        from: 0,
        to: currentDoc.length,
        insert: code ?? '',
      },
    });
  }, [code]);

  return (
    <div className="code-editor-wrapper">
      <div ref={editorRef} className="code-editor" />
      
      {/* Cursor overlay */}
      <div ref={cursorOverlayRef} className="cursor-overlay">
        {Object.entries(cursorPositions)
          .filter(([userId]) => userId !== currentUserId)
          .map(([userId, pos]) => (
              <div
                key={userId}
                className="remote-cursor-indicator"
                style={{
                  top: `${pos.top}px`,
                  left: `${pos.left}px`,
                }}
              >
                <div 
                  className="remote-cursor-line"
                  style={{ backgroundColor: pos.color }}
                />
                <div 
                  className="remote-cursor-label"
                  style={{ backgroundColor: pos.color }}
                >
                  {pos.username}
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}
