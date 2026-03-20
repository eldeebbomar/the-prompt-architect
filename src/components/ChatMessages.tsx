import { memo } from "react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";

interface MessageProps {
  content: string;
  createdAt: string;
}

export const UserMessage = memo(({ content, createdAt }: MessageProps) => (
  <div className="flex justify-end animate-[msg-in_300ms_ease-out_both]">
    <div className="max-w-[80%]">
      <div className="rounded-[12px_12px_4px_12px] bg-primary px-4 py-3 font-body text-[15px] leading-relaxed text-primary-foreground">
        {content}
      </div>
      <p className="mt-1 text-right font-body text-[10px] text-muted-foreground">
        {format(new Date(createdAt), "h:mm a")}
      </p>
    </div>
  </div>
));
UserMessage.displayName = "UserMessage";

export const AssistantMessage = memo(({ content, createdAt }: MessageProps) => (
  <div className="flex justify-start animate-[msg-in_300ms_ease-out_both]">
    <div className="max-w-[80%]">
      <div className="mb-1.5 flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="font-body text-[10px] font-medium text-muted-foreground">
          LovPlan Architect
        </span>
      </div>
      <div className="rounded-[12px_12px_12px_4px] bg-[hsl(var(--surface-elevated))] px-4 py-3 font-body text-[15px] leading-relaxed text-foreground">
        <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_li]:text-foreground [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
      <p className="mt-1 font-body text-[10px] text-muted-foreground">
        {format(new Date(createdAt), "h:mm a")}
      </p>
    </div>
  </div>
));
AssistantMessage.displayName = "AssistantMessage";

export const SystemMessage = memo(({ content }: { content: string }) => (
  <div className="flex justify-center py-2 animate-[msg-in_300ms_ease-out_both]">
    <div className="border-y border-primary/20 px-6 py-2">
      <p className="text-center font-body text-xs text-muted-foreground">{content}</p>
    </div>
  </div>
));
SystemMessage.displayName = "SystemMessage";
