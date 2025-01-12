import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useHubs } from "@/contexts/hub/HubContext";

export function CreateHubModal() {
  const [hubName, setHubName] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { workspaceId = "1" } = useParams();
  const navigate = useNavigate();
  const { createHub, isCreatingHub } = useHubs();
  const { toast } = useToast();

  const handleCreateHub = async () => {
    if (!hubName.trim()) return;
    
    try {
      await createHub(Number(workspaceId), { 
        name: hubName.toLowerCase(),
        is_private: false
      });
      
      setHubName("");
      setIsOpen(false);
      toast({
        title: "Hub created",
        description: `#${hubName} has been created successfully.`
      });
      
      // The new hubwill be added to state via websocket event,
      // so we can navigate after creation
      navigate(`/w/${workspaceId}/c/${hubName}`);
    } catch (error) {
      toast({
        title: "Error creating hub",
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
          <DialogTitle>Create a hub
</DialogTitle>
          <DialogDescription>
            Hubs are where your team communicates. They're best when organized
            around a topic — #marketing, for example.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Input
              id="hub
-name"
              placeholder="e.g. marketing"
              value={hubName}
              onChange={(e) => setHubName((e.target as HTMLInputElement).value.toLowerCase())}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreateHub}
            disabled={!hubName.trim() || isCreatingHub}
            className="bg-slack-green hover:bg-slack-green/90"
          >
            {isCreatingHub ? "Creating..." : "Create Hub"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}