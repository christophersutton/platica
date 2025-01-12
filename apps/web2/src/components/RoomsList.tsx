import React from 'react';
import { useGetRoomsQuery } from '../api';

interface RoomsListProps {
  hubId: string;
}

export function RoomsList({ hubId }: RoomsListProps) {
  const { data: rooms, isLoading, isError } = useGetRoomsQuery(hubId);

  if (isLoading) return <div>Loading Rooms...</div>;
  if (isError || !rooms) return <div>Failed to load rooms.</div>;

  return (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-2">Rooms in Hub {hubId}</h3>
      <ul className="space-y-1">
        {rooms.map(room => (
          <li key={room.id} className="border rounded p-2">
            {room.name}
          </li>
        ))}
      </ul>
    </div>
  );
}