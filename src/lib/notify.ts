import { supabase } from "@/integrations/supabase/client";

/**
 * Creates in-app notifications for every active staff member (optionally
 * limited to a set of roles) and writes an audit entry for the order.
 */
export async function notifyStaff(input: {
  title: string;
  message: string;
  type?: string;
  orderId?: string | null;
  roles?: Array<"admin" | "sales" | "production">;
}) {
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", input.roles ?? ["admin", "sales", "production"]);

  const recipients = [...new Set((roleRows ?? []).map((row) => row.user_id))];
  if (recipients.length === 0) return;

  await supabase.from("notifications").insert(
    recipients.map((recipientId) => ({
      recipient_id: recipientId,
      title: input.title,
      message: input.message,
      type: input.type ?? "info",
      order_id: input.orderId ?? null,
    })),
  );
}

export async function logActivity(input: {
  orderId?: string | null;
  action: string;
  actorId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await supabase.from("activity_log").insert({
    order_id: input.orderId ?? null,
    actor_id: input.actorId ?? null,
    actor_name: input.actorName ?? null,
    action: input.action,
    metadata: (input.metadata ?? {}) as never,
  });
}
