import { isValidTimestamp, unixTimestampToMilliseconds } from '@platica/shared/src/utils/time';

interface SafeTimestampProps {
  timestamp: number;
  format?: 'relative' | 'absolute';
  className?: string;
  fallback?: string;
}

export function SafeTimestamp({ 
  timestamp, 
  format = 'absolute',
  className = '',
  fallback = '—'
}: SafeTimestampProps) {
  try {
    if (!isValidTimestamp(timestamp)) {
      console.error('Invalid timestamp:', timestamp);
      return <span className={className}>{fallback}</span>;
    }

    // Convert Unix timestamp (seconds) to milliseconds for Date
    const ms = timestamp * 1000;
    if (!Number.isFinite(ms)) {
      console.error('Invalid milliseconds value:', ms);
      return <span className={className}>{fallback}</span>;
    }

    const date = new Date(ms);
    // Validate the date object
    if (date.toString() === 'Invalid Date') {
      console.error('Invalid date from timestamp:', timestamp);
      return <span className={className}>{fallback}</span>;
    }
    
    if (format === 'relative') {
      // Simple relative time for now - can enhance later
      const diff = (Date.now() / 1000) - timestamp;
      if (diff < 60) return <span className={className}>just now</span>;
      if (diff < 3600) return <span className={className}>{Math.floor(diff / 60)}m ago</span>;
      if (diff < 86400) return <span className={className}>{Math.floor(diff / 3600)}h ago</span>;
      // Use a safer date format that doesn't throw
      return <span className={className}>{date.getFullYear()}-{String(date.getMonth() + 1).padStart(2, '0')}-{String(date.getDate()).padStart(2, '0')}</span>;
    }

    // Use individual date components instead of toLocaleString to avoid potential errors
    return (
      <span className={className} title={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`}>
        {String(date.getHours()).padStart(2, '0')}:{String(date.getMinutes()).padStart(2, '0')}
      </span>
    );
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return <span className={className}>{fallback}</span>;
  }
} 