import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Factory,
  Loader2,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/domain";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

type Order = {
  id: string;
  order_number: string;
  status: string;
  priority: string;
  product_name: string;
  expected_delivery_date: string | null;
};

type ProductionStage = {
  id: string;
  order_id: string;
  stage: string;
  status: string;
  progress: number | null;
};

type Customer = {
  id: string;
};

function ReportsPage() {
  const { canProduce, canSell } = useAuth();

  const canViewReports = Boolean(canProduce || canSell);

  const {
    data: orders = [],
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ["reports-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          status,
          priority,
          product_name,
          expected_delivery_date
        `,
        )
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return (data ?? []) as Order[];
    },
    enabled: canViewReports,
  });

  const {
    data: stages = [],
    isLoading: stagesLoading,
    error: stagesError,
    refetch: refetchStages,
  } = useQuery({
    queryKey: ["reports-production-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_stages")
        .select(
          `
          id,
          order_id,
          stage,
          status,
          progress
        `,
        );

      if (error) {
        throw error;
      }

      return (data ?? []) as ProductionStage[];
    },
    enabled: canViewReports,
  });

  const {
    data: customers = [],
    isLoading: customersLoading,
    error: customersError,
    refetch: refetchCustomers,
  } = useQuery({
    queryKey: ["reports-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id");

      if (error) {
        throw error;
      }

      return (data ?? []) as Customer[];
    },
    enabled: canViewReports,
  });

  const isLoading =
    ordersLoading || stagesLoading || customersLoading;

  const error =
    ordersError || stagesError || customersError;

  async function refreshReports() {
    try {
      await Promise.all([
        refetchOrders(),
        refetchStages(),
        refetchCustomers(),
      ]);

      toast.success("Reports refreshed");
    } catch (refreshError) {
      toast.error(friendlyError(refreshError));
    }
  }

  if (!canViewReports) {
    return (
      <div className="surface p-8 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" />

        <h2 className="mt-4 text-lg font-semibold">
          Reports access required
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          You do not have permission to view reports.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface p-8 text-center">
        <XCircle className="mx-auto h-10 w-10 text-destructive" />

        <h2 className="mt-4 text-lg font-semibold">
          Unable to load reports
        </h2>

        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {friendlyError(error)}
        </p>

        <Button
          className="mt-5"
          onClick={() => void refreshReports()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  const totalOrders = orders.length;

  const completedOrders = orders.filter(
    (order) =>
      order.status === "completed" ||
      order.status === "delivered",
  ).length;

  const activeOrders = orders.filter(
    (order) =>
      order.status === "in_production" ||
      order.status === "in_progress" ||
      order.status === "processing",
  ).length;

  const pendingOrders = orders.filter(
    (order) =>
      order.status === "pending" ||
      order.status === "confirmed",
  ).length;

  const blockedStages = stages.filter(
    (stage) => stage.status === "blocked",
  ).length;

  const completedStages = stages.filter(
    (stage) => stage.status === "completed",
  ).length;

  const activeStages = stages.filter(
    (stage) => stage.status === "in_progress",
  ).length;

  const averageProductionProgress = stages.length
    ? Math.round(
        stages.reduce(
          (sum, stage) => sum + Number(stage.progress ?? 0),
          0,
        ) / stages.length,
      )
    : 0;

  const completionRate = totalOrders
    ? Math.round((completedOrders / totalOrders) * 100)
    : 0;

  const stageSummary = [
    {
      name: "Fabric Procurement",
      value: "fabric_procurement",
    },
    {
      name: "Cutting",
      value: "cutting",
    },
    {
      name: "Stitching",
      value: "stitching",
    },
    {
      name: "Embroidery / Printing",
      value: "embroidery_printing",
    },
    {
      name: "Packing",
      value: "packing",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />

            <h1 className="text-2xl font-semibold tracking-tight">
              Reports
            </h1>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Overview of orders, customers and production performance.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void refreshReports()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}

          Refresh
        </Button>
      </div>

      {/* Main statistics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportCard
          title="Total Orders"
          value={totalOrders}
          description="All orders in the system"
          icon={<Package className="h-5 w-5" />}
        />

        <ReportCard
          title="Active Orders"
          value={activeOrders}
          description="Orders currently being processed"
          icon={<TrendingUp className="h-5 w-5" />}
        />

        <ReportCard
          title="Completed Orders"
          value={completedOrders}
          description="Orders completed or delivered"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />

        <ReportCard
          title="Customers"
          value={customers.length}
          description="Total registered customers"
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {/* Order and production overview */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold">
                Order Overview
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Current order status distribution.
              </p>
            </div>

            <Package className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="mt-6 space-y-5">
            <ProgressRow
              label="Completed"
              value={completedOrders}
              total={totalOrders}
            />

            <ProgressRow
              label="Active"
              value={activeOrders}
              total={totalOrders}
            />

            <ProgressRow
              label="Pending"
              value={pendingOrders}
              total={totalOrders}
            />
          </div>
        </div>

        <div className="surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold">
                Production Overview
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Overall manufacturing performance.
              </p>
            </div>

            <Factory className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <MiniStat
              label="Active Stages"
              value={activeStages}
              icon={<Clock3 className="h-4 w-4" />}
            />

            <MiniStat
              label="Completed Stages"
              value={completedStages}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />

            <MiniStat
              label="Blocked Stages"
              value={blockedStages}
              icon={<XCircle className="h-4 w-4" />}
              danger={blockedStages > 0}
            />

            <MiniStat
              label="Avg. Progress"
              value={`${averageProductionProgress}%`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="surface p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold">
              Performance
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              High-level performance indicators.
            </p>
          </div>

          <BarChart3 className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <PerformanceMetric
            label="Order Completion Rate"
            value={completionRate}
          />

          <PerformanceMetric
            label="Production Progress"
            value={averageProductionProgress}
          />
        </div>
      </div>

      {/* Production stages */}
      <div className="surface overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">
            Production Stage Report
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Workload and completion across each production stage.
          </p>
        </div>

        {isLoading ? (
          <div className="flex min-h-[250px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />

              <p className="mt-3 text-sm text-muted-foreground">
                Loading report data...
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">
                    Production Stage
                  </th>

                  <th className="px-5 py-3">
                    Total
                  </th>

                  <th className="px-5 py-3">
                    Active
                  </th>

                  <th className="px-5 py-3">
                    Completed
                  </th>

                  <th className="px-5 py-3">
                    Blocked
                  </th>

                  <th className="px-5 py-3">
                    Progress
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {stageSummary.map((stage) => {
                  const rows = stages.filter(
                    (item) => item.stage === stage.value,
                  );

                  const active = rows.filter(
                    (item) => item.status === "in_progress",
                  ).length;

                  const completed = rows.filter(
                    (item) => item.status === "completed",
                  ).length;

                  const blocked = rows.filter(
                    (item) => item.status === "blocked",
                  ).length;

                  const progress = rows.length
                    ? Math.round(
                        rows.reduce(
                          (sum, item) =>
                            sum + Number(item.progress ?? 0),
                          0,
                        ) / rows.length,
                      )
                    : 0;

                  return (
                    <tr
                      key={stage.value}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <td className="px-5 py-4 font-medium">
                        {stage.name}
                      </td>

                      <td className="px-5 py-4">
                        {rows.length}
                      </td>

                      <td className="px-5 py-4">
                        {active}
                      </td>

                      <td className="px-5 py-4">
                        {completed}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            blocked > 0
                              ? "font-semibold text-destructive"
                              : ""
                          }
                        >
                          {blocked}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-[120px] overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${progress}%`,
                              }}
                            />
                          </div>

                          <span className="text-sm font-medium">
                            {progress}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="surface p-5">
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 h-5 w-5 text-primary" />

          <div>
            <h2 className="font-semibold">
              Report Summary
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              The system currently has{" "}
              <span className="font-medium text-foreground">
                {totalOrders}
              </span>{" "}
              total orders, with{" "}
              <span className="font-medium text-foreground">
                {activeOrders}
              </span>{" "}
              active orders and{" "}
              <span className="font-medium text-foreground">
                {completedOrders}
              </span>{" "}
              completed orders.
            </p>

            {blockedStages > 0 ? (
              <p className="mt-2 text-sm text-destructive">
                There are {blockedStages} blocked production{" "}
                {blockedStages === 1 ? "stage" : "stages"} that
                require attention.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                There are currently no blocked production stages.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {value}
          </p>
        </div>

        <div className="rounded-lg bg-muted p-2.5">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
  danger = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}

        <span className="text-xs font-medium">
          {label}
        </span>
      </div>

      <p
        className={
          danger
            ? "mt-2 text-2xl font-semibold text-destructive"
            : "mt-2 text-2xl font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage = total
    ? Math.round((value / total) * 100)
    : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">
          {label}
        </span>

        <span className="text-muted-foreground">
          {value} ({percentage}%)
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

function PerformanceMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">
          {label}
        </span>

        <span className="text-sm font-semibold">
          {value}%
        </span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
          }}
        />
      </div>
    </div>
  );
}