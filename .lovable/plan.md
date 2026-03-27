

## Goal
Fix the blank published site by ensuring the production build succeeds and serves the full app.

## Diagnosis
- Both `lovplan.com` and `blueprint-prompt-builder.lovable.app` serve an empty HTML shell: `<div id="root"></div>` with no script tags, no head content
- The preview works perfectly, so the source code is valid
- This indicates the production build artifact is empty or the publish pipeline failed silently

## Root Cause (likely)
The `manualChunks` configuration in `vite.config.ts` can cause production builds to fail if any referenced package isn't resolvable at build time. The Lovable publish pipeline may swallow this error and deploy the fallback HTML.

## Fix

### Step 1: Simplify vite.config.ts build config
Remove the `manualChunks` configuration that may be causing the production build to fail silently:

```typescript
// Remove the rollupOptions.output.manualChunks block entirely
build: {
  sourcemap: mode === "production" ? "hidden" : true,
},
```

### Step 2: Republish
After the change, republish the project to trigger a fresh build.

## Why this works
- `manualChunks` requires all listed packages to be resolvable during the Rollup bundling phase
- If any package (e.g., a specific Radix UI component) has a different import path or isn't installed, the build fails
- Removing it lets Vite handle code splitting automatically, which is sufficient for this app size

## Files changed
- `vite.config.ts` — remove `rollupOptions` block

