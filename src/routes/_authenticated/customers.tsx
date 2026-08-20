import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Building2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError } from "@/lib/domain";
import { logActivity } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

type Customer = {
  id: string;
  customer_code: string;
  customer_name: string;
  organization: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerForm = {
  customer_name: string;
  organization: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  notes: string;
};

const emptyForm: CustomerForm = {
  customer_name: "",
  organization: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  notes: "",
};

function CustomersPage() {
  const queryClient = useQueryClient();

  const {
    user,
    profile,
    canSell,
    isAdmin,
    role,
  } = useAuth();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /*
   * ---------------------------------------------------------
   * LOAD CUSTOMERS
   * ---------------------------------------------------------
   */

  const {
    data: customers = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(`
          id,
          customer_code,
          customer_name,
          organization,
          phone,
          email,
          address,
          city,
          state,
          notes,
          created_at,
          updated_at
        `)
        .order("customer_name");

      if (error) {
        console.error("LOAD CUSTOMERS ERROR:", error);
        throw error;
      }

      return (data ?? []) as Customer[];
    },
  });

  /*
   * ---------------------------------------------------------
   * LOAD ORDERS FOR ORDER COUNTS
   * ---------------------------------------------------------
   */

  const { data: orders = [] } = useQuery({
    queryKey: ["customers", "order-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_id");

      if (error) {
        console.error("LOAD CUSTOMER ORDERS ERROR:", error);
        throw error;
      }

      return data ?? [];
    },
  });

  /*
   * ---------------------------------------------------------
   * ORDER COUNTS
   * ---------------------------------------------------------
   */

  const orderCountByCustomer = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const order of orders) {
      if (!order.customer_id) continue;

      counts[order.customer_id] =
        (counts[order.customer_id] ?? 0) + 1;
    }

    return counts;
  }, [orders]);

  /*
   * ---------------------------------------------------------
   * SEARCH
   * ---------------------------------------------------------
   */

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return customers;
    }

    return customers.filter((customer) => {
      return [
        customer.customer_code,
        customer.customer_name,
        customer.organization,
        customer.phone,
        customer.email,
        customer.city,
        customer.state,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query),
        );
    });
  }, [customers, search]);

  /*
   * ---------------------------------------------------------
   * STATISTICS
   * ---------------------------------------------------------
   */

  const totalCustomers = customers.length;

  const customersWithOrders = useMemo(
    () =>
      customers.filter(
        (customer) =>
          (orderCountByCustomer[customer.id] ?? 0) > 0,
      ).length,
    [customers, orderCountByCustomer],
  );

  const totalOrders = orders.length;

  /*
   * ---------------------------------------------------------
   * CREATE FORM
   * ---------------------------------------------------------
   */

  function openCreateForm() {
    setEditingCustomer(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  /*
   * ---------------------------------------------------------
   * EDIT FORM
   * ---------------------------------------------------------
   */

  function openEditForm(customer: Customer) {
    setEditingCustomer(customer);

    setForm({
      customer_name: customer.customer_name ?? "",
      organization: customer.organization ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      notes: customer.notes ?? "",
    });

    setShowForm(true);
  }

  /*
   * ---------------------------------------------------------
   * CLOSE FORM
   * ---------------------------------------------------------
   */

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingCustomer(null);
    setForm(emptyForm);
  }

  /*
   * ---------------------------------------------------------
   * FORM UPDATE
   * ---------------------------------------------------------
   */

  function updateField(
    field: keyof CustomerForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  /*
   * ---------------------------------------------------------
   * CUSTOMER CODE
   * ---------------------------------------------------------
   */

  function generateCustomerCode() {
    const random = Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase();

    return `CUS-${random}`;
  }

  /*
   * ---------------------------------------------------------
   * SAVE CUSTOMER
   * ---------------------------------------------------------
   */

  async function saveCustomer() {
    if (!canSell) {
      toast.error(
        "Sales access is required to manage customers.",
      );
      return;
    }

    if (!form.customer_name.trim()) {
      toast.error("Customer name is required.");
      return;
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim(),
      )
    ) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        customer_name: form.customer_name.trim(),
        organization:
          form.organization.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        notes: form.notes.trim() || null,
      };

      /*
       * UPDATE
       */

      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", editingCustomer.id);

        if (error) {
          console.error(
            "UPDATE CUSTOMER ERROR:",
            error,
          );
          throw error;
        }

        await logActivity({
          orderId: null,
          action: `Customer updated: ${editingCustomer.customer_name}`,
          actorId: user?.id ?? null,
          actorName: profile?.full_name ?? null,
        });

        toast.success(
          "Customer updated successfully.",
        );
      }

      /*
       * CREATE
       */

      else {
        const customerCode =
          generateCustomerCode();

        const { data, error } = await supabase
          .from("customers")
          .insert({
            ...payload,
            customer_code: customerCode,
          })
          .select()
          .single();

        if (error) {
          console.error(
            "CREATE CUSTOMER ERROR:",
            error,
          );
          throw error;
        }

        await logActivity({
          orderId: null,
          action: `Customer created: ${data.customer_name}`,
          actorId: user?.id ?? null,
          actorName: profile?.full_name ?? null,
        });

        toast.success(
          "Customer created successfully.",
        );
      }

      await queryClient.invalidateQueries({
        queryKey: ["customers"],
      });

      closeForm();
    } catch (error) {
      console.error("SAVE CUSTOMER ERROR:", error);

      toast.error(
        getSupabaseErrorMessage(
          error,
          "Customer could not be saved.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * DELETE CUSTOMER
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   * Only ADMIN is allowed to reach this function.
   */

  async function deleteCustomer(customer: Customer) {
    if (!isAdmin) {
      toast.error(
        "Only administrators can delete customers.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete ${customer.customer_name}?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(customer.id);

    try {
      console.log(
        "Deleting customer:",
        customer.id,
        customer.customer_name,
      );

      /*
       * Perform DELETE.
       *
       * We intentionally do NOT use .select() here.
       * That avoids requiring an additional SELECT
       * permission during the delete operation.
       */

      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customer.id);

      if (error) {
        console.error(
          "DELETE CUSTOMER ERROR:",
          error,
        );

        throw error;
      }

      /*
       * Immediately remove customer from React Query cache.
       * This makes the row disappear instantly.
       */

      queryClient.setQueryData<Customer[]>(
        ["customers"],
        (currentCustomers = []) =>
          currentCustomers.filter(
            (item) => item.id !== customer.id,
          ),
      );

      /*
       * Refresh customer data from Supabase.
       */

      await queryClient.invalidateQueries({
        queryKey: ["customers"],
      });

      /*
       * Refresh order counts.
       */

      await queryClient.invalidateQueries({
        queryKey: ["customers", "order-counts"],
      });

      /*
       * Refresh order-related screens.
       */

      await queryClient.invalidateQueries({
        queryKey: ["orders"],
      });

      /*
       * Activity log should not prevent the
       * successful delete from being shown.
       */

      try {
        await logActivity({
          orderId: null,
          action: `Customer deleted: ${customer.customer_name}`,
          actorId: user?.id ?? null,
          actorName: profile?.full_name ?? null,
        });
      } catch (activityError) {
        console.warn(
          "Activity log failed after customer deletion:",
          activityError,
        );
      }

      toast.success(
        `${customer.customer_name} deleted successfully.`,
      );
    } catch (error) {
      console.error(
        "Delete customer error:",
        error,
      );

      toast.error(
        getSupabaseErrorMessage(
          error,
          "Customer could not be deleted.",
        ),
      );
    } finally {
      setDeletingId(null);
    }
  }

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * ERROR
   * ---------------------------------------------------------
   */

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Customers"
          description="Manage your customers and organizations."
        />

        <div className="surface p-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />

          <h2 className="mt-3 font-semibold">
            Unable to load customers
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong while loading the
            customer list.
          </p>

          <p className="mt-3 text-xs text-destructive">
            {getSupabaseErrorMessage(
              error,
              "Unable to load customers.",
            )}
          </p>

          <Button
            className="mt-4"
            variant="outline"
            onClick={() => void refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * PAGE
   * ---------------------------------------------------------
   */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage customers, organizations and their contact information."
        actions={
          canSell ? (
            <Button onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" />
              New customer
            </Button>
          ) : null
        }
      />

      {/* Statistics */}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={<Users className="h-5 w-5" />}
          label="Total customers"
          value={totalCustomers}
          description="Registered customers"
        />

        <MetricCard
          icon={<Building2 className="h-5 w-5" />}
          label="Active accounts"
          value={customersWithOrders}
          description="Customers with orders"
        />

        <MetricCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Total orders"
          value={totalOrders}
          description="Orders linked to customers"
        />
      </div>

      {/* Search */}

      <div className="surface p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search by name, code, organization, phone, email or city..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Customer form */}

      {showForm && (
        <section className="surface p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {editingCustomer
                  ? "Edit customer"
                  : "New customer"}
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {editingCustomer
                  ? `Update information for ${editingCustomer.customer_name}.`
                  : "Add a new customer to your customer database."}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={closeForm}
              disabled={saving}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Customer name"
              required
              value={form.customer_name}
              onChange={(value) =>
                updateField(
                  "customer_name",
                  value,
                )
              }
              placeholder="Enter customer name"
            />

            <FormField
              label="Organization"
              value={form.organization}
              onChange={(value) =>
                updateField(
                  "organization",
                  value,
                )
              }
              placeholder="School, company, hospital..."
            />

            <FormField
              label="Phone"
              value={form.phone}
              onChange={(value) =>
                updateField("phone", value)
              }
              placeholder="+91 98765 43210"
            />

            <FormField
              label="Email"
              type="email"
              value={form.email}
              onChange={(value) =>
                updateField("email", value)
              }
              placeholder="customer@example.com"
            />

            <FormField
              label="City"
              value={form.city}
              onChange={(value) =>
                updateField("city", value)
              }
              placeholder="City"
            />

            <FormField
              label="State"
              value={form.state}
              onChange={(value) =>
                updateField("state", value)
              }
              placeholder="State"
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="customer-address">
              Address
            </Label>

            <Textarea
              id="customer-address"
              value={form.address}
              onChange={(event) =>
                updateField(
                  "address",
                  event.target.value,
                )
              }
              placeholder="Full customer address"
              rows={3}
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="customer-notes">
              Notes
            </Label>

            <Textarea
              id="customer-notes"
              value={form.notes}
              onChange={(event) =>
                updateField(
                  "notes",
                  event.target.value,
                )
              }
              placeholder="Additional notes about this customer..."
              rows={3}
            />
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={closeForm}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              onClick={() => void saveCustomer()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}

              {editingCustomer
                ? "Save changes"
                : "Create customer"}
            </Button>
          </div>
        </section>
      )}

      {/* Customer list */}

      <section className="surface overflow-hidden">
        <div className="border-b px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">
                Customer directory
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {filteredCustomers.length}{" "}
                {filteredCustomers.length === 1
                  ? "customer"
                  : "customers"}
                {search
                  ? " matching your search"
                  : ""}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => void refetch()}
              title="Refresh customers"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground" />

            <h3 className="mt-3 font-semibold">
              {search
                ? "No customers found"
                : "No customers yet"}
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              {search
                ? "Try a different search term."
                : "Create your first customer to get started."}
            </p>

            {!search && canSell && (
              <Button
                className="mt-4"
                onClick={openCreateForm}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add customer
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filteredCustomers.map((customer) => {
              const orderCount =
                orderCountByCustomer[customer.id] ??
                0;

              return (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  orderCount={orderCount}
                  canEdit={canSell}
                  canDelete={isAdmin}
                  deleting={
                    deletingId === customer.id
                  }
                  onEdit={() =>
                    openEditForm(customer)
                  }
                  onDelete={() =>
                    void deleteCustomer(customer)
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Small role debug indicator - remove later if desired */}

      <div className="text-center text-[11px] text-muted-foreground">
        Current role: {role ?? "not loaded"}
      </div>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * CUSTOMER ROW
 * ---------------------------------------------------------
 */

function CustomerRow({
  customer,
  orderCount,
  canEdit,
  canDelete,
  deleting,
  onEdit,
  onDelete,
}: {
  customer: Customer;
  orderCount: number;
  canEdit: boolean;
  canDelete: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-5 transition-colors hover:bg-muted/30">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">
              {customer.customer_name}
            </h3>

            <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {customer.customer_code}
            </span>
          </div>

          {customer.organization && (
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {customer.organization}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {customer.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </div>
            )}

            {customer.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />

                <span className="break-all">
                  {customer.email}
                </span>
              </div>
            )}

            {(customer.city ||
              customer.state) && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />

                {[
                  customer.city,
                  customer.state,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 lg:justify-end">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />

            <div>
              <p className="text-sm font-medium">
                {orderCount}
              </p>

              <p className="text-[11px] text-muted-foreground">
                {orderCount === 1
                  ? "order"
                  : "orders"}
              </p>
            </div>
          </div>

          {(canEdit || canDelete) && (
            <div className="flex items-center gap-1">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onEdit}
                  title="Edit customer"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}

              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  disabled={deleting}
                  className="text-destructive hover:text-destructive"
                  title="Delete customer"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {customer.address && (
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          {customer.address}
        </p>
      )}

      {customer.notes && (
        <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
          Note: {customer.notes}
        </p>
      )}
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * METRIC CARD
 * ---------------------------------------------------------
 */

function MetricCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {value}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="rounded-lg border p-2.5 text-muted-foreground">
          {icon}
        </div>
      </div>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * FORM FIELD
 * ---------------------------------------------------------
 */

function FormField({
  label,
  required,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const id = `customer-${label
    .toLowerCase()
    .replace(/\s+/g, "-")}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>

      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
      />
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * SUPABASE ERROR HELPER
 * ---------------------------------------------------------
 *
 * Prevents "[object Object]" from appearing in toast.
 */

function getSupabaseErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!error) {
    return fallback;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (
    typeof error === "object" &&
    error !== null
  ) {
    const value = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    if (
      typeof value.message === "string" &&
      value.message.trim()
    ) {
      return value.message;
    }

    if (
      typeof value.details === "string" &&
      value.details.trim()
    ) {
      return value.details;
    }

    if (
      typeof value.hint === "string" &&
      value.hint.trim()
    ) {
      return value.hint;
    }

    if (
      typeof value.code === "string" &&
      value.code.trim()
    ) {
      return `Database error (${value.code})`;
    }
  }

  /*
   * Do not use String(error) here because
   * that produces "[object Object]".
   */

  return fallback;
}