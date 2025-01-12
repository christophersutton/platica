import { useGetHubMembersQuery } from '../api';
import type { ApiHubMember } from '@platica/shared/src/models/hub';
import { AttendeeListItem } from './AttendeeListItem';

/**
 * Renders the list of hub members in a given hub.
 * Depends on the new "useGetHubMembersQuery" from our updated API.
 */
export function HubMemberList({ hubId }: { hubId: string }) {
  const { data: members, isLoading, isError } = useGetHubMembersQuery(hubId);

  if (isLoading) return <div>Loading Hub Members...</div>;
  if (isError) return <div>Failed to load hub members.</div>;
  if (!members) return <div>No members found.</div>;

  return (
    <ul className="list-disc pl-4">
      {members.map((record: ApiHubMember) => (
        <AttendeeListItem
          key={record.user.id}
          user={record.user}
          // You might or might not have presence data here.
          // By default, ApiHubMember doesn't have a separate presence field in our domain,
          // so we pass a placeholder or omit if not needed.
          presence={undefined}
        />
      ))}
    </ul>
  );
}