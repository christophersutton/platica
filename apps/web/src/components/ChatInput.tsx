import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, Link, Send } from "lucide-react";
import { useState } from "react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
}

export function ChatInput({ onSendMessage }: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  return (
    <div className="border-t border-slack-border p-4">
      <div className="rounded-lg border border-slack-border bg-white">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message #general"
          className="min-h-[80px] border-none focus:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="flex items-center justify-between p-2 border-t border-slack-border">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bold className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Italic className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Link className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleSend} className="bg-slack-purple hover:bg-slack-purple-dark">
            <Send className="h-4 w-4 mr-2" /> Send
          </Button>
        </div>
      </div>
    </div>
  );
}