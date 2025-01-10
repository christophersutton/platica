import type { Context } from 'hono';
import { BaseController, ApiError } from '../base-controller';
import type { DatabaseProvider } from '../../db/repositories/base';
import { WorkspaceRepository } from '../../db/repositories/workspace-repository';
import type { 
  Workspace, 
  CreateWorkspaceDTO,
  UpdateWorkspaceDTO,
  WorkspaceMember
} from '@models/workspace';
import type { User, NotificationPreferences } from '@models/user';
import { UserRole } from '@constants/enums';

interface CreateWorkspaceBody {
  name: string;
  iconUrl?: string | null;
  settings?: {
    fileSizeLimit?: number;
    defaultMessageRetentionDays?: number;
    notificationDefaults?: NotificationPreferences;
  };
}

interface UpdateWorkspaceBody extends Partial<CreateWorkspaceBody> {}

interface InviteUserBody {
  email: string;
  role?: UserRole;
}

interface UpdateUserBody {
  role?: UserRole;
  displayName?: string;
  status?: string;
  statusMessage?: string;
  notificationPreferences?: NotificationPreferences;
}

export class WorkspaceController extends BaseController {
  private readonly workspaceRepo: WorkspaceRepository;

  constructor(workspaceRepo: WorkspaceRepository) {
    super();
    this.workspaceRepo = workspaceRepo;
  }

  static create(dbProvider: DatabaseProvider): WorkspaceController {
    return new WorkspaceController(new WorkspaceRepository(dbProvider.db));
  }

  getWorkspaces = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const { userId } = this.requireUser(c);
      return this.workspaceRepo.getUserWorkspaces(userId);
    });
  };

  getWorkspace = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const { userId } = this.requireUser(c);

      const workspace = await this.workspaceRepo.getWorkspaceWithMeta(workspaceId, userId);
      if (!workspace) {
        throw new ApiError('Workspace not found', 404);
      }

      return workspace;
    });
  };

  createWorkspace = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const { userId } = this.requireUser(c);
      const body = await this.requireBody<CreateWorkspaceBody>(c);

      // Generate a URL-friendly slug from the name
      const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const workspace = await this.workspaceRepo.create({
        name: body.name,
        slug,
        ownerId: userId,
        settings: body.settings || {},
        fileSizeLimit: body.settings?.fileSizeLimit,
        defaultMessageRetentionDays: body.settings?.defaultMessageRetentionDays,
        notificationDefaults: body.settings?.notificationDefaults
      });

      // Add creator as admin
      await this.workspaceRepo.addUser(workspace.id, userId, UserRole.ADMIN);

      return workspace;
    });
  };

  updateWorkspace = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const body = await this.requireBody<UpdateWorkspaceBody>(c);

      // Only admins can update workspace settings
      const userRole = c.get('userRole');
      if (userRole !== UserRole.ADMIN) {
        throw new ApiError('Only admins can update workspace settings', 403);
      }

      const updateData: UpdateWorkspaceDTO = {
        name: body.name,
        settings: body.settings || {},
        fileSizeLimit: body.settings?.fileSizeLimit,
        defaultMessageRetentionDays: body.settings?.defaultMessageRetentionDays,
        notificationDefaults: body.settings?.notificationDefaults
      };

      const workspace = await this.workspaceRepo.update(workspaceId, updateData);
      if (!workspace) {
        throw new ApiError('Workspace not found', 404);
      }

      return workspace;
    });
  };

  inviteUser = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const { userId: inviterId } = this.requireUser(c);
      const body = await this.requireBody<InviteUserBody>(c);

      // Only admins can invite users
      const userRole = c.get('userRole');
      if (userRole !== UserRole.ADMIN) {
        throw new ApiError('Only admins can invite users', 403);
      }

      const invite = await this.workspaceRepo.createInvite({
        workspaceId,
        inviterId,
        email: body.email,
        role: body.role || UserRole.MEMBER
      });

      // TODO: Send invitation email
      return invite;
    });
  };

  updateUser = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const userId = this.requireNumberParam(c, 'userId');
      const body = await this.requireBody<UpdateUserBody>(c);

      // Only admins can update roles
      if (body.role) {
        const userRole = c.get('userRole');
        if (userRole !== UserRole.ADMIN) {
          throw new ApiError('Only admins can update user roles', 403);
        }
      }

      const user = await this.workspaceRepo.updateUser(workspaceId, userId, {
        role: body.role,
        displayName: body.displayName,
        status: body.status,
        statusMessage: body.statusMessage,
        notificationPreferences: body.notificationPreferences ? JSON.stringify(body.notificationPreferences) : undefined
      });
      if (!user) {
        throw new ApiError('User not found', 404);
      }

      return user;
    });
  };

  removeUser = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const userId = this.requireNumberParam(c, 'userId');

      // Only admins can remove users
      const userRole = c.get('userRole');
      if (userRole !== UserRole.ADMIN) {
        throw new ApiError('Only admins can remove users', 403);
      }

      await this.workspaceRepo.removeUser(workspaceId, userId);
      return { success: true };
    });
  };

  getUsers = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      return this.workspaceRepo.getWorkspaceUsers(workspaceId);
    });
  };
} 