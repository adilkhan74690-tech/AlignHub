export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  inviteCode: string;
  createdAt: string;
}

export interface WorkspaceDetail {
  workspace: Workspace;
  role: 'Owner' | 'Manager' | 'Member';
  members: User[];
}

export interface Task {
  _id: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: 'To Do' | 'In Progress' | 'Done';
  priority: 'High' | 'Normal' | 'Low';
  assigneeId?: string | null;
  dueDate?: string;
  createdAt: string;
}

export interface Message {
  _id: string;
  workspaceId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
}

export interface FileMeta {
  _id: string;
  workspaceId: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploaderId: string;
  uploaderName: string;
  createdAt: string;
}

export interface Note {
  _id: string;
  workspaceId: string;
  title: string;
  content: string;
  version: number;
  lastModifiedBy: string;
  lastModifiedName: string;
  updatedAt: string;
}

export interface NoteHistoryItem {
  _id: string;
  workspaceId: string;
  noteId: string;
  title: string;
  content: string;
  version: number;
  modifiedBy: string;
  modifiedName: string;
  createdAt: string;
}

export interface Notification {
  _id: string;
  userId: string;
  content: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export interface Activity {
  _id: string;
  workspaceId: string;
  userId: string;
  userName: string;
  type: string;
  details: string;
  createdAt: string;
}

export interface LiveCursor {
  socketId: string;
  userId: string;
  name: string;
  avatarUrl: string;
  noteId: string;
  elementId?: string;
  position?: number;
}
