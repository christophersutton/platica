import { Outlet } from "react-router-dom";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./ui/resizable";
export function WorkspaceLayout() {
  return (
    <div className="min-h-screen flex">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel>Sidebar</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>
          {" "}
          <Outlet /> {/* 👈 Nested routes render here */}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>Right Sidebar</ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
