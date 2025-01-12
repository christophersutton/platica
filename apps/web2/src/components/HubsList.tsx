import React from 'react';
import { useGetHubsQuery } from '../api';

export function HubsList() {
  const { data: hubs, isLoading, isError } = useGetHubsQuery();

  if (isLoading) return <div>Loading Hubs...</div>;
  if (isError || !hubs) return <div>Failed to load hubs.</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Hubs</h2>
      <ul className="space-y-1">
        {hubs.map((hub) => (
          <li key={hub.id} className="border rounded p-2">
            <strong>{hub.name}</strong> - {hub.description}
          </li>
        ))}
      </ul>
    </div>
  );
}