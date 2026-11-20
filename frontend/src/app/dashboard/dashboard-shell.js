
"use client";

import SettingsPanel from "./settings-panel";
import StaffPanel from "./staff-panel";
import AppointmentsPanel from "./appointments-panel";
import BillingPanel from "./billing-panel";
import ReportsPanel from "./reports-panel";
import DoctorsPanel from "./doctors-panel";
import PatientsPanel from "./patients-panel";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const THEME_KEY = "nova-clinic-theme";

const navigation = [
  { name: "Overview", symbol: "⌂", roles: ["admin", "receptionist", "doctor", "demo"] },
  { name: "Patients", symbol: "♙", roles: ["admin", "receptionist", "doctor", "demo"] },
  { name: "Appointments", symbol: "▦", roles: ["admin", "receptionist", "doctor", "demo"] },
  { name: "Doctors", symbol: "✚", roles: ["admin", "receptionist", "demo"] },
  { name: "Billing", symbol: "₹", roles: ["admin", "receptionist", "demo"] },
  { name: "Staff", symbol: "♧", roles: ["admin"] },
  { name: "Reports", symbol: "▥", roles: ["admin", "demo"] },
  { name: "Settings", symbol: "⚙", roles: ["admin"] },
];

const statColors = {
  blue: { background: "var(--primary-soft)", color: "var(--primary)" },
  teal: { background: "var(--info-soft)", color: "var(--teal)" },
  purple: { background: "var(--surface-subtle)", color: "var(--lavender)" },
  amber: { background: "var(--warning-soft)", color: "var(--warning)" },
};

export default function DashboardShell({
  email,
  fullName,
  clinicName,
  stats: databaseStats,
  patients,
  clinicId,
  userId,
  role,
  demoPersona,
}) {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [previewRole, setPreviewRole] = useState(demoPersona || "admin");
  const [theme, setTheme] = useState(null);

  const router = useRouter();
  const supabase = createClient();

  // Load the saved theme when the dashboard opens.
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const initialTheme = savedTheme === "dark" ? "dark" : "light";

    document.documentElement.dataset.theme = initialTheme;
    setTheme(initialTheme);
  }, []);

  // Apply and remember theme changes.
  useEffect(() => {
    if (!theme) return;

    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => current === "dark" ? "light" : "dark");
  }

  const displayRole = role === "demo" ? previewRole : role;

  const navItems = navigation.filter(
    (item) =>
      item.roles.includes(displayRole) &&
      (role !== "demo" || item.name !== "Staff")
  );

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

  const cardStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--card-radius)",
    boxShadow: "var(--shadow-card)",
  };

  const mutedText = { color: "var(--text-secondary)" };
  const subtleText = { color: "var(--text-muted)" };

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 m-0 flex h-screen w-[264px] flex-col p-4 transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          className="flex h-full flex-col overflow-hidden"
          style={{
            background: "var(--sidebar)",
            border: "1px solid var(--border)",
            borderRadius: "var(--sidebar-radius)",
            boxShadow: "var(--shadow-floating)",
          }}
        >
          {/* Brand */}
          <div
            className="flex h-[72px] shrink-0 items-center gap-3 px-5"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              N
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-tight">
                {clinicName}
              </h1>
              <p
                className="mt-0.5 text-[10px] font-semibold tracking-[0.14em]"
                style={subtleText}
              >
                MANAGEMENT OS
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div className="px-3 pt-7">
            <p
              className="mb-3 px-3 text-[10px] font-semibold tracking-[0.16em]"
              style={subtleText}
            >
              WORKSPACE
            </p>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = activePage === item.name;

                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      setActivePage(item.name);
                      setSidebarOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors"
                    style={{
                      background: active
                        ? "var(--primary-soft)"
                        : "transparent",
                      color: active
                        ? "var(--primary)"
                        : "var(--text-secondary)",
                    }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                      style={{
                        background: active
                          ? "var(--surface)"
                          : "var(--surface-subtle)",
                        color: active
                          ? "var(--primary)"
                          : "var(--text-secondary)",
                      }}
                    >
                      {item.symbol}
                    </span>

                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar bottom */}
          <div className="mt-auto p-4">
            

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[13px] font-medium transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              style={mutedText}
            >
              <span className="text-lg">↪</span>
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="min-h-screen lg:ml-[264px]">
        {/* Header */}
        <header
          className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-3 px-5 sm:px-8"
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg px-3 py-2 text-lg lg:hidden"
              style={{
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              aria-label="Open navigation"
            >
              ☰
            </button>

            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">
                {activePage}
              </p>
              <p
                className="hidden text-xs sm:block"
                style={subtleText}
              >
                Nova Clinic OS / {activePage}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {/* Demo persona selector */}
            {role === "demo" && (
              <div
                className="hidden items-center gap-1 rounded-lg p-1 sm:flex"
                style={{
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border)",
                }}
              >
                {["admin", "receptionist", "doctor"].map((persona) => (
                  <button
                    key={persona}
                    onClick={() => {
                      setPreviewRole(persona);
                      setActivePage("Overview");
                    }}
                    className="rounded-md px-2.5 py-2 text-[11px] font-semibold capitalize transition-colors sm:px-3"
                    style={{
                      background:
                        previewRole === persona
                          ? "var(--surface)"
                          : "transparent",
                      color:
                        previewRole === persona
                          ? "var(--primary)"
                          : "var(--text-secondary)",
                      boxShadow:
                        previewRole === persona
                          ? "var(--shadow-card)"
                          : "none",
                    }}
                  >
                    {persona}
                  </button>
                ))}
              </div>
            )}

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              title={
                theme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors"
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>

            {/* User profile */}
            <div
              className="flex items-center gap-2 border-l pl-3 sm:gap-3 sm:pl-4"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                style={{
                  background: "var(--primary-soft)",
                  color: "var(--primary)",
                }}
              >
                {fullName?.slice(0, 1).toUpperCase() || "A"}
              </div>

              <div className="hidden min-w-0 sm:block">
                <p className="max-w-[160px] truncate text-xs font-semibold">
                  {fullName || "Clinic Admin"}
                </p>
                <p
                  className="max-w-[160px] truncate text-[11px]"
                  style={subtleText}
                >
                  {email}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="mx-auto max-w-[1500px] p-6 sm:p-10">

          {/* Overview */}
          {activePage === "Overview" ? (
            <div className="space-y-9">

              {/* Welcome heading */}
              <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p
                    className="mb-2 text-xs font-semibold tracking-wide"
                    style={{ color: "var(--primary)" }}
                  >
                    CLINIC OVERVIEW
                  </p>

                  <h2 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
                    Good to see you, {fullName?.split(" ")[0] || "there"}.
                  </h2>

                  <p
                    className="mt-2 text-sm"
                    style={mutedText}
                  >
                    Here's what's happening in your clinic today.
                  </p>
                </div>

                <div
                  className="w-fit rounded-xl px-4 py-3"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p
                    className="text-[10px] font-semibold tracking-wider"
                    style={subtleText}
                  >
                    TODAY
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {new Date().toLocaleDateString("en-IN", {
                      weekday: "long",
                    })}
                  </p>
                  <p className="text-xs" style={mutedText}>
                    {new Date().toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </section>


              {/* Statistics */}
              <section>
                <div className="mb-4">
                  <h3 className="text-[15px] font-semibold">
                    Clinic at a glance
                  </h3>
                  <p className="mt-1 text-xs" style={subtleText}>
                    An overview of your clinic records.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {stats.map((stat) => {
                    const colors = statColors[stat.color];

                    return (
                      <div
                        key={stat.title}
                        className="min-w-0 p-6 sm:p-7"
                        style={cardStyle}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p
                            className="text-[13px] font-medium"
                            style={mutedText}
                          >
                            {stat.title}
                          </p>

                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                            style={{
                              background: colors.background,
                              color: colors.color,
                            }}
                          >
                            {stat.symbol}
                          </span>
                        </div>

                        <h3
                          className="mt-5 text-[30px] font-semibold tracking-tight"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {stat.value}
                        </h3>

                        <p
                          className="mt-1 text-xs"
                          style={subtleText}
                        >
                          {stat.note}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Workspace sections */}
              <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">

                {/* Appointments shortcut */}
                <div
                  className="p-6 sm:p-7 xl:col-span-2"
                  style={cardStyle}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className="text-xs font-semibold tracking-wide"
                        style={{ color: "var(--sage)" }}
                      >
                        CLINIC SCHEDULING
                      </p>

                      <h3 className="mt-2 text-lg font-semibold">
                        Keep every visit on track.
                      </h3>

                      <p
                        className="mt-2 max-w-md text-sm leading-6"
                        style={mutedText}
                      >
                        {role === "demo"
                          ? "Explore the clinic schedule and view sample patient appointments."
                          : "Book appointments, find patient visits and update appointment statuses from your clinic schedule."}
                      </p>
                    </div>

                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{
                        background: "var(--info-soft)",
                        color: "var(--primary)",
                      }}
                    >
                      ▦
                    </span>
                  </div>

                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      onClick={() => setActivePage("Appointments")}
                      className="rounded-lg px-5 py-2.5 text-xs font-semibold transition-opacity hover:opacity-90"
                      style={{
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      {role === "demo"
                        ? "Explore appointments"
                        : "Manage appointments"}
                    </button>

                    <button
                      onClick={() => setActivePage("Doctors")}
                      className="rounded-lg px-5 py-2.5 text-xs font-semibold transition-colors"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border-strong)",
                        color: "var(--foreground)",
                      }}
                    >
                      View doctors
                    </button>
                  </div>
                </div>

                {/* Workspace summary */}
                <div className="p-6 sm:p-7" style={cardStyle}>
                  <h3 className="text-[15px] font-semibold">
                    Your workspace
                  </h3>

                  <p
                    className="mt-1 text-xs leading-5"
                    style={mutedText}
                  >
                    Everything your clinic needs, in one place.
                  </p>

                  <div className="mt-6 space-y-5">
                    {[
                      {
                        symbol: "♙",
                        title: "Patient management",
                        description: "Organize patient records",
                        color: "var(--primary)",
                        background: "var(--primary-soft)",
                      },
                      {
                        symbol: "▦",
                        title: "Appointment planning",
                        description: "Manage clinic schedules",
                        color: "var(--sage)",
                        background: "var(--success-soft)",
                      },
                      {
                        symbol: "₹",
                        title: "Billing management",
                        description: "Track clinic payments",
                        color: "var(--warning)",
                        background: "var(--warning-soft)",
                      },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="flex items-center gap-3"
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base"
                          style={{
                            color: item.color,
                            background: item.background,
                          }}
                        >
                          {item.symbol}
                        </span>

                        <div>
                          <p className="text-xs font-semibold">
                            {item.title}
                          </p>
                          <p
                            className="mt-1 text-[11px]"
                            style={subtleText}
                          >
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

          ) : activePage === "Patients" ? (
            <PatientsPanel
              initialPatients={patients}
              clinicId={clinicId}
              userId={userId}
              isReadOnly={role === "demo"}
            />

          ) : activePage === "Doctors" ? (
            <DoctorsPanel isReadOnly={role === "demo"} />

          ) : activePage === "Appointments" ? (
            <AppointmentsPanel isReadOnly={role === "demo"} />

          ) : activePage === "Billing" ? (
            <BillingPanel />

          ) : activePage === "Staff" && role === "admin" ? (
            <StaffPanel />

          ) : activePage === "Reports" &&
            (role === "admin" || (role === "demo" && previewRole === "admin")) ? (
            <ReportsPanel />

          ) : activePage === "Settings" &&
            (role === "admin" || (role === "demo" && previewRole === "admin")) ? (
            <SettingsPanel
              clinicId={clinicId}
              userId={userId}
              fullName={fullName}
              email={email}
              clinicName={clinicName}
              isReadOnly={role === "demo"}
            />

          ) : (
            <div
              className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center"
              style={cardStyle}
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl"
                style={{
                  background: "var(--primary-soft)",
                  color: "var(--primary)",
                }}
              >
                ✦
              </div>

              <h2 className="mt-5 text-xl font-semibold">
                {activePage}
              </h2>

              <p
                className="mt-2 max-w-sm text-sm leading-6"
                style={mutedText}
              >
                This module is coming soon. We'll connect it to your clinic
                database.
              </p>

              <button
                onClick={() => setActivePage("Overview")}
                className="mt-6 rounded-lg px-5 py-2.5 text-xs font-semibold"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
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
