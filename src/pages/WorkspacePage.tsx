import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../services/api';
import { getSocket, resetSocket } from '../services/socket';
import { WorkspaceDetail, Task, Message, FileMeta, Note, Activity, User } from '../types';

// Subcomponents imports
import WorkspaceHome from '../components/WorkspaceHome';
import TeamChat from '../components/TeamChat';
import KanbanBoard from '../components/KanbanBoard';
import CollabNotes from '../components/CollabNotes';
import FileStorage from '../components/FileStorage';
import MembersList from '../components/MembersList';
import WorkspaceSettings from '../components/WorkspaceSettings';
import Avatar from '../components/Avatar';

import {
  Share2,
  Home,
  MessageCircle,
  Kanban,
  FileText,
  UploadCloud,
  Users,
  Loader2,
  ArrowLeft,
  Copy,
  Check,
  Activity as ActivityIcon,
  Sparkles,
  Bell,
  Clock,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  Settings
} from 'lucide-react';

type MainViewTab = 'dashboard' | 'chat' | 'kanban' | 'notes' | 'files' | 'members' | 'settings';

interface PresenceUser {
  socketId: string;
  userId: string;
  name: string;
  avatarUrl: string;
}

export default function WorkspacePage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Tab and View States
  const [activeTab, setActiveTab] = useState<MainViewTab>('dashboard');
  const [centerFocusTool, setCenterFocusTool] = useState<'kanban' | 'notes' | 'files'>('kanban');

  // Workspace Data states
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [presenceList, setPresenceList] = useState<PresenceUser[]>([]);

  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const loadWorkspaceData = async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      setError('');

      // 1. Fetch user info
      const meRes = await api.auth.getMe();
      setCurrentUser(meRes.user);

      // 2. Fetch workspace details
      const detailData = await api.workspace.getById(workspaceId);
      setDetail(detailData);

      // 3. Fetch subcomponents data
      const [tasksList, filesList, notesList, activityList] = await Promise.all([
        api.tasks.getForWorkspace(workspaceId),
        api.files.getForWorkspace(workspaceId),
        api.notes.getForWorkspace(workspaceId),
        api.activity.getForWorkspace(workspaceId)
      ]);

      setTasks(tasksList);
      setFiles(filesList);
      setNotes(notesList);
      setActivities(activityList);

    } catch (err: any) {
      console.error('Workspace Load Error:', err);
      setError(err.message || 'Access denied or workspace not found.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();

    if (workspaceId) {
      const s = resetSocket();

      s.emit('join_workspace', { workspaceId });

      // Live presence rosters
      s.on('presence_update', (list: PresenceUser[]) => {
        setPresenceList(list);
      });

      // Live Activities Log Sync
      s.on('task_created', (t: Task) => {
        if (t.workspaceId === workspaceId) {
          setTasks(prev => [t, ...prev]);
          setActivities(prev => [
            {
              _id: Math.random().toString(),
              workspaceId,
              userId: '',
              userName: 'System',
              type: 'activity',
              details: `added task "${t.title}"`,
              createdAt: new Date().toISOString()
            },
            ...prev
          ]);
        }
      });

      s.on('task_updated', (t: Task) => {
        if (t.workspaceId === workspaceId) {
          setTasks(prev => prev.map(item => item._id === t._id ? t : item));
          setActivities(prev => [
            {
              _id: Math.random().toString(),
              workspaceId,
              userId: '',
              userName: 'System',
              type: 'activity',
              details: `updated task "${t.title}" status to "${t.status}"`,
              createdAt: new Date().toISOString()
            },
            ...prev
          ]);
        }
      });

      s.on('task_deleted', ({ taskId }: { taskId: string }) => {
        setTasks(prev => prev.filter(t => t._id !== taskId));
      });

      s.on('file_uploaded', (newFile: FileMeta) => {
        if (newFile.workspaceId === workspaceId) {
          setFiles(prev => [newFile, ...prev]);
          setActivities(prev => [
            {
              _id: Math.random().toString(),
              workspaceId,
              userId: '',
              userName: newFile.uploaderName,
              type: 'activity',
              details: `uploaded file asset "${newFile.originalName}"`,
              createdAt: new Date().toISOString()
            },
            ...prev
          ]);
        }
      });

      return () => {
        s.emit('leave_workspace', { workspaceId });
        s.off('presence_update');
        s.off('task_created');
        s.off('task_updated');
        s.off('task_deleted');
        s.off('file_uploaded');
      };
    }
  }, [workspaceId]);

  const handleCopyCode = () => {
    if (!detail) return;
    navigator.clipboard.writeText(detail.workspace.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceId) return;
    try {
      await api.workspace.delete(workspaceId);
      navigate('/dashboard');
    } catch (err: any) {
      alert(err.message || 'Failed to delete workspace.');
    }
  };

  const handleLeaveWorkspace = async () => {
    if (!workspaceId || !currentUser) return;
    try {
      await api.workspace.removeMember(workspaceId, currentUser.id);
      navigate('/dashboard');
    } catch (err: any) {
      alert(err.message || 'Failed to leave workspace.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center" id="workspace-loading">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-500">Connecting live workspace synchronization socket...</p>
        </div>
      </div>
    );
  }

  if (error || !detail || !currentUser) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex flex-col items-center justify-center p-6 text-center" id="workspace-error">
        <div className="max-w-md bg-white border border-slate-200 p-8 rounded-2xl shadow-sm space-y-4 text-left">
          <div className="text-rose-500 text-3xl">⚠️</div>
          <h3 className="font-display font-extrabold text-slate-900 text-lg">Failed to establish connection</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{error ? `Error: ${error}` : 'This workspace does not exist or your permissions are invalid.'}</p>
          <button
            onClick={() => loadWorkspaceData()}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-sm"
          >
            Retry Connection
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-sm"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { workspace, role, members } = detail;

  // Filter unique presence members
  const uniquePresence = presenceList.filter(
    (item, index, self) => self.findIndex(t => t.userId === item.userId) === index
  );

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col h-screen overflow-hidden" id="workspace-root">
      {/* Upper Action Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0 shadow-sm z-30" id="workspace-header">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-indigo-600 transition p-1 rounded-lg hover:bg-slate-50"
            title="Return to Dashboard"
            id="ws-back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 text-left">
            <div className="bg-indigo-600 text-white p-1.5 rounded-xl flex items-center justify-center">
              <Share2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-slate-900 text-sm md:text-base leading-none tracking-tight">{workspace.name}</h1>
              <p className="text-[10px] text-slate-400 font-mono font-bold mt-1 leading-none uppercase">Aligned room code: {workspace.inviteCode}</p>
            </div>
          </div>
        </div>

        {/* Invite Code widget */}
        <div className="flex items-center gap-4" id="header-invite-widget">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-150 rounded-xl p-1.5 px-3 shadow-inner text-xs">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Code</span>
            <code className="font-mono font-black text-indigo-700 tracking-wide">{workspace.inviteCode}</code>
            <button
              onClick={handleCopyCode}
              className="text-slate-400 hover:text-indigo-600 transition"
              title="Copy Room invite code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden relative" id="workspace-viewport">
        
        {/* LEFT TOOLBAR / SIDEBAR (Unified navigation + operations) */}
        <aside
          className={`bg-[#111827] border-r border-slate-800 py-6 px-3 flex flex-col justify-between select-none shrink-0 transition-all duration-300 ${
            sidebarCollapsed ? 'w-16' : 'w-56'
          }`}
          id="workspace-sidebar"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <span className={`text-[9px] font-bold text-slate-500 uppercase tracking-widest transition-opacity ${sidebarCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
                Workspace Core
              </span>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              {/* Dashboard Layout Toggle */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition relative cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 pl-4'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`}
                title="Unified Command Center"
              >
                {activeTab === 'dashboard' && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-r-md"></span>
                )}
                <Home className={`w-5 h-5 shrink-0 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-400 group-hover:text-slate-100'}`} />
                <span className={`transition-opacity ${sidebarCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>Command Board</span>
              </button>

              {/* Full Stage Kanban focus */}
              <button
                onClick={() => setActiveTab('kanban')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition relative cursor-pointer ${
                  activeTab === 'kanban'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 pl-4'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`}
                title="Kanban Board"
              >
                {activeTab === 'kanban' && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-r-md"></span>
                )}
                <Kanban className={`w-5 h-5 shrink-0 ${activeTab === 'kanban' ? 'text-white' : 'text-slate-400 group-hover:text-slate-100'}`} />
                <span className={`transition-opacity ${sidebarCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>Task Board</span>
              </button>

              {/* Full Stage Notes focus */}
              <button
                onClick={() => setActiveTab('notes')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition relative cursor-pointer ${
                  activeTab === 'notes'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 pl-4'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`}
                title="Collaborative Wikis"
              >
                {activeTab === 'notes' && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-r-md"></span>
                )}
                <FileText className={`w-5 h-5 shrink-0 ${activeTab === 'notes' ? 'text-white' : 'text-slate-400 group-hover:text-slate-100'}`} />
                <span className={`transition-opacity ${sidebarCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>Shared Notes</span>
              </button>

              {/* Full Stage Assets focus */}
              <button
                onClick={() => setActiveTab('files')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition relative cursor-pointer ${
                  activeTab === 'files'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 pl-4'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`}
                title="Shared Assets"
              >
                {activeTab === 'files' && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-r-md"></span>
                )}
                <UploadCloud className={`w-5 h-5 shrink-0 ${activeTab === 'files' ? 'text-white' : 'text-slate-400 group-hover:text-slate-100'}`} />
                <span className={`transition-opacity ${sidebarCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>Shared Assets</span>
              </button>

              {/* Full Stage Team roster focus */}
              <button
                onClick={() => setActiveTab('members')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition relative cursor-pointer ${
                  activeTab === 'members'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 pl-4'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`}
                title="Roster and Roles"
              >
                {activeTab === 'members' && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-r-md"></span>
                )}
                <Users className={`w-5 h-5 shrink-0 ${activeTab === 'members' ? 'text-white' : 'text-slate-400 group-hover:text-slate-100'}`} />
                <span className={`transition-opacity ${sidebarCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>Team Roster</span>
              </button>

              {/* Workspace Settings */}
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition relative cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 pl-4'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`}
                title="Workspace Settings"
              >
                {activeTab === 'settings' && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-r-md"></span>
                )}
                <Settings className={`w-5 h-5 shrink-0 ${activeTab === 'settings' ? 'text-white' : 'text-slate-400 group-hover:text-slate-100'}`} />
                <span className={`transition-opacity ${sidebarCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>Room Settings</span>
              </button>
            </div>
          </div>

          {/* Sidebar Footer Details */}
          {!sidebarCollapsed && (
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2 text-left" id="sidebar-role-panel">
              <span className="text-[8px] font-mono font-bold text-slate-500 block uppercase">Permissions Profile</span>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-400"></span>
                <span className="text-xs font-bold text-slate-300">{role} Role</span>
              </div>
            </div>
          )}
        </aside>

        {/* Dynamic Inner Stage container */}
        <div className="flex-1 flex overflow-hidden" id="workspace-main-stage">
          
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' ? (
              // REDESIGNED MULTI-PANE INTEGRATED HUB VIEW
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col md:flex-row h-full overflow-hidden"
              >
                {/* 1. CENTER PANE: Shared Notes, Task Board, Recent Activity */}
                <div className="flex-1 h-full overflow-y-auto p-5 space-y-5 flex flex-col" id="workspace-center-pane">
                  
                  {/* Unified Tool Card Stage */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col flex-1 min-h-0" id="center-interactive-widget">
                    
                    {/* Segmented Controller Header for Center Tool */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3.5 mb-4 gap-3">
                      <div className="flex items-center gap-2 text-left">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-display font-extrabold text-slate-800">Unified Focus Tool</span>
                      </div>

                      {/* Segment Toggles */}
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-auto" id="center-segment-toggle">
                        <button
                          onClick={() => setCenterFocusTool('kanban')}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                            centerFocusTool === 'kanban'
                              ? 'bg-white text-indigo-700 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Tasks
                        </button>
                        <button
                          onClick={() => setCenterFocusTool('notes')}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                            centerFocusTool === 'notes'
                              ? 'bg-white text-indigo-700 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Wiki Notes
                        </button>
                        <button
                          onClick={() => setCenterFocusTool('files')}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                            centerFocusTool === 'files'
                              ? 'bg-white text-indigo-700 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Shared Assets
                        </button>
                      </div>
                    </div>

                    {/* Rendering the active Tool within the pane */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                      {centerFocusTool === 'kanban' && (
                        <KanbanBoard
                          workspaceId={workspaceId!}
                          initialTasks={tasks}
                          members={members}
                          currentUser={currentUser}
                        />
                      )}
                      {centerFocusTool === 'notes' && (
                        <CollabNotes
                          workspaceId={workspaceId!}
                          initialNotes={notes}
                          currentUser={currentUser}
                        />
                      )}
                      {centerFocusTool === 'files' && (
                        <FileStorage
                          workspaceId={workspaceId!}
                          initialFiles={files}
                          currentUser={currentUser}
                        />
                      )}
                    </div>
                  </div>

                  {/* Recent Activity Log section at bottom of center */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm h-52 flex flex-col shrink-0" id="center-activities-widget">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Recent Workspace Stream</span>
                      </span>
                      <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-ping"></span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1" id="activities-scroller">
                      {activities.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-[10px] italic">
                          No recent actions recorded. Updates flow here in absolute real-time.
                        </div>
                      ) : (
                        activities.map((act) => (
                          <div key={act._id} className="text-[11px] border-b border-slate-50 pb-1.5 last:border-0 flex items-center justify-between gap-3 text-left">
                            <span className="text-slate-600">
                              <span className="font-bold text-slate-800">{act.userName}</span>{' '}
                              <span className="opacity-90">{act.details}</span>
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">
                              {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. RIGHT PANE: Chat, Members Presence, Notifications */}
                <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-slate-200 bg-white flex flex-col h-full shrink-0" id="workspace-right-pane">
                  
                  {/* Top Presence list (horizontal view) */}
                  <div className="p-4 border-b border-slate-100 shrink-0 flex items-center justify-between" id="right-presence-panel">
                    <div className="text-left">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block leading-none">Teammates Active</span>
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1 leading-none">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                        <span>{uniquePresence.length} online now</span>
                      </span>
                    </div>

                    {/* Horizontal avatars view */}
                    <div className="flex -space-x-1 overflow-hidden">
                      {uniquePresence.slice(0, 5).map((userPres) => (
                        <Avatar
                          key={userPres.socketId}
                          name={userPres.name}
                          size="xs"
                          className="inline-block h-6.5 w-6.5 ring-2 ring-white"
                        />
                      ))}
                      {uniquePresence.length > 5 && (
                        <div className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-full bg-slate-100 border border-slate-150 text-[8px] font-extrabold text-slate-500 ring-2 ring-white">
                          +{uniquePresence.length - 5}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mid: Team Chat stream */}
                  <div className="flex-1 overflow-hidden flex flex-col min-h-0" id="right-chat-panel">
                    <TeamChat
                      workspaceId={workspaceId!}
                      initialMessages={messages}
                      currentUser={currentUser}
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              // FULL-STAGE VIEWS FOR DISTRACTION-FREE WORKModes
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                className="flex-1 h-full overflow-y-auto p-8"
                id="workspace-focused-stage"
              >
                {activeTab === 'chat' && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-[calc(100vh-160px)]">
                    <TeamChat
                      workspaceId={workspaceId!}
                      initialMessages={messages}
                      currentUser={currentUser}
                    />
                  </div>
                )}

                {activeTab === 'kanban' && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-full text-left">
                    <KanbanBoard
                      workspaceId={workspaceId!}
                      initialTasks={tasks}
                      members={members}
                      currentUser={currentUser}
                    />
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="min-h-full">
                    <CollabNotes
                      workspaceId={workspaceId!}
                      initialNotes={notes}
                      currentUser={currentUser}
                    />
                  </div>
                )}

                {activeTab === 'files' && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-full text-left">
                    <FileStorage
                      workspaceId={workspaceId!}
                      initialFiles={files}
                      currentUser={currentUser}
                    />
                  </div>
                )}

                {activeTab === 'members' && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-full text-left">
                    <MembersList
                      detail={detail}
                      currentUser={currentUser}
                      onRefreshWorkspace={loadWorkspaceData}
                      onLeaveWorkspace={handleLeaveWorkspace}
                    />
                  </div>
                )}

                {activeTab === 'settings' && detail && currentUser && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-full text-left">
                    <WorkspaceSettings
                      workspaceId={workspaceId!}
                      detail={detail}
                      currentUser={currentUser}
                      onRefreshWorkspace={loadWorkspaceData}
                      onLeaveWorkspace={handleLeaveWorkspace}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>
    </div>
  );
}
