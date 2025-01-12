import type { Context } from 'hono';
import { BaseController, ApiError } from '../base-controller';
import { HubRepository } from '../../db/repositories/hub-repository';
import { MessageRepository } from '../../db/repositories/message-repository';
import { WorkspaceRepository } from '../../db/repositories/workspace-repository';
import type { DatabaseProvider } from '../../db/repositories/base';
import type { Hub, CreateHubDTO } from '@models/hub';
import type { Variables } from '../../middleware/auth';
import { WebSocketService } from '../../services/websockets';
import { WSEventType } from '@websockets';
import type { PresenceEvent, HubCreatedEvent } from '@websockets';

interface CreateHubBody {
  name: string;
  description?: string;
}

interface AddMemberBody {
  user_id: number;
}

export class HubController extends BaseController {
  constructor(
    private readonly hubRepo: HubRepository,
    private readonly messageRepo: MessageRepository,
    private readonly wsService: WebSocketService
  ) {
    super();
  }

  static create(dbProvider: DatabaseProvider): HubController {
    return new HubController(
      new HubRepository(dbProvider.db),
      new MessageRepository(dbProvider.db),
      WebSocketService.getInstance()
    );
  }

  getWorkspaceHubs = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      try {
        const workspaceId = this.requireNumberParam(c, 'workspaceId');
        console.log('Workspace ID:', workspaceId);

        const { userId } = this.requireUser(c);
        console.log('User ID:', userId);

        const userRole = c.get('userRole') || 'member';
        console.log('User Role:', userRole);

        // Check workspace membership using workspace repository
        const workspaceRepo = new WorkspaceRepository(this.hubRepo['db']);
        const memberRole = await workspaceRepo.getMemberRole(workspaceId, userId);
        console.log('Workspace Member Role:', memberRole);

        if (!memberRole) {
          throw new ApiError('Not a member of this workspace', 403);
        }

        const hubs = await this.hubRepo.findByWorkspace(workspaceId, userId);
        console.log('Found Hubs:', hubs?.length || 0);
        return { hubs };
      } catch (error) {
        console.error('Error in getWorkspaceHubs:', error);
        throw error;
      }
    });
  };

  private async ensureHubAccess(hubId: number, userId: number): Promise<string> {
    
    const hub
 = await this.hubRepo.findById(hubId);
    if (!hub
) {
      throw new ApiError('Hub not found', 404);
    }

    // Then check if user is already a member
    const memberRole = await this.hubRepo.getMemberRole(hubId, userId);
    if (memberRole) {
      return memberRole;
    }

    throw new ApiError('Not a member of this hub', 403);
  }

  getHubMessages = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      try {
        const hubId = this.requireNumberParam(c, 'hubId');
        const { userId } = this.requireUser(c);
        const before = c.req.query('before');
        const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

        // Check if user is a member
        const memberRole = await this.hubRepo.getMemberRole(hubId, userId);
        if (!memberRole) {
          throw new ApiError('Not a member of this hub', 403);
        }

        // Get messages
        const messages = await this.messageRepo.findByHub(
          hubId,
          // limit,
          // before ? Number(before) : undefined
        );

        // Update last read timestamp
        await this.hubRepo.updateMember(hubId, userId, {
          lastReadAt: Math.floor(Date.now() / 1000)
        });
        
        return { messages };
      } catch (error) {
        console.error('Error in getHubMessages:', error);
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError('Failed to fetch hubmessages', 500);
      }
    });
  };

  createHub = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const { userId } = this.requireUser(c);
      const body = await c.req.json<CreateHubBody>();
      const hub = await this.hubRepo.create({
        workspaceId,
        name: body.name,
        description: body.description || undefined,
        isArchived: false,
        createdBy: userId,
        settings: {}
      });

      // Add creator as admin
      await this.hubRepo.addMember(hub.id, userId, 'admin');

      // Broadcast new hub to all workspace members
      this.wsService.broadcastToWorkspace(hub
.workspaceId, {
        type: WSEventType.CHANNEL_CREATED,
        payload: {
          hub

        }
      } as HubCreatedEvent);

      return { hub
 };
    });
  };

  addMember = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const hubId = this.requireNumberParam(c, 'hubId');
      const { userId: currentUserId } = this.requireUser(c);
      const body = await this.requireBody<AddMemberBody>(c);

      // Check if current user has access
      const memberRole = await this.hubRepo.getMemberRole(hubId, currentUserId);
      if (!memberRole) {
        throw new ApiError('Not a member of this hub', 403);
      }

      await this.hubRepo.addMember(hubId, body.user_id);
      return { success: true };
    });
  };

  removeMember = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const hubId = this.requireNumberParam(c, 'hubId');
      const userId = this.requireNumberParam(c, 'userId');
      const { userId: currentUserId } = this.requireUser(c);

      // Check if current user has access
      const memberRole = await this.hubRepo.getMemberRole(hubId, currentUserId);
      if (!memberRole) {
        throw new ApiError('Not a member of this hub', 403);
      }

      await this.hubRepo.removeMember(hubId, userId);
      return { success: true };
    });
  };

  getMembers = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const hubId = this.requireNumberParam(c, 'hubId');
      const { userId } = this.requireUser(c);

      // Check access
      const memberRole = await this.hubRepo.getMemberRole(hubId, userId);
      if (!memberRole) {
        throw new ApiError('Not a member of this hub', 403);
      }

      return this.hubRepo.findMembers(hubId);
    });
  };

  async getMessages(c: Context<{ Variables: Variables }>) {
    const hubId = Number(c.req.param('hubId'));
    const userId = c.get('user').userId;
    const before = c.req.query('before');
    const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

    try {
      const messages = await this.messageRepo.findByHub(hubId/*, limit, before ? Number(before) : undefined*/);
      // Mark hub as read
      await this.hubRepo.updateMember(hubId, userId, {
        lastReadAt: Math.floor(Date.now() / 1000)
      });
      return c.json({ messages });
    } catch (error) {
      console.error('Error getting hub messages:', error);
      return c.json({ error: 'Failed to get hub messages' }, 500);
    }
  }

  markAsRead = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const hubId = this.requireNumberParam(c, 'hubId');
      const { userId } = this.requireUser(c);

      // Update the lastReadAt timestamp
      await this.hubRepo.updateMember(hubId, userId, {
        lastReadAt: Math.floor(Date.now() / 1000)
      });

      return { success: true };
    });
  };
} 