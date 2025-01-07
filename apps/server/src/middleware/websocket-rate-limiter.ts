export class WebSocketRateLimiter {
    private limits: Map<string, number[]> = new Map();
    
    constructor(
      private windowMs: number = 60000,  // 1 minute window
      private maxMessages: number = 120   // messages per window
    ) {}
  
    isRateLimited(userId: string): boolean {
      const now = Date.now();
      const timestamps = this.limits.get(userId) || [];
      
      // Clear old timestamps
      const validTimestamps = timestamps.filter(t => now - t < this.windowMs);
      
      if (validTimestamps.length >= this.maxMessages) {
        return true;
      }
      
      // Add new timestamp
      validTimestamps.push(now);
      this.limits.set(userId, validTimestamps);
      
      return false;
    }
  
    // Clean up old entries periodically
    cleanup() {
      const now = Date.now();
      for (const [userId, timestamps] of this.limits.entries()) {
        const validTimestamps = timestamps.filter(t => now - t < this.windowMs);
        if (validTimestamps.length === 0) {
          this.limits.delete(userId);
        } else {
          this.limits.set(userId, validTimestamps);
        }
      }
    }
  }
  
//   // Usage in WebSocket service:
//   const rateLimiter = new WebSocketRateLimiter();
  
//   // Clean up every minute
//   setInterval(() => rateLimiter.cleanup(), 60000);
  
//   // In message handler:
//   websocket: {
//     message(ws, message) {
//       if (rateLimiter.isRateLimited(ws.data.userId)) {
//         ws.send(JSON.stringify({
//           type: 'error',
//           message: 'Rate limit exceeded. Please wait before sending more messages.'
//         }));
//         return;
//       }
//       // Handle message normally
//     }
//   }