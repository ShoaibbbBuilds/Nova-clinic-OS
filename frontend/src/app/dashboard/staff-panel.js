
"use client";

import { useEffect, useState } from "react";

export default function StaffPanel() {
  const [staff, setStaff] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "receptionist",
    doctorId: "",
  });

  async function loadStaff() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/staff");
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setStaff(data.staff);
      setDoctors(data.availableDoctors);
    } catch (err) {
      setError(err.message || "Unable to load staff.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  async function inviteStaff(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setMessage(data.message);
      setForm({
        fullName: "",
        email: "",
        role: "receptionist",
        doctorId: "",
      });

      await loadStaff();
    } catch (err) {
      setError(err.message || "Invitation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccount(member) {
    const nextStatus = !member.is_active;

    if (!window.confirm(
      `${nextStatus ? "Activate" : "Deactivate"} ${member.full_name}?`
    )) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.id,
          isActive: nextStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setMessage(data.message);
      await loadStaff();
    } catch (err) {
      setError(err.message || "Account update failed.");
    }
  }

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      `${member.full_name} ${member.email}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesRole =
      roleFilter === "all" || member.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const activeCount = staff.filter((member) => member.is_active).length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-blue-600">
          Clinic administration
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#16345C]">
          Staff management
        </h1>
        <p className="mt-2 text-sm text-[#7890AC]">
          Manage clinic access, invite your team and control staff accounts.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-700">
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Total staff", staff.length],
          ["Active accounts", activeCount],
          ["Inactive accounts", staff.length - activeCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#E1ECF8] bg-white p-6">
            <p className="text-sm text-[#7890AC]">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-[#16345C]">
              {value}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-[#E1ECF8] bg-white p-6">
        <h2 className="text-xl font-semibold text-[#16345C]">
          Invite a team member
        </h2>
        <p className="mt-1 text-sm text-[#7890AC]">
          They'll receive an email invitation to access your clinic.
        </p>

        <form onSubmit={inviteStaff} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              required
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="rounded-xl border border-[#DCE7F3] px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <input
              required
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-xl border border-[#DCE7F3] px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <select
              value={form.role}
              onChange={(e) => setForm({
                ...form,
                role: e.target.value,
                doctorId: "",
              })}
              className="rounded-xl border border-[#DCE7F3] px-4 py-3 text-sm outline-none"
            >
              <option value="receptionist">Receptionist</option>
              <option value="doctor">Doctor</option>
            </select>

            {form.role === "doctor" && (
              <select
                required
                value={form.doctorId}
                onChange={(e) => setForm({
                  ...form,
                  doctorId: e.target.value,
                })}
                className="rounded-xl border border-[#DCE7F3] px-4 py-3 text-sm outline-none"
              >
                <option value="">Select existing doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.full_name} — {doctor.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          {form.role === "doctor" && doctors.length === 0 && (
            <p className="text-sm text-amber-700">
              No unlinked active doctor records found. Register the doctor
              first and ensure their email address is correct.
            </p>
          )}

          <button
            disabled={saving || (form.role === "doctor" && !doctors.length)}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Sending invitation..." : "Send invitation"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-[#E1ECF8] bg-white p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-[#16345C]">
              Staff directory
            </h2>
            <p className="mt-1 text-sm text-[#7890AC]">
              {filteredStaff.length} team members
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff..."
              className="rounded-xl border border-[#DCE7F3] px-4 py-3 text-sm outline-none"
            />

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-[#DCE7F3] px-4 py-3 text-sm"
            >
              <option value="all">All roles</option>
              <option value="admin">Admins</option>
              <option value="receptionist">Receptionists</option>
              <option value="doctor">Doctors</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-[#7890AC]">
            Loading staff...
          </p>
        ) : filteredStaff.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#7890AC]">
            No staff members found.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead>
                <tr className="border-b border-[#EAF0F8] text-xs text-[#7890AC]">
                  <th className="px-3 py-4">TEAM MEMBER</th>
                  <th className="px-3 py-4">ROLE</th>
                  <th className="px-3 py-4">STATUS</th>
                  <th className="px-3 py-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => (
                  <tr key={member.id} className="border-b border-[#F0F4F9]">
                    <td className="px-3 py-4">
                      <p className="font-medium text-[#16345C]">
                        {member.full_name}
                      </p>
                      <p className="mt-1 text-xs text-[#7890AC]">
                        {member.email || "Email unavailable"}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-sm capitalize text-[#58718F]">
                      {member.role}
                    </td>
                    <td className="px-3 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        member.is_active
                          ? "bg-teal-50 text-teal-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {member.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <button
                        onClick={() => toggleAccount(member)}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {member.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
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
