import React, { useEffect, useState, useRef } from 'react';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../stores/authStore';
import { useSpaceStore } from '../stores/spaceStore';
import { useMessageStore } from '../stores/messageStore';
import { useUiStore } from '../stores/uiStore';
import { getSocket } from '../services/socket';
import { Plus, Settings, LogOut, MessageSquare, Bot, User, Menu, X, ArrowRight, Globe, Lock, Sparkles, Bell, Trash2, Star, LogIn, Link2, Sun, Moon } from 'lucide-react';
import ToastContainer from './ToastContainer';


const ProtectedLayout = () => {
  const { user, isAuthenticated, loading, checkAuth, logoutUser, updateProfile } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      loading: state.loading,
      checkAuth: state.checkAuth,
      logoutUser: state.logoutUser,
      updateProfile: state.updateProfile,
    }))
  );
  const { spaces, fetchMySpaces, createNewSpace, currentSpace, updateMemberStatus, addMemberToSpace, removeMemberFromSpace, addPinnedMessageLocally, removePinnedMessageLocally, joinSpaceWithToken } = useSpaceStore(
    useShallow((state) => ({
      spaces: state.spaces,
      fetchMySpaces: state.fetchMySpaces,
      createNewSpace: state.createNewSpace,
      currentSpace: state.currentSpace,
      updateMemberStatus: state.updateMemberStatus,
      addMemberToSpace: state.addMemberToSpace,
      removeMemberFromSpace: state.removeMemberFromSpace,
      addPinnedMessageLocally: state.addPinnedMessageLocally,
      removePinnedMessageLocally: state.removePinnedMessageLocally,
      joinSpaceWithToken: state.joinSpaceWithToken,
    }))
  );
  const { addMessage, removeMessageLocally, setTypingStatus, updateMessageReactions, clearChatState, updateMessageContentLocally } = useMessageStore(
    useShallow((state) => ({
      addMessage: state.addMessage,
      removeMessageLocally: state.removeMessageLocally,
      setTypingStatus: state.setTypingStatus,
      updateMessageReactions: state.updateMessageReactions,
      clearChatState: state.clearChatState,
      updateMessageContentLocally: state.updateMessageContentLocally,
    }))
  );
  const { activeModal, openModal, closeModal, addNotification, dbNotifications, fetchDbNotifications, markDbNotificationRead, clearDbNotifications, setTheme, theme } = useUiStore(
    useShallow((state) => ({
      activeModal: state.activeModal,
      openModal: state.openModal,
      closeModal: state.closeModal,
      addNotification: state.addNotification,
      dbNotifications: state.dbNotifications,
      fetchDbNotifications: state.fetchDbNotifications,
      markDbNotificationRead: state.markDbNotificationRead,
      clearDbNotifications: state.clearDbNotifications,
      setTheme: state.setTheme,
      theme: state.theme,
    }))
  );

  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Window size tracking for reactive drag boundaries
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Floating AI Button Responsive Fixed Positions
  const isSpacePage = location.pathname.startsWith('/space/');
  const bottomOffset = isSpacePage 
    ? (windowSize.width < 768 ? '120px' : '120px') 
    : (windowSize.width < 768 ? '20px' : '32px');
  const rightOffset = windowSize.width < 768 ? '16px' : '32px';
  
  // Modal Fields
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDesc, setNewSpaceDesc] = useState('');
  const [newSpaceAI, setNewSpaceAI] = useState(true);

  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editStatus, setEditStatus] = useState('online');

  // Join Workspace modal state
  const [joinLinkInput, setJoinLinkInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState(null);

  // Validate session on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Fetch spaces and notifications once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchMySpaces();
      fetchDbNotifications();
    }
  }, [isAuthenticated, fetchMySpaces, fetchDbNotifications]);

  // Bind Global Sockets Listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => {
      console.log('[DEBUG] Global socket connect/reconnect event. currentSpace:', currentSpace?._id);
      if (currentSpace) {
        const spaceIdStr = (currentSpace._id || currentSpace).toString();
        console.log('[DEBUG] Global socket re-joining space room:', spaceIdStr);
        socket.emit('join_space', { spaceId: spaceIdStr });
      }
    };

    socket.on('connect', handleConnect);

    // If already connected and currentSpace is loaded, join the room immediately to prevent race conditions
    if (socket.connected && currentSpace) {
      const spaceIdStr = (currentSpace._id || currentSpace).toString();
      console.log('[DEBUG] Global socket already connected, immediately joining space room:', spaceIdStr);
      socket.emit('join_space', { spaceId: spaceIdStr });
    }

    // Presence updates
    socket.on('user_online', ({ userId: uId }) => {
      updateMemberStatus(uId, 'online');
    });

    socket.on('user_offline', ({ userId: uId }) => {
      updateMemberStatus(uId, 'offline');
    });

    // Real-time chat messaging broadcasts
    socket.on('new_message', (msg) => {
      console.log('[DEBUG] ProtectedLayout socket.on("new_message") received:', msg._id, 'for space:', msg.space);
      // 1. Add to store
      addMessage(msg);

      // 2. Fire Toast if message is from another room or we are not in that active room
      if (!currentSpace || currentSpace._id.toString() !== msg.space.toString()) {
        console.log('[DEBUG] new_message space is different from currentSpace, currentSpace ID:', currentSpace?._id, 'msg space ID:', msg.space);
        // Exclude system messages or our own messages from toast alerts
        if (msg.type !== 'system' && msg.sender._id.toString() !== user?._id.toString()) {
          // Suppress toast notifications for empty AI placeholder messages
          if (msg.type === 'ai' && (!msg.content || msg.content.trim() === '')) {
            console.log('[DEBUG] Suppressing toast alert for empty AI response placeholder');
            return;
          }
          const senderName = msg.type === 'ai' ? 'AI Assistant' : (msg.sender.displayName || msg.sender.username);
          const snippet = msg.type === 'text' || msg.type === 'ai' ? msg.content : `[Shared ${msg.type}]`;
          addNotification('info', `New Message in Space`, `${senderName}: ${snippet.substring(0, 35)}...`, msg._id);
        }
      } else {
        console.log('[DEBUG] new_message is for current active space room');
      }
    });

    // Soft deletions
    socket.on('message_deleted', (msgId) => {
      removeMessageLocally(msgId);
    });

    // Typing broadcasts
    socket.on('user_typing', ({ spaceId: sId, username: uName, isTyping }) => {
      if (currentSpace && currentSpace._id.toString() === sId.toString()) {
        setTypingStatus(uName, isTyping);
      }
    });

    // Reaction updates
    socket.on('reaction_updated', ({ messageId, reactions }) => {
      updateMessageReactions(messageId, reactions);
    });

    // New notification updates from socket
    socket.on('new_notification', (notification) => {
      fetchDbNotifications();
      
      // Prevent showing duplicate toast if the user is currently looking at the space where the notification occurred
      const spaceId = notification.metadata?.spaceId;
      if (spaceId && currentSpace && (currentSpace._id || currentSpace).toString() === spaceId.toString()) {
        console.log('[DEBUG] Suppressing notification toast because user is currently in the active space:', spaceId);
        return;
      }

      addNotification('info', notification.title, notification.content, notification._id || notification.metadata?.messageId);
    });

    // Pinned messages updates
    socket.on('message_pinned', ({ spaceId, message }) => {
      console.log(`[DEBUG] Socket event message_pinned received. Space ID: ${spaceId}, Message ID: ${message?._id}`);
      if (currentSpace && currentSpace._id.toString() === spaceId.toString()) {
        addPinnedMessageLocally(message);
        addNotification('info', 'Message Pinned', `A message was pinned in ${currentSpace.name}`, `pin-${message?._id}`);
      }
    });

    socket.on('message_unpinned', ({ spaceId, messageId }) => {
      console.log(`[DEBUG] Socket event message_unpinned received. Space ID: ${spaceId}, Message ID: ${messageId}`);
      if (currentSpace && currentSpace._id.toString() === spaceId.toString()) {
        removePinnedMessageLocally(messageId);
        addNotification('info', 'Message Unpinned', `A message was unpinned in ${currentSpace.name}`, `unpin-${messageId}`);
      }
    });

    socket.on('workspace_deleted', (spaceId) => {
      fetchMySpaces();
      if (currentSpace && (currentSpace._id || currentSpace).toString() === spaceId.toString()) {
        navigate('/dashboard');
        addNotification('info', 'Workspace Deleted', 'This workspace has been deleted by the owner.', `delete-${spaceId}`);
      }
    });

    socket.on('user_left_space', ({ spaceId, userId }) => {
      console.log(`[DEBUG] Socket event user_left_space received. Space ID: ${spaceId}, User ID: ${userId}`);
      removeMemberFromSpace(spaceId, userId);

      if (userId.toString() === user?._id?.toString()) {
        fetchMySpaces();
        if (currentSpace && (currentSpace._id || currentSpace).toString() === spaceId.toString()) {
          navigate('/dashboard');
          addNotification('info', 'Left Workspace', 'You have left the workspace.', `left-${spaceId}`);
        }
      }
    });

    socket.on('ai_message_chunk', ({ messageId, fullText }) => {
      console.log('[DEBUG] Socket ai_message_chunk received:', messageId, 'content length:', fullText.length);
      updateMessageContentLocally(messageId, fullText, true);
    });

    socket.on('ai_message_complete', ({ messageId, fullText }) => {
      console.log('[DEBUG] Socket ai_message_complete received:', messageId);
      updateMessageContentLocally(messageId, fullText, false);
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('new_message');
      socket.off('message_deleted');
      socket.off('user_typing');
      socket.off('reaction_updated');
      socket.off('new_notification');
      socket.off('message_pinned');
      socket.off('message_unpinned');
      socket.off('workspace_deleted');
      socket.off('user_left_space');
      socket.off('ai_message_chunk');
      socket.off('ai_message_complete');
    };
  }, [
    currentSpace,
    addMessage,
    removeMessageLocally,
    setTypingStatus,
    updateMessageReactions,
    addNotification,
    user,
    updateMemberStatus,
    fetchDbNotifications,
    addPinnedMessageLocally,
    removePinnedMessageLocally,
    clearChatState,
    updateMessageContentLocally
  ]);

  // Sync edits state when profile model opens
  useEffect(() => {
    if (activeModal === 'profile' && user) {
      setEditDisplayName(user.displayName || '');
      setEditBio(user.bio || '');
      setEditStatus(user.status || 'online');
    }
  }, [activeModal, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-t-accent-ai border-border-primary animate-spin" />
          <p className="text-sm text-text-secondary animate-pulse">Restoring secure session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Handle Space Creation Submit
  const handleCreateSpaceSubmit = async (e) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    const res = await createNewSpace(newSpaceName, newSpaceDesc, true, newSpaceAI);
    if (res.success) {
      setNewSpaceName('');
      setNewSpaceDesc('');
      setNewSpaceAI(true);
      closeModal();
      navigate(`/space/${res.space._id}`);
      addNotification('success', 'Space Created', `"${res.space.name}" is ready for collaboration.`);
    } else {
      addNotification('error', 'Failed to Create Space', res.error);
    }
  };

  // Handle Profile Update Submit
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const res = await updateProfile(editDisplayName, editBio, user.avatar, editStatus);
    if (res.success) {
      closeModal();
      addNotification('success', 'Profile Updated', 'Your profile adjustments were saved.');
    } else {
      addNotification('error', 'Profile Update Failed', res.error);
    }
  };

  // Handle Join Workspace Submit
  const handleJoinWorkspaceSubmit = async (e) => {
    e.preventDefault();
    const raw = joinLinkInput.trim();
    if (!raw) return;

    // Extract token from full URL or bare token
    let token = raw;
    try {
      const url = new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);
      const joinIdx = parts.indexOf('join');
      if (joinIdx !== -1 && parts[joinIdx + 1]) {
        token = parts[joinIdx + 1];
      } else if (parts.length > 0) {
        token = parts[parts.length - 1];
      }
    } catch {
      // raw is already a bare token, keep as-is
    }

    if (!token) {
      setJoinError('Please enter a valid invite link or token.');
      return;
    }

    setJoinLoading(true);
    setJoinError(null);

    const res = await joinSpaceWithToken(token);
    setJoinLoading(false);

    if (res.success) {
      const msg = res.message || '';
      const alreadyMember = msg.toLowerCase().includes('already a member');
      closeModal();
      setJoinLinkInput('');
      setJoinError(null);
      if (alreadyMember) {
        addNotification('info', 'Already a Member', 'You are already a member of this workspace.');
      } else {
        addNotification('success', 'Joined Workspace', 'Successfully joined the workspace.');
      }
      navigate(`/space/${res.spaceId}`);
    } else {
      const errMsg = res.error || 'Failed to join workspace.';
      if (errMsg.toLowerCase().includes('full') || errMsg.toLowerCase().includes('limit')) {
        setJoinError('Workspace has reached its member limit.');
      } else if (errMsg.toLowerCase().includes('invalid') || errMsg.toLowerCase().includes('inactive') || errMsg.toLowerCase().includes('expired')) {
        setJoinError('Invalid invite link. Please check the link and try again.');
      } else if (errMsg.toLowerCase().includes('already')) {
        setJoinError('You are already a member of this workspace.');
      } else {
        setJoinError(errMsg);
      }
    }
  };

  const renderSidebarContent = (isDrawer = false) => (
    <>
      {/* Sidebar Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-border-primary flex-shrink-0">
        <span
          onClick={() => {
            navigate('/dashboard');
            if (isDrawer) setSidebarOpen(false);
          }}
          className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-ai tracking-wide text-xl cursor-pointer hover:opacity-90 transition-opacity"
        >
          SharedSpace AI
        </span>
        {isDrawer && (
          <button onClick={() => setSidebarOpen(false)} className="p-2 text-text-secondary hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-grow overflow-y-auto px-4 py-6 scroll-gpu">
        {/* Starred Messages Link */}
        <div className="mb-6">
          <button
            onClick={() => {
              navigate('/starred');
              if (isDrawer) setSidebarOpen(false);
            }}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all group ${
              location.pathname === '/starred'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20 font-bold'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-elevated hover:scale-[1.02]'
            }`}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-background-elevated flex items-center justify-center text-xs border border-border-primary text-text-primary font-bold group-hover:border-amber-500 transition-colors">
              <Star className={`w-4 h-4 ${location.pathname === '/starred' ? 'text-amber-300 fill-amber-300' : 'text-amber-500 fill-amber-500'}`} />
            </div>
            <div className="flex-grow min-w-0">
              <span className="truncate">Starred Messages</span>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-between text-xs font-bold text-text-muted tracking-wider uppercase mb-3 px-2">
          <span>Collaborative Spaces</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => openModal('joinWorkspace')}
              className="p-1 hover:text-accent-ai rounded-md hover:bg-background-elevated transition-all"
              title="Join Workspace via Link"
            >
              <LogIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => openModal('createSpace')}
              className="p-1 hover:text-text-primary rounded-md hover:bg-background-elevated transition-all"
              title="Create Space"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {spaces.length === 0 ? (
            <p className="text-xs text-text-muted px-2 py-4 italic">No spaces joined yet.</p>
          ) : (
            spaces.map((space) => {
              const isActive = currentSpace && currentSpace._id === space._id;
              return (
                <button
                  key={space._id}
                  onClick={() => {
                    navigate(`/space/${space._id}`);
                    if (isDrawer) setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-accent-primary text-white shadow-md shadow-accent-primary/20'
                      : 'text-text-secondary hover:text-text-primary hover:bg-background-elevated hover:scale-[1.02]'
                  }`}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-background-elevated flex items-center justify-center text-xs border border-border-primary text-text-primary font-bold group-hover:border-accent-primary transition-colors">
                    {space.avatar ? (
                      <img src={space.avatar} alt="space avatar" className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      space.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{space.name}</span>
                      {space.isPrivate ? <Lock className="w-3 h-3 text-text-muted flex-shrink-0 ml-1.5" /> : null}
                    </div>
                    <p className="text-[10px] text-text-muted truncate mt-0.5">
                      {space.members.length} member{space.members.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Sidebar Bottom Profile Menu */}
      <div className="p-4 border-t border-border-primary bg-background-secondary/50 flex items-center justify-between gap-3 flex-shrink-0">
        <div
          onClick={() => {
            openModal('profile');
            if (isDrawer) setSidebarOpen(false);
          }}
          className="flex items-center gap-3 min-w-0 cursor-pointer group flex-grow"
        >
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-background-elevated border border-border-primary flex items-center justify-center overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-text-secondary" />
              )}
            </div>
            {/* Online Presence Status Dot */}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-background-secondary rounded-full ${
                user.status === 'online'
                  ? 'bg-accent-ai'
                  : user.status === 'away'
                  ? 'bg-amber-500'
                  : 'bg-text-muted'
              }`}
            />
          </div>
          
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-text-primary truncate group-hover:text-accent-ai transition-colors">
              {user.displayName || user.username}
            </h4>
            <p className="text-[11px] text-text-secondary truncate mt-0.5">@{user.username}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              openModal('notifications');
              if (isDrawer) setSidebarOpen(false);
            }}
            className="relative p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-background-elevated transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {dbNotifications.filter((n) => !n.isRead).length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent-ai rounded-full ring-1 ring-background-secondary animate-pulse" />
            )}
          </button>
          <button
            onClick={() => {
              openModal('settings');
              if (isDrawer) setSidebarOpen(false);
            }}
            className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-background-elevated transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={async () => {
              await logoutUser();
              navigate('/');
            }}
            className="p-2 text-text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  const isDetailPage = location.pathname.startsWith('/space/') || location.pathname === '/ai-chat' || location.pathname === '/starred';

  return (

      <div className="min-h-screen bg-background-primary flex text-text-primary overflow-hidden relative" style={{ minHeight: '100dvh' }}>
      
      {/* MOBILE HEADER BAR */}
      {!isDetailPage && (
        <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-background-secondary border-b border-border-primary flex items-center justify-between px-4 z-[99]">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-text-secondary hover:text-text-primary">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-ai tracking-wide text-lg">
            SharedSpace AI
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openModal('notifications')}
              className="relative p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-background-elevated transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {dbNotifications.filter((n) => !n.isRead).length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-accent-ai rounded-full ring-2 ring-background-secondary animate-pulse" />
              )}
            </button>
            <button onClick={() => openModal('profile')} className="w-8 h-8 rounded-full bg-background-elevated overflow-hidden border border-border-primary flex items-center justify-center">
              {user.avatar ? (
                <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-text-secondary" />
              )}
            </button>
          </div>
        </header>
      )}

      {/* 1. DESKTOP SIDEBAR (Static, inline, visible on lg screens and above) */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-background-secondary border-r border-border-primary flex-shrink-0 h-screen">
        {renderSidebarContent(false)}
      </aside>

      {/* 2. MOBILE/TABLET SIDEBAR DRAWER (Animated overlay using Framer Motion) */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] lg:hidden"
            />
            {/* Slide-in sidebar drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="fixed top-0 bottom-0 left-0 z-[120] w-[280px] bg-background-secondary border-r border-border-primary flex flex-col shadow-2xl lg:hidden h-screen"
            >
              {renderSidebarContent(true)}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MAIN VIEW CONTENT CONTAINER */}
      <main className={`flex-grow flex flex-col min-w-0 ${isDetailPage ? 'pt-0' : 'pt-16'} lg:pt-0 h-screen relative`}>
        <Outlet />

        {/* FLOATING AI ASSISTANT WIDGET (Teal, Draggable, Snap-to-Edge, Pulse glow, Floating idle) */}
        <AnimatePresence>
          {location.pathname !== '/ai-chat' && (
            <motion.button
              onClick={() => navigate('/ai-chat', { state: { from: location.pathname } })}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{
                opacity: 1,
                scale: 1,
                boxShadow: [
                  "0px 0px 15px 2px rgba(45, 212, 191, 0.4)",
                  "0px 0px 25px 6px rgba(45, 212, 191, 0.7)",
                  "0px 0px 15px 2px rgba(45, 212, 191, 0.4)"
                ]
              }}
              exit={{ opacity: 0, scale: 0.3 }}
              whileHover={{
                scale: 1.1,
                boxShadow: "0px 0px 25px 8px rgba(45, 212, 191, 0.8)",
              }}
              whileTap={{ scale: 0.95 }}
              transition={{
                boxShadow: { repeat: Infinity, duration: 3, ease: 'easeInOut' },
                scale: { type: 'spring', stiffness: 400, damping: 15 },
                opacity: { duration: 0.2 },
              }}
              style={{
                position: 'fixed',
                right: rightOffset,
                bottom: bottomOffset,
                zIndex: 150,
              }}
              className="w-14 h-14 bg-gradient-to-tr from-accent-ai to-teal-400 hover:from-accent-ai hover:to-teal-300 rounded-full flex items-center justify-center text-white border border-white/20 focus:outline-none cursor-pointer shadow-lg animate-ai-glow"
              title="Chat with AI Assistant"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: 'easeInOut'
                }}
                className="flex items-center justify-center pointer-events-none"
              >
                <Sparkles className="w-6 h-6" />
              </motion.div>
            </motion.button>
          )}
        </AnimatePresence>
      </main>

      {/* MODALS RENDER SECTION */}
      
      {/* 1. Create Space Modal */}
      {activeModal === 'createSpace' && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl scale-in-call relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Plus className="w-6 h-6 text-accent-primary" /> Create Collaboration Space
            </h3>
            <p className="text-xs text-text-secondary mt-1">Setup a space for messaging, file sharing, calling, and AI help.</p>

            <form onSubmit={handleCreateSpaceSubmit} className="mt-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Space Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project Apollo, Friends Hangout"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Description</label>
                <textarea
                  placeholder="What is this space about?"
                  rows={2}
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary resize-none"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-text-primary">Enable AI Assistant</label>
                    <p className="text-[10px] text-text-muted">Allows typing @AI inside the space to prompt Gemini.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={newSpaceAI}
                    onChange={(e) => setNewSpaceAI(e.target.checked)}
                    className="w-5 h-5 accent-accent-ai cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 bg-background-elevated hover:bg-background-elevated/80 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-accent-primary hover:bg-accent-primary/80 rounded-xl text-sm font-semibold text-white transition-all shadow-md shadow-accent-primary/20"
                >
                  Create Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Join Workspace Modal */}
      {activeModal === 'joinWorkspace' && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl scale-in-call relative">
            <button
              onClick={() => { closeModal(); setJoinLinkInput(''); setJoinError(null); }}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <LogIn className="w-6 h-6 text-accent-ai" /> Join Workspace
            </h3>
            <p className="text-xs text-text-secondary mt-1">Paste an invite link to join an existing workspace.</p>

            <form onSubmit={handleJoinWorkspaceSubmit} className="mt-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Invite Link</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="https://sharedspace.ai/join/abc123xyz"
                    value={joinLinkInput}
                    onChange={(e) => { setJoinLinkInput(e.target.value); setJoinError(null); }}
                    className="w-full bg-background-primary border border-border-primary rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-ai placeholder:text-text-muted transition-colors"
                  />
                </div>
                {joinError && (
                  <p className="mt-2 text-xs text-danger flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0" />
                    {joinError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => { closeModal(); setJoinLinkInput(''); setJoinError(null); }}
                  className="flex-1 py-2.5 bg-background-elevated hover:bg-background-elevated/80 rounded-xl text-sm font-semibold transition-all border border-border-primary/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinLoading || !joinLinkInput.trim()}
                  className="flex-1 py-2.5 bg-accent-ai hover:bg-accent-ai/85 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-all shadow-md shadow-accent-ai/20 flex items-center justify-center gap-2"
                >
                  {joinLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" /> Join Workspace
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. User Profile Edit Modal */}
      {activeModal === 'profile' && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl scale-in-call relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <User className="w-5 h-5 text-accent-ai" /> Edit Profile Settings
            </h3>

            <form onSubmit={handleProfileSubmit} className="mt-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Johnny D."
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Status Message</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                >
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="away">Away</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Short Bio (Max 200 chars)</label>
                <textarea
                  placeholder="Tell others a bit about yourself..."
                  rows={3}
                  maxLength={200}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary resize-none"
                />
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 bg-background-elevated hover:bg-background-elevated/80 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-accent-ai hover:bg-accent-ai/80 rounded-xl text-sm font-semibold text-white transition-all shadow-md shadow-accent-ai/20"
                >
                  Save Adjustments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Settings Modal */}
      {activeModal === 'settings' && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl scale-in-call relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Settings className="w-5 h-5 text-accent-primary" /> Application Settings
            </h3>

            <div className="mt-6 flex flex-col gap-4 divide-y divide-border-primary">
              <div className="pt-2">
                <h4 className="text-sm font-semibold text-text-primary">Theme Settings</h4>
                <p className="text-xs text-text-secondary mt-0.5">Choose your preferred color scheme.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { mode: 'dark',  label: 'Dark',  Icon: Moon },
                    { mode: 'light', label: 'Light', Icon: Sun  },
                  ].map(({ mode, label, Icon }) => (
                    <button
                      key={mode}
                      onClick={() => setTheme(mode)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-all ${
                        theme === mode
                          ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                          : 'bg-background-primary border-border-primary text-text-secondary hover:border-accent-primary/50 hover:text-text-primary'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <h4 className="text-sm font-semibold text-text-primary">Connection Check</h4>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent-ai"></span>
                  <span className="text-xs text-text-secondary">WSS Real-time Socket: Connected</span>
                </div>
              </div>

              <div className="pt-4">
                <h4 className="text-sm font-semibold text-text-primary">Account Details</h4>
                <div className="bg-background-primary p-3 rounded-xl border border-border-primary mt-2">
                  <p className="text-xs text-text-secondary"><span className="font-semibold text-text-primary">Username:</span> @{user.username}</p>
                  <p className="text-xs text-text-secondary mt-1"><span className="font-semibold text-text-primary">Email:</span> {user.email}</p>
                </div>
              </div>
            </div>

            <button
              onClick={closeModal}
              className="mt-8 w-full py-2.5 bg-background-elevated hover:bg-background-elevated/80 rounded-xl text-sm font-semibold transition-all"
            >
              Close Settings
            </button>
          </div>
        </div>
      )}

      {/* 4. Notifications Modal */}
      {activeModal === 'notifications' && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl scale-in-call relative flex flex-col max-h-[90vh]">
            <button onClick={closeModal} className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Bell className="w-5 h-5 text-accent-ai" /> Notifications
              </h3>
              {dbNotifications.length > 0 && (
                <button
                  onClick={clearDbNotifications}
                  className="text-xs text-text-muted hover:text-danger flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-danger/10 transition-all font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="flex-grow overflow-y-auto mt-4 pr-1 flex flex-col gap-3 scroll-gpu">
              {dbNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-background-elevated border border-border-primary flex items-center justify-center text-text-muted mb-3">
                    <Bell className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-text-primary">All caught up!</h4>
                  <p className="text-xs text-text-muted mt-1 max-w-[200px]">You have no unread notifications at the moment.</p>
                </div>
              ) : (
                dbNotifications.map((notif) => {
                  return (
                    <div
                      key={notif._id}
                      onClick={() => {
                        if (!notif.isRead) {
                          markDbNotificationRead(notif._id);
                        }
                        if (notif.metadata && notif.metadata.spaceId) {
                          navigate(`/space/${notif.metadata.spaceId}`);
                        }
                        closeModal();
                      }}
                      className={`group p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex gap-3 ${
                        notif.isRead
                          ? 'bg-background-primary/30 border-border-primary/50 opacity-70 hover:opacity-100 hover:bg-background-primary/50'
                          : 'bg-background-elevated/40 border-accent-ai/20 shadow-sm hover:bg-background-elevated/75 hover:border-accent-ai/40'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <span
                          className={`w-2 h-2 rounded-full block ${
                            notif.isRead ? 'bg-transparent' : 'bg-accent-ai animate-pulse'
                          }`}
                        />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-text-primary truncate">{notif.title}</h4>
                          <span className="text-[10px] text-text-muted whitespace-nowrap">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary mt-1 break-words leading-relaxed">{notif.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={closeModal}
              className="mt-6 w-full py-2.5 bg-background-elevated hover:bg-background-elevated/80 rounded-xl text-sm font-semibold transition-all border border-border-primary"
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}

      {/* TOAST SYSTEM ALERTS CONTAINER */}
      <ToastContainer />

      </div>

  );
};

export default ProtectedLayout;
