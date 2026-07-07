import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
import { api } from '../services/api';
import { Note, NoteHistoryItem, User, LiveCursor } from '../types';
import Avatar from './Avatar';
import {
  FileText,
  Clock,
  Save,
  Plus,
  Loader2,
  Users,
  CornerDownLeft,
  ArrowLeft,
  RefreshCw,
  Eye,
  Check,
  AlertCircle
} from 'lucide-react';

interface CollabNotesProps {
  workspaceId: string;
  initialNotes: Note[];
  currentUser: User;
}

export default function CollabNotes({ workspaceId, initialNotes, currentUser }: CollabNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  
  // Note inputs state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  
  // History and Cursor states
  const [history, setHistory] = useState<NoteHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeCursors, setActiveCursors] = useState<LiveCursor[]>([]);

  // Conflict Resolution states
  const [conflictNote, setConflictNote] = useState<Note | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const titleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const socket = getSocket();

  useEffect(() => {
    setNotes(initialNotes);
    if (initialNotes.length > 0) {
      handleSelectNote(initialNotes[0]);
    }

    // Join room
    socket.emit('join_workspace', { workspaceId });

    // Sockets listeners for live notes sync
    socket.on('note_updated', (updatedNote: Note) => {
      if (updatedNote.workspaceId === workspaceId) {
        setNotes(prev => {
          const exists = prev.some(n => n._id === updatedNote._id);
          if (exists) {
            return prev.map(n => (n._id === updatedNote._id ? updatedNote : n));
          } else {
            return [updatedNote, ...prev];
          }
        });

        // Sync inputs if this is our currently opened note and we have no conflict active
        setSelectedNote(curr => {
          if (curr && curr._id === updatedNote._id) {
            // Keep cursor position if we are editing, but if it was modified by someone else, we sync content
            if (updatedNote.lastModifiedBy !== currentUser.id && !conflictNote) {
              setTitle(updatedNote.title);
              setContent(updatedNote.content);
            }
            return updatedNote;
          }
          return curr;
        });
      }
    });

    // Listen for version conflicts
    socket.on('note_conflict', (data: { note: Note; error: string }) => {
      setConflictNote(data.note);
      setConflictError(data.error);
    });

    // Listen to real-time cursor activity
    socket.on('note_cursor_moved', (cursor: LiveCursor) => {
      if (cursor.noteId === selectedNote?._id && cursor.userId !== currentUser.id) {
        setActiveCursors(prev => {
          const filtered = prev.filter(c => c.socketId !== cursor.socketId);
          return [...filtered, cursor];
        });
      }
    });

    return () => {
      socket.off('note_updated');
      socket.off('note_conflict');
      socket.off('note_cursor_moved');
    };
  }, [workspaceId, initialNotes, selectedNote?._id, conflictNote]);

  const handleSelectNote = async (note: Note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setHistory([]);
    setShowHistory(false);
    setActiveCursors([]);
    setConflictNote(null);
    setConflictError(null);

    // Clear editing cursor states
    socket.emit('note_cursor_move', {
      workspaceId,
      noteId: note._id,
      elementId: undefined,
      position: undefined
    });
  };

  const handleCreateNewNote = () => {
    const tempNote: Note = {
      _id: 'new_temp',
      workspaceId,
      title: 'New Workspace Document',
      content: '',
      version: 1,
      lastModifiedBy: currentUser.id,
      lastModifiedName: currentUser.name,
      updatedAt: new Date().toISOString()
    };
    setSelectedNote(tempNote);
    setTitle(tempNote.title);
    setContent(tempNote.content);
    setShowHistory(false);
    setHistory([]);
  };

  const loadVersionHistory = async () => {
    if (!selectedNote || selectedNote._id === 'new_temp') return;
    try {
      setLoading(true);
      const data = await api.notes.getHistory(selectedNote._id);
      setHistory(data);
    } catch (err) {
      console.error('Failed to load note draft history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreVersion = (versionItem: NoteHistoryItem) => {
    if (window.confirm(`Are you sure you want to restore "${versionItem.title}" to Version ${versionItem.version}?`)) {
      // Sync immediately via socket note edit
      const targetNoteId = selectedNote?._id === 'new_temp' ? null : selectedNote?._id;
      socket.emit('note_edit', {
        workspaceId,
        noteId: targetNoteId,
        title: versionItem.title,
        content: versionItem.content
      });

      setTitle(versionItem.title);
      setContent(versionItem.content);
      setShowHistory(false);
    }
  };

  // Live Sync trigger functions (triggered with brief keystroke debounces)
  const triggerLiveSync = (updatedTitle: string, updatedContent: string) => {
    const targetNoteId = selectedNote?._id === 'new_temp' ? null : selectedNote?._id;
    socket.emit('note_edit', {
      workspaceId,
      noteId: targetNoteId,
      title: updatedTitle,
      content: updatedContent,
      version: selectedNote?._id === 'new_temp' ? 1 : selectedNote?.version || 1
    });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);

    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    titleTimeoutRef.current = setTimeout(() => {
      triggerLiveSync(val, content);
    }, 1200);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    // Track caret cursor position to emit live cursor position
    const position = e.target.selectionStart;
    socket.emit('note_cursor_move', {
      workspaceId,
      noteId: selectedNote?._id || '',
      elementId: 'note-editor-body',
      position
    });

    if (contentTimeoutRef.current) clearTimeout(contentTimeoutRef.current);
    contentTimeoutRef.current = setTimeout(() => {
      triggerLiveSync(title, val);
    }, 1200);
  };

  const handleManualSave = () => {
    triggerLiveSync(title, content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid md:grid-cols-12 gap-6" id="notes-grid-layout">
      {/* Left Column: Documents Selector */}
      <div className="md:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col h-[250px] md:h-[500px]" id="notes-sidebar">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-500" />
            <span>Document Wikis</span>
          </span>

          <button
            onClick={handleCreateNewNote}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            title="Create new note"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Doc</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1" id="notes-directory-list">
          {notes.length === 0 && selectedNote?._id !== 'new_temp' ? (
            <div className="text-center py-20 text-slate-400">
              <p className="text-xs font-semibold">No Documents Created</p>
              <button
                onClick={handleCreateNewNote}
                className="text-indigo-600 font-bold hover:underline mt-2 text-[11px] block mx-auto"
              >
                + Create the first note
              </button>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note._id}
                onClick={() => handleSelectNote(note)}
                className={`p-3 rounded-xl border cursor-pointer transition text-left space-y-1 ${
                  selectedNote?._id === note._id
                    ? 'bg-indigo-50/70 border-indigo-200/60 shadow-sm'
                    : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                }`}
                id={`note-item-${note._id}`}
              >
                <h4 className="text-xs font-bold text-slate-800 truncate">{note.title}</h4>
                <p className="text-[10px] text-slate-400 line-clamp-1 truncate">{note.content || 'Empty document'}</p>
                <div className="flex justify-between items-center text-[8px] text-slate-400 font-mono mt-2 border-t border-slate-100/50 pt-1">
                  <span>Ver. {note.version}</span>
                  <span>Mod: {note.lastModifiedName}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Editor and History */}
      <div className="md:col-span-8 space-y-4" id="notes-editor-panel">
        {selectedNote ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col h-[400px] md:h-[500px]" id="active-editor-card">
            
            {/* Editor Utilities Line */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-b border-slate-100 pb-3 mb-4">
              {/* Active peer editors bubbles */}
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Active Editors:</span>
                <div className="flex -space-x-1.5 overflow-hidden">
                  {activeCursors.length === 0 ? (
                    <span className="text-[10px] text-slate-400 italic font-medium ml-1">Editing privately</span>
                  ) : (
                    activeCursors.map((cursor, idx) => (
                        <Avatar
                          key={idx}
                          name={cursor.name}
                          size="xs"
                          className="inline-block h-5.5 w-5.5 ring-2 ring-white"
                        />
                    ))
                  )}
                </div>
              </div>

              {/* Version History panel toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const nextShow = !showHistory;
                    setShowHistory(nextShow);
                    if (nextShow) loadVersionHistory();
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Version History</span>
                </button>

                <button
                  onClick={handleManualSave}
                  className={`text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 shadow-sm cursor-pointer transition duration-250 ${
                    saved
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {saved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Synced!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Sync Server</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Note edit conflict alert panel */}
            {conflictNote && (
              <div className="bg-amber-50 border border-amber-250 p-4 rounded-xl text-left space-y-3 mb-4 text-xs">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-amber-800">Conflict Detected</p>
                    <p className="text-slate-600 leading-relaxed">
                      Another team member (<b>{conflictNote.lastModifiedName}</b>) has modified this document since you loaded it. Saving your changes now will overwrite their work.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    onClick={() => {
                      setTitle(conflictNote.title);
                      setContent(conflictNote.content);
                      setSelectedNote(conflictNote);
                      setConflictNote(null);
                      setConflictError(null);
                    }}
                    className="bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                  >
                    Pull Their Version
                  </button>
                  <button
                    onClick={() => {
                      const targetNoteId = selectedNote?._id === 'new_temp' ? null : selectedNote?._id;
                      socket.emit('note_edit', {
                        workspaceId,
                        noteId: targetNoteId,
                        title,
                        content,
                        version: conflictNote.version
                      });
                      setConflictNote(null);
                      setConflictError(null);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    Overwrite Their Version
                  </button>
                </div>
              </div>
            )}

            {/* Editing / Version history split panel */}
            {showHistory ? (
              <div className="flex-1 overflow-y-auto space-y-4" id="history-panel">
                <div className="flex items-center gap-2 border-b border-slate-50 pb-2 mb-2">
                  <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-indigo-600">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-800">Draft Restoration Archive ({history.length} Saved)</span>
                </div>

                {loading ? (
                  <div className="text-center py-24 space-y-2">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs text-slate-500">Retrieving document draft snapshots...</p>
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 italic text-xs">
                    No draft versions archived yet. Snapshots are recorded on subsequent edits.
                  </div>
                ) : (
                  <div className="space-y-3" id="history-snapshots-list">
                    {history.map((snapshot) => (
                      <div
                        key={snapshot._id}
                        className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-slate-800">{snapshot.title || 'Untitled Snapshot'}</h4>
                          <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
                            Ver. {snapshot.version} • Modified by {snapshot.modifiedName} • {new Date(snapshot.createdAt).toLocaleString()}
                          </p>
                          <blockquote className="border-l-2 border-slate-200 pl-3.5 py-1 text-[10px] text-slate-400 italic line-clamp-2 max-w-lg">
                            {snapshot.content || 'Empty draft content'}
                          </blockquote>
                        </div>
                        <button
                          onClick={() => handleRestoreVersion(snapshot)}
                          className="bg-white border border-slate-200 hover:border-indigo-600 hover:text-indigo-600 text-slate-600 text-[10px] font-bold px-3 py-2 rounded-lg transition shrink-0"
                        >
                          Restore Draft
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-3" id="edit-editor-panel">
                <input
                  type="text"
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="Wiki Document Title"
                  className="block w-full border-b border-slate-100 text-base font-bold text-slate-900 pb-2 focus:border-indigo-500 focus:outline-none transition-colors"
                />

                <textarea
                  id="note-editor-body"
                  value={content}
                  onChange={handleContentChange}
                  placeholder="Co-author project resources, notes, code layouts, or markdown templates in real-time. Changes are saved automatically as you type."
                  className="flex-1 w-full text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm space-y-3 h-[500px] flex flex-col justify-center" id="empty-editor-card">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-700 text-sm">No Document Selected</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              Select an existing document from the sidebar directory, or create a brand new one to start writing.
            </p>
            <button
              onClick={handleCreateNewNote}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-sm w-36 mx-auto"
            >
              + Create Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
