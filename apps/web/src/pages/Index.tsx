import { ChatInput, ChatMessage, Sidebar } from "@/components";
import { cn } from "@/lib/utils";
import {
  ScrollArea,
  Tabs,
  TabsList,
  TabsTrigger,
  Button,
} from "@/components/ui";
import { MessageSquare, File, Users, Pin, LogOut } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query"; // if you still need it, or remove
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";

const Index = () => {
  const { workspaceId = "1", channelId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient(); // optional if you still use react-query for some reason

  const [activeTab, setActiveTab] = useState("messages");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const { user, logout } = useAuth();
  const {
    state,
    loadWorkspace,
    loadChannels,
    loadMessages,
    markChannelAsRead,
    sendMessage,
  } = useAppContext();

  const { workspace, isLoadingWorkspace, workspaceError } = {
    workspace: state.workspace,
    isLoadingWorkspace: state.isLoadingWorkspace,
    workspaceError: state.workspaceError,
  };

  const { channels, isLoadingChannels } = {
    channels: state.channels,
    isLoadingChannels: state.isLoadingChannels,
  };

  // Combine presence data if you want
  // or do it as needed
  const presenceMap = state.presenceMap;

  // We replicate your existing logic
  const currentChannelId = channelId ? Number(channelId) : 0;
  const currentChannel = channels.find((c) => c.id === currentChannelId);

  // Instead of "useChannelMessages" we just read from the context
  const messages = state.messages[currentChannelId] || [];
  const isLoadingMessages = state.isLoadingMessages;

  // If we want to load workspace and channels on mount
  useEffect(() => {
    loadWorkspace(Number(workspaceId));
    loadChannels(Number(workspaceId));
  }, [workspaceId, loadWorkspace, loadChannels]);

  // Load messages whenever channelId changes
  useEffect(() => {
    if (currentChannelId) {
      loadMessages(currentChannelId);
    }
  }, [currentChannelId, loadMessages]);

  // Scroll area logic
  const checkIfAtBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const container = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 30;
        setIsAtBottom(isBottom);
        return isBottom;
      }
    }
    return false;
  }, []);

  const handleScroll = useCallback(() => {
    checkIfAtBottom();
  }, [checkIfAtBottom]);

  // Attach/detach scroll event
  useEffect(() => {
    if (scrollAreaRef.current) {
      const container = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;
      if (container) {
        if (isAtBottom) {
          container.scrollTop = container.scrollHeight;
        }
        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
      }
    }
  }, [messages, currentChannelId, handleScroll, isAtBottom]);

  // Mark channel read if at bottom
  useEffect(() => {
    if (isAtBottom && currentChannelId && messages.length > 0) {
      markChannelAsRead(currentChannelId);
    }
  }, [isAtBottom, currentChannelId, messages, markChannelAsRead]);

  // If no channel selected, navigate to first
  useEffect(() => {
    if (!isLoadingChannels && channels.length && !channelId) {
      navigate(`/w/${workspaceId}/c/${channels[0].id}`);
    }
  }, [channels, channelId, workspaceId, navigate, isLoadingChannels]);

  // Show loading
  if (isLoadingWorkspace || isLoadingChannels) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading workspace...</div>
      </div>
    );
  }

  // Show error
  if (!workspace || workspaceError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-lg text-red-600">
          {workspaceError?.message || "Workspace not found"}
        </div>
        <Button
          variant="outline"
          onClick={logout}
          className="flex items-center gap-1"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    );
  }

  const handleSendMessage = (content: string) => {
    if (currentChannel) {
      sendMessage(currentChannel.id, content);
    }
  };

  return (
    <div className="h-screen flex">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <div className="border-b border-gray-200">
          <div className="p-4 flex justify-between items-center">
            <h1 className="text-xl font-semibold">
              {currentChannel ? `#${currentChannel.name}` : "Select a channel"}
            </h1>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-auto"
            >
              <TabsList className="bg-transparent border-none p-0 h-auto">
                <TabsTrigger
                  value="messages"
                  className="flex items-center gap-2 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800 hover:bg-gray-50 rounded-md px-3 py-2 text-gray-600"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Messages</span>
                </TabsTrigger>
                <TabsTrigger
                  value="files"
                  className="flex items-center gap-2 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800 hover:bg-gray-50 rounded-md px-3 py-2 text-gray-600"
                >
                  <File className="h-4 w-4" />
                  <span>Files</span>
                </TabsTrigger>
                <TabsTrigger
                  value="pinned"
                  className="flex items-center gap-2 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800 hover:bg-gray-50 rounded-md px-3 py-2 text-gray-600"
                >
                  <Pin className="h-4 w-4" />
                  <span>Pinned</span>
                </TabsTrigger>
                <TabsTrigger
                  value="members"
                  className="flex items-center gap-2 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800 hover:bg-gray-50 rounded-md px-3 py-2 text-gray-600"
                >
                  <Users className="h-4 w-4" />
                  <span>Members</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === "members" && (
            <div className="h-full flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {/* Example presence usage: if you have workspace users in context */}
                  {/* or you can combine with useWorkspaceUsers logic */}
                  {/** Suppose you do some mapping of presence data here */}
                  {/* This is just a placeholder. 
                      If you want the full code from use-workspace-users, 
                      you can load them from the same store. */}
                  <div className="text-sm text-gray-500">
                    No dedicated list yet. You can integrate
                    <br />
                    presenceMap: {JSON.stringify(presenceMap)}
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}

          {activeTab === "messages" && (
            <div className="h-full flex flex-col">
              <ScrollArea ref={scrollAreaRef} className="flex-1">
                <div className="p-4 space-y-4">
                  {isLoadingMessages ? (
                    <div>Loading messages...</div>
                  ) : (
                    messages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        id={msg.id}
                        message={msg.content}
                        sender={msg.sender_name}
                        timestamp={new Date(msg.created_at).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                        avatar={
                          msg.avatar_url ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender_name}`
                        }
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
              <div className="p-4 border-t border-slack-border">
                <ChatInput
                  channelId={currentChannel?.id || 0}
                  onSendMessage={handleSendMessage}
                  disabled={!currentChannel}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
