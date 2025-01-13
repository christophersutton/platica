import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store/store";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SignupPage } from "./pages/SignupPage";
import { LoginPage } from "./pages/LoginPage";
import { VerifyAuth } from "./pages/VerifyAuth";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { HubsList } from "./components/HubsList";
import { HubView } from "./components/HubView";
import { RoomView } from "./components/RoomView";
import { Settings } from "lucide-react";


function App() {
  return (
    <>
      <Provider store={store}>
        <div>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/verify" element={<VerifyAuth />} />

              {/* Protected workspace routes */}
              <Route
                path="/w/:workspaceId"
                element={
                  <ProtectedRoute>
                    <WorkspaceLayout />
                  </ProtectedRoute>
                }
              >
                {/* Nested workspace routes */}
                <Route index element={<HubsList />} />
                <Route path="settings" element={<Settings />} />
                <Route path="rooms/:roomId" element={<RoomView />} />
                <Route path="h/:hubId" element={<HubView />} />
              </Route>

              {/* 404 Page */}
              <Route
                path="*"
                element={
                  <div className="flex flex-col items-center justify-center min-h-screen">
                    <h1 className="text-4xl font-bold mb-4">404</h1>
                    <p className="text-gray-600 mb-4">Page not found</p>
                    <button
                      onClick={() => window.history.back()}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      Go Back
                    </button>
                  </div>
                }
              />
            </Routes>
          </BrowserRouter>
        </div>
      </Provider>
    </>
  );
}

export default App;
