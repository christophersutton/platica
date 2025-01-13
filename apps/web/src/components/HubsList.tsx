import { useGetHubsQuery } from '../api';
import { useParams, Link } from 'react-router-dom';
import { CreateHubForm } from './CreateHubForm';

export function HubsList() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data, isLoading, isError, error } = useGetHubsQuery(workspaceId || "");

  console.log("HubsList render:", { workspaceId, data, isLoading, isError, error });
  
  if (!workspaceId) return <div>Invalid workspace ID.</div>;
  if (isLoading) return <div>Loading Hubs...</div>;
  if (isError || !data) return <div>Failed to load hubs.</div>;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Hubs</h2>
        <ul className="space-y-1">
          {data.map((hub) => (
            <li key={hub.id} className="border rounded p-2 hover:bg-gray-50">
              <Link to={`h/${hub.id}`} className="block">
                <strong>{hub.name}</strong>
                {hub.description && (
                  <p className="text-sm text-gray-600">{hub.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-2">Create New Hub</h3>
        <CreateHubForm />
      </div>
    </div>
  );
}