
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const emptyForm = {
  patient_id: "",
  doctor_id: "",
  date: "",
  time: "",
  reason: "",
};

const statuses = [
  "scheduled",
  "waiting",
  "completed",
  "cancelled",
  "no_show",
];

const statusLabels = {
  scheduled: "Scheduled",
  waiting: "Waiting",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

const statusStyles = {
  scheduled: "bg-blue-50 text-blue-700",
  waiting: "bg-amber-50 text-amber-700",
  completed: "bg-teal-50 text-teal-700",
  cancelled: "bg-red-50 text-red-700",
  no_show: "bg-purple-50 text-purple-700",
};

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AppointmentsPanel() {
  const supabase = useMemo(() => createClient(), []);

  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const [clinicId, setClinicId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadAppointments() {
    setLoading(true);
    setError("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Your session has expired. Please log in again.");
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

    setClinicId(profile.clinic_id);

    const [patientsResult, doctorsResult, appointmentsResult] =
      await Promise.all([
        supabase
          .from("patients")
          .select("id, patient_code, full_name, phone")
          .order("full_name"),

        supabase
          .from("doctors")
          .select("id, full_name, specialization, is_active")
          .eq("clinic_id", profile.clinic_id)
          .eq("is_active", true)
          .order("full_name"),

        supabase
          .from("appointments")
          .select("id, clinic_id, patient_id, doctor_id, appointment_at, status, reason")
          .eq("clinic_id", profile.clinic_id)
          .order("appointment_at", { ascending: false }),
      ]);

    const queryError =
      patientsResult.error ||
      doctorsResult.error ||
      appointmentsResult.error;

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setPatients(patientsResult.data || []);
    setDoctors(doctorsResult.data || []);
    setAppointments(appointmentsResult.data || []);

    setLoading(false);
  }

  useEffect(() => {
    loadAppointments();
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

    setError("");
    setSuccess("");

    if (
      !form.patient_id ||
      !form.doctor_id ||
      !form.date ||
      !form.time
    ) {
      setError("Please complete all required appointment details.");
      return;
    }

    if (!clinicId) {
      setError("Clinic information is unavailable. Refresh and try again.");
      return;
    }

    const selectedDoctor = doctors.find(
      (doctor) => doctor.id === form.doctor_id
    );

    if (!selectedDoctor) {
      setError("Please select an active doctor.");
      return;
    }

    const selectedPatient = patients.find(
      (patient) => patient.id === form.patient_id
    );

    if (!selectedPatient) {
      setError("Please select a valid patient.");
      return;
    }

    const appointmentDate = new Date(
      `${form.date}T${form.time}`
    );

    if (Number.isNaN(appointmentDate.getTime())) {
      setError("Please enter a valid appointment date and time.");
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
      !profile ||
      profile.clinic_id !== clinicId ||
      !["admin", "receptionist"].includes(profile.role)
    ) {
      setError("You don't have permission to create appointments.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("appointments")
      .insert({
        clinic_id: profile.clinic_id,
        patient_id: form.patient_id,
        doctor_id: form.doctor_id,
        appointment_at: appointmentDate.toISOString(),
        reason: form.reason.trim() || null,
        status: "scheduled",
      });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    setSuccess("Appointment created successfully.");

    await loadAppointments();
    setSaving(false);
  }

  async function updateStatus(appointmentId, newStatus) {
    setError("");
    setSuccess("");

    if (!clinicId) return;

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
      !profile ||
      profile.clinic_id !== clinicId ||
      !["admin", "receptionist"].includes(profile.role)
    ) {
      setError("You don't have permission to update appointments.");
      return;
    }

    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId);

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
    const patient = patients.find(
      (item) => item.id === appointment.patient_id
    );

    const doctor = doctors.find(
      (item) => item.id === appointment.doctor_id
    );

    const query = search.toLowerCase();

    const matchesSearch =
      patient?.full_name?.toLowerCase().includes(query) ||
      patient?.patient_code?.toLowerCase().includes(query) ||
      patient?.phone?.toLowerCase().includes(query) ||
      doctor?.full_name?.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "all" || appointment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const scheduledCount = appointments.filter(
    (item) => item.status === "scheduled"
  ).length;

  const completedCount = appointments.filter(
    (item) => item.status === "completed"
  ).length;

  const waitingCount = appointments.filter(
    (item) => item.status === "waiting"
  ).length;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-blue-600">
            Clinic scheduling
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Appointments
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Schedule and manage your clinic visits.
          </p>
        </div>

        <button
          onClick={() => {
            setError("");
            setSuccess("");
            setForm(emptyForm);
            setShowForm(true);
          }}
          disabled={patients.length === 0 || doctors.length === 0}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Book appointment
        </button>
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

      {/* Missing setup warning */}
      {!loading && (patients.length === 0 || doctors.length === 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-900">
            Booking needs a little setup
          </h3>

          <p className="mt-2 text-sm leading-6 text-amber-800">
            {patients.length === 0 && doctors.length === 0
              ? "Register at least one patient and one active doctor before booking."
              : patients.length === 0
                ? "Register a patient before booking an appointment."
                : "Add or activate a doctor before booking an appointment."}
          </p>
        </div>
      )}

      {/* Statistics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
          <p className="text-sm text-blue-700">Scheduled</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {scheduledCount}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
          <p className="text-sm text-amber-700">Waiting</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {waitingCount}
          </p>
        </div>

        <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5">
          <p className="text-sm text-teal-700">Completed</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {completedCount}
          </p>
        </div>
      </div>

      {/* Booking form */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                New appointment
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Select a patient, doctor and appointment time.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              Close
            </button>
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select patient</option>

                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name}
                      {patient.patient_code
                        ? ` — ${patient.patient_code}`
                        : ""}
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  Appointment date *
                </label>

                <input
                  required
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Appointment time *
                </label>

                <input
                  required
                  type="time"
                  name="time"
                  value={form.time}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Reason for visit
                </label>

                <textarea
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Briefly describe the reason for the appointment..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              <button
                type="submit"
                disabled={saving}
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
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All statuses</option>

              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
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
              Your scheduled appointments will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-4 font-medium">Patient</th>
                  <th className="px-3 py-4 font-medium">Doctor</th>
                  <th className="px-3 py-4 font-medium">Date & time</th>
                  <th className="px-3 py-4 font-medium">Reason</th>
                  <th className="px-3 py-4 font-medium">Status</th>
                  <th className="px-3 py-4 font-medium">Update status</th>
                </tr>
              </thead>

              <tbody>
                {filteredAppointments.map((appointment) => {
                  const patient = patients.find(
                    (item) => item.id === appointment.patient_id
                  );

                  const doctor = doctors.find(
                    (item) => item.id === appointment.doctor_id
                  );

                  return (
                    <tr
                      key={appointment.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-3 py-4">
                        <p className="font-medium text-slate-800">
                          {patient?.full_name || "Patient unavailable"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {patient?.patient_code || patient?.phone || ""}
                        </p>
                      </td>

                      <td className="px-3 py-4">
                        <p className="text-sm font-medium text-slate-800">
                          {doctor?.full_name || "Doctor unavailable"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {doctor?.specialization || ""}
                        </p>
                      </td>

                      <td className="px-3 py-4">
                        <p className="text-sm font-medium text-slate-800">
                          {formatDate(appointment.appointment_at)}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatTime(appointment.appointment_at)}
                        </p>
                      </td>

                      <td className="max-w-[180px] px-3 py-4 text-sm text-slate-600">
                        <span className="line-clamp-2">
                          {appointment.reason || "—"}
                        </span>
                      </td>

                      <td className="px-3 py-4">
                        <span
                          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                            statusStyles[appointment.status] ||
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {statusLabels[appointment.status] ||
                            appointment.status}
                        </span>
                      </td>

                      <td className="px-3 py-4">
                        <select
                          value={appointment.status}
                          onChange={(event) =>
                            updateStatus(
                              appointment.id,
                              event.target.value
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none focus:border-blue-500"
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}   
