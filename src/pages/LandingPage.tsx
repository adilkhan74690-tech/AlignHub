import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Share2, ArrowRight, ShieldCheck, Zap, Globe, FileText, Kanban, MessageSquare } from 'lucide-react';
import logo from '../assets/AlignHub.png';

export default function LandingPage() {
  const navigate = useNavigate();

  // Redirect to dashboard immediately if already authenticated
  useEffect(() => {
    const token = localStorage.getItem('alignhub_token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] relative overflow-hidden" id="landing-container">
      {/* Decorative background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-white to-white pointer-events-none"></div>

      {/* Tiny minimalist Header */}
      <header className="px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 max-w-7xl mx-auto" id="landing-header">
        <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => navigate('/')} id="landing-logo-block">
          <img src={logo} alt="AlignHub Logo" className="h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-105" id="landing-header-logo" />
          <span className="text-xl font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-slate-900">AlignHub</span>
        </div>
        <div className="flex items-center gap-4" id="landing-nav-actions">
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-semibold text-slate-600 hover:text-indigo-600 px-4 py-2 rounded-xl transition duration-200 min-h-[44px]"
            id="landing-btn-signin"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/register')}
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition duration-200 shadow-lg shadow-indigo-100 min-h-[44px]"
            id="landing-btn-signup"
          >
            Create Free Account
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-16 sm:pt-24 pb-20 sm:pb-32 text-center" id="landing-main">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-extrabold text-slate-900 tracking-tight leading-tight max-w-3xl mx-auto">
            One Workspace. Real-Time Collaboration.
          </h1>
          <p className="mt-6 text-sm sm:text-lg text-slate-600 max-w-xl mx-auto">
            AlignHub allows teams to chat, manage tasks, share notes and collaborate in real time—all in one unified, high-performance environment.
          </p>
          <div className="mt-10 flex gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3.5 rounded-xl transition duration-200 text-sm min-h-[44px]"
              id="hero-cta-btn"
            >
              Get Started for Free
            </button>
          </div>
        </motion.div>
      </main>

      {/* Features Section */}
      <section className="py-24 bg-white" id="landing-features">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8">
          {[
            { icon: MessageSquare, title: 'Real-Time Chat', desc: 'Instant communication with team channels and direct messaging.' },
            { icon: FileText, title: 'Shared Notes', desc: 'Collaborative documents that auto-sync across all team devices.' },
            { icon: Kanban, title: 'Kanban Task Board', desc: 'Visualize work progress with drag-and-drop tasks and workflows.' }
          ].map((feature, idx) => (
            <div key={idx} className="p-8 rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-200">
              <div className="bg-indigo-50 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <feature.icon className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-slate-500 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-24" id="landing-how-it-works">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900">How it works</h2>
          <div className="mt-16 grid md:grid-cols-3 gap-12">
            {[
              { icon: Zap, title: 'Create Workspace' },
              { icon: FileText, title: 'Invite Members' },
              { icon: MessageSquare, title: 'Collaborate in Real Time' }
            ].map((step, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6">
                  <step.icon className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-indigo-50/50 text-center" id="landing-cta">
        <h2 className="text-4xl font-bold text-slate-900">Ready to get aligned?</h2>
        <p className="mt-4 text-slate-600">Join teams delivering their best work with AlignHub.</p>
        <button
          onClick={() => navigate('/register')}
          className="mt-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3.5 rounded-xl transition duration-200 text-sm"
        >
          Get Started for Free
        </button>
      </section>

      {/* Tiny, clean professional footer */}
      <footer className="px-8 py-12 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4" id="landing-footer">
        <div className="flex items-center gap-2">
          <img src={logo} alt="AlignHub Logo" className="h-6 w-auto object-contain" id="landing-footer-logo" />
          <span className="ml-1">Enterprise Collaborative Platform</span>
        </div>
        <div>
          <span>&copy; {new Date().getFullYear()} AlignHub. Built for high-performance squads.</span>
        </div>
      </footer>
    </div>
  );

}
