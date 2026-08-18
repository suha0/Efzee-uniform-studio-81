import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
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
  PRODUCT_CATEGORIES,
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

function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, canSell } = useAuth();
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

  const [order, setOrder] = useState({
    order_number: `ORD-${Date.now().toString().slice(-6)}`,
    batch_number: "",
    order_date: new Date().toISOString().slice(0, 10),
    expected_delivery_date: "",
    priority: "normal",
    product_name: "",
    product_category: "School Uniform",
    fabric_details: "",
    accessory_details: "",
    customization_details: "",
    color: "",
    unit_price: "0",
    special_instructions: "",
    remarks: "",
  });

  const [sizes, setSizes] = useState<Record<string, string>>(
    Object.fromEntries(SIZES.map((size) => [size, ""])),
  );
  const [customSizes, setCustomSizes] = useState<Array<{ label: string; quantity: string }>>([]);

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
      if (quantity > 0) entries[size] = quantity;
    }
    for (const row of customSizes) {
      const quantity = Number(row.quantity);
      if (row.label.trim() && quantity > 0) entries[row.label.trim()] = quantity;
    }
    return entries;
  }, [sizes, customSizes]);

  const totalQuantity = Object.values(sizeEntries).reduce((sum, value) => sum + value, 0);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);

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
    if (newCustomer.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newCustomer.email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy(true);
    const code = `CUS-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const { data, error } = await supabase
      .from("customers")
      .insert({ ...newCustomer, customer_code: code })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Customer created");
    await queryClient.invalidateQueries({ queryKey: ["customers"] });
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

  async function submit(status: "draft" | "confirmed") {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2) || !validateStep(3)) return;
    setBusy(true);
    const unitPrice = Number(order.unit_price) || 0;
    const { data, error } = await supabase
      .from("orders")
      .insert({
        order_number: order.order_number.trim(),
        batch_number: order.batch_number.trim() || null,
        customer_id: customerId,
        created_by: user?.id ?? null,
        order_date: order.order_date,
        expected_delivery_date: order.expected_delivery_date || null,
        status,
        priority: order.priority as never,
        product_name: order.product_name.trim(),
        product_category: order.product_category,
        total_quantity: totalQuantity,
        fabric_details: order.fabric_details || null,
        accessory_details: order.accessory_details || null,
        customization_details: order.customization_details || null,
        special_instructions: order.special_instructions || null,
        remarks: order.remarks || null,
      })
      .select("id, order_number")
      .single();

    if (error) {
      setBusy(false);
      toast.error(friendlyError(error));
      return;
    }

    const { error: itemError } = await supabase.from("order_items").insert({
      order_id: data.id,
      product_name: order.product_name.trim(),
      product_type: order.product_category,
      quantity: totalQuantity,
      unit_price: unitPrice,
      total_price: unitPrice * totalQuantity,
      fabric: order.fabric_details || null,
      color: order.color || null,
      customization: order.customization_details || null,
      size_quantities: sizeEntries as never,
    });
    if (itemError) toast.error(friendlyError(itemError));

    await logActivity({
      orderId: data.id,
      action: `Order ${status === "draft" ? "saved as draft" : "created"} by ${profile?.full_name ?? "staff"}`,
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

    await queryClient.invalidateQueries({ queryKey: ["orders"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    setBusy(false);
    toast.success(status === "draft" ? "Draft saved" : "Order created successfully");
    void navigate({ to: "/orders/$orderId", params: { orderId: data.id } });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New order" description="Capture the full specification in six steps." />

      <ol className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => index < step && setStep(index)}
              className={
                index === step
                  ? "rounded-full border border-accent bg-accent/15 px-3 py-1 text-xs font-medium text-accent-foreground"
                  : index < step
                    ? "rounded-full border px-3 py-1 text-xs text-muted-foreground"
                    : "rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground/60"
              }
            >
              {index < step ? <Check className="mr-1 inline h-3 w-3" /> : null}
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
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Search and select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.customer_name} · {customer.customer_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!creatingCustomer ? (
              <Button variant="outline" size="sm" onClick={() => setCreatingCustomer(true)}>
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
                    <div key={field} className="space-y-1.5">
                      <Label htmlFor={field}>{label}</Label>
                      <Input
                        id={field}
                        value={newCustomer[field]}
                        onChange={(event) =>
                          setNewCustomer((current) => ({
                            ...current,
                            [field]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={newCustomer.address}
                    onChange={(event) =>
                      setNewCustomer((current) => ({ ...current, address: event.target.value }))
                    }
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={createCustomer} disabled={busy}>
                    Save customer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCreatingCustomer(false)}>
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
              <Label htmlFor="order_number">Order number *</Label>
              <Input
                id="order_number"
                value={order.order_number}
                onChange={(event) =>
                  setOrder((current) => ({ ...current, order_number: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch_number">Batch number</Label>
              <Input
                id="batch_number"
                value={order.batch_number}
                onChange={(event) =>
                  setOrder((current) => ({ ...current, batch_number: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order_date">Order date</Label>
              <Input
                id="order_date"
                type="date"
                value={order.order_date}
                onChange={(event) =>
                  setOrder((current) => ({ ...current, order_date: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delivery_date">Expected delivery</Label>
              <Input
                id="delivery_date"
                type="date"
                value={order.expected_delivery_date}
                onChange={(event) =>
                  setOrder((current) => ({
                    ...current,
                    expected_delivery_date: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={order.priority}
                onValueChange={(value) => setOrder((current) => ({ ...current, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value}>
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
              <Label htmlFor="product_name">Product name *</Label>
              <Input
                id="product_name"
                value={order.product_name}
                onChange={(event) =>
                  setOrder((current) => ({ ...current, product_name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={order.product_category}
                onValueChange={(value) =>
                  setOrder((current) => ({ ...current, product_category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fabric">Fabric details</Label>
              <Input
                id="fabric"
                value={order.fabric_details}
                onChange={(event) =>
                  setOrder((current) => ({ ...current, fabric_details: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="color">Colour</Label>
              <Input
                id="color"
                value={order.color}
                onChange={(event) =>
                  setOrder((current) => ({ ...current, color: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accessories">Accessories</Label>
              <Input
                id="accessories"
                value={order.accessory_details}
                onChange={(event) =>
                  setOrder((current) => ({ ...current, accessory_details: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customization">Customization</Label>
              <Input
                id="customization"
                value={order.customization_details}
                onChange={(event) =>
                  setOrder((current) => ({
                    ...current,
                    customization_details: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit_price">Unit price (₹)</Label>
              <Input
                id="unit_price"
                type="number"
                min="0"
                value={order.unit_price}
                onChange={(event) =>
                  setOrder((current) => ({ ...current, unit_price: event.target.value }))
                }
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <div className="grid gap-3 sm:grid-cols-4">
              {SIZES.map((size) => (
                <div key={size} className="space-y-1.5">
                  <Label htmlFor={`size-${size}`}>{size}</Label>
                  <Input
                    id={`size-${size}`}
                    type="number"
                    min="0"
                    value={sizes[size] ?? ""}
                    onChange={(event) =>
                      setSizes((current) => ({ ...current, [size]: event.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            {customSizes.map((row, index) => (
              <div key={index} className="mt-3 flex gap-3">
                <Input
                  placeholder="Custom size label"
                  value={row.label}
                  onChange={(event) =>
                    setCustomSizes((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item,
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
                    setCustomSizes((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, quantity: event.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCustomSizes((current) => [...current, { label: "", quantity: "" }])
                }
              >
                + Custom size
              </Button>
              <p className="text-sm">
                Total quantity: <span className="font-display text-lg font-bold">{totalQuantity}</span>
              </p>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="instructions">Special instructions</Label>
              <Textarea
                id="instructions"
                rows={3}
                value={order.special_instructions}
                onChange={(event) =>
                  setOrder((current) => ({
                    ...current,
                    special_instructions: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                rows={3}
                value={order.remarks}
                onChange={(event) =>
                  setOrder((current) => ({ ...current, remarks: event.target.value }))
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Production images and attachments can be uploaded on the order page once the order
              exists.
            </p>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="label-caps">Customer</p>
                <p className="mt-1 font-medium">{selectedCustomer?.customer_name ?? "—"}</p>
                <p className="text-muted-foreground">{selectedCustomer?.organization ?? ""}</p>
              </div>
              <div>
                <p className="label-caps">Order</p>
                <p className="mt-1 font-medium">{order.order_number}</p>
                <p className="text-muted-foreground">
                  Batch {order.batch_number || "—"} · {titleize(order.priority)} priority
                </p>
              </div>
              <div>
                <p className="label-caps">Product</p>
                <p className="mt-1 font-medium">{order.product_name}</p>
                <p className="text-muted-foreground">
                  {order.product_category} · {order.fabric_details || "fabric TBC"}
                </p>
              </div>
              <div>
                <p className="label-caps">Delivery</p>
                <p className="mt-1 font-medium">{order.expected_delivery_date || "Not set"}</p>
                <p className="text-muted-foreground">Ordered {order.order_date}</p>
              </div>
            </div>
            <div>
              <p className="label-caps mb-2">Size breakdown</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(sizeEntries).map(([size, quantity]) => (
                  <span key={size} className="rounded-md border px-2.5 py-1 text-xs">
                    {size}: <strong>{quantity}</strong>
                  </span>
                ))}
              </div>
              <p className="mt-2">
                Total: <strong>{totalQuantity}</strong> pieces
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? navigate({ to: "/orders" }) : setStep(step - 1))}
            disabled={busy}
          >
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          <div className="flex gap-2">
            {step === STEPS.length - 1 ? (
              <>
                <Button variant="outline" onClick={() => void submit("draft")} disabled={busy}>
                  Save draft
                </Button>
                <Button onClick={() => void submit("confirmed")} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create order
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  if (validateStep(step)) setStep(step + 1);
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
