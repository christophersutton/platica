import React from 'react';
import { useGetHubQuery } from '../api';

interface HubViewProps {
  hubId: string;
}

export function HubView({ hubId }: HubViewProps) {
  const { data: hub, isLoading, isError } = useGetHubQuery(hubId);

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