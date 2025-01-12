import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronLeft, Hash, Plus, Clock, User, Settings, LogOut } from "lucide-react";
import { useState, type JSXElementConstructor, type Key, type ReactElement, type ReactNode, type ReactPortal } from "react";
import { cn } from "@/lib/utils";
import { CreateHubModal } from "./CreateHubModal";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

import { useHubs } from "@/contexts/hub/HubContext";
import type { Hub } from '@models/hub';

interface PresenceUser {
  id: number;
  isOnline: boolean;
}

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { workspaceId = "1", hubId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  // const { state } = useAppContext();
  const { hubs, isLoadingHubs } = useHubs();
  
  // // Filter out current user from presence list for DMs
  // const onlineUsers: PresenceUser[] = Object.entries(state.presenceMap)
  //   .filter(([id]) => Number(id) !== user?.id)
  //   .map(([id, presence]) => ({
  //     id: Number(id),
  //     isOnline: presence.status === 'online'
  //   }));

  return (
    <div 
      className={cn(
        "bg-slack-purple h-screen flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-60"
      )}
    >
      <div className="p-1 border-b border-slack-purple-dark flex items-center">
        <Button 
          variant="ghost" 
          className={cn(
            "text-white hover:bg-slack-purple-dark",
            isCollapsed ? "w-full p-1" : "w-full justify-between p-2"
          )}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <>
              {/* {state.workspace?.name || 'Workspace'} */}
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </Button>
      </div>
      
      <ScrollArea className="flex-1 px-1">
        <div className="py-1">
          <div className="mb-2">
            <div className="flex items-center justify-between mb-0.5 px-1">
              {!isCollapsed && <h2 className="text-white font-semibold text-xs">Hubs</h2>}
              <CreateHubModal />
            </div>
            {isLoadingHubs ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 mb-0.5 px-1.5 animate-pulse bg-slack-purple-dark/50 rounded"
                />
              ))
            ) : hubs?.map((hub) => (
                <Button
                  key={hub.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-gray-300 hover:text-white hover:font-semibold mb-0.5 py-1 px-1.5 h-7 text-base relative overflow-hidden",
                    "transition-colors duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    isCollapsed && "px-1.5",
                    Number(hubId) === hub.id && "bg-slack-purple-dark text-white font-semibold",
                    "hover:bg-slack-purple-dark/50"
                  )}
                  onClick={() => navigate(`/w/${workspaceId}/c/${hub.id}`)}
                >
                  <Hash className="h-3.5 w-3.5 mr-0" />
                  {!isCollapsed && (
                    <div className="flex items-center justify-between w-full">
                      <span className={cn(
                        "ml-0",
                        Boolean(hub.unreadCount) && Number(hub.id) !== Number(hubId) && "font-bold text-white",
                        Number(hubId) === hub.id && "font-normal"
                      )}>
                        {hub.name}
                      </span>
                    </div>
                  )}
                </Button>
            ))}
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-0.5 px-1">
              {!isCollapsed && <h2 className="text-white font-semibold text-xs">Direct Messages</h2>}
              <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-300 hover:text-white">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {isLoadingHubs ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 mb-0.5 px-1.5 animate-pulse bg-slack-purple-dark/50 rounded"
                />
              ))
            ) : null }
            {/* onlineUsers.map((u) => (
              <Button
                key={u.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start text-gray-300 hover:text-white hover:font-semibold mb-0.5 py-1 px-1.5 h-7 text-base relative overflow-hidden",
                  "transition-colors duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                  isCollapsed && "px-1.5",
                  "hover:bg-slack-purple-dark/50"
                )}
              >
                <div className={cn(
                  "h-2 w-2 rounded-full mr-0",
                  u.isOnline ? "bg-slack-green" : "bg-gray-400"
                )} />
                {!isCollapsed && <span className="ml-0">{u.id}</span>}
              </Button>
            ))} */}
            
          </div>
        </div>
      </ScrollArea>
      
      <button 
        onClick={logout} 
        className="logout-button mt-auto p-2 bg-red-500 text-white rounded"
      >
        Logout
      </button>
    </div>
  );
}