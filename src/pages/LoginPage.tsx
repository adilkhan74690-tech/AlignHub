import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '../services/api';
import { Share2, Lock, Mail, Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.auth.login({ email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden" id="login-container">
      {/* Background ambient decorative shapes (subtle, non-distracting) */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-200/30 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-purple-200/20 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Return to home link */}
      <div className="absolute top-6 left-6" id="login-back-nav">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition duration-200 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Entrance</span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10" id="login-header-block">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex justify-center mb-5"
          id="login-logo-wrapper"
        >
          <img src="/assets/AlignHub.png" alt="AlignHub Logo" className="h-10 w-auto object-contain" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-center text-3xl font-display font-extrabold text-slate-900 tracking-tight"
          id="login-title"
        >
          Sign In to AlignHub
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-2 text-center text-xs text-slate-400 font-medium"
          id="login-subtitle"
        >
          Access your workspaces and resume real-time collaboration.
        </motion.p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10" id="login-form-wrapper">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white py-8 px-6 border border-slate-200/80 shadow-xl rounded-3xl sm:px-10"
          id="login-card"
        >
          <form className="space-y-5" onSubmit={handleLogin} id="login-form">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl"
                id="login-error-banner"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Email Address
              </label>
              <div className="mt-1.5 relative rounded-xl" id="email-input-wrapper">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@school.edu"
                  className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-xs placeholder-slate-400 focus:outline-none transition-all bg-slate-50/30 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Password
                </label>
              </div>
              <div className="mt-1.5 relative rounded-xl" id="password-input-wrapper">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-xs placeholder-slate-400 focus:outline-none transition-all bg-slate-50/30 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 hover:shadow-indigo-100 shadow-md active:scale-98 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
                id="login-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying session...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6 text-center" id="login-footer">
            <span className="text-slate-400 text-xs">New to AlignHub? </span>
            <Link to="/register" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition" id="login-register-link">
              Create a free account
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
