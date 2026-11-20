
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const emptyForm = {
  full_name: "",
  specialization: "",
  phone: "",
  email: "",
  consultation_fee: "",
};

const inputClass =
  "w-full rounded-[var(--control-radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";

const labelClass =
  "mb-2 block text-sm font-medium text-[var(--foreground)]";

export default function DoctorsPanel({ isReadOnly = false }) {
  const supabase = useMemo(() => createClient(), []);

  const [doctors, setDoctors] = useState([]);
  const [clinicId, setClinicId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadDoctors() {
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

    setClinicId(profile.clinic_id);

    const { data, error: doctorsError } = await supabase
      .from("doctors")
      .select(
        "id, clinic_id, profile_id, full_name, specialization, phone, email, consultation_fee, is_active"
      )
      .eq("clinic_id", profile.clinic_id)
      .order("full_name", { ascending: true });

    if (doctorsError) {
      setError(doctorsError.message);
    } else {
      setDoctors(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDoctors();
  }, []);

  function openAddForm() {
    if (isReadOnly) return;

    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(doctor) {
    if (isReadOnly) return;

    setEditingId(doctor.id);
    setForm({
      full_name: doctor.full_name || "",
      specialization: doctor.specialization || "",
      phone: doctor.phone || "",
      email: doctor.email || "",
      consultation_fee: doctor.consultation_fee ?? "",
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

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

    if (!form.full_name.trim()) {
      setError("Doctor name is required.");
      return;
    }

    const fee =
      form.consultation_fee === ""
        ? null
        : Number(form.consultation_fee);

    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) {
      setError("Enter a valid consultation fee.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Your session has expired. Please log in again.");
      setSaving(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("clinic_id, role")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile?.clinic_id) {
      setError("Unable to verify your clinic.");
      setSaving(false);
      return;
    }

    if (profile.role !== "admin") {
      setError("Only clinic admins can manage doctors.");
      setSaving(false);
      return;
    }

    const doctorData = {
      clinic_id: profile.clinic_id,
      full_name: form.full_name.trim(),
      specialization: form.specialization.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      consultation_fee: fee,
    };

    let result;

    if (editingId) {
      result = await supabase
        .from("doctors")
        .update(doctorData)
        .eq("id", editingId)
        .eq("clinic_id", profile.clinic_id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("doctors")
        .insert(doctorData)
        .select()
        .single();
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSuccess(
      editingId
        ? "Doctor updated successfully."
        : "Doctor added successfully."
    );

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);

    await loadDoctors();
    setSaving(false);
  }

  async function toggleStatus(doctor) {
    if (isReadOnly) return;

    setError("");
    setSuccess("");

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      setError("Please log in again.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id, role")
      .eq("id", authData.user.id)
      .single();

    if (profile?.role !== "admin" || profile.clinic_id !== clinicId) {
      setError("You don't have permission to change this doctor.");
      return;
    }

    const { error: updateError } = await supabase
      .from("doctors")
      .update({ is_active: !doctor.is_active })
      .eq("id", doctor.id)
      .eq("clinic_id", clinicId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDoctors((current) =>
      current.map((item) =>
        item.id === doctor.id
          ? { ...item, is_active: !doctor.is_active }
          : item
      )
    );

    setSuccess("Doctor status updated.");
  }

  async function deleteDoctor(doctor) {
    if (isReadOnly) return;

    const confirmed = window.confirm(
      `Delete Dr. ${doctor.full_name}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      setError("Please log in again.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id, role")
      .eq("id", authData.user.id)
      .single();

    if (profile?.role !== "admin" || profile.clinic_id !== clinicId) {
      setError("You don't have permission to delete this doctor.");
      return;
    }

    const { error: deleteError } = await supabase
      .from("doctors")
      .delete()
      .eq("id", doctor.id)
      .eq("clinic_id", clinicId);

    if (deleteError) {
      setError(
        "Could not delete this doctor. They may have existing appointments. Try marking them inactive instead."
      );
      return;
    }

    setDoctors((current) =>
      current.filter((item) => item.id !== doctor.id)
    );

    setSuccess("Doctor deleted successfully.");
  }

  const filteredDoctors = doctors.filter((doctor) => {
    const query = search.toLowerCase();

    return (
      doctor.full_name?.toLowerCase().includes(query) ||
      doctor.specialization?.toLowerCase().includes(query) ||
      doctor.phone?.toLowerCase().includes(query) ||
      doctor.email?.toLowerCase().includes(query)
    );
  });

  const activeCount = doctors.filter((doctor) => doctor.is_active).length;

  return (
    <div className="space-y-7">
      {/* Page header */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
            Clinic management
          </p>

          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            Doctors
          </h1>

          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {isReadOnly
              ? "Explore the doctors in this clinic."
              : "Manage your clinic's doctors and their professional details."}
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={openAddForm}
            className="inline-flex items-center justify-center gap-2 rounded-[var(--control-radius)] bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
          >
            <span className="text-lg leading-none">+</span>
            Add doctor
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

      {/* Overview statistics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Total doctors
            </p>

            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                <path d="M4 21v-1.5A5.5 5.5 0 0 1 9.5 14h5a5.5 5.5 0 0 1 5.5 5.5V21" />
                <path d="M19 8v6M16 11h6" />
              </svg>
            </span>
          </div>

          <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            {doctors.length}
          </p>

          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Registered with this clinic
          </p>
        </div>

        <div className="rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Active doctors
            </p>

            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--success-soft)] text-[var(--success)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="m5 12 4 4L19 6" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </span>
          </div>

          <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            {activeCount}
          </p>

          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Currently available
          </p>
        </div>
      </div>

      {/* Doctor form */}
      {!isReadOnly && showForm && (
        <section className="rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--primary)]">
                Doctor details
              </p>

              <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {editingId ? "Edit doctor" : "Register a doctor"}
              </h2>

              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Add the doctor's professional information.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-[var(--control-radius)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Full name <span className="text-[var(--danger)]">*</span>
                </label>

                <input
                  required
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  placeholder="e.g. Dr. Ayesha Khan"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Specialization</label>

                <input
                  name="specialization"
                  value={form.specialization}
                  onChange={handleChange}
                  placeholder="e.g. Cardiologist"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Phone number</label>

                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Email address</label>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="doctor@example.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Consultation fee (₹)
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="consultation_fee"
                  value={form.consultation_fee}
                  onChange={handleChange}
                  placeholder="500"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-5">
              <button
                type="submit"
                disabled={saving}
                className="rounded-[var(--control-radius)] bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Register doctor"}
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

      {/* Doctor directory */}
      <section className="overflow-hidden rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col justify-between gap-5 border-b border-[var(--border)] p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Doctor directory
            </h2>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {filteredDoctors.length} doctors found
            </p>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search doctors..."
            aria-label="Search doctors"
            className={`${inputClass} sm:max-w-xs`}
          />
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-[var(--text-secondary)]">
            Loading doctors...
          </div>
        ) : filteredDoctors.length === 0 ? (
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
                <path d="M8 4v4a4 4 0 0 0 8 0V4" />
                <path d="M6 4h4M14 4h4M12 12v3" />
                <path d="M7 21v-1a5 5 0 0 1 10 0v1" />
                <path d="M12 15v-3" />
              </svg>
            </div>

            <h3 className="mt-4 text-sm font-semibold text-[var(--foreground)]">
              No doctors found
            </h3>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {isReadOnly
                ? "No doctors are currently available."
                : "Add your first doctor to get started."}
            </p>

            {!isReadOnly && !search && (
              <button
                onClick={openAddForm}
                className="mt-4 text-sm font-semibold text-[var(--primary)] transition hover:opacity-80"
              >
                + Register a doctor
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                  <th className="px-5 py-4">Doctor</th>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Fee</th>
                  <th className="px-5 py-4">Status</th>

                  {!isReadOnly && (
                    <th className="px-5 py-4 text-right">Actions</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredDoctors.map((doctor) => (
                  <tr
                    key={doctor.id}
                    className="border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--surface-hover)]"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {doctor.full_name}
                      </p>

                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {doctor.specialization || "Specialization not added"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm text-[var(--foreground)]">
                        {doctor.phone || "—"}
                      </p>

                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {doctor.email || "—"}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm font-medium text-[var(--foreground)]">
                      {doctor.consultation_fee == null
                        ? "—"
                        : `₹${Number(doctor.consultation_fee).toLocaleString("en-IN")}`}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${doctor.is_active
                            ? "bg-[var(--success-soft)] text-[var(--success)]"
                            : "bg-[var(--warning-soft)] text-[var(--warning)]"
                          }`}
                      >
                        {doctor.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {!isReadOnly && (
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-3 text-sm">
                          <button
                            onClick={() => openEditForm(doctor)}
                            className="font-medium text-[var(--primary)] transition hover:opacity-75"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => toggleStatus(doctor)}
                            className="font-medium text-[var(--warning)] transition hover:opacity-75"
                          >
                            {doctor.is_active ? "Deactivate" : "Activate"}
                          </button>

                          <button
                            onClick={() => deleteDoctor(doctor)}
                            className="font-medium text-[var(--danger)] transition hover:opacity-75"
                          >
                            Delete
                          </button>
                        </div>
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
