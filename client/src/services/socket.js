import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

/**
 * Connect to the Socket.IO server.
 * 
 * @param {string} token - User's JWT token for authentication
 * @returns {object} - Connected socket instance
 */
export const connectSocket = (token) => {
  if (socket) {
    if (!socket.connected) {
      socket.auth = { token };
      socket.connect();
    }
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    transports: ['polling', 'websocket'], // Allow both polling and websocket upgrade for reliability
    autoConnect: false,
  });

  socket.connect();

  socket.on('connect', () => {
    console.log('Socket.IO connection established with ID:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error.message);
  });

  return socket;
};

/**
 * Disconnect socket from the server.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    console.log('Socket.IO disconnected.');
    socket = null;
  }
};

/**
 * Get active socket instance.
 */
export const getSocket = () => socket;
