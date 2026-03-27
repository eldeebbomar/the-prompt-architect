import { useQuery } from "@tanstack/react-query";
import { Users, FolderOpen, FileText, CreditCard, GitBranch, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import SEO from "@/components/SEO";

const CHART_COLORS = ["hsl(39, 90%, 55%)", "hsl(150, 30%, 50%)", "hsl(220, 40%, 55%)", "hsl(280, 40%, 60%)", "hsl(0, 60%, 55%)"];

const Admin = () => {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_stats", {
        p_user_id: user!.id,
      });
      if (error) throw error;
      if (data?.error === "forbidden") throw new Error("Forbidden");
      return data as {
        total_users: number;
        total_projects: number;
        total_prompts: number;
        completed_projects: number;
        generating_projects: number;
        discovery_projects: number;
        total_purchases: number;
        total_referrals: number;
        daily_signups: { day: string; count: number }[];
        daily_projects: { day: string; count: number }[];
        daily_revenue: { day: string; count: number; credits: number }[];
        plan_distribution: { plan: string; count: number }[];
      };
    },
    enabled: !!user,
  });

  const conversionRate = stats
    ? stats.total_projects > 0
      ? ((stats.completed_projects / stats.total_projects) * 100).toFixed(1)
      : "0"
    : "—";

  return (
    <div className="space-y-8">
      <SEO title="Admin Dashboard" />
      <div>
        <h1 className="font-heading text-[28px] text-foreground">Admin Dashboard</h1>
        <p className="mt-1.5 font-body text-sm text-muted-foreground">
          Platform metrics and overview
        </p>
      </div>

      {/* Top-level stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Users", value: stats?.total_users, icon: Users },
          { label: "Total Projects", value: stats?.total_projects, icon: FolderOpen },
          { label: "Total Prompts", value: stats?.total_prompts, icon: FileText },
          { label: "Total Purchases", value: stats?.total_purchases, icon: CreditCard },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-card border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-body text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {label}
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="font-heading text-3xl tabular-nums text-foreground">
                {value?.toLocaleString() ?? 0}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Secondary stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="font-body text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Completion Rate
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-9 w-20" />
          ) : (
            <p className="font-heading text-3xl tabular-nums text-primary">{conversionRate}%</p>
          )}
          <p className="mt-1 font-body text-xs text-muted-foreground">
            projects reaching ready/completed
          </p>
        </div>
        <div className="rounded-card border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="font-body text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Total Referrals
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <p className="font-heading text-3xl tabular-nums text-foreground">
              {stats?.total_referrals ?? 0}
            </p>
          )}
        </div>
        <div className="rounded-card border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="font-body text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              In Progress
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <div className="flex items-baseline gap-3">
              <span className="font-heading text-3xl tabular-nums text-foreground">
                {stats?.generating_projects ?? 0}
              </span>
              <span className="font-body text-xs text-muted-foreground">generating</span>
              <span className="font-heading text-3xl tabular-nums text-foreground">
                {stats?.discovery_projects ?? 0}
              </span>
              <span className="font-body text-xs text-muted-foreground">discovery</span>
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily signups chart */}
        <div className="rounded-card border border-border bg-card p-5">
          <h3 className="mb-4 font-heading text-base text-foreground">Daily Signups (30d)</h3>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats?.daily_signups ?? []}>
                <defs>
                  <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(39, 90%, 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(39, 90%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => new Date(v).toLocaleDateString()}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(39, 90%, 55%)"
                  fill="url(#signupFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Daily projects chart */}
        <div className="rounded-card border border-border bg-card p-5">
          <h3 className="mb-4 font-heading text-base text-foreground">Daily Projects (30d)</h3>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.daily_projects ?? []}>
                <XAxis
                  dataKey="day"
                  tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => new Date(v).toLocaleDateString()}
                />
                <Bar dataKey="count" fill="hsl(150, 30%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Daily revenue chart */}
        <div className="rounded-card border border-border bg-card p-5">
          <h3 className="mb-4 font-heading text-base text-foreground">Daily Purchases (30d)</h3>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.daily_revenue ?? []}>
                <XAxis
                  dataKey="day"
                  tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => new Date(v).toLocaleDateString()}
                />
                <Bar dataKey="credits" fill="hsl(220, 40%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Plan distribution pie chart */}
        <div className="rounded-card border border-border bg-card p-5">
          <h3 className="mb-4 font-heading text-base text-foreground">Plan Distribution</h3>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={stats?.plan_distribution ?? []}
                    dataKey="count"
                    nameKey="plan"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                  >
                    {(stats?.plan_distribution ?? []).map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {(stats?.plan_distribution ?? []).map((item, idx) => (
                  <div key={item.plan} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                    <span className="font-body text-xs text-foreground capitalize">{item.plan}</span>
                    <span className="font-mono text-xs text-muted-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
