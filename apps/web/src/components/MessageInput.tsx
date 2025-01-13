import { useParams } from "react-router-dom";
import { Button } from "./ui/button";
import { useState, useRef, useEffect } from "react";
import { useSendHubMessageMutation, useSendRoomMessageMutation } from "../api";
import { Paperclip, Send } from "lucide-react";

import { Textarea } from "./ui/textarea";

export function MessageInput({
  hubId,
  roomId,
}: {
  hubId?: string;
  roomId?: string;
}) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [content, setContent] = useState("");
  const [sendRoomMessage] = useSendRoomMessageMutation();
  const [sendHubMessage] = useSendHubMessageMutation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!content.trim()) return;
    if (hubId && workspaceId) {
      await sendHubMessage({ workspaceId, hubId, content });
    } else if (roomId) {
      await sendRoomMessage({ roomId, content });
    }
    setContent("");
  };

  // const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  //   if (e.key === "Enter" && !e.shiftKey) {
  //     e.preventDefault();
  //     handleSend();
  //   }
  // };

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [content]);

  if (!workspaceId) return null;

  return (
    <div className="flex items-end gap-2 py-6 ">
      <Button variant="ghost" size="icon" className="rounded-full shrink-0 h-10 w-10">
        <Paperclip className="h-5 w-5" />
      </Button>
      <Textarea
        ref={textareaRef}
        className="opacity-100 flex-1 rounded-2xl bg-gray-100 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none px-4 py-3 min-h-[56px] max-h-[200px] text-base"
        placeholder="Type your message..."
        value={content}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          setContent(e.target.value)
        }
        // onKeyDown={handleKeyDown}
        rows={1}
      />
      <Button 
        onClick={handleSend}
        disabled={!content.trim()}
        size="icon"
        className="rounded-full shrink-0 h-10 w-10 bg-gray-800 hover:bg-gray-900 p-0"
      >
        <Send className="h-5 w-5" />
      </Button>
    </div>
  );
}
