import { createClient } from "npm:@supabase/supabase-js@2";

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

type DeleteTeamMemberRequest = {
  userId: string;
};

Deno.serve(async (req: Request) => {
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
    /*
     * -------------------------------------------------------
     * Environment
     * -------------------------------------------------------
     */

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      );

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

    /*
     * -------------------------------------------------------
     * Authorization
     * -------------------------------------------------------
     */

    const authHeader =
      req.headers.get(
        "Authorization",
      );

    if (!authHeader) {
      return jsonResponse(
        {
          error: "Unauthorized",
          message:
            "No authentication token was provided.",
        },
        401,
      );
    }

    /*
     * Client using caller JWT
     */

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

    /*
     * Verify caller
     */

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
      return jsonResponse(
        {
          error:
            "Unauthorized",
          message:
            "You must be logged in.",
        },
        401,
      );
    }

    /*
     * -------------------------------------------------------
     * Service-role client
     * -------------------------------------------------------
     */

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

    /*
     * -------------------------------------------------------
     * Verify caller is admin
     * -------------------------------------------------------
     */

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

    if (
      callerRole?.role !==
      "admin"
    ) {
      return jsonResponse(
        {
          error:
            "Forbidden",
          message:
            "Only administrators can remove team members.",
        },
        403,
      );
    }

    /*
     * -------------------------------------------------------
     * Read request
     * -------------------------------------------------------
     */

    let body:
      DeleteTeamMemberRequest;

    try {
      body =
        (await req.json()) as DeleteTeamMemberRequest;
    } catch {
      return jsonResponse(
        {
          error:
            "Invalid request body.",
        },
        400,
      );
    }

    const userId =
      body.userId?.trim();

    if (!userId) {
      return jsonResponse(
        {
          error:
            "User ID is required.",
        },
        400,
      );
    }

    /*
     * -------------------------------------------------------
     * Prevent self-delete
     * -------------------------------------------------------
     */

    if (
      userId === caller.id
    ) {
      return jsonResponse(
        {
          error:
            "You cannot remove your own account.",
        },
        400,
      );
    }

    console.log(
      "DELETE REQUEST:",
      {
        callerId:
          caller.id,
        targetUserId:
          userId,
      },
    );

    /*
     * -------------------------------------------------------
     * Find profile
     * -------------------------------------------------------
     */

    const {
      data: targetProfile,
      error:
        targetProfileError,
    } =
      await supabaseAdmin
        .from("profiles")
        .select(
          `
            id,
            auth_user_id,
            full_name,
            email
          `,
        )
        .eq(
          "auth_user_id",
          userId,
        )
        .maybeSingle();

    if (targetProfileError) {
      console.error(
        "Failed to find target profile:",
        targetProfileError,
      );

      return jsonResponse(
        {
          error:
            "Unable to find team member.",
          message:
            targetProfileError.message,
        },
        500,
      );
    }

    /*
     * -------------------------------------------------------
     * IMPORTANT:
     *
     * The profile may exist even when its Auth user does not.
     *
     * We therefore check Auth directly.
     * -------------------------------------------------------
     */

    let authUserExists =
      false;

    try {
      const {
        data: authUser,
        error:
          authLookupError,
      } =
        await supabaseAdmin.auth.admin.getUserById(
          userId,
        );

      if (
        authLookupError ||
        !authUser?.user
      ) {
        console.warn(
          "Auth user does not exist:",
          {
            userId,
            error:
              authLookupError,
          },
        );
      } else {
        authUserExists = true;
      }
    } catch (error) {
      console.error(
        "Auth lookup failed:",
        error,
      );
    }

    /*
     * -------------------------------------------------------
     * If profile exists but Auth user is gone:
     *
     * CLEAN UP ORPHANED RECORDS.
     * -------------------------------------------------------
     */

    if (
      targetProfile &&
      !authUserExists
    ) {
      console.warn(
        "ORPHANED PROFILE FOUND. Cleaning it up:",
        {
          profileId:
            targetProfile.id,
          authUserId:
            targetProfile.auth_user_id,
          email:
            targetProfile.email,
        },
      );

      const {
        error:
          orphanRoleDeleteError,
      } =
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq(
            "user_id",
            userId,
          );

      if (
        orphanRoleDeleteError
      ) {
        console.warn(
          "Could not delete orphan role:",
          orphanRoleDeleteError,
        );
      }

      const {
        error:
          orphanProfileDeleteError,
      } =
        await supabaseAdmin
          .from("profiles")
          .delete()
          .eq(
            "id",
            targetProfile.id,
          );

      if (
        orphanProfileDeleteError
      ) {
        console.error(
          "Could not delete orphan profile:",
          orphanProfileDeleteError,
        );

        return jsonResponse(
          {
            error:
              "Unable to clean up orphaned team member.",
            message:
              orphanProfileDeleteError.message,
          },
          500,
        );
      }

      return jsonResponse(
        {
          success: true,
          orphaned: true,
          message:
            "Orphaned team member record was removed.",
          user: {
            id: userId,
            email:
              targetProfile.email,
            fullName:
              targetProfile.full_name,
          },
        },
        200,
      );
    }

    /*
     * -------------------------------------------------------
     * If neither Auth nor profile exists
     * -------------------------------------------------------
     */

    if (
      !targetProfile &&
      !authUserExists
    ) {
      return jsonResponse(
        {
          error:
            "Team member not found.",
          message:
            "The requested user does not exist.",
        },
        404,
      );
    }

    /*
     * -------------------------------------------------------
     * If Auth exists but profile doesn't
     *
     * We can still remove the Auth account.
     * -------------------------------------------------------
     */

    if (
      !targetProfile &&
      authUserExists
    ) {
      console.warn(
        "Auth user exists but profile does not:",
        userId,
      );
    }

    /*
     * -------------------------------------------------------
     * Prevent deleting another admin
     * -------------------------------------------------------
     */

    const {
      data: targetRole,
      error:
        targetRoleError,
    } =
      await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq(
          "user_id",
          userId,
        )
        .maybeSingle();

    if (targetRoleError) {
      console.error(
        "Failed to check target role:",
        targetRoleError,
      );

      return jsonResponse(
        {
          error:
            "Unable to verify team member role.",
          message:
            targetRoleError.message,
        },
        500,
      );
    }

    if (
      targetRole?.role ===
      "admin"
    ) {
      return jsonResponse(
        {
          error:
            "Admin accounts cannot be removed from here.",
          message:
            "Change the account to a non-admin role before removing it.",
        },
        400,
      );
    }

    /*
     * -------------------------------------------------------
     * Delete Auth user
     * -------------------------------------------------------
     */

    if (authUserExists) {
      const {
        error:
          deleteAuthError,
      } =
        await supabaseAdmin.auth.admin.deleteUser(
          userId,
        );

      if (
        deleteAuthError
      ) {
        console.error(
          "Failed to delete Auth user:",
          deleteAuthError,
        );

        return jsonResponse(
          {
            error:
              "Unable to remove team member.",
            message:
              deleteAuthError.message,
          },
          400,
        );
      }
    }

    /*
     * -------------------------------------------------------
     * Delete profile
     * -------------------------------------------------------
     */

    if (targetProfile) {
      const {
        error:
          profileDeleteError,
      } =
        await supabaseAdmin
          .from("profiles")
          .delete()
          .eq(
            "id",
            targetProfile.id,
          );

      if (
        profileDeleteError
      ) {
        console.warn(
          "Profile cleanup warning:",
          profileDeleteError,
        );
      }
    }

    /*
     * -------------------------------------------------------
     * Delete role
     * -------------------------------------------------------
     */

    const {
      error:
        roleDeleteError,
    } =
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq(
          "user_id",
          userId,
        );

    if (
      roleDeleteError
    ) {
      console.warn(
        "Role cleanup warning:",
        roleDeleteError,
      );
    }

    /*
     * -------------------------------------------------------
     * SUCCESS
     * -------------------------------------------------------
     */

    console.log(
      "Team member deleted successfully:",
      {
        id: userId,
        email:
          targetProfile?.email ??
          null,
        name:
          targetProfile?.full_name ??
          null,
      },
    );

    return jsonResponse(
      {
        success: true,
        message:
          "Team member removed successfully.",
        user: {
          id: userId,
          email:
            targetProfile?.email ??
            null,
          fullName:
            targetProfile?.full_name ??
            null,
        },
      },
      200,
    );
  } catch (error) {
    console.error(
      "Unexpected delete-team-member error:",
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