
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

export default function PatientsPanel({ initialPatients = [] }) {
  const [patients, setPatients] = useState(initialPatients);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = createClient();

  const filteredPatients = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return patients;

    return patients.filter((patient) =>
      [
        patient.full_name,
        patient.patient_code,
        patient.phone,
        patient.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [patients, search]);

  function updateField(e) {
    setForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      // 1. Get the currently authenticated user.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Your session has expired. Please log in again.");
      }

      // 2. Get this user's clinic profile.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, clinic_id, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        throw new Error(
          profileError?.message || "Unable to find your clinic profile."
        );
      }

      // 3. Verify the user's role.
      if (!["admin", "receptionist"].includes(profile.role)) {
        throw new Error(
          "Your account does not have permission to register patients."
        );
      }

      if (!profile.clinic_id) {
        throw new Error("Your account is not connected to a clinic.");
      }

      // 4. Generate a patient code.
      const patientCode = `PAT-${crypto
        .randomUUID()
        .slice(0, 8)
        .toUpperCase()}`;

      // 5. Insert the patient using the authenticated user's clinic.
      const { data, error: insertError } = await supabase
        .from("patients")
        .insert({
          patient_code: patientCode,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          address: form.address.trim() || null,
          clinic_id: profile.clinic_id,
          created_by: user.id,
        })
        .select(
          "id, patient_code, full_name, phone, email, date_of_birth, gender, address, created_at"
        )
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      // 6. Update the interface.
      setPatients((current) => [data, ...current]);
      setForm(emptyForm);
      setShowForm(false);
      setMessage("Patient registered successfully.");
    } catch (err) {
      setError(err.message || "Something went wrong while saving the patient.");
    } finally {
      setLoading(false);
    }
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

        <button
          onClick={() => {
            setShowForm(!showForm);
            setError("");
            setMessage("");
          }}
          className="w-fit rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          {showForm ? "Close form" : "+ Add patient"}
        </button>
      </div>

      {/* Success message */}
      {message && (
        <div className="mb-6 rounded-xl bg-teal-50 p-4 text-sm font-medium text-teal-700">
          {message}
        </div>
      )}

      {/* Registration form */}
      {showForm && (
        <section className="mb-8 rounded-[24px] border border-[#DDE9F7] bg-white p-6 sm:p-8">

          <div className="mb-7">
            <p className="text-xs font-semibold tracking-wider text-blue-600">
              NEW REGISTRATION
            </p>

            <h3 className="mt-2 text-xl font-bold text-[#16345C]">
              Add a patient
            </h3>

            <p className="mt-1 text-sm text-[#7890AC]">
              Enter the patient's basic information.
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
                  className="w-full rounded-xl border border-[#DDE9F7] bg-[#F8FBFF] px-4 py-3 text-sm outline-none transition focus:border-blue-500"
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
                  className="w-full rounded-xl border border-[#DDE9F7] bg-[#F8FBFF] px-4 py-3 text-sm outline-none transition focus:border-blue-500"
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
                  className="w-full rounded-xl border border-[#DDE9F7] bg-[#F8FBFF] px-4 py-3 text-sm outline-none transition focus:border-blue-500"
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
                  <option value="prefer_not_to_say">
                    Prefer not to say
                  </option>
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
                {loading ? "Saving patient..." : "Save patient"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
                className="rounded-xl bg-[#F0F7FF] px-6 py-3 text-sm font-semibold text-[#58718F] hover:bg-[#E4EEFA]"
              >
                Cancel
              </button>

            </div>
          </form>
        </section>
      )}

      {/* Patient directory */}
      <section>

        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

          <div>
            <h3 className="text-lg font-bold text-[#16345C]">
              Patient directory
            </h3>

            <p className="mt-1 text-sm text-[#8BA0B8]">
              {patients.length} registered patients loaded
            </p>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code or phone..."
            className="w-full rounded-xl border border-[#DDE9F7] bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 sm:max-w-sm"
          />

        </div>

        {filteredPatients.length === 0 ? (

          <div className="rounded-[24px] border border-dashed border-[#C9DDF3] bg-white/70 px-6 py-16 text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600">
              ♙
            </div>

            <h3 className="mt-5 text-lg font-bold text-[#16345C]">
              {search
                ? "No matching patients"
                : "Your patient directory is empty"}
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8BA0B8]">
              {search
                ? "Try searching with another name, patient code or phone number."
                : "Your registered patients will appear here. Start by adding your first patient."}
            </p>

          </div>

        ) : (

          <div className="overflow-hidden rounded-[24px] border border-[#E1ECF8] bg-white">

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">

                <thead className="bg-[#F5F9FF] text-xs tracking-wider text-[#8BA0B8]">
                  <tr>
                    <th className="px-6 py-4">PATIENT</th>
                    <th className="px-6 py-4">PATIENT CODE</th>
                    <th className="px-6 py-4">PHONE</th>
                    <th className="px-6 py-4">REGISTERED</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr
                      key={patient.id}
                      className="border-t border-[#EDF2F8] transition hover:bg-[#F8FBFF]"
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
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          </div>
        )}

      </section>
    </div>
  );
}
