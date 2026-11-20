
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ranges = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function exportCSV(rows) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "nova-clinic-report.csv";
  link.click();

  URL.revokeObjectURL(url);
}

const cardClass =
  "rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6";

const sectionTitle =
  "text-lg font-semibold tracking-tight text-[var(--foreground)]";

const sectionDescription =
  "mt-1 text-sm text-[var(--text-secondary)]";

function StatCard({ label, value, note, accent }) {
  const accentStyles = {
    blue: "bg-[var(--primary-soft)] text-[var(--primary)]",
    teal: "bg-[var(--teal)] text-[var(--foreground)]",
    purple: "bg-[var(--lavender)] text-[var(--foreground)]",
    amber: "bg-[var(--warning-soft)] text-[var(--warning)]",
  };

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          {label}
        </p>
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${accentStyles[accent] || accentStyles.blue
            }`}
        />
      </div>

      <p className="mt-5 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[28px]">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
        {note}
      </p>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl bg-[var(--surface-subtle)] px-5 text-center">
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  );
}

export default function ReportsPanel() {
  const supabase = useMemo(() => createClient(), []);

  const [range, setRange] = useState(30);
  const [data, setData] = useState({
    patients: [],
    appointments: [],
    doctors: [],
    invoices: [],
    payments: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
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

    if (
      profileError ||
      !profile?.clinic_id ||
      !["admin", "demo"].includes(profile.role)
    ) {
      setError("You don't have permission to view clinic reports.");
      setLoading(false);
      return;
    }

    const [
      patientsResult,
      appointmentsResult,
      doctorsResult,
      invoicesResult,
      paymentsResult,
    ] = await Promise.all([
      supabase
        .from("patients")
        .select("id, created_at")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false })
        .limit(5000),

      supabase
        .from("appointments")
        .select("id, doctor_id, appointment_at, status")
        .eq("clinic_id", profile.clinic_id)
        .order("appointment_at", { ascending: false })
        .limit(5000),

      supabase
        .from("doctors")
        .select("id, full_name, specialization")
        .eq("clinic_id", profile.clinic_id)
        .limit(1000),

      supabase
        .from("invoices")
        .select("id, total_amount, status, created_at")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false })
        .limit(5000),

      supabase
        .from("payments")
        .select("id, invoice_id, amount, paid_at")
        .order("paid_at", { ascending: false })
        .limit(5000),
    ]);

    const results = [
      patientsResult,
      appointmentsResult,
      doctorsResult,
      invoicesResult,
      paymentsResult,
    ];

    const failed = results.find((result) => result.error);

    if (failed) {
      setError(failed.error.message);
      setLoading(false);
      return;
    }

    setData({
      patients: patientsResult.data || [],
      appointments: appointmentsResult.data || [],
      doctors: doctorsResult.data || [],
      invoices: invoicesResult.data || [],
      payments: paymentsResult.data || [],
    });

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadReports();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadReports]);

  const report = useMemo(() => {
    const now = new Date();
    const start = new Date(now);

    start.setDate(start.getDate() - range + 1);
    start.setHours(0, 0, 0, 0);

    const inRange = (value) => {
      if (!value) return false;
      const date = new Date(value);
      return date >= start && date <= now;
    };

    const patients = data.patients.filter((item) =>
      inRange(item.created_at)
    );

    const appointments = data.appointments.filter((item) =>
      inRange(item.appointment_at)
    );

    const invoices = data.invoices.filter((item) =>
      inRange(item.created_at)
    );

    const payments = data.payments.filter((item) =>
      inRange(item.paid_at)
    );

    const activeInvoices = data.invoices.filter(
      (item) => item.status !== "cancelled"
    );

    const totalBilled = invoices
      .filter((item) => item.status !== "cancelled")
      .reduce(
        (sum, item) => sum + Number(item.total_amount || 0),
        0
      );

    const totalCollected = payments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const invoicePaid = data.payments.reduce((map, payment) => {
      map.set(
        payment.invoice_id,
        (map.get(payment.invoice_id) || 0) +
        Number(payment.amount || 0)
      );
      return map;
    }, new Map());

    const outstanding = activeInvoices.reduce((sum, invoice) => {
      const paid = invoicePaid.get(invoice.id) || 0;

      return (
        sum +
        Math.max(
          0,
          Number(invoice.total_amount || 0) - paid
        )
      );
    }, 0);

    const statusCounts = appointments.reduce((counts, item) => {
      const status = item.status || "unknown";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});

    const doctorStats = data.doctors
      .map((doctor) => {
        const doctorAppointments = appointments.filter(
          (item) => item.doctor_id === doctor.id
        );

        return {
          ...doctor,
          total: doctorAppointments.length,
          completed: doctorAppointments.filter(
            (item) => item.status === "completed"
          ).length,
        };
      })
      .sort((a, b) => b.total - a.total);

    const daily = [];

    for (let i = range - 1; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const key = dateKey(day);

      daily.push({
        date: key,
        label: day.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        appointments: appointments.filter(
          (item) =>
            dateKey(new Date(item.appointment_at)) === key
        ).length,
      });
    }

    return {
      patientCount: patients.length,
      appointmentCount: appointments.length,
      totalBilled,
      totalCollected,
      outstanding,
      statusCounts,
      doctorStats,
      daily,
    };
  }, [data, range]);

  const maxDaily = Math.max(
    1,
    ...report.daily.map((item) => item.appointments)
  );

  const statusColors = [
    "var(--primary)",
    "var(--sage)",
    "var(--lavender)",
    "var(--amber)",
    "var(--teal)",
  ];

  if (loading) {
    return (
      <div className={`${cardClass} flex min-h-64 flex-col items-center justify-center`}>
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          Loading clinic reports...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[var(--card-radius)] border border-[var(--danger)]/20 bg-[var(--danger-soft)] p-6">
        <p className="text-sm text-[var(--danger)]">{error}</p>
        <button
          type="button"
          onClick={loadReports}
          className="mt-4 rounded-lg bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Page heading and actions */}
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-medium text-[var(--primary)]">
            Clinic insights
          </p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            Reports
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Understand your clinic&apos;s activity and performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ranges.map((item) => (
            <button
              type="button"
              key={item.value}
              onClick={() => setRange(item.value)}
              aria-pressed={range === item.value}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${range === item.value
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }`}
            >
              {item.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() =>
              exportCSV([
                ["Report", "Value"],
                ["New patients", report.patientCount],
                ["Appointments", report.appointmentCount],
                ["Billed in period", report.totalBilled],
                ["Collected in period", report.totalCollected],
                ["Current outstanding", report.outstanding],
                [],
                ["Appointment status", "Count"],
                ...Object.entries(report.statusCounts),
                [],
                ["Doctor", "Specialization", "Appointments", "Completed"],
                ...report.doctorStats.map((doctor) => [
                  doctor.full_name,
                  doctor.specialization,
                  doctor.total,
                  doctor.completed,
                ]),
              ])
            }
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="New patients"
          value={report.patientCount.toLocaleString("en-IN")}
          note={`Registered in ${range} days`}
          accent="blue"
        />

        <StatCard
          label="Appointments"
          value={report.appointmentCount.toLocaleString("en-IN")}
          note={`Scheduled in ${range} days`}
          accent="teal"
        />

        <StatCard
          label="Revenue collected"
          value={money(report.totalCollected)}
          note={`Payments received in ${range} days`}
          accent="purple"
        />

        <StatCard
          label="Outstanding balance"
          value={money(report.outstanding)}
          note="Across all active invoices"
          accent="amber"
        />
      </div>

      {/* Activity and status */}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className={cardClass}>
          <h2 className={sectionTitle}>Appointment activity</h2>
          <p className={sectionDescription}>
            Daily appointments over the selected period.
          </p>

          {report.appointmentCount === 0 ? (
            <div className="mt-6">
              <EmptyState message="No appointments in this period." />
            </div>
          ) : (
            <>
              <div className="mt-8 flex h-48 items-end gap-1.5 overflow-x-auto rounded-xl bg-[var(--surface-subtle)] px-3 pt-4">
                {report.daily.map((item) => (
                  <div
                    key={item.date}
                    title={`${item.label}: ${item.appointments} appointments`}
                    className="flex h-full min-w-2 flex-1 flex-col justify-end"
                  >
                    <div
                      className="w-full rounded-t-md bg-[var(--primary)] transition-all duration-300"
                      style={{
                        height: `${(item.appointments / maxDaily) * 100}%`,
                        minHeight: item.appointments ? "5px" : "0",
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-between text-xs text-[var(--text-muted)]">
                <span>{report.daily[0]?.label}</span>
                <span>{report.daily.at(-1)?.label}</span>
              </div>
            </>
          )}
        </section>

        <section className={cardClass}>
          <h2 className={sectionTitle}>Appointment status</h2>
          <p className={sectionDescription}>
            Breakdown for the selected period.
          </p>

          <div className="mt-7 space-y-5">
            {Object.entries(report.statusCounts).length === 0 ? (
              <EmptyState message="No appointments in this period." />
            ) : (
              Object.entries(report.statusCounts).map(
                ([status, count], index) => (
                  <div key={status}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="capitalize text-[var(--text-secondary)]">
                        {status.replaceAll("_", " ")}
                      </span>
                      <span className="font-semibold tabular-nums text-[var(--foreground)]">
                        {count}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${(count / report.appointmentCount) * 100
                            }%`,
                          backgroundColor:
                            statusColors[index % statusColors.length],
                        }}
                      />
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </section>
      </div>

      {/* Financial and doctor reports */}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className={cardClass}>
          <h2 className={sectionTitle}>Financial summary</h2>
          <p className={sectionDescription}>
            Billed and collected amounts for {range} days.
          </p>

          <div className="mt-7 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-[var(--text-secondary)]">
                Total billed
              </span>
              <strong className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                {money(report.totalBilled)}
              </strong>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-[var(--text-secondary)]">
                Payments collected
              </span>
              <strong className="text-sm font-semibold tabular-nums text-[var(--success)]">
                {money(report.totalCollected)}
              </strong>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] pt-5">
              <span className="text-sm text-[var(--text-secondary)]">
                Outstanding balance
              </span>
              <strong className="text-sm font-semibold tabular-nums text-[var(--warning)]">
                {money(report.outstanding)}
              </strong>
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className={sectionTitle}>Doctor performance</h2>
          <p className={sectionDescription}>
            Appointment activity by doctor.
          </p>

          <div className="mt-6 space-y-4">
            {report.doctorStats.length === 0 ? (
              <EmptyState message="No doctor records found." />
            ) : (
              report.doctorStats.map((doctor) => (
                <div
                  key={doctor.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 transition hover:bg-[var(--surface-hover)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {doctor.full_name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {doctor.specialization || "General"}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {doctor.total} appointments
                    </p>
                    <p className="mt-1 text-xs text-[var(--success)]">
                      {doctor.completed} completed
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
