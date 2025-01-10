import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "@/pages/Index";
import { LoginPage } from "@/components/LoginPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import { PresenceProvider } from "@/contexts/presence/PresenceContext";
import { WebSocketProvider } from "@/contexts/websocket/WebSocketContext";
import { WorkspaceProvider } from "@/contexts/workspace/WorkspaceContext";
import { ChannelProvider } from "@/contexts/channel/ChannelContext";
import { RoomProvider } from "@/contexts/room/RoomContext";
import { ChatProvider } from "@/contexts/chat/ChatContext";
import { MessageProvider } from "@/contexts/message/MessageContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <WebSocketProvider>
          <PresenceProvider>
            <WorkspaceProvider>
              <ChannelProvider>
                <MessageProvider>
                  <RoomProvider>
                    <ChatProvider>
                      <Toaster />
                      <Sonner />
                      <BrowserRouter>
                        <Routes>
                          <Route path="/login" element={<LoginPage />} />
                          <Route
                            path="/"
                            element={
                              <ProtectedRoute>
                                <Navigate to="/w/1" replace />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/w/:workspaceId"
                            element={
                              <ProtectedRoute>
                                <Index />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/w/:workspaceId/c/:channelId"
                            element={
                              <ProtectedRoute>
                                <Index />
                              </ProtectedRoute>
                            }
                          />
                        </Routes>
                      </BrowserRouter>
                    </ChatProvider>
                  </RoomProvider>
                </MessageProvider>
              </ChannelProvider>
            </WorkspaceProvider>
          </PresenceProvider>
        </WebSocketProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;