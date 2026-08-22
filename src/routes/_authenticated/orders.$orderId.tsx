import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Factory,
  FileText,
  ImagePlus,
  Loader2,
  Package,
  RefreshCw,
  Save,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  ALTERATION_STATUSES,
  ORDER_STATUSES,
  PRIORITIES,
  PRODUCTION_STAGES,
  QUALITY_STATUSES,
  STAGE_STATUSES,
  currency,
  formatDate,
  formatDateTime,
  friendlyError,
  titleize,
} from "@/lib/domain";
import { logActivity, notifyStaff } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  component: OrderDetailsPage,
});

type Tab =
  | "overview"
  | "production"
  | "quality"
  | "alterations"
  | "activity";

function OrderDetailsPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, canSell, canProduce } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);

  const canEdit = Boolean(canSell || canProduce);

  const {
    data: order,
    isLoading: orderLoading,
    error: orderError,
    refetch,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          customers (
            id,
            customer_code,
            customer_name,
            organization,
            phone,
            email,
            address,
            city,
            state
          ),
          order_items (*)
        `,
        )
        .eq("id", orderId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery({
    queryKey: ["production-stages", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_stages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at");

      if (error) throw error;
      return data;
    },
  });

  const { data: images = [] } = useQuery({
    queryKey: ["production-images", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_images")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: inspections = [] } = useQuery({
    queryKey: ["quality-inspections", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_inspections")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: alterations = [] } = useQuery({
    queryKey: ["alterations", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alterations")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activity-log", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const overallProgress = useMemo(() => {
    if (!stages.length) return 0;

    return Math.round(
      stages.reduce(
        (sum, stage) => sum + (stage.progress ?? 0),
        0,
      ) / stages.length,
    );
  }, [stages]);

  async function updateOrderStatus(status: string) {
    if (!canEdit || !order) return;

    setBusy(true);

    const { error } = await supabase
      .from("orders")
      .update({
        status: status as never,
      })
      .eq("id", orderId);

    if (error) {
      toast.error(friendlyError(error));
      setBusy(false);
      return;
    }

    await logActivity({
      orderId,
      action: `Order status changed to ${titleize(status)}`,
      actorId: user?.id ?? null,
      actorName: profile?.full_name ?? null,
    });

    await notifyStaff({
      title: "Order status updated",
      message: `${order.order_number} → ${titleize(status)}`,
      type: "order",
      orderId,
    });

    await queryClient.invalidateQueries({
      queryKey: ["order", orderId],
    });

    await queryClient.invalidateQueries({
      queryKey: ["orders"],
    });

    await queryClient.invalidateQueries({
      queryKey: ["dashboard"],
    });

    toast.success("Order status updated");
    setBusy(false);
  }

  async function updateStage(
    stageId: string,
    values: {
      status: string;
      progress: number;
      notes: string;
      issues: string;
    },
  ) {
    if (!canEdit) return;

    const stage = stages.find(
      (item) => item.id === stageId,
    );

    if (!stage) return;

    const now = new Date().toISOString();

    const payload: {
      status: string;
      progress: number;
      notes: string | null;
      issues: string | null;
      started_date?: string | null;
      completed_date?: string | null;
    } = {
      status: values.status,
      progress: Math.max(
        0,
        Math.min(100, values.progress),
      ),
      notes: values.notes || null,
      issues: values.issues || null,
    };

    if (
      values.status === "in_progress" &&
      !stage["started_date"]
    ) {
      payload["started_date"] = now;
    }

    if (values.status === "completed") {
      payload["progress"] = 100;
      payload["completed_date"] =
        stage["completed_date"] ?? now;
      payload["started_date"] =
        stage["started_date"] ?? now;
    }

    const { error } = await supabase
      .from("production_stages")
      .update(payload as never)
      .eq("id", stageId);

    if (error) {
      toast.error(friendlyError(error));
      return;
    }

    await logActivity({
      orderId,
      action: `${titleize(stage.stage)} updated to ${titleize(
        values.status,
      )}`,
      actorId: user?.id ?? null,
      actorName: profile?.full_name ?? null,
    });

    await queryClient.invalidateQueries({
      queryKey: ["production-stages", orderId],
    });

    await queryClient.invalidateQueries({
      queryKey: ["activity-log", orderId],
    });

    toast.success(
      `${titleize(stage.stage)} updated`,
    );
  }

  if (orderLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/orders" })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to orders
        </Button>

        <div className="surface p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-destructive" />

          <h2 className="mt-3 font-semibold">
            Order not found
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            The order could not be loaded.
          </p>

          <Button
            className="mt-4"
            onClick={() => void refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const customer = order.customers;
  const items = order.order_items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.order_number}
        description={`${order.product_name ?? "Order"} · ${
          customer?.customer_name ?? "Customer"
        }`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void downloadOrderSheet(
                  order,
                  customer,
                  items,
                  images,
                )
              }
            >
              <FileText className="mr-2 h-4 w-4" />
              Download Order Sheet
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                navigate({ to: "/orders" })
              }
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Orders
            </Button>

            <Select
              value={order.status}
              onValueChange={(value) =>
                void updateOrderStatus(value)
              }
              disabled={!canEdit || busy}
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {ORDER_STATUSES.map((status) => (
                  <SelectItem
                    key={status}
                    value={status}
                  >
                    {titleize(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Order status"
          value={
            <StatusBadge value={order.status} />
          }
        />

        <Metric
          label="Priority"
          value={
            <StatusBadge value={order.priority} />
          }
        />

        <Metric
          label="Quantity"
          value={`${order.total_quantity ?? 0} pcs`}
        />

        <Metric
          label="Production"
          value={`${overallProgress}%`}
        />
      </div>

      <div className="border-b">
        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              ["overview", "Overview"],
              ["production", "Production"],
              ["quality", "Quality"],
              ["alterations", "Alterations"],
              ["activity", "Activity"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={
                activeTab === value
                  ? "border-b-2 border-accent px-4 py-3 text-sm font-medium"
                  : "px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <Overview
          order={order}
          customer={customer}
          items={items}
        />
      )}

      {activeTab === "production" && (
        <ProductionTab
          stages={stages}
          images={images}
          loading={stagesLoading}
          canEdit={canEdit}
          userId={user?.id ?? null}
          onUpdateStage={updateStage}
          onRefresh={() =>
            queryClient.invalidateQueries({
              queryKey: [
                "production-images",
                orderId,
              ],
            })
          }
        />
      )}

      {activeTab === "quality" && (
        <QualityTab
          orderId={orderId}
          orderQuantity={order.total_quantity ?? 0}
          inspections={inspections}
          canEdit={canEdit}
          userId={user?.id ?? null}
          onRefresh={() => {
            void queryClient.invalidateQueries({
              queryKey: [
                "quality-inspections",
                orderId,
              ],
            });

            void queryClient.invalidateQueries({
              queryKey: ["order", orderId],
            });
          }}
        />
      )}

      {activeTab === "alterations" && (
        <AlterationsTab
          orderId={orderId}
          alterations={alterations}
          canEdit={canEdit}
          onRefresh={() =>
            queryClient.invalidateQueries({
              queryKey: ["alterations", orderId],
            })
          }
        />
      )}

      {activeTab === "activity" && (
        <ActivityTab
          activities={activities}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="surface p-4">
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <div className="mt-2 text-lg font-semibold">
        {value}
      </div>
    </div>
  );
}

function Overview({
  order,
  customer,
  items,
}: {
  order: any;
  customer: any;
  items: any[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="surface p-5 lg:col-span-2">
        <div className="mb-5 flex items-center gap-2">
          <Package className="h-5 w-5 text-accent" />

          <h2 className="font-semibold">
            Order information
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Info
            label="Order number"
            value={order.order_number}
          />

          <Info
            label="Batch number"
            value={order.batch_number}
          />

          <Info
            label="Product"
            value={order.product_name}
          />

          <Info
            label="Category"
            value={order.product_category}
          />

          <Info
            label="Order date"
            value={formatDate(order.order_date)}
          />

          <Info
            label="Expected delivery"
            value={formatDate(
              order.expected_delivery_date,
            )}
          />

          <Info
            label="Quantity"
            value={`${order.total_quantity} pcs`}
          />

          <Info
            label="Priority"
            value={titleize(order.priority)}
          />
        </div>

        <div className="mt-6 grid gap-4">
          <TextInfo
            label="Fabric details"
            value={order.fabric_details}
          />

          <TextInfo
            label="Accessory details"
            value={order.accessory_details}
          />

          <TextInfo
            label="Customization"
            value={order.customization_details}
          />

          <TextInfo
            label="Special instructions"
            value={order.special_instructions}
          />

          <TextInfo
            label="Remarks"
            value={order.remarks}
          />
        </div>
      </section>

      <section className="surface p-5">
        <div className="mb-5 flex items-center gap-2">
          <User className="h-5 w-5 text-accent" />

          <h2 className="font-semibold">
            Customer
          </h2>
        </div>

        <div className="space-y-4">
          <Info
            label="Name"
            value={customer?.customer_name}
          />

          <Info
            label="Organization"
            value={customer?.organization}
          />

          <Info
            label="Customer code"
            value={customer?.customer_code}
          />

          <Info
            label="Phone"
            value={customer?.phone}
          />

          <Info
            label="Email"
            value={customer?.email}
          />

          <Info
            label="Location"
            value={[
              customer?.city,
              customer?.state,
            ]
              .filter(Boolean)
              .join(", ")}
          />
        </div>
      </section>

      <section className="surface overflow-hidden p-5 lg:col-span-3">
        <div className="mb-5 flex items-center gap-2">
          <FileText className="h-5 w-5 text-accent" />

          <h2 className="font-semibold">
            Order items
          </h2>
        </div>

        {items.length === 0 ? (
          <Empty text="No order items found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-4">
                    Product
                  </th>

                  <th className="pb-3 pr-4">
                    Type
                  </th>

                  <th className="pb-3 pr-4">
                    Quantity
                  </th>

                  <th className="pb-3 pr-4">
                    Unit price
                  </th>

                  <th className="pb-3 pr-4">
                    Total
                  </th>

                  <th className="pb-3">
                    Sizes
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium">
                      {item.product_name}
                    </td>

                    <td className="py-3 pr-4">
                      {item.product_type ?? "—"}
                    </td>

                    <td className="py-3 pr-4">
                      {item.quantity}
                    </td>

                    <td className="py-3 pr-4">
                      {currency(
                        Number(item.unit_price),
                      )}
                    </td>

                    <td className="py-3 pr-4">
                      {currency(
                        Number(item.total_price),
                      )}
                    </td>

                    <td className="py-3">
                      {Object.entries(
                        (item.size_quantities ??
                          {}) as Record<
                          string,
                          number
                        >,
                      )
                        .map(
                          ([
                            size,
                            quantity,
                          ]) =>
                            `${size}: ${quantity}`,
                        )
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium">
        {value || "—"}
      </p>
    </div>
  );
}

function TextInfo({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;

  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 whitespace-pre-wrap text-sm">
        {value}
      </p>
    </div>
  );
}

function ProductionTab({
  stages,
  images,
  loading,
  canEdit,
  userId,
  onUpdateStage,
  onRefresh,
}: {
  stages: any[];
  images: any[];
  loading: boolean;
  canEdit: boolean;
  userId: string | null;
  onUpdateStage: (
    stageId: string,
    values: {
      status: string;
      progress: number;
      notes: string;
      issues: string;
    },
  ) => Promise<void>;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="surface flex justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface p-5">
        <div className="mb-5 flex items-center gap-2">
          <Factory className="h-5 w-5 text-accent" />

          <h2 className="font-semibold">
            Production stages
          </h2>
        </div>

        <div className="space-y-4">
          {PRODUCTION_STAGES.map(
            (stageName) => {
              const stage = stages.find(
                (item) =>
                  item.stage === stageName,
              );

              if (!stage) {
                return (
                  <div
                    key={stageName}
                    className="rounded-lg border border-dashed p-4"
                  >
                    <p className="font-medium">
                      {titleize(stageName)}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Stage record has not been
                      created.
                    </p>
                  </div>
                );
              }

              return (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  canEdit={canEdit}
                  onSave={onUpdateStage}
                />
              );
            },
          )}
        </div>
      </section>

      <ProductionImages
        images={images}
        canEdit={canEdit}
        userId={userId}
        onRefresh={onRefresh}
      />
    </div>
  );
}

function StageCard({
  stage,
  canEdit,
  onSave,
}: {
  stage: any;
  canEdit: boolean;
  onSave: ProductionTabProps["onUpdateStage"];
}) {
  const [status, setStatus] = useState(
    stage.status,
  );

  const [progress, setProgress] = useState(
    String(stage.progress ?? 0),
  );

  const [notes, setNotes] = useState(
    stage.notes ?? "",
  );

  const [issues, setIssues] = useState(
    stage.issues ?? "",
  );

  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);

    await onSave(stage.id, {
      status,
      progress:
        Number(progress) || 0,
      notes,
      issues,
    });

    setSaving(false);
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-medium">
              {titleize(stage.stage)}
            </h3>

            <StatusBadge value={status} />
          </div>

          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              Started:{" "}
              {formatDateTime(
                stage.started_date,
              )}
            </span>

            <span>
              Completed:{" "}
              {formatDateTime(
                stage.completed_date,
              )}
            </span>
          </div>
        </div>

        <div className="w-full lg:w-44">
          <div className="mb-1 flex justify-between text-xs">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    Number(progress) || 0,
                  ),
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Status</Label>

          <Select
            value={status}
            onValueChange={setStatus}
            disabled={!canEdit}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {STAGE_STATUSES.map(
                (value) => (
                  <SelectItem
                    key={value}
                    value={value}
                  >
                    {titleize(value)}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Progress (%)</Label>

          <Input
            type="number"
            min={0}
            max={100}
            value={progress}
            disabled={!canEdit}
            onChange={(event) =>
              setProgress(
                event.target.value,
              )
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>

          <Textarea
            value={notes}
            disabled={!canEdit}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="Add production notes..."
          />
        </div>

        <div className="space-y-1.5">
          <Label>Issues</Label>

          <Textarea
            value={issues}
            disabled={!canEdit}
            onChange={(event) =>
              setIssues(event.target.value)
            }
            placeholder="Record blockers or issues..."
          />
        </div>
      </div>

      {canEdit && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}

            Save stage
          </Button>
        </div>
      )}
    </div>
  );
}

type ProductionTabProps = {
  onUpdateStage: (
    stageId: string,
    values: {
      status: string;
      progress: number;
      notes: string;
      issues: string;
    },
  ) => Promise<void>;
};

function ProductionImages({
  images,
  canEdit,
  userId,
  onRefresh,
}: {
  images: any[];
  canEdit: boolean;
  userId: string | null;
  onRefresh: () => void;
}) {
  const { orderId } =
    Route.useParams();

  const [uploading, setUploading] =
    useState(false);

  const [stage, setStage] =
    useState("fabric_procurement");

  const [description, setDescription] =
    useState("");

  async function uploadImage(file: File) {
    if (!canEdit || !userId) return;

    if (!file.type.startsWith("image/")) {
      toast.error(
        "Please select an image file.",
      );

      return;
    }

    setUploading(true);

    try {
      const extension =
        file.name.split(".").pop() ||
        "jpg";

      const path = `${orderId}/${crypto.randomUUID()}.${extension}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("production-images")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError)
        throw uploadError;

      const { error: rowError } =
        await supabase
          .from("production_images")
          .insert({
            order_id: orderId,
            stage: stage as never,
            image_path: path,
            description:
              description.trim() ||
              null,
            uploaded_by: userId,
          });

      if (rowError) {
        await supabase.storage
          .from("production-images")
          .remove([path]);

        throw rowError;
      }

      setDescription("");

      toast.success(
        "Production image uploaded",
      );

      onRefresh();
    } catch (error) {
      toast.error(
        friendlyError(error),
      );
    } finally {
      setUploading(false);
    }
  }

  async function deleteImage(image: any) {
    if (!canEdit) return;

    const {
      error: storageError,
    } = await supabase.storage
      .from("production-images")
      .remove([image.image_path]);

    if (storageError) {
      toast.error(
        friendlyError(storageError),
      );

      return;
    }

    const { error } =
      await supabase
        .from("production_images")
        .delete()
        .eq("id", image.id);

    if (error) {
      toast.error(
        friendlyError(error),
      );

      return;
    }

    toast.success("Image deleted");

    onRefresh();
  }

  return (
    <section className="surface p-5">
      <div className="mb-5 flex items-center gap-2">
        <ImagePlus className="h-5 w-5 text-accent" />

        <h2 className="font-semibold">
          Production images
        </h2>
      </div>

      {canEdit && (
        <div className="rounded-lg border border-dashed p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>
                Production stage
              </Label>

              <Select
                value={stage}
                onValueChange={setStage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {PRODUCTION_STAGES.map(
                    (value) => (
                      <SelectItem
                        key={value}
                        value={value}
                      >
                        {titleize(value)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>
                Description
              </Label>

              <Input
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                placeholder="Describe this production image..."
              />
            </div>
          </div>

          <div className="mt-4">
            <Label
              htmlFor="production-image-upload"
              className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground transition hover:bg-muted/50"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <ImagePlus className="mr-2 h-5 w-5" />
                  Click to upload production
                  image
                </>
              )}
            </Label>

            <Input
              id="production-image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file =
                  event.target.files?.[0];

                if (file) {
                  void uploadImage(file);
                }

                event.currentTarget.value =
                  "";
              }}
            />
          </div>
        </div>
      )}

      {images.length === 0 ? (
        <Empty text="No production images uploaded yet." />
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              canDelete={canEdit}
              onDelete={() =>
                void deleteImage(image)
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ImageCard({
  image,
  canDelete,
  onDelete,
}: {
  image: any;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { data: imageUrl } =
    useQuery({
      queryKey: [
        "production-image-url",
        image.image_path,
      ],
      queryFn: async () => {
        const {
          data,
          error,
        } = await supabase.storage
          .from("production-images")
          .createSignedUrl(
            image.image_path,
            3600,
          );

        if (error) throw error;

        return data.signedUrl;
      },
    });

  return (
    <div className="overflow-hidden rounded-lg border">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={
            image.description ??
            "Production progress"
          }
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-muted">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge value={image.stage} />

          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={onDelete}
            >
              Delete
            </Button>
          )}
        </div>

        {image.description && (
          <p className="mt-2 text-sm">
            {image.description}
          </p>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          {formatDateTime(
            image.created_at,
          )}
        </p>
      </div>
    </div>
  );
}

function QualityTab({
  orderId,
  orderQuantity,
  inspections,
  canEdit,
  userId,
  onRefresh,
}: {
  orderId: string;
  orderQuantity: number;
  inspections: any[];
  canEdit: boolean;
  userId: string | null;
  onRefresh: () => void;
}) {
  const [
    quantityInspected,
    setQuantityInspected,
  ] = useState(
    String(orderQuantity),
  );

  const [
    quantityPassed,
    setQuantityPassed,
  ] = useState(
    String(orderQuantity),
  );

  const [
    quantityFailed,
    setQuantityFailed,
  ] = useState("0");

  const [
    defectCount,
    setDefectCount,
  ] = useState("0");

  const [status, setStatus] =
    useState("pending_inspection");

  const [feedback, setFeedback] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  async function createInspection() {
    if (!canEdit || !userId) return;

    const inspected =
      Number(quantityInspected) || 0;

    const passed =
      Number(quantityPassed) || 0;

    const failed =
      Number(quantityFailed) || 0;

    if (
      passed + failed >
      inspected
    ) {
      toast.error(
        "Passed + failed quantity cannot exceed inspected quantity.",
      );

      return;
    }

    setSaving(true);

    const { error } =
      await supabase
        .from("quality_inspections")
        .insert({
          order_id: orderId,
          inspector_id: userId,
          quantity_inspected:
            inspected,
          quantity_passed: passed,
          quantity_failed: failed,
          defect_count:
            Number(defectCount) || 0,
          client_feedback:
            feedback.trim() || null,
          quality_notes:
            notes.trim() || null,
          status: status as never,
        });

    if (error) {
      toast.error(
        friendlyError(error),
      );

      setSaving(false);

      return;
    }

    await logActivity({
      orderId,
      action: `Quality inspection recorded: ${titleize(
        status,
      )}`,
      actorId: userId,
      actorName: null,
    });

    if (
      status ===
        "alteration_required" ||
      status === "failed"
    ) {
      await supabase
        .from("orders")
        .update({
          status:
            "alteration_required",
        })
        .eq("id", orderId);
    } else if (
      status === "passed" ||
      status === "ready_for_delivery"
    ) {
      await supabase
        .from("orders")
        .update({
          status:
            "ready_for_delivery",
        })
        .eq("id", orderId);
    }

    toast.success(
      "Quality inspection saved",
    );

    setFeedback("");
    setNotes("");
    setQuantityFailed("0");
    setDefectCount("0");

    onRefresh();

    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <section className="surface p-5">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />

            <h2 className="font-semibold">
              New quality inspection
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Quantity inspected"
              value={quantityInspected}
              onChange={
                setQuantityInspected
              }
              type="number"
            />

            <Field
              label="Quantity passed"
              value={quantityPassed}
              onChange={
                setQuantityPassed
              }
              type="number"
            />

            <Field
              label="Quantity failed"
              value={quantityFailed}
              onChange={
                setQuantityFailed
              }
              type="number"
            />

            <Field
              label="Defect count"
              value={defectCount}
              onChange={setDefectCount}
              type="number"
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label>Status</Label>

            <Select
              value={status}
              onValueChange={setStatus}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {QUALITY_STATUSES.map(
                  (value) => (
                    <SelectItem
                      key={value}
                      value={value}
                    >
                      {titleize(value)}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Client feedback
              </Label>

              <Textarea
                value={feedback}
                onChange={(event) =>
                  setFeedback(
                    event.target.value,
                  )
                }
                placeholder="Record customer feedback..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Quality notes
              </Label>

              <Textarea
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value,
                  )
                }
                placeholder="Record inspection findings..."
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={() =>
                void createInspection()
              }
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}

              Save inspection
            </Button>
          </div>
        </section>
      )}

      <section className="surface p-5">
        <div className="mb-5 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-accent" />

          <h2 className="font-semibold">
            Inspection history
          </h2>
        </div>

        {inspections.length === 0 ? (
          <Empty text="No quality inspections recorded yet." />
        ) : (
          <div className="space-y-4">
            {inspections.map(
              (inspection) => (
                <div
                  key={inspection.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        Inspection ·{" "}
                        {formatDate(
                          inspection.inspection_date,
                        )}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(
                          inspection.created_at,
                        )}
                      </p>
                    </div>

                    <StatusBadge
                      value={
                        inspection.status
                      }
                    />
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-4">
                    <Info
                      label="Inspected"
                      value={
                        inspection.quantity_inspected
                      }
                    />

                    <Info
                      label="Passed"
                      value={
                        inspection.quantity_passed
                      }
                    />

                    <Info
                      label="Failed"
                      value={
                        inspection.quantity_failed
                      }
                    />

                    <Info
                      label="Defects"
                      value={
                        inspection.defect_count
                      }
                    />
                  </div>

                  <TextInfo
                    label="Client feedback"
                    value={
                      inspection.client_feedback
                    }
                  />

                  <div className="mt-3">
                    <TextInfo
                      label="Quality notes"
                      value={
                        inspection.quality_notes
                      }
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function AlterationsTab({
  orderId,
  alterations,
  canEdit,
  onRefresh,
}: {
  orderId: string;
  alterations: any[];
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const [issue, setIssue] =
    useState("");

  const [quantity, setQuantity] =
    useState("0");

  const [correction, setCorrection] =
    useState("");

  const [priority, setPriority] =
    useState("normal");

  const [status, setStatus] =
    useState("open");

  const [notes, setNotes] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  async function createAlteration() {
    if (!issue.trim()) {
      toast.error(
        "Issue description is required.",
      );

      return;
    }

    setSaving(true);

    const { error } =
      await supabase
        .from("alterations")
        .insert({
          order_id: orderId,
          issue_description:
            issue.trim(),
          affected_quantity:
            Number(quantity) || 0,
          correction_required:
            correction.trim() || null,
          priority:
            priority as never,
          status: status as never,
          notes:
            notes.trim() || null,
        });

    if (error) {
      toast.error(
        friendlyError(error),
      );

      setSaving(false);

      return;
    }

    await supabase
      .from("orders")
      .update({
        status:
          "alteration_required",
      })
      .eq("id", orderId);

    toast.success(
      "Alteration created",
    );

    setIssue("");
    setQuantity("0");
    setCorrection("");
    setNotes("");

    onRefresh();

    setSaving(false);
  }

  async function updateAlteration(
    alteration: any,
    nextStatus: string,
  ) {
    if (!canEdit) return;

    const payload: {
      status: string;
      completed_at?: string | null;
    } = {
      status: nextStatus,
    };

    if (
      nextStatus === "completed" ||
      nextStatus === "verified"
    ) {
      payload["completed_at"] =
        new Date().toISOString();
    }

    const { error } =
      await supabase
        .from("alterations")
        .update(payload as never)
        .eq("id", alteration.id);

    if (error) {
      toast.error(
        friendlyError(error),
      );

      return;
    }

    toast.success(
      "Alteration updated",
    );

    onRefresh();
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <section className="surface p-5">
          <div className="mb-5 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-accent" />

            <h2 className="font-semibold">
              Create alteration
            </h2>
          </div>

          <div className="space-y-1.5">
            <Label>
              Issue description *
            </Label>

            <Textarea
              value={issue}
              onChange={(event) =>
                setIssue(
                  event.target.value,
                )
              }
              placeholder="Describe the alteration issue..."
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field
              label="Affected quantity"
              value={quantity}
              onChange={setQuantity}
              type="number"
            />

            <div className="space-y-1.5">
              <Label>Priority</Label>

              <Select
                value={priority}
                onValueChange={
                  setPriority
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {PRIORITIES.map(
                    (value) => (
                      <SelectItem
                        key={value}
                        value={value}
                      >
                        {titleize(value)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>

              <Select
                value={status}
                onValueChange={setStatus}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {ALTERATION_STATUSES.map(
                    (value) => (
                      <SelectItem
                        key={value}
                        value={value}
                      >
                        {titleize(value)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Correction required
              </Label>

              <Textarea
                value={correction}
                onChange={(event) =>
                  setCorrection(
                    event.target.value,
                  )
                }
                placeholder="What needs to be corrected?"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>

              <Textarea
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value,
                  )
                }
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={() =>
                void createAlteration()
              }
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}

              Create alteration
            </Button>
          </div>
        </section>
      )}

      <section className="surface p-5">
        <div className="mb-5 flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-accent" />

          <h2 className="font-semibold">
            Alteration history
          </h2>
        </div>

        {alterations.length === 0 ? (
          <Empty text="No alterations recorded." />
        ) : (
          <div className="space-y-4">
            {alterations.map(
              (alteration) => (
                <div
                  key={alteration.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {
                          alteration.issue_description
                        }
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {
                          alteration.affected_quantity
                        }{" "}
                        affected ·{" "}
                        {formatDateTime(
                          alteration.created_at,
                        )}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <StatusBadge
                        value={
                          alteration.priority
                        }
                      />

                      <StatusBadge
                        value={
                          alteration.status
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <TextInfo
                      label="Correction required"
                      value={
                        alteration.correction_required
                      }
                    />

                    <TextInfo
                      label="Notes"
                      value={
                        alteration.notes
                      }
                    />
                  </div>

                  {canEdit &&
                    alteration.status !==
                      "verified" && (
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        {alteration.status ===
                          "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void updateAlteration(
                                alteration,
                                "in_progress",
                              )
                            }
                          >
                            Start
                          </Button>
                        )}

                        {alteration.status ===
                          "in_progress" && (
                          <Button
                            size="sm"
                            onClick={() =>
                              void updateAlteration(
                                alteration,
                                "completed",
                              )
                            }
                          >
                            Mark completed
                          </Button>
                        )}

                        {alteration.status ===
                          "completed" && (
                          <Button
                            size="sm"
                            onClick={() =>
                              void updateAlteration(
                                alteration,
                                "verified",
                              )
                            }
                          >
                            Verify
                          </Button>
                        )}
                      </div>
                    )}
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ActivityTab({
  activities,
}: {
  activities: any[];
}) {
  return (
    <section className="surface p-5">
      <div className="mb-5 flex items-center gap-2">
        <Clock3 className="h-5 w-5 text-accent" />

        <h2 className="font-semibold">
          Order activity
        </h2>
      </div>

      {activities.length === 0 ? (
        <Empty text="No activity recorded yet." />
      ) : (
        <div className="space-y-5">
          {activities.map(
            (activity) => (
              <div
                key={activity.id}
                className="relative pl-7"
              >
                <div className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />

                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-medium">
                    {activity.action}
                  </p>

                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(
                      activity.created_at,
                    )}
                  </span>
                </div>

                {activity.actor_name && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    By{" "}
                    {activity.actor_name}
                  </p>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>

      <Input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        min={
          type === "number"
            ? 0
            : undefined
        }
      />
    </div>
  );
}

function Empty({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

// ============================================================
// ORDER SHEET PDF
// ============================================================

async function downloadOrderSheet(
  order: any,
  customer: any,
  items: any[],
  images: any[],
) {
  try {
    // Fetch the latest CM unit / fabric supplier values
    // immediately before generating the PDF.
    let pdfOrder = order;

    if (order?.id) {
      const {
        data: latestOrderFields,
      } = await (
        supabase.from("orders") as any
      )
        .select(
          "cm_unit, fabric_supplier",
        )
        .eq("id", order.id)
        .maybeSingle();

      if (latestOrderFields) {
        pdfOrder = {
          ...order,
          ...latestOrderFields,
        };
      }
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth =
      doc.internal.pageSize.getWidth();

    const pageHeight =
      doc.internal.pageSize.getHeight();

    const margin = 7;

    const contentWidth =
      pageWidth - margin * 2;

    const safe = (value: any) =>
      value === null ||
      value === undefined ||
      value === ""
        ? ""
        : String(value);

    const formatPdfDate = (
      value: any,
    ) => {
      if (!value) return "";

      const date = new Date(value);

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return safe(value);
      }

      return date.toLocaleDateString(
        "en-GB",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        },
      );
    };

    // ------------------------------------------------------------
    // INFO CELL
    // ------------------------------------------------------------

    const drawInfoCell = (
      x: number,
      y: number,
      width: number,
      height: number,
      label: string,
      value: any,
      options?: {
        valueColor?: [
          number,
          number,
          number,
        ];
      },
    ) => {
      const labelWidth = 42;

      doc.setDrawColor(
        75,
        75,
        75,
      );

      doc.setLineWidth(0.25);

      doc.rect(
        x,
        y,
        width,
        height,
      );

      doc.line(
        x + labelWidth,
        y,
        x + labelWidth,
        y + height,
      );

      doc.setFont(
        "helvetica",
        "bold",
      );

      doc.setFontSize(6.2);

      doc.setTextColor(
        35,
        35,
        35,
      );

      doc.text(
        label.toUpperCase(),
        x + 1.5,
        y + 4.1,
      );

      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.setFontSize(7.5);

      doc.setTextColor(
        ...(options?.valueColor ??
          [25, 25, 25]),
      );

      const text = safe(value);

      const lines =
        doc.splitTextToSize(
          text,
          Math.max(
            20,
            width -
              labelWidth -
              3,
          ),
        );

      doc.text(
        lines.slice(0, 2),
        x + labelWidth + 1.5,
        y + 4.1,
      );
    };

    // ------------------------------------------------------------
    // SIZE QUANTITY HELPER
    // ------------------------------------------------------------

    const getSizeQuantity = (
      item: any,
      size: string,
    ) => {
      const quantities =
        (item?.size_quantities ??
          {}) as Record<
          string,
          number
        >;

      const aliases: Record<
        string,
        string[]
      > = {
        XS: ["XS", "xs"],
        S: ["S", "s"],
        M: ["M", "m"],
        L: ["L", "l"],
        XL: ["XL", "xl"],
        XXL: [
          "XXL",
          "2XL",
          "2xl",
          "XXL/38",
        ],
        "3XL": [
          "3XL",
          "3xl",
          "XXXL",
        ],
        "4XL": [
          "4XL",
          "4xl",
          "XXXXL",
        ],
      };

      for (const key of
        aliases[size] ?? [size]) {
        if (
          quantities[key] !==
          undefined
        ) {
          return (
            Number(
              quantities[key],
            ) || 0
          );
        }
      }

      return 0;
    };

    // ------------------------------------------------------------
    // SIZE COLUMNS
    // ------------------------------------------------------------

    const sizes = [
      {
        key: "XS",
        label: "XS/28",
      },
      {
        key: "S",
        label: "S/30",
      },
      {
        key: "M",
        label: "M/32",
      },
      {
        key: "L",
        label: "L/34",
      },
      {
        key: "XL",
        label: "XL/36",
      },
      {
        key: "XXL",
        label: "2XL/38",
      },
      {
        key: "3XL",
        label: "3XL/40",
      },
      {
        key: "4XL",
        label: "42",
      },

      // Extra empty size column for manual entry.
      {
        key: "__EMPTY_SIZE__",
        label: "",
      },
    ];

    // ------------------------------------------------------------
    // PAGE BACKGROUND
    // ------------------------------------------------------------

    doc.setFillColor(
      255,
      255,
      255,
    );

    doc.rect(
      0,
      0,
      pageWidth,
      pageHeight,
      "F",
    );

    // ------------------------------------------------------------
    // HEADER
    // ------------------------------------------------------------

    doc.setFont(
      "helvetica",
      "bold",
    );

    doc.setFontSize(24);

    doc.setTextColor(
      220,
      176,
      35,
    );

    doc.text(
      "US",
      margin + 5,
      13,
    );

    doc.setFontSize(9.5);

    doc.setTextColor(
      20,
      20,
      20,
    );

    doc.text(
      "UNIFORM",
      margin + 17,
      9.5,
    );

    doc.text(
      "STUDIO 81",
      margin + 17,
      14,
    );

    doc.setFont(
      "helvetica",
      "bold",
    );

    doc.setFontSize(7.5);

    doc.setTextColor(
      20,
      20,
      20,
    );

    doc.text(
      "+971 67411456",
      pageWidth - margin,
      9,
      {
        align: "right",
      },
    );

    doc.setFont(
      "helvetica",
      "normal",
    );

    doc.setFontSize(7.2);

    doc.text(
      "www.efzeefashion.com",
      pageWidth - margin,
      14,
      {
        align: "right",
      },
    );

    doc.setDrawColor(
      215,
      173,
      34,
    );

    doc.setLineWidth(1.1);

    doc.line(
      margin,
      18,
      margin + 52,
      18,
    );

    doc.setDrawColor(
      190,
      190,
      190,
    );

    doc.setLineWidth(0.25);

    doc.line(
      margin + 52,
      18,
      pageWidth - margin,
      18,
    );

    // ------------------------------------------------------------
    // ORDER SHEET TITLE
    // ------------------------------------------------------------

    const titleY = 20;

    doc.setFillColor(
      205,
      208,
      212,
    );

    doc.rect(
      margin,
      titleY,
      contentWidth,
      8,
      "F",
    );

    doc.setDrawColor(
      55,
      55,
      55,
    );

    doc.rect(
      margin,
      titleY,
      contentWidth,
      8,
    );

    doc.setFont(
      "helvetica",
      "bold",
    );

    doc.setFontSize(10.5);

    doc.setTextColor(
      25,
      25,
      25,
    );

    doc.text(
      "ORDER SHEET",
      pageWidth / 2,
      titleY + 5.4,
      {
        align: "center",
      },
    );

    // ------------------------------------------------------------
    // ORDER INFORMATION GRID
    // ------------------------------------------------------------

    const infoY =
      titleY + 8;

    const leftWidth = 180;

    const rightWidth =
      contentWidth -
      leftWidth;

    const rowHeight = 6.5;

    const orderNumber =
      safe(pdfOrder.order_number);

    const startDate =
      formatPdfDate(
        pdfOrder.created_at ||
          pdfOrder.order_date,
      );

    const orderDate =
      formatPdfDate(
        pdfOrder.order_date,
      );

    const deliveryDate =
      formatPdfDate(
        pdfOrder.expected_delivery_date,
      );

    drawInfoCell(
      margin,
      infoY,
      leftWidth,
      rowHeight,
      "Order Sheet No",
      orderNumber,
    );

    drawInfoCell(
      margin + leftWidth,
      infoY,
      rightWidth,
      rowHeight,
      "Start Date",
      startDate,
    );

    drawInfoCell(
      margin,
      infoY + rowHeight,
      leftWidth,
      rowHeight,
      "Order Date",
      orderDate,
    );

    drawInfoCell(
      margin + leftWidth,
      infoY + rowHeight,
      rightWidth,
      rowHeight,
      "Delivery Date",
      deliveryDate,
      {
        valueColor: [
          220,
          40,
          40,
        ],
      },
    );

    drawInfoCell(
      margin,
      infoY + rowHeight * 2,
      leftWidth,
      rowHeight,
      "Brand",
      customer?.organization ||
        pdfOrder.product_category,
    );

    drawInfoCell(
      margin + leftWidth,
      infoY + rowHeight * 2,
      rightWidth,
      rowHeight,
      "Fabric",
      pdfOrder.fabric_details,
    );

    const cmUnit =
      (pdfOrder as Record<
        string,
        unknown
      >)["cm_unit"] ??
      (pdfOrder as Record<
        string,
        unknown
      >)["cmUnit"] ??
      "";

    const fabricSupplier =
      (pdfOrder as Record<
        string,
        unknown
      >)["fabric_supplier"] ??
      (pdfOrder as Record<
        string,
        unknown
      >)["fabricSupplier"] ??
      "";

    drawInfoCell(
      margin,
      infoY + rowHeight * 3,
      leftWidth,
      rowHeight,
      "CM Unit",
      cmUnit,
    );

    drawInfoCell(
      margin + leftWidth,
      infoY + rowHeight * 3,
      rightWidth,
      rowHeight,
      "Fabric Supplier",
      fabricSupplier,
    );

    const totalAmount =
      items.reduce(
        (sum, item) =>
          sum +
          (Number(
            item.total_price,
          ) || 0),
        0,
      );

    drawInfoCell(
      margin,
      infoY + rowHeight * 4,
      leftWidth,
      rowHeight,
      "CM Price",
      totalAmount
        ? currency(totalAmount)
        : "0",
    );

    drawInfoCell(
      margin + leftWidth,
      infoY + rowHeight * 4,
      rightWidth,
      rowHeight,
      "Pattern Followed",
      pdfOrder.customization_details,
    );

    // ------------------------------------------------------------
    // SIZE-WISE QUANTITY TABLE
    // ------------------------------------------------------------

    const tableY =
      infoY + rowHeight * 5;

    const sizeHeaders =
      sizes.map(
        (size) =>
          size.label,
      );

    const tableBody =
      Array.from(
        { length: 3 },
        (_, index) => {
          const item =
            items[index];

          if (!item) {
            return [
              String(index + 1),
              "",
              ...sizes.map(
                () => "",
              ),
              "",
            ];
          }

          return [
            String(index + 1),
            safe(
              item.product_name,
            ),

            ...sizes.map(
              (size) => {
                // The extra size column remains
                // blank for manual entry.
                if (
                  size.key ===
                  "__EMPTY_SIZE__"
                ) {
                  return "";
                }

                const quantity =
                  getSizeQuantity(
                    item,
                    size.key,
                  );

                return quantity >
                  0
                  ? String(
                      quantity,
                    )
                  : "";
              },
            ),

            safe(item.quantity),
          ];
        },
      );

    // ------------------------------------------------------------
    // FINAL TABLE WIDTH / ALIGNMENT FIX
    // ------------------------------------------------------------
    //
    // The table must occupy exactly the same
    // width as every other PDF section.
    //
    // S/N           = 15 mm
    // Description   = 73 mm
    // Size columns  = equal calculated widths
    // Total         = 22 mm
    //
    // There are 9 size columns INCLUDING
    // the extra blank manual-entry column.
    // ------------------------------------------------------------

    const serialColumnWidth = 15;
    const descriptionColumnWidth = 73;
    const totalColumnWidth = 22;

    // Calculate the size-column width from the exact printable width.
    // This keeps every size box identical and makes the table outer border
    // line up exactly with the surrounding PDF sections.
    const sizeColumnWidth =
      (contentWidth -
        serialColumnWidth -
        descriptionColumnWidth -
        totalColumnWidth) /
      sizes.length;

    const sizeColumnStyles = Object.fromEntries(
      sizes.map((_, index) => [
        index + 2,
        {
          cellWidth: sizeColumnWidth,
          halign: "center",
        },
      ]),
    );

    autoTable(doc, {
      startY: tableY,

      head: [
        [
          "S/N",

          "ITEM DESCRIPTION",

          {
            content:
              "SIZE-WISE QUANTITY",

            colSpan:
              sizes.length,

            styles: {
              halign: "center",
            },
          },

          "TOTAL",
        ],

        [
          "",
          "",
          ...sizeHeaders,
          "",
        ],
      ],

      body: tableBody,

      theme: "grid",

      margin: {
        left: margin,
        right: margin,
      },

      // Exact same width as the surrounding PDF boxes.
      tableWidth: contentWidth,
      tableLineColor: [75, 75, 75],
      tableLineWidth: 0.25,

      styles: {
        font: "helvetica",
        fontSize: 7,
        textColor: [
          25,
          25,
          25,
        ],
        lineColor: [
          75,
          75,
          75,
        ],
        lineWidth: 0.25,
        cellPadding: 1.8,
        valign: "middle",
        minCellHeight: 13,
      },

      headStyles: {
        fillColor: [
          205,
          208,
          212,
        ],
        textColor: [
          25,
          25,
          25,
        ],
        fontStyle: "bold",
        fontSize: 6.4,
        halign: "center",
        valign: "middle",
      },

      bodyStyles: {
        minCellHeight: 13,
      },

      columnStyles: {
        0: {
          cellWidth: serialColumnWidth,
          halign: "center",
        },
        1: {
          cellWidth: descriptionColumnWidth,
          fontStyle: "bold",
        },
        ...sizeColumnStyles,
        [sizes.length + 2]: {
          cellWidth: totalColumnWidth,
          halign: "center",
        },
      },

      didParseCell: (
        data,
      ) => {
        if (
          data.section ===
            "head" &&
          data.row.index === 0
        ) {
          data.cell.styles.minCellHeight =
            7;
        }

        if (
          data.section ===
            "head" &&
          data.row.index === 1
        ) {
          data.cell.styles.minCellHeight =
            7;
        }

        if (
          data.section ===
          "body"
        ) {
          data.cell.styles.minCellHeight =
            13;
        }
      },
    });

    const tableFinalY =
      (doc as any).lastAutoTable?.finalY ??
      tableY + 50;

    // AutoTable already uses the exact printable width and explicit
    // tableLine settings above, so no second outer rectangle is needed.

    let y = tableFinalY + 1;

    // ------------------------------------------------------------
    // PRODUCT IMAGES + REMARKS
    // ------------------------------------------------------------

    const lowerHeight =
      pageHeight -
      y -
      13;

    const imageSectionHeight =
      Math.max(
        38,
        lowerHeight * 0.55,
      );

    const remarksHeight =
      Math.max(
        28,
        lowerHeight -
          imageSectionHeight,
      );

    // ------------------------------------------------------------
    // PRODUCT IMAGES BOX
    // ------------------------------------------------------------

    doc.setDrawColor(
      60,
      60,
      60,
    );

    doc.rect(
      margin,
      y,
      contentWidth,
      imageSectionHeight,
    );

    doc.setFont(
      "helvetica",
      "bold",
    );

    doc.setFontSize(7);

    doc.setTextColor(
      30,
      30,
      30,
    );

    doc.text(
      "PRODUCT IMAGES:",
      margin + 2,
      y + 4.5,
    );

    let imageX =
      margin + 2;

    let imageY =
      y + 7;

    const imageW = 34;
    const imageH = 26;

    const imageRows =
      (images ?? []).slice(
        0,
        6,
      );

    for (const image of imageRows) {
      try {
        const {
          data,
          error,
        } = await supabase.storage
          .from(
            "production-images",
          )
          .createSignedUrl(
            image.image_path,
            3600,
          );

        if (
          error ||
          !data?.signedUrl
        ) {
          continue;
        }

        const response =
          await fetch(
            data.signedUrl,
          );

        if (!response.ok) {
          continue;
        }

        const blob =
          await response.blob();

        const imageData =
          await new Promise<string>(
            (
              resolve,
              reject,
            ) => {
              const reader =
                new FileReader();

              reader.onloadend =
                () => {
                  if (
                    typeof reader.result ===
                    "string"
                  ) {
                    resolve(
                      reader.result,
                    );
                  } else {
                    reject(
                      new Error(
                        "Unable to read image",
                      ),
                    );
                  }
                };

              reader.onerror =
                () =>
                  reject(
                    new Error(
                      "Unable to read image",
                    ),
                  );

              reader.readAsDataURL(
                blob,
              );
            },
          );

        const imageFormat =
          blob.type.includes(
            "png",
          )
            ? "PNG"
            : "JPEG";

        doc.addImage(
          imageData,
          imageFormat,
          imageX,
          imageY,
          imageW,
          imageH,
          undefined,
          "FAST",
        );

        imageX +=
          imageW + 4;

        if (
          imageX +
            imageW >
          pageWidth -
            margin -
            2
        ) {
          imageX =
            margin + 2;

          imageY +=
            imageH + 4;
        }
      } catch {
        // Keep the order sheet usable
        // if an image cannot be downloaded.
      }
    }

    // ------------------------------------------------------------
    // REMARKS BOX
    // ------------------------------------------------------------

    y +=
      imageSectionHeight;

    doc.rect(
      margin,
      y,
      contentWidth,
      remarksHeight,
    );

    doc.setFont(
      "helvetica",
      "bold",
    );

    doc.setFontSize(7);

    doc.setTextColor(
      30,
      30,
      30,
    );

    doc.text(
      "COMMENTS:",
      margin + 2,
      y + 4.5,
    );

    // Only the actual Remarks field entered
    // while creating the order is displayed.
    const remarksText =
      safe(
        pdfOrder.remarks,
      ).trim();

    if (remarksText) {
      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.setFontSize(7.5);

      const remarkLines =
        remarksText
          .split(/\r?\n/)
          .map(
            (line: string) =>
              line.trim(),
          )
          .filter(Boolean);

      let remarkY =
        y + 9;

      remarkLines.slice(0, 5).forEach(
        (
          remark: string,
          index: number,
        ) => {
          const numberText =
            `${index + 1}.`;

          doc.text(
            numberText,
            margin + 2,
            remarkY,
          );

          const lines =
            doc.splitTextToSize(
              remark,
              contentWidth -
                14,
            );

          doc.text(
            lines.slice(0, 3),
            margin + 8,
            remarkY,
          );

          remarkY +=
            Math.max(
              4.2,
              lines
                .slice(
                  0,
                  3,
                )
                .length *
                4.2,
            );
        },
      );
    }

    // ------------------------------------------------------------
    // FOOTER
    // ------------------------------------------------------------

    const footerY =
      pageHeight - 4;

    doc.setFont(
      "helvetica",
      "normal",
    );

    doc.setFontSize(6.5);

    doc.setTextColor(
      80,
      80,
      80,
    );

    doc.text(
      "EFZEE FASHION TAILORING LLC, SHOWROOM NO.1, FASHION MART, INDUSTRIAL AREA-1, AJMAN, UAE",
      pageWidth / 2,
      footerY,
      {
        align: "center",
      },
    );

    // ------------------------------------------------------------
    // SAVE PDF
    // ------------------------------------------------------------

    const filename =
      `${safe(
        pdfOrder.order_number ||
          "Order",
      ).replace(
        /[^a-zA-Z0-9-_]/g,
        "_",
      )}_Order_Sheet.pdf`;

    doc.save(filename);

    toast.success(
      "Order Sheet downloaded successfully",
    );
  } catch (error) {
    console.error(
      "Order Sheet PDF generation failed:",
      error,
    );

    toast.error(
      "Failed to generate Order Sheet PDF",
    );
  }
}