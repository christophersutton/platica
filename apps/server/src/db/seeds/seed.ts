import { Database } from "bun:sqlite";
import { join } from "path";

const db = new Database(join(import.meta.dir, "../../../data/db.sqlite"));
const TEST_EMAIL = process.env.TEST_EMAIL || "test@example.com";

const DEMO_USERS = [
  { email: 'sarah@demo.com', name: 'Sarah Wilson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah' },
  { email: 'mike@demo.com', name: 'Mike Johnson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike' },
  { email: 'alex@demo.com', name: 'Alex Chen', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex' },
  { email: 'emily@demo.com', name: 'Emily Brown', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily' },
  { email: 'david@demo.com', name: 'David Kim', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David' },
];

const CHANNELS = [
  { name: 'general', description: 'General discussion', isPrivate: false },
  { name: 'random', description: 'Random chatter and fun stuff', isPrivate: false },
  { name: 'engineering', description: 'Technical discussions', isPrivate: false },
  { name: 'design', description: 'Design discussions and feedback', isPrivate: false },
  { name: 'team-leads', description: 'Private channel for team leads', isPrivate: true },
];

// Different message sets for each channel
const CHANNEL_MESSAGES = {
  general: [
    { content: "Hey everyone! Welcome to our new Slack workspace 👋", sender: 0 },
    { content: "Thanks for having us! Excited to collaborate here.", sender: 1 },
    { content: "Just a reminder: All-hands meeting tomorrow at 10am!", sender: 2 },
    { content: "Will the meeting be recorded for those who can't make it?", sender: 3 },
    { content: "Yes, we'll share the recording afterward.", sender: 0 },
    { content: "Perfect, thanks!", sender: 3 },
    { content: "Don't forget to update your profiles with your team info!", sender: 1 },
    { content: "And timezone! It helps with scheduling.", sender: 4 },
  ],
  random: [
    { content: "Anyone up for virtual coffee today? ☕", sender: 2 },
    { content: "I'm in! 🙋‍♀️", sender: 3 },
    { content: "Check out this cool article on AI: https://example.com/ai-trends", sender: 1 },
    { content: "Did you all see the new Star Wars trailer? 🎬", sender: 4 },
    { content: "No spoilers please! Saving it for the weekend 🙈", sender: 2 },
  ],
  engineering: [
    { content: "Just pushed the new API changes to staging", sender: 1 },
    { content: "Nice! I'll review it this afternoon", sender: 4 },
    { content: "Heads up: We're upgrading Redis next week", sender: 0 },
    { content: "Any breaking changes we should be aware of?", sender: 2 },
    { content: "Nothing major, but I'll share the migration guide", sender: 0 },
    { content: "Thanks for the heads up!", sender: 2 },
    { content: "The e2e tests are passing now ✅", sender: 4 },
    { content: "Great work everyone! 🚀", sender: 1 },
  ],
  design: [
    { content: "New component library is ready for review", sender: 3 },
    { content: "Love the new color palette! 🎨", sender: 0 },
  ],
  'team-leads': [
    { content: "Q4 planning meeting tomorrow at 2pm", sender: 0 },
    { content: "I'll prepare the OKR review", sender: 1 },
    { content: "Don't forget to submit your team's quarterly reports", sender: 0 },
  ],
};

async function seed() {
  console.log("🌱 Starting database seed...");
  
  try {
    // Transaction to ensure data consistency
    db.transaction(() => {
      console.log("Creating test user:", TEST_EMAIL);
      // Create test user first (if doesn't exist)
      db.run(`
        INSERT OR IGNORE INTO users (email, name, avatar_url, created_at, updated_at)
        VALUES (?, ?, ?, unixepoch(), unixepoch())
      `, [TEST_EMAIL, TEST_EMAIL.split("@")[0], null]);

      const testUser = db.query("SELECT id FROM users WHERE email = ?").get(TEST_EMAIL) as { id: number };
      console.log("Test user created with ID:", testUser.id);

      // Create a demo workspace
      console.log("Creating demo workspace...");
      db.run(`
        INSERT INTO workspaces (name, slug, owner_id, created_at, updated_at)
        VALUES ('Platica Demo', 'platica-demo', ?, unixepoch(), unixepoch())
      `, [testUser.id]);

      const result = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
      const workspaceId = result.id;
      console.log("Demo workspace created with ID:", workspaceId);

      // Add test user as admin
      console.log("Adding test user as workspace admin...");
      db.run(`
        INSERT INTO workspace_users (workspace_id, user_id, role, created_at, updated_at)
        VALUES (?, ?, 'admin', unixepoch(), unixepoch())
      `, [workspaceId, testUser.id]);

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
        db.run(`
          INSERT INTO workspace_users (workspace_id, user_id, role, created_at, updated_at)
          VALUES (?, ?, ?, unixepoch(), unixepoch())
        `, [workspaceId, userId, index < 2 ? 'admin' : 'member']);
      });

      // Create channels
      console.log("Creating channels...");
      const channelIds = CHANNELS.map(channel => {
        db.run(`
          INSERT INTO channels (
            workspace_id, name, description, is_private,
            created_by, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())
        `, [workspaceId, channel.name, channel.description, channel.isPrivate, testUser.id]);
        
        const channelResult = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
        return channelResult.id;
      });

      // Add all users to public channels and admins to private channels
      console.log("Adding users to channels...");
      channelIds.forEach((channelId, channelIndex) => {
        const isPrivate = CHANNELS[channelIndex].isPrivate;
        const eligibleUsers = isPrivate 
          ? [testUser.id, ...userIds.slice(0, 2)] // Only admins for private channels
          : [testUser.id, ...userIds]; // All users for public channels

        eligibleUsers.forEach(userId => {
          db.run(`
            INSERT INTO channel_members (
              channel_id, user_id, role,
              created_at, updated_at
            )
            VALUES (?, ?, ?, unixepoch(), unixepoch())
          `, [channelId, userId, userId === testUser.id ? 'owner' : 'member']);
        });
      });

      // Add messages to each channel
      console.log("Adding messages to channels...");
      channelIds.forEach((channelId, index) => {
        const channelName = CHANNELS[index].name;
        const messages = CHANNEL_MESSAGES[channelName as keyof typeof CHANNEL_MESSAGES] || [];
        const baseTime = Math.floor(Date.now() / 1000) - (messages.length * 300); // Space messages 5 minutes apart
        
        messages.forEach((message, messageIndex) => {
          const sender = message.sender === 0 ? testUser.id : userIds[message.sender - 1];
          db.run(`
            INSERT INTO messages (
              workspace_id, channel_id, sender_id,
              content, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            workspaceId,
            channelId,
            sender,
            message.content,
            baseTime + (messageIndex * 300),
            baseTime + (messageIndex * 300)
          ]);
        });
      });
    })();

    // Verify the data was inserted
    const counts = {
      users: db.query("SELECT COUNT(*) as count FROM users").get() as { count: number },
      channels: db.query("SELECT COUNT(*) as count FROM channels").get() as { count: number },
      messages: db.query("SELECT COUNT(*) as count FROM messages").get() as { count: number },
    };

    console.log("✅ Seed complete! Created:");
    console.log(`- ${counts.users.count} users`);
    console.log(`- ${counts.channels.count} channels`);
    console.log(`- ${counts.messages.count} messages`);

  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed(); 