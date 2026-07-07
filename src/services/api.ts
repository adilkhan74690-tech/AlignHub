import { User, Workspace, WorkspaceDetail, Task, Message, FileMeta, Note, NoteHistoryItem, Notification, Activity } from '../types';

const API_BASE =
  import.meta.env.VITE_API_URL || '/api';

// Token Management
export function getToken(): string | null {
  return localStorage.getItem('alignhub_token');
}

export function setToken(token: string) {
  localStorage.setItem('alignhub_token', token);
}

export function removeToken() {
  localStorage.removeItem('alignhub_token');
}

function normalizeIds(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(normalizeIds);
  }
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = normalizeIds(obj[key]);
    }
  }
  if (result._id && (!result.id || result.id === 'undefined')) {
    result.id = typeof result._id === 'object' ? result._id.toString() : String(result._id);
  }
  return result;
}

// Global Fetch Wrapper
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set Content-Type to JSON if not uploading files (which use FormData)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.details || `HTTP error! Status: ${response.status}`);
  }

  const data = await response.json();
  return normalizeIds(data) as T;
}

// ==========================================
// API Endpoint Functions
// ==========================================

export const api = {
  // Auth
  auth: {
    register: async (data: any) => {
      const res = await request<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      setToken(res.token);
      return res;
    },
    login: async (data: any) => {
      const res = await request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      setToken(res.token);
      return res;
    },
    getMe: async () => {
      return request<{ user: User }>('/auth/me');
    },
    logout: () => {
      removeToken();
    },
    updateProfile: async (data: { name?: string; email?: string; password?: string }) => {
      return request<{ user: User }>('/user/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    deleteAccount: async () => {
      return request<{ message: string }>('/user/account', {
        method: 'DELETE'
      });
    }
  },

  // Workspaces
  workspace: {
    create: async (data: { name: string; description?: string }) => {
      return request<Workspace>('/workspaces', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    getAll: async () => {
      return request<Workspace[]>('/workspaces');
    },
    getById: async (id: string) => {
      return request<WorkspaceDetail>(`/workspaces/${id}`);
    },
    join: async (inviteCode: string) => {
      return request<{ message: string; workspaceId: string }>('/workspaces/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode })
      });
    },
    promote: async (workspaceId: string, targetUserId: string) => {
      return request<{ message: string }>(`/workspaces/${workspaceId}/promote`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId })
      });
    },
    demote: async (workspaceId: string, targetUserId: string) => {
      return request<{ message: string }>(`/workspaces/${workspaceId}/demote`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId })
      });
    },
    removeMember: async (workspaceId: string, targetUserId: string) => {
      return request<{ message: string }>(`/workspaces/${workspaceId}/members/${targetUserId}`, {
        method: 'DELETE'
      });
    },
    delete: async (workspaceId: string) => {
      return request<{ message: string }>(`/workspaces/${workspaceId}`, {
        method: 'DELETE'
      });
    },
    update: async (workspaceId: string, data: { name: string; description?: string }) => {
      return request<Workspace>(`/workspaces/${workspaceId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    }
  },

  // Tasks
  tasks: {
    getForWorkspace: async (workspaceId: string) => {
      return request<Task[]>(`/workspaces/${workspaceId}/tasks`);
    },
    create: async (workspaceId: string, data: Partial<Task>) => {
      return request<Task>(`/workspaces/${workspaceId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  },

  // Notes
  notes: {
    getForWorkspace: async (workspaceId: string) => {
      return request<Note[]>(`/workspaces/${workspaceId}/notes`);
    },
    getHistory: async (noteId: string) => {
      return request<NoteHistoryItem[]>(`/notes/${noteId}/history`);
    }
  },

  // Files
  files: {
    getForWorkspace: async (workspaceId: string) => {
      return request<FileMeta[]>(`/workspaces/${workspaceId}/files`);
    },
    upload: async (workspaceId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return request<FileMeta>(`/workspaces/${workspaceId}/files`, {
        method: 'POST',
        body: formData
      });
    },
    getDownloadUrl: (filename: string) => {
      return `/api/files/download/${filename}`;
    }
  },

  // Activity Feed
  activity: {
    getForWorkspace: async (workspaceId: string) => {
      return request<Activity[]>(`/workspaces/${workspaceId}/activity`);
    }
  },

  // Notifications
  notifications: {
    getAll: async () => {
      return request<Notification[]>('/notifications');
    },
    markAllRead: async () => {
      return request<{ success: boolean }>('/notifications/read', {
        method: 'POST'
      });
    }
  },

  // Export
  exportUrl: (workspaceId: string) => {
    return `/api/workspaces/${workspaceId}/export?token=${getToken() || ''}`;
  }
};
