import { Hono } from 'hono';
import type { AuthMiddleware } from '../../middleware/auth';
import { FileController } from './controller';

export function setupFileRoutes(app: Hono, auth: AuthMiddleware): void {
  const controller = FileController.create();
  
  // All routes require authentication
  const files = new Hono();
  files.use('/*', auth.jwtAuth);

  // Initialize upload and get presigned URL
  files.post('/workspaces/:workspaceId/files', controller.initializeUpload);
  
  // Attach files to message
  files.post('/files/attach', controller.attachToMessage);
  
  // Get download URL for a file
  files.get('/files/:fileId/download', controller.getDownloadUrl);
  
  // Delete a file
  files.delete('/files/:fileId', controller.deleteFile);

  // Mount all routes
  app.route('/', files);
}