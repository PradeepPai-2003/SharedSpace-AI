import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../stores/authStore';
import { useSpaceStore } from '../stores/spaceStore';
import { useUiStore } from '../stores/uiStore';
import { Sparkles, Bot, Plus, Users, MessageSquare, ArrowRight, FileText, LogIn } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
    }))
  );
  const { spaces, clearCurrentSpace } = useSpaceStore(
    useShallow((state) => ({
      spaces: state.spaces,
      clearCurrentSpace: state.clearCurrentSpace,
    }))
  );
  const { openModal } = useUiStore(
    useShallow((state) => ({
      openModal: state.openModal,
    }))
  );
  const navigate = useNavigate();

  const handleCardClick = (e, callback) => {
    // Prevent navigation if user is selecting or highlighting text
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }
    callback();
  };

  // Make sure we clear active space when on dashboard so socket events are managed correctly
  useEffect(() => {
    clearCurrentSpace();
  }, [clearCurrentSpace]);

  return (
    <div className="flex-grow p-6 md:p-10 overflow-y-auto max-w-5xl mx-auto w-full flex flex-col justify-start scroll-gpu">
      
      {/* Header welcome banner */}
      <div className="mb-10">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-text-primary">
          Good day, <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-ai">{user.displayName || user.username}</span>
        </h1>
        <p className="text-sm text-text-secondary mt-2">
          Welcome to your SharedSpace. Select a collaboration space below or create a new one to begin.
        </p>
      </div>

      {/* Suggested Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
        {/* Create Space card */}
        <div
          onClick={(e) => handleCardClick(e, () => openModal('createSpace'))}
          className="bg-background-secondary border border-border-primary hover:border-accent-primary/60 hover:scale-[1.02] hover:shadow-accent-primary/10 hover:shadow-2xl p-6 rounded-2xl cursor-pointer group transition-all duration-300 flex flex-col"
        >
          <div className="w-12 h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center mb-4 text-accent-primary group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-text-primary group-hover:text-accent-primary transition-colors flex items-center gap-2">
            Create Space <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-5px] group-hover:translate-x-0" />
          </h3>
          <p className="text-xs text-text-secondary mt-2 leading-relaxed">
            Initialize a workspace, invite members with shareable tokens, and collaborate instantly on files, messaging, and AI assistance.
          </p>
        </div>

        {/* Join Workspace card */}
        <div
          onClick={(e) => handleCardClick(e, () => openModal('joinWorkspace'))}
          className="bg-background-secondary border border-border-primary hover:border-accent-ai/60 hover:scale-[1.02] hover:shadow-accent-ai/10 hover:shadow-2xl p-6 rounded-2xl cursor-pointer group transition-all duration-300 flex flex-col"
        >
          <div className="w-12 h-12 bg-accent-ai/10 rounded-xl flex items-center justify-center mb-4 text-accent-ai group-hover:scale-110 transition-transform">
            <LogIn className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-text-primary group-hover:text-accent-ai transition-colors flex items-center gap-2">
            Join Workspace <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-5px] group-hover:translate-x-0" />
          </h3>
          <p className="text-xs text-text-secondary mt-2 leading-relaxed">
            Join an existing workspace using an invite link shared by the workspace owner.
          </p>
        </div>

        {/* AI Chat Card */}
        <div
          onClick={(e) => handleCardClick(e, () => navigate('/ai-chat', { state: { from: '/dashboard' } }))}
          className="bg-background-secondary border border-border-primary hover:border-accent-ai/60 hover:scale-[1.02] hover:shadow-accent-ai/10 hover:shadow-2xl p-6 rounded-2xl cursor-pointer group transition-all duration-300 flex flex-col"
        >
          <div className="w-12 h-12 bg-accent-ai/10 rounded-xl flex items-center justify-center mb-4 text-accent-ai group-hover:scale-110 transition-transform">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-text-primary group-hover:text-accent-ai transition-colors flex items-center gap-2">
            AI Assistant Chat <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-5px] group-hover:translate-x-0" />
          </h3>
          <p className="text-xs text-text-secondary mt-2 leading-relaxed">
            Access your private 1-to-1 AI assistant window. Leverage long-term persistent memory and context-aware Gemini model support.
          </p>
        </div>
      </div>

      {/* Spaces Listing inside Dashboard */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-sm font-bold text-text-muted tracking-wider uppercase">Joined Spaces ({spaces.length})</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openModal('joinWorkspace')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-background-secondary hover:bg-background-elevated border border-border-primary hover:border-accent-ai/40 rounded-xl text-xs font-semibold text-text-secondary hover:text-accent-ai transition-all"
            >
              <LogIn className="w-3.5 h-3.5" /> Join
            </button>
            <button
              onClick={() => openModal('createSpace')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/85 rounded-xl text-xs font-semibold text-white transition-all shadow-md shadow-accent-primary/10"
            >
              <Plus className="w-3.5 h-3.5" /> Create
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {spaces.length === 0 ? (
            <div className="col-span-full bg-background-secondary/50 border border-border-primary border-dashed p-8 rounded-2xl text-center flex flex-col items-center justify-center gap-3">
              <Users className="w-8 h-8 text-text-muted" />
              <p className="text-xs text-text-secondary">You haven't joined any collaboration spaces yet.</p>
              <button
                onClick={() => openModal('createSpace')}
                className="mt-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/85 rounded-xl text-xs font-semibold text-white transition-all shadow-md shadow-accent-primary/10"
              >
                Create a Space
              </button>
            </div>
          ) : (
            spaces.map((space) => (
              <div
                key={space._id}
                onClick={(e) => handleCardClick(e, () => navigate(`/space/${space._id}`))}
                className="bg-background-secondary border border-border-primary hover:border-accent-primary p-4 rounded-xl cursor-pointer hover:shadow-lg transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-background-elevated border border-border-primary flex items-center justify-center font-bold text-sm">
                  {space.avatar ? (
                    <img src={space.avatar} alt="avatar" className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    space.name.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-text-primary truncate">{space.name}</h4>
                  <p className="text-[10px] text-text-secondary mt-0.5">{space.members.length} members joined</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Features Showcase Panel */}
      <div className="mt-8 border-t border-border-primary/50 pt-8">
        <h3 className="text-xs font-bold text-text-muted tracking-wider uppercase mb-6 px-2">Capabilities Checklist</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 px-2">
          <div className="flex gap-3 items-start">
            <MessageSquare className="w-5 h-5 text-accent-primary mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-text-primary">Real-time Sockets</h4>
              <p className="text-[10px] text-text-secondary mt-1">Typing indicators, message reactions, read status, and live presence status indicators.</p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <Sparkles className="w-5 h-5 text-accent-ai mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-text-primary">AI Integration</h4>
              <p className="text-[10px] text-text-secondary mt-1">Chat directly with an AI assistant or invite @AI into your workspace to help your team.</p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <FileText className="w-5 h-5 text-text-secondary mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-text-primary">Cloud Storage</h4>
              <p className="text-[10px] text-text-secondary mt-1">Secure media uploads up to 20MB directly integrated to Cloudinary with file previews.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
