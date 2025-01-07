import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";
import { Sidebar } from "@/components/Sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageSquare, File, Users, Pin, Star, Bell } from "lucide-react";
import { useState } from "react";

const initialMessages = [
  {
    id: 1,
    message: "Hey everyone! Welcome to our new Slack workspace 👋",
    sender: "Sarah Wilson",
    timestamp: "12:00 PM",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
  },
  {
    id: 2,
    message: "Thanks for having us! Excited to collaborate here.",
    sender: "Mike Johnson",
    timestamp: "12:02 PM",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
  },
];

const Index = () => {
  const [messages, setMessages] = useState(initialMessages);
  const [activeTab, setActiveTab] = useState("messages");

  const handleSendMessage = (message: string) => {
    const newMessage = {
      id: messages.length + 1,
      message,
      sender: "You",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=You",
    };
    setMessages([...messages, newMessage]);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-slack-border">
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center min-w-0 group flex-1 mr-4">
              <div className="flex items-center min-w-0 hover:bg-gray-100 rounded px-2 py-1 cursor-pointer flex-1">
                <span className="text-2xl mr-2">#</span>
                <h1 className="font-semibold text-lg truncate">general</h1>
                <div className="hidden group-hover:flex items-center gap-2 ml-2">
                  <button className="p-1 hover:bg-gray-200 rounded" title="Star channel">
                    <Star className="h-4 w-4 text-gray-500" />
                  </button>
                  <button className="p-1 hover:bg-gray-200 rounded" title="Notification preferences">
                    <Bell className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-transparent border-none">
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
                  value="pins" 
                  className="flex items-center gap-2 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800 hover:bg-gray-50 rounded-md px-3 py-2 text-gray-600"
                >
                  <Pin className="h-4 w-4" />
                  <span>Pins</span>
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
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} {...msg} />
                  ))}
                </div>
              </ScrollArea>
              <div className="p-4 border-t border-slack-border">
                <ChatInput onSendMessage={handleSendMessage} />
              </div>
            </div>
          )}
          {activeTab === "files" && (
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-4">Files</h2>
              <p className="text-gray-500">No files have been shared in this channel yet.</p>
            </div>
          )}
          {activeTab === "members" && (
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-4">Channel Members</h2>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" className="w-10 h-10 rounded-full" />
                  <div>
                    <p className="font-medium">Sarah Wilson</p>
                    <p className="text-sm text-gray-500">Online</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Mike" className="w-10 h-10 rounded-full" />
                  <div>
                    <p className="font-medium">Mike Johnson</p>
                    <p className="text-sm text-gray-500">Away</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === "pins" && (
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-4">Pinned Messages</h2>
              <p className="text-gray-500">No messages have been pinned yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;