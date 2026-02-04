import { useEffect, useRef } from 'react';
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
export default function CodeEditor({ socket, roomId }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const { code, language, setCode } = useRoomStore();
  const { isReadOnly, setCursor } = useEditorStore();

  /* -------- initialize editor -------- */
  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: code ?? '',
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),

        // ✅ FIX: correct keymap usage
        keymap.of([...defaultKeymap, indentWithTab]),

        getLanguageExtension(language),
        oneDark,
        EditorView.editable.of(!isReadOnly),

        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newCode = update.state.doc.toString();
            setCode(newCode);

            if (socket) {
              clearTimeout(debounceTimerRef.current);
              debounceTimerRef.current = setTimeout(() => {
                socket.emit('code:update', {
                  roomId: roomId,
                  code: newCode,
                  timestamp: Date.now(),
                });
              }, 500);
            }
          }

          const cursor = update.state.selection.main;
          setCursor({ from: cursor.from, to: cursor.to });
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
    };
  }, [language, isReadOnly, socket]);

  /* -------- sync external code updates -------- */
  useEffect(() => {
    if (!viewRef.current) return;

    const currentDoc = viewRef.current.state.doc.toString();
    if (currentDoc === code) return;

    viewRef.current.dispatch({
      changes: {
        from: 0,
        to: currentDoc.length,
        insert: code ?? '',
      },
    });
  }, [code]);

  return <div ref={editorRef} className="code-editor" />;
}
