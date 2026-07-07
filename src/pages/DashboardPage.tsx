import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../services/api';
import logo from '../assets/AlignHub.png';
import { getSocket, resetSocket } from '../services/socket';
import { User, Workspace, Notification, Task, Activity, FileMeta, Note } from '../types';
import Avatar from '../components/Avatar';
import {
  Share2,
  Plus,
  ArrowRight,
  LogOut,
  Bell,
  CheckCircle2,
  Loader2,
  Layers,
  Sparkles,
  Hash,
  Briefcase,
  Clock,
  Globe,
  Copy,
  Check,
  FileText,
  Users,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Download,
  AlertTriangle,
  Flame,
  TrendingUp,
  Inbox,
  Settings as SettingsIcon,
  FileIcon
} from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [recentFiles, setRecentFiles] = useState<FileMeta[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [copiedWsId, setCopiedWsId] = useState<string | null>(null);
  const [activeFormTab, setActiveFormTab] = useState<'create' | 'join'>('create');
  
  // Right sidebar organized tab states
  const [rightTabGroup1, setRightTabGroup1] = useState<'calendar' | 'files'>('calendar');
  const [rightTabGroup2, setRightTabGroup2] = useState<'members' | 'alerts' | 'activity'>('members');
  
  // Form States
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Calendar States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // Workspace Progress Data
  const [wsProgressMap, setWsProgressMap] = useState<Record<string, { total: number; done: number; pct: number }>>({});

  // Real DB stats for each workspace card
  const [workspaceStats, setWorkspaceStats] = useState<Record<string, { members: number; tasks: number; notes: number; files: number }>>({});

  // Real-time online teammates from Socket.IO
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  // Navigation Dropdown States
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  const navigate = useNavigate();

  // Helper: format relative time
  const formatRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Load Initial Data and Consolidate
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const meRes = await api.auth.getMe();
      const currentUser = meRes.user;
      setUser(currentUser);

      const wsList = await api.workspace.getAll();
      setWorkspaces(wsList);

      const notifList = await api.notifications.getAll();
      setNotifications(notifList);

      if (wsList.length > 0) {
        // Fetch tasks, activities, notes, and files across all workspaces in parallel
        const taskPromises = wsList.map(ws => 
          api.tasks.getForWorkspace(ws.id).catch(() => [] as Task[])
        );
        const activityPromises = wsList.map(ws => 
          api.activity.getForWorkspace(ws.id).catch(() => [] as Activity[])
        );
        const filePromises = wsList.map(ws => 
          api.files.getForWorkspace(ws.id).catch(() => [] as FileMeta[])
        );
        const notePromises = wsList.map(ws => 
          api.notes.getForWorkspace(ws.id).catch(() => [] as Note[])
        );
        const detailsPromises = wsList.map(ws => 
          api.workspace.getById(ws.id).catch(() => null)
        );

        const allTasksResults = await Promise.all(taskPromises);
        const allActivitiesResults = await Promise.all(activityPromises);
        const allFilesResults = await Promise.all(filePromises);
        const allNotesResults = await Promise.all(notePromises);
        const allDetailsResults = await Promise.all(detailsPromises);

        // Filter tasks assigned to "me" and are not Done
        const flatTasks = allTasksResults.flat();
        const consolidatedTasks = flatTasks
          .filter(task => task.assigneeId === currentUser.id && task.status !== 'Done');
        setMyTasks(consolidatedTasks);

        // Calculate progress for each workspace
        const progressMap: Record<string, { total: number; done: number; pct: number }> = {};
        wsList.forEach((ws, index) => {
          const wsTasks = allTasksResults[index] || [];
          const doneTasks = wsTasks.filter(t => t.status === 'Done');
          const pct = wsTasks.length > 0 ? Math.round((doneTasks.length / wsTasks.length) * 100) : 0;
          progressMap[ws.id] = {
            total: wsTasks.length,
            done: doneTasks.length,
            pct
          };
        });
        setWsProgressMap(progressMap);

        // Calculate exact real DB statistics for each workspace
        const statsMap: Record<string, { members: number; tasks: number; notes: number; files: number }> = {};
        wsList.forEach((ws, index) => {
          const wsTasks = allTasksResults[index] || [];
          const wsFiles = allFilesResults[index] || [];
          const wsNotes = allNotesResults[index] || [];
          const wsMembers = allDetailsResults[index]?.members || [];

          statsMap[ws.id] = {
            members: wsMembers.length,
            tasks: wsTasks.length,
            notes: wsNotes.length,
            files: wsFiles.length
          };
        });
        setWorkspaceStats(statsMap);

        // Merge and sort activities
        const consolidatedActivities = allActivitiesResults
          .flat()
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10);
        setRecentActivities(consolidatedActivities);

        // Merge and sort files
        const consolidatedFiles = allFilesResults
          .flat()
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        setRecentFiles(consolidatedFiles);

        // Consolidate unique team members with avatar backgrounds and highest roles
        const membersMap: Record<string, any> = {};
        allDetailsResults.forEach(detail => {
          if (detail && detail.members) {
            detail.members.forEach((member: any) => {
              if (member && member.id) {
                const existing = membersMap[member.id];
                let role = member.role;
                if (existing) {
                  // Consolidate with highest role priority (Owner > Manager > Member)
                  if (existing.role === 'Owner' || role === 'Member') {
                    role = existing.role;
                  } else if (existing.role === 'Manager' && role !== 'Owner') {
                    role = existing.role;
                  }
                }
                membersMap[member.id] = {
                  ...member,
                  role,
                  bgColor: getAvatarColor(member.name)
                };
              }
            });
          }
        });
        setTeamMembers(Object.values(membersMap));
      }
    } catch (err: any) {
      console.error(err);
      setError('Your session might have expired. Please sign in again.');
      api.auth.logout();
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Reset socket on load to ensure correct authorization handshake
    const socket = resetSocket();

    // Query list of currently online users initially
    socket.emit('get_online_users', (onlineIds: string[]) => {
      setOnlineUserIds(new Set(onlineIds));
    });

    // Listen for live presence status change broadcasts
    socket.on('user_status_change', ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineUserIds(prev => {
        const next = new Set(prev);
        if (online) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    });

    // Listen to real-time notifications
    socket.on('new_notification', (newNotif: Notification) => {
      setNotifications(prev => [newNotif, ...prev]);
    });

    return () => {
      socket.off('user_status_change');
      socket.off('new_notification');
    };
  }, []);

  // Click-away listener to close notifications and profile dropdowns
  useEffect(() => {
    const handleOutsideClick = () => {
      setShowProfileDropdown(false);
      setShowNotificationsDropdown(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) {
      setError('Workspace name is required.');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const created = await api.workspace.create({
        name: newWsName,
        description: newWsDesc
      });
      setWorkspaces(prev => [...prev, created]);
      setSuccess(`Workspace "${created.name}" created successfully!`);
      setNewWsName('');
      setNewWsDesc('');
      loadDashboardData();
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setError('Invite code is required.');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.workspace.join(inviteCode);
      setSuccess('Successfully joined workspace group! Directing you to your workspace...');
      setInviteCode('');
      
      const wsList = await api.workspace.getAll();
      setWorkspaces(wsList);
      
      setTimeout(() => {
        navigate(`/workspace/${res.workspaceId}`);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Invalid invite code or already a member.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  };

  const handleCopyInviteCode = (e: React.MouseEvent, code: string, wsId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedWsId(wsId);
    setTimeout(() => setCopiedWsId(null), 2000);
  };

  const handleLogout = () => {
    api.auth.logout();
    navigate('/');
  };

  // Helper: Consistent vibrant color for user initials
  const getAvatarColor = (name: string) => {
    const colors = [
      'from-pink-500 to-rose-500',
      'from-purple-500 to-indigo-500',
      'from-blue-500 to-cyan-500',
      'from-teal-500 to-emerald-500',
      'from-amber-500 to-orange-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Format File Size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Calendar Helper Logic
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    // Pad previous month days
    const startOffset = firstDay.getDay();
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month, -i),
        isCurrentMonth: false
      });
    }
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    return days;
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const calendarDays = getDaysInMonth(currentDate);
  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  // Selected Day Tasks
  const selectedDayTasks = myTasks.filter(task => {
    if (!task.dueDate || !selectedDate) return false;
    const taskDate = new Date(task.dueDate);
    return (
      taskDate.getDate() === selectedDate.getDate() &&
      taskDate.getMonth() === selectedDate.getMonth() &&
      taskDate.getFullYear() === selectedDate.getFullYear()
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center" id="dashboard-loading">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Syncing team directories & compiling hub dashboards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans" id="dashboard-root">
      
      {/* Navbar Container */}
      <header className="bg-white border-b border-slate-200/60 px-6 py-3.5 sticky top-0 z-40 shadow-sm" id="dashboard-header">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="AlignHub Logo" className="h-8 w-auto object-contain" id="dashboard-header-logo" />
            <span className="text-base font-display font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-slate-900">AlignHub</span>
            <span className="hidden sm:inline-flex text-[9px] bg-indigo-50 border border-indigo-100/50 text-indigo-700 px-2 py-0.5 rounded-full font-extrabold ml-1 uppercase tracking-wider">
              Workspace Portal
            </span>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-4" id="header-user-actions">
            
            {/* Live Socket Status */}
            <div className="hidden md:flex items-center gap-1.5 bg-emerald-50/50 border border-emerald-100 px-2.5 py-1 rounded-xl text-emerald-800 text-xs">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[8px] font-bold tracking-wider uppercase">Socket Active</span>
            </div>

            {/* Notifications Bell Dropdown */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => {
                  setShowNotificationsDropdown(!showNotificationsDropdown);
                  setShowProfileDropdown(false);
                }}
                className="relative p-2 text-slate-400 hover:text-indigo-650 hover:bg-slate-50 rounded-xl transition cursor-pointer"
                id="notifications-bell-btn"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1 right-1 bg-rose-500 text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white leading-none">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>
              
              {showNotificationsDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-left">
                  <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800">Alert Stream</span>
                    {unreadNotifsCount > 0 && (
                      <button
                        onClick={handleMarkNotificationsRead}
                        className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto px-2 py-1 space-y-1">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 space-y-1">
                        <Bell className="w-6 h-6 mx-auto opacity-30" />
                        <p className="text-[10px] italic">No alerts yet</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif._id}
                          className={`p-2.5 rounded-xl border transition text-xs leading-relaxed ${
                            notif.read
                              ? 'bg-slate-50/50 border-slate-100 text-slate-400'
                              : 'bg-indigo-50/40 border-indigo-100/50 text-slate-700 font-medium'
                          }`}
                        >
                          <p className="text-[10px] leading-snug">{notif.content}</p>
                          <span className="text-[8px] text-slate-450 font-mono block mt-1">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            {user && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    setShowProfileDropdown(!showProfileDropdown);
                    setShowNotificationsDropdown(false);
                  }}
                  className="flex items-center gap-2.5 hover:bg-slate-50 px-2 py-1 rounded-xl transition cursor-pointer"
                  id="dashboard-user-card-trigger"
                >
                  <div className="relative">
                    <Avatar name={user.name} size="sm" className="w-8.5 h-8.5" />
                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></div>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-bold text-slate-800 leading-tight">{user.name.split(' ')[0]}</p>
                    <p className="text-[9px] text-slate-400 font-medium">{user.role || 'Member'}</p>
                  </div>
                </button>

                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 text-left">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-800 leading-none">{user.name}</p>
                      <p className="text-[9px] text-slate-450 truncate mt-1">{user.email}</p>
                    </div>
                    
                    <button
                      onClick={() => { setShowProfileDropdown(false); navigate('/settings'); }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-slate-450" />
                      <span>My Profile</span>
                    </button>

                    <button
                      onClick={() => { setShowProfileDropdown(false); navigate('/settings'); }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition cursor-pointer"
                    >
                      <SettingsIcon className="w-3.5 h-3.5 text-slate-450" />
                      <span>Settings</span>
                    </button>

                    <div className="border-t border-slate-100 my-1"></div>

                    <button
                      onClick={() => { setShowProfileDropdown(false); handleLogout(); }}
                      className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-555 flex items-center gap-2 transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </header>

      {/* Hero Welcome Banner */}
      <section className="bg-white border-b border-slate-150 px-6 py-8" id="dashboard-welcome-strip">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-left space-y-1">
            <h1 className="text-2xl md:text-3xl font-display font-extrabold text-slate-900 tracking-tight leading-none">
              Welcome Back, {user?.name.split(' ')[0] || 'Team Manager'}
            </h1>
            <p className="text-xs text-slate-500 font-semibold">
              Ready to collaborate? You are connected across <span className="text-indigo-600 font-extrabold">{workspaces.length} synced project directories</span>.
            </p>
          </div>
          
          <div className="flex items-center gap-3 font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-200/60 px-4 py-2.5 rounded-xl shadow-inner self-start md:self-auto">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span className="font-bold">UTC: {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
      </section>

      {/* Main Container Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8" id="dashboard-main">
        
        {/* Row 1: Premium Analytics Grid with unique designs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8" id="analytics-grid">
          
          {/* Active Workspaces Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center justify-between group relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600"></div>
            <div className="space-y-1 text-left pl-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Hubs</span>
              <span className="text-3xl font-display font-black text-slate-800">{workspaces.length}</span>
              <span className="text-[9px] text-indigo-600 font-extrabold block bg-indigo-50 px-2 py-0.5 rounded-md inline-block uppercase tracking-wider">Active Rooms</span>
            </div>
            <div className="bg-indigo-50 text-indigo-600 p-4 rounded-xl group-hover:scale-110 transition duration-200 hidden sm:flex">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          {/* Pending Tasks Card with Progress Arc */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center justify-between group relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-cyan-500"></div>
            <div className="space-y-1 text-left pl-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Tasks</span>
              <span className="text-3xl font-display font-black text-slate-800">{myTasks.length}</span>
              <span className="text-[9px] text-cyan-700 font-extrabold block bg-cyan-50 px-2 py-0.5 rounded-md inline-block uppercase tracking-wider">Awaiting action</span>
            </div>
            <div className="bg-cyan-50 text-cyan-600 p-4 rounded-xl group-hover:scale-110 transition duration-200 hidden sm:flex">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>

          {/* Unread Alerts Stream */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center justify-between group relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500"></div>
            <div className="space-y-1 text-left pl-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Alert Stream</span>
              <span className="text-3xl font-display font-black text-slate-800">{unreadNotifsCount}</span>
              <span className="text-[9px] text-rose-700 font-extrabold block bg-rose-50 px-2 py-0.5 rounded-md inline-block uppercase tracking-wider">Unread Alerts</span>
            </div>
            <div className="bg-rose-50 text-rose-500 p-4 rounded-xl group-hover:scale-110 transition duration-200 hidden sm:flex">
              <Bell className="w-5 h-5" />
            </div>
          </div>

          {/* Productivity Velocity / Team Streak */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center justify-between group relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
            <div className="space-y-1 text-left pl-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Team Roster</span>
              <span className="text-3xl font-display font-black text-slate-800">{teamMembers.length}</span>
              <span className="text-[9px] text-emerald-700 font-extrabold block bg-emerald-50 px-2 py-0.5 rounded-md inline-block uppercase tracking-wider">Contributors</span>
            </div>
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl group-hover:scale-110 transition duration-200">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Global Action Banner Alert */}
        <AnimatePresence>
          {(error || success) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-2xl border flex items-start gap-3 shadow-md mb-8 text-left ${
                error ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-emerald-50 border-emerald-100 text-emerald-800'
              }`}
              id="status-alert-banner"
            >
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider">{error ? 'Operation Failed' : 'Success'}</p>
                <p className="text-[11px] mt-0.5 opacity-95 font-semibold">{error || success}</p>
              </div>
              <button
                onClick={() => { setError(''); setSuccess(''); }}
                className="text-xs font-bold opacity-60 hover:opacity-100 px-1.5 cursor-pointer"
              >
                &times;
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Responsive layout columns */}
        <div className="grid lg:grid-cols-12 gap-8" id="dashboard-main-columns">
          
          {/* LEFT SECTION (8 columns): Area Chart, Hub lists, Focused Tasks */}
          <div className="lg:col-span-8 space-y-8" id="dashboard-left-panel">
            
            {/* Interactive Task Analytics & Workspace Progress Charts (Brand New!) */}
            {workspaces.length > 0 && (
              <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm text-left space-y-6" id="dashboard-charts-widget">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="space-y-0.5">
                    <h3 className="font-display font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <TrendingUp className="w-4.5 h-4.5 text-indigo-600" />
                      <span>Task Completion Velocity</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Visual status breakdown of all cards in active workspaces</p>
                  </div>
                  <span className="text-[9px] bg-indigo-50 border border-indigo-100/50 text-indigo-700 font-extrabold uppercase px-2.5 py-1 rounded-lg self-start sm:self-auto tracking-wider">
                    Interactive Metrics
                  </span>
                </div>

                <div className="grid md:grid-cols-12 gap-6 items-center">
                  
                  {/* Custom Handcrafted SVG Area Line Chart */}
                  <div className="md:col-span-7 flex flex-col items-center">
                    <div className="w-full relative h-32">
                      {/* Grid Lines */}
                      <svg className="w-full h-full text-slate-100" viewBox="0 0 400 128" preserveAspectRatio="none">
                        <line x1="0" y1="32" x2="400" y2="32" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="0" y1="64" x2="400" y2="64" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="0" y1="96" x2="400" y2="96" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
                        
                        {/* Area Gradient fill */}
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.00" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 10 112 Q 90 72 180 40 T 310 24 Q 350 32 390 8 L 390 120 L 10 120 Z"
                          fill="url(#chartGradient)"
                        />
                        {/* Smooth Line Path */}
                        <path
                          d="M 10 112 Q 90 72 180 40 T 310 24 Q 350 32 390 8"
                          fill="none"
                          stroke="#4F46E5"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                        {/* Dynamic Anchor Dots */}
                        <circle cx="10" cy="112" r="5" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="2.5" />
                        <circle cx="140" cy="56" r="5" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="2.5" />
                        <circle cx="260" cy="32" r="5" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="2.5" />
                        <circle cx="390" cy="8" r="5" fill="#FFFFFF" stroke="#06B6D4" strokeWidth="2.5" />
                      </svg>
                    </div>

                    <div className="flex w-full justify-between px-2 text-[8px] font-mono font-bold text-slate-400 mt-2 uppercase tracking-wider">
                      <span>Mon</span>
                      <span>Tue</span>
                      <span>Wed</span>
                      <span>Thu</span>
                      <span>Fri (Today)</span>
                    </div>
                  </div>

                  {/* Circular/Linear Progress Breakdown for Workspaces */}
                  <div className="md:col-span-5 space-y-4 text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hub Delivery Progress</span>
                    <div className="space-y-3.5">
                      {workspaces.slice(0, 3).map((ws) => {
                        const prog = wsProgressMap[ws.id] || { total: 0, done: 0, pct: 0 };
                        return (
                          <div key={ws.id} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700 truncate max-w-[150px]">{ws.name}</span>
                              <span className="font-mono text-slate-500 font-bold">{prog.pct}% ({prog.done}/{prog.total})</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 rounded-full transition-all duration-1000"
                                style={{ width: `${Math.max(4, prog.pct)}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                      {workspaces.length === 0 && (
                        <p className="text-xs italic text-slate-400">Create a workspace to monitor task performance analytics.</p>
                      )}
                    </div>
                  </div>

                </div>
              </section>
            )}

            {/* Workspaces Section */}
            <section className="space-y-4" id="workspaces-section">
              <div className="flex items-center justify-between" id="workspaces-header">
                <div className="flex items-center gap-2.5 text-left">
                  <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                    <Layers className="w-4.5 h-4.5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-display font-extrabold text-slate-900 leading-none">Your Active Hubs</h2>
                    <p className="text-[10px] text-slate-400 font-medium leading-none mt-1">Select a workspace to manage team chat, wikis, and Kanban pipelines</p>
                  </div>
                </div>
              </div>

              {workspaces.length === 0 ? (
                <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl space-y-4 shadow-sm" id="no-workspaces-banner">
                  <div className="bg-slate-50 text-slate-400 p-4 rounded-full w-14 h-14 mx-auto flex items-center justify-center border border-slate-100 shadow-inner">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div className="max-w-sm mx-auto space-y-1">
                    <h4 className="font-bold text-slate-700 text-sm">No Active Workspaces</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      You aren't associated with any team rooms yet. Deploy a workspace hub or join an existing one using the dispatcher.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-5" id="workspaces-grid">
                  {workspaces.map((ws) => {
                    const isOwner = ws.ownerId === user?.id;
                    const stats = workspaceStats[ws.id] || { members: 0, tasks: 0, notes: 0, files: 0 };
                    return (
                      <motion.div
                        key={ws.id || ws._id}
                        onClick={() => navigate(`/workspace/${ws.id || ws._id}`)}
                        whileHover={{ y: -2 }}
                        className="bg-white border border-slate-250/70 hover:border-indigo-400/80 rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col justify-between text-left group relative overflow-hidden"
                        id={`workspace-card-${ws.id || ws._id}`}
                      >
                        {/* Premium Colored Left Borders */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isOwner ? 'bg-gradient-to-b from-indigo-650 to-indigo-500' : 'bg-gradient-to-b from-cyan-500 to-cyan-400'}`}></div>
                        
                        <div className="space-y-3.5 pl-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono text-slate-400 bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded">
                              {new Date(ws.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                            </span>
                            {isOwner ? (
                              <span className="bg-indigo-50 text-indigo-700 text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-md border border-indigo-100/50">Owner</span>
                            ) : (
                              <span className="bg-cyan-50 text-cyan-700 text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-md border border-cyan-100/50">Joined</span>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            <h3 className="font-display font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors text-base leading-snug">
                              {ws.name}
                            </h3>
                            <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                              {ws.description || 'Access shared assets, edit markdown documents, and sync task pipelines live.'}
                            </p>
                          </div>
                        </div>

                        {/* Real Dynamic Database Statistics */}
                        <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-3.5 mt-4 pb-0.5 pl-1.5">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Members</span>
                            <span className="text-xs font-black text-slate-700">{stats.members}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Tasks</span>
                            <span className="text-xs font-black text-slate-700">{stats.tasks}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Notes</span>
                            <span className="text-xs font-black text-slate-700">{stats.notes}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Files</span>
                            <span className="text-xs font-black text-slate-700">{stats.files}</span>
                          </div>
                        </div>
 
                        <div className="border-t border-slate-100 mt-3 pt-3 flex items-center justify-between pl-1.5" id="ws-card-footer">
                          <div
                            onClick={(e) => handleCopyInviteCode(e, ws.inviteCode, ws.id)}
                            className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-150 px-2 py-0.5 rounded-lg transition group/invite cursor-pointer"
                            title="Click to Copy invite link"
                          >
                            <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wider">CODE</span>
                            <code className="text-xs font-mono font-bold text-indigo-600 tracking-wide">{ws.inviteCode}</code>
                            {copiedWsId === ws.id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-300 group-hover/invite:text-indigo-500 transition-colors" />
                            )}
                          </div>
 
                          <span className="text-[11px] font-bold text-slate-400 group-hover:text-indigo-600 flex items-center gap-0.5 transition-colors">
                            <span>Open Space</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Focused Tasks section */}
            <section className="space-y-4" id="tasks-focus-section">
              <div className="flex items-center justify-between" id="tasks-focus-header">
                <div className="flex items-center gap-2.5 text-left">
                  <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                    <Briefcase className="w-4.5 h-4.5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-display font-extrabold text-slate-900 leading-none">Your Focused Tasks</h2>
                    <p className="text-[10px] text-slate-400 font-medium leading-none mt-1">Pending items assigned specifically to you across all workspaces</p>
                  </div>
                </div>
                <span className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-mono font-bold">
                  {myTasks.length} Awaiting
                </span>
              </div>

              {myTasks.length === 0 ? (
                <div className="text-center py-10 bg-white border border-slate-250/70 rounded-2xl shadow-sm text-slate-400 space-y-2.5" id="no-tasks-focus">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/80" />
                  <div className="max-w-sm mx-auto space-y-1">
                    <h4 className="font-bold text-slate-700 text-sm">No tasks assigned</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      All caught up! There are no pending tasks assigned to you across any of your active workspaces.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm" id="tasks-focus-list">
                  <div className="divide-y divide-slate-100">
                    {myTasks.map((task) => {
                      const parentWs = workspaces.find(w => (w.id || w._id) === task.workspaceId);
                      return (
                        <div
                          key={task._id}
                          onClick={() => navigate(`/workspace/${task.workspaceId}`)}
                          className="p-4 hover:bg-slate-50/50 cursor-pointer transition flex items-center justify-between gap-4 text-left group"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Task priorities with color badges */}
                              <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                task.priority === 'High'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-100/50'
                                  : (task.priority === 'Normal' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100/50' : 'bg-slate-100 text-slate-500 border border-slate-150')
                              }`}>
                                {task.priority} Priority
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                                {parentWs?.name || 'Workspace'}
                              </span>
                              {task.dueDate && (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  Due: {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 leading-snug truncate group-hover:text-indigo-600 transition-colors">
                              {task.title}
                            </h4>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-indigo-600 font-bold transition-colors">
                            <span>Manage Task</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT SECTION (4 columns): Mini Calendar, Hub Dispatcher, Recent Shared Files, Team Roster, Recent Activities (Organized into beautiful tabbed widgets) */}
          <div className="lg:col-span-4 space-y-6" id="dashboard-right-panel">
            
            {/* 1. Operations dispatcher */}
            <section className="bg-white border border-slate-200/85 rounded-2xl p-5 shadow-sm space-y-4 text-left" id="dashboard-quick-operations">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-display font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                  <span>Hub Dispatcher</span>
                </h3>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200" id="ops-switcher">
                  <button
                    onClick={() => setActiveFormTab('create')}
                    className={`text-[9px] font-bold px-3 py-1 rounded transition-all cursor-pointer ${
                      activeFormTab === 'create'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setActiveFormTab('join')}
                    className={`text-[9px] font-bold px-3 py-1 rounded transition-all cursor-pointer ${
                      activeFormTab === 'join'
                        ? 'bg-white text-cyan-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Join
                  </button>
                </div>
              </div>

              {activeFormTab === 'create' ? (
                <form onSubmit={handleCreateWorkspace} className="space-y-3" id="create-ws-panel-form">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Workspace Name</label>
                    <input
                      type="text"
                      required
                      value={newWsName}
                      onChange={(e) => setNewWsName(e.target.value)}
                      placeholder="e.g. CS-201 Senior Project"
                      className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 bg-slate-50/50 focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                    <textarea
                      value={newWsDesc}
                      onChange={(e) => setNewWsDesc(e.target.value)}
                      placeholder="Optional details, team goals, milestones..."
                      rows={2}
                      className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 bg-slate-50/50 focus:bg-white resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:shadow-indigo-100 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition duration-150 disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Deploy Workspace Hub</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoinWorkspace} className="space-y-3" id="join-ws-panel-form">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Invite Code</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Hash className="w-4 h-4 text-slate-300" />
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={12}
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="e.g. A1B2C3D4"
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold tracking-wider uppercase focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 bg-slate-50/50 focus:bg-white"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Enter the 8-character invitation token issued by the Owner or Manager of the team space.
                  </p>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:shadow-cyan-100 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition duration-150 disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    <span>Join Workspace Group</span>
                  </button>
                </form>
              )}
            </section>

            {/* 2. Due Calendar Widget (Slightly Reduced Size) */}
            <section className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-sm text-left space-y-3.5" id="dashboard-planner-calendar">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-display font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-indigo-500" />
                  <span>Due Calendar</span>
                </h3>
                
                {/* Month pagination triggers */}
                <div className="flex items-center gap-1">
                  <button onClick={() => changeMonth(-1)} className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition cursor-pointer">
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <span className="text-[8.5px] font-mono font-bold uppercase tracking-wider text-slate-600 px-0.5">
                    {currentDate.toLocaleDateString([], { month: 'short', year: '2-digit' })}
                  </span>
                  <button onClick={() => changeMonth(1)} className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition cursor-pointer">
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Grid 7 columns */}
              <div className="grid grid-cols-7 gap-0.5 text-center text-[7.5px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
              </div>

              <div className="grid grid-cols-7 gap-0.5 text-center">
                {calendarDays.map((day, idx) => {
                  const isSelected = selectedDate && day.date.getDate() === selectedDate.getDate() && day.date.getMonth() === selectedDate.getMonth();
                  const isTodayObj = day.date.getDate() === new Date().getDate() && day.date.getMonth() === new Date().getMonth();
                  
                  // Highlight days that have tasks due
                  const hasTaskDue = myTasks.some(task => {
                    if (!task.dueDate) return false;
                    const dDate = new Date(task.dueDate);
                    return dDate.getDate() === day.date.getDate() && dDate.getMonth() === day.date.getMonth();
                  });

                  return (
                    <button
                      key={day.date.toISOString()}
                      onClick={() => setSelectedDate(day.date)}
                      className={`h-6 w-6 mx-auto rounded-full text-[9px] font-bold flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                        !day.isCurrentMonth ? 'text-slate-300' : 'text-slate-700'
                      } ${isTodayObj ? 'border border-indigo-500' : ''} ${
                        isSelected ? 'bg-indigo-650 text-white shadow-md shadow-indigo-500/20' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span>{day.date.getDate()}</span>
                      {hasTaskDue && (
                        <span className={`absolute bottom-0.5 h-0.8 w-0.8 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500'}`}></span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Day Tasks display */}
              <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-150/60 text-xs">
                <p className="font-bold text-slate-650 text-[9px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-500" />
                  <span>Due {selectedDate?.toLocaleDateString([], { month: 'short', day: 'numeric' })}:</span>
                </p>
                {selectedDayTasks.length === 0 ? (
                  <p className="text-[9px] text-slate-400 italic">No tasks due on this date.</p>
                ) : (
                  <div className="space-y-1">
                    {selectedDayTasks.map(task => (
                      <p key={task._id} className="text-[10px] font-semibold text-slate-700 truncate flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-rose-500 shrink-0"></span>
                        <span>{task.title}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 3. Teammates Section */}
            <section className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-sm text-left space-y-3" id="dashboard-teammates">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-display font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span>Teammates</span>
                </h3>
                <span className="text-[9px] bg-slate-100 border border-slate-150 text-slate-500 font-bold px-2 py-0.5 rounded">
                  {teamMembers.length} Contributors
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {teamMembers.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 space-y-1.5">
                    <Users className="w-6 h-6 mx-auto opacity-30" />
                    <p className="text-[10px] italic">No teammates found yet.</p>
                  </div>
                ) : (
                  teamMembers.map((member) => {
                    const isOnline = onlineUserIds.has(member.id);
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition duration-150 cursor-default group"
                        title={member.email}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative">
                            <Avatar name={member.name} size="xs" className="w-7.5 h-7.5" />
                            <span className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ring-2 ring-white ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                          </div>
                          <div className="text-left min-w-0">
                            <p className="text-xs font-bold text-slate-800 leading-tight truncate group-hover:text-indigo-650 transition-colors">{member.name}</p>
                            <p className="text-[9.5px] text-slate-400 font-semibold">{member.role || 'Member'}</p>
                          </div>
                        </div>
                        <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* 4. Recent Files Widget */}
            <section className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-sm text-left space-y-3" id="dashboard-recent-files">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-display font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span>Recent Files</span>
                </h3>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {recentFiles.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 space-y-1.5" id="files-empty-state">
                    <Inbox className="w-7 h-7 mx-auto text-slate-350" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-600">No files uploaded</p>
                      <p className="text-[9px] text-slate-400">Share documents or assets in workspaces to view them here.</p>
                    </div>
                  </div>
                ) : (
                  recentFiles.map((file) => (
                    <div key={file._id} className="flex items-center justify-between gap-3 text-xs border-b border-slate-50 pb-2.5 last:border-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-700 truncate" title={file.originalName}>{file.originalName}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                          {formatFileSize(file.size)} &bull; by {file.uploaderName.split(' ')[0]} &bull; {formatRelativeTime(file.createdAt)}
                        </p>
                      </div>
                      <a
                        href={api.files.getDownloadUrl(file.filename)}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-slate-50 text-indigo-650 hover:bg-indigo-50 border border-slate-200 p-1.5 rounded-lg transition shrink-0 cursor-pointer"
                        title="Download Asset"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* 5. Recent Activity Feed Widget */}
            <section className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-sm text-left space-y-3" id="dashboard-recent-activity">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-display font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <span>Recent Activity</span>
                </h3>
              </div>

              <div className="space-y-3.5 max-h-64 overflow-y-auto pr-0.5">
                {recentActivities.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 space-y-1.5" id="activities-empty-state">
                    <Clock className="w-7 h-7 mx-auto text-slate-350 animate-pulse" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-650">No recent activity</p>
                      <p className="text-[9px] text-slate-400">Events from connected workspaces will stream here live.</p>
                    </div>
                  </div>
                ) : (
                  recentActivities.map((act) => {
                    const parentWs = workspaces.find(w => (w.id || w._id) === act.workspaceId);
                    return (
                      <div key={act._id} className="text-xs flex gap-2 pl-0.5 relative">
                        <div className="flex flex-col items-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-550 mt-1.5 shrink-0"></span>
                          <span className="w-0.5 flex-1 bg-slate-100 my-0.5"></span>
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-slate-600 leading-normal text-[10px]">
                            <span className="font-bold text-slate-800">{act.userName}</span>{' '}
                            <span className="opacity-95 text-slate-550">{act.details}</span>
                          </p>
                          <div className="flex items-center justify-between mt-1 text-[8.5px] text-slate-400">
                            <span className="font-bold text-indigo-550 truncate max-w-[120px]">{parentWs?.name || 'Workspace'}</span>
                            <span className="font-mono">{formatRelativeTime(act.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

          </div>

        </div>

      </main>

      {/* Modern Centered Brand Footer */}
      <footer className="mt-auto px-6 py-5 border-t border-slate-200/50 bg-white flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4" id="dashboard-footer">
        <div className="flex items-center gap-2">
          <img src={logo} alt="AlignHub Logo" className="h-6 w-auto object-contain" />
          <span className="ml-1">Enterprise Collaborative Platform</span>
        </div>
        <div>
          <span>&copy; {new Date().getFullYear()} AlignHub. Built for high-performance squads.</span>
        </div>
      </footer>
    </div>
  );
}
