import type { Context } from 'hono';
import { BaseController, ApiError } from '../base-controller';
import type { DatabaseProvider } from '../../db/repositories/base';
import { WorkspaceRepository } from '../../db/repositories/workspace-repository';
import { UserRole, type NotificationPreferences } from '@platica/shared/types';
import type { Workspace } from '@platica/shared';

type WorkspaceCreateDTO = Omit<Workspace, 'id' | 'created_at' | 'updated_at'>;

interface CreateWorkspaceBody {
  name: string;
  icon_url?: string | null;
  settings?: {
    file_size_limit?: number;
    default_message_retention_days?: number;
    notification_defaults?: NotificationPreferences;
  };
}

interface UpdateWorkspaceBody extends Partial<CreateWorkspaceBody> {}

interface InviteUserBody {
  email: string;
  role?: UserRole;
}

interface UpdateUserBody {
  role?: UserRole;
  display_name?: string;
  status?: string;
  status_message?: string;
  notification_preferences?: string;
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
        owner_id: userId,
        icon_url: body.icon_url || null,
        settings: body.settings || {}
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

      // If name is being updated, generate a new slug
      const updateData: Partial<WorkspaceCreateDTO> = {
        ...body,
        slug: body.name ? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined
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
        workspace_id: workspaceId,
        inviter_id: inviterId,
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

      const user = await this.workspaceRepo.updateUser(workspaceId, userId, body);
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