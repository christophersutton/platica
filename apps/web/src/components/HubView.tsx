import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Settings, Paperclip, Pin } from "lucide-react";
import { ScrollArea } from "../components/ui/scroll-area";
import { Button } from "../components/ui/button";
import { useGetHubQuery } from "../api";

import { MessagesList } from "./MessagesList";
import { MessageInput } from "./MessageInput";

// Enhanced HubView Component
export function HubView() {
  const { workspaceId, hubId } = useParams<{
    workspaceId: string;
    hubId: string;
  }>();
  const {
    data: hub,
    isLoading,
    isError,
  } = useGetHubQuery(workspaceId && hubId ? { workspaceId, hubId } : undefined);

  if (!workspaceId || !hubId) return <div>Invalid workspace or hub ID.</div>;
  if (isLoading) return <div>Loading Hub...</div>;
  if (isError || !hub) return <div>Failed to load this hub.</div>;

  return (
    <div className="flex flex-col h-screen w-full bg-white">
      {/* Breadcrumb */}
      <div className="shrink-0 px-4 py-2 border-b text-sm">
        <Link
          to={`/w/${workspaceId}/`}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          All Hubs
        </Link>
      </div>

      {/* Hub Header */}
      <div className="shrink-0 px-4 py-3 border-b flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span>★</span>
            {hub.name}
          </h2>
          {hub.description && (
            <p className="text-sm text-gray-600 mt-1">{hub.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Pin className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <ScrollArea className="flex-1 absolute inset-0">
          <MessagesList hubId={hubId} />
        </ScrollArea>
        <div className="border-t bg-white/75 backdrop-blur-md backdrop-filter supports-[backdrop-filter]:bg-white/40 relative z-10 p-4">
          <MessageInput hubId={hubId} />
        </div>
      </div>
    </div>
  );
}
