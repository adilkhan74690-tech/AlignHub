import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '../services/api';
import { Share2, Lock, Mail, User, Loader2, ArrowLeft } from 'lucide-react';
import logo from '../assets/AlignHub.png';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all the required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.auth.register({ name, email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed. This email might already be registered.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden" id="register-container">
      {/* Background ambient decorative shapes (subtle, non-distracting) */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-200/30 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-purple-200/20 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Return to home link */}
      <div className="absolute top-6 left-6" id="register-back-nav">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition duration-200 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Entrance</span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10" id="register-header-block">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex justify-center mb-5"
          id="register-logo-wrapper"
        >
          <img src={logo} alt="AlignHub Logo" className="h-10 w-auto object-contain" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-center text-3xl font-display font-extrabold text-slate-900 tracking-tight"
          id="register-title"
        >
          Create Your Account
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-2 text-center text-xs text-slate-400 font-medium"
          id="register-subtitle"
        >
          Establish your own real-time hub and invite your squad.
        </motion.p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10" id="register-form-wrapper">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white py-8 px-6 border border-slate-200/80 shadow-xl rounded-3xl sm:px-10"
          id="register-card"
        >
          <form className="space-y-5" onSubmit={handleRegister} id="register-form">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl"
                id="register-error-banner"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label htmlFor="name" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Full Name
              </label>
              <div className="mt-1.5 relative rounded-xl" id="name-input-wrapper">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-xs placeholder-slate-400 focus:outline-none transition-all bg-slate-50/30 focus:bg-white"
                />
              </div>
            </div>

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
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@school.edu"
                  className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-xs placeholder-slate-400 focus:outline-none transition-all bg-slate-50/30 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <div className="mt-1.5 relative rounded-xl" id="password-input-wrapper">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-xs placeholder-slate-400 focus:outline-none transition-all bg-slate-50/30 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 hover:shadow-indigo-100 shadow-md active:scale-98 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
                id="register-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Spinning up your account...</span>
                  </>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6 text-center" id="register-footer">
            <span className="text-slate-400 text-xs">Already have an account? </span>
            <Link to="/login" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition" id="register-login-link">
              Sign In
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
