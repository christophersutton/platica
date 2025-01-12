import { useWebSocketSubscription, useWebSocketSender } from "@/contexts/websocket/WebSocketContext";
import { WSEventType, type OutgoingChatEvent, type ChatEvent } from "@platica/shared/src/websockets";
import { useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/contexts/workspace/WorkspaceContext";

export function ChatContainer({ hubId }: { hubId: number }) {
  const { send, isConnected } = useWebSocketSender();
  const { user } = useAuth();
  const { state: { workspace } } = useWorkspace();
  
  // Handle incoming chat messages
  useWebSocketSubscription(
    WSEventType.CHAT,
    useCallback((message: OutgoingChatEvent | ChatEvent) => {
      // Handle new chat message
      if ('message' in message.payload) {
        // Handle ChatEvent (incoming message)
        if (message.payload.message.hubId === hubId) {
          // Update your messages state
        }
      } else {
        // Handle OutgoingChatEvent (sent message confirmation)
        if (message.payload.hubId === hubId) {
          // Update your messages state
        }
      }
    }, [hubId]),
    [hubId]
  );

  // Handle typing indicators
  useWebSocketSubscription(
    WSEventType.TYPING,
    useCallback((message) => {
      if (message.payload.hubId === hubId) {
        // Update typing indicators
      }
    }, [hubId]),
    [hubId]
  );

  const sendMessage = useCallback((content: string) => {
    if (!isConnected || !user || !workspace) return;
    
    send({
      type: WSEventType.CHAT,
      payload: {
        workspaceId: workspace.id,
        hubId,
        content,
        senderId: user.id
      }
    });
  }, [hubId, send, isConnected, user, workspace]);

  return (
    <div className="flex flex-col h-full">
      {/* Your chat UI */}
    </div>
  );
} 