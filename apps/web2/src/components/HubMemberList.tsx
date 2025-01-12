import React from 'react';
import { useGetHubMembersQuery } from '../api';
import { AttendeeListItem } from './AttendeeListItem';

export function HubMemberList({ hubId }: { hubId: string }) {
  const { data: members, isLoading } = useGetHubMembersQuery(hubId);

  if (isLoading) return <div>Loading Hub Members...</div>;

  return (
    <ul className="list-disc pl-4">
      {members?.map(record => (
        <AttendeeListItem
          key={record.user.id}
          user={record.user}
          presence={record.presence}
        />
      ))}
    </ul>
  );
}