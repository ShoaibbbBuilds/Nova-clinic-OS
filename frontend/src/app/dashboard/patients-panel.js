
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
    return (
      <section className="mb-8 rounded-[24px] border border-[#DDE9F7] bg-white p-6 sm:p-8">
        <div className="mb-7">
          <p className="text-xs font-semibold tracking-wider text-blue-600">
            {editing ? "UPDATE INFORMATION" : "NEW REGISTRATION"}
          </p>

          <h3 className="mt-2 text-xl font-bold text-[#16345C]">
            {editing ? "Edit patient details" : "Add a patient"}
          </h3>

          <p className="mt-1 text-sm text-[#7890AC]">
            {editing
              ? "Make changes to the patient's information."
              : "Enter the patient's basic information."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#45617F]">
                Full name *
              </label>
              <input
                required
                name="full_name"
                value={form.full_name}
                onChange={updateField}
                placeholder="Enter full name"
                className="w-full rounded-xl border border-[#DDE9F7] bg-[#F8FBFF] px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#45617F]">
                Phone number
              </label>
              <input
                name="phone"
                value={form.phone}
                onChange={updateField}
                placeholder="Enter phone number"
                className="w-full rounded-xl border border-[#DDE9F7] bg-[#F8FBFF] px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#45617F]">
                Email address
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={updateField}
                placeholder="Enter email address"
                className="w-full rounded-xl border border-[#DDE9F7] bg-[#F8FBFF] px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#45617F]">
                Date of birth
              </label>
              <input
                type="date"
                name="date_of_birth"
                value={form.date_of_birth}
                onChange={updateField}
                className="w-full rounded-xl border border-[#DDE9F7] bg-[#F8FBFF] px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#45617F]">
                Gender
              </label>
              <select
                name="gender"
                value={form.gender}
                onChange={updateField}
                className="w-full rounded-xl border border-[#DDE9F7] bg-[#F8FBFF] px-4 py-3 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#45617F]">
                Address
              </label>
              <input
                name="address"
                value={form.address}
                onChange={updateField}
                placeholder="Enter address"
                className="w-full rounded-xl border border-[#DDE9F7] bg-[#F8FBFF] px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
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
              className="rounded-xl bg-[#F0F7FF] px-6 py-3 text-sm font-semibold text-[#58718F] hover:bg-[#E4EEFA]"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1300px]">
      {/* Header */}
      <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold tracking-wider text-teal-600">
            YOUR CLINIC COMMUNITY
          </p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#16345C]">
            Patients
          </h2>

          <p className="mt-2 text-sm leading-6 text-[#7890AC]">
            Every patient has a story. Keep their information organized here.
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
            className="w-fit rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {showForm ? "Close form" : "+ Add patient"}
          </button>
        )}
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-teal-50 p-4 text-sm font-medium text-teal-700">
          {message}
        </div>
      )}

      {/* Add patient */}
      {!isReadOnly && showForm && !selectedPatient && renderPatientForm()}

      {/* Patient details */}
      {selectedPatient && (
        <div className="mb-8">
          <button
            onClick={closePatient}
            className="mb-6 text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            ← Back to patient directory
          </button>

          {isEditing && !isReadOnly ? (
            renderPatientForm(true)
          ) : (
            <section className="rounded-[24px] border border-[#DDE9F7] bg-white p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#E4EDFF] text-2xl font-bold text-blue-700">
                    {selectedPatient.full_name?.slice(0, 1).toUpperCase() || "P"}
                  </div>

                  <div>
                    <p className="text-xs font-semibold tracking-wider text-teal-600">
                      PATIENT PROFILE
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-[#16345C]">
                      {selectedPatient.full_name}
                    </h3>
                    <p className="mt-1 text-sm text-[#7890AC]">
                      {selectedPatient.patient_code}
                    </p>
                  </div>
                </div>

                {!isReadOnly && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={startEditing}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Edit patient
                    </button>

                    <button
                      onClick={() => {
                        setDeleteTarget(selectedPatient);
                        setError("");
                      }}
                      className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-100"
                    >
                      Delete patient
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  <div key={label} className="rounded-2xl bg-[#F6F9FE] p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#8BA0B8]">
                      {label}
                    </p>
                    <p className="mt-3 break-words text-sm font-semibold capitalize text-[#16345C]">
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
        <section>
          <div className="mb-5">
            <h3 className="text-lg font-bold text-[#16345C]">
              Patient directory
            </h3>
            <p className="mt-1 text-sm text-[#8BA0B8]">
              {patients.length} patients loaded
            </p>
          </div>

          {/* Search and filters */}
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
              placeholder="Search name, code, phone or email..."
              className="rounded-xl border border-[#DDE9F7] bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 lg:col-span-1"
            />

            <select
              value={genderFilter}
              onChange={(e) => {
                setGenderFilter(e.target.value);
                resetPage();
              }}
              className="rounded-xl border border-[#DDE9F7] bg-white px-4 py-3 text-sm text-[#45617F] outline-none focus:border-blue-500"
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
              className="rounded-xl border border-[#DDE9F7] bg-white px-4 py-3 text-sm text-[#45617F] outline-none focus:border-blue-500"
            >
              <option value="all">Any registration date</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="year">This year</option>
            </select>
          </div>

          {/* Results */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[#7890AC]">
              {filteredPatients.length === 0
                ? "No results"
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
                className="text-sm font-semibold text-blue-600 hover:text-blue-800"
              >
                Clear filters
              </button>
            )}
          </div>

          {filteredPatients.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#C9DDF3] bg-white/70 px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600">
                ♙
              </div>

              <h3 className="mt-5 text-lg font-bold text-[#16345C]">
                {patients.length === 0
                  ? "Your patient directory is empty"
                  : "No matching patients"}
              </h3>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8BA0B8]">
                {patients.length === 0
                  ? isReadOnly
                    ? "There are no patients available in this demo clinic."
                    : "Your registered patients will appear here. Start by adding your first patient."
                  : "Try changing your search or filters to find a patient."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-[24px] border border-[#E1ECF8] bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="bg-[#F5F9FF] text-xs tracking-wider text-[#8BA0B8]">
                      <tr>
                        <th className="px-6 py-4">PATIENT</th>
                        <th className="px-6 py-4">PATIENT CODE</th>
                        <th className="px-6 py-4">PHONE</th>
                        <th className="px-6 py-4">REGISTERED</th>
                        <th className="px-6 py-4">ACTION</th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedPatients.map((patient) => (
                        <tr
                          key={patient.id}
                          onClick={() => openPatient(patient)}
                          className="cursor-pointer border-t border-[#EDF2F8] transition hover:bg-[#F1F7FF]"
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E4EDFF] font-semibold text-blue-700">
                                {patient.full_name?.slice(0, 1).toUpperCase() || "P"}
                              </div>

                              <div>
                                <p className="font-semibold text-[#16345C]">
                                  {patient.full_name}
                                </p>
                                <p className="mt-1 text-xs text-[#8BA0B8]">
                                  {patient.email || "No email added"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-5 font-medium text-[#58718F]">
                            {patient.patient_code}
                          </td>

                          <td className="px-6 py-5 text-[#58718F]">
                            {patient.phone || "—"}
                          </td>

                          <td className="px-6 py-5 text-[#8BA0B8]">
                            {patient.created_at
                              ? new Date(patient.created_at).toLocaleDateString("en-IN")
                              : "—"}
                          </td>

                          <td className="px-6 py-5 font-semibold text-blue-600">
                            View →
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination controls */}
              <div className="mt-5 flex flex-col items-center justify-between gap-4 sm:flex-row">
                <p className="text-sm text-[#7890AC]">
                  Page {safePage} of {totalPages}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    disabled={safePage === 1}
                    onClick={() => setCurrentPage(safePage - 1)}
                    className="rounded-xl border border-[#DDE9F7] bg-white px-4 py-2.5 text-sm font-semibold text-[#58718F] transition hover:bg-[#F0F7FF] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Previous
                  </button>

                  <button
                    disabled={safePage === totalPages}
                    onClick={() => setCurrentPage(safePage + 1)}
                    className="rounded-xl border border-[#DDE9F7] bg-white px-4 py-2.5 text-sm font-semibold text-[#58718F] transition hover:bg-[#F0F7FF] disabled:cursor-not-allowed disabled:opacity-40"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102744]/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-[#E1ECF8] bg-white p-7 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl text-red-600">
              !
            </div>

            <h3 className="mt-5 text-xl font-bold text-[#16345C]">
              Delete this patient?
            </h3>

            <p className="mt-3 text-sm leading-6 text-[#7890AC]">
              You are about to permanently delete{" "}
              <span className="font-semibold text-[#16345C]">
                {deleteTarget.full_name}
              </span>{" "}
              from your clinic records. This action cannot be undone.
            </p>

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
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
                className="rounded-xl bg-[#F0F7FF] px-5 py-3 text-sm font-semibold text-[#58718F] hover:bg-[#E4EEFA] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                disabled={deleting}
                onClick={handleDeletePatient}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
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
