import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Clock3,
  ExternalLink,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyError, formatDate, titleize } from "@/lib/domain";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

type Notification = {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  type: string;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
};

type ReadFilter = "all" | "unread" | "read";

function getTypeLabel(type: string) {
  return titleize(type.replaceAll("_", " "));
}

function getTypeClass(type: string) {
  switch (type.toLowerCase()) {
    case "success":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";

    case "warning":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

    case "error":
    case "danger":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";

    case "production":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

    default:
      return "bg-muted text-muted-foreground";
  }
}

function getNotificationIcon(type: string) {
  switch (type.toLowerCase()) {
    case "success":
      return <Check className="h-4 w-4" />;

    case "warning":
      return <Clock3 className="h-4 w-4" />;

    case "error":
    case "danger":
      return <X className="h-4 w-4" />;

    default:
      return <Bell className="h-4 w-4" />;
  }
}

function NotificationsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const {
    data: notifications = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to view notifications.");
      }

      const { data, error } = await supabase
        .from("notifications")
        .select(
          `
          id,
          recipient_id,
          title,
          message,
          type,
          order_id,
          is_read,
          created_at
        `,
        )
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as Notification[];
    },
  });

  /*
   * Realtime notifications
   */
  useEffect(() => {
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ["notifications"],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const notificationTypes = useMemo(() => {
    const types = new Set(
      notifications
        .map((notification) => notification.type)
        .filter(Boolean),
    );

    return Array.from(types).sort();
  }, [notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesSearch =
        !query ||
        notification.title.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query);

      const matchesRead =
        readFilter === "all" ||
        (readFilter === "unread" && !notification.is_read) ||
        (readFilter === "read" && notification.is_read);

      const matchesType =
        typeFilter === "all" || notification.type === typeFilter;

      return matchesSearch && matchesRead && matchesType;
    });
  }, [notifications, search, readFilter, typeFilter]);

  async function markAsRead(id: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      toast.error(friendlyError(error));
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["notifications"],
    });

    toast.success("Notification marked as read");
  }

  async function markAllAsRead() {
    if (unreadCount === 0) {
      toast.info("You have no unread notifications");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be signed in.");
      return;
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    if (error) {
      toast.error(friendlyError(error));
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["notifications"],
    });

    toast.success("All notifications marked as read");
  }

  async function deleteNotification(id: string) {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error(friendlyError(error));
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["notifications"],
    });

    toast.success("Notification deleted");
  }

  async function refresh() {
    try {
      await refetch();
      toast.success("Notifications refreshed");
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  if (error) {
    return (
      <div className="surface p-8 text-center">
        <Bell className="mx-auto h-10 w-10 text-muted-foreground" />

        <h2 className="mt-4 text-lg font-semibold">
          Unable to load notifications
        </h2>

        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {friendlyError(error)}
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
            <Bell className="h-6 w-6 text-primary" />

            <h1 className="text-2xl font-semibold tracking-tight">
              Notifications
            </h1>

            {unreadCount > 0 ? (
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                {unreadCount} unread
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Stay updated with orders, production, quality and delivery events.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void markAllAsRead()}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>

          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total"
          value={notifications.length}
          icon={<Bell className="h-5 w-5" />}
          description="All notifications"
        />

        <StatCard
          title="Unread"
          value={unreadCount}
          icon={<Check className="h-5 w-5" />}
          description="Require your attention"
        />

        <StatCard
          title="Read"
          value={notifications.length - unreadCount}
          icon={<CheckCheck className="h-5 w-5" />}
          description="Already reviewed"
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
              placeholder="Search notifications..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <select
                value={readFilter}
                onChange={(event) =>
                  setReadFilter(event.target.value as ReadFilter)
                }
                className="h-10 w-full min-w-[150px] rounded-md border bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All notifications</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </div>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-10 w-full min-w-[150px] rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All types</option>

              {notificationTypes.map((type) => (
                <option key={type} value={type}>
                  {getTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notification list */}
      <div className="surface overflow-hidden">
        <div className="border-b px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Your Notifications</h2>

              <p className="text-sm text-muted-foreground">
                {filteredNotifications.length}{" "}
                {filteredNotifications.length === 1
                  ? "notification"
                  : "notifications"}{" "}
                shown
              </p>
            </div>

            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[350px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />

              <p className="mt-3 text-sm text-muted-foreground">
                Loading notifications...
              </p>
            </div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex min-h-[350px] items-center justify-center px-6 text-center">
            <div>
              <Bell className="mx-auto h-10 w-10 text-muted-foreground" />

              <h3 className="mt-3 font-medium">
                {notifications.length === 0
                  ? "No notifications yet"
                  : "No matching notifications"}
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                {notifications.length === 0
                  ? "New notifications will appear here."
                  : "Try changing your search or filters."}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`group px-5 py-5 transition-colors hover:bg-muted/20 ${
                  !notification.is_read ? "bg-primary/[0.03]" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getTypeClass(
                      notification.type,
                    )}`}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={
                              notification.is_read
                                ? "font-medium"
                                : "font-semibold"
                            }
                          >
                            {notification.title}
                          </h3>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getTypeClass(
                              notification.type,
                            )}`}
                          >
                            {getTypeLabel(notification.type)}
                          </span>

                          {!notification.is_read ? (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          ) : null}
                        </div>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {notification.message}
                        </p>
                      </div>

                      <p className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(notification.created_at)}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {notification.order_id ? (
                        <Button asChild variant="outline" size="sm">
                          <Link
                            to="/orders/$orderId"
                            params={{ orderId: notification.order_id }}
                          >
                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                            View Order
                          </Link>
                        </Button>
                      ) : null}

                      {!notification.is_read ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void markAsRead(notification.id)}
                        >
                          <Check className="mr-2 h-3.5 w-3.5" />
                          Mark as read
                        </Button>
                      ) : null}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => void deleteNotification(notification.id)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>

          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>

        <div className="rounded-lg bg-muted p-2.5">{icon}</div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}