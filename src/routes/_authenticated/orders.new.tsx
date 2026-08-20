import { useMemo, useState } from "react";

import type { ChangeEvent } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";

import {
  Check,
  ImagePlus,
  Loader2,
  Plus,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/hooks/use-auth";

import { PageHeader } from "@/components/page-header";

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

import {
  PRIORITIES,
  SIZES,
  friendlyError,
  titleize,
} from "@/lib/domain";

import { logActivity, notifyStaff } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated/orders/new")({
  component: NewOrderPage,
});

const STEPS = [
  "Customer",
  "Order info",
  "Product",
  "Sizes",
  "Additional",
  "Review",
];

const SLEEVE_TYPES = [
  "Sleeveless",
  "Cap Sleeve",
  "Short Sleeve",
  "Elbow Sleeve",
  "3/4 Sleeve",
  "Full Sleeve",
  "Long Sleeve",
  "Bell Sleeve",
  "Puff Sleeve",
  "Bishop Sleeve",
  "Raglan Sleeve",
  "Batwing Sleeve",
  "Dolman Sleeve",
  "Lantern Sleeve",
  "Flare Sleeve",
  "Cuffed Sleeve",
  "Roll-Up Sleeve",
  "Cold-Shoulder Sleeve",
  "Off-Shoulder Sleeve",
  "Petal Sleeve",
  "Tulip Sleeve",
  "Kimono Sleeve",
  "Leg-of-Mutton Sleeve",
  "Juliet Sleeve",
  "Cape Sleeve",
  "Split Sleeve",
  "Slit Sleeve",
  "Trumpet Sleeve",
  "Layered Sleeve",
  "Other",
];

function getCapturedTime() {
  return new Date().toISOString();
}

function formatCapturedTime(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, canSell, role } = useAuth();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [customerId, setCustomerId] = useState("");

  const [newCustomer, setNewCustomer] = useState({
    customer_name: "",
    organization: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    address: "",
  });

  const [creatingCustomer, setCreatingCustomer] = useState(false);

  /*
   * Time is captured automatically when the order creation page is opened.
   * We do not ask the user to enter this manually.
   */
  const [timeCaptured] = useState(getCapturedTime);

  const [order, setOrder] = useState({
    order_number: `ORD-${Date.now().toString().slice(-6)}`,
    order_date: new Date().toISOString().slice(0, 10),
    expected_delivery_date: "",
    priority: "normal",

    product_name: "",

    /*
     * product_category is retained internally because the existing
     * database/order item structure expects this field.
     * It now stores the selected sleeve type.
     */
    product_category: "Short Sleeve",

    color: "",

    special_instructions: "",
    remarks: "",
  });

  /*
   * Repeatable Product Info fields.
   *
   * The first row is always available.
   * Clicking + adds another row.
   */
  const [fabricDetails, setFabricDetails] = useState<string[]>([""]);

  const [fabricSuppliers, setFabricSuppliers] = useState<string[]>([""]);

  const [cmUnits, setCmUnits] = useState<string[]>([""]);

  const [cmPrices, setCmPrices] = useState<string[]>(["0"]);

  const [customizations, setCustomizations] = useState<string[]>([""]);

  const [accessories, setAccessories] = useState<string[]>([""]);

  const [sizes, setSizes] = useState<Record<string, string>>(
    Object.fromEntries(SIZES.map((size) => [size, ""])),
  );

  const [customSizes, setCustomSizes] = useState<
    Array<{ label: string; quantity: string }>
  >([]);

  /*
   * Reference/product images selected while the order is being created.
   * They are uploaded only after the order row exists.
   */
  const [referenceImages, setReferenceImages] = useState<File[]>([]);

  const [imagePreviews, setImagePreviews] = useState<
    Array<{ file: File; url: string }>
  >([]);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, customer_code, customer_name, organization")
        .order("customer_name");

      if (error) throw error;

      return data;
    },
  });

  const sizeEntries = useMemo(() => {
    const entries: Record<string, number> = {};

    for (const [size, value] of Object.entries(sizes)) {
      const quantity = Number(value);

      if (quantity > 0) {
        entries[size] = quantity;
      }
    }

    for (const row of customSizes) {
      const quantity = Number(row.quantity);

      if (row.label.trim() && quantity > 0) {
        entries[row.label.trim()] = quantity;
      }
    }

    return entries;
  }, [sizes, customSizes]);

  const totalQuantity = Object.values(sizeEntries).reduce(
    (sum, value) => sum + value,
    0,
  );

  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );

  /*
   * Convert repeatable values into the existing database text fields.
   */
  const fabricDetailsValue = fabricDetails
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");

  const fabricSupplierValue = fabricSuppliers
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");

  const cmUnitValue = cmUnits
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");

  const customizationValue = customizations
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");

  const accessoriesValue = accessories
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");

  /*
   * Existing orders/order_items schema has one numeric unit_price field.
   * Therefore the first CM price is used as the order's unit price.
   */
  const primaryCmPrice = Number(cmPrices[0]) || 0;

  function addRepeatableField(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    defaultValue = "",
  ) {
    setter((current) => [...current, defaultValue]);
  }

  function removeRepeatableField(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
  ) {
    setter((current) => {
      /*
       * Keep at least one input available.
       */
      if (current.length === 1) {
        return [""];
      }

      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function updateRepeatableField(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) {
    setter((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    );
  }

  function addReferenceImages(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    event.currentTarget.value = "";

    const imageFiles = selectedFiles.filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length !== selectedFiles.length) {
      toast.error("Only image files can be added.");
    }

    if (!imageFiles.length) return;

    const available = Math.max(0, 6 - referenceImages.length);

    const filesToAdd = imageFiles.slice(0, available);

    if (filesToAdd.length < imageFiles.length) {
      toast.error("You can add up to 6 reference images.");
    }

    const nextPreviews = filesToAdd.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    setReferenceImages((current) => [...current, ...filesToAdd]);

    setImagePreviews((current) => [
      ...current,
      ...nextPreviews,
    ]);
  }

  function removeReferenceImage(index: number) {
    setImagePreviews((current) => {
      const preview = current[index];

      if (preview) {
        URL.revokeObjectURL(preview.url);
      }

      return current.filter(
        (_, itemIndex) => itemIndex !== index,
      );
    });

    setReferenceImages((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  if (!canSell) {
    return (
      <div className="surface p-8 text-center">
        <p className="font-medium">Sales access required</p>

        <p className="mt-1 text-sm text-muted-foreground">
          Only sales staff and administrators can create orders.
        </p>
      </div>
    );
  }

  async function createCustomer() {
    if (!newCustomer.customer_name.trim()) {
      toast.error("Customer name is required");
      return;
    }

    if (
      newCustomer.email &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newCustomer.email)
    ) {
      toast.error("Enter a valid email address");
      return;
    }

    setBusy(true);

    const code = `CUS-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`;

    const { data, error } = await supabase
      .from("customers")
      .insert({
        ...newCustomer,
        customer_code: code,
      })
      .select("id")
      .single();

    setBusy(false);

    if (error) {
      toast.error(friendlyError(error));
      return;
    }

    toast.success("Customer created");

    await queryClient.invalidateQueries({
      queryKey: ["customers"],
    });

    setCustomerId(data.id);

    setCreatingCustomer(false);
  }

  function validateStep(current: number): boolean {
    if (current === 0 && !customerId) {
      toast.error("Select or create a customer");
      return false;
    }

    if (current === 1) {
      if (!order.order_number.trim()) {
        toast.error("Order number is required");
        return false;
      }

      if (
        order.expected_delivery_date &&
        order.expected_delivery_date < order.order_date
      ) {
        toast.error("Delivery date cannot be before the order date");
        return false;
      }
    }

    if (current === 2 && !order.product_name.trim()) {
      toast.error("Product name is required");
      return false;
    }

    if (current === 3 && totalQuantity <= 0) {
      toast.error("Enter at least one size quantity");
      return false;
    }

    return true;
  }

  async function saveReferenceImages(orderId: string) {
    if (!user?.id || referenceImages.length === 0) return;

    const failedFiles: string[] = [];

    for (const file of referenceImages) {
      try {
        const extension =
          file.name.split(".").pop()?.toLowerCase() || "jpg";

        const safeExtension = /^[a-z0-9]+$/.test(extension)
          ? extension
          : "jpg";

        const path = `${orderId}/reference-${crypto.randomUUID()}.${safeExtension}`;

        const { error: uploadError } = await supabase.storage
          .from("production-images")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "image/jpeg",
          });

        if (uploadError) throw uploadError;

        const { error: rowError } = await supabase
          .from("production_images")
          .insert({
            order_id: orderId,
            stage: "fabric_procurement" as never,
            image_path: path,
            description: `Reference image - ${file.name}`,
            uploaded_by: user.id,
          });

        if (rowError) {
          await supabase.storage
            .from("production-images")
            .remove([path]);

          throw rowError;
        }
      } catch (error) {
        console.error("Reference image upload failed:", error);

        failedFiles.push(file.name);
      }
    }

    if (failedFiles.length > 0) {
      throw new Error(
        `Order was created, but ${failedFiles.length} reference image${
          failedFiles.length === 1 ? "" : "s"
        } could not be saved: ${failedFiles.join(", ")}`,
      );
    }
  }

  async function submit(status: "draft" | "confirmed") {
    if (
      !validateStep(0) ||
      !validateStep(1) ||
      !validateStep(2) ||
      !validateStep(3)
    ) {
      return;
    }

    setBusy(true);

    /*
     * Use the first CM price as the existing order unit_price.
     */
    const unitPrice = primaryCmPrice;

    const orderPayload = {
      order_number: order.order_number.trim(),

      /*
       * Batch number has intentionally been removed.
       */

      customer_id: customerId,

      created_by: user?.id ?? null,

      order_date: order.order_date,

      expected_delivery_date:
        order.expected_delivery_date || null,

      status,

      priority: order.priority as never,

      product_name: order.product_name.trim(),

      /*
       * Existing database field retained for compatibility.
       * It now stores the selected sleeve type.
       */
      product_category: order.product_category,

      total_quantity: totalQuantity,

      fabric_details:
        fabricDetailsValue || null,

      fabric_supplier:
        fabricSupplierValue || null,

      cm_unit:
        cmUnitValue || null,

      accessory_details:
        accessoriesValue || null,

      customization_details:
        customizationValue || null,

      special_instructions:
        order.special_instructions || null,

      remarks:
        order.remarks || null,
    } as any;

    const { data, error } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select("id, order_number")
      .single();

    if (error) {
      setBusy(false);

      toast.error(friendlyError(error));

      return;
    }

    const { error: itemError } = await supabase
      .from("order_items")
      .insert({
        order_id: data.id,

        product_name:
          order.product_name.trim(),

        product_type:
          order.product_category,

        quantity:
          totalQuantity,

        unit_price:
          unitPrice,

        total_price:
          unitPrice * totalQuantity,

        fabric:
          fabricDetailsValue || null,

        color:
          order.color || null,

        customization:
          customizationValue || null,

        size_quantities:
          sizeEntries as never,
      });

    if (itemError) {
      toast.error(friendlyError(itemError));
    }

    let imageSaveError: unknown = null;

    if (referenceImages.length > 0) {
      try {
        await saveReferenceImages(data.id);
      } catch (error) {
        imageSaveError = error;
      }
    }

    await logActivity({
      orderId: data.id,

      action: `Order ${
        status === "draft" ? "saved as draft" : "created"
      } by ${profile?.full_name ?? "staff"}`,

      actorId: user?.id ?? null,

      actorName: profile?.full_name ?? null,
    });

    if (status === "confirmed") {
      await notifyStaff({
        title: "New order confirmed",

        message: `${data.order_number} · ${order.product_name} (${totalQuantity} pcs)`,

        type: "order",

        orderId: data.id,
      });
    }

    await queryClient.invalidateQueries({
      queryKey: ["orders"],
    });

    await queryClient.invalidateQueries({
      queryKey: ["dashboard"],
    });

    setBusy(false);

    if (imageSaveError) {
      toast.error(
        imageSaveError instanceof Error
          ? imageSaveError.message
          : "Order created, but reference images could not be saved.",
      );
    } else {
      toast.success(
        status === "draft"
          ? "Draft saved"
          : "Order created successfully",
      );
    }

    void navigate({
      to: "/orders/$orderId",
      params: {
        orderId: data.id,
      },
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="New order"
        description="Capture the full specification in six steps."
      />

      <ol className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() =>
                index < step && setStep(index)
              }
              className={
                index === step
                  ? "rounded-full border border-accent bg-accent/15 px-3 py-1 text-xs font-medium text-accent-foreground"
                  : index < step
                    ? "rounded-full border px-3 py-1 text-xs text-muted-foreground"
                    : "rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground/60"
              }
            >
              {index < step ? (
                <Check className="mr-1 inline h-3 w-3" />
              ) : null}

              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="surface p-5">
        {step === 0 ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Existing customer</Label>

              <Select
                value={customerId}
                onValueChange={setCustomerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Search and select a customer" />
                </SelectTrigger>

                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem
                      key={customer.id}
                      value={customer.id}
                    >
                      {customer.customer_name} ·{" "}
                      {customer.customer_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!creatingCustomer ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCreatingCustomer(true)
                }
              >
                + New customer
              </Button>
            ) : (
              <div className="rounded-md border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["customer_name", "Customer name"],
                      ["organization", "Organization"],
                      ["phone", "Phone"],
                      ["email", "Email"],
                      ["city", "City"],
                      ["state", "State"],
                    ] as const
                  ).map(([field, label]) => (
                    <div
                      key={field}
                      className="space-y-1.5"
                    >
                      <Label htmlFor={field}>
                        {label}
                      </Label>

                      <Input
                        id={field}
                        value={newCustomer[field]}
                        onChange={(event) =>
                          setNewCustomer((current) => ({
                            ...current,
                            [field]:
                              event.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="address">
                    Address
                  </Label>

                  <Textarea
                    id="address"
                    value={newCustomer.address}
                    onChange={(event) =>
                      setNewCustomer((current) => ({
                        ...current,
                        address:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={createCustomer}
                    disabled={busy}
                  >
                    Save customer
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setCreatingCustomer(false)
                    }
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="order_number">
                Order number *
              </Label>

              <Input
                id="order_number"
                value={order.order_number}
                onChange={(event) =>
                  setOrder((current) => ({
                    ...current,
                    order_number:
                      event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Time captured</Label>

              <Input
                value={formatCapturedTime(
                  timeCaptured,
                )}
                readOnly
                className="bg-muted/50"
              />

              <p className="text-xs text-muted-foreground">
                Automatically captured when this order was started.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="order_date">
                Order date
              </Label>

              <Input
                id="order_date"
                type="date"
                value={order.order_date}
                onChange={(event) =>
                  setOrder((current) => ({
                    ...current,
                    order_date:
                      event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delivery_date">
                Expected delivery
              </Label>

              <Input
                id="delivery_date"
                type="date"
                value={
                  order.expected_delivery_date
                }
                onChange={(event) =>
                  setOrder((current) => ({
                    ...current,
                    expected_delivery_date:
                      event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>

              <Select
                value={order.priority}
                onValueChange={(value) =>
                  setOrder((current) => ({
                    ...current,
                    priority: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {PRIORITIES.map((value) => (
                    <SelectItem
                      key={value}
                      value={value}
                    >
                      {titleize(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="product_name">
                Product name *
              </Label>

              <Input
                id="product_name"
                value={order.product_name}
                onChange={(event) =>
                  setOrder((current) => ({
                    ...current,
                    product_name:
                      event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Sleeve type</Label>

              <Select
                value={order.product_category}
                onValueChange={(value) =>
                  setOrder((current) => ({
                    ...current,
                    product_category:
                      value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sleeve type" />
                </SelectTrigger>

                <SelectContent>
                  {SLEEVE_TYPES.map((value) => (
                    <SelectItem
                      key={value}
                      value={value}
                    >
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* FABRIC DETAILS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fabric details</Label>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() =>
                    addRepeatableField(
                      setFabricDetails,
                    )
                  }
                  title="Add fabric detail"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {fabricDetails.map(
                (value, index) => (
                  <div
                    key={index}
                    className="flex gap-2"
                  >
                    <Input
                      id={`fabric-${index}`}
                      value={value}
                      placeholder={
                        index === 0
                          ? "Enter fabric details"
                          : "Add another fabric"
                      }
                      onChange={(event) =>
                        updateRepeatableField(
                          setFabricDetails,
                          index,
                          event.target.value,
                        )
                      }
                    />

                    {fabricDetails.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() =>
                          removeRepeatableField(
                            setFabricDetails,
                            index,
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                )
              )}
            </div>

            {/* FABRIC SUPPLIER */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fabric supplier</Label>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() =>
                    addRepeatableField(
                      setFabricSuppliers,
                    )
                  }
                  title="Add fabric supplier"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {fabricSuppliers.map(
                (value, index) => (
                  <div
                    key={index}
                    className="flex gap-2"
                  >
                    <Input
                      id={`fabric-supplier-${index}`}
                      value={value}
                      placeholder={
                        index === 0
                          ? "Enter fabric supplier"
                          : "Add another supplier"
                      }
                      onChange={(event) =>
                        updateRepeatableField(
                          setFabricSuppliers,
                          index,
                          event.target.value,
                        )
                      }
                    />

                    {fabricSuppliers.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() =>
                          removeRepeatableField(
                            setFabricSuppliers,
                            index,
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                )
              )}
            </div>

            {/* CM UNIT */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>CM unit</Label>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() =>
                    addRepeatableField(
                      setCmUnits,
                    )
                  }
                  title="Add CM unit"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {cmUnits.map(
                (value, index) => (
                  <div
                    key={index}
                    className="flex gap-2"
                  >
                    <Input
                      id={`cm-unit-${index}`}
                      value={value}
                      placeholder={
                        index === 0
                          ? "Enter CM unit"
                          : "Add another CM unit"
                      }
                      onChange={(event) =>
                        updateRepeatableField(
                          setCmUnits,
                          index,
                          event.target.value,
                        )
                      }
                    />

                    {cmUnits.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() =>
                          removeRepeatableField(
                            setCmUnits,
                            index,
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                )
              )}
            </div>

            {/* COLOUR */}
            <div className="space-y-1.5">
              <Label htmlFor="color">
                Colour
              </Label>

              <Input
                id="color"
                value={order.color}
                onChange={(event) =>
                  setOrder((current) => ({
                    ...current,
                    color: event.target.value,
                  }))
                }
              />
            </div>

            {/* ACCESSORIES */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Accessories</Label>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() =>
                    addRepeatableField(
                      setAccessories,
                    )
                  }
                  title="Add accessory"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {accessories.map(
                (value, index) => (
                  <div
                    key={index}
                    className="flex gap-2"
                  >
                    <Input
                      id={`accessories-${index}`}
                      value={value}
                      placeholder={
                        index === 0
                          ? "Enter accessories"
                          : "Add another accessory"
                      }
                      onChange={(event) =>
                        updateRepeatableField(
                          setAccessories,
                          index,
                          event.target.value,
                        )
                      }
                    />

                    {accessories.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() =>
                          removeRepeatableField(
                            setAccessories,
                            index,
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                )
              )}
            </div>

            {/* CUSTOMIZATION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Customization</Label>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() =>
                    addRepeatableField(
                      setCustomizations,
                    )
                  }
                  title="Add customization"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {customizations.map(
                (value, index) => (
                  <div
                    key={index}
                    className="flex gap-2"
                  >
                    <Input
                      id={`customization-${index}`}
                      value={value}
                      placeholder={
                        index === 0
                          ? "Enter customization"
                          : "Add another customization"
                      }
                      onChange={(event) =>
                        updateRepeatableField(
                          setCustomizations,
                          index,
                          event.target.value,
                        )
                      }
                    />

                    {customizations.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() =>
                          removeRepeatableField(
                            setCustomizations,
                            index,
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                )
              )}
            </div>

            {/* CM PRICE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>CM Price (AED)</Label>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() =>
                    addRepeatableField(
                      setCmPrices,
                      "0",
                    )
                  }
                  title="Add CM price"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {cmPrices.map(
                (value, index) => (
                  <div
                    key={index}
                    className="flex gap-2"
                  >
                    <Input
                      id={`cm-price-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={value}
                      placeholder={
                        index === 0
                          ? "Enter CM price"
                          : "Add another CM price"
                      }
                      onChange={(event) =>
                        updateRepeatableField(
                          setCmPrices,
                          index,
                          event.target.value,
                        )
                      }
                    />

                    {cmPrices.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() =>
                          removeRepeatableField(
                            setCmPrices,
                            index,
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                )
              )}

              {cmPrices.length > 1 ? (
                <p className="text-xs text-muted-foreground">
                  The first CM price is used as the
                  order's main unit price.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <div className="grid gap-3 sm:grid-cols-4">
              {SIZES.map((size) => (
                <div
                  key={size}
                  className="space-y-1.5"
                >
                  <Label htmlFor={`size-${size}`}>
                    {size}
                  </Label>

                  <Input
                    id={`size-${size}`}
                    type="number"
                    min="0"
                    value={sizes[size] ?? ""}
                    onChange={(event) =>
                      setSizes((current) => ({
                        ...current,
                        [size]:
                          event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            {customSizes.map(
              (row, index) => (
                <div
                  key={index}
                  className="mt-3 flex gap-3"
                >
                  <Input
                    placeholder="Custom size label"
                    value={row.label}
                    onChange={(event) =>
                      setCustomSizes(
                        (current) =>
                          current.map(
                            (
                              item,
                              itemIndex,
                            ) =>
                              itemIndex ===
                              index
                                ? {
                                    ...item,
                                    label:
                                      event.target
                                        .value,
                                  }
                                : item,
                          ),
                      )
                    }
                  />

                  <Input
                    type="number"
                    min="0"
                    placeholder="Qty"
                    value={row.quantity}
                    onChange={(event) =>
                      setCustomSizes(
                        (current) =>
                          current.map(
                            (
                              item,
                              itemIndex,
                            ) =>
                              itemIndex ===
                              index
                                ? {
                                    ...item,
                                    quantity:
                                      event.target
                                        .value,
                                  }
                                : item,
                          ),
                      )
                    }
                  />
                </div>
              ),
            )}

            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCustomSizes(
                    (current) => [
                      ...current,
                      {
                        label: "",
                        quantity: "",
                      },
                    ],
                  )
                }
              >
                + Custom size
              </Button>

              <p className="text-sm">
                Total quantity:{" "}
                <span className="font-display text-lg font-bold">
                  {totalQuantity}
                </span>
              </p>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="instructions">
                Special instructions
              </Label>

              <Textarea
                id="instructions"
                rows={3}
                value={order.special_instructions}
                onChange={(event) =>
                  setOrder((current) => ({
                    ...current,
                    special_instructions:
                      event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remarks">
                Remarks
              </Label>

              <Textarea
                id="remarks"
                rows={3}
                value={order.remarks}
                onChange={(event) =>
                  setOrder((current) => ({
                    ...current,
                    remarks:
                      event.target.value,
                  }))
                }
              />
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ImagePlus className="h-5 w-5 text-accent" />

                    <Label className="text-sm font-semibold">
                      Product / reference images
                    </Label>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Add up to 6 images. They will be
                    saved to the order and included in
                    the Order Sheet PDF.
                  </p>
                </div>

                <span className="text-xs text-muted-foreground">
                  {referenceImages.length}/6
                </span>
              </div>

              <label
                htmlFor="reference-image-upload"
                className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground transition hover:bg-muted/50"
              >
                <ImagePlus className="mr-2 h-5 w-5" />

                Click to add reference images
              </label>

              <Input
                id="reference-image-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={
                  referenceImages.length >= 6 ||
                  busy
                }
                onChange={addReferenceImages}
              />

              {imagePreviews.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {imagePreviews.map(
                    (preview, index) => (
                      <div
                        key={`${preview.file.name}-${index}`}
                        className="group relative overflow-hidden rounded-lg border"
                      >
                        <img
                          src={preview.url}
                          alt={preview.file.name}
                          className="aspect-square w-full object-cover"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            removeReferenceImage(
                              index,
                            )
                          }
                          className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                          aria-label={`Remove ${preview.file.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>

                        <div className="truncate border-t bg-background px-2 py-1.5 text-[11px]">
                          {preview.file.name}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  No reference images selected yet.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="label-caps">
                  Customer
                </p>

                <p className="mt-1 font-medium">
                  {selectedCustomer?.customer_name ??
                    "—"}
                </p>

                <p className="text-muted-foreground">
                  {selectedCustomer?.organization ??
                    ""}
                </p>
              </div>

              <div>
                <p className="label-caps">
                  Order
                </p>

                <p className="mt-1 font-medium">
                  {order.order_number}
                </p>

                <p className="text-muted-foreground">
                  {titleize(order.priority)} priority
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Time captured:{" "}
                  <span className="font-medium">
                    {formatCapturedTime(
                      timeCaptured,
                    )}
                  </span>
                </p>
              </div>

              <div>
                <p className="label-caps">
                  Product
                </p>

                <p className="mt-1 font-medium">
                  {order.product_name}
                </p>

                <p className="text-muted-foreground">
                  Sleeve type:{" "}
                  {order.product_category}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Fabric:{" "}
                  {fabricDetailsValue ||
                    "—"}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Fabric supplier:{" "}
                  {fabricSupplierValue ||
                    "—"}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  CM unit:{" "}
                  {cmUnitValue || "—"}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  CM price:{" "}
                  {cmPrices
                    .filter(
                      (value) =>
                        value.trim() !== "",
                    )
                    .join(", ") || "—"}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Customization:{" "}
                  {customizationValue ||
                    "—"}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Accessories:{" "}
                  {accessoriesValue ||
                    "—"}
                </p>
              </div>

              <div>
                <p className="label-caps">
                  Delivery
                </p>

                <p className="mt-1 font-medium">
                  {order.expected_delivery_date ||
                    "Not set"}
                </p>

                <p className="text-muted-foreground">
                  Ordered {order.order_date}
                </p>
              </div>
            </div>

            <div>
              <p className="label-caps mb-2">
                Size breakdown
              </p>

              <div className="flex flex-wrap gap-2">
                {Object.entries(sizeEntries).map(
                  ([size, quantity]) => (
                    <span
                      key={size}
                      className="rounded-md border px-2.5 py-1 text-xs"
                    >
                      {size}:{" "}
                      <strong>
                        {quantity}
                      </strong>
                    </span>
                  ),
                )}
              </div>

              <p className="mt-2">
                Total:{" "}
                <strong>{totalQuantity}</strong>{" "}
                pieces
              </p>
            </div>

            <div>
              <p className="label-caps mb-2">
                Reference images
              </p>

              <p className="text-muted-foreground">
                {referenceImages.length > 0
                  ? `${referenceImages.length} image${
                      referenceImages.length === 1
                        ? ""
                        : "s"
                    } will be saved with the order and included in the PDF.`
                  : "No reference images selected."}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button
            variant="ghost"
            onClick={() =>
              step === 0
                ? navigate({ to: "/orders" })
                : setStep(step - 1)
            }
            disabled={busy}
          >
            {step === 0 ? "Cancel" : "Back"}
          </Button>

          <div className="flex gap-2">
            {step === STEPS.length - 1 ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    void submit("draft")
                  }
                  disabled={busy}
                >
                  Save draft
                </Button>

                <Button
                  onClick={() =>
                    void submit("confirmed")
                  }
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}

                  Create order
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  if (validateStep(step)) {
                    setStep(step + 1);
                  }
                }}
                disabled={busy}
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}