// import { Hono } from 'hono';
// import { s3, s3Client } from 'bun';
// import { Database } from 'bun:sqlite';
// import { lookup } from 'mime-types';
// import sharp from 'sharp';

// const router = new Hono();
// const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// const THUMBNAIL_SIZE = 400;

// interface FileTypeInfo {
//   icon: string;
//   color: string;
// }

// const FILE_TYPES: Record<string, FileTypeInfo> = {
//   'image': { icon: 'image', color: 'blue' },
//   'video': { icon: 'video', color: 'red' },
//   'audio': { icon: 'music', color: 'purple' },
//   'application/pdf': { icon: 'file-pdf', color: 'red' },
//   'application/msword': { icon: 'file-word', color: 'blue' },
//   'application/vnd.ms-excel': { icon: 'file-excel', color: 'green' },
//   'text/plain': { icon: 'file-text', color: 'gray' },
//   'application/zip': { icon: 'file-archive', color: 'brown' }
// };

// export function setupFileRoutes(db: Database, s3: s3) {
//   // Get file type info
//   function getFileTypeInfo(mimeType: string): FileTypeInfo {
//     const generalType = mimeType.split('/')[0];
//     return FILE_TYPES[mimeType] || FILE_TYPES[generalType] || { icon: 'file', color: 'gray' };
//   }

//   // Generate thumbnail key
//   function getThumbnailKey(key: string): string {
//     return `thumbnails/${key}`;
//   }

//   // Generate thumbnail for images
//   async function generateThumbnail(buffer: ArrayBuffer): Promise<Uint8Array> {
//     return sharp(buffer)
//       .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
//         fit: 'inside',
//         withoutEnlargement: true
//       })
//       .webp({ quality: 80 })
//       .toBuffer();
//   }

//   // Profile image routes
//   router.post('/profile/image', async (c) => {
//     const userId = c.get('user').userId;
//     const { fileType, fileSize } = await c.req.json();

//     if (!ALLOWED_IMAGE_TYPES.includes(fileType)) {
//       return c.json({ error: 'Invalid image type' }, 400);
//     }

//     const key = `profiles/${userId}/${Date.now()}`;
//     const s3File = s3(key);
    
//     const uploadUrl = s3File.presign({
//       method: 'PUT',
//       expiresIn: 3600,
//       contentType: fileType
//     });

//     return c.json({ uploadUrl, key });
//   });

//   router.post('/profile/image/complete', async (c) => {
//     const userId = c.get('user').userId;
//     const { key } = await c.req.json();

//     // Get the uploaded image and generate thumbnail
//     const s3File = s3(key);
//     const imageBuffer = await s3File.arrayBuffer();
//     const thumbnail = await generateThumbnail(imageBuffer);
    
//     // Upload thumbnail
//     const thumbnailKey = getThumbnailKey(key);
//     await s3(thumbnailKey).write(thumbnail, { type: 'image/webp' });

//     // Update user profile
//     db.prepare(`
//       UPDATE users 
//       SET avatar_url = ?, updated_at = unixepoch() 
//       WHERE id = ?
//     `).run(key, userId);

//     return c.json({ success: true });
//   });

//   // General file routes
//   router.post('/files/upload-url', async (c) => {
//     const { workspaceId, fileName, fileType, fileSize } = await c.req.json();
//     const userId = c.get('user').userId;

//     const workspace = db.prepare(
//       'SELECT file_size_limit FROM workspaces WHERE id = ?'
//     ).get(workspaceId);

//     if (workspace.file_size_limit && fileSize > workspace.file_size_limit) {
//       return c.json({ error: 'File size exceeds workspace limit' }, 400);
//     }

//     const key = `workspaces/${workspaceId}/${Date.now()}-${fileName}`;
//     const s3File = s3(key);
    
//     const uploadUrl = s3File.presign({
//       method: 'PUT',
//       expiresIn: 3600,
//       contentType: fileType
//     });

//     const result = db.prepare(`
//       INSERT INTO files (workspace_id, uploader_id, name, size, mime_type, s3_key, created_at)
//       VALUES (?, ?, ?, ?, ?, ?, unixepoch())
//     `).run(workspaceId, userId, fileName, fileSize, fileType, key);

//     return c.json({
//       uploadUrl,
//       fileId: result.lastInsertId,
//       key
//     });
//   });

//   router.post('/files/complete', async (c) => {
//     const { fileId, key } = await c.req.json();
//     const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);

//     if (!file) {
//       return c.json({ error: 'File not found' }, 404);
//     }

//     // Generate thumbnail for images
//     if (file.mime_type.startsWith('image/')) {
//       const s3File = s3(key);
//       const imageBuffer = await s3File.arrayBuffer();
//       const thumbnail = await generateThumbnail(imageBuffer);
      
//       const thumbnailKey = getThumbnailKey(key);
//       await s3(thumbnailKey).write(thumbnail, { type: 'image/webp' });

//       db.prepare(`
//         UPDATE files 
//         SET thumbnail_key = ? 
//         WHERE id = ?
//       `).run(thumbnailKey, fileId);
//     }

//     return c.json({ success: true });
//   });

//   router.get('/files/:fileId', async (c) => {
//     const fileId = Number(c.params.fileId);
//     const userId = c.get('user').userId;

//     const file = db.prepare(`
//       SELECT f.*, w.name as workspace_name, u.name as uploader_name
//       FROM files f
//       JOIN workspaces w ON f.workspace_id = w.id
//       JOIN users u ON f.uploader_id = u.id
//       WHERE f.id = ?
//     `).get(fileId);

//     if (!file) {
//       return c.json({ error: 'File not found' }, 404);
//     }

//     const hasAccess = db.prepare(`
//       SELECT 1 FROM workspace_users
//       WHERE workspace_id = ? AND user_id = ?
//     `).get(file.workspace_id, userId);

//     if (!hasAccess) {
//       return c.json({ error: 'Unauthorized' }, 403);
//     }

//     const s3File = s3(file.s3_key);
//     const downloadUrl = s3File.presign({
//       method: 'GET',
//       expiresIn: 3600
//     });

//     let thumbnailUrl = null;
//     if (file.thumbnail_key) {
//       thumbnailUrl = s3(file.thumbnail_key).presign({
//         method: 'GET',
//         expiresIn: 3600
//       });
//     }

//     const typeInfo = getFileTypeInfo(file.mime_type);

//     return c.json({
//       id: file.id,
//       name: file.name,
//       size: file.size,
//       mimeType: file.mime_type,
//       uploadedBy: file.uploader_name,
//       workspace: file.workspace_name,
//       createdAt: file.created_at,
//       downloadUrl,
//       thumbnailUrl,
//       icon: typeInfo.icon,
//       color: typeInfo.color
//     });
//   });

//   router.delete('/files/:fileId', async (c) => {
//     const fileId = Number(c.params.fileId);
//     const userId = c.get('user').userId;

//     const file = db.prepare(`
//       SELECT f.*, wu.role
//       FROM files f
//       JOIN workspace_users wu ON f.workspace_id = wu.workspace_id
//       WHERE f.id = ? AND wu.user_id = ?
//     `).get(fileId, userId);

//     if (!file) {
//       return c.json({ error: 'File not found or unauthorized' }, 404);
//     }

//     if (file.uploader_id !== userId && file.role !== 'admin') {
//       return c.json({ error: 'Unauthorized' }, 403);
//     }

//     // Delete file and thumbnail from S3
//     await s3(file.s3_key).unlink();
//     if (file.thumbnail_key) {
//       await s3(file.thumbnail_key).unlink();
//     }

//     db.prepare('DELETE FROM files WHERE id = ?').run(fileId);

//     return c.json({ success: true });
//   });

//   return router;
// }