
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
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-blue-600">
            Clinic management
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Doctors
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {isReadOnly
              ? "Explore the doctors in this clinic."
              : "Manage your clinic's doctors and their professional details."}
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={openAddForm}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            + Add doctor
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

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
          <p className="text-sm text-blue-700">Total doctors</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {doctors.length}
          </p>
        </div>

        <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5">
          <p className="text-sm text-teal-700">Active doctors</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {activeCount}
          </p>
        </div>
      </div>

      {/* Form */}
      {!isReadOnly && showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {editingId ? "Edit doctor" : "Register a doctor"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Add the doctor's professional information.
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
                  Full name *
                </label>

                <input
                  required
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  placeholder="e.g. Dr. Ayesha Khan"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Specialization
                </label>

                <input
                  name="specialization"
                  value={form.specialization}
                  onChange={handleChange}
                  placeholder="e.g. Cardiologist"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Phone number
                </label>

                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email address
                </label>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="doctor@example.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
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
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
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
                className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Directory */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Doctor directory
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {filteredDoctors.length} doctors found
            </p>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search doctors..."
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 sm:max-w-xs"
          />
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Loading doctors...
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-5 py-12 text-center">
            <div className="text-3xl">🩺</div>

            <h3 className="mt-3 font-semibold text-slate-800">
              No doctors found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {isReadOnly
                ? "No doctors are currently available."
                : "Add your first doctor to get started."}
            </p>

            {!isReadOnly && !search && (
              <button
                onClick={openAddForm}
                className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                + Register a doctor
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-4 font-medium">Doctor</th>
                  <th className="px-3 py-4 font-medium">Contact</th>
                  <th className="px-3 py-4 font-medium">Fee</th>
                  <th className="px-3 py-4 font-medium">Status</th>

                  {!isReadOnly && (
                    <th className="px-3 py-4 text-right font-medium">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredDoctors.map((doctor) => (
                  <tr
                    key={doctor.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-3 py-4">
                      <p className="font-medium text-slate-800">
                        {doctor.full_name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {doctor.specialization || "Specialization not added"}
                      </p>
                    </td>

                    <td className="px-3 py-4">
                      <p className="text-sm text-slate-700">
                        {doctor.phone || "—"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {doctor.email || "—"}
                      </p>
                    </td>

                    <td className="px-3 py-4 text-sm font-medium text-slate-700">
                      {doctor.consultation_fee == null
                        ? "—"
                        : `₹${Number(doctor.consultation_fee).toLocaleString("en-IN")}`}
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          doctor.is_active
                            ? "bg-teal-50 text-teal-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {doctor.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {!isReadOnly && (
                      <td className="px-3 py-4">
                        <div className="flex justify-end gap-3 text-sm">
                          <button
                            onClick={() => openEditForm(doctor)}
                            className="font-medium text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => toggleStatus(doctor)}
                            className="font-medium text-amber-600 hover:text-amber-800"
                          >
                            {doctor.is_active ? "Deactivate" : "Activate"}
                          </button>

                          <button
                            onClick={() => deleteDoctor(doctor)}
                            className="font-medium text-red-500 hover:text-red-700"
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
      </div>
    </div>
  );
}
