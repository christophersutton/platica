import { describe, expect, test, beforeEach } from "bun:test";
import { HubRepository } from "../../../src/db/repositories/hub
-repository";
import type { HubCreateDTO } from "@platica/shared/types";
import { setupTestContext } from "../../utils/test-utils";

describe("HubRepository", () => {
  const ctx = setupTestContext();
  let hubRepo: HubRepository;

  beforeEach(() => {
    hubRepo = new HubRepository(ctx.db);
  });

  describe("basic operations", () => {
    test("creates a hub
 with required fields", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const now = Math.floor(Date.now() / 1000);
      
      const hubData: HubCreateDTO = {
        workspace_id: workspace.id,
        name: `test-hub
-${now}`,
        description: "Test hub
 description",
        is_private: false,
        is_archived: false,
        created_by: user.id,
        settings: {},
      };

      const hub
 = await hubRepo.create(hubData);

      expect(hub
).toBeDefined();
      expect(hub
.name).toBe(`test-hub
-${now}`);
      expect(hub
.description).toBe("Test hub
 description");
      expect(hub
.workspace_id).toBe(workspace.id);
      expect(hub
.created_by).toBe(user.id);
      expect(hub
.is_archived).toBe(false);
      expect(hub
.settings).toEqual({});
    });

    test("finds hub
 by id", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const hub
 = await ctx.factory.createHub({}, workspace, user);

      const found = await hubRepo.findById(hub
.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(hub
.id);
      expect(found?.name).toBe(hub
.name);
      expect(found?.settings).toBeDefined();
    });

    test("updates hub
 fields", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const hub
 = await ctx.factory.createHub({}, workspace, user);

      const updated = await hubRepo.update(hub
.id, {
        name: "Updated Hub",
        description: "Updated description",
        settings: {
          custom_field: "test"
        }
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe("Updated Hub");
      expect(updated?.description).toBe("Updated description");
      expect(updated?.settings).toEqual({ custom_field: "test" });
    });
  });

  describe("hub
 listing", () => {
    test("finds hubs by workspace with metadata", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      
      // Create multiple hubs
      const hub1 = await ctx.factory.createHub({
        name: "First Hub",
        settings: {}
      }, workspace, user);
      const hub2 = await ctx.factory.createHub({
        name: "Second Hub",
        settings: {}
      }, workspace, user);

      // Add some members
      const member = await ctx.factory.createUser({
        email: "member@example.com",
        name: "Test Member"
      });
      await ctx.factory.addUserToHub(member, hub1);

      const hubs = await hubRepo.findByWorkspace(workspace.id);
      expect(hubs).toHaveLength(2);
      
      // Check first hub

      expect(hubs[0].name).toBe("First Hub");
      expect(hubs[0].member_count).toBe(2); // Creator + added member
      expect(hubs[0].message_count).toBe(0);
      expect(hubs[0].last_message_at).toBeNull();

      // Check second hub

      expect(hubs[1].name).toBe("Second Hub");
      expect(hubs[1].member_count).toBe(1); // Just creator
      expect(hubs[1].message_count).toBe(0);
      expect(hubs[1].last_message_at).toBeNull();
    });

    test("includes user-specific metadata when userId is provided", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const hub
 = await ctx.factory.createHub({}, workspace, user);

      // Add another user but don't add to hub

      const otherUser = await ctx.factory.createUser({
        email: "other@example.com",
        name: "Other User"
      });

      const hubs = await hubRepo.findByWorkspace(workspace.id, otherUser.id);
      expect(hubs).toHaveLength(1);
      expect(hubs[0].member_status).toBeNull();
      expect(hubs[0].has_unread).toBe(false);
    });

    test("gets single hub
 with metadata", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const hub
 = await ctx.factory.createHub({}, workspace, user);

      const found = await hubRepo.findWithMeta(hub
.id);
      expect(found).toBeDefined();
      expect(found?.member_count).toBe(1);
      expect(found?.message_count).toBe(0);
      expect(found?.last_message_at).toBeNull();
    });
  });

  describe("member management", () => {
    test("finds hub
 members with user info", async () => {
      const admin = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, admin);
      const hub
 = await ctx.factory.createHub({}, workspace, admin);
      
      // Add another member
      const member = await ctx.factory.createUser({
        email: "member@example.com",
        name: "Test Member"
      });
      await ctx.factory.addUserToHub(member, hub
);

      const members = await hubRepo.findMembers(hub
.id);
      expect(members).toHaveLength(2);
      
      // Check admin
      const adminMember = members.find(m => m.user_id === admin.id);
      expect(adminMember).toBeDefined();
      expect(adminMember?.user_name).toBe(admin.name);
      expect(adminMember?.user_email).toBe(admin.email);

      // Check member
      const regularMember = members.find(m => m.user_id === member.id);
      expect(regularMember).toBeDefined();
      expect(regularMember?.user_name).toBe(member.name);
      expect(regularMember?.user_email).toBe(member.email);
    });

    test("adds member to hub
", async () => {
      const admin = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, admin);
      const hub
 = await ctx.factory.createHub({}, workspace, admin);
      
      const member = await ctx.factory.createUser({
        email: "member@example.com",
        name: "Test Member"
      });

      await hubRepo.addMember(hub
.id, member.id, 'member');
      
      const exists = await ctx.db
        .prepare("SELECT 1 FROM hub_members WHERE hub_id = ? AND user_id = ?")
        .get(hub
.id, member.id);
      expect(exists).toBeDefined();
    });

    test("updates member last read time", async () => {
      const admin = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, admin);
      const hub
 = await ctx.factory.createHub({}, workspace, admin);
      
      const member = await ctx.factory.createUser({
        email: "member@example.com",
        name: "Test Member"
      });
      await hubRepo.addMember(hub
.id, member.id, 'member');

      const now = Math.floor(Date.now() / 1000);
      await hubRepo.updateMember(hub
.id, member.id, {
        last_read_at: now
      });

      const result = await ctx.db
        .prepare("SELECT last_read_at FROM hub_members WHERE hub_id = ? AND user_id = ?")
        .get(hub
.id, member.id) as { last_read_at: number };

      expect(result.last_read_at).toBe(now);
    });

    test("removes member from hub
", async () => {
      const admin = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, admin);
      const hub
 = await ctx.factory.createHub({}, workspace, admin);
      
      const member = await ctx.factory.createUser({
        email: "member@example.com",
        name: "Test Member"
      });
      await hubRepo.addMember(hub
.id, member.id, 'member');

      await hubRepo.removeMember(hub
.id, member.id);
      
      const exists = await ctx.db
        .prepare("SELECT 1 FROM hub_members WHERE hub_id = ? AND user_id = ?")
        .get(hub
.id, member.id);
      expect(exists).toBeNull();
    });
  });
}); 