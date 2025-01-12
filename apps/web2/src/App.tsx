import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store/store";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SignupPage } from "./pages/SignupPage";
import { LoginPage } from "./pages/LoginPage";
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
              {/* <Route path="/auth/verify" element={<VerifyPage />} /> */}

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
                <Route path=":hubId" element={<HubView />} />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </div>
      </Provider>
    </>
  );
}

export default App;
