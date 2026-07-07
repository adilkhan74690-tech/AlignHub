import dotenv from 'dotenv';
dotenv.config({ override: true });

import mongoose, { Schema } from 'mongoose';
import fs from 'fs';
import path from 'path';

// Disable Mongoose command/query buffering globally so we fail-fast when not connected
mongoose.set('bufferCommands', false);

let useLocalFallback = false;
const LOCAL_DB_PATH = path.join(process.cwd(), 'local_db.json');

interface LocalDB {
  users: any[];
  workspaces: any[];
  tasks: any[];
  messages: any[];
  files: any[];
  notes: any[];
  noteHistories: any[];
  notifications: any[];
  activities: any[];
}

function loadLocalDB(): LocalDB {
  const defaults: LocalDB = {
    users: [],
    workspaces: [],
    tasks: [],
    messages: [],
    files: [],
    notes: [],
    noteHistories: [],
    notifications: [],
    activities: []
  };
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, 'utf8').trim();
      if (!data) return defaults;
      const parsed = JSON.parse(data);
      return { ...defaults, ...parsed };
    }
  } catch (e) {
    console.error('Error reading local JSON db:', e);
  }
  return defaults;
}

function saveLocalDB(db: LocalDB) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing local JSON db:', e);
  }
}

async function resolveSrvToStandardUri(srvUri: string): Promise<string> {
  const match = srvUri.match(/^mongodb\+srv:\/\/([^@]+)@([^/?#]+)(.*)$/);
  if (!match) throw new Error('Invalid connection string format');
  const credentials = match[1];
  const host = match[2];
  const rest = match[3];

  const srvRes: any = await fetch(`https://dns.google/resolve?name=_mongodb._tcp.${host}&type=SRV`).then(r => r.json());
  if (!srvRes.Answer || srvRes.Answer.length === 0) {
    throw new Error('No SRV records found for ' + host);
  }
  const hosts = srvRes.Answer.map((srv: any) => {
    const parts = srv.data.split(' ');
    let target = parts[3];
    if (target.endsWith('.')) target = target.slice(0, -1);
    return `${target}:${parts[2]}`;
  }).join(',');

  const txtRes: any = await fetch(`https://dns.google/resolve?name=${host}&type=TXT`).then(r => r.json());
  let txtOpts = '';
  if (txtRes.Answer && txtRes.Answer.length > 0) {
    txtOpts = txtRes.Answer[0].data.replace(/^"|"$/g, '');
  }

  let dbPath = '/';
  let restQuery = '';
  if (rest.startsWith('/')) {
    const idx = rest.indexOf('?');
    if (idx !== -1) {
      dbPath = rest.slice(0, idx);
      restQuery = rest.slice(idx + 1);
    } else {
      dbPath = rest;
    }
  }

  const queryParams = [];
  if (txtOpts) queryParams.push(txtOpts);
  if (restQuery) queryParams.push(restQuery);
  if (!queryParams.some(q => q.includes('ssl=') || q.includes('tls='))) {
    queryParams.push('ssl=true');
  }

  return `mongodb://${credentials}@${hosts}${dbPath}${queryParams.length > 0 ? '?' + queryParams.join('&') : ''}`;
}

export async function connectDB() {
  let uri = process.env.MONGODB_URI || '';
  if (!uri || uri.startsWith('mongodb+srv://...')) {
    console.warn('⚠️ MONGODB_URI is missing or not configured. Falling back to persistent local JSON database (local_db.json).');
    useLocalFallback = true;
    return false;
  }

  // Auto-sanitize password angle brackets if present
  const regex = /(mongodb(?:\+srv)?:\/\/[^:]+:)(<[^>]+>)(@.+)/;
  const match = uri.match(regex);
  if (match) {
    const cleanPassword = match[2].slice(1, -1); // remove < and >
    uri = match[1] + cleanPassword + match[3];
    console.log('💡 Auto-sanitized MONGODB_URI (removed `< >` brackets surrounding the password)');
  }

  try {
    console.log('🔌 Connecting to MongoDB with URI:', uri);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✓ MongoDB Connected');
    return true;
  } catch (err: any) {
    console.error('✗ MongoDB Connection Failed:', err.message);

    if (uri.startsWith('mongodb+srv://') && (err.message.includes('ECONNREFUSED') || err.message.includes('querySrv') || err.message.includes('queryTxt') || err.message.includes('ENOTFOUND'))) {
      console.log('ℹ️ Attempting to dynamically resolve mongodb+srv:// URI via Google DNS-over-HTTPS API to bypass local DNS resolution failures...');
      try {
        const resolvedUri = await resolveSrvToStandardUri(uri);
        console.log('ℹ️ Successfully resolved to standard connection string. Attempting connection...');
        await mongoose.connect(resolvedUri, { serverSelectionTimeoutMS: 5000 });
        console.log('✓ MongoDB Connected (via DNS-over-HTTPS fallback)');
        return true;
      } catch (dnsErr: any) {
        console.error('✗ Dynamic DNS resolution/connection fallback failed:', dnsErr.message);
      }
    }

    console.warn('⚠️ Falling back to persistent local JSON database (local_db.json) for 100% functional local preview.');
    useLocalFallback = true;
    return false;
  }
}

export function isMongoActive() {
  return mongoose.connection.readyState === 1 || useLocalFallback;
}

// ==========================================
// Mongoose Schema Definitions
// ==========================================

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const WorkspaceSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  ownerId: { type: String, required: true },
  managerIds: { type: [String], default: [] },
  memberIds: { type: [String], default: [] },
  inviteCode: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const TaskSchema = new Schema({
  workspaceId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['To Do', 'In Progress', 'Done'], default: 'To Do' },
  priority: { type: String, enum: ['High', 'Normal', 'Low'], default: 'Normal' },
  assigneeId: { type: String, default: null },
  dueDate: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new Schema({
  workspaceId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userAvatar: { type: String },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const FileSchema = new Schema({
  workspaceId: { type: String, required: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, default: '' },
  size: { type: Number, default: 0 },
  uploaderId: { type: String, required: true },
  uploaderName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const NoteSchema = new Schema({
  workspaceId: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, default: '' },
  version: { type: Number, default: 1 },
  lastModifiedBy: { type: String, default: '' },
  lastModifiedName: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

const NoteHistorySchema = new Schema({
  workspaceId: { type: String, required: true },
  noteId: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, default: '' },
  version: { type: Number, required: true },
  modifiedBy: { type: String, required: true },
  modifiedName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const NotificationSchema = new Schema({
  userId: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'info' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const ActivitySchema = new Schema({
  workspaceId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  type: { type: String, required: true }, // e.g. "create_workspace", "create_task", "update_task", "upload_file", "join_workspace", "leave_workspace", "send_message", "edit_note"
  details: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// Models (Mongoose compiles model only if not compiled yet to prevent re-compilation error)
export const UserModel: any = mongoose.models.User || mongoose.model('User', UserSchema);
export const WorkspaceModel: any = mongoose.models.Workspace || mongoose.model('Workspace', WorkspaceSchema);
export const TaskModel: any = mongoose.models.Task || mongoose.model('Task', TaskSchema);
export const MessageModel: any = mongoose.models.Message || mongoose.model('Message', MessageSchema);
export const FileModel: any = mongoose.models.File || mongoose.model('File', FileSchema);
export const NoteModel: any = mongoose.models.Note || mongoose.model('Note', NoteSchema);
export const NoteHistoryModel: any = mongoose.models.NoteHistory || mongoose.model('NoteHistory', NoteHistorySchema);
export const NotificationModel: any = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
export const ActivityModel: any = mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);

// Helper to generate unique string ID
function nextId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// ==========================================
// Data Operations (Mongoose + JSON Fallback Engine)
// ==========================================

export async function deleteUser(userId: string) {
  if (!useLocalFallback) {
    await UserModel.findByIdAndDelete(userId);
    // Also delete user's data? The requirements don't explicitly say. I'll just delete the user for now.
    return true;
  }
  const db = loadLocalDB();
  db.users = db.users.filter(u => u._id !== userId && u.id !== userId);
  saveLocalDB(db);
  return true;
}

export async function updateUser(userId: string, data: any) {
  if (!useLocalFallback) {
    const user = await UserModel.findByIdAndUpdate(userId, data, { new: true });
    return user ? user.toObject() : null;
  }
  const db = loadLocalDB();
  const user = db.users.find(u => u._id === userId || u.id === userId);
  if (!user) return null;
  Object.assign(user, data);
  saveLocalDB(db);
  return { ...user };
}

export async function createUser(data: any) {
  if (!useLocalFallback) {
    const user = new UserModel(data);
    const saved = await user.save();
    return saved.toObject();
  }
  const db = loadLocalDB();
  const id = nextId();
  const newUser = {
    _id: id,
    id: id,
    name: data.name,
    email: data.email,
    password: data.password,
    createdAt: new Date().toISOString()
  };
  db.users.push(newUser);
  saveLocalDB(db);
  return newUser;
}

export async function getUserByEmail(email: string) {
  if (!useLocalFallback) {
    const user = await UserModel.findOne({ email });
    return user ? user.toObject() : null;
  }
  const db = loadLocalDB();
  const u = db.users.find(user => user.email.toLowerCase() === email.toLowerCase());
  return u ? { ...u } : null;
}

export async function getUserById(id: string) {
  if (!useLocalFallback) {
    const user = await UserModel.findById(id);
    return user ? user.toObject() : null;
  }
  const db = loadLocalDB();
  const u = db.users.find(user => user._id === id || user.id === id);
  return u ? { ...u } : null;
}

export async function getUsersByIds(ids: string[]) {
  if (!useLocalFallback) {
    const users = await UserModel.find({ _id: { $in: ids } });
    return users.map(u => u.toObject());
  }
  const db = loadLocalDB();
  return db.users.filter(user => ids.includes(user._id) || ids.includes(user.id)).map(u => ({ ...u }));
}

// Workspaces
export async function createWorkspace(data: any) {
  if (!useLocalFallback) {
    const workspace = new WorkspaceModel({
      ...data,
      inviteCode: nextId().substring(0, 8).toUpperCase()
    });
    const saved = await workspace.save();
    return saved.toObject();
  }
  const db = loadLocalDB();
  const id = nextId();
  const newWorkspace = {
    _id: id,
    id: id,
    name: data.name,
    description: data.description || '',
    ownerId: data.ownerId,
    managerIds: data.managerIds || [],
    memberIds: data.memberIds || [],
    inviteCode: nextId().substring(0, 8).toUpperCase(),
    createdAt: new Date().toISOString()
  };
  db.workspaces.push(newWorkspace);
  saveLocalDB(db);
  return newWorkspace;
}

export async function getWorkspaceById(id: string) {
  if (!useLocalFallback) {
    const ws = await WorkspaceModel.findById(id);
    return ws ? ws.toObject() : null;
  }
  const db = loadLocalDB();
  const ws = db.workspaces.find(w => w._id === id || w.id === id);
  return ws ? { ...ws } : null;
}

export async function getWorkspaceByInviteCode(inviteCode: string) {
  if (!useLocalFallback) {
    const ws = await WorkspaceModel.findOne({ inviteCode: inviteCode.toUpperCase() });
    return ws ? ws.toObject() : null;
  }
  const db = loadLocalDB();
  const ws = db.workspaces.find(w => w.inviteCode === inviteCode.toUpperCase());
  return ws ? { ...ws } : null;
}

export async function updateWorkspaceMembers(workspaceId: string, memberId: string, action: 'add' | 'remove') {
  if (!useLocalFallback) {
    const update = action === 'add'
      ? { $addToSet: { memberIds: memberId } }
      : { $pull: { memberIds: memberId, managerIds: memberId } };
    const ws = await WorkspaceModel.findByIdAndUpdate(workspaceId, update, { new: true });
    return ws ? ws.toObject() : null;
  }
  const db = loadLocalDB();
  const ws = db.workspaces.find(w => w._id === workspaceId || w.id === workspaceId);
  if (!ws) return null;
  if (action === 'add') {
    if (!ws.memberIds.includes(memberId)) {
      ws.memberIds.push(memberId);
    }
  } else {
    ws.memberIds = ws.memberIds.filter((id: string) => id !== memberId);
    ws.managerIds = (ws.managerIds || []).filter((id: string) => id !== memberId);
  }
  saveLocalDB(db);
  return { ...ws };
}

export async function updateWorkspaceManagers(workspaceId: string, managerId: string, action: 'add' | 'remove') {
  if (!useLocalFallback) {
    const update = action === 'add'
      ? { $addToSet: { managerIds: managerId } }
      : { $pull: { managerIds: managerId } };
    const ws = await WorkspaceModel.findByIdAndUpdate(workspaceId, update, { new: true });
    return ws ? ws.toObject() : null;
  }
  const db = loadLocalDB();
  const ws = db.workspaces.find(w => w._id === workspaceId || w.id === workspaceId);
  if (!ws) return null;
  if (action === 'add') {
    if (!ws.managerIds) ws.managerIds = [];
    if (!ws.managerIds.includes(managerId)) {
      ws.managerIds.push(managerId);
    }
  } else {
    ws.managerIds = (ws.managerIds || []).filter((id: string) => id !== managerId);
  }
  saveLocalDB(db);
  return { ...ws };
}

export async function updateWorkspaceProperties(workspaceId: string, name: string, description: string) {
  if (!useLocalFallback) {
    const ws = await WorkspaceModel.findByIdAndUpdate(workspaceId, { name, description }, { new: true });
    return ws ? ws.toObject() : null;
  }
  const db = loadLocalDB();
  const ws = db.workspaces.find(w => w._id === workspaceId || w.id === workspaceId);
  if (!ws) return null;
  ws.name = name;
  ws.description = description;
  saveLocalDB(db);
  return { ...ws };
}

export async function deleteWorkspace(workspaceId: string) {
  if (!useLocalFallback) {
    await WorkspaceModel.findByIdAndDelete(workspaceId);
    await TaskModel.deleteMany({ workspaceId });
    await MessageModel.deleteMany({ workspaceId });
    await FileModel.deleteMany({ workspaceId });
    await NoteModel.deleteMany({ workspaceId });
    await NoteHistoryModel.deleteMany({ workspaceId });
    await ActivityModel.deleteMany({ workspaceId });
    return true;
  }
  const db = loadLocalDB();
  db.workspaces = db.workspaces.filter(w => w._id !== workspaceId && w.id !== workspaceId);
  db.tasks = db.tasks.filter(t => t.workspaceId !== workspaceId);
  db.messages = db.messages.filter(m => m.workspaceId !== workspaceId);
  db.files = db.files.filter(f => f.workspaceId !== workspaceId);
  db.notes = db.notes.filter(n => n.workspaceId !== workspaceId);
  db.noteHistories = db.noteHistories.filter(nh => nh.workspaceId !== workspaceId);
  db.activities = db.activities.filter(a => a.workspaceId !== workspaceId);
  saveLocalDB(db);
  return true;
}

export async function getWorkspacesForUser(userId: string) {
  if (!useLocalFallback) {
    const list = await WorkspaceModel.find({
      $or: [
        { ownerId: userId },
        { managerIds: userId },
        { memberIds: userId }
      ]
    });
    return list.map(w => w.toObject());
  }
  const db = loadLocalDB();
  return db.workspaces.filter(w => 
    w.ownerId === userId || 
    (w.managerIds && w.managerIds.includes(userId)) || 
    (w.memberIds && w.memberIds.includes(userId))
  ).map(w => ({ ...w }));
}

// Tasks
export async function createTask(data: any) {
  if (!useLocalFallback) {
    const task = new TaskModel(data);
    const saved = await task.save();
    return saved.toObject();
  }
  const db = loadLocalDB();
  const id = nextId();
  const newTask = {
    _id: id,
    id: id,
    workspaceId: data.workspaceId,
    title: data.title,
    description: data.description || '',
    status: data.status || 'To Do',
    priority: data.priority || 'Normal',
    assigneeId: data.assigneeId || null,
    dueDate: data.dueDate || '',
    createdAt: new Date().toISOString()
  };
  db.tasks.push(newTask);
  saveLocalDB(db);
  return newTask;
}

export async function updateTask(taskId: string, updates: any) {
  if (!useLocalFallback) {
    const task = await TaskModel.findByIdAndUpdate(taskId, updates, { new: true });
    return task ? task.toObject() : null;
  }
  const db = loadLocalDB();
  const task = db.tasks.find(t => t._id === taskId || t.id === taskId);
  if (!task) return null;
  Object.assign(task, updates);
  saveLocalDB(db);
  return { ...task };
}

export async function deleteTask(taskId: string) {
  if (!useLocalFallback) {
    const res = await TaskModel.findByIdAndDelete(taskId);
    return !!res;
  }
  const db = loadLocalDB();
  const initialLen = db.tasks.length;
  db.tasks = db.tasks.filter(t => t._id !== taskId && t.id !== taskId);
  saveLocalDB(db);
  return db.tasks.length < initialLen;
}

export async function getTasksForWorkspace(workspaceId: string) {
  if (!useLocalFallback) {
    const tasks = await TaskModel.find({ workspaceId });
    return tasks.map(t => t.toObject());
  }
  const db = loadLocalDB();
  return db.tasks.filter(t => t.workspaceId === workspaceId).map(t => ({ ...t }));
}

// Messages (Chat)
export async function createMessage(data: any) {
  if (!useLocalFallback) {
    const msg = new MessageModel(data);
    const saved = await msg.save();
    return saved.toObject();
  }
  const db = loadLocalDB();
  const id = nextId();
  const newMsg = {
    _id: id,
    id: id,
    workspaceId: data.workspaceId,
    userId: data.userId,
    userName: data.userName,
    userAvatar: data.userAvatar,
    content: data.content,
    createdAt: new Date().toISOString()
  };
  db.messages.push(newMsg);
  saveLocalDB(db);
  return newMsg;
}

export async function getMessagesForWorkspace(workspaceId: string) {
  if (!useLocalFallback) {
    const list = await MessageModel.find({ workspaceId }).sort({ createdAt: 1 });
    return list.map(m => m.toObject());
  }
  const db = loadLocalDB();
  return db.messages
    .filter(m => m.workspaceId === workspaceId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(m => ({ ...m }));
}

// Files
export async function createFile(data: any) {
  if (!useLocalFallback) {
    const file = new FileModel(data);
    const saved = await file.save();
    return saved.toObject();
  }
  const db = loadLocalDB();
  const id = nextId();
  const newFile = {
    _id: id,
    id: id,
    workspaceId: data.workspaceId,
    filename: data.filename,
    originalName: data.originalName,
    mimetype: data.mimetype || '',
    size: data.size || 0,
    uploaderId: data.uploaderId,
    uploaderName: data.uploaderName,
    createdAt: new Date().toISOString()
  };
  db.files.push(newFile);
  saveLocalDB(db);
  return newFile;
}

export async function getFilesForWorkspace(workspaceId: string) {
  if (!useLocalFallback) {
    const list = await FileModel.find({ workspaceId }).sort({ createdAt: -1 });
    return list.map(f => f.toObject());
  }
  const db = loadLocalDB();
  return db.files
    .filter(f => f.workspaceId === workspaceId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(f => ({ ...f }));
}

// Shared Notes
export async function getNotesForWorkspace(workspaceId: string) {
  if (!useLocalFallback) {
    const notes = await NoteModel.find({ workspaceId }).sort({ updatedAt: -1 });
    return notes.map(n => n.toObject());
  }
  const db = loadLocalDB();
  return db.notes
    .filter(n => n.workspaceId === workspaceId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(n => ({ ...n }));
}

export async function getNoteById(id: string) {
  if (!useLocalFallback) {
    const note = await NoteModel.findById(id);
    return note ? note.toObject() : null;
  }
  const db = loadLocalDB();
  const note = db.notes.find(n => n._id === id || n.id === id);
  return note ? { ...note } : null;
}

export async function updateNote(workspaceId: string, noteId: string | null, data: any, userId: string, userName: string) {
  const title = data.title || 'Untitled Note';
  const content = data.content || '';

  if (!useLocalFallback) {
    let note;
    if (noteId) {
      note = await NoteModel.findById(noteId);
    }
    
    if (note) {
      const oldTitle = note.title;
      const oldContent = note.content;
      const nextVersion = note.version + 1;
      
      note.title = title;
      note.content = content;
      note.version = nextVersion;
      note.lastModifiedBy = userId;
      note.lastModifiedName = userName;
      note.updatedAt = new Date();
      await note.save();
      
      // Save version history entry
      const history = new NoteHistoryModel({
        workspaceId,
        noteId: note._id.toString(),
        title: oldTitle,
        content: oldContent,
        version: note.version - 1,
        modifiedBy: userId,
        modifiedName: userName
      });
      await history.save();
      
      return note.toObject();
    } else {
      // Create new note
      const newNote = new NoteModel({
        workspaceId,
        title,
        content,
        version: 1,
        lastModifiedBy: userId,
        lastModifiedName: userName
      });
      const saved = await newNote.save();
      return saved.toObject();
    }
  }

  const db = loadLocalDB();
  let note = noteId ? db.notes.find(n => n._id === noteId || n.id === noteId) : null;

  if (note) {
    const oldTitle = note.title;
    const oldContent = note.content;
    const nextVersion = note.version + 1;

    // Save history
    const historyId = nextId();
    const historyEntry = {
      _id: historyId,
      id: historyId,
      workspaceId,
      noteId: note._id,
      title: oldTitle,
      content: oldContent,
      version: note.version,
      modifiedBy: userId,
      modifiedName: userName,
      createdAt: new Date().toISOString()
    };
    db.noteHistories.push(historyEntry);

    note.title = title;
    note.content = content;
    note.version = nextVersion;
    note.lastModifiedBy = userId;
    note.lastModifiedName = userName;
    note.updatedAt = new Date().toISOString();

    saveLocalDB(db);
    return { ...note };
  } else {
    const id = nextId();
    const newNote = {
      _id: id,
      id: id,
      workspaceId,
      title,
      content,
      version: 1,
      lastModifiedBy: userId,
      lastModifiedName: userName,
      updatedAt: new Date().toISOString()
    };
    db.notes.push(newNote);
    saveLocalDB(db);
    return newNote;
  }
}

export async function getNoteHistory(noteId: string) {
  if (!useLocalFallback) {
    const list = await NoteHistoryModel.find({ noteId }).sort({ version: -1 });
    return list.map(h => h.toObject());
  }
  const db = loadLocalDB();
  return db.noteHistories
    .filter(h => h.noteId === noteId)
    .sort((a, b) => b.version - a.version)
    .map(h => ({ ...h }));
}

// Live Notifications
export async function createNotification(userId: string, content: string, type = 'info') {
  if (!useLocalFallback) {
    const notification = new NotificationModel({ userId, content, type });
    const saved = await notification.save();
    return saved.toObject();
  }
  const db = loadLocalDB();
  const id = nextId();
  const newNotif = {
    _id: id,
    id: id,
    userId,
    content,
    type,
    read: false,
    createdAt: new Date().toISOString()
  };
  db.notifications.push(newNotif);
  saveLocalDB(db);
  return newNotif;
}

export async function getNotificationsForUser(userId: string) {
  if (!useLocalFallback) {
    const list = await NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(30);
    return list.map(n => n.toObject());
  }
  const db = loadLocalDB();
  return db.notifications
    .filter(n => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30)
    .map(n => ({ ...n }));
}

export async function markNotificationsRead(userId: string) {
  if (!useLocalFallback) {
    await NotificationModel.updateMany({ userId, read: false }, { $set: { read: true } });
    return true;
  }
  const db = loadLocalDB();
  db.notifications.forEach(n => {
    if (n.userId === userId) {
      n.read = true;
    }
  });
  saveLocalDB(db);
  return true;
}

// Activity Tracking
export async function createActivity(workspaceId: string, userId: string, userName: string, type: string, details = '') {
  if (!useLocalFallback) {
    const act = new ActivityModel({ workspaceId, userId, userName, type, details });
    const saved = await act.save();
    return saved.toObject();
  }
  const db = loadLocalDB();
  const id = nextId();
  const newAct = {
    _id: id,
    id: id,
    workspaceId,
    userId,
    userName,
    type,
    details,
    createdAt: new Date().toISOString()
  };
  db.activities.push(newAct);
  saveLocalDB(db);
  return newAct;
}

export async function getActivitiesForWorkspace(workspaceId: string) {
  if (!useLocalFallback) {
    const list = await ActivityModel.find({ workspaceId }).sort({ createdAt: -1 }).limit(50);
    return list.map(a => a.toObject());
  }
  const db = loadLocalDB();
  return db.activities
    .filter(a => a.workspaceId === workspaceId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50)
    .map(a => ({ ...a }));
}

// Workspace Data Exporter
export async function exportWorkspaceData(workspaceId: string) {
  const ws = await getWorkspaceById(workspaceId);
  if (!ws) throw new Error('Workspace not found');

  const tasks = await getTasksForWorkspace(workspaceId);
  const messages = await getMessagesForWorkspace(workspaceId);
  const files = await getFilesForWorkspace(workspaceId);
  const notes = await getNotesForWorkspace(workspaceId);
  const activities = await getActivitiesForWorkspace(workspaceId);

  return {
    workspace: ws,
    tasks,
    messages,
    files,
    notes,
    activities,
    exportedAt: new Date()
  };
}
