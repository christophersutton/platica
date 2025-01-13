import { useGetRoomAttendeesQuery } from '../api';
import { AttendeeListItem } from './AttendeeListItem';

export function RoomAttendeeList({ roomId }: { roomId: string }) {
  const { data: attendees, isLoading } = useGetRoomAttendeesQuery(roomId);

  if (isLoading) return <div>Loading Room Attendees...</div>;

  return (
    <ul className="list-disc pl-4">
      {attendees?.map(record => (
        <AttendeeListItem
          key={record.user.id}
          user={record.user}
          presence={record.presence}
        />
      ))}
    </ul>
  );
}