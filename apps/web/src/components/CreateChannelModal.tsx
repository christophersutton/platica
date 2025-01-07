import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useChannels } from "@/hooks/use-channels";
import { useToast } from "@/components/ui/use-toast";

// TODO: Replace with real workspace ID from context/route
const TEMP_WORKSPACE_ID = 1;

export function CreateChannelModal() {
  const [channelName, setChannelName] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { createChannel, isCreating } = useChannels(TEMP_WORKSPACE_ID);
  const { toast } = useToast();

  const handleCreateChannel = async () => {
    try {
      await createChannel({ 
        name: channelName.toLowerCase(),
        is_private: false
      });
      setChannelName("");
      setIsOpen(false);
      toast({
        title: "Channel created",
        description: `#${channelName} has been created successfully.`
      });
    } catch (error) {
      toast({
        title: "Error creating channel",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
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