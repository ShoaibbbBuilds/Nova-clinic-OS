
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardShell from "./dashboard-shell";

export const instant = false;

export default async function DashboardPage() {
  await connection();

  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role, clinic_id, is_active")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Unable to load clinic profile.");
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  const [
    patientsResult,
    appointmentsResult,
    doctorsResult,
    paymentsResult,
    clinicResult,
    patientListResult,
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("doctors")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("payments")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("clinics")
      .select("name")
      .eq("id", profile.clinic_id)
      .single(),

    supabase
      .from("patients")
      .select(
        "id, patient_code, full_name, phone, email, date_of_birth, gender, address, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (patientListResult.error) {
    throw new Error("Unable to load patients: " + patientListResult.error.message);
  }

  const stats = {
    patients: patientsResult.count ?? 0,
    appointments: appointmentsResult.count ?? 0,
    doctors: doctorsResult.count ?? 0,
    payments: paymentsResult.count ?? 0,
  };

  return (
    <DashboardShell
      email={data.user.email}
      fullName={profile.full_name}
      clinicName={clinicResult.data?.name ?? "My Clinic"}
      stats={stats}
      patients={patientListResult.data ?? []}
      clinicId={profile.clinic_id}
      userId={data.user.id}
      role={profile.role}
    />
  );
}
