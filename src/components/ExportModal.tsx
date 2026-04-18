import { Copy, Download, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptCount: number;
  onCopyAll: () => Promise<boolean | void>;
  onDownloadMd: () => void;
  onGoToViewer: () => void;
}

const ExportModal = ({
  open,
  onOpenChange,
  promptCount,
  onCopyAll,
  onDownloadMd,
  onGoToViewer,
}: ExportModalProps) => {
  const handleCopyAll = async () => {
    const ok = await onCopyAll();
    if (ok === false) {
      toast.error("Couldn't copy to clipboard. Try downloading instead.");
      return;
    }
    toast.success(`All ${promptCount} prompts copied!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-foreground">
            Export Your Prompt Blueprint
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            Choose how you'd like to export your {promptCount} prompts
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Copy All */}
          <div className="rounded-card border border-border bg-[hsl(var(--surface-elevated))] p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-primary/10">
                <Copy className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-body text-sm font-medium text-foreground">
                  Copy All to Clipboard
                </h4>
                <p className="mt-1 font-body text-xs text-muted-foreground">
                  All prompts copied as formatted text, separated by dividers. Ready to paste sequentially.
                </p>
                <Button
                  variant="amber"
                  size="sm"
                  className="mt-3"
                  onClick={handleCopyAll}
                >
                  Copy All
                </Button>
              </div>
            </div>
          </div>

          {/* Download MD */}
          <div className="rounded-card border border-border bg-[hsl(var(--surface-elevated))] p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-primary/10">
                <Download className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-body text-sm font-medium text-foreground">
                  Download as Markdown
                </h4>
                <p className="mt-1 font-body text-xs text-muted-foreground">
                  Download a .md file with all prompts organized by category.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-border"
                  onClick={onDownloadMd}
                >
                  Download .md
                </Button>
              </div>
            </div>
          </div>

          {/* One at a time */}
          <div className="rounded-card border border-primary/20 bg-[hsl(var(--surface-elevated))] p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-secondary/10">
                <ArrowRight className="h-4 w-4 text-secondary" />
              </div>
              <div className="flex-1">
                <h4 className="font-body text-sm font-medium text-foreground">
                  Copy One at a Time
                </h4>
                <p className="mt-1 font-body text-xs text-muted-foreground">
                  Use the prompt viewer to copy each prompt individually. We'll track your progress.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-secondary/30 text-secondary hover:bg-secondary/10"
                  onClick={() => {
                    onGoToViewer();
                    onOpenChange(false);
                  }}
                >
                  Go to Viewer
                </Button>
                <p className="mt-2 font-body text-[10px] text-primary">
                  Recommended — Lovable works best with one prompt at a time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportModal;
