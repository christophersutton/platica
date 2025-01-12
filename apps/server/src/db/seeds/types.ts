import { MessageTypeEnum } from "@platica/shared/models/schemas";

export interface SeedAttachment {
  name: string;
  size: number;
  mime_type: string;
  s3_key: string;
  url: string; // For demo/testing, real URLs that work
}

export interface SeedReaction {
  emoji: string;
  users: number[]; // Array of user indices who reacted
}

export interface SeedMessage {
  content: string;
  sender: number; // Index in DEMO_USERS array (0 = test user)
  type: string
  thread?: SeedMessage[]; // For threaded replies
  attachments?: SeedAttachment[];
  reactions?: SeedReaction[];
}