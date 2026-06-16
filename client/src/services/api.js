import axios from 'axios';

// Resolve the API base URL, always ensuring it ends with /api.
// This makes the app resilient to VITE_API_URL being set with or without the /api suffix.
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
