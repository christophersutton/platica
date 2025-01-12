/*
  File: seed.ts

  Fix references from 'channels' to 'hubs', 
  ensuring 'channel_invites' references are removed. 
  The new name is "hubs" / "hub_members". 
  Also ensure references to "channel" are changed to "hub" 
  or "HUBS" as needed.

  Also note that some lines used "channel_members" references 
  which should now be "hub_members". 
*/

import { Database } from "bun:sqlite";
import { join } from "path";
import { UserStatus } from "@platica/shared/constants/enums";
import { ALL_ENGINEERING_MESSAGES, generateTimestamps } from "./engineering_history";
import type { SeedMessage, SeedAttachment, SeedReaction } from "./types";

const db = new Database(join(import.meta.dir, "../../../data/db.sqlite"));
const TEST_EMAIL = process.env.TEST_EMAIL || "test@example.com";

// Type guard for messages with attachments
function hasAttachments(message: SeedMessage): message is SeedMessage & { attachments: SeedAttachment[] } {
  return Array.isArray(message.attachments) && message.attachments.length > 0;
}

// Type guard for messages with reactions
function hasReactions(message: SeedMessage): message is SeedMessage & { reactions: SeedReaction[] } {
  return Array.isArray(message.reactions) && message.reactions.length > 0;
}

// Type guard for messages with thread
function hasThread(message: SeedMessage): message is SeedMessage & { thread: SeedMessage[] } {
  return Array.isArray(message.thread) && message.thread.length > 0;
}

// Default workspace settings
const DEFAULT_WORKSPACE_SETTINGS = {
  file_size_limit: 10 * 1024 * 1024, // 10MB
  default_message_retention_days: 90,
  notification_defaults: {
    desktop_notifications: true,
    email_notifications: true,
    mobile_push: true,
    sound_enabled: true
  }
};

const DEMO_USERS = [
  { email: 'sofia@demo.com', name: 'Sofia Ramirez', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia', display_name: 'Sofia R.' },
  { email: 'mike@demo.com', name: 'Miguel Hernandez', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Miguel', display_name: 'Mike H.' },
  { email: 'alex@demo.com', name: 'Alex Chen', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex', display_name: 'Alex C.' },
  { email: 'carmen@demo.com', name: 'Carmen Rodriguez', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carmen', display_name: 'Carmen R.' },
  { email: 'david@demo.com', name: 'David Kim', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David', display_name: 'David K.' },
];

const HUBS = [
  { name: 'general', description: 'General discussion' },
  { name: 'random', description: 'Random chatter and fun stuff' },
  { name: 'engineering', description: 'Technical discussions' },
  { name: 'design', description: 'Design discussions and feedback' },
  { name: 'team-leads', description: 'Private hub for team leads' },
];

const HUB_MESSAGES: Record<string, SeedMessage[]> = {
  general: [
    { content: "Hey everyone! Welcome to our new workspace 👋", sender: 0, type: "text" },
    { content: "Thanks for having us! Excited to collaborate here.", sender: 1, type: "text"},
    { content: "Just a reminder: All-hands meeting tomorrow at 10am!", sender: 2, type: "system"},
    { content: "Will the meeting be recorded for those who can't make it?", sender: 3, type: "text"},
    { content: "Yes, we'll share the recording afterward.", sender: 0, type: "text"},
    { content: "Perfect, thanks!", sender: 3, type: "text"},
    { content: "Don't forget to update your profiles with your team info!", sender: 1, type: "system"},
    { content: "And timezone! It helps with scheduling.", sender: 4, type: "text"},
  ],
  random: [
    { content: "Anyone up for virtual coffee today? ☕", sender: 2, type: "text"},
    { content: "I'm in! 🙋‍♀️", sender: 3, type: "text"},
    { content: "Check out this cool article on AI: https://example.com/ai-trends", sender: 1, type: "text"},
    { content: "Did you all see the new Star Wars trailer? 🎬", sender: 4, type: "text"},
    { content: "No spoilers please! Saving it for the weekend 🙈", sender: 2, type: "text"},
  ],
  engineering: [
    { content: "Just pushed the new API changes to staging", sender: 1, type: "system"},
    { content: "Nice! I'll review it this afternoon", sender: 4, type: "text"},
    { content: "Heads up: We're upgrading Redis next week", sender: 0, type: "system"},
    { content: "Any breaking changes we should be aware of?", sender: 2, type: "text"},
    { content: "Nothing major, but I'll share the migration guide", sender: 0, type: "text"},
    { content: "Thanks for the heads up!", sender: 2, type: "text"},
    { content: "The e2e tests are passing now ✅", sender: 4, type: "system"},
    { content: "Great work everyone! 🚀", sender: 1, type: "text"},
  ],
  design: [
    { content: "New component library is ready for review", sender: 3, type: "system"},
    { content: "Love the new color palette! 🎨", sender: 0, type: "text"},
  ],
  'team-leads': [
    { content: "Q4 planning meeting tomorrow at 2pm", sender: 0, type: "system"},
    { content: "I'll prepare the OKR review", sender: 1, type: "text"},
    { content: "Don't forget to submit your team's quarterly reports", sender: 0, type: "system"},
  ]
};

async function seed() {
  console.log("🌱 Starting database seed...");
  
  try {
    db.transaction(() => {
      console.log("Creating test user:", TEST_EMAIL);
      db.run(`
        INSERT OR IGNORE INTO users (email, name, avatar_url, created_at, updated_at)
        VALUES (?, ?, ?, unixepoch(), unixepoch())
      `, [TEST_EMAIL, TEST_EMAIL.split("@")[0], null]);

      const testUser = db.query("SELECT id FROM users WHERE email = ?").get(TEST_EMAIL) as { id: number };
      console.log("Test user created with ID:", testUser.id);

      console.log("Creating demo workspace...");
      db.run(`
        INSERT INTO workspaces (
          name, slug, owner_id, file_size_limit, 
          default_message_retention_days, notification_defaults,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
      `, [
        'Platica Demo',
        'platica-demo',
        testUser.id,
        DEFAULT_WORKSPACE_SETTINGS.file_size_limit,
        DEFAULT_WORKSPACE_SETTINGS.default_message_retention_days,
        JSON.stringify(DEFAULT_WORKSPACE_SETTINGS.notification_defaults)
      ]);

      const result = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
      const workspaceId = result.id;
      console.log("Demo workspace created with ID:", workspaceId);

      // Add test user as admin
      console.log("Adding test user as workspace admin...");
      db.run(`
        INSERT INTO workspace_users (
          workspace_id, user_id, role, display_name,
          status, notification_preferences,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
      `, [
        workspaceId,
        testUser.id,
        'admin',
        'Test User',
        UserStatus.ONLINE,
        JSON.stringify(DEFAULT_WORKSPACE_SETTINGS.notification_defaults)
      ]);

      // Create demo users
      console.log("Creating demo users...");
      const userIds = DEMO_USERS.map(user => {
        db.run(`
          INSERT INTO users (email, name, avatar_url, created_at, updated_at)
          VALUES (?, ?, ?, unixepoch(), unixepoch())
        `, [user.email, user.name, user.avatar]);
        const userResult = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
        return userResult.id;
      });

      // Add demo users to workspace
      console.log("Adding demo users to workspace...");
      userIds.forEach((userId, index) => {
        const user = DEMO_USERS[index];
        db.run(`
          INSERT INTO workspace_users (
            workspace_id, user_id, role, display_name,
            status, status_message, notification_preferences,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
        `, [
          workspaceId,
          userId,
          index < 2 ? 'admin' : 'member',
          user.display_name,
          UserStatus.ONLINE,
          null,
          JSON.stringify(DEFAULT_WORKSPACE_SETTINGS.notification_defaults)
        ]);
      });

      // Create hubs
      console.log("Creating hubs...");
      const hubIds = HUBS.map(hub => {
        db.run(`
          INSERT INTO hubs (
            workspace_id, name, description, created_by, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
        `, [workspaceId, hub.name, hub.description, testUser.id]);
        
        const hubResult = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
        return hubResult.id;
      });

      // Add all users to each hub
      console.log("Adding users to hubs...");
      hubIds.forEach((hubId) => {
        const allUsers = [testUser.id, ...userIds];

        allUsers.forEach(userId => {
          db.run(`
            INSERT INTO hub_members (
              hub_id, user_id, role, unread_mentions,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
          `, [hubId, userId, userId === testUser.id ? 'owner' : 'member', 0]);
        });
      });

      // Add messages to each hub
      console.log("Adding messages to hubs...");
      hubIds.forEach((hubId, index) => {
        const hubName = HUBS[index].name;
        
        if (hubName === 'engineering') {
          const baseTime = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
          const timestamps = generateTimestamps(ALL_ENGINEERING_MESSAGES.length, baseTime);
          
          ALL_ENGINEERING_MESSAGES.forEach((message, messageIndex) => {
            const sender = message.sender === 0 ? testUser.id : userIds[message.sender - 1];
            const timestamp = timestamps[messageIndex];
            
            db.run(`
              INSERT INTO messages (workspace_id, hub_id, sender_id,
                content, type, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              workspaceId,
              hubId,
              sender,
              message.content,
              message.type,
              timestamp,
              timestamp
            ]);

            const messageResult = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
            const messageId = messageResult.id;

            if (hasAttachments(message)) {
              message.attachments.forEach((attachment: SeedAttachment) => {
                db.run(`
                  INSERT INTO files (
                    workspace_id, uploader_id, message_id,
                    name, size, mime_type, s3_key,
                    created_at, updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                  workspaceId,
                  sender,
                  messageId,
                  attachment.name,
                  attachment.size,
                  attachment.mime_type,
                  attachment.s3_key,
                  timestamp,
                  timestamp
                ]);
              });
            }

            if (hasReactions(message)) {
              message.reactions.forEach((reaction: SeedReaction) => {
                reaction.users.forEach((userIndex: number) => {
                  const reactingUserId = userIndex === 0 ? testUser.id : userIds[userIndex - 1];
                  db.run(`
                    INSERT INTO reactions (
                      message_id, user_id, emoji, created_at
                    )
                    VALUES (?, ?, ?, ?)
                  `, [
                    messageId,
                    reactingUserId,
                    reaction.emoji,
                    timestamp + Math.floor(Math.random() * 300)
                  ]);
                });
              });
            }

            if (hasThread(message)) {
              const threadId = messageId;
              message.thread.forEach((reply: SeedMessage, replyIndex: number) => {
                const replySender = reply.sender === 0 ? testUser.id : userIds[reply.sender - 1];
                const replyTime = timestamp + ((replyIndex + 1) * 60);
                
                db.run(`
                  INSERT INTO messages (workspace_id, hub_id, sender_id,
                    thread_id, content, type, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                  workspaceId,
                  hubId,
                  replySender,
                  threadId,
                  reply.content,
                  reply.type,
                  replyTime,
                  replyTime
                ]);

                const replyResult = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
                const replyId = replyResult.id;

                if (reply.attachments?.length) {
                  reply.attachments.forEach((attachment: SeedAttachment) => {
                    db.run(`
                      INSERT INTO files (
                        workspace_id, uploader_id, message_id,
                        name, size, mime_type, s3_key,
                        created_at, updated_at
                      )
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                      workspaceId,
                      replySender,
                      replyId,
                      attachment.name,
                      attachment.size,
                      attachment.mime_type,
                      attachment.s3_key,
                      replyTime,
                      replyTime
                    ]);
                  });
                }

                if (reply.reactions?.length) {
                  reply.reactions.forEach((reaction: SeedReaction) => {
                    reaction.users.forEach((userIndex: number) => {
                      const reactingUserId = userIndex === 0 ? testUser.id : userIds[userIndex - 1];
                      db.run(`
                        INSERT INTO reactions (
                          message_id, user_id, emoji, created_at
                        )
                        VALUES (?, ?, ?, ?)
                      `, [
                        replyId,
                        reactingUserId,
                        reaction.emoji,
                        replyTime + Math.floor(Math.random() * 300)
                      ]);
                    });
                  });
                }
              });
            }
          });
        } else {
          const messages = HUB_MESSAGES[hubName as keyof typeof HUB_MESSAGES] || [];
          const baseTime = Math.floor(Date.now() / 1000) - (messages.length * 300);
          
          messages.forEach((message: SeedMessage, messageIndex) => {
            const sender = message.sender === 0 ? testUser.id : userIds[message.sender - 1];
            db.run(`
              INSERT INTO messages (
                workspace_id, hub_id, sender_id,
                content, type, created_at, updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              workspaceId,
              hubId,
              sender,
              message.content,
              message.type,
              baseTime + (messageIndex * 300),
              baseTime + (messageIndex * 300)
            ]);
          });
        }
      });
    })();

    const counts = {
      users: db.query("SELECT COUNT(*) as count FROM users").get() as { count: number },
      hubs: db.query("SELECT COUNT(*) as count FROM hubs").get() as { count: number },
      messages: db.query("SELECT COUNT(*) as count FROM messages").get() as { count: number },
      threads: db.query("SELECT COUNT(DISTINCT thread_id) as count FROM messages WHERE thread_id IS NOT NULL").get() as { count: number }
    };

    console.log("✅ Seed complete! Created:");
    console.log(`- ${counts.users.count} users`);
    console.log(`- ${counts.hubs.count} hubs`);
    console.log(`- ${counts.messages.count} messages`);
    console.log(`- ${counts.threads.count} message threads`);

  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();