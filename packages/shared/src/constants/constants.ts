// File size limits
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_AVATAR_SIZE: 2 * 1024 * 1024  // 2MB
} as const;

// Message limits
export const MESSAGE_LIMITS = {
  MAX_LENGTH: 4000,
  MAX_ATTACHMENTS: 10,
  MAX_REACTIONS_PER_MESSAGE: 50
} as const;

// Time constants
export const TIME_CONSTANTS = {
  TYPING_INDICATOR_TIMEOUT: 3000,
  PRESENCE_UPDATE_INTERVAL: 30000,
  MESSAGE_EDIT_WINDOW: 5 * 60 * 1000  // 5 minutes
} as const;

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.ms-excel'],
  MEDIA: ['video/mp4', 'audio/mpeg', 'audio/wav']
} as const;

// Validation rules
export const VALIDATION = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 32,
    PATTERN: /^[a-zA-Z0-9_-]+$/
  },
  CHANNEL: {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 80,
    DESC_MAX_LENGTH: 1000
  },
  WORKSPACE: {
    NAME_MIN_LENGTH: 3,
    NAME_MAX_LENGTH: 50
  }
} as const; 