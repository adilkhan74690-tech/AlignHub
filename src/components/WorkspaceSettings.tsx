import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { WorkspaceDetail, User } from '../types';
import { 
  Settings, 
  Trash2, 
  LogOut, 
  Save, 
  Check, 
  Loader2, 
  Copy, 
  ShieldAlert, 
  Info,
  Calendar,
  Hash
} from 'lucide-react';

interface WorkspaceSettingsProps {
  workspaceId: string;
  detail: WorkspaceDetail;
  currentUser: User;
  onRefreshWorkspace: () => void;
  onLeaveWorkspace: () => void;
}

export default function WorkspaceSettings({
  workspaceId,
  detail,
  currentUser,
  onRefreshWorkspace,
  onLeaveWorkspace
}: WorkspaceSettingsProps) {
  const { workspace, role } = detail;
  const isOwner = role === 'Owner';
  const isManager = role === 'Manager';
  const canEdit = isOwner || isManager;

  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    setName(workspace.name);
    setDescription(workspace.description || '');
  }, [workspace]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name cannot be empty.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.workspace.update(workspaceId, { name, description });
      setSuccess('Workspace settings updated successfully.');
      onRefreshWorkspace();
    } catch (err: any) {
      setError(err.message || 'Failed to update workspace settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(workspace.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteWorkspace = async () => {
    if (deleteConfirm !== workspace.name) {
      setError('Please type the workspace name exactly to confirm deletion.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.workspace.delete(workspaceId);
      onLeaveWorkspace(); // Redirect to dashboard
    } catch (err: any) {
      setError(err.message || 'Failed to delete workspace.');
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (window.confirm('Are you sure you want to leave this workspace? You will need a new invite code to join back.')) {
      setLoading(true);
      setError('');
      try {
        await api.workspace.removeMember(workspaceId, currentUser.id);
        onLeaveWorkspace(); // Redirect to dashboard
      } catch (err: any) {
        setError(err.message || 'Failed to leave workspace.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6 text-left max-w-3xl" id="workspace-settings-container">
      {/* Header section */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4" id="settings-title-section">
        <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-slate-700">
          <Settings className="w-5 h-5 text-indigo-600 animate-spin-slow" />
        </div>
        <div>
          <h2 className="text-lg font-display font-extrabold text-slate-900 leading-none">Workspace Settings</h2>
          <p className="text-xs text-slate-400 font-medium leading-none mt-1.5">Manage details, sharing access, and workspace parameters</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-center justify-between" id="settings-error-alert">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600 font-bold px-1">&times;</button>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between" id="settings-success-alert">
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{success}</span>
          </span>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-600 font-bold px-1">&times;</button>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid md:grid-cols-3 gap-6" id="settings-panels-grid">
        {/* Left Side: Forms */}
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleUpdateSettings} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4" id="settings-main-form">
            <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-50 pb-2">
              <Info className="w-4 h-4 text-slate-500" />
              <span>Workspace Profile</span>
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Workspace Name</label>
              <input
                type="text"
                disabled={!canEdit || loading}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Design System Team"
                className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 bg-slate-50/50 focus:bg-white disabled:opacity-60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Description</label>
              <textarea
                disabled={!canEdit || loading}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this workspace hub's primary purpose..."
                rows={4}
                className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 bg-slate-50/50 focus:bg-white resize-none disabled:opacity-60"
              />
            </div>

            {canEdit ? (
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-sm shadow-indigo-200 transition active:scale-98 cursor-pointer"
                id="settings-save-btn"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Changes</span>
              </button>
            ) : (
              <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5 font-semibold">
                Only the Workspace Owner or Managers are authorized to modify workspace details.
              </p>
            )}
          </form>
        </div>

        {/* Right Side: Metadata / Info */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4" id="settings-info-card">
            <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-50 pb-2">
              <Hash className="w-4 h-4 text-slate-500" />
              <span>Invite Credentials</span>
            </h3>

            <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-center space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Workspace Access Code</p>
              <code className="text-xl font-mono font-black text-indigo-700 tracking-wider block">{workspace.inviteCode}</code>
              
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 transition cursor-pointer shadow-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Invitation Code</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2.5 text-[11px] pt-1.5">
              <div className="flex justify-between border-b border-slate-50 pb-1.5">
                <span className="text-slate-400 font-bold">Created On</span>
                <span className="text-slate-700 font-mono font-bold">
                  {new Date(workspace.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Your Status</span>
                <span className="text-indigo-600 font-extrabold uppercase bg-indigo-50 px-2 py-0.5 rounded text-[9px] border border-indigo-100/50">
                  {role}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-rose-50/40 border border-rose-200/60 rounded-2xl p-6 text-left space-y-4" id="settings-danger-zone">
        <h3 className="font-display font-black text-rose-800 text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
          <span>Danger Zone Control</span>
        </h3>
        <p className="text-xs text-rose-700 font-semibold leading-relaxed">
          {isOwner 
            ? 'Deleting this workspace will immediately destroy all shared task pipelines, message streams, uploaded files, and collaborative wiki documents. This action is irreversible.'
            : 'Leaving this workspace will remove your access. You will require a new invite code to join back.'}
        </p>

        {isOwner ? (
          <div>
            {!showDeleteModal ? (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition shadow-sm shadow-rose-200 cursor-pointer"
                id="delete-workspace-trigger"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Workspace Hub</span>
              </button>
            ) : (
              <div className="bg-white border border-rose-150 p-4 rounded-xl space-y-3.5 max-w-md" id="delete-confirm-box">
                <p className="text-xs font-bold text-slate-800">
                  To confirm deletion, please type the workspace name <strong className="text-rose-600 font-extrabold">"{workspace.name}"</strong> below:
                </p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="Type exact workspace name"
                  className="block w-full px-3 py-2 border border-rose-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-rose-500 focus:outline-none bg-rose-50/10 focus:bg-white"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteWorkspace}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 px-3.5 rounded-lg transition cursor-pointer"
                    id="delete-workspace-final-btn"
                  >
                    Yes, Delete Forever
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2 px-3.5 rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLeave}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition shadow-sm shadow-rose-200 cursor-pointer"
            id="leave-workspace-btn"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Workspace Group</span>
          </button>
        )}
      </div>
    </div>
  );
}
