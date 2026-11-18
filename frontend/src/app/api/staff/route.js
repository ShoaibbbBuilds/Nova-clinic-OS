


import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  }

  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function getAuthorizedAdmin() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "Unauthorized", status: 401 };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.role !== "admin" ||
    profile.is_active !== true
  ) {
    return { error: "Admin access required.", status: 403 };
  }

  return { user, profile, supabase };
}

export async function GET() {
  const auth = await getAuthorizedAdmin();

  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const admin = getAdminClient();

  const [
    profilesResult,
    usersResult,
    doctorsResult,
  ] = await Promise.all([
    auth.supabase
      .from("profiles")
      .select("id, full_name, role, is_active, created_at")
      .eq("clinic_id", auth.profile.clinic_id)
      .order("created_at", { ascending: false }),

    admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    }),

    auth.supabase
      .from("doctors")
      .select("id, full_name, email")
      .eq("clinic_id", auth.profile.clinic_id)
      .is("profile_id", null)
      .eq("is_active", true),
  ]);

  if (profilesResult.error || usersResult.error || doctorsResult.error) {
    return NextResponse.json(
      { error: "Unable to load staff directory." },
      { status: 500 }
    );
  }

  const emails = new Map(
    usersResult.data.users.map((user) => [
      user.id,
      user.email,
    ])
  );

  return NextResponse.json({
    staff: profilesResult.data.map((profile) => ({
      ...profile,
      email: emails.get(profile.id) || "",
    })),
    availableDoctors: doctorsResult.data,
  });
}

export async function POST(request) {
  const auth = await getAuthorizedAdmin();

  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const body = await request.json();

    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    const role = body.role;
    const doctorId = body.doctorId || null;

    if (!email || !fullName || !["doctor", "receptionist"].includes(role)) {
      return NextResponse.json(
        { error: "Enter a name, valid email and staff role." },
        { status: 400 }
      );
    }

    if (role === "doctor" && !doctorId) {
      return NextResponse.json(
        { error: "Select an existing doctor record." },
        { status: 400 }
      );
    }

    if (role === "receptionist" && doctorId) {
      return NextResponse.json(
        { error: "Receptionists cannot be linked to doctor records." },
        { status: 400 }
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

    if (invitationError) {
      return NextResponse.json(
        { error: invitationError.message },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!siteUrl) {
      await admin.rpc("cancel_staff_invitation", {
        p_invitation_id: invitationId,
      });

      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL is missing." },
        { status: 500 }
      );
    }

    const { error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
      });

    if (inviteError) {
      await admin.rpc("cancel_staff_invitation", {
        p_invitation_id: invitationId,
      });

      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to send invitation." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const auth = await getAuthorizedAdmin();

  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const { userId, isActive } = await request.json();

    if (!userId || typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "Invalid account update." },
        { status: 400 }
      );
    }

    if (userId === auth.user.id) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account." },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    const { data: target, error: targetError } = await auth.supabase
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", userId)
      .eq("clinic_id", auth.profile.clinic_id)
      .single();

    if (targetError || !target) {
      return NextResponse.json(
        { error: "Staff account not found." },
        { status: 404 }
      );
    }

    if (target.role === "admin" && !isActive && target.is_active) {
      const { count, error: countError } = await auth.supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", auth.profile.clinic_id)
        .eq("role", "admin")
        .eq("is_active", true);

      if (countError || count <= 1) {
        return NextResponse.json(
          { error: "A clinic must retain at least one active admin." },
          { status: 400 }
        );
      }
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", userId)
      .eq("clinic_id", auth.profile.clinic_id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    const { error: authError } = await admin.auth.admin.updateUserById(
      userId,
      {
        ban_duration: isActive ? "none" : "876000h",
      }
    );

    if (authError) {
      await admin
        .from("profiles")
        .update({ is_active: target.is_active })
        .eq("id", userId);

      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: isActive ? "Account activated." : "Account deactivated.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to update account." },
      { status: 500 }
    );
  }
}
