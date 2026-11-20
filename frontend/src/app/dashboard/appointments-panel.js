
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const emptyForm = {
  patient_id: "",
  doctor_id: "",
  appointment_at: "",
  reason: "",
};

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
      scheduled: "bg-blue-50 text-blue-700",
      waiting: "bg-teal-50 text-teal-700",
      no_show: "bg-amber-50 text-amber-700",
      completed: "bg-green-50 text-green-700",
      cancelled: "bg-red-50 text-red-700",
    };

    return styles[status] || "bg-slate-100 text-slate-600";
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-blue-600">
            Clinic management
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Appointments
          </h1>

          <p className="mt-2 text-sm text-slate-500">
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
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            + Book appointment
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
          {success}
        </div>
      )}

      {/* Setup warning */}
      {!isReadOnly &&
        !loading &&
        (patients.length === 0 || doctors.length === 0) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            You need at least one patient and one active doctor before booking
            an appointment.
          </div>
        )}

      {/* Booking form */}
      {!isReadOnly && showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Book appointment
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Select a patient, doctor and appointment time.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Patient *
                </label>

                <select
                  required
                  name="patient_id"
                  value={form.patient_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
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
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Doctor *
                </label>

                <select
                  required
                  name="doctor_id"
                  value={form.doctor_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
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
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Date and time *
                </label>

                <input
                  required
                  type="datetime-local"
                  name="appointment_at"
                  value={form.appointment_at}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Reason for visit
                </label>

                <input
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  placeholder="Optional reason"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              <button
                type="submit"
                disabled={saving || patients.length === 0 || doctors.length === 0}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Booking..." : "Confirm appointment"}
              </button>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Appointment directory */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Appointment directory
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {filteredAppointments.length} appointments found
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patient or doctor..."
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 sm:w-64"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
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
          <div className="py-12 text-center text-sm text-slate-500">
            Loading appointments...
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-5 py-12 text-center">
            <div className="text-3xl">📅</div>

            <h3 className="mt-3 font-semibold text-slate-800">
              No appointments found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {isReadOnly
                ? "There are no appointments to display."
                : "Appointments will appear here once booked."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-4 font-medium">Patient</th>
                  <th className="px-3 py-4 font-medium">Doctor</th>
                  <th className="px-3 py-4 font-medium">Date & time</th>
                  <th className="px-3 py-4 font-medium">Status</th>

                  {!isReadOnly && (
                    <th className="px-3 py-4 font-medium">Update status</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredAppointments.map((appointment) => (
                  <tr
                    key={appointment.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-3 py-4">
                      <p className="font-medium text-slate-800">
                        {appointment.patients?.full_name || "Unknown patient"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {appointment.patients?.phone || "—"}
                      </p>
                    </td>

                    <td className="px-3 py-4">
                      <p className="font-medium text-slate-800">
                        {appointment.doctors?.full_name || "Unknown doctor"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {appointment.doctors?.specialization || "—"}
                      </p>
                    </td>

                    <td className="px-3 py-4">
                      <p className="text-sm font-medium text-slate-700">
                        {formatDate(appointment.appointment_at)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {formatTime(appointment.appointment_at)}
                      </p>
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle(
                          appointment.status
                        )}`}
                      >
                        {appointment.status}
                      </span>
                    </td>

                    {!isReadOnly && (
                      <td className="px-3 py-4">
                        <select
                          value={appointment.status}
                          onChange={(event) =>
                            updateStatus(
                              appointment.id,
                              event.target.value
                            )
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
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
      </div>
    </div>
  );
}
