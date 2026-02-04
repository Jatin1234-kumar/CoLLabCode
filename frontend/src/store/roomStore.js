import { create } from 'zustand';

export const useRoomStore = create((set) => ({
  currentRoom: null,
  rooms: [],
  isLoading: false,
  error: null,
  code: '',
  language: 'javascript',
  participants: [],
  joinRequests: [],
  versions: [],
  theme: localStorage.getItem('editorTheme') || 'one-dark',

  setCurrentRoom: (room) => set({ currentRoom: room }),
  setRooms: (rooms) => set({ rooms }),
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setParticipants: (participants) => set({ participants }),
  setJoinRequests: (joinRequests) => set({ joinRequests }),
  setVersions: (versions) => set({ versions }),
  setTheme: (theme) => {
    localStorage.setItem('editorTheme', theme);
    set({ theme });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants, participant],
    })),

  removeParticipant: (userId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.userId !== userId),
    })),

  updateParticipantRole: (userId, newRole) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.userId === userId ? { ...p, role: newRole } : p
      ),
    })),

  addVersion: (version) =>
    set((state) => ({
      versions: [version, ...state.versions],
    })),

  reset: () =>
    set({
      currentRoom: null,
      code: '',
      participants: [],
      joinRequests: [],
      versions: [],
      error: null,
    }),
}));
