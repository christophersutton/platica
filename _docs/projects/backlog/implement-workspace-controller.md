# Implement WorkspaceController

## Request
Create a WorkspaceController to handle workspace management functionality, migrating relevant code from ManagementService and following the controller pattern.

## Status
- [x] In Assessment
- [ ] In Development
- [ ] Ready for Review
- [ ] Complete
- [ ] Archived

## Initial Assessment Checklist
- [x] Review relevant documentation
- [x] Identify affected system components
- [ ] Check if data model changes needed
- [x] Look for existing patterns in architecture.md
- [x] Break into discrete tasks
- [x] Flag any architecture questions
- [ ] Request approval if needed

## Tasks

### Task 1: Core Controller Implementation
#### Implementation Checklist
- [ ] Create WorkspaceController class extending BaseController
- [ ] Set up repository dependencies
- [ ] Implement workspace CRUD operations
- [ ] Add workspace member management
- [ ] Add workspace role management
- [ ] Add error handling and validation
- [ ] Implement rate limiting

### Task 2: Invitation System
#### Implementation Checklist
- [ ] Implement invite creation
- [ ] Add invite acceptance/rejection
- [ ] Add invite listing and management
- [ ] Integrate with EmailService for notifications
- [ ] Add invite expiration handling
- [ ] Add bulk invite support

### Task 3: Testing and Documentation
#### Implementation Checklist
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Update API documentation
- [ ] Document usage patterns
- [ ] Add example requests/responses

## Technical Design

### Controller Pattern
```typescript
export class WorkspaceController extends BaseController {
  constructor(
    private workspaceRepo: WorkspaceRepository,
    private userRepo: UserRepository,
    private emailService: EmailService
  ) {
    super();
  }

  static create(dbProvider: DatabaseProvider): WorkspaceController {
    return new WorkspaceController(
      new WorkspaceRepository(dbProvider.db),
      new UserRepository(dbProvider.db),
      EmailService
    );
  }

  // Workspace Management
  createWorkspace = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      // Implementation
    });
  };

  // Member Management
  inviteMembers = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      // Implementation
    });
  };

  // Role Management
  updateMemberRole = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      // Implementation
    });
  };
}
```

### API Endpoints
```typescript
// Workspace Routes
router.post('/workspaces', controller.createWorkspace);
router.get('/workspaces', controller.listWorkspaces);
router.get('/workspaces/:id', controller.getWorkspace);
router.patch('/workspaces/:id', controller.updateWorkspace);
router.delete('/workspaces/:id', controller.archiveWorkspace);

// Member Routes
router.post('/workspaces/:id/invites', controller.inviteMembers);
router.get('/workspaces/:id/invites', controller.listInvites);
router.post('/workspaces/:id/members', controller.addMember);
router.delete('/workspaces/:id/members/:userId', controller.removeMember);
router.patch('/workspaces/:id/members/:userId/role', controller.updateMemberRole);
```

## Questions/Notes
- Should we support workspace hierarchies?
- Do we need workspace-wide settings?
- How should we handle workspace deletion vs archival?
- Should we implement workspace templates?

## Decisions
- Decision 1: [2024-01-08] Follow BaseController pattern for consistency
- Decision 2: [2024-01-08] Use repositories for all data access
- Decision 3: [2024-01-08] Implement soft deletion for workspaces 