import { create } from 'zustand';
import api from '../services/api';

export const useSpaceStore = create((set, get) => ({
  spaces: [],
  currentSpace: null,
  loading: false,
  error: null,

  // Fetch all spaces for the current user
  fetchMySpaces: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/spaces');
      set({ spaces: res.data.spaces, loading: false });
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to fetch spaces';
      set({ error: errMsg, loading: false });
    }
  },

  // Fetch detailed information of a single space
  fetchSpaceDetails: async (spaceId) => {
    set({ loading: true, error: null });
    try {
      const res = await api.get(`/spaces/${spaceId}`);
      set({ currentSpace: res.data.space, loading: false });
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to fetch space details';
      set({ error: errMsg, loading: false });
    }
  },

  // Create a new space
  createNewSpace: async (name, description, isPrivate, hasAI) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/spaces', { name, description, isPrivate, hasAI });
      const newSpace = res.data.space;
      
      set((state) => ({
        spaces: [...state.spaces, newSpace],
        loading: false,
      }));
      return { success: true, space: newSpace };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to create space';
      set({ error: errMsg, loading: false });
      return { success: false, error: errMsg };
    }
  },

  // Join an existing space via token
  joinSpaceWithToken: async (token) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post(`/spaces/join/${token}`);
      set({ loading: false });
      // Re-fetch my spaces list to include the newly joined space
      get().fetchMySpaces();
      return { success: true, spaceId: res.data.spaceId, message: res.data.message };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to join space';
      set({ error: errMsg, loading: false });
      return { success: false, error: errMsg };
    }
  },

  // Get or generate invite link for current space
  getInviteLink: async (spaceId, usageLimit) => {
    try {
      const res = await api.post(`/spaces/${spaceId}/invite`, { usageLimit });
      return { success: true, inviteToken: res.data.token, usageLimit: res.data.usageLimit };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to generate invite';
      return { success: false, error: errMsg };
    }
  },

  // Revoke invite link for current space
  revokeInviteLink: async (spaceId) => {
    try {
      const res = await api.post(`/spaces/${spaceId}/invite/revoke`);
      return { success: true, message: res.data.message };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to revoke invite';
      return { success: false, error: errMsg };
    }
  },

  // Regenerate invite link for current space with limit
  regenerateInviteLink: async (spaceId, usageLimit) => {
    try {
      const res = await api.post(`/spaces/${spaceId}/invite/regenerate`, { usageLimit });
      return { success: true, inviteToken: res.data.token, usageLimit: res.data.usageLimit };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to regenerate invite';
      return { success: false, error: errMsg };
    }
  },

  // Update member presence status in current active space (from sockets)
  updateMemberStatus: (userId, status) => {
    const { currentSpace } = get();
    if (!currentSpace || !currentSpace.members) return;

    const updatedMembers = currentSpace.members.map((member) => {
      if (member.user._id.toString() === userId.toString()) {
        return {
          ...member,
          user: { ...member.user, status },
        };
      }
      return member;
    });

    set({
      currentSpace: {
        ...currentSpace,
        members: updatedMembers,
      },
    });
  },

  // Add new member to space list (from socket broadcast when someone joins)
  addMemberToSpace: (spaceId, newMember) => {
    const { currentSpace, spaces } = get();

    // Update spaces list
    const updatedSpaces = spaces.map((s) => {
      if (s._id.toString() === spaceId.toString()) {
        const exists = s.members.some(
          (m) => (m.user?._id || m.user).toString() === newMember.user._id.toString()
        );
        if (!exists) {
          return {
            ...s,
            members: [...s.members, { user: newMember.user._id, role: newMember.role || 'member' }]
          };
        }
      }
      return s;
    });

    set({ spaces: updatedSpaces });

    // Update active space if matches
    if (currentSpace && currentSpace._id.toString() === spaceId.toString()) {
      const exists = currentSpace.members.some(
        (m) => m.user._id.toString() === newMember.user._id.toString()
      );
      if (exists) return;

      set({
        currentSpace: {
          ...currentSpace,
          members: [...currentSpace.members, newMember],
        },
      });
    }
  },

  // Remove member from space list (from socket broadcast when someone leaves)
  removeMemberFromSpace: (spaceId, userId) => {
    const { currentSpace, spaces } = get();

    // Update spaces list
    const updatedSpaces = spaces.map((s) => {
      if (s._id.toString() === spaceId.toString()) {
        return {
          ...s,
          members: s.members.filter(
            (m) => (m.user?._id || m.user).toString() !== userId.toString()
          )
        };
      }
      return s;
    });

    set({ spaces: updatedSpaces });

    // Update active space if matches
    if (currentSpace && currentSpace._id.toString() === spaceId.toString()) {
      set({
        currentSpace: {
          ...currentSpace,
          members: currentSpace.members.filter(
            (m) => (m.user?._id || m.user).toString() !== userId.toString()
          ),
        },
      });
    }
  },

  // Pin a message in the current active space
  pinMessageInSpace: async (messageId) => {
    const { currentSpace } = get();
    if (!currentSpace) return;
    console.log(`[DEBUG] Client calling pinMessage API for Space ID: ${currentSpace._id}, Message ID: ${messageId}`);
    try {
      const res = await api.put(`/spaces/${currentSpace._id}/pin`, { messageId });
      console.log('[DEBUG] pinMessage API response:', res.data);
      if (res.data.success && res.data.space) {
        set({ currentSpace: res.data.space });
        console.log('[DEBUG] Store currentSpace updated successfully with pinned message');
      }
    } catch (err) {
      console.error('[DEBUG] Failed to pin message:', err.message);
    }
  },

  // Unpin a message from the current active space
  unpinMessageInSpace: async (messageId) => {
    const { currentSpace } = get();
    if (!currentSpace) return;
    console.log(`[DEBUG] Client calling unpinMessage API for Space ID: ${currentSpace._id}, Message ID: ${messageId}`);
    try {
      const res = await api.put(`/spaces/${currentSpace._id}/unpin`, { messageId });
      console.log('[DEBUG] unpinMessage API response:', res.data);
      if (res.data.success && res.data.space) {
        set({ currentSpace: res.data.space });
        console.log('[DEBUG] Store currentSpace updated successfully with unpinned message');
      }
    } catch (err) {
      console.error('[DEBUG] Failed to unpin message:', err.message);
    }
  },

  // Add pinned message locally (from socket message_pinned)
  addPinnedMessageLocally: (message) => {
    const { currentSpace } = get();
    if (!currentSpace) return;
    console.log(`[DEBUG] addPinnedMessageLocally store action triggered for Message ID: ${message._id}`);

    const exists = (currentSpace.pinnedMessages || []).some((m) => {
      if (!m) return false;
      const mId = m._id ? m._id.toString() : m.toString();
      return mId === message._id.toString();
    });
    
    if (exists) {
      console.log(`[DEBUG] Message ${message._id} is already in local pinned list. Skipping.`);
      return;
    }

    set({
      currentSpace: {
        ...currentSpace,
        pinnedMessages: [...(currentSpace.pinnedMessages || []), message],
      },
    });
    console.log(`[DEBUG] Message ${message._id} added to local pinnedMessages store`);
  },

  // Remove pinned message locally (from socket message_unpinned)
  removePinnedMessageLocally: (messageId) => {
    const { currentSpace } = get();
    if (!currentSpace) return;
    console.log(`[DEBUG] removePinnedMessageLocally store action triggered for Message ID: ${messageId}`);

    set({
      currentSpace: {
        ...currentSpace,
        pinnedMessages: (currentSpace.pinnedMessages || []).filter((m) => {
          if (!m) return false;
          const mId = m._id ? m._id.toString() : m.toString();
          return mId !== messageId.toString();
        }),
      },
    });
    console.log(`[DEBUG] Message ${messageId} removed from local pinnedMessages store`);
  },

  // Leave space/workspace
  leaveSpace: async (spaceId) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/spaces/${spaceId}/leave`);
      set({ loading: false });
      // Re-fetch my spaces list
      get().fetchMySpaces();
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to leave space';
      set({ error: errMsg, loading: false });
      return { success: false, error: errMsg };
    }
  },

  // Delete space/workspace completely (owner only)
  deleteSpace: async (spaceId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/spaces/${spaceId}`);
      set({ loading: false });
      // Re-fetch my spaces list
      get().fetchMySpaces();
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to delete space';
      set({ error: errMsg, loading: false });
      return { success: false, error: errMsg };
    }
  },

  // Reset active space
  clearCurrentSpace: () => set({ currentSpace: null }),
}));
