import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  Users as UsersIcon,
  UserX,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { friendlyError, titleize } from "@/lib/domain";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

type AppRole = "admin" | "sales" | "production";

type Profile = {
  id: string;
  auth_user_id: string;
  full_name: string;
  organization: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type UserRole = {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
};

type UserWithRole = Profile & {
  role: AppRole | null;
};

type RoleFilter = "all" | AppRole;
type StatusFilter = "all" | "active" | "inactive";

const ROLES: Array<{
  value: RoleFilter;
  label: string;
}> = [
  { value: "all", label: "All roles" },
  { value: "admin", label: "Admin" },
  { value: "sales", label: "Sales" },
  { value: "production", label: "Production" },
];

const STATUSES: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "all", label: "All users" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const MEMBER_ROLES: Array<{
  value: AppRole;
  label: string;
}> = [
  { value: "sales", label: "Sales" },
  { value: "production", label: "Production" },
  { value: "admin", label: "Admin" },
];

function getRoleLabel(role: string | null) {
  if (!role) {
    return "No role";
  }

  return titleize(
    role.replaceAll("_", " "),
  );
}

function getRoleClass(role: string | null) {
  switch (role) {
    case "admin":
      return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300";

    case "sales":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

    case "production":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

    default:
      return "bg-muted text-muted-foreground";
  }
}

function UsersPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] =
    useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [isAddMemberOpen, setIsAddMemberOpen] =
    useState(false);

  const [isCreatingMember, setIsCreatingMember] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [newMember, setNewMember] = useState({
    fullName: "",
    email: "",
    organization: "",
    password: "",
    confirmPassword: "",
    role: "sales" as AppRole,
  });

  const {
    data: users = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["users-management"],

    queryFn: async () => {
      /*
       * -------------------------------------------------------
       * 1. Load profiles
       * -------------------------------------------------------
       */

      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from("profiles")
        .select(
          `
            id,
            auth_user_id,
            full_name,
            organization,
            email,
            avatar_url,
            is_active,
            created_at,
            updated_at
          `,
        )
        .not(
          "auth_user_id",
          "is",
          null,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        );

      if (profilesError) {
        throw profilesError;
      }

      /*
       * -------------------------------------------------------
       * 2. Load roles
       * -------------------------------------------------------
       */

      const {
        data: roles,
        error: rolesError,
      } = await supabase
        .from("user_roles")
        .select(
          `
            id,
            user_id,
            role,
            created_at
          `,
        );

      if (rolesError) {
        throw rolesError;
      }

      /*
       * -------------------------------------------------------
       * 3. Create role map
       * -------------------------------------------------------
       */

      const roleMap = new Map<
        string,
        AppRole
      >();

      for (
        const role of (roles ?? []) as UserRole[]
      ) {
        roleMap.set(
          role.user_id,
          role.role,
        );
      }

      /*
       * -------------------------------------------------------
       * 4. IMPORTANT
       *
       * profiles.auth_user_id is the actual Supabase Auth
       * user ID.
       *
       * The frontend cannot directly query auth.users.
       *
       * Therefore the Edge Function below is responsible
       * for cleaning orphaned profiles.
       *
       * For the frontend, we still require a valid
       * auth_user_id before displaying the record.
       * -------------------------------------------------------
       */

      const validProfiles =
        ((profiles ?? []) as Profile[]).filter(
          (profile) =>
            Boolean(
              profile.auth_user_id &&
              profile.auth_user_id.trim(),
            ),
        );

      return validProfiles.map(
        (profile) => ({
          ...profile,

          role:
            roleMap.get(
              profile.auth_user_id,
            ) ?? null,
        }),
      ) as UserWithRole[];
    },
  });

  const filteredUsers = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return users.filter(
      (user) => {
        const matchesSearch =
          !query ||
          (user.full_name ?? "")
            .toLowerCase()
            .includes(query) ||
          (user.email ?? "")
            .toLowerCase()
            .includes(query) ||
          (user.organization ?? "")
            .toLowerCase()
            .includes(query);

        const matchesRole =
          roleFilter === "all" ||
          user.role === roleFilter;

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" &&
            user.is_active) ||
          (statusFilter === "inactive" &&
            !user.is_active);

        return (
          matchesSearch &&
          matchesRole &&
          matchesStatus
        );
      },
    );
  }, [
    users,
    search,
    roleFilter,
    statusFilter,
  ]);

  const stats = useMemo(() => {
    return {
      total: users.length,

      active: users.filter(
        (user) => user.is_active,
      ).length,

      inactive: users.filter(
        (user) => !user.is_active,
      ).length,

      admins: users.filter(
        (user) => user.role === "admin",
      ).length,

      sales: users.filter(
        (user) => user.role === "sales",
      ).length,

      production: users.filter(
        (user) =>
          user.role === "production",
      ).length,
    };
  }, [users]);

  function resetAddMemberForm() {
    setNewMember({
      fullName: "",
      email: "",
      organization: "",
      password: "",
      confirmPassword: "",
      role: "sales",
    });

    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function handleDialogChange(
    open: boolean,
  ) {
    setIsAddMemberOpen(open);

    if (!open) {
      resetAddMemberForm();
    }
  }

  async function createTeamMember() {
    if (!isAdmin) {
      toast.error(
        "Only administrators can add team members.",
      );
      return;
    }

    const fullName =
      newMember.fullName.trim();

    const email =
      newMember.email
        .trim()
        .toLowerCase();

    const organization =
      newMember.organization.trim();

    const password =
      newMember.password;

    const confirmPassword =
      newMember.confirmPassword;

    if (!fullName) {
      toast.error(
        "Please enter the team member's full name.",
      );
      return;
    }

    if (!email) {
      toast.error(
        "Please enter an email address.",
      );
      return;
    }

    if (!organization) {
      toast.error(
        "Please enter the organization.",
      );
      return;
    }

    if (!password) {
      toast.error(
        "Please enter a password.",
      );
      return;
    }

    if (password.length < 6) {
      toast.error(
        "Password must be at least 6 characters.",
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      toast.error(
        "Passwords do not match.",
      );
      return;
    }

    try {
      setIsCreatingMember(true);

      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        toast.error(
          "Unable to get your login session.",
        );
        return;
      }

      const session =
        sessionData.session;

      if (!session?.access_token) {
        toast.error(
          "Your login session has expired. Please sign in again.",
        );
        return;
      }

      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          "create-team-member",
          {
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },

            body: {
              fullName,
              email,
              organization,
              password,
              role: newMember.role,
            },
          },
        );

      if (error) {
        console.error(
          "Supabase Edge Function error:",
          error,
        );

        if (
          "context" in error &&
          error.context
        ) {
          try {
            const errorBody =
              await error.context.json();

            toast.error(
              errorBody?.message ||
                errorBody?.error ||
                "The Edge Function returned an error.",
            );

            return;
          } catch {
            // Ignore JSON parsing error.
          }
        }

        toast.error(
          error.message ||
            "The Edge Function returned an error.",
        );

        return;
      }

      if (
        data &&
        typeof data === "object" &&
        "error" in data &&
        data.error
      ) {
        toast.error(
          String(data.error),
        );
        return;
      }

      toast.success(
        `${fullName} was added successfully.`,
      );

      handleDialogChange(false);

      await queryClient.invalidateQueries(
        {
          queryKey: [
            "users-management",
          ],
        },
      );
    } catch (error) {
      console.error(
        "Create team member error:",
        error,
      );

      toast.error(
        friendlyError(error),
      );
    } finally {
      setIsCreatingMember(false);
    }
  }

  async function refresh() {
    try {
      await refetch();

      toast.success(
        "Users refreshed",
      );
    } catch (error) {
      toast.error(
        friendlyError(error),
      );
    }
  }

  async function toggleUserStatus(
    user: UserWithRole,
  ) {
    if (!isAdmin) {
      toast.error(
        "Only administrators can change user status.",
      );
      return;
    }

    const nextStatus =
      !user.is_active;

    const {
      error,
    } = await supabase
      .from("profiles")
      .update({
        is_active:
          nextStatus,
      })
      .eq(
        "id",
        user.id,
      );

    if (error) {
      toast.error(
        friendlyError(error),
      );
      return;
    }

    await queryClient.invalidateQueries(
      {
        queryKey: [
          "users-management",
        ],
      },
    );

    toast.success(
      nextStatus
        ? `${user.full_name || user.email} activated`
        : `${user.full_name || user.email} deactivated`,
    );
  }

  async function deleteTeamMember(
    user: UserWithRole,
  ) {
    /*
     * IMPORTANT DEBUG INFORMATION
     */
    console.log(
      "TEAM MEMBER BEING DELETED:",
      {
        id: user.id,
        auth_user_id:
          user.auth_user_id,
        email: user.email,
        full_name:
          user.full_name,
      },
    );

    if (!isAdmin) {
      toast.error(
        "Only administrators can remove team members.",
      );
      return;
    }

    if (!user.auth_user_id) {
      toast.error(
        "This team member does not have a valid authentication ID.",
      );
      return;
    }

    if (
      user.role === "admin"
    ) {
      toast.error(
        "Admin accounts cannot be removed from here.",
      );
      return;
    }

    const memberName =
      user.full_name ||
      user.email ||
      "this team member";

    const confirmed =
      window.confirm(
        `Are you sure you want to permanently remove ${memberName}?\n\nThis will delete their account and they will no longer be able to sign in.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        toast.error(
          friendlyError(
            sessionError,
          ),
        );
        return;
      }

      const session =
        sessionData.session;

      if (
        !session?.access_token
      ) {
        toast.error(
          "Your login session has expired. Please sign in again.",
        );
        return;
      }

      console.log(
        "Deleting Auth user:",
        user.auth_user_id,
      );

      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          "delete-team-member",
          {
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },

            body: {
              userId:
                user.auth_user_id,
            },
          },
        );

      console.log(
        "DELETE TEAM MEMBER RESPONSE:",
        {
          data,
          error,
        },
      );

      if (error) {
        console.error(
          "Delete team member error:",
          error,
        );

        if (
          "context" in error &&
          error.context
        ) {
          try {
            const errorBody =
              await error.context.json();

            console.error(
              "DELETE TEAM MEMBER SERVER RESPONSE:",
              errorBody,
            );

            toast.error(
              errorBody?.message ||
                errorBody?.error ||
                "Unable to remove team member.",
            );

            return;
          } catch (parseError) {
            console.error(
              "Could not parse server response:",
              parseError,
            );
          }
        }

        toast.error(
          error.message ||
            "Unable to remove team member.",
        );

        return;
      }

      if (
        data &&
        typeof data === "object" &&
        "error" in data &&
        data.error
      ) {
        toast.error(
          String(data.error),
        );
        return;
      }

      toast.success(
        `${memberName} was removed successfully.`,
      );

      /*
       * Remove stale cached data immediately.
       */
      queryClient.setQueryData<UserWithRole[]>(
        ["users-management"],
        (currentUsers) =>
          (currentUsers ?? []).filter(
            (currentUser) =>
              currentUser.auth_user_id !==
              user.auth_user_id,
          ),
      );

      /*
       * Then reload from Supabase.
       */
      await queryClient.invalidateQueries(
        {
          queryKey: [
            "users-management",
          ],
        },
      );
    } catch (error) {
      console.error(
        "Delete team member error:",
        error,
      );

      toast.error(
        friendlyError(error),
      );
    }
  }

  async function changeRole(
    user: UserWithRole,
    role: AppRole,
  ) {
    if (!isAdmin) {
      toast.error(
        "Only administrators can change user roles.",
      );
      return;
    }

    if (
      user.role === role
    ) {
      return;
    }

    const {
      error: deleteError,
    } =
      await supabase
        .from("user_roles")
        .delete()
        .eq(
          "user_id",
          user.auth_user_id,
        );

    if (deleteError) {
      toast.error(
        friendlyError(
          deleteError,
        ),
      );
      return;
    }

    const {
      error: insertError,
    } =
      await supabase
        .from("user_roles")
        .insert({
          user_id:
            user.auth_user_id,
          role,
        });

    if (insertError) {
      toast.error(
        friendlyError(
          insertError,
        ),
      );
      return;
    }

    await queryClient.invalidateQueries(
      {
        queryKey: [
          "users-management",
        ],
      },
    );

    toast.success(
      `${user.full_name || user.email} is now ${getRoleLabel(role)}`,
    );
  }

  if (!isAdmin) {
    return (
      <div className="surface p-8 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />

        <h2 className="mt-4 text-lg font-semibold">
          Administrator access required
        </h2>

        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          User management is restricted to administrators.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface p-8 text-center">
        <UserX className="mx-auto h-10 w-10 text-destructive" />

        <h2 className="mt-4 text-lg font-semibold">
          Unable to load users
        </h2>

        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {friendlyError(error)}
        </p>

        <Button
          className="mt-5"
          onClick={() =>
            void refresh()
          }
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
            <UsersIcon className="h-6 w-6 text-primary" />

            <h1 className="text-2xl font-semibold tracking-tight">
              Users
            </h1>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage team members, roles and account access.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog
            open={isAddMemberOpen}
            onOpenChange={
              handleDialogChange
            }
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Team Member
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  Add Team Member
                </DialogTitle>

                <DialogDescription>
                  Create a new team member account and
                  assign their role.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">
                    Full Name
                  </Label>

                  <Input
                    id="fullName"
                    placeholder="Enter full name"
                    value={
                      newMember.fullName
                    }
                    onChange={(
                      event,
                    ) =>
                      setNewMember(
                        (current) => ({
                          ...current,
                          fullName:
                            event.target
                              .value,
                        }),
                      )
                    }
                    disabled={
                      isCreatingMember
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email Address
                  </Label>

                  <Input
                    id="email"
                    type="email"
                    placeholder="member@example.com"
                    value={
                      newMember.email
                    }
                    onChange={(
                      event,
                    ) =>
                      setNewMember(
                        (current) => ({
                          ...current,
                          email:
                            event.target
                              .value,
                        }),
                      )
                    }
                    disabled={
                      isCreatingMember
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organization">
                    Organization
                  </Label>

                  <Input
                    id="organization"
                    placeholder="Enter organization"
                    value={
                      newMember.organization
                    }
                    onChange={(
                      event,
                    ) =>
                      setNewMember(
                        (current) => ({
                          ...current,
                          organization:
                            event.target
                              .value,
                        }),
                      )
                    }
                    disabled={
                      isCreatingMember
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">
                    Role
                  </Label>

                  <select
                    id="role"
                    value={
                      newMember.role
                    }
                    onChange={(
                      event,
                    ) =>
                      setNewMember(
                        (current) => ({
                          ...current,
                          role:
                            event.target
                              .value as AppRole,
                        }),
                      )
                    }
                    disabled={
                      isCreatingMember
                    }
                    className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {MEMBER_ROLES.map(
                      (role) => (
                        <option
                          key={
                            role.value
                          }
                          value={
                            role.value
                          }
                        >
                          {
                            role.label
                          }
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password
                  </Label>

                  <div className="relative">
                    <Input
                      id="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      placeholder="Minimum 6 characters"
                      value={
                        newMember.password
                      }
                      onChange={(
                        event,
                      ) =>
                        setNewMember(
                          (current) => ({
                            ...current,
                            password:
                              event.target
                                .value,
                          }),
                        )
                      }
                      disabled={
                        isCreatingMember
                      }
                      className="pr-10"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (current) =>
                            !current,
                        )
                      }
                      disabled={
                        isCreatingMember
                      }
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                      className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    Confirm Password
                  </Label>

                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={
                        showConfirmPassword
                          ? "text"
                          : "password"
                      }
                      placeholder="Re-enter password"
                      value={
                        newMember.confirmPassword
                      }
                      onChange={(
                        event,
                      ) =>
                        setNewMember(
                          (current) => ({
                            ...current,
                            confirmPassword:
                              event.target
                                .value,
                          }),
                        )
                      }
                      disabled={
                        isCreatingMember
                      }
                      className="pr-10"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          (current) =>
                            !current,
                        )
                      }
                      disabled={
                        isCreatingMember
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                      className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    handleDialogChange(
                      false,
                    )
                  }
                  disabled={
                    isCreatingMember
                  }
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={() =>
                    void createTeamMember()
                  }
                  disabled={
                    isCreatingMember
                  }
                >
                  {isCreatingMember ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Team Member
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={() =>
              void refresh()
            }
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.total}
          icon={
            <UsersIcon className="h-5 w-5" />
          }
          description="Registered team members"
        />

        <StatCard
          title="Active"
          value={stats.active}
          icon={
            <CheckCircle2 className="h-5 w-5" />
          }
          description="Currently active accounts"
        />

        <StatCard
          title="Admins"
          value={stats.admins}
          icon={
            <ShieldCheck className="h-5 w-5" />
          }
          description="Administrator accounts"
        />

        <StatCard
          title="Inactive"
          value={stats.inactive}
          icon={
            <UserX className="h-5 w-5" />
          }
          description="Disabled accounts"
        />
      </div>

      {/* Role overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <RoleCard
          title="Sales"
          value={stats.sales}
          description="Sales team members"
          role="sales"
        />

        <RoleCard
          title="Production"
          value={stats.production}
          description="Production team members"
          role="production"
        />

        <RoleCard
          title="Administrators"
          value={stats.admins}
          description="Users with full access"
          role="admin"
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
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search name, email or organization..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(
                    event.target
                      .value as RoleFilter,
                  )
                }
                className="h-10 w-full min-w-[160px] rounded-md border bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLES.map(
                  (role) => (
                    <option
                      key={
                        role.value
                      }
                      value={
                        role.value
                      }
                    >
                      {role.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as StatusFilter,
                )
              }
              className="h-10 w-full min-w-[150px] rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {STATUSES.map(
                (status) => (
                  <option
                    key={
                      status.value
                    }
                    value={
                      status.value
                    }
                  >
                    {status.label}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Users table */}
      <div className="surface overflow-hidden">
        <div className="border-b px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">
                Team Members
              </h2>

              <p className="text-sm text-muted-foreground">
                {filteredUsers.length}{" "}
                {filteredUsers.length ===
                1
                  ? "user"
                  : "users"}{" "}
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
                Loading users...
              </p>
            </div>
          </div>
        ) : filteredUsers.length ===
          0 ? (
          <div className="flex min-h-[300px] items-center justify-center px-6 text-center">
            <div>
              <UsersIcon className="mx-auto h-10 w-10 text-muted-foreground" />

              <h3 className="mt-3 font-medium">
                {users.length ===
                0
                  ? "No users found"
                  : "No matching users"}
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                {users.length ===
                0
                  ? "Registered users will appear here."
                  : "Try changing your search or filters."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">
                    User
                  </th>

                  <th className="px-5 py-3">
                    Organization
                  </th>

                  <th className="px-5 py-3">
                    Role
                  </th>

                  <th className="px-5 py-3">
                    Status
                  </th>

                  <th className="px-5 py-3">
                    Joined
                  </th>

                  <th className="px-5 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredUsers.map(
                  (user) => (
                    <tr
                      key={
                        user.id
                      }
                      className="transition-colors hover:bg-muted/20"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted font-medium">
                            {(
                              user.full_name ||
                              user.email ||
                              "U"
                            )
                              .charAt(
                                0,
                              )
                              .toUpperCase()}
                          </div>

                          <div>
                            <p className="font-medium">
                              {user.full_name ||
                                "Unnamed user"}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {
                                user.email
                              }
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-sm">
                          {user.organization ||
                            "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <select
                          value={
                            user.role ??
                            ""
                          }
                          disabled={
                            !isAdmin
                          }
                          onChange={(
                            event,
                          ) => {
                            const role =
                              event
                                .target
                                .value as AppRole;

                            if (
                              role
                            ) {
                              void changeRole(
                                user,
                                role,
                              );
                            }
                          }}
                          className={`rounded-full border-0 px-3 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-ring ${getRoleClass(
                            user.role,
                          )}`}
                        >
                          {!user.role ? (
                            <option value="">
                              No role
                            </option>
                          ) : null}

                          <option value="admin">
                            Admin
                          </option>

                          <option value="sales">
                            Sales
                          </option>

                          <option value="production">
                            Production
                          </option>
                        </select>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            user.is_active
                              ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                          }
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              user.is_active
                                ? "bg-emerald-500"
                                : "bg-muted-foreground"
                            }`}
                          />

                          {user.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {new Date(
                          user.created_at,
                        ).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void toggleUserStatus(
                                user,
                              )
                            }
                          >
                            {user.is_active ? (
                              <>
                                <UserX className="mr-2 h-3.5 w-3.5" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                Activate
                              </>
                            )}
                          </Button>

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              void deleteTeamMember(
                                user,
                              )
                            }
                            disabled={
                              user.role ===
                              "admin"
                            }
                            title={
                              user.role ===
                              "admin"
                                ? "Admin accounts cannot be removed"
                                : "Remove team member"
                            }
                          >
                            <UserX className="mr-2 h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="surface p-5">
        <div className="flex items-start gap-3">
          <UserCog className="mt-0.5 h-5 w-5 text-primary" />

          <div>
            <h3 className="font-medium">
              Role permissions
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Admin users have full management
              access. Sales users can manage
              customers and orders, while
              production users can manage
              manufacturing operations.
            </p>
          </div>
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

          <p className="mt-2 text-3xl font-semibold">
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

function RoleCard({
  title,
  value,
  description,
  role,
}: {
  title: string;
  value: number;
  description: string;
  role: AppRole;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getRoleClass(
              role,
            )}`}
          >
            {title}
          </span>

          <p className="mt-3 text-2xl font-semibold">
            {value}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {description}
          </p>
        </div>

        <UserCog className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  );
}