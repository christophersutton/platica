import { z } from 'zod';

/* ------------------------------------------------------------------
   1. Role + Presence
------------------------------------------------------------------ */
export const RoleEnum = z.enum(['administrator', 'moderator', 'member', 'secretary']);
export type UserRole = z.infer<typeof RoleEnum>;

/**
 * Presence: user’s current status in the system
 */
export const PresenceSchema = z.object({
  isOnline: z.boolean().default(false),
  doorStatus: z.enum(['open', 'closed']).default('closed'),
  currentLocation: z.object({
    type: z.enum(['none', 'hub', 'room']).default('none'),
    id: z.string().nullable().default(null)
  }),
  lastActive: z.string().default(() => new Date().toISOString()) // ISO date string
});
export type Presence = z.infer<typeof PresenceSchema>;

/* ------------------------------------------------------------------
   2. User
------------------------------------------------------------------ */
export const UserSchema = z.object({
  id: z.string(),                   // Typically a DB-generated string or GUID
  email: z.string().email(),
  name: z.string().min(2),
  role: RoleEnum.default('member'), // 'administrator', 'moderator', 'member', 'secretary'
  presence: PresenceSchema,
  createdAt: z.string(),            // ISO date
  updatedAt: z.string(),
  deactivatedAt: z.string().nullable().optional(),
  assignedSecretaryId: z.string().optional(), // If user is not a secretary, references a user w/ role=secretary
  avatarUrl: z.string().url().optional(),
  ssoProvider: z.string().optional(),
  ssoId: z.string().optional()
});
export type User = z.infer<typeof UserSchema>;

/* ------------------------------------------------------------------
   3. Attachment
------------------------------------------------------------------ */
/**
 * Attachment: file metadata stored in DB or included with messages, bulletins, etc.
 */
export const AttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  url: z.string().url(),
  mimeType: z.string(),
  uploadedBy: z.string(),  // userId
  uploadedAt: z.string()   // ISO date
});
export type Attachment = z.infer<typeof AttachmentSchema>;

/* ------------------------------------------------------------------
   4. Hub (renamed from Channel)
------------------------------------------------------------------ */
/**
 * A Hub is a persistent open-door workspace with an assigned secretary.
 */
export const HubSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(2),
  description: z.string().optional(),
  topic: z.string().optional(),
  isArchived: z.boolean().default(false),
  createdBy: z.string(), // userId
  settings: z.record(z.any()).default({}),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Hub = z.infer<typeof HubSchema>;

/**
 * HubMember: pivot for users in a Hub
 */
export const HubMemberSchema = z.object({
  hubId: z.string(),
  userId: z.string(),
  role: RoleEnum.optional().default('member'), // can store 'moderator' or 'member' if needed
  lastReadAt: z.string().optional(),
  unreadMentions: z.number().optional(),
  settings: z.record(z.any()).default({}),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type HubMember = z.infer<typeof HubMemberSchema>;

/* ------------------------------------------------------------------
   5. Rooms
------------------------------------------------------------------ */
/**
 * A Room is a time-boxed collaboration space. Possibly attached to a Hub.
 */
export const RoomSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  scheduledStart: z.string(), // ISO date or numeric timestamp in practice
  scheduledEnd: z.string(),
  startedAt: z.string().nullable().optional(),
  endedAt: z.string().nullable().optional(),
  status: z.enum(['scheduled', 'active', 'ended']).default('scheduled'),
  createdBy: z.string(), // userId
  settings: z.record(z.any()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional()
});
export type Room = z.infer<typeof RoomSchema>;

/**
 * RoomMember: pivot for users in a Room
 */
export const RoomMemberSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  userId: z.string(),
  role: z.enum(['host', 'presenter', 'participant']).default('participant'),
  joinedAt: z.string(),
  leftAt: z.string().nullable().optional(),
  state: z.object({
    online: z.boolean().default(true),
    audio: z.boolean().default(false),
    video: z.boolean().default(false),
    sharing: z.boolean().default(false),
    handRaised: z.boolean().default(false)
  }),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type RoomMember = z.infer<typeof RoomMemberSchema>;

/* ------------------------------------------------------------------
   6. Messages
------------------------------------------------------------------ */
export const MessageTypeEnum = z.enum(['text', 'file', 'system']);
export type MessageTypeEnum = z.infer<typeof MessageTypeEnum>;

/**
 * Message: belongs to a Hub or optionally a Room. 
 * threadId references parent message for threading.
 */
export const MessageSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  hubId: z.string().nullable().optional(),
  roomId: z.string().nullable().optional(),
  senderId: z.string(),
  threadId: z.string().nullable().optional(),
  content: z.string(),
  type: MessageTypeEnum.default('text'),
  attachments: z.array(AttachmentSchema).optional(),
  isEdited: z.boolean().default(false),
  editedAt: z.string().nullable().optional(),
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string(), // ISO date
  updatedAt: z.string().optional()
});
export type Message = z.infer<typeof MessageSchema>;

/* ------------------------------------------------------------------
   7. Artifacts: Bulletins, Memos, Minutes
------------------------------------------------------------------ */
/**
 * Bulletins: announcements in a Hub
 */
export const BulletinSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  postedBy: z.string(), // userId
  hubId: z.string(),    // belongs to a Hub
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional()
});
export type Bulletin = z.infer<typeof BulletinSchema>;

/**
 * Memos: permanent knowledge shares
 */
export const MemoSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  authorId: z.string(),  // user or secretary
  signedBy: z.string(),  // user who vouches (must not be a secretary)
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  tags: z.array(z.string()).optional()
});
export type Memo = z.infer<typeof MemoSchema>;

/**
 * Minutes: structured summary of a Hub or Room discussion
 * always generated by a secretary
 */
export const MinutesSchema = z.object({
  id: z.string(),
  hubId: z.string().nullable(),
  roomId: z.string().nullable(),
  generatedBy: z.string(), // userId w/ role=secretary
  content: z.string(),
  createdAt: z.string()
});
export type Minutes = z.infer<typeof MinutesSchema>;

/* ------------------------------------------------------------------
   8. Ephemeral Chats
   Not stored in DB, short-lived text convos between a few people
------------------------------------------------------------------ */
export const EphemeralChatSchema = z.object({
  chatId: z.string(),
  userIds: z.array(z.string()), // participants
  createdAt: z.string()         // ISO date
});
export type EphemeralChat = z.infer<typeof EphemeralChatSchema>;

export const EphemeralMessageSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  senderId: z.string(),
  content: z.string(),
  createdAt: z.string() // ISO date
});
export type EphemeralMessage = z.infer<typeof EphemeralMessageSchema>;
