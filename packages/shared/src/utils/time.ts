export const getCurrentUnixTimestamp = (): number => {
  return Math.floor(Date.now() / 1000);
};

export const millisecondsToUnixTimestamp = (ms: number): number => {
  return Math.floor(ms / 1000);
};

export const unixTimestampToDate = (timestamp: number): Date => {
  if (!isValidTimestamp(timestamp)) {
    throw new TimestampError(`Invalid Unix timestamp: ${timestamp}`);
  }
  return new Date(timestamp * 1000);
};

export const dateToUnixTimestamp = (date: Date): number => {
  return Math.floor(date.getTime() / 1000);
};

export const unixTimestampToMilliseconds = (timestamp: number): number => {
  if (!isValidTimestamp(timestamp)) {
    throw new TimestampError(`Invalid Unix timestamp: ${timestamp}`);
  }
  return timestamp * 1000;
};

// Constants for timestamp units
export const TIMESTAMP_UNITS = {
  SECOND: 1,
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
  MONTH: 2592000, // 30 days
} as const;

// Constants for timestamp validation
export const TIMESTAMP_BOUNDS = {
  MIN: 946684800, // 2000-01-01T00:00:00Z
  MAX: 32503680000, // 3000-01-01T00:00:00Z
} as const;

// Custom error class for timestamp errors
export class TimestampError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimestampError';
  }
}

// Helper to check if a number is likely a Unix timestamp (seconds) vs milliseconds
export const isUnixTimestamp = (num: number): boolean => {
  const now = Date.now() / 1000;
  // If the number is within 100 years of now when interpreted as seconds,
  // it's likely a Unix timestamp
  return Math.abs(now - num) < TIMESTAMP_UNITS.DAY * 365 * 100;
};

// Helper to ensure a timestamp is in Unix timestamp format (seconds)
export const ensureUnixTimestamp = (timestamp: number): number => {
  if (!isUnixTimestamp(timestamp)) {
    return millisecondsToUnixTimestamp(timestamp);
  }
  return timestamp;
};

// New validation function
export const isValidTimestamp = (timestamp: number): boolean => {
  // Must be a number
  if (typeof timestamp !== 'number' || isNaN(timestamp)) {
    return false;
  }

  // Must be within reasonable bounds
  if (timestamp < TIMESTAMP_BOUNDS.MIN || timestamp > TIMESTAMP_BOUNDS.MAX) {
    return false;
  }

  return true;
};

// Safe conversion with validation
export const safelyConvertTimestamp = (value: unknown): number | null => {
  try {
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      if (isValidTimestamp(num)) {
        return num;
      }
    } else if (typeof value === 'number' && isValidTimestamp(value)) {
      return value;
    }
    return null;
  } catch {
    return null;
  }
};