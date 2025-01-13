import { useGetRoomsQuery } from '../api';
import { useParams } from 'react-router-dom';

interface RoomsListProps {
  hubId: string;
}

export function RoomsList({ hubId }: RoomsListProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data: rooms, isLoading, isError } = useGetRoomsQuery(
    workspaceId ? { workspaceId, hubId } : undefined
  );

  if (!workspaceId) return <div>Invalid workspace ID.</div>;
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