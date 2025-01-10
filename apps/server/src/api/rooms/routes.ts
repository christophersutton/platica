import { Hono } from 'hono';
import type { DatabaseProvider } from '../../db/repositories/base';
import { RoomController } from './controller';
import type { AuthMiddleware } from '../../middleware/auth';

export function setupRoomRoutes(app: Hono, db: DatabaseProvider, auth: AuthMiddleware): void {
  const controller = RoomController.create(db);

  // Room-specific routes
  const rooms = new Hono();
  rooms.use('/*', auth.jwtAuth);
  rooms.use('/:roomId/*', auth.roomAuth);

  // Get room details with members
  rooms.get('/:roomId', controller.getRoomDetails);

  // Update room settings
  rooms.patch('/:roomId', controller.updateRoom);

  // Join room
  rooms.post('/:roomId/join', controller.joinRoom);

  // Leave room
  rooms.post('/:roomId/leave', controller.leaveRoom);

  // Update member state (audio/video/etc)
  rooms.patch('/:roomId/state', controller.updateMemberState);

  // Mount room routes
  app.route('/rooms', rooms);

  // Workspace-specific room routes
  const workspaceRooms = new Hono();
  workspaceRooms.use('/*', auth.jwtAuth);
  workspaceRooms.use('/*', auth.workspaceAuth);

  // List workspace rooms
  workspaceRooms.get('/', controller.getWorkspaceRooms);
  
  // Create room in workspace
  workspaceRooms.post('/', controller.createRoom);

  // Mount workspace room routes
  app.route('/workspaces/:workspaceId/rooms', workspaceRooms);
}