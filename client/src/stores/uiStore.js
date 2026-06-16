import { create } from 'zustand';
import api from '../services/api';

// ─── Theme Helpers ────────────────────────────────────────────────────────────

/** Apply or remove the .light class on <html> based on selected theme */
const applyThemeClass = (theme) => {
  if (theme === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
};

/** Read saved theme from localStorage (defaults to 'dark') */
const getSavedTheme = () => {
  const saved = localStorage.getItem('sharedspace-theme');
  return saved === 'light' ? 'light' : 'dark';
};

// Apply theme immediately on module evaluation (before React mounts)
applyThemeClass(getSavedTheme());

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUiStore = create((set, get) => ({
  activeModal: null, // 'createSpace' | 'invite' | 'profile' | 'settings' | null
  notifications: [], // Array of { id, type, title, content } (Toast notifications)
  dbNotifications: [], // Array of database notification documents
  theme: getSavedTheme(), // 'dark' | 'light'

  openModal: (modalName) => set({ activeModal: modalName }),
  closeModal: () => set({ activeModal: null }),

  // Add auto-dismissing toast notification
  addNotification: (type, title, content, customId = null) => {
    const id = customId || Math.random().toString(36).substring(2, 9);

    // Deduplicate: skip if a toast with the same ID already exists
    if (get().notifications.some((n) => n.id === id)) {
      console.log('[DEBUG] Toast notification deduplicated, skipping ID:', id);
      return;
    }

    set((state) => ({
      notifications: [...state.notifications, { id, type, title, content }],
    }));

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      get().removeNotification(id);
    }, 4000);
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  // Fetch notifications from database
  fetchDbNotifications: async () => {
    try {
      const res = await api.get('/notifications');

      // Deduplicate by metadata.messageId to avoid duplicate renders
      const uniqueNotifications = [];
      const seenMessageIds = new Set();

      (res.data.notifications || []).forEach((n) => {
        const msgId = n.metadata?.messageId;
        if (msgId) {
          if (!seenMessageIds.has(msgId.toString())) {
            seenMessageIds.add(msgId.toString());
            uniqueNotifications.push(n);
          }
        } else {
          uniqueNotifications.push(n);
        }
      });

      set({ dbNotifications: uniqueNotifications });
    } catch (err) {
      console.error('Failed to fetch notifications from DB:', err.message);
    }
  },

  // Mark notification as read in DB and locally
  markDbNotificationRead: async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      set((state) => ({
        dbNotifications: state.dbNotifications.map((n) =>
          n._id === id ? { ...n, isRead: true } : n
        ),
      }));
    } catch (err) {
      console.error('Failed to update notification read status:', err.message);
    }
  },

  // Clear all notifications
  clearDbNotifications: async () => {
    try {
      await api.delete('/notifications');
      set({ dbNotifications: [] });
    } catch (err) {
      console.error('Failed to clear notifications in DB:', err.message);
    }
  },

  // Set theme explicitly: 'dark' | 'light'
  setTheme: (mode) => {
    if (mode !== 'dark' && mode !== 'light') return;
    localStorage.setItem('sharedspace-theme', mode);
    applyThemeClass(mode);
    set({ theme: mode });
  },

  // Toggle between dark and light
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

}));
