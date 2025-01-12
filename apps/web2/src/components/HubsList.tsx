import { useGetHubsQuery } from '../api';
import { useParams } from 'react-router-dom';

export function HubsList() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data, isLoading, isError, error } = useGetHubsQuery(workspaceId || "");

  console.log("HubsList render:", { workspaceId, data, isLoading, isError, error });
  
  if (!workspaceId) return <div>Invalid workspace ID.</div>;
  if (isLoading) return <div>Loading Hubs...</div>;
  if (isError || !data) return <div>Failed to load hubs.</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Hubs</h2>
      <ul className="space-y-1">
        {data.map((hub) => (
          <li key={hub.id} className="border rounded p-2">
            <strong>{hub.name}</strong> - {hub.description}
          </li>
        ))}
      </ul>
    </div>
  );
}