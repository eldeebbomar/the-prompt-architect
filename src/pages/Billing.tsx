import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, ArrowUpRight, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreditStats } from "@/hooks/use-credits";
import { useCreditTransactions } from "@/hooks/use-credit-transactions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";

const typeBadge: Record<string, string> = {
  purchase: "border-secondary/50 text-secondary",
  usage: "border-primary/50 text-primary",
  bonus: "border-[#6B8EBF]/50 text-[#6B8EBF]",
  refund: "border-destructive/50 text-destructive",
};

const Billing = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: stats, isLoading: statsLoading } = useCreditStats();
  const { data: txPages, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: txLoading } =
    useCreditTransactions();
  const [portalLoading, setPortalLoading] = useState(false);

  const isUnlimited = stats?.plan === "unlimited";
  const creditsRemaining = isUnlimited ? null : (stats?.credits_remaining ?? 0);
  const totalPurchased = stats?.total_purchased ?? 0;
  const totalUsed = stats?.total_used ?? 0;
  const progressPct = totalPurchased > 0 ? Math.min((totalUsed / totalPurchased) * 100, 100) : 0;

  const planLabel = (() => {
    const p = stats?.plan ?? profile?.plan ?? "free";
    if (p === "unlimited") return "Unlimited";
    if (p === "5-pack") return "5-Pack";
    if (p === "single") return "Single";
    return "Free";
  })();

  const transactions = txPages?.pages.flat() ?? [];

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch {
      toast.error("Failed to open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-[28px] text-foreground">Credits & Billing</h1>

      {/* Section 1 — Credit Balance */}
      <div className="rounded-card border border-border bg-card p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-muted-foreground" />
              <span className="font-body text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Credits Remaining
              </span>
            </div>
            {statsLoading ? (
              <Skeleton className="h-14 w-24 bg-muted" />
            ) : isUnlimited ? (
              <div className="flex items-center gap-3">
                <span className="font-heading text-[48px] leading-none text-primary">∞</span>
                <span className="inline-flex items-center rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 font-body text-xs font-semibold text-secondary">
                  Unlimited Plan
                </span>
              </div>
            ) : (
              <p className={`font-heading text-[48px] leading-none tabular-nums ${creditsRemaining === 0 ? "text-destructive" : "text-primary"}`}>
                {creditsRemaining}
              </p>
            )}
          </div>
          <Button variant="amber" onClick={() => navigate("/pricing")} className="gap-1.5 shrink-0">
            Buy More Credits <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Progress bar */}
        {!isUnlimited && totalPurchased > 0 && (
          <div className="mt-5">
            <div className="flex justify-between font-body text-[11px] text-muted-foreground mb-1.5">
              <span>{totalUsed} used</span>
              <span>{totalPurchased} purchased</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Section 2 — Current Plan */}
      <div className="rounded-card border border-border bg-card p-7">
        <h2 className="font-heading text-lg text-foreground mb-4">Current Plan</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 font-body text-xs font-semibold ${
                stats?.plan === "free"
                  ? "border-muted-foreground/30 text-muted-foreground"
                  : "border-primary/30 bg-primary/10 text-primary"
              }`}
            >
              {planLabel}
            </span>
            {isUnlimited && (
              <span className="font-body text-xs text-muted-foreground">
                Renews monthly
              </span>
            )}
          </div>
          {isUnlimited ? (
            <Button
              variant="outline"
              className="border-border text-muted-foreground hover:text-foreground gap-1.5"
              onClick={handleManageSubscription}
              disabled={portalLoading}
            >
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage Subscription"}
            </Button>
          ) : (
            <Button variant="amber" onClick={() => navigate("/pricing")} className="gap-1.5">
              Upgrade
            </Button>
          )}
        </div>
      </div>

      {/* Section 3 — Transaction History */}
      <div>
        <h2 className="font-heading text-lg text-foreground mb-4">Transaction History</h2>

        {txLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 rounded-card bg-muted" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-card border border-border bg-card px-6 py-14 text-center">
            <Coins className="mb-4 h-12 w-12 text-primary/50" />
            <h3 className="font-heading text-xl text-foreground">No transactions yet</h3>
            <p className="mt-2 max-w-sm font-body text-sm text-muted-foreground">
              Your purchase and usage history will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-card border border-border">
              <table className="w-full min-w-[500px] text-left">
                <thead>
                  <tr className="bg-[hsl(var(--surface-elevated))]">
                    {["Date", "Type", "Description", "Amount"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 font-body text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, i) => (
                    <tr
                      key={tx.id}
                      className={`border-t border-border ${i % 2 === 0 ? "bg-card" : "bg-[hsl(var(--surface-elevated))]"}`}
                    >
                      <td className="px-4 py-3 font-body text-sm text-muted-foreground">
                        {format(new Date(tx.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 font-body text-[10px] font-medium uppercase tracking-wider ${
                            typeBadge[tx.type] ?? "border-border text-muted-foreground"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-foreground">
                        {tx.description}
                      </td>
                      <td className="px-4 py-3 font-body text-sm tabular-nums">
                        <span className={tx.amount > 0 ? "text-secondary" : "text-primary"}>
                          {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasNextPage && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  className="border-border text-muted-foreground hover:text-foreground"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Billing;
