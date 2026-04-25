import { describe, expect, it } from "vitest";
import { deriveDeployProgress } from "../use-deploy-progress";

describe("deriveDeployProgress", () => {
  it("returns an idle state when metadata has no deploy fields", () => {
    const r = deriveDeployProgress(null, 50);
    expect(r.hasProgress).toBe(false);
    expect(r.isActive).toBe(false);
    expect(r.isErrored).toBe(false);
    expect(r.isCompleted).toBe(false);
    expect(r.deployedCount).toBe(0);
    expect(r.totalCount).toBe(50);
    expect(r.percent).toBe(0);
  });

  it("derives 'paused at 40 of 50' from a paused-mid-deploy metadata", () => {
    const r = deriveDeployProgress(
      {
        last_deployed_index: 39,
        total_prompts: 50,
        paused: true,
        last_progress_at: new Date().toISOString(),
      },
      50,
    );
    expect(r.hasProgress).toBe(true);
    expect(r.isActive).toBe(false);
    expect(r.isPaused).toBe(true);
    expect(r.deployedCount).toBe(40);
    expect(r.totalCount).toBe(50);
    expect(r.percent).toBe(80);
  });

  it("treats progress older than 5 minutes as inactive", () => {
    const longAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const r = deriveDeployProgress(
      { last_deployed_index: 10, total_prompts: 50, paused: false, last_progress_at: longAgo },
      50,
    );
    expect(r.hasProgress).toBe(true);
    expect(r.isActive).toBe(false);
  });

  it("treats progress within the last 5 minutes as active", () => {
    const recent = new Date(Date.now() - 30_000).toISOString();
    const r = deriveDeployProgress(
      { last_deployed_index: 10, total_prompts: 50, paused: false, last_progress_at: recent },
      50,
    );
    expect(r.isActive).toBe(true);
    expect(r.deployedCount).toBe(11);
  });

  it("flags errored deploys with the message and last index", () => {
    const r = deriveDeployProgress(
      {
        last_deployed_index: 39,
        total_prompts: 50,
        deploy_error: "Lovable tab was closed before the deploy finished.",
        deploy_error_at: new Date().toISOString(),
        last_progress_at: new Date().toISOString(),
      },
      50,
    );
    expect(r.isErrored).toBe(true);
    expect(r.isActive).toBe(false);
    expect(r.errorMessage).toContain("Lovable tab was closed");
    expect(r.deployedCount).toBe(40);
  });

  it("treats deployed_at as fully completed", () => {
    const r = deriveDeployProgress(
      {
        deployed_at: new Date().toISOString(),
        deployed_via: "chrome_extension",
        deployed_prompt_count: 50,
      },
      50,
    );
    expect(r.isCompleted).toBe(true);
    expect(r.hasProgress).toBe(false); // hidden once completed
    expect(r.percent).toBe(100);
    expect(r.deployedCount).toBe(50);
  });

  it("falls back to fallbackTotal when total_prompts is missing", () => {
    const r = deriveDeployProgress(
      { last_deployed_index: 4, last_progress_at: new Date().toISOString() },
      20,
    );
    expect(r.totalCount).toBe(20);
    expect(r.deployedCount).toBe(5);
    expect(r.percent).toBe(25);
  });

  it("clamps percent to 100 even if extension reports past total", () => {
    const r = deriveDeployProgress(
      {
        last_deployed_index: 75,
        total_prompts: 50,
        last_progress_at: new Date().toISOString(),
      },
      50,
    );
    expect(r.percent).toBe(100);
  });

  it("ignores array metadata gracefully", () => {
    // Json typing allows arrays at the top level — guard against it.
    const r = deriveDeployProgress([1, 2, 3] as unknown as never, 10);
    expect(r.hasProgress).toBe(false);
    expect(r.totalCount).toBe(10);
  });
});
