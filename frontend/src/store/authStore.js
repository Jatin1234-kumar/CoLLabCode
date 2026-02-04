import { create } from 'zustand';
import * as storage from '../utils/storage.js';

export const useAuthStore = create((set) => ({
  user: storage.getUser(),
  token: storage.getToken(),
  isLoading: false,
  error: null,

  setUser: (user) => {
    storage.setUser(user);
    set({ user });
  },

  setToken: (token) => {
    storage.setToken(token);
    set({ token });
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  login: (user, token) => {
    storage.setUser(user);
    storage.setToken(token);
    set({ user, token, error: null });
  },

  logout: () => {
    storage.clearAll();
    set({ user: null, token: null, error: null });
  },
}));
