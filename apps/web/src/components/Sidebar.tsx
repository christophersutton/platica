import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronLeft, Hash, Plus, Clock, User, Settings, LogOut } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { CreateChannelModal } from "./CreateChannelModal";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceUsers } from "@/hooks/use-workspace-users";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChannels } from "@/hooks/use-channels";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { workspaceId = "1", channelId } = useParams();
  const navigate = useNavigate();
  const { channels, isLoading: isLoadingChannels } = useChannels(Number(workspaceId));
  const { users, isLoading: isLoadingUsers } = useWorkspaceUsers();
  const { user } = useAuth();

  // Filter out current user from DM list
  const otherUsers = users.filter(u => u.id !== user?.id);

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
              Workspace Name
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </Button>
      </div>
      
      <ScrollArea className="flex-1 px-1">
        <div className="py-1">
          <div className="mb-2">
            <div className="flex items-center justify-between mb-0.5 px-1">
              {!isCollapsed && <h2 className="text-white font-semibold text-xs">Channels</h2>}
              <CreateChannelModal />
            </div>
            {isLoadingChannels ? (
              // Show loading skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 mb-0.5 px-1.5 animate-pulse bg-slack-purple-dark/50 rounded"
                />
              ))
            ) : channels?.map((channel) => (
                <Button
                  key={channel.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-gray-300 hover:text-white hover:font-semibold mb-0.5 py-1 px-1.5 h-7 text-sm relative overflow-hidden",
                    "transition-colors duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    isCollapsed && "px-1.5",
                    Number(channelId) === channel.id && "bg-slack-purple-dark text-white font-semibold",
                    "hover:bg-slack-purple-dark/50"
                  )}
                  onClick={() => navigate(`/w/${workspaceId}/c/${channel.id}`)}
                >
                  <Hash className="h-3.5 w-3.5 mr-0" />
                  {!isCollapsed && (
                    <div className="flex items-center justify-between w-full">
                      <span className="ml-0">{channel.name}</span>
                      {Boolean(channel.has_unread) && Number(channel.id) !== Number(channelId) && (
                        <span className="h-2.5 w-2.5 rounded-full bg-white shrink-0" />
                      )}
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
            {isLoadingUsers ? (
              // Show loading skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 mb-0.5 px-1.5 animate-pulse bg-slack-purple-dark/50 rounded"
                />
              ))
            ) : otherUsers.map((u) => (
              <Button
                key={u.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start text-gray-300 hover:text-white hover:font-semibold mb-0.5 py-1 px-1.5 h-7 text-sm relative overflow-hidden",
                  "transition-colors duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                  isCollapsed && "px-1.5",
                  "hover:bg-slack-purple-dark/50"
                )}
              >
                <div className={cn(
                  "h-2 w-2 rounded-full mr-0",
                  u.isOnline ? "bg-slack-green" : "bg-gray-400"
                )} />
                {!isCollapsed && <span className="ml-0">{u.name || u.email}</span>}
              </Button>
            ))}
          </div>
        </div>
      </ScrollArea>

      <div className="p-1 border-t border-slack-purple-dark">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full text-left text-gray-300 py-1 relative overflow-hidden",
                "transition-colors duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                isCollapsed ? "justify-center" : "justify-start",
                "hover:bg-slack-purple-dark/50"
              )}
            >
              <div className="flex items-center space-x-1.5">
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-slack-green flex items-center justify-center text-white text-sm font-medium">
                    {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-slack-green border-2 border-slack-purple" />
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{user?.name}</p>
                  </div>
                )}
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            side="top" 
            className="w-56 p-1 bg-white dark:bg-slate-900"
          >
            <div className="space-y-1">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-xs h-7"
              >
                <User className="h-3.5 w-3.5 mr-1.5" />
                Edit Profile
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-xs h-7"
              >
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Set Status
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-xs h-7"
              >
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                Set Timezone
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => api.auth.logout()}
              >
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                Logout
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
