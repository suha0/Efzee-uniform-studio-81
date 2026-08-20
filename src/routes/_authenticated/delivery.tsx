import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { friendlyError, formatDate, titleize } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/delivery")({
  component: DeliveryPage,
});

type DeliveryStatus =
  | "ready_for_delivery"
  | "delivered"
  | "completed";

type DeliveryOrder = {
  id: string;
  order_number: string;
  batch_number: string | null;
  status: string;
  priority: string;
  product_name: string;
  total_quantity: number;
  order_date: string;
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

type StatusFilter = "all" | DeliveryStatus;

const STATUS_FILTERS: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "all", label: "All delivery statuses" },
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

function isOverdue(order: DeliveryOrder) {
  if (!order.expected_delivery_date) return false;

  if (
    order.status === "delivered" ||
    order.status === "completed"
  ) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deliveryDate = new Date(`${order.expected_delivery_date}T00:00:00`);

  return deliveryDate < today;
}

function DeliveryPage() {
  const { canSell, canProduce } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const canViewDelivery = Boolean(canSell || canProduce);

  const {
    data: orders = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["delivery-orders"],
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
          order_date,
          expected_delivery_date,
          customers (
            customer_name,
            organization
          )
        `,
        )
        .in("status", [
          "ready_for_delivery",
          "delivered",
          "completed",
        ])
        .order("expected_delivery_date", {
          ascending: true,
          nullsFirst: false,
        });

      if (error) throw error;

      return (data ?? []) as unknown as DeliveryOrder[];
    },
    enabled: canViewDelivery,
  });

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const customer = getCustomer(order.customers);

      const matchesSearch =
        !query ||
        order.order_number.toLowerCase().includes(query) ||
        order.product_name.toLowerCase().includes(query) ||
        order.batch_number?.toLowerCase().includes(query) ||
        customer?.customer_name.toLowerCase().includes(query) ||
        customer?.organization?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const stats = useMemo(() => {
    const ready = orders.filter(
      (order) => order.status === "ready_for_delivery",
    ).length;

    const delivered = orders.filter(
      (order) => order.status === "delivered",
    ).length;

    const completed = orders.filter(
      (order) => order.status === "completed",
    ).length;

    const overdue = orders.filter(isOverdue).length;

    return {
      ready,
      delivered,
      completed,
      overdue,
    };
  }, [orders]);

  async function refresh() {
    try {
      await refetch();
      toast.success("Delivery data refreshed");
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  async function markAsDelivered(order: DeliveryOrder) {
    if (!canSell) {
      toast.error(
        "You do not have permission to update delivery status.",
      );
      return;
    }

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "delivered",
        })
        .eq("id", order.id);

      if (error) throw error;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("activity_log").insert({
        order_id: order.id,
        actor_id: user?.id ?? null,
        actor_name: null,
        action: "Order marked as delivered",
        metadata: {
          previous_status: order.status,
          new_status: "delivered",
        },
      });

      toast.success(`${order.order_number} marked as delivered`);

      await refetch();
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  if (!canViewDelivery) {
    return (
      <div className="surface p-8 text-center">
        <Truck className="mx-auto h-10 w-10 text-muted-foreground" />

        <h2 className="mt-4 text-lg font-semibold">
          Delivery access required
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          You do not have permission to view delivery operations.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />

        <h2 className="mt-4 text-lg font-semibold">
          Unable to load delivery data
        </h2>

        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {friendlyError(error)}
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />

            <h1 className="text-2xl font-semibold tracking-tight">
              Delivery
            </h1>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Track orders ready for delivery and completed deliveries.
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
          title="Ready for Delivery"
          value={stats.ready}
          icon={<PackageCheck className="h-5 w-5" />}
          description="Orders waiting to be delivered"
        />

        <StatCard
          title="Delivered"
          value={stats.delivered}
          icon={<Truck className="h-5 w-5" />}
          description="Orders marked as delivered"
        />

        <StatCard
          title="Completed"
          value={stats.completed}
          icon={<CheckCircle2 className="h-5 w-5" />}
          description="Completed order lifecycle"
        />

        <StatCard
          title="Overdue"
          value={stats.overdue}
          icon={<Clock3 className="h-5 w-5" />}
          description="Delivery date has passed"
          danger={stats.overdue > 0}
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
              placeholder="Search order, customer or product..."
              className="pl-9"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as StatusFilter,
              )
            }
            className="h-10 min-w-[210px] rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {STATUS_FILTERS.map((status) => (
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

      {/* Delivery table */}
      <div className="surface overflow-hidden">
        <div className="border-b px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">
                Delivery Orders
              </h2>

              <p className="text-sm text-muted-foreground">
                {filteredOrders.length}{" "}
                {filteredOrders.length === 1
                  ? "order"
                  : "orders"}{" "}
                shown
              </p>
            </div>

            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />

              <p className="mt-3 text-sm text-muted-foreground">
                Loading delivery data...
              </p>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center px-6 text-center">
            <div>
              <Truck className="mx-auto h-10 w-10 text-muted-foreground" />

              <h3 className="mt-3 font-medium">
                No delivery orders found
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Try changing your search or status filter.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">
                    Order
                  </th>

                  <th className="px-5 py-3">
                    Customer
                  </th>

                  <th className="px-5 py-3">
                    Product
                  </th>

                  <th className="px-5 py-3">
                    Quantity
                  </th>

                  <th className="px-5 py-3">
                    Priority
                  </th>

                  <th className="px-5 py-3">
                    Expected Delivery
                  </th>

                  <th className="px-5 py-3">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredOrders.map((order) => {
                  const customer = getCustomer(
                    order.customers,
                  );

                  const overdue = isOverdue(order);

                  return (
                    <tr
                      key={order.id}
                      className="transition-colors hover:bg-muted/20"
                    >
                      {/* Order */}
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

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />

                          <div>
                            <p className="font-medium">
                              {customer?.customer_name ??
                                "Unknown customer"}
                            </p>

                            {customer?.organization ? (
                              <p className="text-xs text-muted-foreground">
                                {customer.organization}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Product */}
                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {order.product_name}
                        </p>
                      </td>

                      {/* Quantity */}
                      <td className="px-5 py-4">
                        <span className="font-medium">
                          {order.total_quantity}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="px-5 py-4">
                        <StatusBadge value={order.priority} />
                      </td>

                      {/* Delivery date */}
                      <td className="px-5 py-4">
                        <div
                          className={
                            overdue
                              ? "flex items-center gap-2 text-sm font-medium text-destructive"
                              : "flex items-center gap-2 text-sm"
                          }
                        >
                          <CalendarDays className="h-4 w-4" />

                          {order.expected_delivery_date
                            ? formatDate(
                                order.expected_delivery_date,
                              )
                            : "Not set"}
                        </div>

                        {overdue ? (
                          <p className="mt-1 text-xs text-destructive">
                            Overdue
                          </p>
                        ) : null}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge
                          value={getStatusLabel(order.status)}
                        />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {order.status ===
                            "ready_for_delivery" &&
                          canSell ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                void markAsDelivered(order)
                              }
                            >
                              <Truck className="mr-1.5 h-4 w-4" />
                              Mark Delivered
                            </Button>
                          ) : null}

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

      {/* Delivery workflow */}
      <div className="surface overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">
            Delivery Workflow
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Track the final stages of the order lifecycle.
          </p>
        </div>

        <div className="grid gap-px bg-border md:grid-cols-3">
          <WorkflowCard
            icon={<PackageCheck className="h-5 w-5" />}
            title="Ready for Delivery"
            value={stats.ready}
            description="Orders prepared and waiting for dispatch."
          />

          <WorkflowCard
            icon={<Truck className="h-5 w-5" />}
            title="Delivered"
            value={stats.delivered}
            description="Orders that have been handed over to the customer."
          />

          <WorkflowCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="Completed"
            value={stats.completed}
            description="Orders that have completed the full lifecycle."
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

function WorkflowCard({
  icon,
  title,
  value,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="bg-background p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">
            {title}
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {value}
          </p>
        </div>

        <div className="rounded-lg bg-muted p-2.5">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}