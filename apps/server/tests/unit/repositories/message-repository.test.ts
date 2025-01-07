import { describe, expect, test, beforeEach } from "bun:test";
import { MessageRepository } from "../../../src/db/repositories/message-repository";
import type { MessageCreateDTO } from "@platica/shared/types";
import { setupTestContext } from "../../utils/test-utils";

type MessageAttachment = {
  type: string;
  url: string;
  metadata: Record<string, unknown>;
};

// Helper to convert attachments array to JSON string for storage
function stringifyAttachments(attachments: MessageAttachment[]): string {
  return JSON.stringify(attachments);
}

describe("MessageRepository", () => {
  const ctx = setupTestContext();
  let messageRepo: MessageRepository;

  beforeEach(() => {
    messageRepo = new MessageRepository(ctx.db);
  });

  describe("createMessage", () => {
    test("creates a message with required fields", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const channel = await ctx.factory.createChannel({}, workspace, user);

      const messageData: MessageCreateDTO = {
        workspace_id: workspace.id,
        channel_id: channel.id,
        sender_id: user.id,
        content: "Hello, world!",
        deleted_at: null,
        is_edited: false,
      };

      const messageId = await messageRepo.createMessage(messageData);
      expect(messageId).toBeGreaterThan(0);

      const message = await messageRepo.findById(messageId);
      expect(message).toBeDefined();
      expect(message?.content).toBe("Hello, world!");
      expect(message?.channel_id).toBe(channel.id);
      expect(message?.sender_id).toBe(user.id);
    });

    test("creates a message with attachments", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const channel = await ctx.factory.createChannel({}, workspace, user);

      const attachments = [
        {
          type: "image" as const,
          url: "test.jpg",
          metadata: {} as Record<string, unknown>,
        },
      ];

      const messageData: MessageCreateDTO = {
        workspace_id: workspace.id,
        channel_id: channel.id,
        sender_id: user.id,
        content: "Check this out!",
        attachments: stringifyAttachments(attachments),
        deleted_at: null,
        is_edited: false,
      };

      const messageId = await messageRepo.createMessage(messageData);
      const message = await messageRepo.findById(messageId);
      expect(message).toBeDefined();
      const dbMessage = await messageRepo.findWithMeta(messageId);
      expect(dbMessage?.attachments).toBeDefined();
      const parsedAttachments = JSON.parse(dbMessage!.attachments as string);
      expect(parsedAttachments).toEqual(attachments);
    });
  });

  describe("findByChannel", () => {
    test("returns messages with sender info and metadata", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const channel = await ctx.factory.createChannel({}, workspace, user);
      await ctx.factory.addUserToChannel(user, channel);

      // Create a few messages
      const messageIds = [];
      for (let i = 0; i < 3; i++) {
        const messageId = await messageRepo.createMessage({
          workspace_id: workspace.id,
          channel_id: channel.id,
          sender_id: user.id,
          content: `Message ${i}`,
          deleted_at: null,
          is_edited: false,
        });
        messageIds.push(messageId);
      }

      const messages = await messageRepo.findByChannel(channel.id);
      expect(messages.length).toBe(3);
      expect(messages[0].sender_name).toBe(user.name);
      expect(messages[0].reaction_count).toBe(0);
      expect(messages[0].has_thread).toBe(0);
    });

    test("respects the limit parameter", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const channel = await ctx.factory.createChannel({}, workspace, user);

      // Create 5 messages
      for (let i = 0; i < 5; i++) {
        await messageRepo.createMessage({
          workspace_id: workspace.id,
          channel_id: channel.id,
          sender_id: user.id,
          content: `Message ${i}`,
          deleted_at: null,
          is_edited: false,
        });
      }

      const messages = await messageRepo.findByChannel(channel.id, 3);
      expect(messages.length).toBe(3);
    });
  });

  describe("hasChannelAccess", () => {
    test("returns true when user is channel member", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const channel = await ctx.factory.createChannel({}, workspace, user);
      await ctx.factory.addUserToChannel(user, channel);

      const hasAccess = await messageRepo.hasChannelAccess(channel.id, user.id);
      expect(hasAccess).toBe(true);
    });

    test("returns false when user is not channel member", async () => {
      const user = await ctx.factory.createUser();
      const otherUser = await ctx.factory.createUser({
        email: "other@example.com",
        name: "Other User",
      });
      const workspace = await ctx.factory.createWorkspace({}, user);
      const channel = await ctx.factory.createChannel({}, workspace, user);
      await ctx.factory.addUserToChannel(user, channel);

      const hasAccess = await messageRepo.hasChannelAccess(
        channel.id,
        otherUser.id
      );
      expect(hasAccess).toBe(false);
    });
  });

  describe("softDelete", () => {
    test("marks message as deleted without removing it", async () => {
      const user = await ctx.factory.createUser();
      const workspace = await ctx.factory.createWorkspace({}, user);
      const channel = await ctx.factory.createChannel({}, workspace, user);

      const messageId = await messageRepo.createMessage({
        workspace_id: workspace.id,
        channel_id: channel.id,
        sender_id: user.id,
        content: "Delete me",
        deleted_at: null,
        is_edited: false,
      });

      await messageRepo.softDelete(messageId);
      const message = await messageRepo.findById(messageId);

      expect(message).toBeDefined();
      expect(message?.deleted_at).toBeDefined();
      expect(message?.deleted_at).toBeGreaterThan(0);
    });
  });
});
