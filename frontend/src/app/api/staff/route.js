
import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(message, status) {
  return NextResponse.json({ error: message }, { status });
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server configuration is incomplete.");
  }

  return createSupabaseAdmin(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getAuthorizedAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized.", status: 401 };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { error: "Unable to verify account permissions.", status: 500 };
  }

  if (
    !profile ||
    profile.role !== "admin" ||
    profile.is_active !== true ||
    !profile.clinic_id
  ) {
    return { error: "Admin access required.", status: 403 };
  }

  return { user, profile, supabase };
}

async function getRequestBody(request) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }

    return body;
  } catch {
    return null;
  }
}

function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL;

  if (!value) return null;

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1"
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const auth = await getAuthorizedAdmin();

    if (auth.error) {
      return errorResponse(auth.error, auth.status);
    }

    const admin = getAdminClient();

    const [profilesResult, doctorsResult] = await Promise.all([
      auth.supabase
        .from("profiles")
        .select("id, full_name, role, is_active, created_at")
        .eq("clinic_id", auth.profile.clinic_id)
        .order("created_at", { ascending: false }),

      auth.supabase
        .from("doctors")
        .select("id, full_name, email")
        .eq("clinic_id", auth.profile.clinic_id)
        .is("profile_id", null)
        .eq("is_active", true),
    ]);

    if (profilesResult.error || doctorsResult.error) {
      return errorResponse("Unable to load staff directory.", 500);
    }

    // Fetch only this clinic's staff users instead of listing
    // up to 1,000 Auth users across the entire project.
    const staff = await Promise.all(
      profilesResult.data.map(async (profile) => {
        const { data, error } = await admin.auth.admin.getUserById(
          profile.id
        );

        if (error) {
          throw error;
        }

        return {
          ...profile,
          email: data.user?.email || "",
        };
      })
    );

    return NextResponse.json({
      staff,
      availableDoctors: doctorsResult.data,
    });
  } catch (error) {
    console.error("Staff GET error:", error);
    return errorResponse("Unable to load staff directory.", 500);
  }
}

export async function POST(request) {
  try {
    const auth = await getAuthorizedAdmin();

    if (auth.error) {
      return errorResponse(auth.error, auth.status);
    }

    const body = await getRequestBody(request);

    if (!body) {
      return errorResponse("Invalid request body.", 400);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    const role = body.role;

    const doctorId =
      body.doctorId === null ||
        body.doctorId === undefined ||
        body.doctorId === ""
        ? null
        : body.doctorId;

    const validEmail =
      email.length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const validName =
      fullName.length > 0 &&
      fullName.length <= 120 &&
      !/[\u0000-\u001F\u007F]/.test(fullName);

    if (
      !validEmail ||
      !validName ||
      !["doctor", "receptionist"].includes(role)
    ) {
      return errorResponse(
        "Enter a valid name, email and staff role.",
        400
      );
    }

    if (role === "doctor" && !doctorId) {
      return errorResponse("Select an existing doctor record.", 400);
    }

    if (
      doctorId !== null &&
      (typeof doctorId !== "string" || !UUID_REGEX.test(doctorId))
    ) {
      return errorResponse("Invalid doctor record.", 400);
    }

    if (role === "receptionist" && doctorId) {
      return errorResponse(
        "Receptionists cannot be linked to doctor records.",
        400
      );
    }

    const siteUrl = getSiteUrl();

    if (!siteUrl) {
      return errorResponse(
        "The invitation redirect URL is missing or invalid.",
        500
      );
    }

    const admin = getAdminClient();

    const { data: invitationId, error: invitationError } =
      await admin.rpc("create_staff_invitation", {
        p_clinic_id: auth.profile.clinic_id,
        p_email: email,
        p_full_name: fullName,
        p_role: role,
        p_invited_by: auth.user.id,
        p_doctor_id: doctorId,
      });

    if (invitationError || !invitationId) {
      console.error("Staff invitation creation failed:", invitationError);

      return errorResponse(
        "Unable to create invitation. Check the email and doctor record.",
        400
      );
    }

    const redirectUrl = new URL("/auth/callback", siteUrl);
    redirectUrl.searchParams.set("next", "/dashboard");

    const { error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectUrl.toString(),
      });

    if (inviteError) {
      console.error("Staff email invitation failed:", inviteError);

      const { error: cancelError } = await admin.rpc(
        "cancel_staff_invitation",
        {
          p_invitation_id: invitationId,
        }
      );

      if (cancelError) {
        console.error(
          "Failed to cancel staff invitation:",
          cancelError
        );
      }

      return errorResponse(
        "Unable to send invitation. Check the email address or try again later.",
        400
      );
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}.`,
    });
  } catch (error) {
    console.error("Staff POST error:", error);
    return errorResponse("Unable to send invitation.", 500);
  }
}

export async function PATCH(request) {
  try {
    const auth = await getAuthorizedAdmin();

    if (auth.error) {
      return errorResponse(auth.error, auth.status);
    }

    const body = await getRequestBody(request);

    if (!body) {
      return errorResponse("Invalid request body.", 400);
    }

    const { userId, isActive } = body;

    if (
      typeof userId !== "string" ||
      !UUID_REGEX.test(userId) ||
      typeof isActive !== "boolean"
    ) {
      return errorResponse("Invalid account update.", 400);
    }

    if (userId === auth.user.id) {
      return errorResponse(
        "You cannot deactivate your own account.",
        400
      );
    }

    const admin = getAdminClient();

    const { data: target, error: targetError } = await auth.supabase
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", userId)
      .eq("clinic_id", auth.profile.clinic_id)
      .maybeSingle();

    if (targetError) {
      return errorResponse("Unable to verify staff account.", 500);
    }

    if (!target) {
      return errorResponse("Staff account not found.", 404);
    }

    if (target.is_active === isActive) {
      return NextResponse.json({
        success: true,
        message: isActive
          ? "Account is already active."
          : "Account is already inactive.",
      });
    }

    if (target.role === "admin" && !isActive) {
      const { count, error: countError } = await auth.supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", auth.profile.clinic_id)
        .eq("role", "admin")
        .eq("is_active", true);

      if (countError) {
        return errorResponse(
          "Unable to verify active clinic administrators.",
          500
        );
      }

      if (count === null || count <= 1) {
        return errorResponse(
          "A clinic must retain at least one active admin.",
          400
        );
      }
    }

    // Update Auth first. If the profile update fails,
    // attempt to restore the previous Auth ban state.
    const { error: authError } = await admin.auth.admin.updateUserById(
      userId,
      {
        ban_duration: isActive ? "none" : "876000h",
      }
    );

    if (authError) {
      console.error("Staff Auth update failed:", authError);
      return errorResponse("Unable to update staff account.", 500);
    }

    const { data: updatedProfile, error: updateError } = await admin
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", userId)
      .eq("clinic_id", auth.profile.clinic_id)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedProfile) {
      console.error("Staff profile update failed:", updateError);

      const { error: rollbackError } =
        await admin.auth.admin.updateUserById(userId, {
          ban_duration: target.is_active ? "none" : "876000h",
        });

      if (rollbackError) {
        console.error("Staff Auth rollback failed:", rollbackError);
      }

      return errorResponse(
        "Unable to update staff account. Please verify its status.",
        500
      );
    }

    return NextResponse.json({
      success: true,
      message: isActive
        ? "Account activated."
        : "Account deactivated.",
    });
  } catch (error) {
    console.error("Staff PATCH error:", error);
    return errorResponse("Unable to update staff account.", 500);
  }
}
