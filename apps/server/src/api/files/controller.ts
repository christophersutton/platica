import type { Context } from 'hono';
import { BaseController, ApiError } from '../base-controller';
import type { Database } from 'bun:sqlite';
import { FileService } from '../../services/files/files';

interface InitUploadRequest {
  name: string;
  size: number;
  mimeType: string;
}

interface AttachToMessageRequest {
  fileIds: number[];
  messageId: number;
}

export class FileController extends BaseController {
  private readonly fileService: FileService;

  constructor() {
    super();
    this.fileService = FileService.getInstance();
  }

  static create(): FileController {
    return new FileController();
  }

  initializeUpload = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const { userId } = this.requireUser(c);
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const body = await this.requireBody<InitUploadRequest>(c);

      const file = await this.fileService.createFileRecord({
        workspaceId,
        uploaderId: userId,
        name: body.name,
        size: body.size,
        mimeType: body.mimeType
      });

      const uploadUrl = await this.fileService.generateUploadUrl(file.id);

      return {
        fileId: file.id,
        uploadUrl
      };
    });
  };

  attachToMessage = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const body = await this.requireBody<AttachToMessageRequest>(c);
      await this.fileService.attachToMessage(body.fileIds, body.messageId);
      return { success: true };
    });
  };

  getDownloadUrl = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const fileId = this.requireNumberParam(c, 'fileId');
      const url = await this.fileService.generateDownloadUrl(fileId);
      return { url };
    });
  };

  deleteFile = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const fileId = this.requireNumberParam(c, 'fileId');
      await this.fileService.deleteFile(fileId);
      return { success: true };
    });
  };
}