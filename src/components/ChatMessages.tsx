import { memo, useState, useMemo } from "react";
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

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Recursively extracts plain text from a ReactNode tree. */
const getNodeText = (node: React.ReactNode): string => {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (node && typeof node === "object" && "props" in (node as object)) {
    return getNodeText((node as React.ReactElement).props.children);
  }
  return "";
};

const MULTI_SELECT_RE =
  /\(select all that apply\)|\(choose all that apply\)|\(select multiple\)|\(check all that apply\)|\(select all\)|\(multi-?select\)|\(pick all that apply\)/i;

const isAllAboveOpt = (t: string) => /^all of the above/i.test(t.trim());
const isOtherOpt = (t: string) =>
  /other.*specify|specify.*other/i.test(t.trim());

// ─── UserMessage ────────────────────────────────────────────────────────────

export const UserMessage = memo(
  ({ content, createdAt, messageId, onEdit, onDelete }: MessageProps) => {
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
                <button
                  onClick={() => setEditing(false)}
                  className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
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
                          <DropdownMenuItem
                            onClick={() => {
                              setEditText(content);
                              setEditing(true);
                            }}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                        )}
                        {onDelete && messageId && (
                          <DropdownMenuItem
                            onClick={() => onDelete(messageId)}
                            className="text-destructive focus:text-destructive"
                          >
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
  }
);
UserMessage.displayName = "UserMessage";

// ─── AssistantMessage ────────────────────────────────────────────────────────

export const AssistantMessage = memo(
  ({ content, createdAt, onOptionClick }: MessageProps) => {
    const [copied, setCopied] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [otherValue, setOtherValue] = useState("");
    const [submitted, setSubmitted] = useState(false);

    /** Whether this message supports interactive options at all */
    const hasOptions = !!onOptionClick;

    /** Multi-select mode: detected from "(select all that apply)" pattern */
    const isMulti = MULTI_SELECT_RE.test(content);

    /** All markdown list items parsed from the content (for "All of the above" logic) */
    const parsedOptions = useMemo(() => {
      return content
        .split("\n")
        .filter((l) => /^[-*+]\s+\S/.test(l.trim()))
        .map((l) => l.trim().replace(/^[-*+]\s+/, "").trim());
    }, [content]);

    const isAllChecked = useMemo(() => {
      const regular = parsedOptions.filter(
        (o) => !isAllAboveOpt(o) && !isOtherOpt(o)
      );
      return regular.length > 0 && regular.every((o) => selected.has(o));
    }, [parsedOptions, selected]);

    // ── Handlers ────────────────────────────────────────────────

    const toggle = (text: string) => {
      if (submitted) return;
      if (isAllAboveOpt(text)) {
        const regular = parsedOptions.filter(
          (o) => !isAllAboveOpt(o) && !isOtherOpt(o)
        );
        setSelected(isAllChecked ? new Set() : new Set(regular));
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(text) ? next.delete(text) : next.add(text);
        return next;
      });
    };

    const confirmMulti = () => {
      if (selected.size === 0 || !onOptionClick) return;
      const parts = [...selected].map((s) =>
        isOtherOpt(s) && otherValue.trim() ? otherValue.trim() : s
      );
      setSubmitted(true);
      onOptionClick(parts.join(", "));
    };

    const handleSingleClick = (text: string) => {
      if (submitted || !onOptionClick) return;
      setSubmitted(true);
      onOptionClick(text);
    };

    const handleCopy = async () => {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Message copied!");
      setTimeout(() => setCopied(false), 2000);
    };

    // ── Render helpers ───────────────────────────────────────────

    const renderMultiLi = (children: React.ReactNode) => {
      const text = getNodeText(children);
      const isChecked =
        isAllAboveOpt(text) ? isAllChecked : selected.has(text);
      const isOther = isOtherOpt(text);
      const showOtherInput = isOther && selected.has(text) && !submitted;

      return (
        <li className="list-none">
          <button
            type="button"
            onClick={() => toggle(text)}
            disabled={submitted}
            aria-pressed={isChecked}
            className={[
              "text-left w-full rounded-lg px-3 py-2.5 font-body text-[14px] transition-all duration-150 flex items-center gap-3",
              "border focus:outline-none focus:ring-2 focus:ring-primary/40",
              isChecked
                ? "border-primary bg-primary/20 text-primary"
                : "border-primary/25 bg-primary/5 text-foreground hover:bg-primary/12 hover:border-primary/40",
              submitted ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            ].join(" ")}
          >
            {/* Checkbox indicator */}
            <span
              className={[
                "flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors",
                isChecked
                  ? "bg-primary border-primary"
                  : "border-primary/40 bg-transparent",
              ].join(" ")}
              aria-hidden
            >
              {isChecked && (
                <Check className="h-2.5 w-2.5 text-primary-foreground" />
              )}
            </span>
            <span className="flex-1">{children}</span>
          </button>

          {/* Inline "Other" text input */}
          {showOtherInput && (
            <div className="ml-7 mt-1.5">
              <input
                type="text"
                value={otherValue}
                onChange={(e) => setOtherValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmMulti();
                }}
                placeholder="Type your answer..."
                className="w-full rounded-md border border-border bg-[hsl(var(--surface-elevated))] px-3 py-2 font-body text-sm text-foreground outline-none focus:border-primary transition-colors"
                autoFocus
              />
            </div>
          )}
        </li>
      );
    };

    const renderSingleLi = (children: React.ReactNode) => {
      const text = getNodeText(children);
      return (
        <li className="list-none group/option">
          <button
            type="button"
            onClick={() => handleSingleClick(text)}
            disabled={submitted}
            className={[
              "text-left w-full border border-primary/30 bg-primary/5 rounded-lg px-4 py-2.5",
              "font-body text-[14px] text-primary transition-all duration-150",
              "flex items-center justify-between",
              submitted
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-primary/20 hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50",
            ].join(" ")}
          >
            <span>{children}</span>
            {!submitted && (
              <span className="opacity-0 group-hover/option:opacity-100 transition-opacity font-mono text-xs ml-4 shrink-0">
                Select ↵
              </span>
            )}
          </button>
        </li>
      );
    };

    // ── Component ────────────────────────────────────────────────

    return (
      <div className="group flex justify-start animate-[msg-in_300ms_ease-out_both]">
        <div className="max-w-[82%]">
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
                      <ul className="mt-4 mb-2 flex flex-col gap-2">
                        {children}
                      </ul>
                    ),
                    li: ({ children }) => {
                      if (!hasOptions) {
                        return (
                          <li className="ml-4 list-disc text-foreground pb-1">
                            {children}
                          </li>
                        );
                      }
                      return isMulti
                        ? renderMultiLi(children)
                        : renderSingleLi(children);
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>

              {/* Multi-select confirm bar */}
              {isMulti && hasOptions && parsedOptions.length > 0 && (
                <div
                  className={[
                    "mt-4 flex items-center justify-between border-t border-border/50 pt-3 transition-opacity",
                    submitted ? "opacity-0 pointer-events-none h-0 mt-0 pt-0 border-0 overflow-hidden" : "",
                  ].join(" ")}
                >
                  <span className="font-body text-xs text-muted-foreground">
                    {selected.size === 0
                      ? "Select one or more options"
                      : `${selected.size} selected`}
                  </span>
                  <button
                    type="button"
                    onClick={confirmMulti}
                    disabled={selected.size === 0}
                    className={[
                      "flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-body text-xs font-semibold transition-all duration-150",
                      selected.size > 0
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        : "bg-muted text-muted-foreground cursor-not-allowed",
                    ].join(" ")}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Confirm
                    {selected.size > 0 && (
                      <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px] font-bold">
                        {selected.size}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Copy button */}
            <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                onClick={handleCopy}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy message"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[hsl(var(--sage))]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          <p className="mt-1 font-body text-[10px] text-muted-foreground">
            <RelativeTime date={createdAt} />
          </p>
        </div>
      </div>
    );
  }
);
AssistantMessage.displayName = "AssistantMessage";

// ─── SystemMessage ───────────────────────────────────────────────────────────

export const SystemMessage = memo(({ content }: { content: string }) => (
  <div className="flex justify-center py-2 animate-[msg-in_300ms_ease-out_both]">
    <div className="border-y border-primary/20 px-6 py-2">
      <p className="text-center font-body text-xs text-muted-foreground">
        {content}
      </p>
    </div>
  </div>
));
SystemMessage.displayName = "SystemMessage";
