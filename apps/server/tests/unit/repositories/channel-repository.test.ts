import { describe, expect, test, beforeEach } from "bun:test";
import { ChannelRepository } from "../../../src/db/repositories/channel-repository";
import type { ChannelCreateDTO } from "@platica/shared/types";
import { setupTestContext } from "../../utils/test-utils";

describe("ChannelRepository", () => {
  const ctx = setupTestContext();
  let channelRepo: ChannelRepository;

  beforeEach(() => {
    channelRepo = new ChannelRepository(ctx.db);
  });

  describe("basic operations", () => {
    test("creates a channel with required fields", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const now = Math.floor(Date.now() / 1000);
      
      const channelData: ChannelCreateDTO = {
        workspace_id: workspace.id,
        name: `test-channel-${now}`,
        description: "Test channel description",
        is_private: false,
        is_archived: false,
        created_by: user.id,
        settings: {},
      };

      const channel = await channelRepo.create(channelData);

      expect(channel).toBeDefined();
      expect(channel.name).toBe(`test-channel-${now}`);
      expect(channel.description).toBe("Test channel description");
      expect(channel.workspace_id).toBe(workspace.id);
      expect(channel.created_by).toBe(user.id);
      expect(channel.is_archived).toBe(false);
      expect(channel.settings).toEqual({});
    });

    test("finds channel by id", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const channel = await ctx.factory.createChannel({}, workspace, user);

      const found = await channelRepo.findById(channel.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(channel.id);
      expect(found?.name).toBe(channel.name);
      expect(found?.settings).toBeDefined();
    });

    test("updates channel fields", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const channel = await ctx.factory.createChannel({}, workspace, user);

      const updated = await channelRepo.update(channel.id, {
        name: "Updated Channel",
        description: "Updated description",
        settings: {
          custom_field: "test"
        }
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe("Updated Channel");
      expect(updated?.description).toBe("Updated description");
      expect(updated?.settings).toEqual({ custom_field: "test" });
    });
  });

  describe("channel listing", () => {
    test("finds channels by workspace with metadata", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      
      // Create multiple channels
      const channel1 = await ctx.factory.createChannel({
        name: "First Channel",
        settings: {}
      }, workspace, user);
      const channel2 = await ctx.factory.createChannel({
        name: "Second Channel",
        settings: {}
      }, workspace, user);

      // Add some members
      const member = await ctx.factory.createUser({
        email: "member@example.com",
        name: "Test Member"
      });
      await ctx.factory.addUserToChannel(member, channel1);

      const channels = await channelRepo.findByWorkspace(workspace.id);
      expect(channels).toHaveLength(2);
      
      // Check first channel
      expect(channels[0].name).toBe("First Channel");
      expect(channels[0].member_count).toBe(2); // Creator + added member
      expect(channels[0].message_count).toBe(0);
      expect(channels[0].last_message_at).toBeNull();

      // Check second channel
      expect(channels[1].name).toBe("Second Channel");
      expect(channels[1].member_count).toBe(1); // Just creator
      expect(channels[1].message_count).toBe(0);
      expect(channels[1].last_message_at).toBeNull();
    });

    test("includes user-specific metadata when userId is provided", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const channel = await ctx.factory.createChannel({}, workspace, user);

      // Add another user but don't add to channel
      const otherUser = await ctx.factory.createUser({
        email: "other@example.com",
        name: "Other User"
      });

      const channels = await channelRepo.findByWorkspace(workspace.id, otherUser.id);
      expect(channels).toHaveLength(1);
      expect(channels[0].member_status).toBeNull();
      expect(channels[0].unread_count).toBe(0);
    });

    test("gets single channel with metadata", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const channel = await ctx.factory.createChannel({}, workspace, user);

      const found = await channelRepo.findWithMeta(channel.id);
      expect(found).toBeDefined();
      expect(found?.member_count).toBe(1);
      expect(found?.message_count).toBe(0);
      expect(found?.last_message_at).toBeNull();
    });
  });

  describe("member management", () => {
    test("finds channel members with user info", async () => {
      const admin = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, admin);
      const channel = await ctx.factory.createChannel({}, workspace, admin);
      
      // Add another member
      const member = await ctx.factory.createUser({
        email: "member@example.com",
        name: "Test Member"
      });
      await ctx.factory.addUserToChannel(member, channel);

      const members = await channelRepo.findMembers(channel.id);
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

    test("adds member to channel", async () => {
      const admin = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, admin);
      const channel = await ctx.factory.createChannel({}, workspace, admin);
      
      const member = await ctx.factory.createUser({
        email: "member@example.com",
        name: "Test Member"
      });

      await channelRepo.addMember(channel.id, member.id, 'member');
      
      const exists = await ctx.db
        .prepare("SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?")
        .get(channel.id, member.id);
      expect(exists).toBeDefined();
    });

    test("updates member last read time", async () => {
      const admin = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, admin);
      const channel = await ctx.factory.createChannel({}, workspace, admin);
      
      const member = await ctx.factory.createUser({
        email: "member@example.com",
        name: "Test Member"
      });
      await channelRepo.addMember(channel.id, member.id, 'member');

      const now = Math.floor(Date.now() / 1000);
      await channelRepo.updateMember(channel.id, member.id, {
        last_read_at: now
      });

      const result = await ctx.db
        .prepare("SELECT last_read_at FROM channel_members WHERE channel_id = ? AND user_id = ?")
        .get(channel.id, member.id) as { last_read_at: number };

      expect(result.last_read_at).toBe(now);
    });

    test("removes member from channel", async () => {
      const admin = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, admin);
      const channel = await ctx.factory.createChannel({}, workspace, admin);
      
      const member = await ctx.factory.createUser({
        email: "member@example.com",
        name: "Test Member"
      });
      await channelRepo.addMember(channel.id, member.id, 'member');

      await channelRepo.removeMember(channel.id, member.id);
      
      const exists = await ctx.db
        .prepare("SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?")
        .get(channel.id, member.id);
      expect(exists).toBeNull();
    });
  });
}); 