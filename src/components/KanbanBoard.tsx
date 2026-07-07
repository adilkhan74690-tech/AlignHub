import React, { useState, useEffect } from 'react';
import { getSocket } from '../services/socket';
import { api } from '../services/api';
import { Task, User } from '../types';
import Avatar from './Avatar';
import {
  Kanban,
  Plus,
  Calendar,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertCircle,
  Clock,
  Briefcase
} from 'lucide-react';

interface KanbanBoardProps {
  workspaceId: string;
  initialTasks: Task[];
  members: User[];
  currentUser: User;
}

export default function KanbanBoard({ workspaceId, initialTasks, members, currentUser }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // New task form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'High' | 'Normal' | 'Low'>('Normal');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const socket = getSocket();

  useEffect(() => {
    setTasks(initialTasks);

    // Join room
    socket.emit('join_workspace', { workspaceId });

    // Live socket sync listeners
    socket.on('task_created', (newTask: Task) => {
      if (newTask.workspaceId === workspaceId) {
        setTasks(prev => {
          if (prev.some(t => t._id === newTask._id)) return prev;
          return [...prev, newTask];
        });
      }
    });

    socket.on('task_updated', (updatedTask: Task) => {
      if (updatedTask.workspaceId === workspaceId) {
        setTasks(prev => prev.map(t => (t._id === updatedTask._id ? updatedTask : t)));
      }
    });

    socket.on('task_deleted', ({ taskId }: { taskId: string }) => {
      setTasks(prev => prev.filter(t => t._id !== taskId));
    });

    return () => {
      socket.off('task_created');
      socket.off('task_updated');
      socket.off('task_deleted');
    };
  }, [workspaceId, initialTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const taskObj = {
        title: title.trim(),
        description: description.trim(),
        priority,
        assigneeId: assigneeId || null,
        dueDate
      };

      const created = await api.tasks.create(workspaceId, taskObj);
      
      // Emit via socket so others are notified instantly
      socket.emit('task_create', created);

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('Normal');
      setAssigneeId('');
      setDueDate('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveStatus = (taskId: string, currentStatus: 'To Do' | 'In Progress' | 'Done', direction: 'forward' | 'backward') => {
    let newStatus: 'To Do' | 'In Progress' | 'Done' = currentStatus;
    if (currentStatus === 'To Do' && direction === 'forward') {
      newStatus = 'In Progress';
    } else if (currentStatus === 'In Progress' && direction === 'forward') {
      newStatus = 'Done';
    } else if (currentStatus === 'In Progress' && direction === 'backward') {
      newStatus = 'To Do';
    } else if (currentStatus === 'Done' && direction === 'backward') {
      newStatus = 'In Progress';
    }

    if (newStatus !== currentStatus) {
      socket.emit('task_update', {
        workspaceId,
        taskId,
        updates: { status: newStatus }
      });
    }
  };

  const handleDeleteTask = (taskId: string, taskTitle: string) => {
    if (window.confirm(`Are you sure you want to delete the task "${taskTitle}"?`)) {
      socket.emit('task_delete', { workspaceId, taskId, taskTitle });
    }
  };

  // Group tasks by column status
  const columns: { name: 'To Do' | 'In Progress' | 'Done'; color: string; hoverColor: string }[] = [
    { name: 'To Do', color: 'bg-slate-100 text-slate-800 border-slate-200', hoverColor: 'bg-slate-200' },
    { name: 'In Progress', color: 'bg-amber-50 text-amber-800 border-amber-200/50', hoverColor: 'bg-amber-100' },
    { name: 'Done', color: 'bg-emerald-50 text-emerald-800 border-emerald-200/50', hoverColor: 'bg-emerald-100' }
  ];

  return (
    <div className="space-y-6" id="kanban-panel">
      {/* Board Header & Trigger */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4" id="kanban-header">
        <div className="flex items-center gap-3">
          <div className="bg-amber-50 text-amber-600 p-1.5 rounded-xl">
            <Kanban className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-slate-900 text-sm">Kanban Task Board</h3>
            <p className="text-slate-400 text-[10px] font-medium leading-none mt-1">Assign goals and drag progress live</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-1.5 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Task</span>
        </button>
      </div>

      {/* Inline Task Creation Form */}
      {showAddForm && (
        <form onSubmit={handleCreateTask} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4" id="add-task-form">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-500" />
            <span>Create New Workspace Task</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Task Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Design app logo vector"
                className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800"
              >
                <option value="">-- Unassigned --</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Description / Objectives</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide simple checklists or target milestones"
              rows={2}
              className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Priority Rating</label>
              <div className="flex gap-4 p-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                {(['Low', 'Normal', 'High'] as const).map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      checked={priority === p}
                      onChange={() => setPriority(p)}
                      className="text-indigo-600 focus:ring-0"
                    />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
            >
              Confirm Task
            </button>
          </div>
        </form>
      )}

      {/* Columns Scrollable Container */}
      <div className="overflow-x-auto pb-4 w-full" id="kanban-scroll-wrapper">
        <div className="flex gap-6 min-w-[850px] md:min-w-0 md:grid md:grid-cols-3" id="kanban-columns">
          {columns.map((col) => {
            const colTasks = tasks.filter(t => t.status === col.name);
            return (
              <div key={col.name} className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-4 flex flex-col min-h-[450px] w-[280px] md:w-auto shrink-0 md:shrink text-left" id={`column-${col.name}`}>
                {/* Column Label */}
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-3 mb-4">
                  <span className={`text-xs font-bold border px-2.5 py-1 rounded-full ${col.color}`}>
                    {col.name}
                  </span>
                  <span className="text-xs text-slate-400 font-bold font-mono">
                    {colTasks.length} Cards
                  </span>
                </div>

                {/* Column Cards Container */}
                <div className="flex-1 overflow-y-auto space-y-3" id={`cards-list-${col.name}`}>
                  {colTasks.length === 0 ? (
                    <div className="text-center py-16 text-slate-300 italic text-[11px]">
                      No cards in column
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      // Find assignee info
                      const assignee = members.find(m => m.id === task.assigneeId);
                      
                      return (
                        <div
                          key={task._id}
                          className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm hover:shadow-md transition space-y-3 relative group"
                          id={`task-card-${task._id}`}
                        >
                          {/* Task Priority & Danger buttons */}
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                              task.priority === 'High'
                                ? 'bg-rose-50 text-rose-700 border border-rose-100/50'
                                : (task.priority === 'Normal' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100/50' : 'bg-slate-100 text-slate-500 border border-slate-200/50')
                            }`}>
                              {task.priority} Priority
                            </span>

                            <button
                              onClick={() => handleDeleteTask(task._id, task.title)}
                              className="text-slate-300 hover:text-rose-600 transition opacity-0 group-hover:opacity-100"
                              title="Delete Task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Task Title & Details */}
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-800 leading-snug break-words">{task.title}</h4>
                            {task.description && (
                              <p className="text-slate-500 text-[10px] leading-relaxed mt-1 line-clamp-3 break-words">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Task Metadata line */}
                          <div className="flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] text-slate-400">
                            {/* Assignee display */}
                            <div className="flex items-center gap-1.5 font-medium text-slate-500">
                              {assignee ? (
                                <>
                                  <Avatar
                                    name={assignee.name}
                                    size="xs"
                                    className="w-4 h-4 text-[7px]"
                                  />
                                  <span className="truncate max-w-[80px]">{assignee.name.split(' ')[0]}</span>
                                </>
                              ) : (
                                <>
                                  <UserIcon className="w-3.5 h-3.5 text-slate-300" />
                                  <span>Unassigned</span>
                                </>
                              )}
                            </div>

                            {/* Due date badge */}
                            {task.dueDate && (
                              <div className="flex items-center gap-1 text-slate-400 font-mono text-[9px]">
                                <Calendar className="w-3 h-3 text-slate-300" />
                                <span>{new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                              </div>
                            )}
                          </div>

                          {/* Move Status Buttons */}
                          <div className="border-t border-slate-50 pt-2 flex justify-between gap-1 items-center" id="card-nav-actions">
                            <button
                              disabled={col.name === 'To Do'}
                              onClick={() => handleMoveStatus(task._id, col.name, 'backward')}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded p-1 transition disabled:opacity-20 cursor-pointer"
                              title="Move Backward"
                            >
                              <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                            </button>

                            <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">Move card</span>

                            <button
                              disabled={col.name === 'Done'}
                              onClick={() => handleMoveStatus(task._id, col.name, 'forward')}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded p-1 transition disabled:opacity-20 cursor-pointer"
                              title="Move Forward"
                            >
                              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
