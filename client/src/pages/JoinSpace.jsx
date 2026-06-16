import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSpaceStore } from '../stores/spaceStore';
import { useUiStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, User, ArrowRight, LogIn, Compass, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

const JoinSpace = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { joinSpaceWithToken } = useSpaceStore();
  const { addNotification } = useUiStore();
  const { isAuthenticated, user, loading: authLoading, checkAuth } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);

  // Fetch invite link preview details publicly on mount
  useEffect(() => {
    const fetchInviteDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/spaces/invite/${token}`);
        setInviteData(res.data);
      } catch (err) {
        const errMsg = err.response?.data?.message || 'The invite link is invalid, expired, or has been revoked.';
        setError(errMsg);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchInviteDetails();
    }
  }, [token]);

  // Ensure session status is checked
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Helper to extract member initials
  const getInitials = (name) => {
    if (!name) return '??';
    return name.substring(0, 2).toUpperCase();
  };

  // Determine if the authenticated user is already a member of the workspace
  const isMember = inviteData?.members?.some(
    (m) => isAuthenticated && user && (m.username === user.username)
  );

  const handleAction = async () => {
    if (!isAuthenticated) {
      // Unauthenticated: save invite to localStorage and redirect to login page
      localStorage.setItem('pendingInvite', `/join/${token}`);
      addNotification('warning', 'Authentication Required', 'Please sign in or create an account to join this space.');
      navigate(`/login?next=/join/${token}`);
      return;
    }

    if (isMember) {
      // Already a member: navigate directly to the workspace chat
      // We need to fetch the spaceId by trying to join or redirecting
      // Since joinSpaceWithToken returns spaceId even if already a member, we call it
      setJoining(true);
      const res = await joinSpaceWithToken(token);
      setJoining(false);
      if (res.success) {
        navigate(`/space/${res.spaceId}`);
      } else {
        addNotification('error', 'Navigation Failed', res.error || 'Failed to enter workspace.');
      }
      return;
    }

    // Authenticated & Not Member: Join the space
    setJoining(true);
    const res = await joinSpaceWithToken(token);
    setJoining(false);

    if (res.success) {
      addNotification('success', 'Joined Workspace', res.message || 'Successfully added to the space.');
      navigate(`/space/${res.spaceId}`);
    } else {
      addNotification('error', 'Join Failed', res.error || 'Could not join this workspace.');
    }
  };

  // Render loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center font-sans text-text-primary relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute w-[500px] aspect-square rounded-full bg-accent-primary/5 blur-[120px] pointer-events-none -top-12 -left-12" />
        <div className="absolute w-[500px] aspect-square rounded-full bg-accent-ai/5 blur-[120px] pointer-events-none -bottom-12 -right-12" />
        
        <div className="flex flex-col items-center gap-4 text-center z-10">
          <div className="w-12 h-12 rounded-full border-4 border-t-accent-primary border-border-primary animate-spin" />
          <h3 className="text-sm font-semibold text-text-primary">Loading invite details...</h3>
          <p className="text-xs text-text-secondary">Verifying link validity and workspace availability.</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4 relative font-sans text-text-primary overflow-hidden">
        <div className="absolute w-[500px] aspect-square rounded-full bg-danger/5 blur-[120px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-background-secondary border border-border-primary rounded-3xl p-8 max-w-md w-full shadow-2xl relative z-10 text-center flex flex-col items-center gap-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">Invalid Invite Link</h2>
            <p className="text-sm text-text-secondary mt-2">{error}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-background-elevated hover:bg-background-elevated/85 text-text-primary font-bold rounded-xl transition-all border border-border-primary/50 flex items-center justify-center gap-2"
          >
            <Compass className="w-4 h-4" /> Go to Homepage
          </button>
        </motion.div>
      </div>
    );
  }

  const { spaceName, ownerName, members, usageLimit, currentCount, availableSlots, isFull } = inviteData;
  const isMaxMembersLimit = usageLimit !== -1;
  const percentFilled = isMaxMembersLimit ? Math.min(100, (currentCount / usageLimit) * 100) : 0;

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4 relative font-sans text-text-primary overflow-hidden">
      
      {/* Dynamic Background Radial Glows */}
      <div className="absolute w-[600px] aspect-square rounded-full bg-accent-primary/5 blur-[130px] pointer-events-none -top-20 -left-20 animate-pulse-slow" />
      <div className="absolute w-[600px] aspect-square rounded-full bg-accent-ai/5 blur-[130px] pointer-events-none -bottom-20 -right-20 animate-pulse-slow" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="bg-background-secondary/90 backdrop-blur-md border border-border-primary rounded-3xl p-8 max-w-lg w-full shadow-2xl relative z-10 overflow-hidden"
      >
        {/* Workspace Brand Badge */}
        <div className="flex justify-center mb-6">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-accent-primary/10 border border-accent-primary/30 text-accent-primary flex items-center gap-1.5 shadow-sm">
            <Sparkles className="w-3 h-3 animate-pulse" /> Workspace Invitation
          </span>
        </div>

        {/* Workspace info header */}
        <div className="text-center flex flex-col items-center gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-accent-primary to-accent-ai bg-clip-text text-transparent break-words max-w-full px-2">
            {spaceName}
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1 bg-background-primary/40 px-3 py-1 rounded-full border border-border-primary/20">
            <User className="w-3.5 h-3.5 text-accent-ai" />
            <span>Created by <strong className="text-text-primary font-semibold">{ownerName}</strong></span>
          </div>
        </div>

        {/* Member slots / Progress meter */}
        <div className="bg-background-primary/40 border border-border-primary/40 rounded-2xl p-4 flex flex-col gap-3 mt-6">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-text-secondary flex items-center gap-1.5">
              <Users className="w-4 h-4 text-accent-primary" /> Workspace Capacity
            </span>
            <span className="text-text-primary">
              {isMaxMembersLimit ? `${currentCount} / ${usageLimit} Members` : `${currentCount} Members (Unlimited)`}
            </span>
          </div>

          {isMaxMembersLimit && (
            <div className="w-full bg-background-elevated h-2.5 rounded-full overflow-hidden border border-border-primary/20">
              <div 
                className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                  isFull ? 'from-danger to-red-600' : 'from-accent-primary to-accent-ai'
                }`}
                style={{ width: `${percentFilled}%` }}
              />
            </div>
          )}

          {isMaxMembersLimit && !isFull && (
            <div className="text-[11px] text-accent-ai font-medium text-right">
              {availableSlots} {availableSlots === 1 ? 'slot' : 'slots'} available
            </div>
          )}

          {/* If the space is full, display the strict enforcement warning block */}
          <AnimatePresence>
            {isFull && !isMember && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-1 bg-danger/10 border border-danger/35 rounded-xl p-3 flex items-start gap-2.5 text-xs text-danger"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="font-medium leading-relaxed">
                  Workspace is full. This workspace has reached its member limit.
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Current Members Grid */}
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 px-1">
            Current Members ({members.length})
          </h3>
          {members.length === 0 ? (
            <div className="text-center py-4 bg-background-primary/20 rounded-2xl border border-dashed border-border-primary/40 text-xs text-text-muted">
              No members in this space yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 max-h-[160px] overflow-y-auto pr-1">
              {members.map((member, idx) => {
                const isMe = isAuthenticated && user && member.username === user.username;
                return (
                  <div 
                    key={idx} 
                    className={`flex items-center gap-2.5 p-2 rounded-xl transition-all border ${
                      isMe 
                        ? 'bg-accent-primary/5 border-accent-primary/20' 
                        : 'bg-background-primary/30 border-border-primary/20 hover:bg-background-elevated/30'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-background-elevated border border-border-primary overflow-hidden flex items-center justify-center text-xs font-bold text-text-primary">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.displayName || member.username} className="w-full h-full object-cover" />
                        ) : (
                          getInitials(member.displayName || member.username)
                        )}
                      </div>
                      {/* Presence Indicator */}
                      <span className={`absolute bottom-0 right-0 w-2 h-2 border border-background-secondary rounded-full ${
                        member.status === 'online' 
                          ? 'bg-accent-ai' 
                          : member.status === 'away' 
                          ? 'bg-amber-500' 
                          : 'bg-text-muted'
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-primary truncate">
                        {member.displayName || member.username}
                      </p>
                      <p className="text-[10px] text-text-secondary truncate flex items-center gap-1">
                        @{member.username} {isMe && <span className="text-[9px] bg-accent-primary/20 text-accent-primary px-1 rounded font-bold">You</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action button row */}
        <div className="mt-8 flex flex-col gap-3">
          {isFull && !isMember ? (
            <button
              disabled
              className="w-full py-3.5 bg-text-muted/40 text-text-muted font-bold rounded-xl cursor-not-allowed border border-border-primary/30 text-sm flex items-center justify-center gap-2"
            >
              Workspace Full
            </button>
          ) : (
            <button
              onClick={handleAction}
              disabled={joining}
              className={`w-full py-3.5 font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm text-white ${
                isMember 
                  ? 'bg-accent-ai hover:bg-accent-ai/90 shadow-accent-ai/20' 
                  : isAuthenticated
                  ? 'bg-accent-primary hover:bg-accent-primary/90 shadow-accent-primary/20'
                  : 'bg-accent-primary hover:bg-accent-primary/90 shadow-accent-primary/20'
              }`}
            >
              {joining ? (
                <>
                  <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : isMember ? (
                <>
                  <span>Enter Workspace</span> <ArrowRight className="w-4 h-4" />
                </>
              ) : isAuthenticated ? (
                <>
                  <span>Join Workspace</span> <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> <span>Sign In to Join</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 bg-transparent hover:bg-background-elevated/20 text-text-secondary hover:text-text-primary text-xs font-semibold rounded-xl transition-all border border-transparent hover:border-border-primary/30 flex items-center justify-center gap-1.5"
          >
            Go to Dashboard
          </button>
        </div>

      </motion.div>
    </div>
  );
};

export default JoinSpace;
