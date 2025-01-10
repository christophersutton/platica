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
import { useAuth } from "@/contexts/AuthContext";
import {
  usePresence,
  useUserPresence,
} from "@/contexts/presence/PresenceContext";
import { useWorkspace } from "@/contexts/workspace/WorkspaceContext";
import { useChannels } from "@/contexts/channel/ChannelContext";
import { useRoom } from "@/contexts/room/RoomContext";
import { useMessages } from "@/contexts/message/MessageContext";
import type { UiMessage } from "@models/message";

const Index = () => {
  const { workspaceId = "1", channelId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("messages");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const { user, logout } = useAuth();
  const { getUserPresence } = usePresence();
  const {
    state: workspaceState,
    loadWorkspace,
    clearWorkspace,
    updateWorkspace,
  } = useWorkspace();
  const {
    channels,
    channelsById,
    isLoadingChannels,
    typingUsers,
    loadChannels,
    setActiveChannel,
    markChannelAsRead,
  } = useChannels();
  const { state: roomState } = useRoom();
  const {
    isLoadingMessages,
    messageError,
    sendMessage,
    loadMessages,
    getChannelMessages,
  } = useMessages();

  const currentChannelId = channelId ? Number(channelId) : 0;
  const currentChannel = channelsById[currentChannelId];
  const currentMessages = getChannelMessages(currentChannelId);
  
  const currentTypingUsers = typingUsers(currentChannelId);

  // Only load the workspace
useEffect(() => {
  const workspaceNum = Number(workspaceId);
  if (workspaceNum && !workspaceState.workspace && !workspaceState.isLoadingWorkspace) {
    loadWorkspace(workspaceNum);
  }
}, [workspaceId, workspaceState.workspace, workspaceState.isLoadingWorkspace, loadWorkspace]);

// Once the workspace is ready, load channels
useEffect(() => {
  const workspaceNum = Number(workspaceId);
  if (workspaceState.workspace && channels.length === 0 && !isLoadingChannels) {
    loadChannels(workspaceNum);
  }
}, [workspaceId, workspaceState.workspace, channels, isLoadingChannels, loadChannels]);

// Once the channel is selected, load messages
useEffect(() => {
  if (!currentChannelId) return;
  if (!isLoadingMessages(currentChannelId) && getChannelMessages(currentChannelId).length === 0) {
    loadMessages(currentChannelId);
    setActiveChannel(currentChannelId);
  }
}, [currentChannelId, isLoadingMessages, getChannelMessages, loadMessages, setActiveChannel]);

  // Separate effect just for navigation
  useEffect(() => {
    if (!channelId && !isLoadingChannels && channels.length > 0) {
      console.log("Index: Navigating to first channel:", channels[0].id);
      navigate(`/w/${workspaceId}/c/${channels[0].id}`);
    }
  }, [workspaceId, channels, channelId, isLoadingChannels, navigate]);

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

  useEffect(() => {
    if (scrollAreaRef.current) {
      const container = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;
      if (container) {
        // If we’re newly arriving at a channel, auto-scroll to bottom
        if (isAtBottom) {
          container.scrollTop = container.scrollHeight;
        }
        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
      }
    }
  }, [currentMessages, currentChannelId, handleScroll, isAtBottom]);

  // Mark channel as read when at bottom
  useEffect(() => {
    if (isAtBottom && currentChannelId) {
      markChannelAsRead(currentChannelId);
    }
  }, [isAtBottom, currentChannelId, markChannelAsRead]);

  // Show loading
  if (workspaceState.isLoadingWorkspace) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading workspace...</div>
      </div>
    );
  }

  // Show error
  if (!workspaceState.workspace || workspaceState.workspaceError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-lg text-red-600">
          {workspaceState.workspaceError?.message || "Workspace not found"}
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
      sendMessage(currentChannelId, content);
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
                  {currentTypingUsers.length > 0 ? (
                    currentTypingUsers.map((userId) => {
                      const presence = getUserPresence(userId);
                      return (
                        <div key={userId} className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full",
                              presence?.status === "online"
                                ? "bg-green-500"
                                : "bg-gray-400"
                            )}
                          />
                          <div className="text-sm">{userId}</div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-gray-500">
                      No active members in this channel
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {activeTab === "messages" && (
            <div className="h-full flex flex-col">
              <ScrollArea ref={scrollAreaRef} className="flex-1">
                <div className="p-4 space-y-4">
                  {isLoadingMessages(currentChannelId) ? (
                    <div>Loading messages...</div>
                  ) : messageError(currentChannelId) ? (
                    <div className="text-red-600">
                      {messageError(currentChannelId)?.message}
                    </div>
                  ) : currentMessages && currentMessages.length > 0 ? (
                    currentMessages.map((msg: UiMessage) => {
                      
                      if (!msg ) return null;
                      return (
                        <ChatMessage
                          key={msg.id}
                          message={msg}
                          isTyping={currentTypingUsers.includes(msg.sender.id)}
                        />
                      );
                    })
                  ) : (
                    <div className="text-sm text-gray-500">
                      No messages in this channel yet
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="p-4 border-t border-gray-200">
                <ChatInput
                  channelId={currentChannelId}
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
