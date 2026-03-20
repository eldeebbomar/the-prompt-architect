import { useState, useCallback } from "react";
import type { Json } from "@/integrations/supabase/types";

const STORAGE_KEY_PREFIX = "lovplan_copied_prompts_";

export interface PromptData {
  id: string;
  category: string;
  sequence_order: number;
  title: string;
  purpose: string;
  prompt_text: string;
  is_loop: boolean;
  depends_on?: number[];
}

export function usePromptExport(projectId: string, prompts: PromptData[], metadata?: Json) {
  const storageKey = STORAGE_KEY_PREFIX + projectId;

  const [copiedSet, setCopiedSet] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markCopied = useCallback(
    (promptId: string) => {
      setCopiedSet((prev) => {
        const next = new Set(prev);
        next.add(promptId);
        localStorage.setItem(storageKey, JSON.stringify([...next]));
        return next;
      });
    },
    [storageKey]
  );

  const copiedCount = copiedSet.size;
  const totalCount = prompts.length;
  const allCopied = totalCount > 0 && copiedCount >= totalCount;

  const copyAll = useCallback(async () => {
    const text = prompts
      .map(
        (p) =>
          `## ${p.sequence_order}. ${p.title}\n**Category:** ${p.category}\n**Purpose:** ${p.purpose}\n\n${p.prompt_text}`
      )
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(text);
    const allIds = new Set(prompts.map((p) => p.id));
    setCopiedSet(allIds);
    localStorage.setItem(storageKey, JSON.stringify([...allIds]));
  }, [prompts, storageKey]);

  const downloadMarkdown = useCallback(() => {
    const categories = [...new Set(prompts.map((p) => p.category))];
    const regularPrompts = prompts.filter((p) => !p.is_loop);
    const loopPrompts = prompts.filter((p) => p.is_loop);

    let md = `# LovPlan Prompt Blueprint\n\n`;
    md += `> ${prompts.length} prompts generated for this project\n\n`;
    md += `## Table of Contents\n\n`;
    categories.forEach((cat) => {
      const count = prompts.filter((p) => p.category === cat).length;
      md += `- **${cat}** (${count} prompts)\n`;
    });
    md += `\n---\n\n## Recommended Execution Order\n\nFollow the prompts in sequential order. Each prompt builds on the previous ones.\n\n---\n\n`;

    categories.forEach((cat) => {
      const catPrompts = regularPrompts.filter((p) => p.category === cat);
      if (catPrompts.length === 0) return;
      md += `# ${cat}\n\n`;
      catPrompts.forEach((p) => {
        md += `## ${p.sequence_order}. ${p.title}\n\n`;
        md += `**Purpose:** ${p.purpose}\n\n`;
        md += `\`\`\`\n${p.prompt_text}\n\`\`\`\n\n---\n\n`;
      });
    });

    if (loopPrompts.length > 0) {
      md += `# LOOP PROMPTS (Self-Healing)\n\n`;
      md += `> Run these after completing all main prompts to audit and fix gaps.\n\n`;
      loopPrompts.forEach((p) => {
        md += `## ${p.title}\n\n`;
        md += `**Purpose:** ${p.purpose}\n\n`;
        md += `\`\`\`\n${p.prompt_text}\n\`\`\`\n\n---\n\n`;
      });
    }

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lovplan-prompts-${projectId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [prompts, projectId]);

  return {
    copiedSet,
    copiedCount,
    totalCount,
    allCopied,
    markCopied,
    copyAll,
    downloadMarkdown,
  };
}
