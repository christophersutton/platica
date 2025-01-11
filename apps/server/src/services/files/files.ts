import { S3Client } from "bun";
import { Database } from "bun:sqlite";
import { ApiError } from "../../api/base-controller";
import { DatabaseService } from "../../db/core/database";
import crypto from "crypto";

interface FileCreateParams {
  workspaceId: number;
  uploaderId: number;
  name: string;
  size: number;
  mimeType: string;
}

interface FileRecord {
  id: number;
  workspace_id: number;
  uploader_id: number;
  message_id: number | null;
  name: string;
  size: number;
  mime_type: string;
  s3_key: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export class FileService {
  private static instance: FileService;
  private readonly s3: S3Client;
  private readonly db: Database;
  private readonly bucket: string;

  private constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET environment variable not set");

    this.bucket = bucket;
    this.s3 = new S3Client({
      bucket,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    });
    this.db = DatabaseService.getWriteInstance().db;
  }

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  async createFileRecord({
    workspaceId,
    uploaderId,
    name,
    size,
    mimeType,
  }: FileCreateParams): Promise<FileRecord> {
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (size > maxSize) {
      throw new ApiError("File size exceeds maximum allowed size", 400);
    }

    if (!name || !mimeType) {
      throw new ApiError("File name and mime type are required", 400);
    }

    const s3Key = `${workspaceId}/${crypto.randomUUID()}/${name}`;
    const now = Math.floor(Date.now() / 1000);

    const result = this.db
      .prepare(
        `
      INSERT INTO files (
        workspace_id,
        uploader_id,
        name,
        size,
        mime_type,
        s3_key,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `
      )
      .get(
        workspaceId,
        uploaderId,
        name,
        size,
        mimeType,
        s3Key,
        now,
        now
      ) as FileRecord;

    return result;
  }

  async generateUploadUrl(fileId: number): Promise<string> {
    const file = await this.getFileRecord(fileId);
    if (!file) {
      throw new ApiError("File not found", 404);
    }

    try {
      const s3File = this.s3.file(file.s3_key);
      return s3File.presign({
        method: "PUT",
        expiresIn: 3600,
      });
    } catch (error) {
      throw new ApiError("Failed to generate upload URL", 500);
    }
  }

  async generateDownloadUrl(fileId: number): Promise<string> {
    const file = await this.getFileRecord(fileId);
    if (!file) {
      throw new ApiError("File not found", 404);
    }

    try {
      const s3File = this.s3.file(file.s3_key);
      return s3File.presign({
        method: "GET",
        expiresIn: 3600,
      });
    } catch (error) {
      throw new ApiError("Failed to generate download URL", 500);
    }
  }

  async attachToMessage(fileIds: number[], messageId: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    this.db
      .prepare(
        `
      UPDATE files
      SET message_id = ?,
          updated_at = ?
      WHERE id IN (${fileIds.join(",")})
      AND message_id IS NULL
      AND deleted_at IS NULL
    `
      )
      .run(messageId, now);
  }

  async deleteFile(fileId: number): Promise<void> {
    const file = await this.getFileRecord(fileId);
    if (!file) {
      throw new ApiError("File not found", 404);
    }

    const now = Math.floor(Date.now() / 1000);

    // Soft delete in database
    this.db
      .prepare(
        `
      UPDATE files
      SET deleted_at = ?,
          updated_at = ?
      WHERE id = ?
    `
      )
      .run(now, now, fileId);

    try {
      // Delete from S3
      const s3File = this.s3.file(file.s3_key);
      await s3File.delete();
    } catch (error) {
      console.error("Failed to delete file from S3:", error);
      // Continue with soft delete even if S3 delete fails
    }
  }

  async cleanupOrphanedFiles(): Promise<void> {
    const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    const orphanedFiles = this.db
      .prepare(
        `
      SELECT id, s3_key
      FROM files
      WHERE message_id IS NULL
      AND created_at < ?
      AND deleted_at IS NULL
    `
      )
      .all(twentyFourHoursAgo) as FileRecord[];

    for (const file of orphanedFiles) {
      await this.deleteFile(file.id);
    }
  }

  private async getFileRecord(fileId: number): Promise<FileRecord | undefined> {
    return this.db
      .prepare(
        `
      SELECT * FROM files
      WHERE id = ?
      AND deleted_at IS NULL
    `
      )
      .get(fileId) as FileRecord | undefined;
  }
}
