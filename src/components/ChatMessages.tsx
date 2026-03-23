import { memo, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { Copy, Check, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface MessageProps {
  content: string;
  createdAt: string;
  messageId?: string;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  onOptionClick?: (text: string) => void;
}

const RelativeTime = ({ date }: { date: string }) => {
  const d = new Date(date);
  const relative = formatDistanceToNow(d, { addSuffix: true })
    .replace("less than a minute ago", "just now")
    .replace("about ", "");
  return (
    <span title={format(d, "PPpp")} className="cursor-default">
      {relative}
    </span>
  );
};

export const UserMessage = memo(({ content, createdAt, messageId, onEdit, onDelete }: MessageProps) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content);

  const handleSave = () => {
    if (!editText.trim() || !messageId || !onEdit) return;
    onEdit(messageId, editText.trim());
    setEditing(false);
  };

  return (
    <div className="group flex justify-end animate-[msg-in_300ms_ease-out_both]">
      <div className="max-w-[80%]">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full min-h-[60px] resize-none rounded-card border border-primary bg-[hsl(var(--surface-elevated))] px-4 py-3 font-body text-sm text-foreground outline-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <Button variant="amber" size="sm" onClick={handleSave}>
                Save & Resend
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <div className="rounded-[12px_12px_4px_12px] bg-primary px-4 py-3 font-body text-[15px] leading-relaxed text-primary-foreground">
                {content}
              </div>
              {(onEdit || onDelete) && (
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground hover:text-foreground transition-colors">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[120px]">
                      {onEdit && messageId && (
                        <DropdownMenuItem onClick={() => { setEditText(content); setEditing(true); }}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                      )}
                      {onDelete && messageId && (
                        <DropdownMenuItem onClick={() => onDelete(messageId)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            <p className="mt-1 text-right font-body text-[10px] text-muted-foreground">
              <RelativeTime date={createdAt} />
            </p>
          </>
        )}
      </div>
    </div>
  );
});
UserMessage.displayName = "UserMessage";

export const AssistantMessage = memo(({ content, createdAt, onOptionClick }: MessageProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Message copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group flex justify-start animate-[msg-in_300ms_ease-out_both]">
      <div className="max-w-[80%]">
        <div className="mb-1.5 flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="font-body text-[10px] font-medium text-muted-foreground">
            LovPlan Architect
          </span>
        </div>
        <div className="relative">
          <div className="rounded-[12px_12px_12px_4px] bg-[hsl(var(--surface-elevated))] px-4 py-3 font-body text-[15px] leading-relaxed text-foreground">
            <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs">
              <ReactMarkdown
                components={{
                  ul: ({ children }) => (
                    <ul className="mt-4 mb-2 flex flex-col gap-2">{children}</ul>
                  ),
                  li: ({ children }) => {
                    if (onOptionClick) {
                      return (
                        <li className="list-none group/option">
                          <button
                            onClick={(e) => onOptionClick(e.currentTarget.textContent || "")}
                            className="text-left w-full border border-primary/30 bg-primary/5 hover:bg-primary/20 hover:border-primary/50 hover:text-primary-foreground rounded-md px-4 py-2.5 text-[14px] text-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-between"
                          >
                            <span>{children}</span>
                            <span className="opacity-0 group-hover/option:opacity-100 transition-opacity text-xs font-mono ml-4">
                              Select ↵
                            </span>
                          </button>
                        </li>
                      );
                    }
                    return <li className="ml-4 list-disc text-foreground pb-1">{children}</li>;
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
          <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button
              onClick={handleCopy}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground hover:text-foreground transition-colors"
              title="Copy message"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-[hsl(var(--sage))]" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <p className="mt-1 font-body text-[10px] text-muted-foreground">
          <RelativeTime date={createdAt} />
        </p>
      </div>
    </div>
  );
});
AssistantMessage.displayName = "AssistantMessage";

export const SystemMessage = memo(({ content }: { content: string }) => (
  <div className="flex justify-center py-2 animate-[msg-in_300ms_ease-out_both]">
    <div className="border-y border-primary/20 px-6 py-2">
      <p className="text-center font-body text-xs text-muted-foreground">{content}</p>
    </div>
  </div>
));
SystemMessage.displayName = "SystemMessage";
