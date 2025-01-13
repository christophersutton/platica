import { useParams } from "react-router-dom";
import { useGetHubMessagesQuery, useGetRoomMessagesQuery } from "../api";
import { MessageItem } from "./MessageItem";
import { ApiMessage } from "@platica/shared/models";
import { useEffect, useRef } from "react";

export function MessagesList({
  hubId,
  roomId,
}: {
  hubId?: string;
  roomId?: string;
}) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const lastMessageTimestamp = useRef<ApiMessage['createdAt'] | null>(null);
  
  const {
    data: hubMessages,
    isLoading: isHubLoading,
    isError: isHubError,
  } = useGetHubMessagesQuery(
    workspaceId && hubId ? { workspaceId, hubId } : undefined,
    { skip: !hubId || !workspaceId }
  );

  const {
    data: roomMessages,
    isLoading: isRoomLoading,
    isError: isRoomError,
  } = useGetRoomMessagesQuery(roomId || "", { skip: !roomId });

  // Combine the results
  const messages = hubId ? hubMessages : roomMessages;
  const isLoading = hubId ? isHubLoading : isRoomLoading;
  const isError = hubId ? isHubError : isRoomError;

  // Check if user is near bottom
  const checkIfAtBottom = () => {
    if (!containerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const scrollPosition = scrollHeight - scrollTop - clientHeight;
    return scrollPosition < 50;
  };

  // Function to scroll to bottom
  const scrollToBottom = (force = false) => {
    if (!containerRef.current || (!force && !isAtBottomRef.current)) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Track scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      isAtBottomRef.current = checkIfAtBottom();
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle initial load
  useEffect(() => {
    if (!isLoading && messages?.length && !lastMessageTimestamp.current) {
      scrollToBottom(true);
      lastMessageTimestamp.current = messages[messages.length - 1].createdAt;
    }
  }, [isLoading, messages]);

  // Handle new messages
  useEffect(() => {
    if (!messages?.length) return;
    
    const lastMessage = messages[messages.length - 1];
    const newTimestamp = lastMessage.createdAt;
    
    if (lastMessageTimestamp.current && newTimestamp !== lastMessageTimestamp.current) {
      scrollToBottom(false); // Only scroll if user was already at bottom
      lastMessageTimestamp.current = newTimestamp;
    }
  }, [messages]);

  if (!workspaceId) return <div>Invalid workspace ID.</div>;
  if (isLoading)
    return <div className="p-4 text-gray-600">Loading messages...</div>;
  if (isError)
    return <div className="p-4 text-red-600">Failed to load messages.</div>;
  if (!messages?.length)
    return <div className="p-4 text-gray-600">No messages yet.</div>;

  // Sort messages by timestamp, newest last (at bottom)
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div 
      ref={containerRef}
      className="flex flex-col h-full overflow-y-auto"
    >
      <div className="flex-1 min-h-[50px]" />
      <div className="flex flex-col gap-4 px-4 py-2">
        {sortedMessages.map((msg: ApiMessage) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
}