
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const emptyForm = {
  patient_id: "",
  doctor_id: "",
  appointment_at: "",
  reason: "",
};

const inputClass =
  "w-full rounded-[var(--control-radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";

const labelClass =
  "mb-2 block text-sm font-medium text-[var(--foreground)]";

export default function AppointmentsPanel({ isReadOnly = false }) {
  const supabase = useMemo(() => createClient(), []);

  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Please log in again.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("clinic_id, role")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile?.clinic_id) {
      setError("Unable to load your clinic profile.");
      setLoading(false);
      return;
    }

    const [appointmentsResult, patientsResult, doctorsResult] =
      await Promise.all([
        supabase
          .from("appointments")
          .select(`
            id,
            patient_id,
            doctor_id,
            appointment_at,
            status,
            reason,
            patients ( full_name, phone ),
            doctors ( full_name, specialization )
          `)
          .eq("clinic_id", profile.clinic_id)
          .order("appointment_at", { ascending: false }),

        supabase
          .from("patients")
          .select("id, full_name, phone")
          .eq("clinic_id", profile.clinic_id)
          .order("full_name"),

        supabase
          .from("doctors")
          .select("id, full_name, specialization")
          .eq("clinic_id", profile.clinic_id)
          .eq("is_active", true)
          .order("full_name"),
      ]);

    if (appointmentsResult.error) {
      setError(appointmentsResult.error.message);
    } else {
      setAppointments(appointmentsResult.data || []);
    }

    if (patientsResult.error) {
      setError(patientsResult.error.message);
    } else {
      setPatients(patientsResult.data || []);
    }

    if (doctorsResult.error) {
      setError(doctorsResult.error.message);
    } else {
      setDoctors(doctorsResult.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isReadOnly) return;

    setError("");
    setSuccess("");

    if (
      !form.patient_id ||
      !form.doctor_id ||
      !form.appointment_at
    ) {
      setError("Please complete all required fields.");
      return;
    }

    setSaving(true);

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Please log in again.");
      setSaving(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("clinic_id, role")
      .eq("id", authData.user.id)
      .single();

    if (
      profileError ||
      !profile?.clinic_id ||
      !["admin", "receptionist"].includes(profile.role)
    ) {
      setError("You don't have permission to book appointments.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("appointments")
      .insert({
        clinic_id: profile.clinic_id,
        patient_id: form.patient_id,
        doctor_id: form.doctor_id,
        appointment_at: new Date(form.appointment_at).toISOString(),
        reason: form.reason.trim() || null,
        status: "scheduled",
      });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSuccess("Appointment booked successfully.");
    setForm(emptyForm);
    setShowForm(false);

    await loadData();
    setSaving(false);
  }

  async function updateStatus(appointmentId, newStatus) {
    if (isReadOnly) return;

    setError("");
    setSuccess("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Please log in again.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("clinic_id, role")
      .eq("id", authData.user.id)
      .single();

    if (
      profileError ||
      !profile?.clinic_id ||
      !["admin", "receptionist"].includes(profile.role)
    ) {
      setError("You don't have permission to update appointments.");
      return;
    }

    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", appointmentId)
      .eq("clinic_id", profile.clinic_id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setAppointments((current) =>
      current.map((appointment) =>
        appointment.id === appointmentId
          ? { ...appointment, status: newStatus }
          : appointment
      )
    );

    setSuccess("Appointment status updated.");
  }

  const filteredAppointments = appointments.filter((appointment) => {
    const patientName = appointment.patients?.full_name || "";
    const doctorName = appointment.doctors?.full_name || "";

    const matchesSearch =
      patientName.toLowerCase().includes(search.toLowerCase()) ||
      doctorName.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || appointment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  function formatDate(value) {
    if (!value) return "—";

    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatTime(value) {
    if (!value) return "—";

    return new Date(value).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusStyle(status) {
    const styles = {
      scheduled: "bg-[var(--info-soft)] text-[var(--info)]",
      waiting: "bg-[var(--warning-soft)] text-[var(--warning)]",
      no_show: "bg-[var(--surface-hover)] text-[var(--text-secondary)]",
      completed: "bg-[var(--success-soft)] text-[var(--success)]",
      cancelled: "bg-[var(--danger-soft)] text-[var(--danger)]",
    };

    return styles[status] || "bg-[var(--surface-hover)] text-[var(--text-secondary)]";
  }

  function formatStatus(status) {
    if (!status) return "Unknown";

    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  return (
    <div className="space-y-7">
      {/* Page header */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
            Clinic management
          </p>

          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            Appointments
          </h1>

          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {isReadOnly
              ? "Explore the clinic's appointment schedule."
              : "Manage patient appointments and scheduling."}
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={() => {
              setError("");
              setSuccess("");
              setForm(emptyForm);
              setShowForm(!showForm);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-[var(--control-radius)] bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
          >
            <span className="text-lg leading-none">+</span>
            Book appointment
          </button>
        )}
      </div>

      {/* Feedback messages */}
      {error && (
        <div
          role="alert"
          className="rounded-[var(--card-radius)] border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-[var(--card-radius)] border border-[var(--success)]/25 bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success)]"
        >
          {success}
        </div>
      )}

      {/* Setup warning */}
      {!isReadOnly &&
        !loading &&
        (patients.length === 0 || doctors.length === 0) && (
          <div className="rounded-[var(--card-radius)] border border-[var(--warning)]/25 bg-[var(--warning-soft)] p-4 text-sm text-[var(--warning)]">
            You need at least one patient and one active doctor before booking
            an appointment.
          </div>
        )}

      {/* Booking form */}
      {!isReadOnly && showForm && (
        <section className="rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-7">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--primary)]">
              New booking
            </p>

            <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              Book appointment
            </h2>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Select a patient, doctor and appointment time.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Patient <span className="text-[var(--danger)]">*</span>
                </label>

                <select
                  required
                  name="patient_id"
                  value={form.patient_id}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Select patient</option>

                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Doctor <span className="text-[var(--danger)]">*</span>
                </label>

                <select
                  required
                  name="doctor_id"
                  value={form.doctor_id}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Select doctor</option>

                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.full_name}
                      {doctor.specialization
                        ? ` — ${doctor.specialization}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Date and time <span className="text-[var(--danger)]">*</span>
                </label>

                <input
                  required
                  type="datetime-local"
                  name="appointment_at"
                  value={form.appointment_at}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Reason for visit</label>

                <input
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  placeholder="Optional reason"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-5">
              <button
                type="submit"
                disabled={saving || patients.length === 0 || doctors.length === 0}
                className="rounded-[var(--control-radius)] bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Booking..." : "Confirm appointment"}
              </button>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-[var(--control-radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-6 py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Appointment directory */}
      <section className="overflow-hidden rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col justify-between gap-5 border-b border-[var(--border)] p-5 sm:p-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Appointment directory
            </h2>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {filteredAppointments.length} appointments found
            </p>
          </div>

          <div className={`${inputClass} sm:w-64`}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patient or doctor..."
              aria-label="Search patient or doctor"
              className="w-full sm:w-64"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by appointment status"
              className={`${inputClass} sm:w-44`}
            >
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="waiting">Waiting</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              Loading appointments...
            </p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
                <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17M8 13h3M8 16.5h3" />
              </svg>
            </div>

            <h3 className="mt-4 text-sm font-semibold text-[var(--foreground)]">
              No appointments found
            </h3>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {isReadOnly
                ? "There are no appointments to display."
                : "Appointments will appear here once booked."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                  <th className="px-5 py-4">Patient</th>
                  <th className="px-5 py-4">Doctor</th>
                  <th className="px-5 py-4">Date & time</th>
                  <th className="px-5 py-4">Status</th>

                  {!isReadOnly && (
                    <th className="px-5 py-4">Update status</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredAppointments.map((appointment) => (
                  <tr
                    key={appointment.id}
                    className="border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--surface-hover)]"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {appointment.patients?.full_name || "Unknown patient"}
                      </p>

                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {appointment.patients?.phone || "—"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {appointment.doctors?.full_name || "Unknown doctor"}
                      </p>

                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {appointment.doctors?.specialization || "—"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {formatDate(appointment.appointment_at)}
                      </p>

                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {formatTime(appointment.appointment_at)}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${statusStyle(
                          appointment.status
                        )}`}
                      >
                        {formatStatus(appointment.status)}
                      </span>
                    </td>

                    {!isReadOnly && (
                      <td className="px-5 py-4">
                        <select
                          value={appointment.status}
                          onChange={(event) =>
                            updateStatus(
                              appointment.id,
                              event.target.value
                            )
                          }
                          aria-label={`Update status for ${appointment.patients?.full_name || "appointment"}`}
                          className={`${inputClass} min-w-36 px-3 py-2 text-xs`}
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="waiting">Waiting</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="no_show">No-show</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
