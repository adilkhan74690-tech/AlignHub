import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';
import Avatar from '../components/Avatar';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [taskNotifications, setTaskNotifications] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await api.auth.getMe();
        setUser(res.user);
        setName(res.user.name);
        setEmail(res.user.email);
        
        // Load mock/local storage notification preferences
        const savedEmailNotif = localStorage.getItem('pref_email_notifications');
        const savedTaskNotif = localStorage.getItem('pref_task_notifications');
        if (savedEmailNotif !== null) setEmailNotifications(savedEmailNotif === 'true');
        if (savedTaskNotif !== null) setTaskNotifications(savedTaskNotif === 'true');
      } catch (err) {
        navigate('/login');
      }
    }
    loadUser();
  }, [navigate]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.auth.updateProfile({ name, email, password: password || undefined });
      
      // Save notification preferences
      localStorage.setItem('pref_email_notifications', String(emailNotifications));
      localStorage.setItem('pref_task_notifications', String(taskNotifications));
      
      alert('Profile updated successfully!');
      setPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      setLoading(true);
      try {
        await api.auth.deleteAccount();
        api.auth.logout();
        navigate('/login');
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }
  };

  if (!user) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <h1 className="text-2xl font-display font-black text-slate-900 mb-6">Account Settings</h1>

        {error && <p className="text-rose-600 text-sm mb-4 font-bold">{error}</p>}

        {/* Dynamic Avatar Preview */}
        <div className="flex flex-col items-center gap-2.5 pb-6 border-b border-slate-100 mb-6">
          <Avatar name={name || user.name} size="xl" />
          <div className="text-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Your Generated Avatar</span>
            <span className="text-xs text-slate-400 block mt-0.5">(Updates instantly based on your name)</span>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Leave empty to keep current password"
            />
          </div>

          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Notification Preferences</label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-sm text-slate-600 font-medium">Receive email notifications for updates & mentions</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={taskNotifications}
                  onChange={(e) => setTaskNotifications(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-sm text-slate-600 font-medium">Notify me when tasks are assigned or status changes</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <h2 className="text-lg font-bold text-rose-600 mb-4">Danger Zone</h2>
          <button
            onClick={handleDeleteAccount}
            disabled={loading}
            className="flex items-center gap-2 text-rose-600 font-bold hover:text-rose-700 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
