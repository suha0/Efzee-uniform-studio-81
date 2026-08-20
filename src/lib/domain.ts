import type { Database } from "@/integrations/supabase/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type OrderPriority = Database["public"]["Enums"]["order_priority"];
export type StageStatus = Database["public"]["Enums"]["stage_status"];
export type ProductionStage = Database["public"]["Enums"]["production_stage"];
export type QualityStatus = Database["public"]["Enums"]["quality_status"];
export type AlterationStatus = Database["public"]["Enums"]["alteration_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export const ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "confirmed",
  "in_production",
  "quality_check",
  "alteration_required",
  "ready_for_delivery",
  "delivered",
  "completed",
  "cancelled",
];

export const PRIORITIES: OrderPriority[] = ["low", "normal", "high", "urgent"];

export const PRODUCTION_STAGES: ProductionStage[] = [
  "fabric_procurement",
  "cutting",
  "stitching",
  "embroidery_printing",
  "packing",
];

export const STAGE_STATUSES: StageStatus[] = [
  "not_started",
  "in_progress",
  "completed",
  "blocked",
];

export const QUALITY_STATUSES: QualityStatus[] = [
  "pending_inspection",
  "passed",
  "failed",
  "alteration_required",
  "ready_for_delivery",
  "delivered",
  "completed",
];

export const ALTERATION_STATUSES: AlterationStatus[] = [
  "open",
  "in_progress",
  "completed",
  "verified",
];

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

export const PRODUCT_CATEGORIES = [
  "School Uniform",
  "Corporate",
  "Hospitality",
  "Healthcare",
  "Industrial",
  "Security",
  "Sportswear",
  "Other",
];

export function titleize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "accent";

export const statusTone: Record<string, Tone> = {
  draft: "neutral",
  confirmed: "info",
  in_production: "accent",
  quality_check: "warning",
  alteration_required: "danger",
  ready_for_delivery: "info",
  delivered: "success",
  completed: "success",
  cancelled: "neutral",
  not_started: "neutral",
  in_progress: "accent",
  blocked: "danger",
  pending_inspection: "warning",
  passed: "success",
  failed: "danger",
  open: "warning",
  verified: "success",
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

export const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info/10 text-info border-info/25",
  warning: "bg-warning/15 text-warning-foreground border-warning/35",
  success: "bg-success/12 text-success border-success/25",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  accent: "bg-accent/15 text-accent-foreground border-accent/35",
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function currency(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function isOverdue(order: {
  expected_delivery_date: string | null;
  status: string;
}): boolean {
  if (!order.expected_delivery_date) return false;
  if (["delivered", "completed", "cancelled"].includes(order.status)) return false;
  return new Date(order.expected_delivery_date) < new Date(new Date().toDateString());
}

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message) return "Something went wrong. Please try again.";
  if (message.includes("duplicate key")) {
    if (message.includes("order_number")) return "That order number is already in use.";
    if (message.includes("customer_code")) return "That customer code is already in use.";
    return "This record already exists.";
  }
  if (message.includes("row-level security") || message.includes("permission")) {
    return "You don't have permission to do that.";
  }
  if (message.toLowerCase().includes("failed to fetch")) {
    return "Network problem — check your connection and try again.";
  }
  if (message.includes("Invalid login credentials")) return "Incorrect email or password.";
  return message;
}
