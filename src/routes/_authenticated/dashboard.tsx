import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowUpRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { formatDate, friendlyError, isOverdue, titleize } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type OrderRow = {
  id: string;
  order_number: string;
  batch_number: string | null;
  status: string;
  priority: string;
  product_name: string | null;
  product_category: string | null;
  total_quantity: number;
  order_date: string;
  expected_delivery_date: string | null;
  created_at: string;
  created_by: string | null;
  customers: { customer_name: string } | null;
};

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [orders, stages, alterations, inspections] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, order_number, batch_number, status, priority, product_name, product_category, total_quantity, order_date, expected_delivery_date, created_at, created_by, customers(customer_name)",
          )
          .order("created_at", { ascending: false }),
        supabase.from("production_stages").select("id, order_id, stage, status, progress"),
        supabase.from("alterations").select("id, order_id, status, priority, issue_description"),
        supabase.from("quality_inspections").select("id, order_id, status"),
      ]);
      if (orders.error) throw orders.error;
      if (stages.error) throw stages.error;
      if (alterations.error) throw alterations.error;
      if (inspections.error) throw inspections.error;
      return {
        orders: (orders.data ?? []) as unknown as OrderRow[],
        stages: stages.data ?? [],
        alterations: alterations.data ?? [],
        inspections: inspections.data ?? [],
      };
    },
  });
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "danger" | "accent";
}) {
  return (
    <div className="surface p-4">
      <p className="label-caps">{label}</p>
      <p
        className={
          tone === "danger"
            ? "mt-2 font-display text-3xl font-bold text-destructive"
            : tone === "accent"
              ? "mt-2 font-display text-3xl font-bold text-accent"
              : "mt-2 font-display text-3xl font-bold"
        }
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function DashboardPage() {
  const { profile, role, user, canSell } = useAuth();
  const { data, isLoading, error } = useDashboardData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Loading your workspace…" />
        <CardsSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  if (error) return <ErrorState message={friendlyError(error)} />;

  const orders = data?.orders ?? [];
  const alterations = data?.alterations ?? [];
  const stages = data?.stages ?? [];

  const myOrders = orders.filter((order) => order.created_by === user?.id);
  const scoped = role === "sales" ? myOrders : orders;

  const counts = {
    total: orders.length,
    active: orders.filter(
      (order) => !["completed", "cancelled", "delivered"].includes(order.status),
    ).length,
    inProduction: orders.filter((order) => order.status === "in_production").length,
    qualityPending: orders.filter((order) => order.status === "quality_check").length,
    alterations: alterations.filter((item) => item.status !== "verified").length,
    ready: orders.filter((order) => order.status === "ready_for_delivery").length,
    completed: orders.filter((order) => order.status === "completed").length,
    overdue: orders.filter(isOverdue).length,
  };

  const byStatus = Object.entries(
    orders.reduce<Record<string, number>>((accumulator, order) => {
      accumulator[order.status] = (accumulator[order.status] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).map(([status, count]) => ({ name: titleize(status), count }));

  const byCategory = Object.entries(
  orders.reduce<Record<string, number>>((accumulator, order) => {
    const key = order.product_name?.trim() || "Other Products";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {}),
)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([name, value]) => ({
    name,
    value,
  }));

  const overTime = Object.entries(
    orders.reduce<Record<string, number>>((accumulator, order) => {
      const key = new Date(order.order_date).toLocaleDateString("en-GB", {
        month: "short",
        year: "2-digit",
      });
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).map(([name, orders_count]) => ({ name, orders: orders_count }));

  const blockedStages = stages.filter((stage) => stage.status === "blocked");
  const overdueOrders = orders.filter(isOverdue);
  const upcoming = orders
    .filter(
      (order) =>
        order.expected_delivery_date &&
        !isOverdue(order as never) &&
        !["completed", "cancelled"].includes(order.status),
    )
    .sort((a, b) =>
      (a.expected_delivery_date ?? "").localeCompare(b.expected_delivery_date ?? ""),
    )
    .slice(0, 5);

  const chartColors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${profile?.full_name?.split(" ")[0] ?? "there"}`}
        description={`${titleize(role)} workspace · ${profile?.organization || "Uniform Studio 81"}`}
        actions={
          canSell ? (
            <Button asChild>
              <Link to="/orders/new">
                <Plus className="mr-2 h-4 w-4" /> New order
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {role === "sales" ? (
          <>
            <StatCard label="My orders" value={myOrders.length} />
            <StatCard
              label="Pending confirmation"
              value={myOrders.filter((order) => order.status === "draft").length}
            />
            <StatCard
              label="In production"
              value={myOrders.filter((order) => order.status === "in_production").length}
              tone="accent"
            />
            <StatCard
              label="Overdue"
              value={myOrders.filter(isOverdue).length}
              tone="danger"
              hint="Past expected delivery"
            />
          </>
        ) : role === "production" ? (
          <>
            <StatCard label="Active production" value={counts.inProduction} tone="accent" />
            <StatCard label="Blocked stages" value={blockedStages.length} tone="danger" />
            <StatCard label="Quality pending" value={counts.qualityPending} />
            <StatCard label="Open alterations" value={counts.alterations} />
          </>
        ) : (
          <>
            <StatCard label="Total orders" value={counts.total} />
            <StatCard label="Active orders" value={counts.active} tone="accent" />
            <StatCard label="Quality pending" value={counts.qualityPending} />
            <StatCard label="Overdue" value={counts.overdue} tone="danger" />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="In production" value={counts.inProduction} />
        <StatCard label="Alterations" value={counts.alterations} />
        <StatCard label="Ready for delivery" value={counts.ready} />
        <StatCard label="Completed" value={counts.completed} />
      </div>

      {(overdueOrders.length > 0 || blockedStages.length > 0) && (
        <div className="mt-6 surface border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Attention required</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {overdueOrders.length > 0 ? (
                  <li>{overdueOrders.length} order(s) past their delivery date.</li>
                ) : null}
                {blockedStages.length > 0 ? (
                  <li>{blockedStages.length} production stage(s) blocked.</li>
                ) : null}
                {counts.alterations > 0 ? (
                  <li>{counts.alterations} alteration job(s) still open.</li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="surface p-4 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">Orders by status</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="surface p-4">
          <h2 className="mb-4 text-sm font-semibold">Product mix</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={80} label>
                  {byCategory.map((entry, index) => (
                    <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="surface p-4 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">Orders over time</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Upcoming deliveries</h2>
          {upcoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No deliveries scheduled
            </p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((order) => (
                <li key={order.id}>
                  <Link
                    to="/orders/$orderId"
                    params={{ orderId: order.id }}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/60"
                  >
                    <span>
                      <span className="font-medium">{order.order_number}</span>
                      <span className="block text-xs text-muted-foreground">
                        {order.customers?.customer_name}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(order.expected_delivery_date)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="surface mt-6">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Recent orders</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/orders">
              View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        {scoped.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Create your first sales order to get production moving."
            action={
              canSell ? (
                <Button asChild size="sm">
                  <Link to="/orders/new">New order</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium">Qty</th>
                  <th className="px-4 py-2 font-medium">Delivery</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {scoped.slice(0, 8).map((order) => (
                  <tr key={order.id} className="border-t hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <Link
                        to="/orders/$orderId"
                        params={{ orderId: order.id }}
                        className="font-medium hover:underline"
                      >
                        {order.order_number}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {order.batch_number ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{order.customers?.customer_name ?? "—"}</td>
                    <td className="px-4 py-2.5">{order.product_name ?? "—"}</td>
                    <td className="px-4 py-2.5">{order.total_quantity}</td>
                    <td className="px-4 py-2.5">
                      {formatDate(order.expected_delivery_date)}
                      {isOverdue(order as never) ? (
                        <span className="ml-1 text-xs font-medium text-destructive">overdue</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge value={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
