import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Factory,
  Filter,
  Loader2,
  Package,
  RefreshCw,
  Search,
  User,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { friendlyError, formatDate, titleize } from "@/lib/domain";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/production")({
  component: ProductionPage,
});

type ProductionStage = {
  id: string;
  order_id: string;
  stage:
    | "fabric_procurement"
    | "cutting"
    | "stitching"
    | "embroidery_printing"
    | "packing";
  status: "not_started" | "in_progress" | "completed" | "blocked";
  progress: number | null;
  assigned_to: string | null;
  started_date: string | null;
  completed_date: string | null;
  notes: string | null;
  issues: string | null;
  created_at: string | null;
};

type ProductionOrder = {
  id: string;
  order_number: string;
  batch_number: string | null;
  status: string;
  priority: string;
  product_name: string;
  expected_delivery_date: string | null;
  customer: {
    customer_name: string;
    organization: string | null;
  } | null;
};

type OrderWithCustomer = {
  id: string;
  order_number: string;
  batch_number: string | null;
  status: string;
  priority: string;
  product_name: string;
  expected_delivery_date: string | null;
  customers:
    | {
        customer_name: string;
        organization: string | null;
      }
    | {
        customer_name: string;
        organization: string | null;
      }[]
    | null;
};

type StageFilter =
  | "all"
  | "fabric_procurement"
  | "cutting"
  | "stitching"
  | "embroidery_printing"
  | "packing";

type StatusFilter = "all" | "not_started" | "in_progress" | "completed" | "blocked";

const STAGES: Array<{
  value: StageFilter;
  label: string;
}> = [
  { value: "all", label: "All stages" },
  { value: "fabric_procurement", label: "Fabric Procurement" },
  { value: "cutting", label: "Cutting" },
  { value: "stitching", label: "Stitching" },
  { value: "embroidery_printing", label: "Embroidery / Printing" },
  { value: "packing", label: "Packing" },
];

const STATUSES: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
];

function getStageLabel(stage: string) {
  return titleize(stage.replaceAll("_", " "));
}

function getStatusLabel(status: string) {
  return titleize(status.replaceAll("_", " "));
}

function getProgress(stages: ProductionStage[]) {
  if (!stages.length) return 0;

  return Math.round(
    stages.reduce((sum, stage) => sum + Number(stage.progress ?? 0), 0) /
      stages.length,
  );
}

function getCurrentStage(stages: ProductionStage[]) {
  const active = stages.find((stage) => stage.status === "in_progress");

  if (active) return active.stage;

  const blocked = stages.find((stage) => stage.status === "blocked");

  if (blocked) return blocked.stage;

  const next = stages.find((stage) => stage.status === "not_started");

  if (next) return next.stage;

  const completed = stages[stages.length - 1];

  return completed?.stage ?? null;
}

function getCustomer(
  customer:
    | {
        customer_name: string;
        organization: string | null;
      }
    | {
        customer_name: string;
        organization: string | null;
    }[]
    | null,
) {
  if (Array.isArray(customer)) {
    return customer[0] ?? null;
  }

  return customer;
}

function ProductionPage() {
  const { canProduce, canSell } = useAuth();

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const canViewProduction = Boolean(canProduce || canSell);

  const {
    data: orders = [],
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ["production-dashboard-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          batch_number,
          status,
          priority,
          product_name,
          expected_delivery_date,
          customers (
            customer_name,
            organization
          )
        `,
        )
        .order("expected_delivery_date", {
          ascending: true,
          nullsFirst: false,
        });

      if (error) throw error;

      return (data ?? []) as unknown as OrderWithCustomer[];
    },
    enabled: canViewProduction,
  });

  const orderIds = useMemo(
    () => orders.map((order) => order.id),
    [orders],
  );

  const {
    data: stages = [],
    isLoading: stagesLoading,
    error: stagesError,
    refetch: refetchStages,
  } = useQuery({
    queryKey: ["production-dashboard-stages", orderIds],
    queryFn: async () => {
      if (!orderIds.length) {
        return [] as ProductionStage[];
      }

      const { data, error } = await supabase
        .from("production_stages")
        .select(
          `
          id,
          order_id,
          stage,
          status,
          progress,
          assigned_to,
          started_date,
          completed_date,
          notes,
          issues,
          created_at
        `,
        )
        .in("order_id", orderIds)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data ?? []) as ProductionStage[];
    },
    enabled: canViewProduction && orderIds.length > 0,
  });

  const stagesByOrder = useMemo(() => {
    const map = new Map<string, ProductionStage[]>();

    for (const stage of stages) {
      const existing = map.get(stage.order_id) ?? [];
      existing.push(stage);
      map.set(stage.order_id, existing);
    }

    return map;
  }, [stages]);

  const productionOrders = useMemo<ProductionOrder[]>(() => {
    return orders.map((order) => {
      const customer = getCustomer(order.customers);
      const orderStages = stagesByOrder.get(order.id) ?? [];

      return {
        id: order.id,
        order_number: order.order_number,
        batch_number: order.batch_number,
        status: order.status,
        priority: order.priority,
        product_name: order.product_name,
        expected_delivery_date: order.expected_delivery_date,
        customer,
      };
    });
  }, [orders, stagesByOrder]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return productionOrders.filter((order) => {
      const orderStages = stagesByOrder.get(order.id) ?? [];

      const matchesSearch =
        !query ||
        order.order_number.toLowerCase().includes(query) ||
        order.product_name.toLowerCase().includes(query) ||
        order.batch_number?.toLowerCase().includes(query) ||
        order.customer?.customer_name.toLowerCase().includes(query) ||
        order.customer?.organization?.toLowerCase().includes(query);

      const matchesStage =
        stageFilter === "all" ||
        orderStages.some((stage) => stage.stage === stageFilter);

      const matchesStatus =
        statusFilter === "all" ||
        orderStages.some((stage) => stage.status === statusFilter);

      return matchesSearch && matchesStage && matchesStatus;
    });
  }, [
    productionOrders,
    search,
    stageFilter,
    statusFilter,
    stagesByOrder,
  ]);

  const stats = useMemo(() => {
    const allStages = stages;

    return {
      activeOrders: productionOrders.filter(
        (order) =>
          order.status === "in_production" ||
          (stagesByOrder.get(order.id) ?? []).some(
            (stage) => stage.status === "in_progress",
          ),
      ).length,

      inProgress: allStages.filter(
        (stage) => stage.status === "in_progress",
      ).length,

      completed: allStages.filter(
        (stage) => stage.status === "completed",
      ).length,

      blocked: allStages.filter((stage) => stage.status === "blocked").length,
    };
  }, [productionOrders, stages, stagesByOrder]);

  async function refresh() {
    try {
      await Promise.all([refetchOrders(), refetchStages()]);
      toast.success("Production data refreshed");
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  if (!canViewProduction) {
    return (
      <div className="surface p-8 text-center">
        <Factory className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">Production access required</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You do not have permission to view production operations.
        </p>
      </div>
    );
  }

  if (ordersError || stagesError) {
    return (
      <div className="surface p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-4 text-lg font-semibold">
          Unable to load production data
        </h2>

        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {friendlyError(ordersError ?? stagesError)}
        </p>

        <Button className="mt-5" onClick={() => void refresh()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Factory className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Production
            </h1>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Track manufacturing progress, production stages and blockers.
          </p>
        </div>

        <Button variant="outline" onClick={() => void refresh()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Orders"
          value={stats.activeOrders}
          icon={<Package className="h-5 w-5" />}
          description="Orders currently in production"
        />

        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={<Clock3 className="h-5 w-5" />}
          description="Production stages underway"
        />

        <StatCard
          title="Completed"
          value={stats.completed}
          icon={<CheckCircle2 className="h-5 w-5" />}
          description="Completed production stages"
        />

        <StatCard
          title="Blocked"
          value={stats.blocked}
          icon={<XCircle className="h-5 w-5" />}
          description="Stages requiring attention"
          danger={stats.blocked > 0}
        />
      </div>

      {/* Filters */}
      <div className="surface p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order number, customer or product..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <select
                value={stageFilter}
                onChange={(event) =>
                  setStageFilter(event.target.value as StageFilter)
                }
                className="h-10 w-full min-w-[190px] rounded-md border bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="h-10 w-full min-w-[170px] rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Production table */}
      <div className="surface overflow-hidden">
        <div className="border-b px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Production Orders</h2>
              <p className="text-sm text-muted-foreground">
                {filteredOrders.length}{" "}
                {filteredOrders.length === 1 ? "order" : "orders"} shown
              </p>
            </div>

            {ordersLoading || stagesLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>

        {ordersLoading || stagesLoading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">
                Loading production data...
              </p>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center px-6 text-center">
            <div>
              <Package className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 font-medium">No production orders found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try changing your search or filters.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Current Stage</th>
                  <th className="px-5 py-3">Progress</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Delivery</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredOrders.map((order) => {
                  const orderStages = stagesByOrder.get(order.id) ?? [];
                  const progress = getProgress(orderStages);
                  const currentStage = getCurrentStage(orderStages);

                  const activeStage =
                    orderStages.find(
                      (stage) =>
                        stage.status === "in_progress" ||
                        stage.status === "blocked",
                    ) ?? orderStages[orderStages.length - 1];

                  const currentStatus =
                    activeStage?.status ?? order.status ?? "not_started";

                  return (
                    <tr
                      key={order.id}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <td className="px-5 py-4">
                        <Link
                          to="/orders/$orderId"
                          params={{ orderId: order.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {order.order_number}
                        </Link>

                        {order.batch_number ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Batch: {order.batch_number}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />

                          <div>
                            <p className="font-medium">
                              {order.customer?.customer_name ?? "Unknown customer"}
                            </p>

                            {order.customer?.organization ? (
                              <p className="text-xs text-muted-foreground">
                                {order.customer.organization}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {currentStage ? (
                          <div>
                            <p className="font-medium">
                              {getStageLabel(currentStage)}
                            </p>

                            {activeStage?.assigned_to ? (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Assigned: {activeStage.assigned_to}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Not started
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="w-[150px]">
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Progress
                            </span>
                            <span className="font-medium">{progress}%</span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(100, progress),
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge value={currentStatus} />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          {order.expected_delivery_date
                            ? formatDate(order.expected_delivery_date)
                            : "Not set"}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            to="/orders/$orderId"
                            params={{ orderId: order.id }}
                          >
                            View
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stage overview */}
      <div className="surface overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Production Stage Overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Current workload across the manufacturing pipeline.
          </p>
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-5">
          {STAGES.slice(1).map((stage) => {
            const stageRows = stages.filter(
              (item) => item.stage === stage.value,
            );

            const inProgress = stageRows.filter(
              (item) => item.status === "in_progress",
            ).length;

            const completed = stageRows.filter(
              (item) => item.status === "completed",
            ).length;

            const blocked = stageRows.filter(
              (item) => item.status === "blocked",
            ).length;

            const averageProgress = stageRows.length
              ? Math.round(
                  stageRows.reduce(
                    (sum, item) => sum + Number(item.progress ?? 0),
                    0,
                  ) / stageRows.length,
                )
              : 0;

            return (
              <div key={stage.value} className="bg-background p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{stage.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {stageRows.length}{" "}
                      {stageRows.length === 1 ? "task" : "tasks"}
                    </p>
                  </div>

                  <Factory className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Average progress
                    </span>
                    <span className="font-medium">{averageProgress}%</span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${averageProgress}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="font-semibold">{inProgress}</p>
                    <p className="mt-0.5 text-muted-foreground">Active</p>
                  </div>

                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="font-semibold">{completed}</p>
                    <p className="mt-0.5 text-muted-foreground">Done</p>
                  </div>

                  <div className="rounded-md bg-muted/50 p-2">
                    <p className={blocked > 0 ? "font-semibold text-destructive" : "font-semibold"}>
                      {blocked}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">Blocked</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
  danger = false,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  description: string;
  danger?: boolean;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p
            className={
              danger
                ? "mt-2 text-3xl font-semibold text-destructive"
                : "mt-2 text-3xl font-semibold"
            }
          >
            {value}
          </p>
        </div>

        <div className="rounded-lg bg-muted p-2.5">{icon}</div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}