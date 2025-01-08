import { ChatInput, ChatMessage, Sidebar } from "@/components";
import { ScrollArea, Tabs, TabsList, TabsTrigger, TabsContent, Button } from "@/components/ui";
import { MessageSquare, File, Users, Pin, Star, Bell, LogOut } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useChannelMessages, useChannels, useTypingIndicator, useAuth, useWorkspace } from "@/hooks";
import { usePresence } from "@/hooks/use-presence";
import { api, type Channel } from "@/lib/api";

const Index = () => {
  const { workspaceId = "1", channelId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("messages");
  const { workspace, isLoading: isWorkspaceLoading, error: workspaceError } = useWorkspace();
  const { channels, isLoading: isLoadingChannels } = useChannels(Number(workspaceId));
  const currentChannelId = channelId ? Number(channelId) : undefined;
  const currentChannel = channels?.find(c => c.id === currentChannelId);
  const { user, logout } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  // Initialize presence tracking at the top level
  usePresence();
  
  // Only fetch messages if we have a valid channel
  const {
    messages,
    isLoading: isLoadingMessages,
    sendMessage,
    isSending
  } = useChannelMessages(currentChannelId || 0);

  const { typingUsers } = useTypingIndicator(currentChannelId || 0);

  const handleSendMessage = (content: string) => {
    if (currentChannel) {
      sendMessage(content);
    }
  };

  // Check if scrolled to bottom
  const checkIfAtBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        // Consider "at bottom" if within 30px of the bottom
        const isBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 30;
        setIsAtBottom(isBottom);
        return isBottom;
      }
    }
    return false;
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    checkIfAtBottom();
  }, [checkIfAtBottom]);

  // Mark messages as read when appropriate
  const markMessagesAsRead = useCallback(async () => {
    if (currentChannel?.id && messages?.length > 0) {
      try {
        await api.channels.markRead(currentChannel.id);
        // Update the unread count in the channels list
        queryClient.setQueryData(['channels'], (oldChannels: Channel[] = []) => {
          return oldChannels.map(channel => {
            if (channel.id === currentChannel.id) {
              return {
                ...channel,
                unread_count: 0
              };
            }
            return channel;
          });
        });
      } catch (error) {
        console.error('Failed to mark messages as read:', error);
      }
    }
  }, [currentChannel?.id, messages?.length, queryClient]);

  // Auto-scroll to bottom when messages change or channel changes
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        // Only auto-scroll if we're already at the bottom or it's a channel change
        if (isAtBottom || messages?.length === 0) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
        // Add scroll event listener
        scrollContainer.addEventListener('scroll', handleScroll);
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
      }
    }
  }, [messages, currentChannel?.id, handleScroll, isAtBottom]);

  // Mark messages as read when:
  // 1. Channel changes
  // 2. New messages arrive and we're at bottom
  // 3. Manually scrolled to bottom
  useEffect(() => {
    const shouldMarkRead = !isLoadingMessages && (
      isAtBottom || // We're at the bottom
      messages?.length === 0 || // Empty channel
      !messages // No messages yet
    );

    if (shouldMarkRead) {
      markMessagesAsRead();
    }
  }, [isAtBottom, currentChannel?.id, messages, isLoadingMessages, markMessagesAsRead]);

  // Redirect to first channel if no channel is selected
  useEffect(() => {
    if (!isLoadingChannels && channels?.length && !channelId) {
      navigate(`/w/${workspaceId}/c/${channels[0].id}`);
    }
  }, [channels, channelId, workspaceId, navigate, isLoadingChannels]);

  // Show loading state while data is being fetched
  if (isWorkspaceLoading || isLoadingChannels) {
    return <div className="h-screen flex items-center justify-center">
      <div className="text-lg text-gray-600">Loading workspace...</div>
    </div>;
  }

  // Show error if workspace not found
  if (!workspace || workspaceError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-lg text-red-600">
          {workspaceError?.message || 'Workspace not found'}
        </div>
        <Button 
          variant="outline" 
          onClick={logout}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <div className="border-b border-gray-200">
          <div className="p-4 flex justify-between items-center">
            <h1 className="text-xl font-semibold">
              {currentChannel ? `#${currentChannel.name}` : 'Select a channel'}
            </h1>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
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
          {activeTab === "messages" && (
            <div className="h-full flex flex-col">
              <ScrollArea ref={scrollAreaRef} className="flex-1">
                <div className="p-4 space-y-4">
                  {isLoadingMessages ? (
                    <div>Loading messages...</div>
                  ) : (
                    <>
                      {messages?.map((msg) => (
                        <ChatMessage
                          key={msg.id}
                          id={msg.id}
                          message={msg.content}
                          sender={msg.sender_name}
                          timestamp={new Date(msg.created_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          avatar={msg.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender_name}`}
                        />
                      ))}
                      {typingUsers.filter(id => id !== user?.id).map((userId) => (
                        <ChatMessage
                          key={`typing-${userId}`}
                          id={-userId}
                          message=""
                          sender="Someone"
                          timestamp=""
                          avatar={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`}
                          isTyping={true}
                        />
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
              <div className="p-4 border-t border-slack-border">
                <ChatInput
                  channelId={currentChannel?.id || 0}
                  onSendMessage={handleSendMessage}
                  disabled={!currentChannel || isSending}
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
