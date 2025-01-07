import { describe, expect, test, beforeEach } from "bun:test";
import { WorkspaceRepository } from "../../../src/db/repositories/workspace-repository";
import { setupTestContext } from "../../utils/test-utils";
import { UserRole } from "@platica/shared/types";

describe("WorkspaceRepository", () => {
  const ctx = setupTestContext();
  let workspaceRepo: WorkspaceRepository;

  beforeEach(() => {
    workspaceRepo = new WorkspaceRepository(ctx.db);
  });

  describe("basic operations", () => {
    test("creates a workspace with required fields", async () => {
      const user = await ctx.factory.createUser();
      const now = Math.floor(Date.now() / 1000);

      const workspace = await workspaceRepo.create({
        name: "Test Workspace",
        slug: `test-workspace-${now}`,
        owner_id: user.id,
        settings: {},
      });

      expect(workspace).toBeDefined();
      expect(workspace.name).toBe("Test Workspace");
      expect(workspace.slug).toBe(`test-workspace-${now}`);
      expect(workspace.owner_id).toBe(user.id);
    });

    test("finds workspace by id", async () => {
      const user = await ctx.factory.createUser();
      const now = Math.floor(Date.now() / 1000);
      const workspace = await ctx.factory.createWorkspace(
        {
          slug: `test-workspace-${now}`,
        },
        user
      );

      const found = await workspaceRepo.findById(workspace.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(workspace.id);
      expect(found?.name).toBe(workspace.name);
    });

    test("updates workspace fields", async () => {
      const user = await ctx.factory.createUser();
      const now = Math.floor(Date.now() / 1000);
      const workspace = await ctx.factory.createWorkspace(
        {
          slug: `test-workspace-${now}`,
        },
        user
      );

      const updated = await workspaceRepo.update(workspace.id, {
        name: "Updated Workspace",
        settings: {
          message_retention_days: 30,
        },
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe("Updated Workspace");
      expect((updated?.settings as any).message_retention_days).toBe(30);
    });
  });

  describe("findBySlug", () => {
    test("finds workspace by slug", async () => {
      const user = await ctx.factory.createUser();
      const now = Math.floor(Date.now() / 1000);
      const workspace = await ctx.factory.createWorkspace(
        {
          slug: `test-slug-${now}`,
        },
        user
      );

      const found = await workspaceRepo.findBySlug(`test-slug-${now}`);
      expect(found).toBeDefined();
      expect(found?.id).toBe(workspace.id);
      expect(found?.slug).toBe(`test-slug-${now}`);
    });

    test("returns undefined for non-existent slug", async () => {
      const found = await workspaceRepo.findBySlug("non-existent");
      expect(found).toBeUndefined();
    });
  });

  describe("workspace metadata", () => {
    test("gets workspace with member and channel counts", async () => {
      const user = await ctx.factory.createUser();
      const now = Math.floor(Date.now() / 1000);
      const workspace = await ctx.factory.createWorkspace(
        {
          slug: `test-workspace-${now}`,
        },
        user
      );
      const channel = await ctx.factory.createChannel({}, workspace, user);

      // Add another user to workspace
      const otherUser = await ctx.factory.createUser({
        email: "other@example.com",
        name: "Other User",
      });
      await workspaceRepo.addUser(workspace.id, otherUser.id);
      await ctx.factory.addUserToChannel(otherUser, channel);

      const workspaceWithMeta = await workspaceRepo.getWorkspaceWithMeta(
        workspace.id
      );
      expect(workspaceWithMeta).toBeDefined();
      expect(workspaceWithMeta?.member_count).toBe(2);
      expect(workspaceWithMeta?.channel_count).toBe(1);
    });

    test("includes user role when userId is provided", async () => {
      const user = await ctx.factory.createUser();
      const now = Math.floor(Date.now() / 1000);
      const workspace = await ctx.factory.createWorkspace(
        {
          slug: `test-workspace-${now}`,
        },
        user
      );

      const workspaceWithMeta = await workspaceRepo.getWorkspaceWithMeta(
        workspace.id,
        user.id
      );
      expect(workspaceWithMeta).toBeDefined();
      expect(workspaceWithMeta?.role).toBe(UserRole.ADMIN); // Workspace creator is admin
    });
  });

  describe("user management", () => {
    test("adds user to workspace", async () => {
      const admin = await ctx.factory.createUser();
      const now = Math.floor(Date.now() / 1000);
      const workspace = await ctx.factory.createWorkspace(
        {
          slug: `test-workspace-${now}`,
        },
        admin
      );
      const user = await ctx.factory.createUser({
        email: "member@example.com",
        name: "New Member",
      });

      await workspaceRepo.addUser(workspace.id, user.id, UserRole.MEMBER);

      const role = await workspaceRepo.getMemberRole(workspace.id, user.id);
      expect(role).toBe(UserRole.MEMBER);
    });

    test("updates user role and settings", async () => {
      const admin = await ctx.factory.createUser();
      const now = Math.floor(Date.now() / 1000);
      const workspace = await ctx.factory.createWorkspace(
        {
          slug: `test-workspace-${now}`,
        },
        admin
      );
      const user = await ctx.factory.createUser({
        email: "member@example.com",
        name: "New Member",
      });

      await workspaceRepo.addUser(workspace.id, user.id, UserRole.MEMBER);

      const updated = await workspaceRepo.updateUser(workspace.id, user.id, {
        role: UserRole.ADMIN,
        display_name: "Super Admin",
        status: "active",
        status_message: "Working hard!",
      });

      expect(updated).toBeDefined();
      expect(updated?.role).toBe(UserRole.ADMIN);

      const settings = updated?.settings as Record<string, unknown>;
      expect(settings.display_name).toBe("Super Admin");
      expect(settings.status).toBe("active");
      expect(settings.status_message).toBe("Working hard!");
    });

    test("removes user from workspace and channels", async () => {
      const admin = await ctx.factory.createUser();
      const now = Math.floor(Date.now() / 1000);
      const workspace = await ctx.factory.createWorkspace(
        {
          slug: `test-workspace-${now}`,
        },
        admin
      );
      const user = await ctx.factory.createUser({
        email: "member@example.com",
        name: "New Member",
      });

      // Add user to workspace and channel
      await workspaceRepo.addUser(workspace.id, user.id);
      const channel = await ctx.factory.createChannel({}, workspace, admin);
      await ctx.factory.addUserToChannel(user, channel);

      // Remove user
      await workspaceRepo.removeUser(workspace.id, user.id);

      // Verify user is removed
      const role = await workspaceRepo.getMemberRole(workspace.id, user.id);
      expect(role).toBeUndefined();

      // Verify user is removed from channels
      const hasAccess = await ctx.db
        .prepare(
          "SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?"
        )
        .get(channel.id, user.id);
      expect(hasAccess).toBeNull();
    });
  });

  describe("workspace listing", () => {
    test("gets all workspaces for user with metadata", async () => {
      const user = await ctx.factory.createUser();
      const now = Math.floor(Date.now() / 1000);

      // Create multiple workspaces
      const workspace1 = await ctx.factory.createWorkspace(
        {
          name: "First Workspace",
          slug: `first-workspace-${now}`,
        },
        user
      );
      const workspace2 = await ctx.factory.createWorkspace(
        {
          name: "Second Workspace",
          slug: `second-workspace-${now}`,
        },
        user
      );

      // Add some channels
      await ctx.factory.createChannel({}, workspace1, user);
      await ctx.factory.createChannel({}, workspace1, user);
      await ctx.factory.createChannel({}, workspace2, user);

      const workspaces = await workspaceRepo.getUserWorkspaces(user.id);
      expect(workspaces).toHaveLength(2);

      // Check first workspace
      expect(workspaces[0].name).toBe("First Workspace");
      expect(workspaces[0].channel_count).toBe(2);
      expect(workspaces[0].member_count).toBe(1);
      expect(workspaces[0].role).toBe(UserRole.ADMIN);

      // Check second workspace
      expect(workspaces[1].name).toBe("Second Workspace");
      expect(workspaces[1].channel_count).toBe(1);
      expect(workspaces[1].member_count).toBe(1);
      expect(workspaces[1].role).toBe(UserRole.ADMIN);
    });
  });

  describe("invites", () => {
    test("creates workspace invite", async () => {
      const admin = await ctx.factory.createUser();
      const now = Math.floor(Date.now() / 1000);
      const workspace = await ctx.factory.createWorkspace(
        {
          slug: `test-workspace-${now}`,
        },
        admin
      );

      const invite = await workspaceRepo.createInvite({
        workspace_id: workspace.id,
        inviter_id: admin.id,
        email: "invited@example.com",
        role: UserRole.MEMBER,
      });

      expect(invite).toBeDefined();
      expect(invite.workspace_id).toBe(workspace.id);
      expect(invite.inviter_id).toBe(admin.id);
      expect(invite.email).toBe("invited@example.com");
      expect(invite.role).toBe(UserRole.MEMBER);
      expect(invite.status).toBe("pending");
    });
  });
});
