# Implement S3 FileService

## Request
Implement a FileService using Bun.S3 to handle AWS S3 uploads and downloads for file attachments in messages, with support for inline image display and downloadable files. Must support multiple concurrent file uploads per message.

## Status
- [x] In Assessment
- [x] In Development
- [x] Ready for Review
- [ ] Complete
- [ ] Archived

## Initial Assessment Checklist
- [x] Review relevant documentation
- [x] Identify affected system components
- [x] Check if data model changes needed
- [x] Look for existing patterns in architecture.md
- [x] Break into discrete tasks
- [x] Flag any architecture questions
- [x] Request approval if needed

## Tasks

### Task 1: Core FileService Implementation
#### Implementation Checklist
- [x] Set up S3 client configuration with Bun.S3
- [x] Implement file metadata creation method
- [x] Implement presigned URL generation for uploads
- [x] Implement presigned URL generation for downloads
- [x] Implement file deletion method
- [x] Add error handling and validation
- [x] Add file type and size validation
- [x] Add cleanup logic for abandoned uploads

### Task 2: Integration with Message System
#### Implementation Checklist
- [x] Create endpoint for initiating file upload
- [x] Modify message creation to handle multiple file attachments
- [x] Update message broadcast to include presigned URLs
- [x] Add file type detection for inline vs download display
- [x] Implement file cleanup for unsent messages
- [x] Add proper error handling for failed uploads
- [x] Add batch processing for multiple files
- [x] Handle partial upload failures

### Task 3: Frontend Implementation
#### Implementation Checklist
- [ ] Implement file selection and upload UI
- [ ] Add file upload progress tracking
- [ ] Implement inline image display
- [ ] Add download buttons with appropriate icons
- [ ] Handle upload cancellation
- [ ] Add error handling and user feedback
- [ ] Support multiple concurrent uploads
- [ ] Show aggregate upload progress

### Task 4: Testing and Documentation
#### Implementation Checklist
- [x] Add unit tests with mocked S3
- [x] Add integration tests
- [x] Update architecture.md
- [x] Add API documentation
- [x] Document usage patterns
- [x] Create test cases for error scenarios
- [x] Test concurrent upload scenarios

## Questions/Notes
- Support for concurrent uploads per message is required
- Multiple files can be attached to a single message
- Need to handle aggregate progress for multiple uploads

## Technical Design

### Implemented FileService Pattern
```typescript
export class FileService extends BaseController {
  private readonly s3: Bun.S3;
  private readonly db: Database;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET;
    this.s3 = new Bun.S3({
      bucket: this.bucket,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    });
    this.db = DatabaseService.getWriteInstance().db;
  }

  async createFileRecord({
    workspaceId,
    uploaderId,
    name,
    size,
    mimeType
  }: FileCreateParams): Promise<FileRecord> {
    const s3Key = `${workspaceId}/${crypto.randomUUID()}/${name}`;
    // Insert into files table and return record
  }

  async generateUploadUrl(fileId: string): Promise<string> {
    const file = await this.getFileRecord(fileId);
    return this.s3(file.s3Key).presign({
      method: "PUT",
      expiresIn: 3600 // 1 hour
    });
  }

  async generateDownloadUrl(fileId: string): Promise<string> {
    const file = await this.getFileRecord(fileId);
    return this.s3(file.s3Key).presign({
      method: "GET",
      expiresIn: 3600 // 1 hour  
    });
  }

  async attachToMessage(fileIds: string[], messageId: string): Promise<void> {
    // Batch update message_id in files table
  }

  async deleteFile(fileId: string): Promise<void> {
    // Soft delete in DB and remove from S3
  }

  async cleanupOrphanedFiles(): Promise<void> {
    // Delete files with no message_id after X time
  }
}
```

### Implemented API Endpoints
```typescript
// Initialize upload
POST /workspaces/:workspaceId/files
Body: { name: string, size: number, mimeType: string }
Response: { fileId: number, uploadUrl: string }

// Attach to message
POST /files/attach
Body: { fileIds: number[], messageId: number }
Response: { success: true }

// Get download URL
GET /files/:fileId/download
Response: { url: string }

// Delete file
DELETE /files/:fileId
Response: { success: true }
```

### Message Attachment Flow
1. User selects file(s)
2. Frontend calls POST /api/files for each file
3. Frontend uploads to S3 using presigned URLs (concurrent uploads)
4. On message send, attach all files to message
5. Message broadcast includes presigned download URLs
6. Frontend displays based on mime type

## Decisions
- Decision 1: [2024-01-08] Use Bun.S3 for S3 operations
- Decision 2: [2024-01-08] Store file metadata in SQLite for efficient querying
- Decision 3: [2024-01-08] Use presigned URLs for secure file access
- Decision 4: [2024-01-10] Generate unique S3 keys using workspace_id/uuid/filename pattern
- Decision 5: [2024-01-10] Implement soft deletes for file records
- Decision 6: [2024-01-10] Auto-cleanup orphaned files after 24 hours
- Decision 7: [2024-01-10] Inline display for images, download buttons for other types
- Decision 8: [2024-01-10] Support multiple concurrent uploads per message
- Decision 9: [2024-01-10] Batch file-to-message attachment operations

## Frontend Display Rules
- Images (image/*): Display inline with max-width/height constraints
- PDFs (application/pdf): Show download button with PDF icon
- Office (application/msword, etc): Show download button with document icon
- Other: Show download button with generic file icon