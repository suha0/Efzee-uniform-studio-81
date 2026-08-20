import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type AppRole = "admin" | "sales" | "production";

type CreateTeamMemberRequest = {
  fullName: string;
  email: string;
  organization: string;
  password: string;
  role: AppRole;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    },
  );
}

Deno.serve(async (req: Request) => {
  // =========================================================
  // 1. CORS
  // =========================================================

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error:
          "Method not allowed.",
      },
      405,
    );
  }

  try {
    // =========================================================
    // 2. Supabase environment variables
    // =========================================================

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const supabaseAnonKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY",
      );

    const supabaseServiceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !supabaseServiceRoleKey
    ) {
      console.error(
        "Missing Supabase environment variables.",
      );

      return jsonResponse(
        {
          error:
            "Server configuration error.",
          message:
            "Required Supabase environment variables are missing.",
        },
        500,
      );
    }

    // =========================================================
    // 3. Get Authorization header
    // =========================================================

    const authHeader =
      req.headers.get(
        "Authorization",
      );

    if (!authHeader) {
      console.error(
        "Authorization header missing.",
      );

      return jsonResponse(
        {
          error:
            "Unauthorized",
          message:
            "No authentication token was provided.",
        },
        401,
      );
    }

    // =========================================================
    // 4. Create client using logged-in user's JWT
    // =========================================================

    const supabaseUser =
      createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          global: {
            headers: {
              Authorization:
                authHeader,
            },
          },
          auth: {
            autoRefreshToken:
              false,
            persistSession:
              false,
          },
        },
      );

    // =========================================================
    // 5. Verify logged-in user
    // =========================================================

    const {
      data: {
        user: caller,
      },
      error: callerError,
    } =
      await supabaseUser.auth.getUser();

    if (
      callerError ||
      !caller
    ) {
      console.error(
        "Caller authentication failed:",
        callerError,
      );

      return jsonResponse(
        {
          error:
            "Unauthorized",
          message:
            "You must be logged in to create a team member.",
        },
        401,
      );
    }

    console.log(
      "Authenticated caller:",
      caller.id,
    );

    // =========================================================
    // 6. Create service-role client
    // =========================================================

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,
            persistSession:
              false,
          },
        },
      );

    // =========================================================
    // 7. Check caller's role
    // =========================================================

    const {
      data: callerRole,
      error: callerRoleError,
    } =
      await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq(
          "user_id",
          caller.id,
        )
        .maybeSingle();

    if (callerRoleError) {
      console.error(
        "Failed to check caller role:",
        callerRoleError,
      );

      return jsonResponse(
        {
          error:
            "Authorization check failed.",
          message:
            callerRoleError.message,
        },
        500,
      );
    }

    console.log(
      "Caller role:",
      callerRole?.role,
    );

    if (
      callerRole?.role !==
      "admin"
    ) {
      return jsonResponse(
        {
          error:
            "Forbidden",
          message:
            "Only administrators can create team members.",
        },
        403,
      );
    }

    // =========================================================
    // 8. Read request body
    // =========================================================

    let body:
      CreateTeamMemberRequest;

    try {
      body =
        (await req.json()) as CreateTeamMemberRequest;
    } catch (error) {
      console.error(
        "Invalid JSON body:",
        error,
      );

      return jsonResponse(
        {
          error:
            "Invalid request body.",
          message:
            "The request body must contain valid JSON.",
        },
        400,
      );
    }

    const fullName =
      body.fullName?.trim();

    const email =
      body.email
        ?.trim()
        .toLowerCase();

    const organization =
      body.organization?.trim();

    const password =
      body.password;

    const role =
      body.role;

    // =========================================================
    // 9. Validate input
    // =========================================================

    if (!fullName) {
      return jsonResponse(
        {
          error:
            "Full name is required.",
        },
        400,
      );
    }

    if (!email) {
      return jsonResponse(
        {
          error:
            "Email address is required.",
        },
        400,
      );
    }

    if (!organization) {
      return jsonResponse(
        {
          error:
            "Organization is required.",
        },
        400,
      );
    }

    if (!password) {
      return jsonResponse(
        {
          error:
            "Password is required.",
        },
        400,
      );
    }

    if (
      password.length < 6
    ) {
      return jsonResponse(
        {
          error:
            "Password must be at least 6 characters.",
        },
        400,
      );
    }

    if (
      role !== "admin" &&
      role !== "sales" &&
      role !== "production"
    ) {
      return jsonResponse(
        {
          error:
            "Invalid team member role.",
        },
        400,
      );
    }

    // =========================================================
    // 10. Create Auth user
    //
    // IMPORTANT:
    //
    // The database trigger handle_new_user()
    // automatically creates:
    //
    //   profiles
    //   user_roles
    //
    // Therefore this function MUST NOT insert
    // into either table.
    //
    // We pass the selected role through user_metadata
    // so the trigger can assign it.
    // =========================================================

    const {
      data: authData,
      error: authError,
    } =
      await supabaseAdmin.auth.admin.createUser(
        {
          email,
          password,

          // Automatically confirm the account.
          email_confirm: true,

          user_metadata: {
            full_name:
              fullName,
            organization:
              organization,
            role: role,
          },
        },
      );

    if (authError) {
      console.error(
        "Failed to create Auth user:",
        authError,
      );

      return jsonResponse(
        {
          error:
            "Unable to create account.",
          message:
            authError.message,
        },
        400,
      );
    }

    const newUser =
      authData.user;

    if (!newUser) {
      return jsonResponse(
        {
          error:
            "User account was not created.",
        },
        500,
      );
    }

    console.log(
      "Auth user created:",
      newUser.id,
    );

    // =========================================================
    // 11. Verify profile created by database trigger
    // =========================================================

    const {
      data: profile,
      error: profileLookupError,
    } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, auth_user_id, full_name, email, organization, is_active",
        )
        .eq(
          "auth_user_id",
          newUser.id,
        )
        .maybeSingle();

    if (profileLookupError) {
      console.error(
        "Failed to verify profile:",
        profileLookupError,
      );

      // Clean up Auth user if profile verification fails.
      await supabaseAdmin.auth.admin.deleteUser(
        newUser.id,
      );

      return jsonResponse(
        {
          error:
            "Failed to verify user profile.",
          message:
            profileLookupError.message,
        },
        500,
      );
    }

    if (!profile) {
      console.error(
        "Database trigger did not create profile.",
      );

      await supabaseAdmin.auth.admin.deleteUser(
        newUser.id,
      );

      return jsonResponse(
        {
          error:
            "User profile was not created.",
          message:
            "The Auth user was created, but the database trigger did not create the profiles record.",
        },
        500,
      );
    }

    console.log(
      "Profile created automatically by trigger:",
      profile.id,
    );

    // =========================================================
    // 12. Update profile
    //
    // The trigger already creates the profile.
    // We only update it to ensure the requested values
    // are present.
    // =========================================================

    const {
      error: profileUpdateError,
    } =
      await supabaseAdmin
        .from("profiles")
        .update({
          full_name:
            fullName,
          organization:
            organization,
          email: email,
          is_active: true,
        })
        .eq(
          "auth_user_id",
          newUser.id,
        );

    if (profileUpdateError) {
      console.error(
        "Failed to update profile:",
        profileUpdateError,
      );

      // Remove Auth user.
      // The database trigger-created records may also
      // be removed depending on your database relationships.
      await supabaseAdmin.auth.admin.deleteUser(
        newUser.id,
      );

      return jsonResponse(
        {
          error:
            "Failed to update user profile.",
          message:
            profileUpdateError.message,
        },
        500,
      );
    }

    console.log(
      "Profile updated successfully:",
      newUser.id,
    );

    // =========================================================
    // 13. Verify role created by database trigger
    //
    // DO NOT INSERT INTO user_roles HERE.
    // handle_new_user() already does it.
    // =========================================================

    const {
      data: createdRole,
      error: createdRoleError,
    } =
      await supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .eq(
          "user_id",
          newUser.id,
        )
        .maybeSingle();

    if (createdRoleError) {
      console.error(
        "Failed to verify user role:",
        createdRoleError,
      );

      await supabaseAdmin.auth.admin.deleteUser(
        newUser.id,
      );

      return jsonResponse(
        {
          error:
            "Failed to verify user role.",
          message:
            createdRoleError.message,
        },
        500,
      );
    }

    if (!createdRole) {
      console.error(
        "Database trigger did not create user role.",
      );

      await supabaseAdmin.auth.admin.deleteUser(
        newUser.id,
      );

      return jsonResponse(
        {
          error:
            "User role was not created.",
          message:
            "The Auth user was created, but the database trigger did not create the user_roles record.",
        },
        500,
      );
    }

    console.log(
      "Role created automatically by trigger:",
      createdRole.role,
    );

    // =========================================================
    // 14. Check whether requested role matches created role
    // =========================================================

    if (
      createdRole.role !==
      role
    ) {
      console.warn(
        `Requested role "${role}" but trigger created "${createdRole.role}".`,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Role assignment mismatch.",
          message:
            `The requested role was "${role}", but the database trigger assigned "${createdRole.role}".`,
          user: {
            id: newUser.id,
            email:
              newUser.email,
            fullName,
            organization,
            requestedRole:
              role,
            assignedRole:
              createdRole.role,
          },
        },
        409,
      );
    }

    // =========================================================
    // 15. SUCCESS
    // =========================================================

    console.log(
      "Team member created successfully:",
      {
        id: newUser.id,
        email:
          newUser.email,
        role:
          createdRole.role,
      },
    );

    return jsonResponse(
      {
        success: true,
        message:
          "Team member created successfully.",
        user: {
          id: newUser.id,
          email:
            newUser.email,
          fullName,
          organization,
          role:
            createdRole.role,
        },
      },
      201,
    );
  } catch (error) {
    console.error(
      "Unexpected Edge Function error:",
      error,
    );

    return jsonResponse(
      {
        error:
          "Internal server error.",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      500,
    );
  }
});