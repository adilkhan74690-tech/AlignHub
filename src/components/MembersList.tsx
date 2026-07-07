import React, { useState } from 'react';
import { api } from '../services/api';
import { WorkspaceDetail, User } from '../types';
import Avatar from './Avatar';
import {
  Users,
  Shield,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  UserX,
  LogOut,
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface MembersListProps {
  detail: WorkspaceDetail;
  currentUser: User;
  onRefreshWorkspace: () => void;
  onLeaveWorkspace: () => void;
}

export default function MembersList({ detail, currentUser, onRefreshWorkspace, onLeaveWorkspace }: MembersListProps) {
  const { workspace, role, members } = detail;
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handlePromote = async (targetUserId: string) => {
    if (window.confirm('Are you sure you want to promote this member to Workspace Manager?')) {
      setLoadingUserId(targetUserId);
      setError('');
      try {
        await api.workspace.promote(workspace.id, targetUserId);
        onRefreshWorkspace();
      } catch (err: any) {
        setError(err.message || 'Failed to promote member.');
      } finally {
        setLoadingUserId(null);
      }
    }
  };

  const handleDemote = async (targetUserId: string) => {
    if (window.confirm('Are you sure you want to demote this manager to Workspace Member?')) {
      setLoadingUserId(targetUserId);
      setError('');
      try {
        await api.workspace.demote(workspace.id, targetUserId);
        onRefreshWorkspace();
      } catch (err: any) {
        setError(err.message || 'Failed to demote manager.');
      } finally {
        setLoadingUserId(null);
      }
    }
  };

  const handleKick = async (targetUserId: string, name: string) => {
    if (window.confirm(`Are you absolutely sure you want to remove ${name} from this workspace?`)) {
      setLoadingUserId(targetUserId);
      setError('');
      try {
        await api.workspace.removeMember(workspace.id, targetUserId);
        onRefreshWorkspace();
      } catch (err: any) {
        setError(err.message || 'Failed to remove member.');
      } finally {
        setLoadingUserId(null);
      }
    }
  };

  const handleLeave = () => {
    if (window.confirm('Are you sure you want to leave this workspace? You will need a new invite code to join again.')) {
      onLeaveWorkspace();
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6" id="members-panel">
      {/* Members Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4" id="members-header">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-slate-900 text-sm">Team Roster & Administration</h3>
            <p className="text-slate-400 text-[10px] font-medium leading-none mt-1">Manage member access and role permissions</p>
          </div>
        </div>

        {/* Self Leave Trigger */}
        {role !== 'Owner' && (
          <button
            onClick={handleLeave}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Workspace</span>
          </button>
        )}
      </div>

      {/* Roster list */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl text-left flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600 font-bold px-1">&times;</button>
        </div>
      )}

      <div className="space-y-4" id="members-roster-list">
        {members.map((member) => {
          const isTargetSelf = member.id === currentUser.id;
          const targetRole = member.role || 'Member';

          // Permission flags
          const canPromote = role === 'Owner' && targetRole === 'Member';
          const canDemote = role === 'Owner' && targetRole === 'Manager';
          
          // Kicking permissions: Owners can kick managers/members; Managers can kick members (cannot kick owner/managers)
          const canKick =
            !isTargetSelf &&
            (role === 'Owner' && targetRole !== 'Owner' ||
             role === 'Manager' && targetRole === 'Member');

          return (
            <div
              key={member.id}
              className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-150 rounded-xl"
              id={`member-row-${member.id}`}
            >
              {/* Member Details */}
              <div className="flex items-center gap-3">
                <Avatar
                  name={member.name}
                  size="sm"
                  className="w-9 h-9"
                />
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-tight">
                    {member.name} {isTargetSelf && <span className="text-slate-400 font-normal">(You)</span>}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">{member.email}</p>
                </div>
              </div>

              {/* Roles Badge & Administrative triggers */}
              <div className="flex items-center gap-4">
                {/* Role Badge */}
                <span className={`text-[9px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${
                  targetRole === 'Owner'
                    ? 'bg-rose-50 text-rose-700 border-rose-100/50'
                    : (targetRole === 'Manager' ? 'bg-blue-50 text-blue-700 border-blue-100/50' : 'bg-slate-100 text-slate-500 border-slate-200/50')
                }`}>
                  {targetRole}
                </span>

                {/* Management Action Triggers */}
                {(canPromote || canDemote || canKick) && (
                  <div className="flex items-center gap-1.5 border-l border-slate-200/60 pl-4" id="member-actions-wrapper">
                    {/* Promote/Demote */}
                    {canPromote && (
                      <button
                        onClick={() => handlePromote(member.id)}
                        disabled={loadingUserId === member.id}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                        title="Promote to Manager"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Promote</span>
                      </button>
                    )}

                    {canDemote && (
                      <button
                        onClick={() => handleDemote(member.id)}
                        disabled={loadingUserId === member.id}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-0.5 cursor-pointer"
                        title="Demote to Member"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Demote</span>
                      </button>
                    )}

                    {/* Kick */}
                    {canKick && (
                      <button
                        onClick={() => handleKick(member.id, member.name)}
                        disabled={loadingUserId === member.id}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer"
                        title="Remove member"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
