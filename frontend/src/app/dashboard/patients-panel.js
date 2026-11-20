
"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const emptyForm = {
  full_name: "",
  phone: "",
  email: "",
  date_of_birth: "",
  gender: "",
  address: "",
};

const patientFields =
  "id, patient_code, full_name, phone, email, date_of_birth, gender, address, created_at";

const PAGE_SIZE = 10;

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--card-radius)",
  boxShadow: "var(--shadow-card)",
};

const inputStyle = {
  background: "var(--surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--foreground)",
  borderRadius: "var(--control-radius)",
};

const mutedStyle = { color: "var(--text-secondary)" };
const subtleStyle = { color: "var(--text-muted)" };

export default function PatientsPanel({
  initialPatients = [],
  isReadOnly = false,
}) {
  const [patients, setPatients] = useState(initialPatients);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = createClient();

  // Search and filters
  const filteredPatients = useMemo(() => {
    const query = search.toLowerCase().trim();
    const now = new Date();

    return patients.filter((patient) => {
      const matchesSearch =
        !query ||
        [
          patient.full_name,
          patient.patient_code,
          patient.phone,
          patient.email,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query)
          );

      const matchesGender =
        genderFilter === "all" ||
        patient.gender === genderFilter;

      let matchesDate = true;

      if (dateFilter !== "all" && patient.created_at) {
        const registeredDate = new Date(patient.created_at);

        if (dateFilter === "30") {
          const cutoff = new Date();
          cutoff.setDate(now.getDate() - 30);
          matchesDate = registeredDate >= cutoff;
        }

        if (dateFilter === "90") {
          const cutoff = new Date();
          cutoff.setDate(now.getDate() - 90);
          matchesDate = registeredDate >= cutoff;
        }

        if (dateFilter === "year") {
          matchesDate =
            registeredDate.getFullYear() === now.getFullYear();
        }
      } else if (dateFilter !== "all") {
        matchesDate = false;
      }

      return matchesSearch && matchesGender && matchesDate;
    });
  }, [patients, search, genderFilter, dateFilter]);

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(filteredPatients.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(
    startIndex + PAGE_SIZE,
    filteredPatients.length
  );

  const paginatedPatients = filteredPatients.slice(
    startIndex,
    endIndex
  );

  function resetPage() {
    setCurrentPage(1);
  }

  function updateField(e) {
    setForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
  }

  function openPatient(patient) {
    setSelectedPatient(patient);
    setIsEditing(false);
    setShowForm(false);
    setError("");
    setMessage("");
  }

  function closePatient() {
    setSelectedPatient(null);
    setIsEditing(false);
    setForm(emptyForm);
    setError("");
    setMessage("");
  }

  function startEditing() {
    if (isReadOnly || !selectedPatient) return;

    setForm({
      full_name: selectedPatient.full_name || "",
      phone: selectedPatient.phone || "",
      email: selectedPatient.email || "",
      date_of_birth: selectedPatient.date_of_birth || "",
      gender: selectedPatient.gender || "",
      address: selectedPatient.address || "",
    });

    setIsEditing(true);
    setError("");
    setMessage("");
  }

  async function getCurrentProfile() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Your session has expired. Please log in again.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, clinic_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Unable to find your clinic profile.");
    }

    if (!["admin", "receptionist"].includes(profile.role)) {
      throw new Error("You do not have permission to manage patients.");
    }

    if (!profile.clinic_id) {
      throw new Error("Your account is not connected to a clinic.");
    }

    return { user, profile };
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isReadOnly) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { user, profile } = await getCurrentProfile();

      const patientData = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        address: form.address.trim() || null,
      };

      if (selectedPatient && isEditing) {
        const { data, error: updateError } = await supabase
          .from("patients")
          .update(patientData)
          .eq("id", selectedPatient.id)
          .eq("clinic_id", profile.clinic_id)
          .select(patientFields)
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        setPatients((current) =>
          current.map((patient) =>
            patient.id === data.id ? data : patient
          )
        );

        setSelectedPatient(data);
        setIsEditing(false);
        setMessage("Patient information updated successfully.");
      } else {
        const patientCode = `PAT-${crypto
          .randomUUID()
          .slice(0, 8)
          .toUpperCase()}`;

        const { data, error: insertError } = await supabase
          .from("patients")
          .insert({
            ...patientData,
            patient_code: patientCode,
            clinic_id: profile.clinic_id,
            created_by: user.id,
          })
          .select(patientFields)
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        setPatients((current) => [data, ...current]);
        setForm(emptyForm);
        setShowForm(false);
        resetPage();
        setMessage("Patient registered successfully.");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePatient() {
    if (isReadOnly || !deleteTarget) return;

    setDeleting(true);
    setError("");

    try {
      const { profile } = await getCurrentProfile();

      const { data: deletedPatient, error: deleteError } = await supabase
        .from("patients")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("clinic_id", profile.clinic_id)
        .select("id")
        .maybeSingle();

      if (deleteError) {
        throw new Error(
          "Unable to delete this patient. They may have linked records. Details: " +
            deleteError.message
        );
      }

      if (!deletedPatient) {
        throw new Error(
          "Patient was not deleted. Check permissions or refresh the page."
        );
      }

      setPatients((current) =>
        current.filter((patient) => patient.id !== deleteTarget.id)
      );

      setSelectedPatient(null);
      setDeleteTarget(null);
      setMessage("Patient deleted successfully.");
    } catch (err) {
      setError(err.message || "Something went wrong while deleting.");
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(value) {
    if (!value) return "Not provided";

    return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function renderPatientForm(editing = false) {
    const fields = [
      {
        label: "Full name",
        name: "full_name",
        placeholder: "Enter full name",
        required: true,
      },
      {
        label: "Phone number",
        name: "phone",
        placeholder: "Enter phone number",
      },
      {
        label: "Email address",
        name: "email",
        placeholder: "Enter email address",
        type: "email",
      },
      {
        label: "Date of birth",
        name: "date_of_birth",
        type: "date",
      },
    ];

    return (
      <section className="mb-8 p-6 sm:p-8" style={cardStyle}>
        <div className="mb-7">
          <p
            className="text-[11px] font-semibold tracking-[0.14em]"
            style={{ color: "var(--primary)" }}
          >
            {editing ? "UPDATE INFORMATION" : "NEW REGISTRATION"}
          </p>

          <h3 className="mt-2 text-xl font-semibold tracking-tight">
            {editing ? "Edit patient details" : "Add a patient"}
          </h3>

          <p className="mt-2 text-sm" style={mutedStyle}>
            {editing
              ? "Update the patient's information below."
              : "Enter the patient's basic information."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.name}>
                <label
                  htmlFor={field.name}
                  className="mb-2 block text-xs font-semibold"
                >
                  {field.label}
                  {field.required ? " *" : ""}
                </label>

                <input
                  id={field.name}
                  required={field.required}
                  type={field.type || "text"}
                  name={field.name}
                  value={form[field.name]}
                  onChange={updateField}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)]"
                  style={inputStyle}
                />
              </div>
            ))}

            <div>
              <label
                htmlFor="gender"
                className="mb-2 block text-xs font-semibold"
              >
                Gender
              </label>

              <select
                id="gender"
                name="gender"
                value={form.gender}
                onChange={updateField}
                className="w-full px-4 py-3 text-sm outline-none"
                style={inputStyle}
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="address"
                className="mb-2 block text-xs font-semibold"
              >
                Address
              </label>

              <input
                id="address"
                name="address"
                value={form.address}
                onChange={updateField}
                placeholder="Enter address"
                className="w-full px-4 py-3 text-sm outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <p
              className="rounded-xl p-4 text-sm"
              style={{
                background: "var(--danger-soft)",
                color: "var(--danger)",
              }}
            >
              {error}
            </p>
          )}

          <div
            className="flex flex-wrap gap-3 border-t pt-5"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {loading
                ? "Saving..."
                : editing
                  ? "Save changes"
                  : "Save patient"}
            </button>

            <button
              type="button"
              onClick={() => {
                if (editing) {
                  setIsEditing(false);
                } else {
                  setShowForm(false);
                }
                setError("");
              }}
              className="rounded-lg px-6 py-3 text-sm font-semibold"
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">

      {/* Page heading */}
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p
            className="text-[11px] font-semibold tracking-[0.14em]"
            style={{ color: "var(--primary)" }}
          >
            CLINIC MANAGEMENT
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[28px]">
            Patients
          </h2>

          <p className="mt-2 max-w-lg text-sm leading-6" style={mutedStyle}>
            Manage patient records, contact information and registrations.
          </p>
        </div>

        {!isReadOnly && !selectedPatient && (
          <button
            onClick={() => {
              setShowForm(!showForm);
              setForm(emptyForm);
              setError("");
              setMessage("");
            }}
            className="w-fit rounded-lg px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            {showForm ? "Close form" : "+ Add patient"}
          </button>
        )}
      </section>

      {/* Feedback messages */}
      {message && (
        <div
          className="rounded-xl px-5 py-4 text-sm font-medium"
          style={{
            background: "var(--success-soft)",
            color: "var(--success)",
            border: "1px solid var(--border)",
          }}
        >
          {message}
        </div>
      )}

      {/* Registration form */}
      {!isReadOnly && showForm && !selectedPatient && renderPatientForm()}

      {/* Patient details */}
      {selectedPatient && (
        <div className="space-y-5">
          <button
            onClick={closePatient}
            className="text-sm font-semibold transition-opacity hover:opacity-70"
            style={{ color: "var(--primary)" }}
          >
            ← Back to patient directory
          </button>

          {isEditing && !isReadOnly ? (
            renderPatientForm(true)
          ) : (
            <section className="p-6 sm:p-8" style={cardStyle}>
              {/* Profile heading */}
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold"
                    style={{
                      background: "var(--primary-soft)",
                      color: "var(--primary)",
                    }}
                  >
                    {selectedPatient.full_name?.slice(0, 1).toUpperCase() || "P"}
                  </div>

                  <div className="min-w-0">
                    <p
                      className="text-[11px] font-semibold tracking-[0.13em]"
                      style={{ color: "var(--primary)" }}
                    >
                      PATIENT PROFILE
                    </p>

                    <h3 className="mt-2 break-words text-xl font-semibold sm:text-2xl">
                      {selectedPatient.full_name}
                    </h3>

                    <p className="mt-1 text-sm" style={mutedStyle}>
                      {selectedPatient.patient_code}
                    </p>
                  </div>
                </div>

                {!isReadOnly && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={startEditing}
                      className="rounded-lg px-5 py-2.5 text-sm font-semibold"
                      style={{
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      Edit patient
                    </button>

                    <button
                      onClick={() => {
                        setDeleteTarget(selectedPatient);
                        setError("");
                      }}
                      className="rounded-lg px-5 py-2.5 text-sm font-semibold"
                      style={{
                        background: "var(--danger-soft)",
                        color: "var(--danger)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      Delete patient
                    </button>
                  </div>
                )}
              </div>

              {/* Patient information */}
              <div
                className="mt-8 grid grid-cols-1 gap-4 border-t pt-7 sm:grid-cols-2 lg:grid-cols-3"
                style={{ borderColor: "var(--border)" }}
              >
                {[
                  ["Phone number", selectedPatient.phone],
                  ["Email address", selectedPatient.email],
                  ["Date of birth", formatDate(selectedPatient.date_of_birth)],
                  ["Gender", selectedPatient.gender?.replaceAll("_", " ")],
                  ["Address", selectedPatient.address],
                  [
                    "Registered on",
                    selectedPatient.created_at
                      ? new Date(selectedPatient.created_at).toLocaleDateString("en-IN")
                      : null,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl p-5"
                    style={{
                      background: "var(--surface-subtle)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={subtleStyle}
                    >
                      {label}
                    </p>

                    <p className="mt-3 break-words text-sm font-medium capitalize">
                      {value || "Not provided"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Patient directory */}
      {!selectedPatient && (
        <section className="space-y-5">

          {/* Directory heading */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">
                Patient directory
              </h3>
              <p className="mt-1 text-xs" style={mutedStyle}>
                Browse and manage registered patients.
              </p>
            </div>

            <span
              className="rounded-lg px-3 py-2 text-xs font-medium"
              style={{
                background: "var(--surface-subtle)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              {patients.length} total patients
            </span>
          </div>

          {/* Search and filters */}
          <div
            className="grid grid-cols-1 gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5"
            style={cardStyle}
          >
            <div className="relative">
              <span
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base"
                style={subtleStyle}
              >
                ⌕
              </span>

              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
                placeholder="Search patients..."
                className="w-full py-3 pl-10 pr-4 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <select
              value={genderFilter}
              onChange={(e) => {
                setGenderFilter(e.target.value);
                resetPage();
              }}
              className="w-full px-4 py-3 text-sm outline-none"
              style={inputStyle}
            >
              <option value="all">All genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                resetPage();
              }}
              className="w-full px-4 py-3 text-sm outline-none"
              style={inputStyle}
            >
              <option value="all">Any registration date</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="year">This year</option>
            </select>
          </div>

          {/* Result information */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs" style={mutedStyle}>
              {filteredPatients.length === 0
                ? "No results found"
                : `Showing ${startIndex + 1}–${endIndex} of ${filteredPatients.length} patients`}
            </p>

            {(search || genderFilter !== "all" || dateFilter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setGenderFilter("all");
                  setDateFilter("all");
                  resetPage();
                }}
                className="text-xs font-semibold"
                style={{ color: "var(--primary)" }}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Empty state */}
          {filteredPatients.length === 0 ? (
            <div
              className="rounded-2xl px-6 py-16 text-center"
              style={{
                ...cardStyle,
                borderStyle: "dashed",
                boxShadow: "none",
              }}
            >
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
                style={{
                  background: "var(--primary-soft)",
                  color: "var(--primary)",
                }}
              >
                ♙
              </div>

              <h3 className="mt-5 text-lg font-semibold">
                {patients.length === 0
                  ? "Your patient directory is empty"
                  : "No matching patients"}
              </h3>

              <p
                className="mx-auto mt-2 max-w-sm text-sm leading-6"
                style={mutedStyle}
              >
                {patients.length === 0
                  ? isReadOnly
                    ? "There are no patients available in this demo clinic."
                    : "Your registered patients will appear here. Start by adding your first patient."
                  : "Try changing your search or filters to find a patient."}
              </p>
            </div>
          ) : (
            <>
              {/* Patient table */}
              <div className="overflow-hidden" style={cardStyle}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead>
                      <tr
                        style={{
                          background: "var(--surface-subtle)",
                          color: "var(--text-muted)",
                        }}
                      >
                        <th className="px-6 py-4 text-[10px] font-semibold tracking-[0.12em]">
                          PATIENT
                        </th>
                        <th className="px-6 py-4 text-[10px] font-semibold tracking-[0.12em]">
                          PATIENT CODE
                        </th>
                        <th className="px-6 py-4 text-[10px] font-semibold tracking-[0.12em]">
                          PHONE
                        </th>
                        <th className="px-6 py-4 text-[10px] font-semibold tracking-[0.12em]">
                          REGISTERED
                        </th>
                        <th className="px-6 py-4 text-[10px] font-semibold tracking-[0.12em]">
                          ACTION
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedPatients.map((patient) => (
                        <tr
                          key={patient.id}
                          onClick={() => openPatient(patient)}
                          className="cursor-pointer transition-colors hover:bg-[var(--surface-subtle)]"
                          style={{
                            borderTop: "1px solid var(--border)",
                          }}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
                                style={{
                                  background: "var(--primary-soft)",
                                  color: "var(--primary)",
                                }}
                              >
                                {patient.full_name?.slice(0, 1).toUpperCase() || "P"}
                              </div>

                              <div className="min-w-0">
                                <p className="font-semibold">
                                  {patient.full_name}
                                </p>
                                <p
                                  className="mt-1 max-w-[180px] truncate text-xs"
                                  style={subtleStyle}
                                >
                                  {patient.email || "No email added"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td
                            className="px-6 py-5 text-xs font-medium"
                            style={mutedStyle}
                          >
                            {patient.patient_code}
                          </td>

                          <td
                            className="px-6 py-5 text-xs"
                            style={mutedStyle}
                          >
                            {patient.phone || "—"}
                          </td>

                          <td
                            className="px-6 py-5 text-xs"
                            style={mutedStyle}
                          >
                            {patient.created_at
                              ? new Date(patient.created_at).toLocaleDateString("en-IN")
                              : "—"}
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className="text-xs font-semibold"
                              style={{ color: "var(--primary)" }}
                            >
                              View profile →
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <p className="text-xs" style={mutedStyle}>
                  Page {safePage} of {totalPages}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    disabled={safePage === 1}
                    onClick={() => setCurrentPage(safePage - 1)}
                    className="rounded-lg px-4 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    ← Previous
                  </button>

                  <button
                    disabled={safePage === totalPages}
                    onClick={() => setCurrentPage(safePage + 1)}
                    className="rounded-lg px-4 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* Delete confirmation */}
      {!isReadOnly && deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.65)" }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-7"
            style={{
              ...cardStyle,
              boxShadow: "var(--shadow-modal)",
            }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-semibold"
              style={{
                background: "var(--danger-soft)",
                color: "var(--danger)",
              }}
            >
              !
            </div>

            <h3 className="mt-5 text-xl font-semibold">
              Delete this patient?
            </h3>

            <p className="mt-3 text-sm leading-6" style={mutedStyle}>
              You are about to permanently delete{" "}
              <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                {deleteTarget.full_name}
              </span>{" "}
              from your clinic records. This action cannot be undone.
            </p>

            {error && (
              <p
                className="mt-4 rounded-xl p-4 text-sm"
                style={{
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                }}
              >
                {error}
              </p>
            )}

            <div className="mt-7 flex flex-wrap justify-end gap-3">
              <button
                disabled={deleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setError("");
                }}
                className="rounded-lg px-5 py-3 text-sm font-semibold disabled:opacity-50"
                style={{
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                Cancel
              </button>

              <button
                disabled={deleting}
                onClick={handleDeletePatient}
                className="rounded-lg px-5 py-3 text-sm font-semibold disabled:opacity-50"
                style={{
                  background: "var(--danger)",
                  color: "#FFFFFF",
                }}
              >
                {deleting ? "Deleting..." : "Yes, delete patient"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
