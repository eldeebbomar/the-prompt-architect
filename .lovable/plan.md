

## Fix: Hero Card Stack Visual Issues

**Problem**: Cards overlap too tightly (32px offset) with rotation causing text from behind cards to bleed through, creating a messy/glitchy appearance.

**Root cause**: The combination of small vertical offset (32px), rotation (1.8deg per card), and transparent backgrounds makes cards visually collide.

**Fix in `src/components/PromptCardStack.tsx`**:

1. **Increase card offset** from 32px to 48px — gives each card breathing room
2. **Reduce rotation** from 1.8deg to 1deg per card — less visual chaos
3. **Invert stacking order** — first card (INFRASTRUCTURE) should be on top (highest z-index), with subsequent cards fanning down behind it
4. **Hide preview text on cards beyond index 0** — only the top card shows description text, reducing text bleed
5. **Update spacer height** to match new offset values
6. **Ensure opaque backgrounds** — cards use solid `hsl(var(--prompt-card))` so text behind doesn't show through

These are all changes within a single file. No new components or dependencies needed.

