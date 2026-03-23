import { useEffect, useState } from "react";

const promptCards = [
  {
    category: "INFRASTRUCTURE",
    categoryColor: "hsl(var(--amber))",
    title: "Design System & Layout",
    preview:
      "Create a design system with warm obsidian tokens. Define --background, --card, --primary colors in index.css...",
  },
  {
    category: "BACKEND",
    categoryColor: "hsl(var(--sage))",
    title: "Supabase Schema",
    preview:
      "Create profiles, projects, and conversations tables with proper RLS policies...",
  },
  {
    category: "FRONTEND",
    categoryColor: "hsl(var(--blue-steel))",
    title: "Dashboard Layout",
    preview:
      "Build a responsive dashboard with sidebar navigation and project cards...",
  },
  {
    category: "POLISH",
    categoryColor: "hsl(var(--warm-gray))",
    title: "Animations & Micro-interactions",
    preview:
      "Add scroll-triggered reveals, hover states, and loading skeletons...",
  },
];

const PromptCardStack = () => {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex h-full items-center justify-center">
      {/* Floating amber dots */}
      <div
        className="absolute right-8 top-12 h-2 w-2 rounded-full bg-primary/40 animate-float"
        style={{ animationDelay: "0s" }}
      />
      <div
        className="absolute left-4 top-1/3 h-1.5 w-1.5 rounded-full bg-primary/25 animate-float"
        style={{ animationDelay: "2s" }}
      />
      <div
        className="absolute bottom-16 right-16 h-2.5 w-2.5 rounded-full bg-primary/30 animate-float"
        style={{ animationDelay: "4s" }}
      />

      {/* Card stack — uses negative margins to overlap cards naturally */}
      <div className="flex w-full max-w-[280px] flex-col items-center lg:max-w-[340px]">
        {promptCards.map((card, i) => {
          const isTop = i === 0;
          const marginTop = i === 0 ? 0 : -12;
          const rotate = i % 2 === 0 ? i * 0.8 : i * -0.6;
          const translateX = i % 2 === 0 ? i * 4 : i * -3;

          // Each card gets a unique gentle bob animation
          const bobDuration = 3.5 + i * 0.7;
          const bobDelay = i * 0.4;

          return (
            <div
              key={card.category}
              className="w-full rounded-xl border border-border p-4 lg:p-5"
              style={{
                background: "hsl(var(--prompt-card))",
                boxShadow:
                  "0 2px 12px rgba(15, 14, 12, 0.5), 0 0 0 1px rgba(61, 56, 48, 0.3)",
                marginTop,
                position: "relative",
                zIndex: promptCards.length - i,
                transform: entered
                  ? `rotate(${rotate}deg) translateX(${translateX}px)`
                  : `rotate(${rotate}deg) translateX(${translateX}px) translateY(24px)`,
                opacity: entered ? 1 : 0,
                transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 120}ms, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 120}ms`,
                animation: entered
                  ? `card-bob ${bobDuration}s ease-in-out ${bobDelay + 0.8}s infinite`
                  : "none",
              }}
            >
              <span
                className="mb-2 inline-block rounded-sm px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{
                  color: card.categoryColor,
                  border: `1px solid ${card.categoryColor}`,
                }}
              >
                {card.category}
              </span>
              <h4 className="font-heading text-sm text-foreground lg:text-base">
                {card.title}
              </h4>
              {isTop && (
                <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  {card.preview}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PromptCardStack;
