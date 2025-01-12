import { useGetHubQuery } from '../api';
import { useParams } from 'react-router-dom';

export function HubView() {
  const { hubId } = useParams<{ hubId: string }>();
  const { data: hub, isLoading, isError } = useGetHubQuery(hubId || "");

  if (!hubId) return <div>Invalid hub ID.</div>;
  if (isLoading) return <div>Loading Hub...</div>;
  if (isError || !hub) return <div>Failed to load this hub.</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">{hub.name}</h2>
      <p className="mb-4">{hub.description}</p>
      {/* 
        Future: show bulletins, announcements, membership list, etc.
        For now, just a placeholder 
      */}
      <div>--- Hub details go here ---</div>
    </div>
  );
}