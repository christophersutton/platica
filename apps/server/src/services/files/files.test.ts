import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { FileService } from '../services/file-service';
import { ApiError } from '../errors/api-error';
import { Database } from 'bun:sqlite';

describe('FileService', () => {
  let fileService: FileService;
  let mockS3: {
    file: (key: string) => {
      presign: (options: any) => Promise<string>;
      delete: () => Promise<void>;
    };
  };
  let db: Database;

  beforeEach(() => {
    // Mock S3 client
    mockS3 = {
      file: (key: string) => ({
        presign: mock(async () => 'https://presigned-url.com'),
        delete: mock(async () => {})
      })
    };

    // Create test database
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        uploader_id INTEGER NOT NULL,
        message_id INTEGER,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        s3_key TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );
    `);

    // Mock process.env
    process.env.S3_BUCKET = 'test-bucket';
    process.env.S3_REGION = 'test-region';
    process.env.S3_ACCESS_KEY_ID = 'test-key';
    process.env.S3_SECRET_ACCESS_KEY = 'test-secret';

    // Initialize service with mocks
    fileService = FileService.getInstance();
    (fileService as any).s3 = mockS3;
    (fileService as any).db = db;
  });

  afterEach(() => {
    db.close();
  });

  describe('createFileRecord', () => {
    test('creates file record with valid input', async () => {
      const input = {
        workspaceId: 1,
        uploaderId: 1,
        name: 'test.txt',
        size: 1000,
        mimeType: 'text/plain'
      };

      const result = await fileService.createFileRecord(input);

      expect(result.workspace_id).toBe(input.workspaceId);
      expect(result.uploader_id).toBe(input.uploaderId);
      expect(result.name).toBe(input.name);
      expect(result.size).toBe(input.size);
      expect(result.mime_type).toBe(input.mimeType);
      expect(result.s3_key).toContain(`${input.workspaceId}/`);
      expect(result.s3_key).toContain(input.name);
    });

    test('rejects files exceeding size limit', async () => {
      const input = {
        workspaceId: 1,
        uploaderId: 1,
        name: 'large.file',
        size: 200 * 1024 * 1024, // 200MB
        mimeType: 'application/octet-stream'
      };

      await expect(fileService.createFileRecord(input))
        .rejects
        .toThrow('File size exceeds maximum allowed size');
    });

    test('requires name and mime type', async () => {
      const input = {
        workspaceId: 1,
        uploaderId: 1,
        name: '',
        size: 1000,
        mimeType: ''
      };

      await expect(fileService.createFileRecord(input))
        .rejects
        .toThrow('File name and mime type are required');
    });
  });

  describe('generateUploadUrl', () => {
    test('generates upload URL for valid file', async () => {
      // Create test file record
      const file = await fileService.createFileRecord({
        workspaceId: 1,
        uploaderId: 1,
        name: 'test.txt',
        size: 1000,
        mimeType: 'text/plain'
      });

      const url = await fileService.generateUploadUrl(file.id);
      expect(url).toBe('https://presigned-url.com');
      expect(mockS3.file(file.s3_key).presign).toHaveBeenCalledWith({
        method: 'PUT',
        expiresIn: 3600
      });
    });

    test('throws error for non-existent file', async () => {
      await expect(fileService.generateUploadUrl(999))
        .rejects
        .toThrow('File not found');
    });
  });

  describe('generateDownloadUrl', () => {
    test('generates download URL for valid file', async () => {
      // Create test file record
      const file = await fileService.createFileRecord({
        workspaceId: 1,
        uploaderId: 1,
        name: 'test.txt',
        size: 1000,
        mimeType: 'text/plain'
      });

      const url = await fileService.generateDownloadUrl(file.id);
      expect(url).toBe('https://presigned-url.com');
      expect(mockS3.file(file.s3_key).presign).toHaveBeenCalledWith({
        method: 'GET',
        expiresIn: 3600
      });
    });

    test('throws error for non-existent file', async () => {
      await expect(fileService.generateDownloadUrl(999))
        .rejects
        .toThrow('File not found');
    });
  });

  describe('attachToMessage', () => {
    test('attaches files to message', async () => {
      // Create test files
      const file1 = await fileService.createFileRecord({
        workspaceId: 1,
        uploaderId: 1,
        name: 'test1.txt',
        size: 1000,
        mimeType: 'text/plain'
      });

      const file2 = await fileService.createFileRecord({
        workspaceId: 1,
        uploaderId: 1,
        name: 'test2.txt',
        size: 1000,
        mimeType: 'text/plain'
      });

      await fileService.attachToMessage([file1.id, file2.id], 123);

      // Verify files are attached
      const files = db.prepare(`
        SELECT * FROM files 
        WHERE message_id = 123
      `).all();

      expect(files.length).toBe(2);
      expect(files[0].id).toBe(file1.id);
      expect(files[1].id).toBe(file2.id);
    });
  });

  describe('deleteFile', () => {
    test('soft deletes file and removes from S3', async () => {
      // Create test file
      const file = await fileService.createFileRecord({
        workspaceId: 1,
        uploaderId: 1,
        name: 'test.txt',
        size: 1000,
        mimeType: 'text/plain'
      });

      await fileService.deleteFile(file.id);

      // Verify soft delete
      const dbFile = db.prepare(`
        SELECT * FROM files WHERE id = ?
      `).get(file.id);

      expect(dbFile.deleted_at).toBeTruthy();
      expect(mockS3.file(file.s3_key).delete).toHaveBeenCalled();
    });

    test('throws error for non-existent file', async () => {
      await expect(fileService.deleteFile(999))
        .rejects
        .toThrow('File not found');
    });
  });

  describe('cleanupOrphanedFiles', () => {
    test('removes files not attached to messages after 24h', async () => {
      // Create test file with old timestamp
      const twentyFiveHoursAgo = Math.floor(Date.now() / 1000) - 25 * 60 * 60;
      
      const file = await fileService.createFileRecord({
        workspaceId: 1,
        uploaderId: 1,
        name: 'orphaned.txt',
        size: 1000,
        mimeType: 'text/plain'
      });

      // Manually update created_at
      db.prepare(`
        UPDATE files 
        SET created_at = ? 
        WHERE id = ?
      `).run(twentyFiveHoursAgo, file.id);

      await fileService.cleanupOrphanedFiles();

      // Verify file was deleted
      const dbFile = db.prepare(`
        SELECT * FROM files WHERE id = ?
      `).get(file.id);

      expect(dbFile.deleted_at).toBeTruthy();
      expect(mockS3.file(file.s3_key).delete).toHaveBeenCalled();
    });

    test('keeps recent files and attached files', async () => {
      // Create recent unattached file
      const recentFile = await fileService.createFileRecord({
        workspaceId: 1,
        uploaderId: 1,
        name: 'recent.txt',
        size: 1000,
        mimeType: 'text/plain'
      });

      // Create old but attached file
      const oldAttachedFile = await fileService.createFileRecord({
        workspaceId: 1,
        uploaderId: 1,
        name: 'attached.txt',
        size: 1000,
        mimeType: 'text/plain'
      });

      const twentyFiveHoursAgo = Math.floor(Date.now() / 1000) - 25 * 60 * 60;
      db.prepare(`
        UPDATE files 
        SET created_at = ?,
            message_id = 123
        WHERE id = ?
      `).run(twentyFiveHoursAgo, oldAttachedFile.id);

      await fileService.cleanupOrphanedFiles();

      // Verify both files still exist
      const files = db.prepare(`
        SELECT * FROM files 
        WHERE deleted_at IS NULL
      `).all();

      expect(files.length).toBe(2);
    });
  });
});