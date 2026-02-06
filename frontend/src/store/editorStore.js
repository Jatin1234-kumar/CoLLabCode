import { create } from 'zustand';

export const useEditorStore = create((set) => ({
  cursor: { line: 0, ch: 0 },
  remoteCursors: {},
  isReadOnly: false,
  lastSyncTime: 0,

  setCursor: (cursor) => set({ cursor }),
  setRemoteCursor: (userId, position) =>
    set((state) => ({
      remoteCursors: {
        ...state.remoteCursors,
        [userId]: position,
      },
    })),
  removeRemoteCursor: (userId) =>
    set((state) => {
      const newCursors = { ...state.remoteCursors };
      delete newCursors[userId];
      return { remoteCursors: newCursors };
    }),
  setReadOnly: (isReadOnly) => set({ isReadOnly }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),

  clearRemoteCursors: () => set({ remoteCursors: {} }),
}));
