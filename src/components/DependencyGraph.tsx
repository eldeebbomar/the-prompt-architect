import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { PromptData } from "@/hooks/use-prompt-export";

const COLUMN_ORDER = [
  "INFRASTRUCTURE",
  "BACKEND",
  "FRONTEND",
  "INTEGRATION",
  "POLISH",
  "LOOP",
];

const COLUMN_COLORS: Record<string, string> = {
  INFRASTRUCTURE: "hsl(38 76% 56%)",
  BACKEND: "hsl(140 16% 55%)",
  FRONTEND: "hsl(214 33% 58%)",
  INTEGRATION: "hsl(263 28% 63%)",
  POLISH: "hsl(30 10% 56%)",
  LOOP: "hsl(38 76% 56%)",
};

const NODE_W = 132;
const NODE_H = 56;
const COL_GAP = 40;
const ROW_GAP = 16;
const HEADER_H = 32;
const PAD_X = 24;
const PAD_Y = 16;

interface NodePos {
  x: number;
  y: number;
  prompt: PromptData;
}

interface DependencyGraphProps {
  prompts: PromptData[];
  selectedPromptId: string | null;
  onSelectPrompt: (id: string) => void;
}

function getHighlightChain(
  promptId: string,
  prompts: PromptData[],
  seqToId: Map<number, string>,
  idToSeq: Map<string, number>
): Set<string> {
  const chain = new Set<string>();
  chain.add(promptId);

  // Upstream (what this prompt depends on)
  const queue = [promptId];
  while (queue.length) {
    const current = queue.pop()!;
    const p = prompts.find((pr) => pr.id === current);
    if (!p?.depends_on) continue;
    for (const seq of p.depends_on) {
      const depId = seqToId.get(seq);
      if (depId && !chain.has(depId)) {
        chain.add(depId);
        queue.push(depId);
      }
    }
  }

  // Downstream (what depends on this prompt)
  const mySeq = idToSeq.get(promptId);
  if (mySeq !== undefined) {
    const downQueue = [mySeq];
    const visited = new Set<number>([mySeq]);
    while (downQueue.length) {
      const currentSeq = downQueue.pop()!;
      for (const p of prompts) {
        if (p.depends_on?.includes(currentSeq)) {
          if (!chain.has(p.id)) {
            chain.add(p.id);
          }
          if (!visited.has(p.sequence_order)) {
            visited.add(p.sequence_order);
            downQueue.push(p.sequence_order);
          }
        }
      }
    }
  }

  return chain;
}

const DependencyGraph = ({
  prompts,
  selectedPromptId,
  onSelectPrompt,
}: DependencyGraphProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Build lookup maps
  const seqToId = useMemo(() => {
    const m = new Map<number, string>();
    prompts.forEach((p) => m.set(p.sequence_order, p.id));
    return m;
  }, [prompts]);

  const idToSeq = useMemo(() => {
    const m = new Map<string, number>();
    prompts.forEach((p) => m.set(p.id, p.sequence_order));
    return m;
  }, [prompts]);

  // Group prompts into columns
  const columns = useMemo(() => {
    const cols: Record<string, PromptData[]> = {};
    COLUMN_ORDER.forEach((c) => (cols[c] = []));
    prompts.forEach((p) => {
      const cat = p.category.toUpperCase();
      if (cols[cat]) cols[cat].push(p);
      else {
        // Fallback
        if (!cols["POLISH"]) cols["POLISH"] = [];
        cols["POLISH"].push(p);
      }
    });
    // Sort each column by sequence_order
    Object.values(cols).forEach((arr) =>
      arr.sort((a, b) => a.sequence_order - b.sequence_order)
    );
    return cols;
  }, [prompts]);

  // Compute node positions
  const { nodes, svgWidth, svgHeight } = useMemo(() => {
    const nodeMap = new Map<string, NodePos>();
    let maxColHeight = 0;

    const activeCols = COLUMN_ORDER.filter(
      (c) => (columns[c]?.length ?? 0) > 0
    );

    activeCols.forEach((col, colIdx) => {
      const items = columns[col] ?? [];
      const x = PAD_X + colIdx * (NODE_W + COL_GAP);
      items.forEach((p, rowIdx) => {
        const y = PAD_Y + HEADER_H + rowIdx * (NODE_H + ROW_GAP);
        nodeMap.set(p.id, { x, y, prompt: p });
        maxColHeight = Math.max(
          maxColHeight,
          y + NODE_H + PAD_Y
        );
      });
    });

    return {
      nodes: nodeMap,
      svgWidth: PAD_X + activeCols.length * (NODE_W + COL_GAP) - COL_GAP + PAD_X,
      svgHeight: maxColHeight,
    };
  }, [columns]);

  // Highlight chain
  const highlightChain = useMemo(() => {
    const id = hoveredId ?? selectedPromptId;
    if (!id) return new Set<string>();
    return getHighlightChain(id, prompts, seqToId, idToSeq);
  }, [hoveredId, selectedPromptId, prompts, seqToId, idToSeq]);

  // Build edges
  const edges = useMemo(() => {
    const result: {
      from: NodePos;
      to: NodePos;
      highlighted: boolean;
    }[] = [];
    prompts.forEach((p) => {
      if (!p.depends_on?.length) return;
      const toNode = nodes.get(p.id);
      if (!toNode) return;
      p.depends_on.forEach((seq) => {
        const depId = seqToId.get(seq);
        if (!depId) return;
        const fromNode = nodes.get(depId);
        if (!fromNode) return;
        const highlighted =
          highlightChain.has(p.id) && highlightChain.has(depId);
        result.push({ from: fromNode, to: toNode, highlighted });
      });
    });
    return result;
  }, [prompts, nodes, seqToId, highlightChain]);

  // Column headers
  const activeCols = COLUMN_ORDER.filter(
    (c) => (columns[c]?.length ?? 0) > 0
  );

  return (
    <div className="flex-1 min-w-0 overflow-auto border-r border-border lg:flex-[1_1_0]">
      {/* Mobile fallback */}
      <div className="flex flex-col items-center justify-center p-8 text-center md:hidden min-h-[200px]">
        <p className="font-body text-sm text-muted-foreground mb-1">
          Dependency graph works best on desktop.
        </p>
        <p className="font-body text-xs text-muted-foreground/60">
          Switch to list view for mobile.
        </p>
      </div>

      {/* Desktop graph */}
      <div
        ref={containerRef}
        className="hidden md:block relative"
        style={{ minWidth: svgWidth, minHeight: svgHeight }}
      >
        {/* SVG edges */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgWidth}
          height={svgHeight}
          style={{ zIndex: 0 }}
        >
          <defs>
            <marker
              id="arrow-default"
              viewBox="0 0 8 6"
              refX="8"
              refY="3"
              markerWidth="8"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,0 L8,3 L0,6 Z" fill="hsl(33 12% 21%)" />
            </marker>
            <marker
              id="arrow-highlight"
              viewBox="0 0 8 6"
              refX="8"
              refY="3"
              markerWidth="8"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,0 L8,3 L0,6 Z" fill="hsl(38 76% 56%)" />
            </marker>
          </defs>
          {edges.map((edge, i) => {
            const x1 = edge.from.x + NODE_W;
            const y1 = edge.from.y + NODE_H / 2;
            const x2 = edge.to.x;
            const y2 = edge.to.y + NODE_H / 2;

            // Bezier curve
            const midX = (x1 + x2) / 2;

            return (
              <path
                key={i}
                d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                fill="none"
                stroke={
                  edge.highlighted
                    ? "hsl(38 76% 56%)"
                    : "hsl(33 12% 21%)"
                }
                strokeWidth={edge.highlighted ? 2 : 1}
                opacity={
                  highlightChain.size > 0
                    ? edge.highlighted
                      ? 1
                      : 0.15
                    : 0.5
                }
                markerEnd={
                  edge.highlighted
                    ? "url(#arrow-highlight)"
                    : "url(#arrow-default)"
                }
                className="transition-all duration-200"
              />
            );
          })}
        </svg>

        {/* Column headers */}
        {activeCols.map((col, colIdx) => {
          const x = PAD_X + colIdx * (NODE_W + COL_GAP);
          return (
            <div
              key={col}
              className="absolute font-body text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60"
              style={{ left: x, top: PAD_Y, width: NODE_W }}
            >
              {col}
            </div>
          );
        })}

        {/* Nodes */}
        {Array.from(nodes.entries()).map(([id, node]) => {
          const isHovered = hoveredId === id;
          const isSelected = selectedPromptId === id;
          const inChain = highlightChain.has(id);
          const cat = node.prompt.category.toUpperCase();
          const borderColor = COLUMN_COLORS[cat] ?? "hsl(33 12% 21%)";

          const dimmed = highlightChain.size > 0 && !inChain;

          return (
            <button
              key={id}
              onClick={() => onSelectPrompt(id)}
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`absolute flex flex-col rounded-lg border bg-card transition-all duration-200 text-left cursor-pointer active:scale-[0.97] ${
                isSelected
                  ? "ring-1 ring-primary shadow-warm"
                  : isHovered
                  ? "shadow-warm"
                  : ""
              }`}
              style={{
                left: node.x,
                top: node.y,
                width: NODE_W,
                height: NODE_H,
                borderColor: inChain || !highlightChain.size
                  ? borderColor
                  : "hsl(33 12% 21%)",
                borderTopWidth: 3,
                opacity: dimmed ? 0.25 : 1,
                zIndex: isHovered || isSelected ? 10 : 1,
              }}
            >
              <div className="flex items-start gap-1.5 px-2.5 pt-2 pb-1 min-w-0">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted/50 font-mono text-[8px] text-muted-foreground">
                  {node.prompt.sequence_order}
                </span>
                <span className="font-body text-[11px] font-medium text-foreground truncate leading-tight">
                  {node.prompt.title}
                </span>
              </div>
              {node.prompt.depends_on && node.prompt.depends_on.length > 0 && (
                <span className="px-2.5 font-body text-[8px] text-muted-foreground/50 truncate">
                  depends on: {node.prompt.depends_on.join(", ")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DependencyGraph;
