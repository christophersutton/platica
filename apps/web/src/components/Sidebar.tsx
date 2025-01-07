import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronLeft, Hash, Plus, Clock, User, Settings } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CreateChannelModal } from "./CreateChannelModal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChannels } from "@/hooks/use-channels";

// TODO: Replace with real workspace ID from context/route
const TEMP_WORKSPACE_ID = 1;

const directMessages = [
  { name: "Sarah Wilson", status: "online" },
  { name: "Mike Johnson", status: "offline" },
  { name: "Emma Davis", status: "online" },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { channels, isLoading } = useChannels(TEMP_WORKSPACE_ID);

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
            {isLoading ? (
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
                  "w-full justify-start text-gray-300 hover:bg-slack-purple-dark mb-0.5 py-1 px-1.5 h-7 text-sm",
                  isCollapsed && "px-1.5"
                )}
              >
                <Hash className="h-3.5 w-3.5 mr-1.5" />
                {!isCollapsed && (
                  <>
                    {channel.name}
                    {channel.unread_count > 0 && (
                      <span className="ml-auto bg-white text-slack-purple text-xs font-bold px-1.5 rounded-full">
                        {channel.unread_count}
                      </span>
                    )}
                  </>
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
            {directMessages.map((dm) => (
              <Button
                key={dm.name}
                variant="ghost"
                className={cn(
                  "w-full justify-start text-gray-300 hover:bg-slack-purple-dark mb-0.5 py-1 px-1.5 h-7 text-sm",
                  isCollapsed && "px-1.5"
                )}
              >
                <div className="h-2 w-2 rounded-full mr-1.5 bg-slack-green" />
                {!isCollapsed && dm.name}
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
                "w-full text-left text-gray-300 hover:bg-slack-purple-dark py-1",
                isCollapsed ? "justify-center" : "justify-start"
              )}
            >
              <div className="flex items-center space-x-1.5">
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-slack-green flex items-center justify-center text-white text-sm font-medium">
                    YU
                  </div>
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-slack-green border-2 border-slack-purple" />
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">You</p>
                    <p className="text-xs text-gray-300 truncate">🟢 Active</p>
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
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}