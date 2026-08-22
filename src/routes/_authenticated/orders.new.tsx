import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  Plus,
  Trash2,
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
  PRODUCT_CATEGORIES,
  friendlyError,
  titleize,
} from "@/lib/domain";

import { logActivity, notifyStaff } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated/orders/new")({
  component: NewOrderPage,
});

const STEPS = [
  "Customer",
  "Order information",
  "Ordered items",
  "Additional",
  "Review",
];

const SIZE_COLUMNS = [
  { key: "XS", label: "XS/28" },
  { key: "S", label: "S/30" },
  { key: "M", label: "M/32" },
  { key: "L", label: "L/34" },
  { key: "XL", label: "XL/36" },
  { key: "2XL", label: "2XL/38" },
  { key: "3XL", label: "3XL/40" },
  { key: "42", label: "42" },
  { key: "Extra", label: "" },
  { key: "MTM", label: "MTM" },
] as const;

type SizeKey = (typeof SIZE_COLUMNS)[number]["key"];

type ProductRow = {
  id: string;
  product_name: string;
  product_category: string;
  sizes: Record<SizeKey, string>;
  fabric_supplier: string;
  cm_unit: string;
  fabric_color: string;
  emb_print: string;
  unit: string;
  style_comments: string;
};

function createEmptySizes(): Record<SizeKey, string> {
  return {
    XS: "",
    S: "",
    M: "",
    L: "",
    XL: "",
    "2XL": "",
    "3XL": "",
    "42": "",
    Extra: "",
    MTM: "",
  };
}

function createProduct(): ProductRow {
  return {
    id: crypto.randomUUID(),
    product_name: "",
    product_category: "School Uniform",
    sizes: createEmptySizes(),
    fabric_supplier: "",
    cm_unit: "",
    fabric_color: "",
    emb_print: "",
    unit: "",
    style_comments: "",
  };
}

function getProductQuantity(product: ProductRow): number {
  return Object.values(product.sizes).reduce((total, value) => {
    const quantity = Number(value);
    return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
  }, 0);
}

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

    order_owner: "",
    subject: "",
    brand: "",
    contact_person: "",
    po_number: "",
    quotation_number: "",
    deal_reference: "",

    delivery_address: "",
    payment_terms: "",
    order_type: "",
    pps_production: "",

    special_instructions: "",
    remarks: "",
  });

  const [products, setProducts] = useState<ProductRow[]>([
    createProduct(),
  ]);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, customer_code, customer_name, organization, address")
        .order("customer_name");

      if (error) throw error;

      return data;
    },
  });

  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );

  const totalOrderQuantity = useMemo(() => {
    return products.reduce(
      (total, product) => total + getProductQuantity(product),
      0,
    );
  }, [products]);

  const customerAddress = selectedCustomer?.address ?? "";

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

  function updateOrder(
    field: keyof typeof order,
    value: string,
  ) {
    setOrder((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateProduct(
    productId: string,
    field: keyof Omit<ProductRow, "id" | "sizes">,
    value: string,
  ) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              [field]: value,
            }
          : product,
      ),
    );
  }

  function updateProductSize(
    productId: string,
    size: SizeKey,
    value: string,
  ) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              sizes: {
                ...product.sizes,
                [size]: value,
              },
            }
          : product,
      ),
    );
  }

  function addProduct() {
    setProducts((current) => [
      ...current,
      createProduct(),
    ]);
  }

  function removeProduct(productId: string) {
    if (products.length === 1) {
      toast.error("At least one product is required");
      return;
    }

    setProducts((current) =>
      current.filter((product) => product.id !== productId),
    );
  }

  async function createCustomer() {
    if (!newCustomer.customer_name.trim()) {
      toast.error("Customer name is required");
      return;
    }

    if (
      newCustomer.email &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(
        newCustomer.email,
      )
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

    setOrder((current) => ({
      ...current,
      delivery_address: newCustomer.address,
      contact_person: newCustomer.customer_name,
    }));

    setCreatingCustomer(false);
  }

  function validateStep(currentStep: number): boolean {
    if (currentStep === 0) {
      if (!customerId) {
        toast.error("Select or create a customer");
        return false;
      }
    }

    if (currentStep === 1) {
      if (!order.order_number.trim()) {
        toast.error("Order number is required");
        return false;
      }

      if (
        order.expected_delivery_date &&
        order.expected_delivery_date <
          order.order_date
      ) {
        toast.error(
          "Delivery date cannot be before the order date",
        );
        return false;
      }
    }

    if (currentStep === 2) {
      if (products.length === 0) {
        toast.error("Add at least one product");
        return false;
      }

      for (let index = 0; index < products.length; index += 1) {
  const product = products[index];

  if (!product) {
    continue;
  }

  if (!product.product_name.trim()) {
    toast.error(
      `Product name is required for product ${index + 1}`,
    );
    return false;
  }

  if (getProductQuantity(product) <= 0) {
    toast.error(
      `Enter at least one quantity for ${
        product.product_name || `product ${index + 1}`
      }`,
    );
    return false;
  }
}
    }

    return true;
  }

  async function submit(
    status: "draft" | "confirmed",
  ) {
    if (
      !validateStep(0) ||
      !validateStep(1) ||
      !validateStep(2)
    ) {
      return;
    }

    if (!user?.id) {
      toast.error("Your session has expired. Please sign in again.");
      return;
    }

    setBusy(true);

    const firstProduct = products[0];

if (!firstProduct) {
  setBusy(false);
  toast.error("At least one product is required");
  return;
}

    const orderPayload = {
      order_number: order.order_number.trim(),

      batch_number:
        order.batch_number.trim() || null,

      customer_id: customerId,

      created_by: user.id,

      order_date: order.order_date,

      expected_delivery_date:
        order.expected_delivery_date || null,

      status,

      priority: order.priority as never,

      /*
       * Existing order table compatibility.
       * The first product remains represented here for
       * existing dashboard/order-list functionality.
       */
      product_name:
        firstProduct.product_name.trim(),

      product_category:
        firstProduct.product_category,

      total_quantity: totalOrderQuantity,

      fabric_details:
        firstProduct.fabric_color.trim() || null,

      fabric_supplier:
        firstProduct.fabric_supplier.trim() || null,

      cm_unit:
        firstProduct.cm_unit.trim() || null,

      accessory_details: null,

      customization_details:
        firstProduct.emb_print.trim() || null,

      special_instructions:
        order.special_instructions.trim() || null,

      remarks:
        order.remarks.trim() || null,

      /*
       * New order-sheet fields.
       */
      order_owner:
        order.order_owner.trim() || user.id,

      subject:
        order.subject.trim() || null,

      brand:
        order.brand.trim() || null,

      contact_person:
        order.contact_person.trim() || null,

      po_number:
        order.po_number.trim() || null,

      quotation_number:
        order.quotation_number.trim() || null,

      deal_reference:
        order.deal_reference.trim() || null,

      delivery_address:
        order.delivery_address.trim() || null,

      payment_terms:
        order.payment_terms.trim() || null,

      order_type:
        order.order_type.trim() || null,

      pps_production:
        order.pps_production.trim() || null,
    } as any;

    const { data: createdOrder, error: orderError } =
      await supabase
        .from("orders")
        .insert(orderPayload)
        .select("id, order_number")
        .single();

    if (orderError) {
      setBusy(false);
      toast.error(friendlyError(orderError));
      return;
    }

    const itemPayloads = products.map((product) => {
      const quantity = getProductQuantity(product);

      return {
        order_id: createdOrder.id,

        product_name:
          product.product_name.trim(),

        product_type:
          product.product_category,

        quantity,

        /*
         * Quotation pricing does NOT belong in New Order.
         * Keep zero for compatibility with the existing
         * order_items schema. Commercial pricing will be
         * handled by the dedicated Quotation module.
         */
        unit_price: 0,

        total_price: 0,

        fabric:
          product.fabric_color.trim() || null,

        color: null,

        customization:
          product.emb_print.trim() || null,

        size_quantities:
          Object.fromEntries(
            Object.entries(product.sizes)
              .map(([key, value]) => [
                key,
                Number(value),
              ])
              .filter(
                ([, value]) =>
                  typeof value === "number" &&
                  Number.isFinite(value) &&
                  value > 0,
              ),
          ) as never,

        fabric_supplier:
          product.fabric_supplier.trim() || null,

        cm_unit:
          product.cm_unit.trim() || null,

        fabric_color:
          product.fabric_color.trim() || null,

        emb_print:
          product.emb_print.trim() || null,

        unit:
          product.unit.trim() || null,

        style_comments:
          product.style_comments.trim() || null,
      };
    });

    const { error: itemError } =
      await supabase
        .from("order_items")
        .insert(itemPayloads as any);

    if (itemError) {
      /*
       * Avoid leaving an order without its ordered items.
       * The item insert failed, so remove the newly-created
       * order as a cleanup action.
       */
      await supabase
        .from("orders")
        .delete()
        .eq("id", createdOrder.id);

      setBusy(false);

      toast.error(
        `Order could not be saved: ${friendlyError(itemError)}`,
      );

      return;
    }

    await logActivity({
      orderId: createdOrder.id,

      action:
        status === "draft"
          ? `Order saved as draft by ${profile?.full_name ?? "staff"}`
          : `Order created by ${profile?.full_name ?? "staff"}`,

      actorId: user.id,

      actorName:
        profile?.full_name ?? null,
    });

    if (status === "confirmed") {
      await notifyStaff({
        title: "New order confirmed",

        message:
          `${createdOrder.order_number} · ` +
          `${products.length} product${
            products.length === 1 ? "" : "s"
          } · ` +
          `${totalOrderQuantity} pcs`,

        type: "order",

        orderId: createdOrder.id,
      });
    }

    await queryClient.invalidateQueries({
      queryKey: ["orders"],
    });

    await queryClient.invalidateQueries({
      queryKey: ["dashboard"],
    });

    setBusy(false);

    toast.success(
      status === "draft"
        ? "Draft saved"
        : "Order created successfully",
    );

    void navigate({
      to: "/orders/$orderId",
      params: {
        orderId: createdOrder.id,
      },
    });
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="New order"
        description="Capture the complete order-sheet specification."
      />

      <ol className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => {
                if (index < step) {
                  setStep(index);
                }
              }}
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
        {/* ================================================== */}
        {/* STEP 1 — CUSTOMER                                  */}
        {/* ================================================== */}

        {step === 0 ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold">
                Customer
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Select an existing customer or create a new one.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Existing customer *</Label>

              <Select
                value={customerId}
                onValueChange={(value) => {
                  setCustomerId(value);

                  const customer = customers.find(
                    (item) => item.id === value,
                  );

                  if (customer) {
                    setOrder((current) => ({
                      ...current,
                      delivery_address:
                        current.delivery_address ||
                        customer.address ||
                        "",
                    }));
                  }
                }}
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
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setCreatingCustomer(true)
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                New customer
              </Button>
            ) : (
              <div className="rounded-md border p-4">
                <div className="mb-4">
                  <p className="font-medium">
                    Create customer
                  </p>

                  <p className="text-sm text-muted-foreground">
                    Add the customer information before creating
                    the order.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      [
                        "customer_name",
                        "Customer name",
                      ],
                      [
                        "organization",
                        "Organization",
                      ],
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
                          setNewCustomer(
                            (current) => ({
                              ...current,
                              [field]:
                                event.target.value,
                            }),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="customer-address">
                    Address
                  </Label>

                  <Textarea
                    id="customer-address"
                    rows={3}
                    value={newCustomer.address}
                    onChange={(event) =>
                      setNewCustomer(
                        (current) => ({
                          ...current,
                          address:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void createCustomer()
                    }
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}

                    Save customer
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setCreatingCustomer(false)
                    }
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {selectedCustomer ? (
              <div className="rounded-md border bg-muted/20 p-4">
                <p className="label-caps">
                  Selected customer
                </p>

                <p className="mt-1 font-medium">
                  {selectedCustomer.customer_name}
                </p>

                <p className="text-sm text-muted-foreground">
                  {selectedCustomer.organization || "—"}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ================================================== */}
        {/* STEP 2 — ORDER INFORMATION                         */}
        {/* ================================================== */}

        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold">
                Order information
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                These fields correspond to the operational
                information required on the company order sheet.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="order_number">
                  Order No *
                </Label>

                <Input
                  id="order_number"
                  value={order.order_number}
                  onChange={(event) =>
                    updateOrder(
                      "order_number",
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="order_date">
                  Order Date
                </Label>

                <Input
                  id="order_date"
                  type="date"
                  value={order.order_date}
                  onChange={(event) =>
                    updateOrder(
                      "order_date",
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="brand">
                  Brand
                </Label>

                <Input
                  id="brand"
                  value={order.brand}
                  onChange={(event) =>
                    updateOrder(
                      "brand",
                      event.target.value,
                    )
                  }
                  placeholder="Enter brand"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact_person">
                  Contact Person
                </Label>

                <Input
                  id="contact_person"
                  value={order.contact_person}
                  onChange={(event) =>
                    updateOrder(
                      "contact_person",
                      event.target.value,
                    )
                  }
                  placeholder="Enter contact person"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subject">
                  Subject
                </Label>

                <Input
                  id="subject"
                  value={order.subject}
                  onChange={(event) =>
                    updateOrder(
                      "subject",
                      event.target.value,
                    )
                  }
                  placeholder="Order subject"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="batch_number">
                  Batch Number
                </Label>

                <Input
                  id="batch_number"
                  value={order.batch_number}
                  onChange={(event) =>
                    updateOrder(
                      "batch_number",
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="po_number">
                  PO Number
                </Label>

                <Input
                  id="po_number"
                  value={order.po_number}
                  onChange={(event) =>
                    updateOrder(
                      "po_number",
                      event.target.value,
                    )
                  }
                  placeholder="Purchase order / LPO"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="quotation_number">
                  Quotation Number
                </Label>

                <Input
                  id="quotation_number"
                  value={order.quotation_number}
                  onChange={(event) =>
                    updateOrder(
                      "quotation_number",
                      event.target.value,
                    )
                  }
                  placeholder="Quotation reference"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deal_reference">
                  Deal Reference
                </Label>

                <Input
                  id="deal_reference"
                  value={order.deal_reference}
                  onChange={(event) =>
                    updateOrder(
                      "deal_reference",
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="order_type">
                  Order Type
                </Label>

                <Input
                  id="order_type"
                  value={order.order_type}
                  onChange={(event) =>
                    updateOrder(
                      "order_type",
                      event.target.value,
                    )
                  }
                  placeholder="Enter order type"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="order_owner">
                  Order Owner
                </Label>

                <Input
                  id="order_owner"
                  value={
                    order.order_owner ||
                    profile?.full_name ||
                    ""
                  }
                  onChange={(event) =>
                    updateOrder(
                      "order_owner",
                      event.target.value,
                    )
                  }
                  placeholder="Order owner"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Priority</Label>

                <Select
                  value={order.priority}
                  onValueChange={(value) =>
                    updateOrder(
                      "priority",
                      value,
                    )
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

              <div className="space-y-1.5">
                <Label htmlFor="expected_delivery_date">
                  Delivery Date
                </Label>

                <Input
                  id="expected_delivery_date"
                  type="date"
                  value={
                    order.expected_delivery_date
                  }
                  onChange={(event) =>
                    updateOrder(
                      "expected_delivery_date",
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment_terms">
                  Payment Terms
                </Label>

                <Input
                  id="payment_terms"
                  value={order.payment_terms}
                  onChange={(event) =>
                    updateOrder(
                      "payment_terms",
                      event.target.value,
                    )
                  }
                  placeholder="e.g. 50% advance"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="delivery_address">
                  Delivery Address
                </Label>

                <Textarea
                  id="delivery_address"
                  rows={3}
                  value={order.delivery_address}
                  onChange={(event) =>
                    updateOrder(
                      "delivery_address",
                      event.target.value,
                    )
                  }
                  placeholder={
                    customerAddress ||
                    "Enter delivery address"
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pps_production">
                  PPS / Production
                </Label>

                <Input
                  id="pps_production"
                  value={order.pps_production}
                  onChange={(event) =>
                    updateOrder(
                      "pps_production",
                      event.target.value,
                    )
                  }
                  placeholder="Enter PPS / production"
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* ================================================== */}
        {/* STEP 3 — ORDERED ITEMS                             */}
        {/* ================================================== */}

        {step === 2 ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  Ordered Items
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Add every product separately and enter its
                  size-wise quantities.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addProduct}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>

            <div className="rounded-md border bg-muted/20 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span>
                  Products:{" "}
                  <strong>{products.length}</strong>
                </span>

                <span>
                  Total Quantity:{" "}
                  <strong>{totalOrderQuantity}</strong>
                </span>
              </div>
            </div>

            <div className="space-y-5">
              {products.map((product, productIndex) => {
                const productQuantity =
                  getProductQuantity(product);

                return (
                  <div
                    key={product.id}
                    className="overflow-hidden rounded-lg border"
                  >
                    {/* Product header */}
                    <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">
                          Product {productIndex + 1}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Total quantity:{" "}
                          <strong>
                            {productQuantity}
                          </strong>
                        </p>
                      </div>

                      {products.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            removeProduct(product.id)
                          }
                          aria-label={`Remove product ${productIndex + 1}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : null}
                    </div>

                    {/* Product name / category */}
                    <div className="grid gap-4 p-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>
                          Product Name *
                        </Label>

                        <div className="flex gap-2">
                          <Input
                            value={product.product_name}
                            onChange={(event) =>
                              updateProduct(
                                product.id,
                                "product_name",
                                event.target.value,
                              )
                            }
                            placeholder="Enter product name"
                          />

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={addProduct}
                            aria-label="Add product"
                            title="Add another product"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>
                          Product Category
                        </Label>

                        <Select
                          value={
                            product.product_category
                          }
                          onValueChange={(value) =>
                            updateProduct(
                              product.id,
                              "product_category",
                              value,
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            {PRODUCT_CATEGORIES.map(
                              (value) => (
                                <SelectItem
                                  key={value}
                                  value={value}
                                >
                                  {value}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Size table */}
                    <div className="border-y">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] border-collapse text-sm">
                          <thead>
                            <tr className="bg-muted/30">
                              {SIZE_COLUMNS.map(
                                (size) => (
                                  <th
                                    key={size.key}
                                    className="border-r px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0"
                                  >
                                    {size.label ||
                                      "Extra"}
                                  </th>
                                ),
                              )}

                              <th className="border-r px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Total
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            <tr>
                              {SIZE_COLUMNS.map(
                                (size) => (
                                  <td
                                    key={size.key}
                                    className="border-r p-2 last:border-r-0"
                                  >
                                    <Input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={
                                        product
                                          .sizes[
                                          size.key
                                        ] ?? ""
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateProductSize(
                                          product.id,
                                          size.key,
                                          event
                                            .target
                                            .value,
                                        )
                                      }
                                      className="h-9 text-center"
                                      aria-label={
                                        size.label ||
                                        "Extra"
                                      }
                                    />
                                  </td>
                                ),
                              )}

                              <td className="bg-muted/20 p-2 text-center">
                                <span className="font-display text-lg font-bold">
                                  {productQuantity}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Item-specific information */}
                    <div className="grid gap-4 p-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>
                          Fabric Supplier
                        </Label>

                        <Input
                          value={
                            product.fabric_supplier
                          }
                          onChange={(event) =>
                            updateProduct(
                              product.id,
                              "fabric_supplier",
                              event.target.value,
                            )
                          }
                          placeholder="Fabric supplier"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>
                          CM Unit
                        </Label>

                        <Input
                          value={product.cm_unit}
                          onChange={(event) =>
                            updateProduct(
                              product.id,
                              "cm_unit",
                              event.target.value,
                            )
                          }
                          placeholder="CM unit"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>
                          Fabric / Colour
                        </Label>

                        <Input
                          value={
                            product.fabric_color
                          }
                          onChange={(event) =>
                            updateProduct(
                              product.id,
                              "fabric_color",
                              event.target.value,
                            )
                          }
                          placeholder="Fabric / colour"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>
                          EMB / PRINT
                        </Label>

                        <Input
                          value={product.emb_print}
                          onChange={(event) =>
                            updateProduct(
                              product.id,
                              "emb_print",
                              event.target.value,
                            )
                          }
                          placeholder="Embroidery / print"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>
                          Unit
                        </Label>

                        <Input
                          value={product.unit}
                          onChange={(event) =>
                            updateProduct(
                              product.id,
                              "unit",
                              event.target.value,
                            )
                          }
                          placeholder="Unit"
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>
                          Style Comments
                        </Label>

                        <Textarea
                          rows={3}
                          value={
                            product.style_comments
                          }
                          onChange={(event) =>
                            updateProduct(
                              product.id,
                              "style_comments",
                              event.target.value,
                            )
                          }
                          placeholder="Enter style-specific comments"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={addProduct}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add another product
              </Button>

              <div className="rounded-md border px-4 py-2 text-sm">
                Total Order Quantity:{" "}
                <span className="font-display text-lg font-bold">
                  {totalOrderQuantity}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* ================================================== */}
        {/* STEP 4 — ADDITIONAL                               */}
        {/* ================================================== */}

        {step === 3 ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold">
                Additional information
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Add production instructions and general remarks
                that should travel with the order.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="special_instructions">
                Special Instructions
              </Label>

              <Textarea
                id="special_instructions"
                rows={5}
                value={
                  order.special_instructions
                }
                onChange={(event) =>
                  updateOrder(
                    "special_instructions",
                    event.target.value,
                  )
                }
                placeholder="Enter special production or order instructions"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remarks">
                Remarks
              </Label>

              <Textarea
                id="remarks"
                rows={5}
                value={order.remarks}
                onChange={(event) =>
                  updateOrder(
                    "remarks",
                    event.target.value,
                  )
                }
                placeholder="Enter remarks"
              />
            </div>

            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-sm font-medium">
                Product Images
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Product/reference images can continue to be
                uploaded from the order details page after the
                order is created.
              </p>
            </div>
          </div>
        ) : null}

        {/* ================================================== */}
        {/* STEP 5 — REVIEW                                    */}
        {/* ================================================== */}

        {step === 4 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold">
                Review Order
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Review the information before saving the order.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border p-4">
                <p className="label-caps">
                  Customer
                </p>

                <p className="mt-1 font-medium">
                  {selectedCustomer?.customer_name ||
                    "—"}
                </p>

                <p className="text-sm text-muted-foreground">
                  {selectedCustomer?.organization ||
                    "—"}
                </p>
              </div>

              <div className="rounded-md border p-4">
                <p className="label-caps">
                  Order
                </p>

                <p className="mt-1 font-medium">
                  {order.order_number}
                </p>

                <p className="text-sm text-muted-foreground">
                  {order.order_date} ·{" "}
                  {titleize(order.priority)}
                </p>
              </div>

              <div className="rounded-md border p-4">
                <p className="label-caps">
                  Brand
                </p>

                <p className="mt-1 font-medium">
                  {order.brand || "—"}
                </p>

                <p className="text-sm text-muted-foreground">
                  Contact:{" "}
                  {order.contact_person || "—"}
                </p>
              </div>

              <div className="rounded-md border p-4">
                <p className="label-caps">
                  Delivery
                </p>

                <p className="mt-1 font-medium">
                  {order.expected_delivery_date ||
                    "Not set"}
                </p>

                <p className="text-sm text-muted-foreground">
                  {order.payment_terms ||
                    "Payment terms not set"}
                </p>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    Ordered Items
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {totalOrderQuantity} pcs total
                  </p>
                </div>
              </div>

              <div className="divide-y">
                {products.map(
                  (product, index) => (
                    <div
                      key={product.id}
                      className="p-4"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-medium">
                          {index + 1}.{" "}
                          {product.product_name ||
                            "Unnamed product"}
                        </p>

                        <p className="text-sm font-semibold">
                          {getProductQuantity(
                            product,
                          )}{" "}
                          pcs
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {SIZE_COLUMNS.map(
                          (size) => {
                            const quantity =
                              Number(
                                product.sizes[
                                  size.key
                                ],
                              ) || 0;

                            if (
                              quantity <= 0
                            ) {
                              return null;
                            }

                            return (
                              <span
                                key={
                                  size.key
                                }
                                className="rounded-md border px-2.5 py-1 text-xs"
                              >
                                {size.label ||
                                  "Extra"}
                                :{" "}
                                <strong>
                                  {
                                    quantity
                                  }
                                </strong>
                              </span>
                            );
                          },
                        )}
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                        <span>
                          Fabric:{" "}
                          {product.fabric_color ||
                            "—"}
                        </span>

                        <span>
                          Supplier:{" "}
                          {product.fabric_supplier ||
                            "—"}
                        </span>

                        <span>
                          CM:{" "}
                          {product.cm_unit ||
                            "—"}
                        </span>

                        <span>
                          EMB/PRINT:{" "}
                          {product.emb_print ||
                            "—"}
                        </span>
                      </div>

                      {product.style_comments ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Style comments:{" "}
                          {
                            product.style_comments
                          }
                        </p>
                      ) : null}
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border p-4">
                <p className="label-caps">
                  Delivery Address
                </p>

                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {order.delivery_address ||
                    "—"}
                </p>
              </div>

              <div className="rounded-md border p-4">
                <p className="label-caps">
                  PPS / Production
                </p>

                <p className="mt-1 text-sm">
                  {order.pps_production || "—"}
                </p>
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Total Order Quantity
                </span>

                <span className="font-display text-2xl font-bold">
                  {totalOrderQuantity}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* ================================================== */}
        {/* NAVIGATION                                         */}
        {/* ================================================== */}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => {
              if (step === 0) {
                void navigate({
                  to: "/orders",
                });
              } else {
                setStep((current) => current - 1);
              }
            }}
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
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}

                  Save Draft
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

                  Create Order
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  if (validateStep(step)) {
                    setStep(
                      (current) =>
                        current + 1,
                    );
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