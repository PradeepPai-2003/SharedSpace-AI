import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../stores/authStore';
import { useSpaceStore } from '../stores/spaceStore';
import { useMessageStore } from '../stores/messageStore';
import { useUiStore } from '../stores/uiStore';

import { getSocket } from '../services/socket';
import { UserPlus, Users, Send, Smile, Paperclip, Trash2, ArrowLeft, Pin, FileText, CornerUpLeft, ChevronRight, ChevronLeft, Shield, X, MessageSquare, MoreVertical, Settings, LogOut, Star, AlertCircle, Sparkles, Bot, Play } from 'lucide-react';
import api from '../services/api';
import MediaViewer from '../components/MediaViewer';

const TypingDots = () => {
  const [dotsCount, setDotsCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotsCount((prev) => (prev % 3) + 1);
    }, 333);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 py-2 px-1 select-none min-h-[24px]">
      <span className="w-2 h-2 rounded-full bg-accent-ai transition-opacity duration-300" style={{ opacity: dotsCount >= 1 ? 1 : 0 }} />
      <span className="w-2 h-2 rounded-full bg-accent-ai transition-opacity duration-300" style={{ opacity: dotsCount >= 2 ? 1 : 0 }} />
      <span className="w-2 h-2 rounded-full bg-accent-ai transition-opacity duration-300" style={{ opacity: dotsCount >= 3 ? 1 : 0 }} />
    </div>
  );
};

const Space = () => {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
    }))
  );
  const { currentSpace, fetchSpaceDetails, clearCurrentSpace, getInviteLink, revokeInviteLink, regenerateInviteLink, addMemberToSpace, pinMessageInSpace, unpinMessageInSpace, leaveSpace, deleteSpace } = useSpaceStore(
    useShallow((state) => ({
      currentSpace: state.currentSpace,
      fetchSpaceDetails: state.fetchSpaceDetails,
      clearCurrentSpace: state.clearCurrentSpace,
      getInviteLink: state.getInviteLink,
      revokeInviteLink: state.revokeInviteLink,
      regenerateInviteLink: state.regenerateInviteLink,
      addMemberToSpace: state.addMemberToSpace,
      pinMessageInSpace: state.pinMessageInSpace,
      unpinMessageInSpace: state.unpinMessageInSpace,
      leaveSpace: state.leaveSpace,
      deleteSpace: state.deleteSpace,
    }))
  );
  const { messages, fetchMessages, sendMessage, addMessage, removeMessageLocally, typingUsers, sendReaction, removeReaction, clearChatState, clearChatForUser, togglePinMessage } = useMessageStore(
    useShallow((state) => ({
      messages: state.messages,
      fetchMessages: state.fetchMessages,
      sendMessage: state.sendMessage,
      addMessage: state.addMessage,
      removeMessageLocally: state.removeMessageLocally,
      typingUsers: state.typingUsers,
      sendReaction: state.sendReaction,
      removeReaction: state.removeReaction,
      clearChatState: state.clearChatState,
      clearChatForUser: state.clearChatForUser,
      togglePinMessage: state.togglePinMessage,
    }))
  );
  const { addNotification } = useUiStore(
    useShallow((state) => ({
      addNotification: state.addNotification,
    }))
  );


  console.log('[DEBUG] Space component render, spaceId:', spaceId, 'messages count:', messages.length);

  const [messageText, setMessageText] = useState('');
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showClearChatModal, setShowClearChatModal] = useState(false);
  const [showLeaveSpaceModal, setShowLeaveSpaceModal] = useState(false);
  const [showDeleteSpaceModal, setShowDeleteSpaceModal] = useState(false);
  const [showSpaceSettingsModal, setShowSpaceSettingsModal] = useState(false);
  const [deleteSpaceConfirmName, setDeleteSpaceConfirmName] = useState('');
  const [showUnsupportedModal, setShowUnsupportedModal] = useState(false);
  const [activeMediaViewer, setActiveMediaViewer] = useState(null);
  const [inviteLimit, setInviteLimit] = useState(5);

  const [selectedMsgActions, setSelectedMsgActions] = useState(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleBubbleClick = (msg) => {
    if (windowWidth < 1024) {
      setSelectedMsgActions(msg);
    }
  };
  
  // Refs
  const messageEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch space details and message history on load/params-change
  useEffect(() => {
    if (spaceId) {
      console.log('[DEBUG] Space.jsx useEffect params-change, spaceId:', spaceId);
      fetchSpaceDetails(spaceId);
      fetchMessages(spaceId);

      // Join socket room
      const socket = getSocket();
      if (socket) {
        console.log('[DEBUG] Space.jsx emitting join_space for spaceId:', spaceId, 'socket connected:', socket.connected);
        socket.emit('join_space', { spaceId });
      } else {
        console.warn('[DEBUG] Space.jsx: getSocket() returned null on mount');
      }
    }

    return () => {
      // Leave socket room
      const socket = getSocket();
      if (socket && spaceId) {
        console.log('[DEBUG] Space.jsx leaving space room:', spaceId);
        socket.emit('leave_space', { spaceId });
      }
      clearCurrentSpace();
    };
  }, [spaceId, fetchSpaceDetails, fetchMessages, clearCurrentSpace]);

  // Handle re-joining the space room on socket connection/reconnection
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      console.warn('[DEBUG] Space.jsx reconnect effect: no socket found');
      return;
    }

    const handleConnect = () => {
      console.log('[DEBUG] Space.jsx socket connect event fired, re-emitting join_space for spaceId:', spaceId);
      if (spaceId) {
        socket.emit('join_space', { spaceId });
      }
    };

    // Join room immediately if already connected
    if (socket.connected && spaceId) {
      console.log('[DEBUG] Space.jsx socket already connected on mount, emitting join_space for spaceId:', spaceId);
      socket.emit('join_space', { spaceId });
    }

    socket.on('connect', handleConnect);
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [spaceId]);

  // Scroll to bottom when messages arrive
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  // Listen for socket events specific to space updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Handle space membership list updates
    socket.on('user_joined_space', ({ user: newUser }) => {
      addMemberToSpace(spaceId, { user: newUser, role: 'member', joinedAt: new Date() });
      addNotification('info', 'New Member Joined', `${newUser.username} joined the space.`);
    });

    return () => {
      socket.off('user_joined_space');
    };
  }, [spaceId, addMemberToSpace, addNotification]);

  if (!currentSpace) {
    return (
      <div className="flex-grow flex items-center justify-center bg-background-primary h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-accent-primary border-t-transparent animate-spin" />
          <p className="text-xs text-text-secondary">Loading collaboration space...</p>
        </div>
      </div>
    );
  }

  // Handle typing emitters
  const handleInputChange = (e) => {
    setMessageText(e.target.value);
    
    // Auto-grow height for textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
    
    const socket = getSocket();
    if (!socket) return;

    if (e.target.value.trim().length > 0) {
      socket.emit('typing_start', { spaceId });
    } else {
      socket.emit('typing_stop', { spaceId });
    }
  };

  // Keyboard controls for textarea (Enter to Send, Shift+Enter for newline)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Handle Send Message
  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim()) return;

    const content = messageText.trim();
    sendMessage(spaceId, content, 'text', '', '', null, replyingTo ? replyingTo._id : null);
    setMessageText('');
    setReplyingTo(null);

    // Reset height of textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    // Emit typing stop
    const socket = getSocket();
    if (socket) {
      socket.emit('typing_stop', { spaceId });
    }
    inputRef.current?.focus();
  };

  // Handle Reply With AI
  const handleReplyWithAI = async (messageId) => {
    addNotification('info', 'AI Assistant', 'AI is composing a reply to this message...');
    try {
      await api.post(`/messages/${messageId}/reply-with-ai`);
    } catch (err) {
      console.error(err);
      addNotification('error', 'AI Reply Failed', err.response?.data?.message || 'Failed to trigger AI reply.');
    }
  };

  // Handle invite links creation
  const handleInviteClick = async () => {
    const res = await getInviteLink(spaceId);
    if (res.success) {
      setInviteToken(res.inviteToken);
      setInviteLimit(res.usageLimit !== undefined ? res.usageLimit : 5);
      setShowInviteModal(true);
    } else {
      addNotification('error', 'Invite Link Error', res.error);
    }
  };

  const handleLimitChange = async (e) => {
    const newLimit = parseInt(e.target.value);
    setInviteLimit(newLimit);
    const res = await getInviteLink(spaceId, newLimit);
    if (res.success) {
      setInviteToken(res.inviteToken);
      addNotification('success', 'Limit Updated', `Member limit updated to ${newLimit} members.`);
    } else {
      addNotification('error', 'Update Failed', res.error);
    }
  };

  const handleRevokeClick = async () => {
    const res = await revokeInviteLink(spaceId);
    if (res.success) {
      setInviteToken('');
      addNotification('success', 'Revoked', 'Invite link successfully revoked.');
    } else {
      addNotification('error', 'Revocation Failed', res.error);
    }
  };

  const handleRegenerateClick = async () => {
    const res = await regenerateInviteLink(spaceId, inviteLimit);
    if (res.success) {
      setInviteToken(res.inviteToken);
      addNotification('success', 'Regenerated', 'A new, unique invite link has been generated.');
    } else {
      addNotification('error', 'Regeneration Failed', res.error);
    }
  };

  // Copy invite link to clipboard
  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/join/${inviteToken}`;
    navigator.clipboard.writeText(inviteLink);
    addNotification('success', 'Copied Link', 'Invite link copied to clipboard.');
  };

  // Handle file uploads
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict format validation
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!allowedExtensions.includes(ext) || (!isImage && !isVideo)) {
      fileInputRef.current.value = ''; // clear input
      setShowUnsupportedModal(true);
      return;
    }

    // Check size limit: 20MB (Design Brief Section 11 constraint)
    if (file.size > 20 * 1024 * 1024) {
      addNotification('error', 'Payload Too Large', 'File exceeds the 20MB size limit.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const isImg = file.type.startsWith('image/');
      const endpoint = isImg ? '/upload/image' : '/upload/file';
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Send attachment message
      const type = isImg ? 'image' : res.data.fileType || 'video';
      sendMessage(spaceId, `Shared a file: ${file.name}`, type, res.data.url, file.name, file.size);
      addNotification('success', 'File Shared', `${file.name} uploaded successfully.`);
    } catch (err) {
      console.error(err);
      addNotification('error', 'Upload Failure', err.response?.data?.message || 'Failed to upload attachment.');
    } finally {
      setUploading(false);
      fileInputRef.current.value = ''; // clear input
    }
  };

    // Soft/hard delete message REST trigger (Delete From Me or Delete For Everyone)
  const handleDeleteMessage = async (messageId, type) => {
    try {
      await api.delete(`/messages/${messageId}?type=${type}`);
      if (type === 'me') {
        removeMessageLocally(messageId, true);
        addNotification('success', 'Message Removed', 'Message deleted from your view.');
      } else {
        addNotification('success', 'Message Deleted', 'Message deleted for everyone.');
      }
      setDeleteConfirmMsg(null);
    } catch (err) {
      addNotification('error', 'Deletion Failed', err.response?.data?.message || 'Failed to delete message.');
    }
  };

  // Clear space chat history for user
  const handleClearChat = async () => {
    try {
      const res = await clearChatForUser(spaceId);
      if (res.success) {
        addNotification('success', 'Chat Cleared', 'Workspace chat history cleared for your view.');
      } else {
        addNotification('error', 'Clear Chat Failed', res.error || 'Failed to clear chat.');
      }
      setShowClearChatModal(false);
    } catch (err) {
      addNotification('error', 'Clear Chat Failed', err.message || 'Failed to clear chat.');
    }
  };

  // Leave space/workspace
  const handleLeaveSpace = async () => {
    try {
      const res = await leaveSpace(spaceId);
      if (res.success) {
        addNotification('success', 'Left Workspace', 'Successfully left the workspace.');
        navigate('/dashboard');
      } else {
        addNotification('error', 'Leave Workspace Failed', res.error || 'Failed to leave workspace.');
      }
      setShowLeaveSpaceModal(false);
    } catch (err) {
      addNotification('error', 'Leave Workspace Failed', err.message || 'Failed to leave workspace.');
    }
  };

  // Delete space/workspace completely (owner only)
  const handleDeleteSpace = async () => {
    try {
      const res = await deleteSpace(spaceId);
      if (res.success) {
        addNotification('success', 'Workspace Deleted', 'Workspace deleted successfully.');
        navigate('/dashboard');
      } else {
        addNotification('error', 'Delete Workspace Failed', res.error || 'Failed to delete workspace.');
      }
      setShowDeleteSpaceModal(false);
      setDeleteSpaceConfirmName('');
    } catch (err) {
      addNotification('error', 'Delete Workspace Failed', err.message || 'Failed to delete workspace.');
    }
  };

  // Toggle reactions
  const handleReactionClick = (messageId, emoji, reacted) => {
    if (reacted) {
      removeReaction(messageId, emoji);
    } else {
      sendReaction(messageId, emoji);
    }
  };

  const getInitials = (name) => name.substring(0, 2).toUpperCase();

  // Extract shared files from messages for sidebar display
  const sharedFiles = messages.filter((m) => ['image', 'file', 'video'].includes(m.type) && !m.isDeleted);

  // Extract all media messages (images & videos) in chronological order for full-screen viewer
  const mediaList = messages.filter((m) => ['image', 'video'].includes(m.type) && !m.isDeleted);

  // Authorization checks for deleting messages (owner/admin or creator can delete any message)
  const userMember = currentSpace.members?.find((m) => (m.user?._id || m.user)?.toString() === user._id.toString());
  const isOwnerOrAdmin = userMember && ['owner', 'admin'].includes(userMember.role);
  const isCreator = (currentSpace.createdBy?._id || currentSpace.createdBy)?.toString() === user._id.toString();
  const canDeleteAny = isOwnerOrAdmin || isCreator;
  const isOwner = userMember && userMember.role === 'owner';

  const renderActiveMembersContent = (isDrawer = false) => (
    <>
      <div className="p-4 border-b border-border-primary flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-bold text-text-muted tracking-wider uppercase">Active Members ({currentSpace.members.length})</span>
        {isDrawer && (
          <button
            onClick={() => setMembersOpen(false)}
            className="p-1 text-text-secondary hover:text-text-primary rounded-lg hover:bg-background-elevated transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-grow overflow-y-auto p-3 flex flex-col gap-2 scroll-gpu">
        {currentSpace.members.map((member) => {
          const isSelf = member.user._id.toString() === user._id.toString();
          return (
            <div
              key={member.user._id}
              className="flex items-center justify-between p-2 rounded-xl bg-background-secondary/10 hover:bg-background-elevated/40 group transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-background-elevated border border-border-primary overflow-hidden flex items-center justify-center text-xs font-bold">
                    {member.user.avatar ? (
                      <img src={member.user.avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(member.user.username)
                    )}
                  </div>
                  {/* Status Dot */}
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 border border-background-secondary rounded-full ${
                      member.user.status === 'online'
                        ? 'bg-accent-ai'
                        : member.user.status === 'away'
                        ? 'bg-amber-500'
                        : 'bg-text-muted'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-text-primary truncate">
                    {member.user.displayName || member.user.username} {isSelf && '(You)'}
                  </h4>
                  <span className="text-[10px] text-text-muted capitalize flex items-center gap-1">
                    {member.role === 'owner' ? <Shield className="w-3 h-3 text-amber-500" /> : null} {member.role}
                  </span>
                </div>
              </div>


            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="flex-grow flex h-full overflow-hidden bg-background-primary relative">
      
      {/* 1. DESKTOP MEMBERS SIDEBAR (Static, inline, visible on lg screens and above) */}
      <div className="hidden lg:flex flex-col w-[240px] bg-background-secondary/40 border-r border-border-primary flex-shrink-0 h-full">
        {renderActiveMembersContent(false)}
      </div>

      {/* 1.1 MOBILE/TABLET ACTIVE MEMBERS DRAWER (Animated overlay using Framer Motion) */}
      <AnimatePresence>
        {membersOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setMembersOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] lg:hidden"
            />
            {/* Slide-in members drawer (Right to Left) */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="fixed top-0 bottom-0 right-0 z-[120] w-[280px] bg-background-secondary border-l border-border-primary flex flex-col shadow-2xl lg:hidden h-full"
            >
              {renderActiveMembersContent(true)}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 2. CENTER PANEL: Messages Chat Area */}
      <div className="flex-grow flex flex-col min-w-0 h-full relative">
        {/* Space Header */}
        <div className="h-16 border-b border-border-primary bg-background-secondary/20 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="lg:hidden p-2 text-text-secondary hover:text-text-primary mr-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-bold text-text-primary truncate">{currentSpace.name}</h2>
              <p className="text-[10px] md:text-xs text-text-secondary truncate mt-0.5">{currentSpace.description || 'No description provided.'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isOwner && (
              <button
                onClick={handleInviteClick}
                className="p-2 bg-background-elevated hover:bg-background-elevated/80 text-text-primary border border-border-primary rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              >
                <UserPlus className="w-4 h-4 text-accent-primary" /> Invite
              </button>
            )}

            <button
              onClick={() => setMembersOpen(true)}
              className="lg:hidden p-2 bg-background-elevated hover:bg-background-elevated/80 text-text-primary border border-border-primary rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              title="Active Members"
            >
              <Users className="w-4 h-4 text-accent-ai" /> Members
            </button>

            {/* Three-dot Workspace Settings Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="p-2 bg-background-elevated hover:bg-background-elevated/80 text-text-secondary hover:text-text-primary border border-border-primary rounded-xl flex items-center transition-all hover:scale-105 active:scale-95"
                title="Workspace Settings"
              >
                <MoreVertical className="w-4.5 h-4.5" />
              </button>
              
              {showSettingsMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-background-secondary border border-border-primary rounded-2xl shadow-xl z-50 p-2 animate-fade-in">
                  <div className="text-[10px] font-bold text-text-muted px-3 py-1.5 uppercase tracking-wider">
                    Workspace Options
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => {
                        handleInviteClick();
                        setShowSettingsMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-text-primary hover:bg-background-elevated rounded-xl transition-all flex items-center gap-2"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-text-secondary" /> Invite Users
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowClearChatModal(true);
                      setShowSettingsMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-text-primary hover:bg-background-elevated rounded-xl transition-all flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-text-secondary" /> Clear Chat For Me
                  </button>
                  <button
                    onClick={() => {
                      setShowLeaveSpaceModal(true);
                      setShowSettingsMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-500 hover:bg-amber-500/10 rounded-xl transition-all flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Leave Workspace
                  </button>
                  <button
                    onClick={() => {
                      setShowSpaceSettingsModal(true);
                      setShowSettingsMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-text-primary hover:bg-background-elevated rounded-xl transition-all flex items-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-text-secondary" /> Workspace Settings
                  </button>
                  {canDeleteAny && (
                    <button
                      onClick={() => {
                        setShowDeleteSpaceModal(true);
                        setShowSettingsMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10 rounded-xl transition-all flex items-center gap-2 border-t border-border-primary/50 mt-1 pt-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Workspace
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Toggle right sidebar settings panel */}
            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="p-2 bg-background-elevated hover:bg-background-elevated/80 border border-border-primary rounded-xl text-text-secondary hover:text-text-primary transition-all"
            >
              {rightPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-grow overflow-y-auto px-6 py-6 flex flex-col gap-4 scroll-gpu">
          {messages.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-background-secondary border border-border-primary flex items-center justify-center text-text-muted">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-semibold text-text-primary">Welcome to {currentSpace.name}</h4>
              <p className="text-xs text-text-secondary max-w-sm">No messages sent here yet. Start the conversation! Prompt the AI by typing @AI.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = (msg.sender?._id || msg.sender)?.toString() === user._id.toString();
              const isAI = msg.type === 'ai';
              const isSys = msg.type === 'system';
              const isPinned = currentSpace.pinnedMessages?.some((m) => {
                const pId = m._id ? m._id.toString() : m.toString();
                return pId === msg._id.toString();
              });
              const canDelete = isMe || canDeleteAny;

              if (isSys) {
                return (
                  <div key={msg._id} className="text-center py-2">
                    <span className="text-[10px] font-medium text-text-muted bg-background-secondary px-3 py-1 rounded-full border border-border-primary/50">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg._id}
                  className={`flex gap-3 max-w-[80%] group ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}
                >
                  {/* AI Bot Avatar next to the bubble */}
                  {isAI && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-ai/10 border border-accent-ai/30 flex items-center justify-center overflow-hidden self-end mb-1">
                      {msg.sender?.avatar ? (
                        <img src={msg.sender.avatar} alt="AI Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <Bot className="w-4 h-4 text-accent-ai" />
                      )}
                    </div>
                  )}

                  <div className={`flex flex-col focus:outline-none ${isMe ? 'items-end' : 'items-start'}`} tabIndex={0}>
                    {/* Sender Metadata (Name + Time) */}
                    <div className="flex items-center gap-2 mb-1.5">
                      {!isMe && (
                        <span className="text-[11px] font-bold text-text-primary flex items-center gap-1">
                          {isAI ? (
                            <span className="px-1.5 py-0.5 bg-accent-ai/20 border border-accent-ai/30 text-accent-ai rounded-md text-[9px] font-bold flex items-center gap-0.5">
                              AI
                            </span>
                          ) : null}
                          {msg.sender.displayName || msg.sender.username}
                        </span>
                      )}
                      <span className="text-[9px] text-text-muted">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isPinned && (
                        <Pin className="w-3 h-3 text-accent-primary flex-shrink-0 rotate-45" title="Pinned Message" />
                      )}
                      {msg.pinnedByUsers?.includes(user._id) && (
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" title="Starred Message" />
                      )}
                    </div>

                    {/* Bubble body */}
                    <div
                      onClick={() => handleBubbleClick(msg)}
                      className={`p-3.5 rounded-2xl shadow-md relative group/bubble cursor-pointer lg:cursor-default ${
                        isMe
                          ? 'bg-accent-primary text-white rounded-tr-none'
                          : isAI
                          ? 'bg-gradient-to-tr from-accent-ai/10 to-teal-400/10 border-2 border-accent-ai/50 shadow-[0_0_15px_rgba(45,212,191,0.15)] text-text-primary rounded-tl-none'
                          : 'bg-background-secondary border border-border-primary text-text-primary rounded-tl-none'
                      }`}
                    >
                      {/* Soft-deleted message check */}
                      {msg.isDeleted ? (
                        <p className="text-xs italic text-text-muted">This message was deleted.</p>
                      ) : (
                        <>
                          {msg.replyTo && (
                            <div className="mb-2 p-2 rounded bg-background-primary/40 border-l-2 border-accent-primary text-[11px] text-text-secondary leading-relaxed">
                              <span className="font-bold text-text-primary block text-[10px]">
                                @{msg.replyTo.sender?.username || 'User'}
                              </span>
                              <span className="truncate block max-w-xs">
                                {msg.replyTo.isDeleted ? 'This message was deleted.' : msg.replyTo.content}
                              </span>
                            </div>
                          )}
                          {/* Text Content */}
                          {(!msg.content || msg.content.trim() === '') && msg.isStreaming ? (
                            <TypingDots />
                          ) : (
                            <p className="text-xs md:text-sm whitespace-pre-wrap break-words leading-relaxed">
                              {msg.content}
                              {msg.isStreaming && (
                                <span className="inline-block w-1.5 h-3.5 ml-1 bg-accent-ai animate-pulse rounded-sm align-middle" />
                              )}
                            </p>
                          )}

                          {/* Image Attachment Rendering */}
                          {msg.type === 'image' && msg.fileUrl && (
                            <div className="mt-3 rounded-lg overflow-hidden border border-border-primary/50 max-w-sm cursor-zoom-in">
                              <img
                                src={msg.fileUrl}
                                alt={msg.fileName || 'shared asset'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const idx = mediaList.findIndex((m) => m._id.toString() === msg._id.toString());
                                  setActiveMediaViewer({ initialIndex: idx >= 0 ? idx : 0 });
                                }}
                                className="max-h-60 w-full object-cover hover:opacity-95 transition-opacity"
                              />
                            </div>
                          )}

                          {/* Video Attachment Rendering */}
                          {msg.type === 'video' && msg.fileUrl && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                const idx = mediaList.findIndex((m) => m._id.toString() === msg._id.toString());
                                setActiveMediaViewer({ initialIndex: idx >= 0 ? idx : 0 });
                              }}
                              className="mt-3 rounded-lg overflow-hidden border border-border-primary/50 max-w-sm bg-black relative cursor-pointer group/video"
                            >
                              <video src={msg.fileUrl} className="max-h-60 w-full object-contain pointer-events-none" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover/video:bg-black/45 transition-colors">
                                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white scale-100 group-hover/video:scale-110 transition-transform shadow-lg">
                                  <Play className="w-5 h-5 translate-x-0.5 fill-white text-white" />
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Controls row (Reply + Trash + Pin + Reply with AI) on hover */}
                      {!msg.isDeleted ? (
                        <div className={`absolute top-1/2 -translate-y-1/2 hidden lg:flex gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all z-10 ${
                          isMe ? 'right-full mr-3' : 'left-full ml-3'
                        } ${isMe ? '' : 'flex-row-reverse'}`}>
                          <button
                            onClick={() => setReplyingTo(msg)}
                            className="p-1.5 text-text-muted hover:text-accent-primary rounded-lg hover:bg-background-elevated transition-all"
                            title="Reply to Message"
                          >
                            <CornerUpLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmMsg(msg)}
                            className="p-1.5 text-text-muted hover:text-danger rounded-lg hover:bg-background-elevated transition-all"
                            title="Delete Message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => togglePinMessage(msg._id)}
                            className={`p-1.5 rounded-lg hover:bg-background-elevated transition-all ${
                              msg.pinnedByUsers?.includes(user._id) ? 'text-amber-500 fill-amber-500' : 'text-text-muted hover:text-amber-500'
                            }`}
                            title={msg.pinnedByUsers?.includes(user._id) ? "Unstar Message" : "Pin Message"}
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                          {canDeleteAny && (
                            <button
                              onClick={() => {
                                console.log(`[DEBUG] Workspace Pin/Unpin button clicked. Message ID: ${msg._id}, isPinned: ${isPinned}`);
                                if (isPinned) {
                                  unpinMessageInSpace(msg._id);
                                } else {
                                  pinMessageInSpace(msg._id);
                                }
                              }}
                              className={`p-1.5 rounded-lg hover:bg-background-elevated transition-all ${
                                isPinned ? 'text-accent-primary' : 'text-text-muted hover:text-accent-primary'
                              }`}
                              title={isPinned ? "Unpin Message" : "Pin Message"}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {currentSpace?.hasAI && (
                            <button
                              onClick={() => handleReplyWithAI(msg._id)}
                              className="p-1.5 text-text-muted hover:text-accent-ai rounded-lg hover:bg-background-elevated transition-all"
                              title="Reply with AI"
                            >
                              <Bot className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className={`absolute top-1/2 -translate-y-1/2 hidden lg:flex gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all z-10 ${
                          isMe ? 'right-full mr-3' : 'left-full ml-3'
                        } ${isMe ? '' : 'flex-row-reverse'}`}>
                          <button
                            onClick={() => setDeleteConfirmMsg(msg)}
                            className="p-1.5 text-text-muted hover:text-danger rounded-lg hover:bg-background-elevated transition-all"
                            title="Delete Message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                  {/* Reaction Badges row */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {msg.reactions.map((react) => {
                        const hasReacted = react.users.includes(user._id);
                        return (
                          <button
                            key={react.emoji}
                            onClick={() => handleReactionClick(msg._id, react.emoji, hasReacted)}
                            className={`px-2 py-0.5 rounded-full text-[10px] border flex items-center gap-1 font-medium transition-all ${
                              hasReacted
                                ? 'bg-accent-primary/20 border-accent-primary text-text-primary'
                                : 'bg-background-secondary border-border-primary hover:border-text-secondary text-text-secondary'
                            }`}
                          >
                            <span>{react.emoji}</span>
                            <span>{react.users.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Quick reactions picker panel (hover/focus-triggered) */}
                  {!msg.isDeleted && (
                    <div className="hidden lg:flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      {['👍', '❤️', '🔥', '😂', '😮', '🙏'].map((emoji) => {
                        const reacted = msg.reactions?.some((r) => r.emoji === emoji && r.users.includes(user._id));
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleReactionClick(msg._id, emoji, reacted)}
                            className="text-xs p-1 hover:bg-background-elevated rounded-md hover:scale-110 active:scale-95 transition-transform"
                          >
                            {emoji}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messageEndRef} />
        </div>

        {/* Message Input Controls HUD */}
        <div className="p-2.5 sm:p-4 bg-background-secondary/20 border-t border-border-primary flex-shrink-0 transition-all duration-300">
          
          {/* Typing status bar */}
          <div className="h-5 mb-1 text-[11px] text-text-secondary px-2">
            {typingUsers.length > 0 && (
              <span className="italic animate-pulse">
                {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
              </span>
            )}
          </div>

          {/* Reply Preview HUD */}
          {replyingTo && (
            <div className="mb-3 mx-2 p-2.5 rounded-xl bg-background-elevated border border-border-primary flex items-center justify-between animate-fade-in relative z-10">
              <div className="flex items-center gap-2 min-w-0">
                <CornerUpLeft className="w-4 h-4 text-accent-primary flex-shrink-0" />
                <div className="text-xs min-w-0">
                  <span className="font-bold text-text-primary block">
                    Replying to @{replyingTo.sender?.username || 'User'}
                  </span>
                  <span className="text-text-secondary truncate block max-w-[200px] sm:max-w-md">
                    {replyingTo.content}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-1 hover:bg-background-secondary rounded-lg text-text-muted hover:text-text-primary transition-all ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex gap-2 sm:gap-3 items-center">
            
            {/* Attachment inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,video/*"
            />
            
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current.click()}
              className="flex-shrink-0 w-11 h-11 flex items-center justify-center bg-background-elevated hover:bg-background-elevated/80 disabled:opacity-50 text-text-secondary hover:text-text-primary rounded-xl border border-border-primary transition-all active:scale-95"
              title="Attach File"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Input Bar */}
            <div className="flex-grow relative">
              <textarea
                ref={inputRef}
                required
                value={messageText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={uploading ? 'Uploading media attachment...' : 'Type message here... Use @AI to mention Gemini.'}
                disabled={uploading}
                rows={1}
                className="w-full bg-background-primary border border-border-primary rounded-xl pl-4 pr-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary resize-none overflow-y-auto max-h-32 min-h-[44px] sm:min-h-[46px] leading-relaxed"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={uploading || !messageText.trim()}
              className={`flex-shrink-0 w-11 h-11 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center text-white border-none cursor-pointer ${
                messageText.includes('@AI')
                  ? 'bg-accent-ai hover:bg-accent-ai/90 shadow-accent-ai/20'
                  : 'bg-accent-primary hover:bg-accent-primary/90 shadow-accent-primary/20'
              }`}
              title={messageText.includes('@AI') ? 'Send to AI' : 'Send Message'}
            >
              {messageText.includes('@AI') ? (
                <Sparkles className="w-5 h-5 animate-pulse text-white" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>

      </div>

      {/* 3. RIGHT PANEL: Space Assets */}
      <AnimatePresence>
        {rightPanelOpen && (
          <>
            {/* Backdrop for screens below xl */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setRightPanelOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] xl:hidden"
            />
            
            {/* Slide-in panel (drawer below xl, static inline panel on xl and above) */}
            <motion.div
              initial={windowWidth < 1280 ? { x: '100%' } : { width: 0, opacity: 0 }}
              animate={windowWidth < 1280 ? { x: 0 } : { width: 260, opacity: 1 }}
              exit={windowWidth < 1280 ? { x: '100%' } : { width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="fixed top-0 bottom-0 right-0 z-[100] w-[280px] xl:relative xl:w-[260px] bg-background-secondary xl:bg-background-secondary/30 border-l border-border-primary flex flex-col shadow-2xl xl:shadow-none h-full overflow-hidden"
            >
              <div className="p-4 border-b border-border-primary flex items-center justify-between flex-shrink-0">
                <h3 className="text-xs font-bold text-text-muted tracking-wider uppercase">Space Assets</h3>
                <button
                  onClick={() => setRightPanelOpen(false)}
                  className="xl:hidden p-1 text-text-secondary hover:text-text-primary rounded-lg hover:bg-background-elevated transition-colors"
                  title="Close Sidebar"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-6 scroll-gpu">
                
                {/* Space Pinned Messages summary */}
                <div>
                  <h4 className="text-xs font-bold text-text-secondary flex items-center gap-1.5 mb-2">
                    <Pin className="w-3.5 h-3.5 text-accent-primary" /> Pinned Messages ({currentSpace.pinnedMessages?.length || 0})
                  </h4>
                  
                  <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1 scroll-gpu">
                    {!currentSpace.pinnedMessages || currentSpace.pinnedMessages.length === 0 ? (
                      <div className="bg-background-secondary/40 p-3 rounded-xl border border-border-primary/50 text-xs text-text-muted italic">
                        No pinned messages in this space yet.
                      </div>
                    ) : (
                      currentSpace.pinnedMessages.map((pinnedMsg) => {
                        const senderName = pinnedMsg.sender?.displayName || pinnedMsg.sender?.username || 'AI Assistant';
                        return (
                          <div
                            key={pinnedMsg._id}
                            className="p-2.5 bg-background-secondary/20 hover:bg-background-secondary/40 border border-border-primary/50 rounded-xl relative group/pinned min-w-0"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[10px] font-bold text-text-primary truncate">{senderName}</span>
                              {canDeleteAny && (
                                <button
                                  onClick={() => {
                                    console.log(`[DEBUG] Sidebar Unpin button clicked for message: ${pinnedMsg._id}`);
                                    unpinMessageInSpace(pinnedMsg._id);
                                  }}
                                  className="opacity-0 group-hover/pinned:opacity-100 p-0.5 text-text-muted hover:text-danger rounded transition-opacity"
                                  title="Unpin Message"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-text-secondary mt-1 break-words line-clamp-2 leading-relaxed">
                              {pinnedMsg.content}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Shared Files list */}
                <div>
                  <h4 className="text-xs font-bold text-text-secondary flex items-center gap-1.5 mb-2">
                    <FileText className="w-3.5 h-3.5 text-accent-ai" /> Shared Files ({sharedFiles.length})
                  </h4>
                  
                  <div className="flex flex-col gap-2">
                    {sharedFiles.length === 0 ? (
                      <div className="bg-background-secondary/40 p-3 rounded-xl border border-border-primary/50 text-xs text-text-muted italic">
                        No files shared yet.
                      </div>
                    ) : (
                      sharedFiles.map((file) => (
                        <a
                          key={file._id}
                          href={file.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-background-secondary/20 hover:bg-background-elevated border border-border-primary rounded-lg transition-colors group/file min-w-0"
                        >
                          <FileText className="w-4 h-4 text-accent-primary flex-shrink-0" />
                          <span className="text-[11px] font-medium truncate text-text-secondary group-hover/file:text-text-primary flex-grow">
                            {file.fileName || 'Shared Document'}
                          </span>
                        </a>
                      ))
                    )}
                  </div>
                </div>

              </div>

              <div className="p-4 border-t border-border-primary text-center flex-shrink-0">
                <p className="text-[10px] text-text-muted">Space created on {new Date(currentSpace.createdAt).toLocaleDateString()}</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MOBILE MESSAGE ACTIONS BOTTOM SHEET context drawer */}
      <AnimatePresence>
        {selectedMsgActions && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedMsgActions(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[210] lg:hidden"
            />
            {/* Bottom Sheet Context Menu */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed bottom-0 left-0 right-0 z-[220] bg-background-secondary border-t border-border-primary rounded-t-2xl p-4 shadow-2xl lg:hidden max-h-[85vh] flex flex-col"
            >
              {/* Drag handle or visual indicator */}
              <div className="w-12 h-1 bg-border-primary rounded-full mx-auto mb-4 flex-shrink-0" />
              
              {/* Message Info Header */}
              <div className="flex items-center gap-3 border-b border-border-primary pb-3 mb-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-background-elevated border border-border-primary flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedMsgActions.sender?.avatar ? (
                    <img src={selectedMsgActions.sender.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-xs font-bold">{getInitials(selectedMsgActions.sender?.username || 'AI')}</div>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-text-primary truncate">
                    {selectedMsgActions.sender?.displayName || selectedMsgActions.sender?.username || 'AI Assistant'}
                  </h4>
                  <p className="text-[10px] text-text-muted mt-0.5 truncate">
                    {selectedMsgActions.content ? selectedMsgActions.content.substring(0, 50) + (selectedMsgActions.content.length > 50 ? '...' : '') : '[Attachment]'}
                  </p>
                </div>
              </div>

              {/* Emojis reaction bar */}
              {!selectedMsgActions.isDeleted && (
                <div className="flex justify-center items-center gap-4 py-2 px-1 mb-3 flex-shrink-0">
                  {['👍', '❤️', '🔥', '😂', '😮', '🙏'].map((emoji) => {
                    const reacted = selectedMsgActions.reactions?.some((r) => r.emoji === emoji && r.users.includes(user._id));
                    return (
                      <button
                        key={emoji}
                        onClick={() => {
                          handleReactionClick(selectedMsgActions._id, emoji, reacted);
                          setSelectedMsgActions(null);
                        }}
                        className={`text-[18px] w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 active:scale-125 ${
                          reacted ? 'bg-accent-primary/20 border border-accent-primary/50 scale-110 shadow-sm' : 'hover:bg-background-elevated active:bg-background-elevated'
                        }`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Divider */}
              {!selectedMsgActions.isDeleted && (
                <div className="h-[1px] bg-border-primary mb-3 flex-shrink-0" />
              )}

              {/* Actions list */}
              <div className="flex-grow overflow-y-auto flex flex-col gap-1 scroll-gpu">
                {/* 1. Reply */}
                {!selectedMsgActions.isDeleted && (
                  <button
                    onClick={() => {
                      setReplyingTo(selectedMsgActions);
                      setSelectedMsgActions(null);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-text-primary hover:bg-background-elevated rounded-xl transition-all"
                  >
                    <CornerUpLeft className="w-4 h-4 text-accent-primary" />
                    <span>Reply</span>
                  </button>
                )}

                {/* 2. Star/Unstar */}
                {!selectedMsgActions.isDeleted && (
                  <button
                    onClick={() => {
                      togglePinMessage(selectedMsgActions._id);
                      setSelectedMsgActions(null);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-text-primary hover:bg-background-elevated rounded-xl transition-all"
                  >
                    <Star className={`w-4 h-4 ${selectedMsgActions.pinnedByUsers?.includes(user._id) ? 'text-amber-500 fill-amber-500' : 'text-text-muted'}`} />
                    <span>{selectedMsgActions.pinnedByUsers?.includes(user._id) ? 'Unstar Message' : 'Star Message'}</span>
                  </button>
                )}

                {/* 3. Pin/Unpin (Workspace-wide, Owner/Admin only) */}
                {!selectedMsgActions.isDeleted && canDeleteAny && (
                  <button
                    onClick={() => {
                      const isPinned = currentSpace.pinnedMessages?.some((m) => (m._id ? m._id.toString() : m.toString()) === selectedMsgActions._id.toString());
                      if (isPinned) {
                        unpinMessageInSpace(selectedMsgActions._id);
                      } else {
                        pinMessageInSpace(selectedMsgActions._id);
                      }
                      setSelectedMsgActions(null);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-text-primary hover:bg-background-elevated rounded-xl transition-all"
                  >
                    <Pin className="w-4 h-4 text-accent-primary rotate-45" />
                    <span>
                      {currentSpace.pinnedMessages?.some((m) => (m._id ? m._id.toString() : m.toString()) === selectedMsgActions._id.toString())
                        ? 'Unpin Message'
                        : 'Pin Message'}
                    </span>
                  </button>
                )}

                {/* 4. Reply with AI */}
                {!selectedMsgActions.isDeleted && currentSpace?.hasAI && (
                  <button
                    onClick={() => {
                      handleReplyWithAI(selectedMsgActions._id);
                      setSelectedMsgActions(null);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-text-primary hover:bg-background-elevated rounded-xl transition-all"
                  >
                    <Bot className="w-4 h-4 text-accent-ai" />
                    <span>Reply with AI</span>
                  </button>
                )}

                {/* 5. Delete (unconditional) */}
                <button
                  onClick={() => {
                    setDeleteConfirmMsg(selectedMsgActions);
                    setSelectedMsgActions(null);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-danger hover:bg-danger/10 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Message</span>
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedMsgActions(null)}
                className="mt-4 w-full py-3 bg-background-elevated hover:bg-background-elevated/80 rounded-xl text-sm font-semibold transition-all border border-border-primary text-text-secondary"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* INVITE MEMBERS DIALOG MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative scale-in-call">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-accent-primary" /> Invite Settings
            </h3>
            <p className="text-xs text-text-secondary mt-1">Configure and share invite link with member limitations.</p>

            <div className="mt-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Invite Link</label>
                {inviteToken ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/join/${inviteToken}`}
                      className="flex-grow bg-background-primary border border-border-primary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Copy
                    </button>
                  </div>
                ) : (
                  <div className="bg-background-primary border border-border-primary border-dashed rounded-xl p-3 text-xs text-text-muted italic text-center">
                    No active invite link. Generate one below.
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Set Member Limit</label>
                <select
                  value={inviteLimit}
                  onChange={handleLimitChange}
                  className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none"
                >
                  <option value={5}>5 Members (Default)</option>
                  <option value={10}>10 Members</option>
                </select>
              </div>

              <div className="flex gap-3 mt-2">
                {inviteToken ? (
                  <button
                    onClick={handleRevokeClick}
                    className="flex-1 py-2.5 bg-danger/10 hover:bg-danger/20 border border-danger/30 rounded-xl text-xs font-semibold text-danger transition-all"
                  >
                    Revoke Invite Link
                  </button>
                ) : (
                  <button
                    onClick={() => handleLimitChange({ target: { value: inviteLimit } })}
                    className="flex-1 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-xl text-xs font-semibold transition-all"
                  >
                    Generate Invite Link
                  </button>
                )}
                <button
                  onClick={handleRegenerateClick}
                  className="flex-1 py-2.5 bg-background-elevated hover:bg-background-elevated/80 border border-border-primary rounded-xl text-xs font-semibold text-text-primary transition-all"
                >
                  Regenerate Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmMsg && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl scale-in-call relative">
            <button
              onClick={() => setDeleteConfirmMsg(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-danger" /> Delete Message?
            </h3>
            <p className="text-xs text-text-secondary mt-2">
              Choose how you want to delete this message.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => handleDeleteMessage(deleteConfirmMsg._id, 'me')}
                className="w-full py-2.5 bg-background-elevated hover:bg-background-elevated/80 border border-border-primary rounded-xl text-xs font-semibold text-text-primary transition-all"
              >
                Delete for Me
              </button>
              {((deleteConfirmMsg.sender?._id || deleteConfirmMsg.sender)?.toString() === user._id.toString()) && !deleteConfirmMsg.isDeleted && (
                <button
                  onClick={() => handleDeleteMessage(deleteConfirmMsg._id, 'everyone')}
                  className="w-full py-2.5 bg-danger/10 hover:bg-danger/20 border border-danger/30 rounded-xl text-xs font-semibold text-danger transition-all"
                >
                  Delete for Everyone
                </button>
              )}
              <button
                onClick={() => setDeleteConfirmMsg(null)}
                className="w-full py-2.5 bg-transparent hover:bg-background-elevated rounded-xl text-xs font-semibold text-text-muted transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR CHAT CONFIRMATION MODAL */}
      {showClearChatModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex-row items-center justify-center p-4 flex">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl scale-in-call relative">
            <button
              onClick={() => setShowClearChatModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-danger" /> Clear Chat For Me?
            </h3>
            <p className="text-xs text-text-secondary mt-3 leading-relaxed">
              Are you sure you want to clear messages in this space? This will only remove messages from your view. The workspace, its settings, and its members will remain intact.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowClearChatModal(false)}
                className="flex-1 py-2.5 bg-background-elevated hover:bg-background-elevated/80 border border-border-primary rounded-xl text-xs font-semibold text-text-primary transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearChat}
                className="flex-1 py-2.5 bg-danger hover:bg-danger/90 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-danger/20"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEAVE WORKSPACE CONFIRMATION MODAL */}
      {showLeaveSpaceModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl scale-in-call relative">
            <button
              onClick={() => setShowLeaveSpaceModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <LogOut className="w-5 h-5 text-amber-500" /> Leave Workspace?
            </h3>
            <p className="text-xs text-text-secondary mt-3 leading-relaxed">
              Are you sure you want to leave the workspace <strong className="text-text-primary">{currentSpace.name}</strong>? You will lose access to all messages and files in this workspace.
            </p>
            {(currentSpace.createdBy?._id || currentSpace.createdBy)?.toString() === user._id.toString() && (
              <p className="text-xs text-danger mt-2 font-semibold">
                Warning: As the Owner, you cannot leave this workspace. You must delete it or transfer ownership.
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLeaveSpaceModal(false)}
                className="flex-1 py-2.5 bg-background-elevated hover:bg-background-elevated/80 border border-border-primary rounded-xl text-xs font-semibold text-text-primary transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={(currentSpace.createdBy?._id || currentSpace.createdBy)?.toString() === user._id.toString()}
                onClick={handleLeaveSpace}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-amber-500/20"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE WORKSPACE CONFIRMATION MODAL */}
      {showDeleteSpaceModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl scale-in-call relative">
            <button
              onClick={() => {
                setShowDeleteSpaceModal(false);
                setDeleteSpaceConfirmName('');
              }}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-danger" /> Delete Workspace?
            </h3>
            <p className="text-xs text-text-secondary mt-3 leading-relaxed">
              Are you sure you want to delete the workspace <strong className="text-text-primary">{currentSpace.name}</strong>?
            </p>
            <p className="text-xs text-danger mt-2 font-bold uppercase tracking-wider">
              Warning: This is a permanent action! All messages, members, shared files, and settings will be permanently removed.
            </p>
            
            <div className="mt-4">
              <label className="text-xs font-semibold text-text-secondary block mb-1">
                Type the workspace name <span className="font-bold text-text-primary">"{currentSpace.name}"</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteSpaceConfirmName}
                onChange={(e) => setDeleteSpaceConfirmName(e.target.value)}
                placeholder="Enter workspace name"
                className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-danger"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteSpaceModal(false);
                  setDeleteSpaceConfirmName('');
                }}
                className="flex-1 py-2.5 bg-background-elevated hover:bg-background-elevated/80 border border-border-primary rounded-xl text-xs font-semibold text-text-primary transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSpaceConfirmName !== currentSpace.name || (currentSpace.createdBy?._id || currentSpace.createdBy)?.toString() !== user._id.toString()}
                onClick={handleDeleteSpace}
                className="flex-1 py-2.5 bg-danger hover:bg-danger/90 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-danger/20"
              >
                Delete Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WORKSPACE SETTINGS MODAL */}
      {showSpaceSettingsModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl scale-in-call relative">
            <button
              onClick={() => setShowSpaceSettingsModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Settings className="w-5 h-5 text-accent-primary" /> Workspace Settings
            </h3>
            <p className="text-xs text-text-secondary mt-1">Details and settings for this workspace.</p>

            <div className="mt-6 flex flex-col gap-4 divide-y divide-border-primary">
              <div className="pt-2">
                <span className="text-[10px] uppercase font-bold text-text-muted">Workspace Name</span>
                <h4 className="text-sm font-semibold text-text-primary mt-1">{currentSpace.name}</h4>
              </div>

              <div className="pt-3">
                <span className="text-[10px] uppercase font-bold text-text-muted">Description</span>
                <p className="text-xs text-text-secondary mt-1">{currentSpace.description || 'No description provided.'}</p>
              </div>

              <div className="pt-3">
                <span className="text-[10px] uppercase font-bold text-text-muted">Workspace Type</span>
                <p className="text-xs text-text-secondary mt-1">{currentSpace.isPrivate ? 'Private Space (Invite Only)' : 'Public Space'}</p>
              </div>

              <div className="pt-3">
                <span className="text-[10px] uppercase font-bold text-text-muted">AI Features</span>
                <p className="text-xs text-text-secondary mt-1">{currentSpace.hasAI ? 'Gemini AI Integration Enabled (Use @AI)' : 'AI features disabled'}</p>
              </div>

              <div className="pt-3">
                <span className="text-[10px] uppercase font-bold text-text-muted">Created By</span>
                <p className="text-xs text-text-secondary mt-1">
                  {currentSpace.createdBy?.displayName || currentSpace.createdBy?.username || 'System'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowSpaceSettingsModal(false)}
              className="mt-8 w-full py-2.5 bg-background-elevated hover:bg-background-elevated/80 rounded-xl text-sm font-semibold transition-all border border-border-primary"
            >
              Close Settings
            </button>
          </div>
        </div>
      )}

      {/* UNSUPPORTED FILE TYPE CONFIRMATION MODAL */}
      {showUnsupportedModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 flex-row">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl scale-in-call relative">
            <button
              onClick={() => setShowUnsupportedModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" /> Unsupported File Type
            </h3>
            <div className="text-xs text-text-secondary mt-3 leading-relaxed flex flex-col gap-2">
              <p>Only images and videos can be uploaded.</p>
              <div>
                <p className="font-bold text-text-primary mb-1">Supported formats:</p>
                <p className="pl-2"><span className="font-semibold text-text-primary">Images:</span> JPG, JPEG, PNG, GIF, WEBP</p>
                <p className="pl-2"><span className="font-semibold text-text-primary">Videos:</span> MP4, MOV, WEBM</p>
              </div>
              <p className="mt-1">Please select a supported file.</p>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowUnsupportedModal(false)}
                className="w-full py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-xl text-xs font-semibold transition-all shadow-md"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEDIA VIEWER MODAL */}
      <AnimatePresence>
        {activeMediaViewer && (
          <MediaViewer
            mediaList={mediaList}
            initialIndex={activeMediaViewer.initialIndex}
            onClose={() => setActiveMediaViewer(null)}
          />
        )}
      </AnimatePresence>

      <style>{`
        .scale-in-call {
          animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @media (max-width: 1279px) {
          .slide-in-right {
            animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Space;
