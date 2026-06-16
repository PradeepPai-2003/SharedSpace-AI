import { create } from 'zustand';
import api, { API_URL } from '../services/api';
import { getSocket } from '../services/socket';

export const useMessageStore = create((set, get) => ({
  messages: [],
  starredMessages: [],
  typingUsers: [], // Array of usernames currently typing
  aiChatHistory: [],
  aiLoading: false,
  loading: false,
  error: null,

  // Fetch space message history with pagination
  fetchMessages: async (spaceId, before = null) => {
    set({ loading: true, error: null });
    try {
      const url = `/messages/${spaceId}${before ? `?before=${before}` : ''}`;
      const res = await api.get(url);
      
      set((state) => ({
        // If loading older messages (before is provided), prepend them. Else, replace messages list.
        messages: before ? [...res.data.messages, ...state.messages] : res.data.messages,
        loading: false,
      }));
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to retrieve messages';
      set({ error: errMsg, loading: false });
    }
  },

  // Append new message (from socket event new_message)
  addMessage: (message) => {
    const { messages } = get();
    console.log('[DEBUG] Zustand addMessage called with msg ID:', message._id, 'current count:', messages.length);
    // Avoid double appending
    if (messages.some((m) => m._id.toString() === message._id.toString())) {
      console.log('[DEBUG] addMessage: message already exists in store, ignoring');
      return;
    }

    set({
      messages: [...messages, message],
    });
    console.log('[DEBUG] Zustand store updated, new count:', get().messages.length);
  },

  // Soft delete message on local state
  removeMessageLocally: (messageId, hardDelete = false) => {
    const { messages } = get();
    if (hardDelete) {
      set({ messages: messages.filter((m) => m._id.toString() !== messageId.toString()) });
      return;
    }
    const updatedMessages = messages.map((m) => {
      if (m._id.toString() === messageId.toString()) {
        return {
          ...m,
          isDeleted: true,
          content: 'This message was deleted.',
          fileUrl: '',
          fileName: '',
          fileSize: null,
        };
      }
      return m;
    });

    set({ messages: updatedMessages });
  },

  setTypingStatus: (username, isTyping) => {
    if (username === 'AI Assistant') return;
    const { typingUsers } = get();
    
    if (isTyping) {
      if (!typingUsers.includes(username)) {
        set({ typingUsers: [...typingUsers, username] });
      }
    } else {
      set({ typingUsers: typingUsers.filter((u) => u !== username) });
    }
  },

  // Send message over socket connection
  sendMessage: (spaceId, content, type = 'text', fileUrl = '', fileName = '', fileSize = null, replyTo = null) => {
    const socket = getSocket();
    console.log('[DEBUG] sendMessage triggered, socket status:', socket ? (socket.connected ? 'CONNECTED' : 'DISCONNECTED') : 'NULL');
    if (!socket || !socket.connected) {
      console.error('Socket not connected. Cannot send message.');
      return false;
    }

    console.log('[DEBUG] Client emitting send_message event for space:', spaceId);
    socket.emit('send_message', {
      spaceId,
      content,
      type,
      fileUrl,
      fileName,
      fileSize,
      replyTo,
    });
    return true;
  },

  // React to a message
  sendReaction: (messageId, emoji) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit('add_reaction', { messageId, emoji });
  },

  // Remove reaction from a message
  removeReaction: (messageId, emoji) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    socket.emit('remove_reaction', { messageId, emoji });
  },

  // Update reactions locally in message list (from socket reaction_updated)
  updateMessageReactions: (messageId, reactions) => {
    const { messages } = get();
    const updated = messages.map((msg) => {
      if (msg._id.toString() === messageId.toString()) {
        return { ...msg, reactions };
      }
      return msg;
    });
    set({ messages: updated });
  },

  // Update message content locally for live streaming chunks
  updateMessageContentLocally: (messageId, content, isStreaming = true) => {
    const { messages } = get();
    const updated = messages.map((msg) => {
      if (msg._id.toString() === messageId.toString()) {
        return { ...msg, content, isStreaming };
      }
      return msg;
    });
    set({ messages: updated });
  },

  // Fetch 1-to-1 AI Chat History
  fetchAIChatHistory: async (userId) => {
    set({ loading: true, error: null });
    try {
      const res = await api.get(`/ai/memory/${userId}`);
      set({
        aiChatHistory: res.data.memory?.messages || [],
        loading: false,
      });
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to fetch AI chat history';
      set({ error: errMsg, loading: false });
    }
  },

  // Send message to 1-to-1 AI assistant
  sendMessageToAI: async (messageText) => {
    set({ aiLoading: true, error: null });
    
    // 1. Add user message optimistically
    const userMsg = { role: 'user', content: messageText, timestamp: new Date() };
    // 2. Add an empty model placeholder message for streaming
    const placeholderMsg = { role: 'model', content: '', timestamp: new Date(), isStreaming: true };
    
    set((state) => ({
      aiChatHistory: [...state.aiChatHistory, userMsg, placeholderMsg],
    }));

    try {
      const token = localStorage.getItem('token');
      console.log(`[CLIENT-AI] Initiating POST request to /ai/chat/stream. Prompt: "${messageText}"`);
      const response = await fetch(`${API_URL}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: messageText })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        console.error(`[CLIENT-AI] Stream HTTP Error: ${response.status}`, errJson);
        throw new Error(errJson.message || `Server responded with status ${response.status}`);
      }

      console.log(`[CLIENT-AI] HTTP 200 response received. Obtaining reader stream...`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let buffer = '';
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log(`[CLIENT-AI] Stream reader finished (done: true).`);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last partial line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') {
              console.log(`[CLIENT-AI] Server sent [DONE] indicator.`);
              break;
            }

            try {
              const dataObj = JSON.parse(dataStr);
              if (dataObj.error) {
                console.error(`[CLIENT-AI] SSE returned error payload:`, dataObj.error);
                throw new Error(dataObj.error);
              }
              if (dataObj.chunk) {
                chunkCount++;
                accumulatedText += dataObj.chunk;
                console.log(`[CLIENT-AI] Parsed chunk #${chunkCount}: "${dataObj.chunk.substring(0, 15)}..." | Accumulated length: ${accumulatedText.length}`);
                
                // Update text dynamically & hide bouncing dots since we have text
                set((state) => {
                  const history = [...state.aiChatHistory];
                  if (history.length > 0) {
                    history[history.length - 1] = {
                      ...history[history.length - 1],
                      content: accumulatedText,
                      isStreaming: true
                    };
                  }
                  return { aiChatHistory: history, aiLoading: false };
                });
              }
            } catch (jsonErr) {
              console.warn('Failed to parse SSE data block:', dataStr, jsonErr);
            }
          }
        }
      }

      // Finalize the streaming message
      set((state) => {
        const history = [...state.aiChatHistory];
        if (history.length > 0) {
          history[history.length - 1] = {
            ...history[history.length - 1],
            content: accumulatedText,
            isStreaming: false
          };
        }
        return { aiChatHistory: history, aiLoading: false };
      });

      return { success: true };
    } catch (err) {
      const errMsg = err.message || 'AI assistant failed to respond';
      
      // Update history with error or cleanup placeholder if completely empty
      set((state) => {
        const history = [...state.aiChatHistory];
        if (history.length > 0) {
          history[history.length - 1] = {
            ...history[history.length - 1],
            content: `AI Assistant is temporarily unavailable. Please try again. (Error: ${errMsg})`,
            isStreaming: false
          };
        }
        return { aiChatHistory: history, aiLoading: false, error: errMsg };
      });
      return { success: false, error: errMsg };
    }
  },

  // Instantly clear local messages state and append system message
  clearChatState: (systemMessage) => {
    set({
      messages: systemMessage ? [systemMessage] : [],
    });
  },

  // Clear space chat history for current user only
  clearChatForUser: async (spaceId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/messages/clear/${spaceId}`);
      set({ messages: [], loading: false });
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to clear chat';
      set({ error: errMsg, loading: false });
      return { success: false, error: errMsg };
    }
  },

  // Clear AI memory logs
  clearAIChatHistory: async (userId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/ai/memory/${userId}`);
      set({ aiChatHistory: [], loading: false });
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to clear memory';
      set({ error: errMsg, loading: false });
      return { success: false, error: errMsg };
    }
  },

  // Toggle personal pin/star status of a message
  togglePinMessage: async (messageId) => {
    try {
      const res = await api.put(`/messages/${messageId}/pin`);
      
      // Update local message list state if active
      const { messages } = get();
      const updatedMessages = messages.map((m) => {
        if (m._id.toString() === messageId.toString()) {
          return {
            ...m,
            pinnedByUsers: res.data.message.pinnedByUsers
          };
        }
        return m;
      });
      set({ messages: updatedMessages });
      
      // Also update starredMessages list if loaded
      const { starredMessages } = get();
      if (res.data.isPinned) {
        // Starred Messages view expects populated sender and space properties
        // We can reload the starred list to be safe, or just toggle
        get().fetchStarredMessages();
      } else {
        set({ starredMessages: starredMessages.filter((m) => m._id.toString() !== messageId.toString()) });
      }

      return { success: true, isPinned: res.data.isPinned };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to toggle pin status';
      return { success: false, error: errMsg };
    }
  },

  // Fetch all user starred/pinned messages
  fetchStarredMessages: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/messages/starred');
      set({ starredMessages: res.data.messages, loading: false });
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to fetch starred messages';
      set({ error: errMsg, loading: false });
    }
  },
}));
