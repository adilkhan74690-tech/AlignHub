import { Server, Socket } from 'socket.io';
import { verifySocketToken } from './auth';
import {
  createMessage,
  updateTask,
  deleteTask,
  updateNote,
  createActivity,
  createNotification,
  getNoteById
} from './db';

// Active users in workspaces
// Key: workspaceId -> Value: Array of user info
interface WorkspacePresenceUser {
  socketId: string;
  userId: string;
  name: string;
  avatarUrl: string;
  cursor?: {
    elementId?: string;
    position?: number;
  };
}

const activeUsers = new Map<string, WorkspacePresenceUser[]>();

// Mapping of connected user ID to their socket IDs for direct notifications
const userSockets = new Map<string, string[]>();

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    // 1. Authenticate connection
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      console.log('Socket connection rejected: No token provided');
      socket.disconnect();
      return;
    }

    const decoded = verifySocketToken(token as string);
    if (!decoded) {
      console.log('Socket connection rejected: Invalid token');
      socket.disconnect();
      return;
    }

    const userId = decoded.id;
    const userName = decoded.name;
    const userAvatar = decoded.avatarUrl;

    // Track user's active sockets
    const existingSockets = userSockets.get(userId) || [];
    existingSockets.push(socket.id);
    userSockets.set(userId, existingSockets);

    console.log(`User connected to Socket: ${userName} (ID: ${userId})`);

    // Broadcast online status to other users if this is their first connection
    if (existingSockets.length === 1) {
      socket.broadcast.emit('user_status_change', { userId, online: true });
    }

    // Allow user to query currently online user IDs
    socket.on('get_online_users', (callback: any) => {
      if (typeof callback === 'function') {
        callback(Array.from(userSockets.keys()));
      }
    });

    // Helper to send direct notification to a specific user
    async function sendDirectNotification(targetUserId: string, content: string, type = 'info') {
      try {
        const notif = await createNotification(targetUserId, content, type);
        const sockets = userSockets.get(targetUserId) || [];
        sockets.forEach(sId => {
          io.to(sId).emit('new_notification', notif);
        });
      } catch (err) {
        console.error('Error sending direct socket notification:', err);
      }
    }

    // 2. Joining a workspace room
    socket.on('join_workspace', async ({ workspaceId }: { workspaceId: string }) => {
      if (!workspaceId) return;

      socket.join(workspaceId);
      console.log(`Socket ${socket.id} (${userName}) joined workspace room ${workspaceId}`);

      // Add user to presence list for this workspace
      const presenceList = activeUsers.get(workspaceId) || [];
      // Remove any existing socket entry for the same user-socket pair
      const filtered = presenceList.filter(u => u.socketId !== socket.id);
      
      const newPresenceUser: WorkspacePresenceUser = {
        socketId: socket.id,
        userId,
        name: userName,
        avatarUrl: userAvatar
      };
      
      filtered.push(newPresenceUser);
      activeUsers.set(workspaceId, filtered);

      // Broadcast updated presence list
      io.to(workspaceId).emit('presence_update', filtered);

      // Notify others in room
      socket.to(workspaceId).emit('user_joined_room', { userId, name: userName });
    });

    // 3. Leaving workspace room
    socket.on('leave_workspace', ({ workspaceId }: { workspaceId: string }) => {
      if (!workspaceId) return;

      socket.leave(workspaceId);
      console.log(`Socket ${socket.id} left workspace room ${workspaceId}`);

      const presenceList = activeUsers.get(workspaceId) || [];
      const updated = presenceList.filter(u => u.socketId !== socket.id);
      activeUsers.set(workspaceId, updated);

      io.to(workspaceId).emit('presence_update', updated);
    });

    // 4. Team Chat Messaging
    socket.on('send_message', async (data: { workspaceId: string; content: string }) => {
      const { workspaceId, content } = data;
      if (!workspaceId || !content) return;

      try {
        const msg = await createMessage({
          workspaceId,
          userId,
          userName,
          userAvatar,
          content
        });

        // Broadcast to all clients in the workspace room
        io.to(workspaceId).emit('new_message', msg);

        // Record Activity silently
        await createActivity(workspaceId, userId, userName, 'send_message', `sent a message`);
      } catch (err) {
        console.error('Socket send_message error:', err);
      }
    });

    // 5. Typing Indicators
    socket.on('typing_start', ({ workspaceId }: { workspaceId: string }) => {
      socket.to(workspaceId).emit('typing_started', { userId, name: userName });
    });

    socket.on('typing_stop', ({ workspaceId }: { workspaceId: string }) => {
      socket.to(workspaceId).emit('typing_stopped', { userId });
    });

    // 6. Real-time Kanban Board operations
    socket.on('task_create', (task: any) => {
      // Broadcast task creation to other workspace members
      if (task.workspaceId) {
        io.to(task.workspaceId).emit('task_created', task);
      }
    });

    socket.on('task_update', async (data: { workspaceId: string; taskId: string; updates: any }) => {
      const { workspaceId, taskId, updates } = data;
      if (!workspaceId || !taskId) return;

      try {
        const updatedTask = await updateTask(taskId, updates);
        if (updatedTask) {
          // Broadcast to everyone in room including sender to ensure synced board state
          io.to(workspaceId).emit('task_updated', updatedTask);

          // Activity Tracking
          let detail = 'updated task';
          if (updates.status) detail = `moved task "${updatedTask.title}" to ${updates.status}`;
          else if (updates.title) detail = `renamed task to "${updates.title}"`;
          
          await createActivity(workspaceId, userId, userName, 'update_task', detail);

          // Notification if task is newly assigned
          if (updates.assigneeId && updates.assigneeId !== userId) {
            await sendDirectNotification(
              updates.assigneeId,
              `${userName} assigned you a task: "${updatedTask.title}"`,
              'task'
            );
          }
        }
      } catch (err) {
        console.error('Socket task_update error:', err);
      }
    });

    socket.on('task_delete', async (data: { workspaceId: string; taskId: string; taskTitle: string }) => {
      const { workspaceId, taskId, taskTitle } = data;
      if (!workspaceId || !taskId) return;

      try {
        const ok = await deleteTask(taskId);
        if (ok) {
          io.to(workspaceId).emit('task_deleted', { taskId });
          await createActivity(workspaceId, userId, userName, 'delete_task', `deleted task "${taskTitle}"`);
        }
      } catch (err) {
        console.error('Socket task_delete error:', err);
      }
    });

    // 7. Collaborative Shared Notes & Live Cursor Position Tracking
    socket.on('note_cursor_move', (data: { workspaceId: string; noteId: string; elementId?: string; position?: number }) => {
      const { workspaceId, noteId, elementId, position } = data;
      if (!workspaceId) return;

      // Update cursor position in active user list
      const presenceList = activeUsers.get(workspaceId) || [];
      const user = presenceList.find(u => u.socketId === socket.id);
      if (user) {
        user.cursor = { elementId, position };
      }

      // Broadcast live cursor to others in room
      socket.to(workspaceId).emit('note_cursor_moved', {
        socketId: socket.id,
        userId,
        name: userName,
        avatarUrl: userAvatar,
        noteId,
        elementId,
        position
      });
    });

    socket.on('note_edit', async (data: { workspaceId: string; noteId: string | null; title: string; content: string; version?: number }) => {
      const { workspaceId, noteId, title, content, version } = data;
      if (!workspaceId) return;

      try {
        // Safe check for version conflict before saving changes
        if (noteId && version !== undefined) {
          const existingNote = await getNoteById(noteId);
          if (existingNote && existingNote.version > version) {
            if (existingNote.title !== title || existingNote.content !== content) {
              socket.emit('note_conflict', {
                note: existingNote,
                error: 'Conflict detected: Another user has updated this document since you opened it.'
              });
              return;
            }
          }
        }

        const note = await updateNote(workspaceId, noteId, { title, content }, userId, userName);
        
        // Broadcast full updated state (Last-write wins + version increment)
        io.to(workspaceId).emit('note_updated', note);

        // Activity log
        await createActivity(workspaceId, userId, userName, 'edit_note', `edited note "${title}"`);
      } catch (err) {
        console.error('Socket note_edit error:', err);
      }
    });

    // 8. File Upload Sync
    socket.on('file_upload', (fileMeta: any) => {
      if (fileMeta.workspaceId) {
        io.to(fileMeta.workspaceId).emit('file_uploaded', fileMeta);
      }
    });

    // 9. Clean up on disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (${userName})`);

      // Remove from userSockets tracking
      const sockets = userSockets.get(userId) || [];
      const remainingSockets = sockets.filter(sId => sId !== socket.id);
      if (remainingSockets.length > 0) {
        userSockets.set(userId, remainingSockets);
      } else {
        userSockets.delete(userId);
        // Broadcast offline status globally to update all dashboards
        io.emit('user_status_change', { userId, online: false });
      }

      // Remove from all active workspace presence lists
      activeUsers.forEach((presenceList, workspaceId) => {
        const updated = presenceList.filter(u => u.socketId !== socket.id);
        if (updated.length !== presenceList.length) {
          activeUsers.set(workspaceId, updated);
          // Broadcast updated room presence
          io.to(workspaceId).emit('presence_update', updated);
        }
      });
    });
  });
}
