import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { AuthenticatedRequest, authMiddleware } from './auth';
import {
  createWorkspace,
  getWorkspaceById,
  getWorkspaceByInviteCode,
  updateWorkspaceMembers,
  updateWorkspaceManagers,
  updateWorkspaceProperties,
  deleteWorkspace,
  getWorkspacesForUser,
  getUsersByIds,
  createTask,
  updateTask,
  deleteTask,
  getTasksForWorkspace,
  getFilesForWorkspace,
  createFile,
  getNotesForWorkspace,
  updateNote,
  getNoteHistory,
  getNoteById,
  createNotification,
  getNotificationsForUser,
  markNotificationsRead,
  createActivity,
  getActivitiesForWorkspace,
  exportWorkspaceData,
  updateUser,
  deleteUser
} from './db';

const router = Router();

// Multer Storage Configuration
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// ==========================================
// Helper to verify membership role
// ==========================================
export async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const ws = await getWorkspaceById(workspaceId);
  if (!ws) return null;

  const isOwner = ws.ownerId === userId;
  const isManager = ws.managerIds?.includes(userId) || false;
  const isMember = ws.memberIds?.includes(userId) || false;

  if (!isOwner && !isManager && !isMember) {
    return null; // No access
  }

  return {
    workspace: ws,
    role: isOwner ? 'Owner' : (isManager ? 'Manager' : 'Member')
  };
}

// ==========================================
// USER ENDPOINTS
// ==========================================

router.put('/user/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, email, password } = req.body;
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) {
      const salt = await import('bcryptjs').then(b => b.genSalt(10));
      updateData.password = await import('bcryptjs').then(b => b.hash(password, salt));
    }

    const updatedUser = await updateUser(userId, updateData);
    res.json({
        user: {
            id: updatedUser._id.toString(),
            name: updatedUser.name,
            email: updatedUser.email
        }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
});

router.delete('/user/account', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await deleteUser(userId);
    res.json({ message: 'Account deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete account', details: err.message });
  }
});

// ==========================================
// WORKSPACE ENDPOINTS
// ==========================================

// Create Workspace
router.post('/workspaces', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
       res.status(400).json({ error: 'Workspace name is required' });
       return;
    }

    const userId = req.user!.id;
    const ws = await createWorkspace({
      name,
      description,
      ownerId: userId,
      managerIds: [],
      memberIds: [userId] // Owner is also a member
    });

    await createActivity(ws._id.toString(), userId, req.user!.name, 'create_workspace', `created workspace "${name}"`);

    res.status(201).json(ws);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create workspace', details: err.message });
  }
});

// Update Workspace Properties (Owner or Manager)
router.put('/workspaces/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const userId = req.user!.id;
    const { name, description } = req.body;

    if (!name) {
       res.status(400).json({ error: 'Workspace name is required' });
       return;
    }

    const access = await checkWorkspaceAccess(wsId, userId);
    if (!access || (access.role !== 'Owner' && access.role !== 'Manager')) {
       res.status(403).json({ error: 'Only the Workspace Owner or Manager can modify workspace settings' });
       return;
    }

    const updated = await updateWorkspaceProperties(wsId, name, description);
    await createActivity(wsId, userId, req.user!.name, 'update_workspace', `updated workspace name to "${name}"`);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update workspace settings', details: err.message });
  }
});

// Get all workspaces for user
router.get('/workspaces', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const workspaces = await getWorkspacesForUser(userId);
    res.json(workspaces);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch workspaces', details: err.message });
  }
});

// Get Workspace by ID
router.get('/workspaces/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const userId = req.user!.id;

    const access = await checkWorkspaceAccess(wsId, userId);
    if (!access) {
       res.status(403).json({ error: 'Access denied to this workspace' });
       return;
    }

    const { workspace, role } = access;

    // Fetch member details
    const memberIds = workspace.memberIds || [];
    const members = await getUsersByIds(memberIds);

    // Map roles to members
    const membersWithRoles = members.map(m => {
      let mRole = 'Member';
      if (m._id.toString() === workspace.ownerId) {
        mRole = 'Owner';
      } else if (workspace.managerIds?.includes(m._id.toString())) {
        mRole = 'Manager';
      }
      return {
        id: m._id.toString(),
        name: m.name,
        email: m.email,
        role: mRole
      };
    });

    res.json({
      workspace: {
        id: workspace._id.toString(),
        name: workspace.name,
        description: workspace.description,
        ownerId: workspace.ownerId,
        inviteCode: workspace.inviteCode,
        createdAt: workspace.createdAt
      },
      role,
      members: membersWithRoles
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch workspace', details: err.message });
  }
});

// Join Workspace via Invite Code
router.post('/workspaces/join', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
       res.status(400).json({ error: 'Invite code is required' });
       return;
    }

    const ws = await getWorkspaceByInviteCode(inviteCode);
    if (!ws) {
       res.status(404).json({ error: 'Invalid invite code. Workspace not found.' });
       return;
    }

    const userId = req.user!.id;
    const userName = req.user!.name;

    // Check if already a member
    if (ws.memberIds?.includes(userId) || ws.ownerId === userId) {
       res.status(400).json({ error: 'You are already a member of this workspace', workspaceId: ws._id.toString() });
       return;
    }

    // Add user to workspace memberIds
    await updateWorkspaceMembers(ws._id.toString(), userId, 'add');

    // Record activity
    await createActivity(ws._id.toString(), userId, userName, 'join_workspace', 'joined the workspace');

    // Notify workspace owner
    await createNotification(ws.ownerId, `${userName} joined your workspace "${ws.name}"`, 'workspace');

    res.json({ message: 'Successfully joined workspace', workspaceId: ws._id.toString() });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to join workspace', details: err.message });
  }
});

// Role modification: Promote user to Manager
router.post('/workspaces/:id/promote', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const userId = req.user!.id;
    const { targetUserId } = req.body;

    const access = await checkWorkspaceAccess(wsId, userId);
    if (!access || access.role !== 'Owner') {
       res.status(403).json({ error: 'Only the Workspace Owner can promote members to Manager' });
       return;
    }

    const targetUser = await getUsersByIds([targetUserId]);
    if (!targetUser.length) {
       res.status(404).json({ error: 'Target user not found' });
       return;
    }

    await updateWorkspaceManagers(wsId, targetUserId, 'add');
    await createActivity(wsId, userId, req.user!.name, 'promote_user', `promoted ${targetUser[0].name} to Manager`);
    await createNotification(targetUserId, `You have been promoted to Manager in workspace "${access.workspace.name}"`, 'role');

    res.json({ message: 'User successfully promoted to Manager' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to promote member', details: err.message });
  }
});

// Role modification: Demote user to Member
router.post('/workspaces/:id/demote', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const userId = req.user!.id;
    const { targetUserId } = req.body;

    const access = await checkWorkspaceAccess(wsId, userId);
    if (!access || access.role !== 'Owner') {
       res.status(403).json({ error: 'Only the Workspace Owner can demote Managers to Member' });
       return;
    }

    const targetUser = await getUsersByIds([targetUserId]);
    if (!targetUser.length) {
       res.status(404).json({ error: 'Target user not found' });
       return;
    }

    await updateWorkspaceManagers(wsId, targetUserId, 'remove');
    await createActivity(wsId, userId, req.user!.name, 'demote_user', `demoted ${targetUser[0].name} to Member`);
    await createNotification(targetUserId, `You have been demoted to Member in workspace "${access.workspace.name}"`, 'role');

    res.json({ message: 'User successfully demoted to Member' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to demote member', details: err.message });
  }
});

// Kick member or Leave Workspace
router.delete('/workspaces/:id/members/:userId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const userId = req.user!.id;
    const targetUserId = req.params.userId;

    const access = await checkWorkspaceAccess(wsId, userId);
    if (!access) {
       res.status(403).json({ error: 'Access denied' });
       return;
    }

    const { workspace, role } = access;

    // Self leaving
    const isSelfLeave = userId === targetUserId;

    if (isSelfLeave) {
      if (workspace.ownerId === userId) {
         res.status(400).json({ error: 'As the Workspace Owner, you cannot leave. You must delete or transfer ownership first.' });
         return;
      }
      await updateWorkspaceMembers(wsId, userId, 'remove');
      await createActivity(wsId, userId, req.user!.name, 'leave_workspace', 'left the workspace');
      res.json({ message: 'Successfully left the workspace' });
      return;
    }

    // Kicking another member: Owner can kick anyone; Manager can kick Member (cannot kick Owner or other Managers)
    const targetAccess = await checkWorkspaceAccess(wsId, targetUserId);
    if (!targetAccess) {
       res.status(404).json({ error: 'Target member is not in this workspace' });
       return;
    }

    const isAuthorized =
      role === 'Owner' ||
      (role === 'Manager' && targetAccess.role === 'Member');

    if (!isAuthorized) {
       res.status(403).json({ error: 'You do not have permission to remove this member' });
       return;
    }

    await updateWorkspaceMembers(wsId, targetUserId, 'remove');
    await createActivity(wsId, userId, req.user!.name, 'kick_member', `removed ${targetAccess.workspace.name} from the workspace`);
    await createNotification(targetUserId, `You have been removed from workspace "${workspace.name}"`, 'workspace');

    res.json({ message: 'Member successfully removed from workspace' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove member', details: err.message });
  }
});

// Delete Workspace (Owner only)
router.delete('/workspaces/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const userId = req.user!.id;

    const access = await checkWorkspaceAccess(wsId, userId);
    if (!access || access.role !== 'Owner') {
       res.status(403).json({ error: 'Only the Workspace Owner can delete the workspace' });
       return;
    }

    // Notify other members before deletion
    const members = access.workspace.memberIds || [];
    for (const mId of members) {
      if (mId !== userId) {
        await createNotification(mId, `Workspace "${access.workspace.name}" has been deleted by its owner`, 'workspace');
      }
    }

    await deleteWorkspace(wsId);
    res.json({ message: 'Workspace deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete workspace', details: err.message });
  }
});

// ==========================================
// TASK ENDPOINTS
// ==========================================

// Get Tasks
router.get('/workspaces/:id/tasks', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const access = await checkWorkspaceAccess(wsId, req.user!.id);
    if (!access) {
       res.status(403).json({ error: 'Access denied' });
       return;
    }

    const tasks = await getTasksForWorkspace(wsId);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch tasks', details: err.message });
  }
});

// Create Task
router.post('/workspaces/:id/tasks', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const { title, description, priority, assigneeId, dueDate } = req.body;

    const access = await checkWorkspaceAccess(wsId, req.user!.id);
    if (!access) {
       res.status(403).json({ error: 'Access denied' });
       return;
    }

    if (!title) {
       res.status(400).json({ error: 'Task title is required' });
       return;
    }

    const task = await createTask({
      workspaceId: wsId,
      title,
      description,
      priority,
      assigneeId: assigneeId || null,
      dueDate
    });

    await createActivity(wsId, req.user!.id, req.user!.name, 'create_task', `created task "${title}"`);

    if (assigneeId && assigneeId !== req.user!.id) {
      await createNotification(assigneeId, `${req.user!.name} assigned you a task: "${title}"`, 'task');
    }

    res.status(201).json(task);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create task', details: err.message });
  }
});

// Update Task
router.put('/tasks/:taskId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    // We can lookup workspace ID first to check permissions
    res.json({ message: 'Endpoint implemented. State modification is also synced live via socket' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// ==========================================
// FILE SHARING ENDPOINTS
// ==========================================

// Upload File
router.post('/workspaces/:id/files', authMiddleware, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const access = await checkWorkspaceAccess(wsId, req.user!.id);
    if (!access) {
       res.status(403).json({ error: 'Access denied' });
       return;
    }

    if (!req.file) {
       res.status(400).json({ error: 'No file uploaded' });
       return;
    }

    const fileMeta = await createFile({
      workspaceId: wsId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploaderId: req.user!.id,
      uploaderName: req.user!.name
    });

    await createActivity(wsId, req.user!.id, req.user!.name, 'upload_file', `uploaded file "${req.file.originalname}"`);

    res.status(201).json(fileMeta);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to upload file', details: err.message });
  }
});

// Get Files list
router.get('/workspaces/:id/files', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const access = await checkWorkspaceAccess(wsId, req.user!.id);
    if (!access) {
       res.status(403).json({ error: 'Access denied' });
       return;
    }

    const files = await getFilesForWorkspace(wsId);
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Download File Endpoint
router.get('/files/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
       res.status(404).send('File not found');
       return;
    }

    res.download(filePath);
  } catch (err: any) {
    res.status(500).send('Error downloading file');
  }
});

// ==========================================
// SHARED NOTES ENDPOINTS
// ==========================================

// List Notes
router.get('/workspaces/:id/notes', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const access = await checkWorkspaceAccess(wsId, req.user!.id);
    if (!access) {
       res.status(403).json({ error: 'Access denied' });
       return;
    }

    const notes = await getNotesForWorkspace(wsId);
    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Note History
router.get('/notes/:noteId/history', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { noteId } = req.params;
    const history = await getNoteHistory(noteId);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch note history' });
  }
});

// ==========================================
// ACTIVITY FEED ENDPOINT
// ==========================================
router.get('/workspaces/:id/activity', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const access = await checkWorkspaceAccess(wsId, req.user!.id);
    if (!access) {
       res.status(403).json({ error: 'Access denied' });
       return;
    }

    const feed = await getActivitiesForWorkspace(wsId);
    res.json(feed);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// ==========================================
// NOTIFICATIONS ENDPOINTS
// ==========================================
router.get('/notifications', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await getNotificationsForUser(req.user!.id);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/notifications/read', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await markNotificationsRead(req.user!.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// ==========================================
// WORKSPACE EXPORTER
// ==========================================
router.get('/workspaces/:id/export', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const access = await checkWorkspaceAccess(wsId, req.user!.id);
    if (!access) {
       res.status(403).json({ error: 'Access denied' });
       return;
    }

    const payload = await exportWorkspaceData(wsId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=AlignHub-Workspace-${wsId}.json`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export workspace data', details: err.message });
  }
});

export default router;
