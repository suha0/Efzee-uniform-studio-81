import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ORDER_STATUSES,
  PRIORITIES,
  formatDate,
  friendlyError,
  isOverdue,
  titleize,
} from "@/lib/domain";

import { useDebounced } from "@/hooks/use-debounced";

export const Route = createFileRoute("/_authenticated/orders/")({
  component: OrdersPage,
});

const PAGE_SIZE = 10;

function OrdersPage() {
  const queryClient = useQueryClient();
  const { canSell, role } = useAuth();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [page, setPage] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search, 300);

  const filters = useMemo(
    () => ({
      search: debouncedSearch.trim(),
      status,
      priority,
      page,
    }),
    [debouncedSearch, status, priority, page],
  );

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["orders", filters],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(
          "id, order_number, batch_number, status, priority, product_name, total_quantity, order_date, expected_delivery_date, customers(customer_name)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(
          filters.page * PAGE_SIZE,
          filters.page * PAGE_SIZE + PAGE_SIZE - 1,
        );

      if (filters.status !== "all") {
        query = query.eq("status", filters.status as never);
      }

      if (filters.priority !== "all") {
        query = query.eq("priority", filters.priority as never);
      }

      if (filters.search) {
        query = query.or(
          `order_number.ilike.%${filters.search}%,batch_number.ilike.%${filters.search}%,product_name.ilike.%${filters.search}%`,
        );
      }

      const {
        data: rows,
        error: queryError,
        count,
      } = await query;

      if (queryError) throw queryError;

      return {
        rows: rows ?? [],
        count: count ?? 0,
      };
    },
  });

  const totalPages = Math.max(
    1,
    Math.ceil((data?.count ?? 0) / PAGE_SIZE),
  );

  async function deleteOrder(order: {
    id: string;
    order_number: string;
  }) {
    if (role !== "admin") {
      toast.error("Only administrators can delete orders.");
      return;
    }

    const confirmed = window.confirm(
      `Delete order ${order.order_number}?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(order.id);

    try {
      const { data: deletedOrder, error: deleteError } = await supabase
        .from("orders")
        .delete()
        .eq("id", order.id)
        .select("id")
        .maybeSingle();

      if (deleteError) {
        console.error("DELETE ORDER ERROR:", deleteError);
        throw deleteError;
      }

      if (!deletedOrder) {
        throw new Error(
          "Order was not deleted. Make sure you are signed in as an administrator and have permission to delete orders.",
        );
      }

      // Remove the order from every cached Orders page immediately.
      queryClient.setQueriesData(
        { queryKey: ["orders"] },
        (currentData: unknown) => {
          if (!currentData || typeof currentData !== "object") {
            return currentData;
          }

          const dataObject = currentData as {
            rows?: Array<{ id: string }>;
            count?: number;
          };

          if (!Array.isArray(dataObject.rows)) {
            return currentData;
          }

          const removed = dataObject.rows.some(
            (item) => item.id === order.id,
          );

          if (!removed) {
            return currentData;
          }

          return {
            ...dataObject,
            rows: dataObject.rows.filter(
              (item) => item.id !== order.id,
            ),
            count: Math.max(0, (dataObject.count ?? 0) - 1),
          };
        },
      );

      // Refresh the actual database-backed list.
      await queryClient.invalidateQueries({
        queryKey: ["orders"],
      });

      // Refresh anything else in the application that depends on orders.
      await queryClient.invalidateQueries({
        queryKey: ["dashboard"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["reports"],
      });

      toast.success(`Order ${order.order_number} deleted successfully.`);

      // If the current page becomes empty after deleting its last order,
      // move back one page.
      if ((data?.rows?.length ?? 0) === 1 && page > 0) {
        setPage((current) => Math.max(0, current - 1));
      }
    } catch (deleteError) {
      console.error("Delete order error:", deleteError);

      let message = "Order could not be deleted.";

      if (deleteError instanceof Error) {
        message = deleteError.message;
      } else if (
        typeof deleteError === "object" &&
        deleteError !== null
      ) {
        const errorObject = deleteError as {
          message?: unknown;
          details?: unknown;
          hint?: unknown;
        };

        if (typeof errorObject.message === "string") {
          message = errorObject.message;
        } else if (typeof errorObject.details === "string") {
          message = errorObject.details;
        } else if (typeof errorObject.hint === "string") {
          message = errorObject.hint;
        } else {
          message = friendlyError(deleteError);
        }
      }

      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Search, filter and track every sales order in the studio."
        actions={
          canSell ? (
            <Button asChild>
              <Link to="/orders/new">
                <Plus className="mr-2 h-4 w-4" />
                New order
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="surface mb-4 flex flex-col gap-3 p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            className="pl-9"
            placeholder="Search order number, batch or product…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </div>

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(0);
          }}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>

            {ORDER_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {titleize(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={priority}
          onValueChange={(value) => {
            setPriority(value);
            setPage(0);
          }}
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>

            {PRIORITIES.map((value) => (
              <SelectItem key={value} value={value}>
                {titleize(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={friendlyError(error)} />
      ) : (data?.rows.length ?? 0) === 0 ? (
        <EmptyState
          title="No orders found"
          description="Try a different search, or create a new order."
          action={
            canSell ? (
              <Button asChild size="sm">
                <Link to="/orders/new">New order</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">
                    Order
                  </th>

                  <th className="px-4 py-2.5 font-medium">
                    Customer
                  </th>

                  <th className="px-4 py-2.5 font-medium">
                    Product
                  </th>

                  <th className="px-4 py-2.5 font-medium">
                    Qty
                  </th>

                  <th className="px-4 py-2.5 font-medium">
                    Delivery
                  </th>

                  <th className="px-4 py-2.5 font-medium">
                    Priority
                  </th>

                  <th className="px-4 py-2.5 font-medium">
                    Status
                  </th>

                  {role === "admin" && (
                    <th className="px-4 py-2.5 text-right font-medium">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {data?.rows.map((order) => {
                  const deleting = deletingId === order.id;

                  return (
                    <tr
                      key={order.id}
                      className="border-t hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
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

                      <td className="px-4 py-3">
                        {(
                          order.customers as {
                            customer_name: string;
                          } | null
                        )?.customer_name ?? "—"}
                      </td>

                      <td className="px-4 py-3">
                        {order.product_name ?? "—"}
                      </td>

                      <td className="px-4 py-3">
                        {order.total_quantity}
                      </td>

                      <td className="px-4 py-3">
                        {formatDate(order.expected_delivery_date)}

                        {isOverdue(order as never) ? (
                          <span className="ml-1 text-xs font-medium text-destructive">
                            overdue
                          </span>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge value={order.priority} />
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge value={order.status} />
                      </td>

                      {role === "admin" && (
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deleting}
                            onClick={() =>
                              void deleteOrder({
                                id: order.id,
                                order_number: order.order_number,
                              })
                            }
                            className="text-destructive hover:text-destructive"
                            title="Delete order"
                          >
                            {deleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {data?.count ?? 0} order(s) · page {page + 1} of{" "}
              {totalPages}
            </span>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() =>
                  setPage((current) =>
                    Math.max(0, current - 1),
                  )
                }
              >
                Previous
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() =>
                  setPage((current) => current + 1)
                }
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}