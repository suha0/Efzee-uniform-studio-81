import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  ShieldAlert,
  User,
  UserCircle,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type OrganizationSettings = {
  id: number;
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  updated_at: string;
};

type UserProfile = {
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

function SettingsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // =========================================================
  // ORGANIZATION SETTINGS
  // =========================================================

  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [savingOrganization, setSavingOrganization] =
    useState(false);

  // =========================================================
  // USER PROFILE SETTINGS
  // =========================================================

  const [fullName, setFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [savingProfile, setSavingProfile] =
    useState(false);

  // =========================================================
  // GET CURRENT USER
  // =========================================================

  const {
    data: currentAuthUser,
    isLoading: isAuthLoading,
  } = useQuery({
    queryKey: ["current-auth-user"],
    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase.auth.getUser();

      if (error) {
        throw error;
      }

      return data.user;
    },
  });

  // =========================================================
  // LOAD USER PROFILE
  // =========================================================

  const {
    data: profile,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: [
      "current-user-profile",
      currentAuthUser?.id,
    ],
    enabled: !!currentAuthUser?.id,
    queryFn: async () => {
      if (!currentAuthUser?.id) {
        return null;
      }

      const {
        data,
        error,
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
        .eq(
          "auth_user_id",
          currentAuthUser.id,
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as UserProfile | null;
    },
  });

  // =========================================================
  // LOAD ORGANIZATION SETTINGS
  // =========================================================

  const {
    data: settings,
    isLoading: isSettingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ["organization-settings"],
    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase
        .from("org_settings")
        .select(
          `
            id,
            company_name,
            address,
            phone,
            email,
            logo_url,
            updated_at
          `,
        )
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as OrganizationSettings | null;
    },
  });

  // =========================================================
  // LOAD PROFILE INTO FORM
  // =========================================================

  useEffect(() => {
    if (!profile) {
      return;
    }

    setFullName(profile.full_name ?? "");
    setUserEmail(profile.email ?? "");
    setOrganization(profile.organization ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
  }, [profile]);

  // =========================================================
  // LOAD ORGANIZATION SETTINGS INTO FORM
  // =========================================================

  useEffect(() => {
    if (!settings) {
      return;
    }

    setCompanyName(
      settings.company_name ?? "",
    );

    setAddress(
      settings.address ?? "",
    );

    setPhone(
      settings.phone ?? "",
    );

    setEmail(
      settings.email ?? "",
    );

    setLogoUrl(
      settings.logo_url ?? "",
    );
  }, [settings]);

  // =========================================================
  // SAVE USER PROFILE
  // =========================================================

  async function saveProfile() {
    if (!currentAuthUser?.id) {
      toast.error(
        "Unable to identify your account. Please sign in again.",
      );
      return;
    }

    const trimmedFullName =
      fullName.trim();

    const trimmedEmail =
      userEmail.trim().toLowerCase();

    const trimmedOrganization =
      organization.trim();

    const trimmedAvatarUrl =
      avatarUrl.trim();

    if (!trimmedFullName) {
      toast.error(
        "Full name is required.",
      );
      return;
    }

    if (!trimmedEmail) {
      toast.error(
        "Email address is required.",
      );
      return;
    }

    setSavingProfile(true);

    try {
      // =====================================================
      // 1. Update Supabase Auth email if changed
      // =====================================================

      const currentAuthEmail =
        currentAuthUser.email
          ?.trim()
          .toLowerCase() ?? "";

      if (
        trimmedEmail !==
        currentAuthEmail
      ) {
        const {
          error: authUpdateError,
        } =
          await supabase.auth.updateUser({
            email: trimmedEmail,
          });

        if (authUpdateError) {
          throw authUpdateError;
        }

        toast.info(
          "A confirmation email may be sent to your new email address.",
        );
      }

      // =====================================================
      // 2. Update profiles table
      // =====================================================

      const {
        error: profileUpdateError,
      } = await supabase
        .from("profiles")
        .update({
          full_name:
            trimmedFullName,

          email:
            trimmedEmail,

          organization:
            trimmedOrganization ||
            "",

          avatar_url:
            trimmedAvatarUrl ||
            null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "auth_user_id",
          currentAuthUser.id,
        );

      if (profileUpdateError) {
        throw profileUpdateError;
      }

      // =====================================================
      // 3. Refresh profile data
      // =====================================================

      await queryClient.invalidateQueries({
        queryKey: [
          "current-user-profile",
        ],
      });

      await queryClient.invalidateQueries({
        queryKey: [
          "users-management",
        ],
      });

      await refetchProfile();

      toast.success(
        "Your profile has been updated successfully.",
      );
    } catch (error) {
      console.error(
        "Save profile error:",
        error,
      );

      toast.error(
        friendlyError(error),
      );
    } finally {
      setSavingProfile(false);
    }
  }

  // =========================================================
  // SAVE ORGANIZATION SETTINGS
  // =========================================================

  async function saveSettings() {
    if (!isAdmin) {
      toast.error(
        "Only administrators can update organization settings.",
      );
      return;
    }

    if (!companyName.trim()) {
      toast.error(
        "Company name is required.",
      );
      return;
    }

    setSavingOrganization(true);

    try {
      const {
        error,
      } = await supabase
        .from("org_settings")
        .upsert(
          {
            id: 1,
            company_name:
              companyName.trim(),
            address:
              address.trim() ||
              null,
            phone:
              phone.trim() ||
              null,
            email:
              email.trim() ||
              null,
            logo_url:
              logoUrl.trim() ||
              null,
          },
          {
            onConflict: "id",
          },
        );

      if (error) {
        throw error;
      }

      await refetchSettings();

      toast.success(
        "Organization settings saved successfully.",
      );
    } catch (error) {
      console.error(
        "Save organization settings error:",
        error,
      );

      toast.error(
        friendlyError(error),
      );
    } finally {
      setSavingOrganization(false);
    }
  }

  // =========================================================
  // REFRESH EVERYTHING
  // =========================================================

  async function refresh() {
    try {
      await Promise.all([
        refetchProfile(),
        refetchSettings(),
      ]);

      toast.success(
        "Settings refreshed.",
      );
    } catch (error) {
      toast.error(
        friendlyError(error),
      );
    }
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (
    isAuthLoading ||
    isProfileLoading ||
    isSettingsLoading
  ) {
    return (
      <div className="surface flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />

          <p className="mt-3 text-sm text-muted-foreground">
            Loading settings...
          </p>
        </div>
      </div>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (
    profileError ||
    settingsError
  ) {
    return (
      <div className="surface p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />

        <h2 className="mt-4 text-lg font-semibold">
          Unable to load settings
        </h2>

        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {friendlyError(
            profileError ||
              settingsError,
          )}
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

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="space-y-6">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-primary" />

            <h1 className="text-2xl font-semibold tracking-tight">
              Settings
            </h1>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage your personal profile and organization information.
          </p>
        </div>

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

      {/* =====================================================
          USER PROFILE
      ===================================================== */}

      <div className="surface overflow-hidden">
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <UserCircle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold">
                My Profile
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Manage your personal account information.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {!profile ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                <div>
                  <p className="font-medium">
                    Profile not found
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Your authentication account exists, but no matching
                    profile record was found in the profiles table.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {/* Avatar */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  Profile Picture URL
                </label>

                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {avatarUrl.trim() ? (
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display =
                            "none";
                        }}
                      />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  <Input
                    value={avatarUrl}
                    onChange={(event) =>
                      setAvatarUrl(
                        event.target.value,
                      )
                    }
                    disabled={savingProfile}
                    placeholder="https://example.com/profile.jpg"
                  />
                </div>

                <p className="mt-1.5 text-xs text-muted-foreground">
                  Optional. Enter a publicly accessible image URL.
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Full Name
                </label>

                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    value={fullName}
                    onChange={(event) =>
                      setFullName(
                        event.target.value,
                      )
                    }
                    disabled={savingProfile}
                    placeholder="Enter your full name"
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Email Address
                </label>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    type="email"
                    value={userEmail}
                    onChange={(event) =>
                      setUserEmail(
                        event.target.value,
                      )
                    }
                    disabled={savingProfile}
                    placeholder="your@email.com"
                    className="pl-9"
                  />
                </div>

                <p className="mt-1.5 text-xs text-muted-foreground">
                  Changing your email may require email confirmation.
                </p>
              </div>

              {/* Organization */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  Organization
                </label>

                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    value={organization}
                    onChange={(event) =>
                      setOrganization(
                        event.target.value,
                      )
                    }
                    disabled={savingProfile}
                    placeholder="Enter your organization"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Save */}
        {profile ? (
          <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />

              Profile loaded
            </div>

            <Button
              onClick={() =>
                void saveProfile()
              }
              disabled={savingProfile}
            >
              {savingProfile ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}

              {savingProfile
                ? "Saving..."
                : "Save Profile"}
            </Button>
          </div>
        ) : null}
      </div>

      {/* =====================================================
          ORGANIZATION
      ===================================================== */}

      <div className="surface overflow-hidden">
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Building2 className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold">
                Organization Information
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Basic company information displayed throughout the system.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-5 md:grid-cols-2">
            {/* Company Name */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                Company Name
              </label>

              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  value={companyName}
                  onChange={(event) =>
                    setCompanyName(
                      event.target.value,
                    )
                  }
                  disabled={
                    !isAdmin ||
                    savingOrganization
                  }
                  placeholder="Enter company name"
                  className="pl-9"
                />
              </div>
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                Address
              </label>

              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

                <textarea
                  value={address}
                  onChange={(event) =>
                    setAddress(
                      event.target.value,
                    )
                  }
                  disabled={
                    !isAdmin ||
                    savingOrganization
                  }
                  placeholder="Enter company address"
                  rows={3}
                  className="flex w-full rounded-md border bg-background px-3 py-2 pl-9 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Phone
              </label>

              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value,
                    )
                  }
                  disabled={
                    !isAdmin ||
                    savingOrganization
                  }
                  placeholder="+91 XXXXX XXXXX"
                  className="pl-9"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Email
              </label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                  disabled={
                    !isAdmin ||
                    savingOrganization
                  }
                  placeholder="company@example.com"
                  className="pl-9"
                />
              </div>
            </div>

            {/* Logo URL */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                Logo URL
              </label>

              <Input
                value={logoUrl}
                onChange={(event) =>
                  setLogoUrl(
                    event.target.value,
                  )
                }
                disabled={
                  !isAdmin ||
                  savingOrganization
                }
                placeholder="https://example.com/logo.png"
              />

              <p className="mt-1.5 text-xs text-muted-foreground">
                Optional. Enter a publicly accessible URL for your company
                logo.
              </p>
            </div>
          </div>
        </div>

        {/* Organization Save */}
        {isAdmin ? (
          <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {settings ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Settings loaded
                </>
              ) : (
                "No settings record found"
              )}
            </div>

            <Button
              onClick={() =>
                void saveSettings()
              }
              disabled={
                savingOrganization
              }
            >
              {savingOrganization ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}

              {savingOrganization
                ? "Saving..."
                : "Save Changes"}
            </Button>
          </div>
        ) : null}
      </div>

      {/* =====================================================
          CURRENT ORGANIZATION DETAILS
      ===================================================== */}

      <div className="surface p-5">
        <h2 className="font-semibold">
          Current Organization Details
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem
            icon={
              <Building2 className="h-4 w-4" />
            }
            label="Company"
            value={
              companyName ||
              "Not configured"
            }
          />

          <InfoItem
            icon={
              <Phone className="h-4 w-4" />
            }
            label="Phone"
            value={
              phone ||
              "Not configured"
            }
          />

          <InfoItem
            icon={
              <Mail className="h-4 w-4" />
            }
            label="Email"
            value={
              email ||
              "Not configured"
            }
          />

          <InfoItem
            icon={
              <MapPin className="h-4 w-4" />
            }
            label="Address"
            value={
              address ||
              "Not configured"
            }
          />
        </div>
      </div>

      {/* =====================================================
          CURRENT USER DETAILS
      ===================================================== */}

      {profile ? (
        <div className="surface p-5">
          <h2 className="font-semibold">
            My Account
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem
              icon={
                <User className="h-4 w-4" />
              }
              label="Name"
              value={
                fullName ||
                "Not configured"
              }
            />

            <InfoItem
              icon={
                <Mail className="h-4 w-4" />
              }
              label="Email"
              value={
                userEmail ||
                "Not configured"
              }
            />

            <InfoItem
              icon={
                <Building2 className="h-4 w-4" />
              }
              label="Organization"
              value={
                organization ||
                "Not configured"
              }
            />

            <InfoItem
              icon={
                <CheckCircle2 className="h-4 w-4" />
              }
              label="Account Status"
              value={
                profile.is_active
                  ? "Active"
                  : "Inactive"
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// =============================================================
// INFO ITEM
// =============================================================

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}

        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="mt-2 break-words text-sm font-medium">
        {value}
      </p>
    </div>
  );
}