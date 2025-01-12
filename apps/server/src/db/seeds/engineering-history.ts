import { MessageType } from "@platica/shared/constants/enums";
import type { SeedMessage, SeedAttachment } from "./types";

// Common attachments that can be reused
const DEMO_ATTACHMENTS: Record<string, SeedAttachment> = {
  architecture_diagram: {
    name: "platica-architecture.png",
    size: 1024 * 1024 * 2, // 2MB
    mime_type: "image/png",
    s3_key: "diagrams/platica-architecture.png",
    url: "https://images.unsplash.com/photo-1544083515-a13662b98bcd" // Placeholder architecture diagram
  },
  performance_report: {
    name: "performance-audit-jan2024.pdf",
    size: 1024 * 1024 * 3, // 3MB
    mime_type: "application/pdf",
    s3_key: "reports/performance-audit-jan2024.pdf",
    url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" // Real dummy PDF
  },
  bug_screenshot: {
    name: "presence-bug.png",
    size: 1024 * 512, // 512KB
    mime_type: "image/png",
    s3_key: "bugs/presence-bug.png",
    url: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb" // Placeholder bug screenshot
  },
  ui_mockup: {
    name: "reactions-ui-mockup.png",
    size: 1024 * 1024, // 1MB
    mime_type: "image/png",
    s3_key: "design/reactions-ui-mockup.png",
    url: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e" // Placeholder UI mockup
  }
};

// Engineering discussion about building Platica itself
export const ENGINEERING_HISTORY: SeedMessage[] = [
  // Initial WebSocket Architecture Discussion
  {
    content: "Team, we need to make a decision on our WebSocket architecture. I've been researching different approaches.",
    sender: 1, // Mike (Tech Lead)
    type: MessageType.TEXT,
    thread: [
      {
        content: "I've been looking at Socket.IO vs raw WebSocket. Here's what I found:\n- Socket.IO: Better fallback mechanisms, room management\n- Raw WebSocket: Lighter weight, better performance",
        sender: 1,
        type: MessageType.TEXT
      },
      {
        content: "I vote for raw WebSocket. We can build exactly what we need without extra overhead. Plus, we're targeting modern browsers anyway.",
        sender: 4, // David
        type: MessageType.TEXT
      },
      {
        content: "Agreed. We can use the native WebSocket API and build our own lightweight protocol on top.",
        sender: 2, // Alex
        type: MessageType.TEXT
      },
      {
        content: "What about reconnection handling and presence?",
        sender: 3, // Carmen
        type: MessageType.TEXT
      },
      {
        content: "We can implement a simple heartbeat mechanism:\n- Client pings every 30s\n- Server tracks last ping time\n- Presence updates based on ping status",
        sender: 1,
        type: MessageType.TEXT
      },
      {
        content: "That makes sense. We should also add sequence numbers for message ordering.",
        sender: 4,
        type: MessageType.TEXT
      },
      {
        content: "Decision made: We'll use raw WebSocket with custom protocol. I'll create the technical spec.",
        sender: 1,
        type: MessageType.SYSTEM
      }
    ],
    attachments: [DEMO_ATTACHMENTS.architecture_diagram],
    reactions: [
      { emoji: "👍", users: [2, 3, 4] }, // Team approving the decision
      { emoji: "🚀", users: [1, 2] }     // Excitement about the implementation
    ]
  },

  // Database Choice Discussion
  {
    content: "For our database, I'm thinking SQLite with Litestream for replication. Thoughts?",
    sender: 2, // Alex
    type: MessageType.TEXT,
    thread: [
      {
        content: "Interesting choice! What's the reasoning?",
        sender: 3,
        type: MessageType.TEXT
      },
      {
        content: "Several benefits:\n1. Simple deployment (just a file)\n2. Surprisingly good performance\n3. Litestream handles replication to S3\n4. Zero-config primary-replica setup",
        sender: 2,
        type: MessageType.TEXT
      },
      {
        content: "Any concerns about scaling?",
        sender: 1,
        type: MessageType.TEXT
      },
      {
        content: "SQLite can handle surprisingly high loads. Discord uses it for their message store!",
        sender: 2,
        type: MessageType.TEXT
      },
      {
        content: "We can always migrate to Postgres later if needed. Starting simple seems smart.",
        sender: 4,
        type: MessageType.TEXT
      },
      {
        content: "Approved. Let's start with SQLite + Litestream and monitor performance.",
        sender: 1,
        type: MessageType.SYSTEM
      }
    ]
  },

  // Real-time Features Implementation
  {
    content: "Starting work on real-time features. Here's the implementation plan for typing indicators and presence:",
    sender: 3, // Carmen
    type: MessageType.TEXT,
    thread: [
      {
        content: "Key components:\n1. Debounced typing events\n2. Presence heartbeat\n3. Hub-specific typing state\n4. Workspace-wide presence",
        sender: 3,
        type: MessageType.TEXT
      },
      {
        content: "For typing indicators, we should batch updates to avoid flooding the socket",
        sender: 4,
        type: MessageType.TEXT
      },
      {
        content: "Good point. Maybe aggregate updates every 500ms?",
        sender: 3,
        type: MessageType.TEXT
      },
      {
        content: "That works. Also ensure we cleanup typing state after 3s of inactivity.",
        sender: 1,
        type: MessageType.TEXT
      },
      {
        content: "PR ready for review: https://github.com/platica/platica/pull/42",
        sender: 3,
        type: MessageType.SYSTEM
      }
    ],
    attachments: [DEMO_ATTACHMENTS.ui_mockup],
    reactions: [
      { emoji: "✨", users: [1, 2, 3, 4] }, // Everyone likes the idea
      { emoji: "🎨", users: [2, 3] }       // Design appreciation
    ]
  },

  // Performance Optimization Thread
  {
    content: "🐌 Message loading is getting slow in hubs with 1000+ messages",
    sender: 4, // David
    type: MessageType.TEXT,
    thread: [
      {
        content: "Current load time is ~2s for initial hub
 load. Found a few issues:\n1. No pagination\n2. Loading full message history\n3. No caching",
        sender: 4,
        type: MessageType.TEXT
      },
      {
        content: "Let's implement virtual scrolling with React Virtual",
        sender: 2,
        type: MessageType.TEXT
      },
      {
        content: "Good idea. We should also add:\n- Pagination (50 msgs per page)\n- Infinite scroll\n- Local storage caching",
        sender: 4,
        type: MessageType.TEXT
      },
      {
        content: "Don't forget message search optimization. We need proper indexing.",
        sender: 1,
        type: MessageType.TEXT
      },
      {
        content: "We could use SQLite FTS5 for full-text search",
        sender: 2,
        type: MessageType.TEXT
      },
      {
        content: "Implementation plan approved. Priority tasks:\n1. Virtual scrolling\n2. Pagination\n3. FTS5 integration",
        sender: 1,
        type: MessageType.SYSTEM
      }
    ],
    attachments: [DEMO_ATTACHMENTS.performance_report],
    reactions: [
      { emoji: "🐌", users: [1, 2, 3] },    // Agreeing it's slow
      { emoji: "💪", users: [2, 3, 4] }     // Ready to fix it
    ]
  },

  // File Upload Feature
  {
    content: "Starting implementation of file uploads. Current plan is to use S3 with presigned URLs.",
    sender: 2, // Alex
    type: MessageType.TEXT,
    thread: [
      {
        content: "Key requirements:\n1. Direct browser->S3 upload\n2. Progress tracking\n3. Preview generation\n4. Virus scanning",
        sender: 2,
        type: MessageType.TEXT
      },
      {
        content: "For previews, we should handle:\n- Images (thumbnail generation)\n- PDFs (first page preview)\n- Videos (thumbnail frame)",
        sender: 3,
        type: MessageType.TEXT
      },
      {
        content: "We can use Sharp for image processing",
        sender: 4,
        type: MessageType.TEXT
      },
      {
        content: "Good choice. Let's also add upload restrictions:\n- Max file size: 100MB\n- Allowed types: images, docs, pdfs\n- Rate limiting: 10 uploads/min",
        sender: 1,
        type: MessageType.TEXT
      },
      {
        content: "PR for initial implementation: https://github.com/platica/platica/pull/67",
        sender: 2,
        type: MessageType.SYSTEM
      }
    ]
  },

  // Authentication System
  {
    content: "Let's implement passwordless auth with magic links",
    sender: 1, // Mike
    type: MessageType.TEXT,
    thread: [
      {
        content: "Flow:\n1. User enters email\n2. We send magic link\n3. Link contains signed JWT\n4. JWT exchange for session token",
        sender: 1,
        type: MessageType.TEXT
      },
      {
        content: "We should add rate limiting on magic link generation",
        sender: 4,
        type: MessageType.TEXT
      },
      {
        content: "And short expiration times - maybe 15 minutes?",
        sender: 2,
        type: MessageType.TEXT
      },
      {
        content: "Good call. Also need to handle:\n- Link reuse prevention\n- Device tracking\n- Session management",
        sender: 1,
        type: MessageType.TEXT
      },
      {
        content: "PR ready for review: https://github.com/platica/platica/pull/83",
        sender: 1,
        type: MessageType.SYSTEM
      }
    ]
  }
];

// Generate 200 messages total by adding various technical discussions
export const ADDITIONAL_MESSAGES: SeedMessage[] = [
  // Bug Reports and Fixes
  {
    content: "Found a race condition in the presence system when multiple tabs are open",
    sender: 4,
    type: MessageType.TEXT,
    thread: [
      { content: "Steps to reproduce:\n1. Open two tabs\n2. Go offline in one\n3. Other tab still shows as online", sender: 4, type: MessageType.TEXT },
      { content: "Good catch. We need to sync presence across tabs using BroadcastHub", sender: 1, type: MessageType.TEXT },
      { content: "PR with fix: https://github.com/platica/platica/pull/92", sender: 4, type: MessageType.SYSTEM }
    ],
    attachments: [DEMO_ATTACHMENTS.bug_screenshot],
    reactions: [
      { emoji: "🐛", users: [1, 2] },      // Bug reaction
      { emoji: "👀", users: [1, 3, 4] }    // People looking into it
    ]
  },
  { content: "Deployment failed: TypeError in message parser", sender: 2, type: MessageType.SYSTEM },
  { content: "Rolling back to previous version", sender: 1, type: MessageType.SYSTEM },
  { content: "Found the issue - we weren't handling null content in system messages", sender: 2, type: MessageType.TEXT },
  { content: "Fix deployed, all tests passing", sender: 2, type: MessageType.SYSTEM },

  // Feature Requests and Planning
  {
    content: "We should add message reactions ✨",
    sender: 3,
    type: MessageType.TEXT,
    thread: [
      { content: "Agreed! Basic requirements:\n- Emoji picker\n- Reaction counts\n- Real-time updates", sender: 3, type: MessageType.TEXT },
      { content: "Let's use emoji-mart for the picker", sender: 4, type: MessageType.TEXT },
      { content: "Good choice. I'll start on the backend schema", sender: 2, type: MessageType.TEXT }
    ],
    attachments: [DEMO_ATTACHMENTS.ui_mockup],
    reactions: [
      { emoji: "✨", users: [1, 2, 3, 4] }, // Everyone likes the idea
      { emoji: "🎨", users: [2, 3] }       // Design appreciation
    ]
  },

  // Code Review Discussions
  {
    content: "PR Review: Add message threading support",
    sender: 2,
    type: MessageType.TEXT,
    thread: [
      { content: "A few concerns:\n1. N+1 query in thread loading\n2. Missing index on thread_id\n3. No pagination for thread replies", sender: 1, type: MessageType.TEXT },
      { content: "Good points. I'll add the index and fix the N+1", sender: 2, type: MessageType.TEXT },
      { content: "Also consider adding a reply count cache", sender: 4, type: MessageType.TEXT },
      { content: "Updated PR: https://github.com/platica/platica/pull/103", sender: 2, type: MessageType.SYSTEM }
    ],
    attachments: [DEMO_ATTACHMENTS.ui_mockup],
    reactions: [
      { emoji: "🎉", users: [0, 2, 3, 4] }  // Team celebrating the merge
    ]
  },

  // Architecture Decisions
  {
    content: "RFC: Move to server-side rendering for initial page load",
    sender: 1,
    type: MessageType.TEXT,
    thread: [
      { content: "Benefits:\n1. Faster FCP\n2. Better SEO\n3. Reduced client bundle", sender: 1, type: MessageType.TEXT },
      { content: "We could use Next.js for this", sender: 3, type: MessageType.TEXT },
      { content: "Or SvelteKit? It has better performance metrics", sender: 4, type: MessageType.TEXT },
      { content: "Let's stick with React ecosystem for now. Next.js is more mature", sender: 1, type: MessageType.TEXT }
    ]
  },

  // Performance Optimizations
  {
    content: "Performance audit results from last week",
    sender: 4,
    type: MessageType.TEXT,
    thread: [
      { content: "Main issues:\n1. Large JS bundle (2.1MB)\n2. Slow message list rendering\n3. High memory usage", sender: 4, type: MessageType.TEXT },
      { content: "We can lazy load the emoji picker and file preview components", sender: 2, type: MessageType.TEXT },
      { content: "And implement windowing for long message lists", sender: 3, type: MessageType.TEXT },
      { content: "Created tickets for each item: #234, #235, #236", sender: 4, type: MessageType.SYSTEM }
    ]
  },

  // Testing Strategies
  {
    content: "We need better E2E test coverage",
    sender: 3,
    type: MessageType.TEXT,
    thread: [
      { content: "Current coverage is only 45% of critical paths", sender: 3, type: MessageType.TEXT },
      { content: "Let's use Playwright for E2E tests", sender: 2, type: MessageType.TEXT },
      { content: "Good choice. We can run it in GitHub Actions", sender: 1, type: MessageType.TEXT },
      { content: "I'll set up the initial test suite", sender: 3, type: MessageType.TEXT }
    ]
  }
];

// Generate more messages about day-to-day development
const DAILY_MESSAGES = [
  "Updated dependencies to latest versions",
  "Fixed linter errors in message component",
  "Added unit tests for presence system",
  "Optimized webpack config for faster builds",
  "Updated API documentation",
  "Fixed mobile layout issues",
  "Added error boundary to message list",
  "Improved error messages in auth flow",
  "Updated loading states in UI",
  "Fixed memory leak in WebSocket connection",
  "Added retry logic for failed messages",
  "Improved accessibility in message input",
  "Fixed keyboard navigation in emoji picker",
  "Added loading skeletons for messages",
  "Optimized image loading performance",
  "Updated CI pipeline for faster builds",
  "Fixed race condition in message sending",
  "Added proper error handling in file upload",
  "Improved typing indicator performance",
  "Fixed z-index issues in modals",
].map((content) => ({
  content,
  sender: Math.floor(Math.random() * 5), // Random sender
  type: MessageType.TEXT
}));

// Generate status update messages
const STATUS_MESSAGES = [
  "Deployed v0.1.0 to production",
  "Started load testing of WebSocket server",
  "Updated security policies",
  "Enabled error tracking in production",
  "Started performance monitoring",
  "Updated SSL certificates",
  "Completed database backup setup",
  "Enabled rate limiting in production",
  "Updated privacy policy",
  "Completed security audit",
].map((content) => ({
  content,
  sender: 1, // Tech lead
  type: MessageType.SYSTEM
}));

// Generate code review messages
const CODE_REVIEWS = [
  "PR #123: Add message reactions",
  "PR #124: Improve error handling",
  "PR #125: Add message threading",
  "PR #126: Optimize message loading",
  "PR #127: Add file upload support",
  "PR #128: Improve search performance",
  "PR #129: Add user preferences",
  "PR #130: Fix memory leaks",
  "PR #131: Add rate limiting",
  "PR #132: Improve test coverage",
].map((content) => ({
  content: `Ready for review: ${content}`,
  sender: Math.floor(Math.random() * 5),
  type: MessageType.TEXT,
  thread: [
    { content: "Looking at it now", sender: 1, type: MessageType.TEXT },
    { content: "Left some comments", sender: 1, type: MessageType.TEXT },
    { content: "Updated PR with fixes", sender: 2, type: MessageType.TEXT },
    { content: "LGTM 👍", sender: 1, type: MessageType.TEXT }
  ],
  attachments: [DEMO_ATTACHMENTS.ui_mockup],
  reactions: [
    { emoji: "🎉", users: [0, 2, 3, 4] }  // Team celebrating the merge
  ]
}));

// Combine all messages
export const ALL_ENGINEERING_MESSAGES = [
  ...ENGINEERING_HISTORY,
  ...ADDITIONAL_MESSAGES,
  ...DAILY_MESSAGES,
  ...STATUS_MESSAGES,
  ...CODE_REVIEWS
];

// Helper to generate timestamps
export function generateTimestamps(messageCount: number, baseTime: number = Math.floor(Date.now() / 1000)): number[] {
  const timestamps: number[] = [];
  const now = Math.floor(Date.now() / 1000);
  // Ensure baseTime is not in the future and not too far in the past
  baseTime = Math.min(now, Math.max(now - 30 * 24 * 60 * 60, baseTime)); // No more than 30 days old
  
  for (let i = 0; i < messageCount; i++) {
    // Random time between 1-5 minutes apart (reduced from 1-10 to keep messages closer together)
    const gap = Math.floor(Math.random() * 240) + 60; // 1-5 minutes in seconds
    const timestamp = Math.min(now, baseTime - (messageCount - i) * gap);
    timestamps.push(timestamp);
  }
  return timestamps;
}

// Add some reactions to the deployment messages
STATUS_MESSAGES.forEach((msg: SeedMessage) => {
  if (msg.content.includes("Deployed")) {
    msg.reactions = [
      { emoji: "🚀", users: [0, 1, 2, 3, 4] }  // Team celebrating deployment
    ];
  } else if (msg.content.includes("security")) {
    msg.reactions = [
      { emoji: "🔒", users: [1, 2, 4] }  // Security appreciation
    ];
  }
});

// Add reactions to code review messages
CODE_REVIEWS.forEach((review: SeedMessage) => {
  // Add reactions to the LGTM message
  if (review.thread) {
    review.thread[review.thread.length - 1].reactions = [
      { emoji: "🎉", users: [0, 2, 3, 4] }  // Team celebrating the merge
    ];
  }
}); 