import { create } from 'zustand';

// Color palette for user cursors - modern, harmonious colors for dark theme
const USER_COLORS = [
  '#64B5F6',  // Blue
  '#81C784',  // Soft Green
  '#FFB74D',  // Orange
  '#E57373',  // Soft Red
  '#BA68C8',  // Purple
  '#4DD0E1',  // Cyan
  '#AED581',  // Lime Green
  '#FF8A65',  // Deep Orange
  '#64B5F6',  // Sky Blue
  '#F48FB1',  // Pink
];

// Generate a consistent color for a user based on userId
const getUserColor = (userId) => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return USER_COLORS[hash % USER_COLORS.length];
};

export const useEditorStore = create((set) => ({
  cursor: { line: 0, ch: 0 },
  remoteCursors: {}, // { userId: { position: number, line: number, username: string, color: string, lastUpdateTime: number } }
  isReadOnly: false,
  lastSyncTime: 0,

  setCursor: (cursor) => set({ cursor }),
  
  setRemoteCursor: (userId, position, username) =>
    set((state) => ({
      remoteCursors: {
        ...state.remoteCursors,
        [userId]: {
          position,
          username,
          color: getUserColor(userId),
          lastUpdateTime: Date.now(),
        },
      },
    })),
  
  updateRemoteCursor: (userId, position, username) =>
    set((state) => ({
      remoteCursors: {
        ...state.remoteCursors,
        [userId]: {
          position,
          username,
          color: getUserColor(userId),
          lastUpdateTime: Date.now(),
        },
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

  // Remove cursors that haven't been updated recently (user stopped typing)
  removeStaleRemoteCursors: (maxAgeMs = 250) =>
    set((state) => {
      const now = Date.now();
      const newCursors = {};
      Object.entries(state.remoteCursors).forEach(([userId, cursor]) => {
        if (now - (cursor.lastUpdateTime || 0) < maxAgeMs) {
          newCursors[userId] = cursor;
        }
      });
      return { remoteCursors: newCursors };
    }),
}));
