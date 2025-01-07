export const getCurrentUnixTimestamp = (): number => {
  return Math.floor(Date.now() / 1000);
};

export const millisecondsToUnixTimestamp = (ms: number): number => {
  return Math.floor(ms / 1000);
};

export const unixTimestampToDate = (timestamp: number): Date => {
  return new Date(timestamp * 1000);
};

// New utility functions
export const dateToUnixTimestamp = (date: Date): number => {
  return Math.floor(date.getTime() / 1000);
};

export const unixTimestampToMilliseconds = (timestamp: number): number => {
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