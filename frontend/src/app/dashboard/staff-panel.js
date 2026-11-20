
"use client";

import { useEffect, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]";

const selectClass = `${inputClass} cursor-pointer`;

function StatCard({ label, value, description }) {
  return (
    <div className="rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-2 text-xs text-[var(--text-muted)]">{description}</p>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${active
        ? "bg-[var(--success-soft)] text-[var(--success)]"
        : "bg-[var(--warning-soft)] text-[var(--warning)]"
        }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--success)]" : "bg-[var(--warning)]"
          }`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function RoleBadge({ role }) {
  const styles = {
    admin: "bg-[var(--primary-soft)] text-[var(--primary)]",
    doctor: "bg-[var(--lavender)] text-[var(--foreground)]",
    receptionist: "bg-[var(--teal)] text-[var(--foreground)]",
  };

  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium capitalize ${styles[role] || "bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
        }`}
    >
      {role}
    </span>
  );
}

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

    if (
      !window.confirm(
        `${nextStatus ? "Activate" : "Deactivate"} ${member.full_name}?`
      )
    ) {
      return;
    }

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
  const inactiveCount = staff.length - activeCount;

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <p className="text-sm font-medium text-[var(--primary)]">
          Clinic administration
        </p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
          Staff management
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Manage clinic access, invite your team and control staff accounts.
        </p>
      </div>

      {/* Feedback messages */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-xl border border-[var(--success)]/20 bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success)]"
        >
          {message}
        </div>
      )}

      {/* Staff overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total staff"
          value={staff.length}
          description="All registered team members"
        />
        <StatCard
          label="Active accounts"
          value={activeCount}
          description="Accounts with active access"
        />
        <StatCard
          label="Inactive accounts"
          value={inactiveCount}
          description="Accounts currently deactivated"
        />
      </div>

      {/* Invite staff */}
      <section className="rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Invite a team member
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Add a receptionist or connect an existing doctor to the clinic.
            </p>
          </div>
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] sm:flex">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                d="M12 5v14M5 12h14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <form onSubmit={inviteStaff} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Full name
              </label>
              <input
                required
                placeholder="Enter full name"
                value={form.fullName}
                onChange={(e) =>
                  setForm({ ...form, fullName: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Email address
              </label>
              <input
                required
                type="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Team role
              </label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value,
                    doctorId: "",
                  })
                }
                className={selectClass}
              >
                <option value="receptionist">Receptionist</option>
                <option value="doctor">Doctor</option>
              </select>
            </div>

            {form.role === "doctor" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                  Existing doctor profile
                </label>
                <select
                  required
                  value={form.doctorId}
                  onChange={(e) =>
                    setForm({ ...form, doctorId: e.target.value })
                  }
                  className={selectClass}
                >
                  <option value="">Select a doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.full_name} — {doctor.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {form.role === "doctor" && doctors.length === 0 && (
            <div className="rounded-lg border border-[var(--warning)]/20 bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">
              No unlinked active doctor records found. Register the doctor
              first and ensure their email address is correct.
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--text-muted)]">
              An email invitation will be sent to the team member.
            </p>
            <button
              type="submit"
              disabled={saving || (form.role === "doctor" && !doctors.length)}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Sending invitation..." : "Send invitation"}
            </button>
          </div>
        </form>
      </section>

      {/* Staff directory */}
      <section className="overflow-hidden rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Staff directory
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {filteredStaff.length} team members
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff..."
              aria-label="Search staff"
              className={`${inputClass} sm:w-64`}
            />

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter staff by role"
              className="w-full sm:w-44"
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--control-radius)",
                background: "var(--surface)",
                color: "var(--foreground)",
                padding: "12px 16px",
                fontSize: "14px",
                outline: "none",
              }}
            >
              <option value="all">All roles</option>
              <option value="admin">Admins</option>
              <option value="receptionist">Receptionists</option>
              <option value="doctor">Doctors</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center px-6 py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Loading staff...
            </p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path
                  d="m16 16 4 4M8 11h6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
              No staff members found
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Try changing your search or role filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
                  <th className="px-6 py-3.5 text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
                    TEAM MEMBER
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
                    ROLE
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
                    STATUS
                  </th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
                    ACTION
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredStaff.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-[var(--border)] last:border-b-0 transition-colors hover:bg-[var(--surface-hover)]"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {member.full_name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {member.email || "Email unavailable"}
                      </p>
                    </td>

                    <td className="px-6 py-4">
                      <RoleBadge role={member.role} />
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge active={member.is_active} />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleAccount(member)}
                        className="rounded-md px-2 py-1.5 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
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
