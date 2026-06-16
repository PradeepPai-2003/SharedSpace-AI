import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';

const Register = () => {
  const { registerUser, error, clearError, isAuthenticated } = useAuthStore();
  const { addNotification } = useUiStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const nextParam = queryParams.get('next');
  const redirectTarget = nextParam || localStorage.getItem('pendingInvite') || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.removeItem('pendingInvite');
      navigate(redirectTarget, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTarget]);

  useEffect(() => {
    clearError();
    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    // Check basic inputs
    if (username.length < 3 || username.length > 30) {
      setLocalError('Username must be between 3 and 30 characters');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    const res = await registerUser(username, email, password);
    setSubmitting(false);

    if (res.success) {
      localStorage.removeItem('pendingInvite');
      addNotification('success', 'Registration Completed', `Welcome to SharedSpace AI, @${username}!`);
      navigate(redirectTarget, { replace: true });
    } else {
      addNotification('error', 'Registration Failed', res.error || 'Check fields and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4 relative font-sans">
      
      {/* Background glow */}
      <div className="absolute w-[450px] aspect-square rounded-full bg-accent-ai/5 blur-[100px] pointer-events-none" />

      <div className="bg-background-secondary border border-border-primary rounded-2xl p-8 max-w-md w-full shadow-2xl relative z-10 scale-in-call">
        
        {/* Header */}
        <div className="text-center flex flex-col items-center">
          <span 
            onClick={() => navigate('/')}
            className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-ai tracking-wide text-2xl cursor-pointer"
          >
            SharedSpace AI
          </span>
          <h2 className="text-xl font-bold mt-4 text-text-primary">Create Account</h2>
          <p className="text-xs text-text-secondary mt-1">Get started collaborating with humans and AI.</p>
        </div>

        {/* Error panel */}
        {(localError || error) && (
          <div className="mt-6 bg-danger/10 border border-danger/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-danger animate-fade-in">
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">Username</label>
            <input
              type="text"
              required
              placeholder="e.g. alex_dev"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))} // strip spaces
              className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary placeholder-text-muted"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="e.g. alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary placeholder-text-muted"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary placeholder-text-muted"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">Confirm Password</label>
            <input
              type="password"
              required
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary placeholder-text-muted"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 w-full py-3 bg-accent-ai hover:bg-accent-ai/90 disabled:bg-accent-ai/50 text-white font-bold rounded-xl transition-all shadow-md shadow-accent-ai/25 flex items-center justify-center gap-2"
          >
            {submitting ? 'Registering...' : 'Register'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Redirect sign in */}
        <div className="mt-8 text-center text-xs text-text-secondary border-t border-border-primary/50 pt-6">
          Already have an account?{' '}
          <Link 
            to={nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : "/login"} 
            className="font-semibold text-accent-primary hover:underline"
          >
            Sign in
          </Link>
        </div>

      </div>

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
      `}</style>
    </div>
  );
};

export default Register;
