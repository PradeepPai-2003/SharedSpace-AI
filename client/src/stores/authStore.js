import { create } from 'zustand';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: false,
  loading: true,
  error: null,

  // Register user
  registerUser: async (username, email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/auth/register', { username, email, password });
      const { token, user } = res.data;

      localStorage.setItem('token', token);
      connectSocket(token);

      set({
        token,
        user,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Registration failed';
      set({ error: errMsg, loading: false });
      return { success: false, error: errMsg };
    }
  },

  // Login user
  loginUser: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;

      localStorage.setItem('token', token);
      connectSocket(token);

      set({
        token,
        user,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Login failed';
      set({ error: errMsg, loading: false });
      return { success: false, error: errMsg };
    }
  },

  // Logout user
  logoutUser: async () => {
    set({ loading: true });
    try {
      // Inform server to set status offline
      await api.post('/auth/logout');
    } catch (err) {
      console.warn('Backend logout status update failed', err);
    } finally {
      localStorage.removeItem('token');
      disconnectSocket();

      set({
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      });
    }
  },

  // Check auth status on initialization
  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ loading: false, isAuthenticated: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const res = await api.get('/auth/me');
      connectSocket(token);

      set({
        user: res.data.user,
        isAuthenticated: true,
        loading: false,
      });
    } catch (err) {
      console.error('Session restoration failed:', err.message);
      localStorage.removeItem('token');
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        loading: false,
      });
    }
  },

  // Update profile updates
  updateProfile: async (displayName, bio, avatar, status) => {
    const { user } = get();
    if (!user) return { success: false, error: 'Not logged in' };

    set({ loading: true, error: null });
    try {
      const res = await api.put(`/users/${user._id}`, { displayName, bio, avatar, status });
      
      set({
        user: res.data.user,
        loading: false,
      });
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to update profile';
      set({ error: errMsg, loading: false });
      return { success: false, error: errMsg };
    }
  },

  // Clear errors manually
  clearError: () => set({ error: null }),
}));
