/** Infer repeat count from loop prompt title/purpose */
export function getRepeatCount(title: string, purpose: string): number {
  const text = (title + " " + purpose).toLowerCase();
  if (text.includes("repeat 3") || text.includes("3x")) return 3;
  if (text.includes("repeat 1") || text.includes("1x")) return 1;
  return 2; // default
}

/** Infer audit area tag from loop prompt title */
export function getAuditTag(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("ui") || t.includes("empty state") || t.includes("responsive")) return "UI Audit";
  if (t.includes("auth") || t.includes("permission") || t.includes("guard")) return "Auth Audit";
  if (t.includes("data") || t.includes("database") || t.includes("integrity")) return "Data Audit";
  if (t.includes("perf") || t.includes("loading") || t.includes("optimization")) return "Performance Audit";
  if (t.includes("error") || t.includes("edge case")) return "Error Handling";
  return "General Audit";
}
