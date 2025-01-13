import { useGetRoomQuery } from "../api";
import { useParams } from "react-router-dom";

export function RoomView() {
  const { roomId } = useParams<{roomId: string}>();
  const { data: room, isLoading, isError } = useGetRoomQuery(roomId || "");
  if (!roomId) return <div>Invalid room ID.</div>;
  

  if (isLoading) return <div>Loading Room...</div>;
  if (isError || !room) return <div>Failed to load this room.</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Room: {room.name}</h2>
      
      {/* Future: video/voice UI, secretary tasks, etc. */}
      <div>--- Room details go here ---</div>
    </div>
  );
}
