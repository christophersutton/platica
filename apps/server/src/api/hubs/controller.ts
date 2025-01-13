import type { Context } from 'hono';
import { BaseController, ApiError } from '../base-controller';
import { HubRepository } from '../../db/repositories/hub-repository';
import { MessageRepository } from '../../db/repositories/message-repository';
import { WorkspaceRepository } from '../../db/repositories/workspace-repository';
import type { DatabaseProvider } from '../../db/repositories/base';
import { WebSocketService } from '../../services/websockets';
import { HubEventType, WSEventType } from '@websockets';
import type { PresenceEvent, HubCreatedEvent } from '@websockets';

// NEW: We'll also import the HubSchema if we want to parse or validate 
// creation payloads or similar
import { HubSchema } from '@models/schemas';
import { z } from 'zod';

interface CreateHubBody {
  name: string;
  description?: string;
}

const createHubSchema = z.object({
  name: z.string().min(2, "Hub name must be at least 2 chars"),
  description: z.string().optional()
});

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
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const { userId } = this.requireUser(c);

      const workspaceRepo = new WorkspaceRepository(this.hubRepo['db']);
      const memberRole = await workspaceRepo.getMemberRole(workspaceId, userId);
      if (!memberRole) {
        throw new ApiError('Not a member of this workspace', 403);
      }

      const hubs = await this.hubRepo.findByWorkspace(workspaceId, userId);
      return { hubs };
    });
  };

  getHub = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const hubId = this.requireNumberParam(c, 'hubId');
      const { userId } = this.requireUser(c);

      // Check workspace membership
      const workspaceRepo = new WorkspaceRepository(this.hubRepo['db']);
      const memberRole = await workspaceRepo.getMemberRole(workspaceId, userId);
      if (!memberRole) {
        throw new ApiError('Not a member of this workspace', 403);
      }

      // Get the hub and verify it belongs to the workspace
      const hub = await this.hubRepo.findById(hubId);
      if (!hub) {
        throw new ApiError('Hub not found', 404);
      }
      if (hub.workspaceId !== workspaceId) {
        throw new ApiError('Hub not found in this workspace', 404);
      }

      // Get hub membership status (but don't require it)
      const hubMemberRole = await this.hubRepo.getMemberRole(hubId, userId);

      return { 
        hub,
        memberStatus: hubMemberRole ? 'member' : null 
      };
    });
  };

  getHubMessages = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const hubId = this.requireNumberParam(c, 'hubId');
      const { userId } = this.requireUser(c);

      // Check workspace membership
      const workspaceRepo = new WorkspaceRepository(this.hubRepo['db']);
      const memberRole = await workspaceRepo.getMemberRole(workspaceId, userId);
      if (!memberRole) {
        throw new ApiError('Not a member of this workspace', 403);
      }

      // Get the hub and verify it belongs to the workspace
      const hub = await this.hubRepo.findById(hubId);
      if (!hub) {
        throw new ApiError('Hub not found', 404);
      }
      if (hub.workspaceId !== workspaceId) {
        throw new ApiError('Hub not found in this workspace', 404);
      }

      const messages = await this.messageRepo.findByHub(hubId, 50);
      
      // Only update last read if they're a hub member
      const hubMemberRole = await this.hubRepo.getMemberRole(hubId, userId);
      if (hubMemberRole) {
        await this.hubRepo.updateMember(hubId, userId, {
          lastReadAt: Math.floor(Date.now() / 1000)
        });
      }

      return { messages };
    });
  };

  createHub = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const { userId } = this.requireUser(c);

      const body = await c.req.json<CreateHubBody>();
      // parse with zod
      const parsed = createHubSchema.parse(body);

      const hub = await this.hubRepo.create({
        workspaceId,
        name: parsed.name,
        description: parsed.description,
        isArchived: false,
        settings: {}
      });

      await this.hubRepo.addMember(hub.id, userId, 'admin');

      this.wsService.broadcastToWorkspace(workspaceId, {
        type: WSEventType.HUB,
        payload: {
          hub,
          hubEventType: HubEventType.HUB_CREATED
        }
      } as HubCreatedEvent);

      return { hub };
    });
  };

  addMember = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const hubId = this.requireNumberParam(c, 'hubId');
      const { userId: currentUserId } = this.requireUser(c);

      const body = await c.req.json<AddMemberBody>();
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
      const memberRole = await this.hubRepo.getMemberRole(hubId, userId);
      if (!memberRole) {
        throw new ApiError('Not a member of this hub', 403);
      }
      return this.hubRepo.findMembers(hubId);
    });
  };

  markAsRead = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const hubId = this.requireNumberParam(c, 'hubId');
      const { userId } = this.requireUser(c);
      await this.hubRepo.updateMember(hubId, userId, {
        lastReadAt: Math.floor(Date.now() / 1000)
      });
      return { success: true };
    });
  };
}