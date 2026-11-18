
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
      row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")
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

    if (profileError || !profile?.clinic_id || profile.role !== "admin") {
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
      .reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

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
      return sum + Math.max(
        0,
        Number(invoice.total_amount || 0) - paid
      );
    }, 0);

    const statusCounts = appointments.reduce((counts, item) => {
      const status = item.status || "unknown";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});

    const doctorStats = data.doctors.map((doctor) => {
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
    }).sort((a, b) => b.total - a.total);

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
          (item) => dateKey(new Date(item.appointment_at)) === key
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

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E1ECF8] bg-white p-10 text-center text-sm text-[#7890AC]">
        Loading clinic reports...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
        <button
          onClick={loadReports}
          className="ml-3 font-semibold underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-blue-600">
            Clinic insights
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#16345C]">
            Reports
          </h1>
          <p className="mt-2 text-sm text-[#7890AC]">
            Understand your clinic&apos;s activity and performance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <button
              key={item.value}
              onClick={() => setRange(item.value)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                range === item.value
                  ? "bg-blue-600 text-white"
                  : "border border-[#E1ECF8] bg-white text-[#58718F]"
              }`}
            >
              {item.label}
            </button>
          ))}

          <button
            onClick={() => exportCSV([
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
            ])}
            className="rounded-xl border border-[#E1ECF8] bg-white px-4 py-2.5 text-sm font-semibold text-[#58718F] hover:bg-[#F4F8FD]"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "New patients",
            value: report.patientCount.toLocaleString("en-IN"),
            note: `Registered in ${range} days`,
            color: "blue",
          },
          {
            label: "Appointments",
            value: report.appointmentCount.toLocaleString("en-IN"),
            note: `Scheduled in ${range} days`,
            color: "teal",
          },
          {
            label: "Revenue collected",
            value: money(report.totalCollected),
            note: `Payments received in ${range} days`,
            color: "purple",
          },
          {
            label: "Outstanding balance",
            value: money(report.outstanding),
            note: "Across all active invoices",
            color: "amber",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[#E1ECF8] bg-white p-6"
          >
            <p className="text-sm font-medium text-[#7890AC]">
              {item.label}
            </p>
            <p className="mt-5 break-words text-2xl font-bold tracking-tight text-[#16345C]">
              {item.value}
            </p>
            <p className="mt-2 text-xs text-[#9AAEC4]">
              {item.note}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#E1ECF8] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#16345C]">
            Appointment activity
          </h2>
          <p className="mt-1 text-sm text-[#8BA0B8]">
            Daily appointments over the selected period.
          </p>

          <div className="mt-7 flex h-48 items-end gap-1.5 overflow-x-auto">
            {report.daily.map((item) => (
              <div
                key={item.date}
                title={`${item.label}: ${item.appointments} appointments`}
                className="flex h-full min-w-2 flex-1 flex-col justify-end"
              >
                <div
                  className="w-full rounded-t-md bg-blue-500 transition-all"
                  style={{
                    height: `${(item.appointments / maxDaily) * 100}%`,
                    minHeight: item.appointments ? "5px" : "0",
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-between text-xs text-[#9AAEC4]">
            <span>{report.daily[0]?.label}</span>
            <span>{report.daily.at(-1)?.label}</span>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E1ECF8] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#16345C]">
            Appointment status
          </h2>
          <p className="mt-1 text-sm text-[#8BA0B8]">
            Breakdown for the selected period.
          </p>

          <div className="mt-6 space-y-5">
            {Object.entries(report.statusCounts).length === 0 ? (
              <p className="py-8 text-sm text-[#9AAEC4]">
                No appointments in this period.
              </p>
            ) : (
              Object.entries(report.statusCounts).map(([status, count]) => (
                <div key={status}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="capitalize text-[#58718F]">
                      {status.replaceAll("_", " ")}
                    </span>
                    <span className="font-semibold text-[#16345C]">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#EEF3F9]">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{
                        width: `${(count / report.appointmentCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#E1ECF8] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#16345C]">
            Financial summary
          </h2>
          <p className="mt-1 text-sm text-[#8BA0B8]">
            Billed and collected amounts for {range} days.
          </p>

          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#7890AC]">Total billed</span>
              <strong className="text-[#16345C]">
                {money(report.totalBilled)}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#7890AC]">Payments collected</span>
              <strong className="text-teal-700">
                {money(report.totalCollected)}
              </strong>
            </div>
            <div className="flex items-center justify-between border-t border-[#EAF0F8] pt-5">
              <span className="text-sm text-[#7890AC]">Outstanding balance</span>
              <strong className="text-amber-700">
                {money(report.outstanding)}
              </strong>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E1ECF8] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#16345C]">
            Doctor performance
          </h2>
          <p className="mt-1 text-sm text-[#8BA0B8]">
            Appointment activity by doctor.
          </p>

          <div className="mt-5 space-y-4">
            {report.doctorStats.length === 0 ? (
              <p className="py-8 text-sm text-[#9AAEC4]">
                No doctor records found.
              </p>
            ) : (
              report.doctorStats.map((doctor) => (
                <div
                  key={doctor.id}
                  className="flex items-center justify-between gap-4 border-b border-[#F0F4F9] pb-4 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#16345C]">
                      {doctor.full_name}
                    </p>
                    <p className="mt-1 text-xs text-[#8BA0B8]">
                      {doctor.specialization || "General"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[#16345C]">
                      {doctor.total} appointments
                    </p>
                    <p className="mt-1 text-xs text-teal-600">
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
