import React from 'react';
import { useGetRoomQuery } from '../api';

interface RoomViewProps {
  roomId: string;
}

export function RoomView({ roomId }: RoomViewProps) {
  const { data: room, isLoading, isError } = useGetRoomQuery(roomId);

  if (isLoading) return <div>Loading Room...</div>;
  if (isError || !room) return <div>Failed to load this room.</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Room: {room.name}</h2>
      <p className="mb-4">Belongs to Hub: {room.hubId}</p>
      {/* Future: video/voice UI, secretary tasks, etc. */}
      <div>--- Room details go here ---</div>
    </div>
  );
}