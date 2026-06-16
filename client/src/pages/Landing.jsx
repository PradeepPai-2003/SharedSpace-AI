import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { useSpaceStore } from '../stores/spaceStore';
import { useUiStore } from '../stores/uiStore';
import { ArrowRight, Sparkles, MessageSquare, Users, X, Bot, Sun, Moon } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

const fadeUpVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 140,
    },
  },
};

const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5 },
  },
};

const Landing = () => {
  const { isAuthenticated } = useAuthStore();
  const { joinSpaceWithToken } = useSpaceStore();
  const { addNotification, theme, toggleTheme } = useUiStore();
  const navigate = useNavigate();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [joining, setJoining] = useState(false);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/register');
    }
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (!inviteToken.trim()) return;

    // Token can be a full URL (e.g. localhost:5173/join/uuid) or just the UUID token itself
    const cleanToken = inviteToken.includes('/join/') 
      ? inviteToken.split('/join/')[1].trim()
      : inviteToken.trim();

    setInviteModalOpen(false);
    setInviteToken('');
    navigate(`/join/${cleanToken}`);
  };

  return (
    <div className="min-h-screen bg-background-primary flex flex-col text-text-primary relative font-sans">
      
      {/* BACKGROUND GRADIENT ORBS - GPU ACCELERATED LAYER */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] aspect-square rounded-full bg-accent-primary/10 blur-[120px] pointer-events-none scroll-gpu" />
      <div className="absolute bottom-[-10%] right-[-15%] w-[60%] aspect-square rounded-full bg-accent-ai/10 blur-[150px] pointer-events-none scroll-gpu" />

      {/* HEADER NAVIGATION */}
      <motion.header 
        initial="hidden"
        animate="visible"
        variants={fadeInVariants}
        className="max-w-7xl mx-auto w-full px-6 h-20 flex items-center justify-between z-10"
      >
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-ai tracking-wide text-2xl">
            SharedSpace AI
          </span>
        </div>

        <nav className="flex items-center gap-6">
          <button
            onClick={toggleTheme}
            className="p-2 text-text-secondary hover:text-text-primary rounded-xl hover:bg-background-secondary border border-border-primary/50 transition-all cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {isAuthenticated ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 bg-background-elevated hover:bg-background-elevated/80 border border-border-primary rounded-xl text-sm font-semibold transition-all hover:scale-105"
            >
              Dashboard
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/90 rounded-xl text-sm font-semibold text-white transition-all shadow-md shadow-accent-primary/10 hover:scale-105"
              >
                Get Started
              </button>
            </>
          )}
        </nav>
      </motion.header>

      {/* HERO SECTION */}
      <motion.main 
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="flex-grow max-w-7xl mx-auto w-full px-6 flex flex-col items-center justify-center text-center py-20 z-10"
      >
        
        {/* Glowing Badge */}
        <motion.div 
          variants={fadeUpVariants}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent-ai/10 border border-accent-ai/20 rounded-full text-xs font-semibold text-accent-ai mb-6 animate-pulse"
        >
          <Sparkles className="w-4 h-4" /> Real People and AI Sharing the Same Space
        </motion.div>

        <motion.h1 
          variants={fadeUpVariants}
          className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl text-text-primary leading-[1.1] md:leading-[1.15]"
        >
          Where Humans and <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-ai to-teal-400">Intelligent AI</span> Collaborate in Real-Time
        </motion.h1>

        <motion.p 
          variants={fadeUpVariants}
          className="text-base md:text-xl text-text-secondary mt-6 max-w-2xl leading-relaxed"
        >
          SharedSpace AI brings real-time collaboration, file sharing, AI-powered conversations, and persistent workspace memory into a single frictionless space.
        </motion.p>

        {/* Call to Actions */}
        <motion.div 
          variants={fadeUpVariants}
          className="flex flex-col sm:flex-row gap-4 mt-10 w-full sm:w-auto"
        >
          <button
            onClick={handleGetStarted}
            className="px-8 py-4 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-accent-primary/20"
          >
            Get Started Free <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => setInviteModalOpen(true)}
            className="px-8 py-4 bg-background-secondary hover:bg-background-elevated border border-border-primary rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
          >
            Join via Invite Link
          </button>
        </motion.div>

        {/* FEATURES GRID - SCROLL REVEAL SECTION */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 w-full max-w-5xl text-left"
        >
          
          {/* Card 1 */}
          <motion.div 
            variants={fadeUpVariants}
            className="bg-background-secondary border border-border-primary p-6 rounded-2xl shadow-lg hover:border-accent-primary/60 hover:scale-[1.02] hover:shadow-accent-primary/10 hover:shadow-2xl cursor-pointer transition-all duration-300 scroll-gpu"
          >
            <div className="w-12 h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center mb-4">
              <Bot className="w-6 h-6 text-accent-primary" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">First-Class AI Participant</h3>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
              AI joins channels as a native member. Prompt the AI using @AI directly in group conversations, or chat 1-on-1 privately.
            </p>
          </motion.div>

          {/* Card 2 */}
          <motion.div 
            variants={fadeUpVariants}
            className="bg-background-secondary border border-border-primary p-6 rounded-2xl shadow-lg hover:border-accent-ai/60 hover:scale-[1.02] hover:shadow-accent-ai/10 hover:shadow-2xl cursor-pointer transition-all duration-300 scroll-gpu"
          >
            <div className="w-12 h-12 bg-accent-ai/10 rounded-xl flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-accent-ai" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">Persistent Context Memory</h3>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
              Gemini remembers past details and preferences. Memory consolidation dynamically compresses logs to preserve context.
            </p>
          </motion.div>

          {/* Card 3 */}
          <motion.div 
            variants={fadeUpVariants}
            className="bg-background-secondary border border-border-primary p-6 rounded-2xl shadow-lg hover:border-sky-500/60 hover:scale-[1.02] hover:shadow-sky-500/10 hover:shadow-2xl cursor-pointer transition-all duration-300 scroll-gpu"
          >
            <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-sky-400" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">Real-Time Collaboration</h3>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
              Collaborate instantly through messaging, file sharing, reactions, pins, AI assistance, and workspace notifications.
            </p>
          </motion.div>
        </motion.section>

        {/* TECHNOLOGY STACK BADGES */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={fadeInVariants}
          className="mt-32 border-t border-border-primary/50 pt-10 w-full max-w-4xl"
        >
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-6">Powered by Industry Standards</p>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 opacity-60">
            <span className="font-bold text-sm">React 18</span>
            <span className="font-bold text-sm">Vite / Tailwind</span>
            <span className="font-bold text-sm">Node.js / Express</span>
            <span className="font-bold text-sm">MongoDB Atlas</span>
            <span className="font-bold text-sm">Socket.IO v4</span>
            <span className="font-bold text-sm">Google Gemini 1.5</span>
          </div>
        </motion.div>

      </motion.main>

      {/* FOOTER */}
      <footer className="h-16 border-t border-border-primary/50 flex items-center justify-center text-xs text-text-muted z-10 bg-background-primary/50 backdrop-blur-sm">
        &copy; 2026 SharedSpace AI. All rights reserved. Built using AI-Agent accelerated development.
      </footer>

      {/* JOIN VIA INVITE MODAL */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-md w-full p-6 shadow-2xl relative scale-in-call">
            <button
              onClick={() => setInviteModalOpen(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-primary" /> Join Workspace Space
            </h3>
            <p className="text-xs text-text-secondary mt-1">Paste the invite code or complete token link received from a member.</p>

            <form onSubmit={handleJoinSubmit} className="mt-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Invite Token or URL</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </div>

              <button
                type="submit"
                disabled={joining}
                className="mt-4 w-full py-3 bg-accent-primary hover:bg-accent-primary/90 disabled:bg-accent-primary/50 text-white rounded-xl font-bold transition-all shadow-md shadow-accent-primary/20 flex items-center justify-center gap-2"
              >
                {joining ? 'Connecting to Space...' : 'Join Collaborative Space'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .scale-in-call {
          animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default Landing;
