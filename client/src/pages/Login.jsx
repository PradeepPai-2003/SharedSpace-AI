import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';

const Login = () => {
  const { loginUser, error, clearError, isAuthenticated } = useAuthStore();
  const { addNotification } = useUiStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  
  const queryParams = new URLSearchParams(location.search);
  const nextParam = queryParams.get('next');
  const redirectTarget = nextParam || location.state?.from?.pathname || localStorage.getItem('pendingInvite') || '/dashboard';

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (isAuthenticated) {
      localStorage.removeItem('pendingInvite');
      navigate(redirectTarget, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTarget]);

  // Clear errors when mounting/unmounting
  useEffect(() => {
    clearError();
    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setSubmitting(true);
    const res = await loginUser(email, password);
    setSubmitting(false);

    if (res.success) {
      localStorage.removeItem('pendingInvite');
      addNotification('success', 'Welcome Back', 'Successfully authenticated into SharedSpace.');
      navigate(redirectTarget, { replace: true });
    } else {
      addNotification('error', 'Authentication Failed', res.error || 'Check your email and password');
    }
  };

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4 relative font-sans">
      
      {/* Background radial glow */}
      <div className="absolute w-[450px] aspect-square rounded-full bg-accent-primary/5 blur-[100px] pointer-events-none" />

      <div className="bg-background-secondary border border-border-primary rounded-2xl p-8 max-w-md w-full shadow-2xl relative z-10 scale-in-call">
        
        {/* Branding header */}
        <div className="text-center flex flex-col items-center">
          <span 
            onClick={() => navigate('/')}
            className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-ai tracking-wide text-2xl cursor-pointer"
          >
            SharedSpace AI
          </span>
          <h2 className="text-xl font-bold mt-4 text-text-primary">Welcome Back</h2>
          <p className="text-xs text-text-secondary mt-1">Sign in to sync your active spaces and AI memories.</p>
        </div>

        {/* Local error banner */}
        {error && (
          <div className="mt-6 bg-danger/10 border border-danger/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-danger">
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary placeholder-text-muted"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 w-full py-3 bg-accent-primary hover:bg-accent-primary/90 disabled:bg-accent-primary/50 text-white font-bold rounded-xl transition-all shadow-md shadow-accent-primary/20 flex items-center justify-center gap-2"
          >
            {submitting ? 'Signing In...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Registration redirect */}
        <div className="mt-8 text-center text-xs text-text-secondary border-t border-border-primary/50 pt-6">
          New to SharedSpace?{' '}
          <Link 
            to={nextParam ? `/register?next=${encodeURIComponent(nextParam)}` : "/register"} 
            className="font-semibold text-accent-ai hover:underline"
          >
            Create an account free
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

export default Login;
