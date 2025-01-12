import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Index from "@/pages/Index";
import { LoginPage } from "@/components/LoginPage";
import { VerifyAuthContent } from "@/pages/VerifyAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PresenceProvider } from "@/contexts/presence/PresenceContext";
import { WebSocketProvider } from "@/contexts/websocket/WebSocketContext";
import { WorkspaceProvider } from "@/contexts/workspace/WorkspaceContext";
import { HubProvider } from "@/contexts/hub/HubContext";
import { RoomProvider } from "@/contexts/room/RoomContext";
import { ChatProvider } from "@/contexts/chat/ChatContext";
import { MessageProvider } from "@/contexts/message/MessageContext";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { SignupPage } from "@/components/SignupPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WorkspaceProvider>
        <WebSocketProvider>
          <PresenceProvider>
            <HubProvider>
              <MessageProvider>
                <RoomProvider>
                  <ChatProvider>
                    <Toaster />
                    <Sonner />
                    <BrowserRouter>
                      <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                        <Route path="/auth/verify" element={<VerifyAuthContent />} />
                        <Route
                          path="/"
                          element={
                            <ProtectedRoute>
                              <WorkspaceRedirect />
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
                          path="/w/:workspaceId/c/:hubId"
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
            </HubProvider>
          </PresenceProvider>
        </WebSocketProvider>
      </WorkspaceProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

const WorkspaceRedirect = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.workspaces.list(),
  });

  useEffect(() => {
    if (!isLoading && workspaces?.workspaces && workspaces.workspaces.length > 0) {
      navigate(`/w/${workspaces.workspaces[0].id}`, { replace: true });
    }
  }, [workspaces, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isLoading && (!workspaces?.workspaces || workspaces.workspaces.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Workspaces Found</h2>
          <p className="text-gray-600">You don&apos;t have access to any workspaces.</p>
        </div>
      </div>
    );
  }

  return null;
};

export default App;
