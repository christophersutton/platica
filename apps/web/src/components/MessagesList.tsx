import { useParams } from "react-router-dom";
import { useGetHubMessagesQuery, useGetRoomMessagesQuery } from "../api";
import { MessageItem } from "./MessageItem";
import { ApiMessage } from "@platica/shared/models";

export function MessagesList({ hubId, roomId }: { hubId?: string; roomId?: string }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  
  const {
    data: messages,
    isLoading,
    isError
  } = hubId 
    // eslint-disable-next-line react-hooks/rules-of-hooks
    ? useGetHubMessagesQuery(
        workspaceId && hubId ? { workspaceId, hubId } : undefined,
        { skip: !hubId }
      )
    // eslint-disable-next-line react-hooks/rules-of-hooks
    : useGetRoomMessagesQuery(roomId || "", { skip: !roomId });

  if (!workspaceId) return <div>Invalid workspace ID.</div>;
  if (isLoading) return <div className="p-4 text-gray-600">Loading messages...</div>;
  if (isError) return <div className="p-4 text-red-600">Failed to load messages.</div>;
  if (!messages?.length) return <div className="p-4 text-gray-600">No messages yet.</div>;

  return (
    <div className="flex flex-col space-y-4 p-4">
      {messages.map((msg: ApiMessage) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  );
}