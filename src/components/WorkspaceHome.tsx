import React, { useState } from 'react';
import { WorkspaceDetail, Activity } from '../types';
import { api } from '../services/api';
import {
  Info,
  Calendar,
  Download,
  Trash2,
  Share2,
  Clock,
  User,
  ShieldCheck,
  Check,
  Copy,
  AlertTriangle
} from 'lucide-react';

interface WorkspaceHomeProps {
  detail: WorkspaceDetail;
  activities: Activity[];
  onDeleteWorkspace: () => void;
}

export default function WorkspaceHome({ detail, activities, onDeleteWorkspace }: WorkspaceHomeProps) {
  const [copied, setCopied] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const { workspace, role } = detail;

  const handleCopyInviteCode = () => {
    navigator.clipboard.writeText(workspace.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadExport = () => {
    // Navigate directly to download route
    const url = api.exportUrl(workspace.id);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-8" id="ws-home-container">
      {/* Intro Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm grid md:grid-cols-3 gap-6 items-center" id="ws-home-intro">
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-display font-bold text-slate-900">{workspace.name}</h2>
            <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full ${
              role === 'Owner'
                ? 'bg-rose-50 text-rose-700 border border-rose-100/50'
                : (role === 'Manager' ? 'bg-blue-50 text-blue-700 border border-blue-100/50' : 'bg-slate-100 text-slate-600 border border-slate-200/50')
            }`}>
              Your Role: {role}
            </span>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">
            {workspace.description || 'Welcome to your collaborative team room! Coordinate tasks, chat, and share resources.'}
          </p>
          <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Created on {new Date(workspace.createdAt).toLocaleDateString()}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{detail.members.length} Members joined</span>
            </span>
          </div>
        </div>

        {/* Invite Code Widget */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-2" id="ws-invite-widget">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Invite Code</span>
          <div className="flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-lg p-2 shadow-inner">
            <code className="text-sm font-mono font-extrabold text-indigo-700 tracking-wider">{workspace.inviteCode}</code>
            <button
              onClick={handleCopyInviteCode}
              className="text-slate-400 hover:text-indigo-600 transition"
              title="Copy code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">Share with classmates to let them join this room.</p>
        </div>
      </div>

      {/* Main Body: Activity Feed and Admin Tools */}
      <div className="grid md:grid-cols-12 gap-8">
        
        {/* Activity Feed Feed */}
        <div className="md:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-[450px]" id="ws-activity-feed">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Live Activity Feed</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
              ● Online updates
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1" id="feed-scroller">
            {activities.length === 0 ? (
              <div className="text-center py-20 text-slate-400 space-y-2">
                <Info className="w-8 h-8 mx-auto opacity-45" />
                <p className="text-xs">No project activities yet.</p>
                <p className="text-[10px] opacity-75">Work updates on tasks, docs, and files will show up here live.</p>
              </div>
            ) : (
              activities.map((act) => (
                <div key={act._id} className="flex gap-3 items-start text-xs border-b border-slate-50 pb-3" id={`activity-item-${act._id}`}>
                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0 uppercase border border-slate-200">
                    {act.userName.substring(0, 2)}
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-700">
                      <span className="font-bold text-slate-900">{act.userName}</span>{' '}
                      <span className="opacity-90">{act.details}</span>
                    </p>
                    <span className="text-[9px] text-slate-400 font-mono mt-1 block">
                      {new Date(act.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Administration/Utilities Columns */}
        <div className="md:col-span-4 space-y-6" id="ws-home-admin-tools">
          {/* Export Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4" id="ws-export-card">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-teal-600" />
              <h4 className="font-display font-bold text-slate-900 text-sm">Export Workspace</h4>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              Compile and backup your team's chat logs, Kanban boards, documents, notes, and activity indices into a single raw JSON backup.
            </p>
            <button
              onClick={handleDownloadExport}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4" />
              <span>Export Workspace Data</span>
            </button>
          </div>

          {/* Delete Panel (Owner Only) */}
          {role === 'Owner' && (
            <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 shadow-sm space-y-4" id="ws-danger-card">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h4 className="font-display font-bold text-rose-900 text-sm">Delete Workspace</h4>
              </div>
              <p className="text-rose-700/80 text-xs leading-relaxed">
                Warning: This will permanently delete the entire workspace, cleaning all chat messages, tasks, shared notes, and uploaded files. This action cannot be undone.
              </p>

              {showConfirmDelete ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-rose-800 uppercase">Are you absolutely sure?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={onDeleteWorkspace}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold py-2 rounded-lg transition"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setShowConfirmDelete(false)}
                      className="flex-1 bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold py-2 rounded-lg hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Workspace Group</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
