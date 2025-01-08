import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useAppContext } from "@/contexts/AppContext";

export function CreateChannelModal() {
  const [channelName, setChannelName] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { workspaceId = "1" } = useParams();
  const navigate = useNavigate();
  const { createChannel } = useAppContext();
  const { toast } = useToast();

  const handleCreateChannel = async () => {
    if (!channelName.trim()) return;
    
    setIsCreating(true);
    try {
      await createChannel(Number(workspaceId), { 
        name: channelName.toLowerCase(),
        is_private: false
      });
      
      setChannelName("");
      setIsOpen(false);
      toast({
        title: "Channel created",
        description: `#${channelName} has been created successfully.`
      });
      
      // The new channel will be added to state via websocket event,
      // so we can navigate after creation
      navigate(`/w/${workspaceId}/c/${channelName}`);
    } catch (error) {
      toast({
        title: "Error creating channel",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-gray-300 hover:text-white"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels are where your team communicates. They're best when organized
            around a topic — #marketing, for example.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Input
              id="channel-name"
              placeholder="e.g. marketing"
              value={channelName}
              onChange={(e) => setChannelName((e.target as HTMLInputElement).value.toLowerCase())}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreateChannel}
            disabled={!channelName.trim() || isCreating}
            className="bg-slack-green hover:bg-slack-green/90"
          >
            {isCreating ? "Creating..." : "Create Channel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
