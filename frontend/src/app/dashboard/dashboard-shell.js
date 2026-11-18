
"use client";

import AppointmentsPanel from "./appointments-panel";
import BillingPanel from "./billing-panel";
import DoctorsPanel from "./doctors-panel";
import PatientsPanel from "./patients-panel";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navigation = [
  { name: "Overview", symbol: "⌂" },
  { name: "Patients", symbol: "♙" },
  { name: "Appointments", symbol: "▦" },
  { name: "Doctors", symbol: "✚" },
  { name: "Billing", symbol: "₹" },
  { name: "Reports", symbol: "▥" },
  { name: "Settings", symbol: "⚙" },
];

export default function DashboardShell({
  email,
  fullName,
  clinicName,
  stats: databaseStats,
  patients,
  clinicId,
  userId,
}) {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const stats = [
    {
      title: "Total patients",
      value: databaseStats.patients.toLocaleString("en-IN"),
      symbol: "♙",
      color: "blue",
      note: "Registered in your clinic",
    },
    {
      title: "Appointments",
      value: databaseStats.appointments.toLocaleString("en-IN"),
      symbol: "▦",
      color: "teal",
      note: "Total appointment records",
    },
    {
      title: "Doctors",
      value: databaseStats.doctors.toLocaleString("en-IN"),
      symbol: "✚",
      color: "purple",
      note: "Registered doctors",
    },
    {
      title: "Payment records",
      value: databaseStats.payments.toLocaleString("en-IN"),
      symbol: "₹",
      color: "amber",
      note: "Recorded payments",
    },
  ];

  async function handleLogout() {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setLoggingOut(false);
      alert(error.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#F0F7FF] text-[#16345C]">
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[255px] flex-col border-r border-[#E0EBF8] bg-white transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0`}
      >
        <div className="flex h-[82px] items-center gap-3 border-b border-[#EAF0F8] px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
            N
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight">
              {clinicName}
            </h1>

            <p className="text-xs font-medium tracking-wider text-[#7890AC]">
              MANAGEMENT OS
            </p>
          </div>
        </div>

        <div className="px-5 pt-7">
          <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.16em] text-[#9AAEC4]">
            WORKSPACE
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const active = activePage === item.name;

              return (
                <button
                  key={item.name}
                  onClick={() => {
                    setActivePage(item.name);
                    setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${active
                      ? "bg-blue-50 text-blue-700"
                      : "text-[#7187A2] hover:bg-[#F4F8FD] hover:text-[#16345C]"
                    }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg ${active
                        ? "bg-blue-100 text-blue-700"
                        : "bg-[#F3F7FC] text-[#7187A2]"
                      }`}
                  >
                    {item.symbol}
                  </span>

                  {item.name}

                  {![
                    "Overview",
                    "Patients",
                    "Doctors",
                    "Appointments",
                    "Billing"
                  ].includes(item.name) && (
                      <span className="ml-auto text-[10px] text-[#A5B5C8]">
                        SOON
                      </span>
                    )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-5">
          <div className="rounded-2xl bg-[#F0F7FF] p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              ✦
            </div>

            <p className="text-sm font-semibold">Need assistance?</p>

            <p className="mt-1 text-xs leading-5 text-[#7890AC]">
              Your clinic workspace is ready to grow.
            </p>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-4 w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-[#7187A2] transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            ↪ {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-h-screen lg:ml-[255px]">
        {/* Top navigation */}
        <header className="sticky top-0 z-30 flex h-[82px] items-center justify-between border-b border-[#E0EBF8] bg-white/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-[#E0EBF8] px-3 py-2 text-lg lg:hidden"
              aria-label="Open navigation"
            >
              ☰
            </button>

            <div>
              <p className="text-sm font-semibold">{activePage}</p>

              <p className="hidden text-xs text-[#8BA0B8] sm:block">
                Nova Clinic OS / {activePage}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <button
              aria-label="Notifications"
              className="relative rounded-xl bg-[#F2F7FD] px-3 py-2 text-lg text-[#58718F]"
            >
              ♧
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-400 ring-2 ring-white" />
            </button>

            <div className="flex items-center gap-3 border-l border-[#E5EDF6] pl-3 sm:pl-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E4EDFF] text-sm font-bold text-blue-700">
                {fullName?.slice(0, 1).toUpperCase() || "A"}
              </div>

              <div className="hidden sm:block">
                <p className="max-w-[180px] truncate text-sm font-semibold">
                  {fullName || "Clinic Admin"}
                </p>

                <p className="max-w-[180px] truncate text-xs text-[#8BA0B8]">
                  {email}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
          {activePage === "Overview" ? (
            <>
              {/* Welcome section */}
              <div className="relative mb-10 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#DCEBFF] via-[#EAF4FF] to-[#EAE5FF] p-7 sm:p-10">
                <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-white/40 blur-3xl" />

                <div className="pointer-events-none absolute -bottom-24 right-1/4 h-48 w-48 rounded-full bg-purple-200/40 blur-3xl" />

                <div className="relative z-10 flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
                  <div>
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-4 py-2 text-xs font-semibold text-blue-800">
                      <span className="h-2 w-2 rounded-full bg-teal-500" />
                      YOUR CLINIC SPACE
                    </div>

                    <h2 className="max-w-xl text-3xl font-bold leading-tight tracking-tight text-[#16345C] sm:text-4xl">
                      A better day starts
                      <br />
                      with better care.
                    </h2>

                    <p className="mt-4 max-w-md text-sm leading-7 text-[#58718F]">
                      Welcome back, {fullName?.split(" ")[0] || "there"} 👋
                    </p>
                  </div>

                  <div className="w-fit rounded-2xl border border-white/70 bg-white/65 px-5 py-4 backdrop-blur-md">
                    <p className="text-xs font-semibold tracking-wider text-[#7890AC]">
                      TODAY
                    </p>

                    <p className="mt-1 text-lg font-bold text-[#16345C]">
                      {new Date().toLocaleDateString("en-IN", {
                        weekday: "long",
                      })}
                    </p>

                    <p className="text-sm text-[#58718F]">
                      {new Date().toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                  <div
                    key={stat.title}
                    className="rounded-2xl border border-[#E1ECF8] bg-white p-7 shadow-[0_8px_30px_rgba(40,80,130,0.035)]"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#7890AC]">
                        {stat.title}
                      </p>

                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${stat.color === "blue"
                            ? "bg-blue-50 text-blue-600"
                            : stat.color === "teal"
                              ? "bg-teal-50 text-teal-600"
                              : stat.color === "purple"
                                ? "bg-purple-50 text-purple-600"
                                : "bg-amber-50 text-amber-600"
                          }`}
                      >
                        {stat.symbol}
                      </span>
                    </div>

                    <h3 className="mt-6 text-3xl font-bold tracking-tight">
                      {stat.value}
                    </h3>

                    <p className="mt-2 text-xs text-[#9AAEC4]">
                      {stat.note}
                    </p>
                  </div>
                ))}
              </div>

              {/* Appointment shortcut and workspace */}
              <div className="mt-12 grid grid-cols-1 gap-8 xl:grid-cols-3">
                <section className="rounded-[24px] border border-[#E1ECF8] bg-white p-7 xl:col-span-2">
                  <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-sm font-semibold text-teal-600">
                        CLINIC SCHEDULING
                      </p>

                      <h3 className="mt-2 text-xl font-bold">
                        Keep every visit on track.
                      </h3>

                      <p className="mt-2 max-w-md text-sm leading-6 text-[#8BA0B8]">
                        Book appointments, find patient visits and update
                        appointment statuses from your clinic schedule.
                      </p>
                    </div>

                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-2xl text-teal-600">
                      ▦
                    </span>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setActivePage("Appointments")}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      Manage appointments
                    </button>

                    <button
                      onClick={() => setActivePage("Doctors")}
                      className="rounded-xl border border-[#E1ECF8] px-5 py-3 text-sm font-semibold text-[#58718F] transition hover:bg-[#F4F8FD]"
                    >
                      View doctors
                    </button>
                  </div>
                </section>

                <section className="rounded-[24px] border border-[#E1ECF8] bg-white p-7">
                  <h3 className="text-lg font-bold">Your workspace</h3>

                  <p className="mt-2 text-sm text-[#8BA0B8]">
                    Everything your clinic needs, in one place.
                  </p>

                  <div className="mt-8 space-y-6">
                    <div className="flex items-center gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        ♙
                      </span>

                      <div>
                        <p className="text-sm font-semibold">
                          Patient management
                        </p>

                        <p className="mt-1 text-xs text-[#8BA0B8]">
                          Organize patient records
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                        ▦
                      </span>

                      <div>
                        <p className="text-sm font-semibold">
                          Appointment planning
                        </p>

                        <p className="mt-1 text-xs text-[#8BA0B8]">
                          Manage clinic schedules
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                        ₹
                      </span>

                      <div>
                        <p className="text-sm font-semibold">
                          Billing management
                        </p>

                        <p className="mt-1 text-xs text-[#8BA0B8]">
                          Track clinic payments
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </>
          ) : activePage === "Patients" ? (
            <PatientsPanel
              initialPatients={patients}
              clinicId={clinicId}
              userId={userId}
            />
          ) : activePage === "Doctors" ? (
            <DoctorsPanel />
          ) : activePage === "Appointments" ? (
            <AppointmentsPanel />
          ) : activePage === "Billing" ? (
            <BillingPanel />
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[24px] border border-[#E1ECF8] bg-white p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600">
                ✦
              </div>

              <h2 className="mt-5 text-2xl font-bold">{activePage}</h2>

              <p className="mt-2 max-w-sm text-sm leading-6 text-[#7890AC]">
                This module is coming soon. We&apos;ll connect it to your clinic
                database.
              </p>

              <button
                onClick={() => setActivePage("Overview")}
                className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Back to overview
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
