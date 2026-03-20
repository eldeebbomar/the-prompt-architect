import { useEffect, useState } from "react";

const promptCards = [
  {
    category: "INFRASTRUCTURE",
    categoryColor: "hsl(var(--amber))",
    title: "Design System & Layout",
    preview: 'Create a design system with warm obsidian tokens. Define --background, --card, --primary colors in index.css...',
  },
  {
    category: "BACKEND",
    categoryColor: "hsl(var(--sage))",
    title: "Supabase Schema",
    preview: "Create profiles, projects, and conversations tables with proper RLS policies...",
  },
  {
    category: "FRONTEND",
    categoryColor: "hsl(var(--blue-steel))",
    title: "Dashboard Layout",
    preview: "Build a responsive dashboard with sidebar navigation and project cards...",
  },
  {
    category: "POLISH",
    categoryColor: "hsl(var(--warm-gray))",
    title: "Animations & Micro-interactions",
    preview: "Add scroll-triggered reveals, hover states, and loading skeletons...",
  },
];

const PromptCardStack = () => {
  const [visibleCards, setVisibleCards] = useState<number[]>([]);

  useEffect(() => {
    promptCards.forEach((_, i) => {
      setTimeout(() => {
        setVisibleCards((prev) => [...prev, i]);
      }, i * 150 + 400);
    });
  }, []);

  return (
    <div className="relative flex h-full items-center justify-center">
      {/* Floating amber dots */}
      <div className="absolute right-8 top-12 h-2 w-2 rounded-full bg-primary/40 animate-float" style={{ animationDelay: "0s" }} />
      <div className="absolute left-4 top-1/3 h-1.5 w-1.5 rounded-full bg-primary/25 animate-float" style={{ animationDelay: "2s" }} />
      <div className="absolute bottom-16 right-16 h-2.5 w-2.5 rounded-full bg-primary/30 animate-float" style={{ animationDelay: "4s" }} />
      <div className="absolute left-12 bottom-24 h-1.5 w-1.5 rounded-full bg-primary/20 animate-float" style={{ animationDelay: "1s" }} />

      {/* Card stack */}
      <div className="relative w-full max-w-[260px] sm:max-w-[300px] lg:max-w-[340px]">
        {promptCards.map((card, i) => {
          const offsetY = i * 48;
          const rotate = i * 1;
          const scale = 1 - i * 0.03;
          const zIndex = promptCards.length - i;
          const isVisible = visibleCards.includes(i);

          return (
            <div
              key={card.category}
              className="absolute left-0 right-0 rounded-card border border-border p-5 transition-all duration-500"
              style={{
                background: `hsl(var(--prompt-card))`,
                boxShadow: "inset 0 1px 1px hsl(38 76% 56% / 0.03), 0 4px 24px rgba(15, 14, 12, 0.6)",
                transform: isVisible
                  ? `translateY(${offsetY}px) rotate(${rotate}deg) scale(${scale})`
                  : `translateY(${offsetY + 30}px) rotate(${rotate}deg) scale(${scale})`,
                zIndex,
                opacity: isVisible ? 1 : 0,
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <span
                className="mb-2 inline-block rounded-sm px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{
                  color: card.categoryColor,
                  border: `1px solid ${card.categoryColor}`,
                  background: "transparent",
                }}
              >
                {card.category}
              </span>
              <h4 className="mb-1.5 font-heading text-base text-foreground">{card.title}</h4>
              {i === 0 && (
                <p className="font-mono text-xs leading-relaxed text-muted-foreground line-clamp-2">
                  {card.preview}
                </p>
              )}
            </div>
          );
        })}
        {/* Spacer for container height */}
        <div style={{ height: `${(promptCards.length - 1) * 48 + 140}px` }} />
      </div>
    </div>
  );
};

export default PromptCardStack;
