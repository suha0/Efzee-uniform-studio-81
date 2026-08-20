import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Filter,
  Loader2,
  Package,
  RefreshCw,
  Search,
  User,
  Wrench,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { friendlyError, formatDate, titleize } from "@/lib/domain";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quality")({
  component: QualityPage,
});

type QualityStatus =
  | "pending_inspection"
  | "passed"
  | "failed"
  | "alteration_required"
  | "ready_for_delivery"
  | "delivered"
  | "completed";

type QualityInspection = {
  id: string;
  order_id: string;
  inspection_date: string;
  inspector_id: string | null;
  quantity_inspected: number;
  quantity_passed: number;
  quantity_failed: number;
  defect_count: number;
  client_feedback: string | null;
  quality_notes: string | null;
  status: QualityStatus;
  created_at: string;
  updated_at: string;
};

type AlterationStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "verified";

type Alteration = {
  id: string;
  order_id: string;
  issue_description: string;
  affected_quantity: number;
  correction_required: string | null;
  assigned_to: string | null;
  priority: string;
  status: AlterationStatus;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  batch_number: string | null;
  status: string;
  priority: string;
  product_name: string;
  total_quantity: number;
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

type QualityOrder = {
  id: string;
  order_number: string;
  batch_number: string | null;
  status: string;
  priority: string;
  product_name: string;
  total_quantity: number;
  expected_delivery_date: string | null;
  customer: {
    customer_name: string;
    organization: string | null;
  } | null;
  inspection: QualityInspection | null;
  alterations: Alteration[];
};

type StatusFilter = "all" | QualityStatus;

const STATUS_OPTIONS: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "pending_inspection", label: "Pending Inspection" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "alteration_required", label: "Alteration Required" },
  { value: "ready_for_delivery", label: "Ready for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
];

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

function getStatusLabel(status: string) {
  return titleize(status.replaceAll("_", " "));
}

function getInspectionRate(inspection: QualityInspection | null) {
  if (!inspection || inspection.quantity_inspected <= 0) {
    return 0;
  }

  return Math.round(
    (inspection.quantity_passed / inspection.quantity_inspected) * 100,
  );
}

function QualityPage() {
  const { canProduce, canSell } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const canViewQuality = Boolean(canProduce || canSell);

  const {
    data: orders = [],
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ["quality-dashboard-orders"],
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
          total_quantity,
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

      return (data ?? []) as unknown as OrderRow[];
    },
    enabled: canViewQuality,
  });

  const orderIds = useMemo(
    () => orders.map((order) => order.id),
    [orders],
  );

  const {
    data: inspections = [],
    isLoading: inspectionsLoading,
    error: inspectionsError,
    refetch: refetchInspections,
  } = useQuery({
    queryKey: ["quality-dashboard-inspections", orderIds],
    queryFn: async () => {
      if (!orderIds.length) {
        return [] as QualityInspection[];
      }

      const { data, error } = await supabase
        .from("quality_inspections")
        .select(
          `
          id,
          order_id,
          inspection_date,
          inspector_id,
          quantity_inspected,
          quantity_passed,
          quantity_failed,
          defect_count,
          client_feedback,
          quality_notes,
          status,
          created_at,
          updated_at
        `,
        )
        .in("order_id", orderIds)
        .order("inspection_date", {
          ascending: false,
        });

      if (error) throw error;

      return (data ?? []) as QualityInspection[];
    },
    enabled: canViewQuality && orderIds.length > 0,
  });

  const {
    data: alterations = [],
    isLoading: alterationsLoading,
    error: alterationsError,
    refetch: refetchAlterations,
  } = useQuery({
    queryKey: ["quality-dashboard-alterations", orderIds],
    queryFn: async () => {
      if (!orderIds.length) {
        return [] as Alteration[];
      }

      const { data, error } = await supabase
        .from("alterations")
        .select(
          `
          id,
          order_id,
          issue_description,
          affected_quantity,
          correction_required,
          assigned_to,
          priority,
          status,
          notes,
          created_at,
          completed_at,
          updated_at
        `,
        )
        .in("order_id", orderIds)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return (data ?? []) as Alteration[];
    },
    enabled: canViewQuality && orderIds.length > 0,
  });

  const latestInspectionByOrder = useMemo(() => {
    const map = new Map<string, QualityInspection>();

    for (const inspection of inspections) {
      if (!map.has(inspection.order_id)) {
        map.set(inspection.order_id, inspection);
      }
    }

    return map;
  }, [inspections]);

  const alterationsByOrder = useMemo(() => {
    const map = new Map<string, Alteration[]>();

    for (const alteration of alterations) {
      const existing = map.get(alteration.order_id) ?? [];
      existing.push(alteration);
      map.set(alteration.order_id, existing);
    }

    return map;
  }, [alterations]);

  const qualityOrders = useMemo<QualityOrder[]>(() => {
    return orders.map((order) => ({
      id: order.id,
      order_number: order.order_number,
      batch_number: order.batch_number,
      status: order.status,
      priority: order.priority,
      product_name: order.product_name,
      total_quantity: order.total_quantity,
      expected_delivery_date: order.expected_delivery_date,
      customer: getCustomer(order.customers),
      inspection: latestInspectionByOrder.get(order.id) ?? null,
      alterations: alterationsByOrder.get(order.id) ?? [],
    }));
  }, [
    orders,
    latestInspectionByOrder,
    alterationsByOrder,
  ]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return qualityOrders.filter((order) => {
      const inspectionStatus =
        order.inspection?.status ?? "pending_inspection";

      const matchesSearch =
        !query ||
        order.order_number.toLowerCase().includes(query) ||
        order.product_name.toLowerCase().includes(query) ||
        order.batch_number?.toLowerCase().includes(query) ||
        order.customer?.customer_name
          .toLowerCase()
          .includes(query) ||
        order.customer?.organization
          ?.toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        inspectionStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [qualityOrders, search, statusFilter]);

  const stats = useMemo(() => {
    const pending = qualityOrders.filter(
      (order) =>
        !order.inspection ||
        order.inspection.status === "pending_inspection",
    ).length;

    const passed = qualityOrders.filter(
      (order) => order.inspection?.status === "passed",
    ).length;

    const failed = qualityOrders.filter(
      (order) =>
        order.inspection?.status === "failed" ||
        order.inspection?.status === "alteration_required",
    ).length;

    const openAlterations = alterations.filter(
      (alteration) =>
        alteration.status === "open" ||
        alteration.status === "in_progress",
    ).length;

    return {
      pending,
      passed,
      failed,
      openAlterations,
    };
  }, [qualityOrders, alterations]);

  async function refresh() {
    try {
      await Promise.all([
        refetchOrders(),
        refetchInspections(),
        refetchAlterations(),
      ]);

      toast.success("Quality data refreshed");
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  if (!canViewQuality) {
    return (
      <div className="surface p-8 text-center">
        <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground" />

        <h2 className="mt-4 text-lg font-semibold">
          Quality access required
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          You do not have permission to view quality operations.
        </p>
      </div>
    );
  }

  const pageError =
    ordersError || inspectionsError || alterationsError;

  if (pageError) {
    return (
      <div className="surface p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />

        <h2 className="mt-4 text-lg font-semibold">
          Unable to load quality data
        </h2>

        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {friendlyError(
            ordersError ?? inspectionsError ?? alterationsError,
          )}
        </p>

        <Button
          className="mt-5"
          onClick={() => void refresh()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  const loading =
    ordersLoading ||
    inspectionsLoading ||
    alterationsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />

            <h1 className="text-2xl font-semibold tracking-tight">
              Quality
            </h1>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Monitor inspections, defects, quality results and
            alterations.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void refresh()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pending Inspection"
          value={stats.pending}
          icon={<Clock3 className="h-5 w-5" />}
          description="Orders waiting for quality inspection"
        />

        <StatCard
          title="Passed"
          value={stats.passed}
          icon={<CheckCircle2 className="h-5 w-5" />}
          description="Orders that passed inspection"
        />

        <StatCard
          title="Failed / Correction"
          value={stats.failed}
          icon={<XCircle className="h-5 w-5" />}
          description="Orders requiring quality attention"
          danger={stats.failed > 0}
        />

        <StatCard
          title="Open Alterations"
          value={stats.openAlterations}
          icon={<Wrench className="h-5 w-5" />}
          description="Alterations currently being handled"
          danger={stats.openAlterations > 0}
        />
      </div>

      {/* Filters */}
      <div className="surface p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search order number, customer or product..."
              className="pl-9"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as StatusFilter,
                )
              }
              className="h-10 w-full min-w-[210px] rounded-md border bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {STATUS_OPTIONS.map((status) => (
                <option
                  key={status.value}
                  value={status.value}
                >
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quality orders */}
      <div className="surface overflow-hidden">
        <div className="border-b px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">
                Quality Inspections
              </h2>

              <p className="text-sm text-muted-foreground">
                {filteredOrders.length}{" "}
                {filteredOrders.length === 1
                  ? "order"
                  : "orders"}{" "}
                shown
              </p>
            </div>

            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />

              <p className="mt-3 text-sm text-muted-foreground">
                Loading quality data...
              </p>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center px-6 text-center">
            <div>
              <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground" />

              <h3 className="mt-3 font-medium">
                No quality records found
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Try changing your search or status filter.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px]">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">
                    Order
                  </th>

                  <th className="px-5 py-3">
                    Customer
                  </th>

                  <th className="px-5 py-3">
                    Inspection
                  </th>

                  <th className="px-5 py-3">
                    Pass Rate
                  </th>

                  <th className="px-5 py-3">
                    Defects
                  </th>

                  <th className="px-5 py-3">
                    Alterations
                  </th>

                  <th className="px-5 py-3">
                    Status
                  </th>

                  <th className="px-5 py-3">
                    Delivery
                  </th>

                  <th className="px-5 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredOrders.map((order) => {
                  const inspection = order.inspection;

                  const passRate =
                    getInspectionRate(inspection);

                  const inspectionStatus =
                    inspection?.status ??
                    "pending_inspection";

                  const activeAlterations =
                    order.alterations.filter(
                      (alteration) =>
                        alteration.status === "open" ||
                        alteration.status === "in_progress",
                    ).length;

                  return (
                    <tr
                      key={order.id}
                      className="transition-colors hover:bg-muted/20"
                    >
                      {/* Order */}
                      <td className="px-5 py-4">
                        <Link
                          to="/orders/$orderId"
                          params={{
                            orderId: order.id,
                          }}
                          className="font-medium text-primary hover:underline"
                        >
                          {order.order_number}
                        </Link>

                        {order.batch_number ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Batch: {order.batch_number}
                          </p>
                        ) : null}

                        <p className="mt-1 text-xs text-muted-foreground">
                          {order.product_name}
                        </p>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />

                          <div>
                            <p className="font-medium">
                              {order.customer
                                ?.customer_name ??
                                "Unknown customer"}
                            </p>

                            {order.customer
                              ?.organization ? (
                              <p className="text-xs text-muted-foreground">
                                {
                                  order.customer
                                    .organization
                                }
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Inspection */}
                      <td className="px-5 py-4">
                        {inspection ? (
                          <div>
                            <div className="flex items-center gap-2 text-sm">
                              <CalendarDays className="h-4 w-4 text-muted-foreground" />

                              {formatDate(
                                inspection.inspection_date,
                              )}
                            </div>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {inspection.quantity_inspected}{" "}
                              inspected ·{" "}
                              {inspection.quantity_passed}{" "}
                              passed ·{" "}
                              {inspection.quantity_failed}{" "}
                              failed
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Not inspected
                          </span>
                        )}
                      </td>

                      {/* Pass rate */}
                      <td className="px-5 py-4">
                        <div className="w-[130px]">
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Pass rate
                            </span>

                            <span className="font-medium">
                              {passRate}%
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    passRate,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Defects */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <AlertCircle
                            className={
                              inspection &&
                              inspection.defect_count > 0
                                ? "h-4 w-4 text-destructive"
                                : "h-4 w-4 text-muted-foreground"
                            }
                          />

                          <span
                            className={
                              inspection &&
                              inspection.defect_count > 0
                                ? "font-medium text-destructive"
                                : "font-medium"
                            }
                          >
                            {inspection?.defect_count ?? 0}
                          </span>
                        </div>
                      </td>

                      {/* Alterations */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-muted-foreground" />

                          <span
                            className={
                              activeAlterations > 0
                                ? "font-medium text-destructive"
                                : "font-medium"
                            }
                          >
                            {activeAlterations}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge
                          value={inspectionStatus}
                        />
                      </td>

                      {/* Delivery */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />

                          {order.expected_delivery_date
                            ? formatDate(
                                order.expected_delivery_date,
                              )
                            : "Not set"}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                        >
                          <Link
                            to="/orders/$orderId"
                            params={{
                              orderId: order.id,
                            }}
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

      {/* Alterations */}
      <div className="surface overflow-hidden">
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />

            <div>
              <h2 className="font-semibold">
                Quality Alterations
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Issues identified during quality inspection
                that require correction.
              </p>
            </div>
          </div>
        </div>

        {alterations.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-muted-foreground" />

            <p className="mt-3 font-medium">
              No alterations recorded
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Quality-related corrections will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">
                    Order
                  </th>

                  <th className="px-5 py-3">
                    Issue
                  </th>

                  <th className="px-5 py-3">
                    Quantity
                  </th>

                  <th className="px-5 py-3">
                    Priority
                  </th>

                  <th className="px-5 py-3">
                    Status
                  </th>

                  <th className="px-5 py-3">
                    Created
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {alterations.map((alteration) => {
                  const order = qualityOrders.find(
                    (item) =>
                      item.id === alteration.order_id,
                  );

                  return (
                    <tr
                      key={alteration.id}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <td className="px-5 py-4">
                        {order ? (
                          <Link
                            to="/orders/$orderId"
                            params={{
                              orderId: order.id,
                            }}
                            className="font-medium text-primary hover:underline"
                          >
                            {order.order_number}
                          </Link>
                        ) : (
                          "Unknown order"
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium">
                            {alteration.issue_description}
                          </p>

                          {alteration.correction_required ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Correction:{" "}
                              {
                                alteration.correction_required
                              }
                            </p>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {alteration.affected_quantity}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          value={alteration.priority}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          value={alteration.status}
                        />
                      </td>

                      <td className="px-5 py-4 text-sm">
                        {formatDate(alteration.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quality overview */}
      <div className="surface p-5">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />

          <div>
            <h2 className="font-semibold">
              Quality Overview
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Quick view of inspection performance across
              current orders.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <OverviewCard
            label="Total Inspected"
            value={inspections.reduce(
              (sum, item) =>
                sum + Number(item.quantity_inspected),
              0,
            )}
          />

          <OverviewCard
            label="Total Passed"
            value={inspections.reduce(
              (sum, item) =>
                sum + Number(item.quantity_passed),
              0,
            )}
          />

          <OverviewCard
            label="Total Failed"
            value={inspections.reduce(
              (sum, item) =>
                sum + Number(item.quantity_failed),
              0,
            )}
            danger
          />
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
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>

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

function OverviewCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">
        {label}
      </p>

      <p
        className={
          danger
            ? "mt-2 text-2xl font-semibold text-destructive"
            : "mt-2 text-2xl font-semibold"
        }
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}