"use client";

import { useState } from "react";

const pageAccess = {
  Admin: ["Overview", "Patients", "Appointments", "Doctors", "Billing", "Reports", "Settings"],
  Receptionist: ["Overview", "Patients", "Appointments", "Doctors", "Billing"],
  Doctor: ["Overview", "Patients", "Appointments"],
};

const navigation = [
  ["Overview", "⌂"],
  ["Patients", "♙"],
  ["Appointments", "▦"],
  ["Doctors", "✚"],
  ["Billing", "₹"],
  ["Reports", "▥"],
  ["Settings", "⚙"],
];

const patients = [
  ["Sample patient 01", "DEMO-001", "General consultation", "Active"],
  ["Sample patient 02", "DEMO-002", "Follow-up visit", "Active"],
  ["Sample patient 03", "DEMO-003", "Routine check-up", "Active"],
  ["Sample patient 04", "DEMO-004", "Consultation", "Active"],
];

const appointments = [
  ["09:00", "Sample patient 01", "General consultation", "Scheduled"],
  ["10:30", "Sample patient 02", "Follow-up visit", "Confirmed"],
  ["12:00", "Sample patient 03", "Routine check-up", "Scheduled"],
  ["14:30", "Sample patient 04", "Consultation", "Confirmed"],
];

const doctors = [
  ["Dr. Example A", "General Medicine", "Available"],
  ["Dr. Example B", "Pediatrics", "In clinic"],
  ["Dr. Example C", "Cardiology", "Available"],
  ["Dr. Example D", "Dermatology", "In clinic"],
];

const cardClass = "rounded-3xl border border-slate-200 bg-white shadow-[0_3px_12px_rgba(32,42,53,0.045)]";

function Metric({ title, value, detail, symbol, tint }) {
  return (
    <article className={`${cardClass} p-6 sm:p-7`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <span className={`grid h-10 w-10 place-items-center rounded-full text-lg ${tint}`}>{symbol}</span>
      </div>
      <p className="mt-7 text-4xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{detail}</p>
    </article>
  );
}

function Table({ headers, rows }) {
  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <tr>{headers.map((header) => <th key={header} className="px-5 py-4">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) => (
                  <td key={`${row[0]}-${index}`} className={`px-5 py-4 ${index === 0 ? "font-medium text-slate-800" : ""}`}>
                    {index === row.length - 1 ? (
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{cell}</span>
                    ) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PublicDemo() {
  const [activePage, setActivePage] = useState("Overview");
  const [role, setRole] = useState("Admin");
  const allowedPages = pageAccess[role];

  function previewRole(nextRole) {
    setRole(nextRole);
    if (!pageAccess[nextRole].includes(activePage)) setActivePage("Overview");
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-800 lg:flex">
      <aside className="flex w-full flex-col border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#4779b8] text-lg font-bold text-white">N</span>
          <div><p className="font-semibold tracking-tight">Nova Demo Clinic</p><p className="mt-0.5 text-[10px] font-semibold tracking-[0.15em] text-slate-400">MANAGEMENT OS</p></div>
        </div>
        <p className="px-6 pb-2 pt-6 text-[10px] font-semibold tracking-[0.16em] text-slate-400">WORKSPACE</p>
        <nav aria-label="Demo workspace" className="flex gap-1 overflow-x-auto px-3 pb-4 lg:block lg:overflow-visible">
          {navigation.filter(([name]) => allowedPages.includes(name)).map(([name, symbol]) => (
            <button
              key={name}
              type="button"
              aria-current={activePage === name ? "page" : undefined}
              onClick={() => setActivePage(name)}
              className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors lg:mb-1 lg:w-full ${activePage === name ? "bg-[#edf3f9] font-medium text-[#4779b8]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-sm">{symbol}</span>{name}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-slate-100 p-5 text-xs text-slate-400 lg:block">Public read-only preview</div>
      </aside>

      <section className="min-w-0 flex-1 lg:ml-64">
        <header className="flex min-h-[76px] items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 sm:px-8">
          <div><p className="font-semibold">{activePage}</p><p className="mt-1 text-xs text-slate-400">Nova Clinic OS / {activePage}</p></div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right sm:block"><span className="block text-xs font-semibold">Public demo</span><span className="block text-[10px] text-slate-400">Read-only sample workspace</span></span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#eaf1fa] font-semibold text-[#6385b7]">N</span>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] p-5 sm:p-8 xl:p-10">
          <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-[0.17em] text-[#5f83b5]">PUBLIC PRODUCT TOUR</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{activePage === "Overview" ? "Good to see you, Nova." : activePage}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{activePage === "Overview" ? "Explore a clinic workspace designed to keep daily operations connected." : `Explore the ${activePage.toLowerCase()} workspace using sample information.`}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2">
              <span className="px-2 text-[10px] font-semibold tracking-[0.12em] text-slate-400">PREVIEW AS</span>
              {["Admin", "Receptionist", "Doctor"].map((item) => (
                <button key={item} type="button" aria-pressed={role === item} onClick={() => previewRole(item)} className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${role === item ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div role="note" className="mb-7 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900 sm:items-center">
            <span aria-hidden="true" className="mt-0.5 font-bold sm:mt-0">i</span>
            <p><strong>Shared demo workspace.</strong> Everyone sees the same illustrative sample data. This tour is read-only; changes are not saved and no clinic records are connected.</p>
          </div>

          {activePage === "Overview" && (
            <>
              <div className="mb-5"><h2 className="font-semibold text-slate-800">Clinic at a glance</h2><p className="mt-1 text-xs text-slate-400">An overview of the demo clinic workspace.</p></div>
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                <Metric title="Total patients" value="12" detail="Sample patient records" symbol="♙" tint="bg-blue-50 text-blue-600" />
                <Metric title="Appointments" value="15" detail="Sample appointment records" symbol="▦" tint="bg-cyan-50 text-cyan-700" />
                <Metric title="Doctors" value="4" detail="Demo provider profiles" symbol="✚" tint="bg-violet-50 text-violet-600" />
                <Metric title="Payment records" value="5" detail="Illustrative entries" symbol="₹" tint="bg-amber-50 text-amber-700" />
              </div>
              <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
                <section className={`${cardClass} p-6 sm:p-7`}>
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[0.15em] text-[#5f83b5]">CLINIC SCHEDULING</p><h2 className="mt-3 text-xl font-semibold text-slate-800">Keep every visit on track.</h2><p className="mt-2 text-sm text-slate-500">Explore how the schedule and clinic teams fit together.</p></div><span className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-lg text-blue-700">▦</span></div>
                  <button type="button" onClick={() => setActivePage("Appointments")} className="mt-6 rounded-xl bg-slate-800 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700">Explore appointments →</button>
                </section>
                <section className={`${cardClass} p-6 sm:p-7`}><h2 className="font-semibold">Your workspace</h2><p className="mt-1 text-xs text-slate-400">Everyday clinic modules in one place.</p><div className="mt-5 space-y-4">{[["♙", "Patient management", "Organize sample records"], ["▦", "Appointment planning", "Review daily schedules"], ["₹", "Billing management", "Explore payment workflows"]].map(([symbol, title, text]) => <div key={title} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-blue-700">{symbol}</span><span><span className="block text-sm font-medium">{title}</span><span className="mt-0.5 block text-xs text-slate-400">{text}</span></span></div>)}</div></section>
              </div>
            </>
          )}

          {activePage === "Patients" && <><div className="mb-5"><h2 className="font-semibold">Patient directory</h2><p className="mt-1 text-xs text-slate-400">An anonymized view of the patient workspace.</p></div><Table headers={["Patient", "Record code", "Visit type", "Status"]} rows={patients} /></>}
          {activePage === "Appointments" && <><div className="mb-5"><h2 className="font-semibold">Appointment directory</h2><p className="mt-1 text-xs text-slate-400">A sample day in the clinic schedule.</p></div><Table headers={["Time", "Patient", "Visit type", "Status"]} rows={appointments} /></>}
          {activePage === "Doctors" && <><div className="mb-5"><h2 className="font-semibold">Care team</h2><p className="mt-1 text-xs text-slate-400">Fictional provider profiles for product preview.</p></div><Table headers={["Provider", "Department", "Availability"]} rows={doctors} /></>}
          {activePage === "Billing" && <div className={`${cardClass} p-7 sm:p-9`}><p className="text-[10px] font-bold tracking-[0.15em] text-[#5f83b5]">BILLING WORKSPACE</p><h2 className="mt-3 text-2xl font-semibold">A clear view of clinic payments.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Explore a sample billing overview and see how payment records fit into clinic operations.</p><div className="mt-7 grid gap-4 sm:grid-cols-3">{[["Sample invoices", "08"], ["Payments recorded", "05"], ["Outstanding items", "03"]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-5"><p className="text-xs text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></div>)}</div></div>}
          {activePage === "Reports" && <div className={`${cardClass} p-7 sm:p-9`}><p className="text-[10px] font-bold tracking-[0.15em] text-[#5f83b5]">CLINIC REPORTS</p><h2 className="mt-3 text-2xl font-semibold">A simple operations snapshot.</h2><p className="mt-2 text-sm leading-6 text-slate-500">Review illustrative totals for the public demo workspace.</p><div className="mt-7 grid gap-4 sm:grid-cols-3">{[["Patient records", "12"], ["Scheduled visits", "15"], ["Active providers", "04"]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-5"><p className="text-xs text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></div>)}</div></div>}
          {activePage === "Settings" && <div className={`${cardClass} p-7 sm:p-9`}><p className="text-[10px] font-bold tracking-[0.15em] text-[#5f83b5]">DEMO SETTINGS</p><h2 className="mt-3 text-2xl font-semibold">Clinic configuration preview.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Settings are shown for context. This public tour does not expose or save account settings.</p><div className="mt-7 space-y-3">{["Clinic profile", "Team access", "Notifications", "Workspace preferences"].map((item) => <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-4 text-sm"><span>{item}</span><span className="text-xs text-slate-400">Preview only</span></div>)}</div></div>}
        </div>
      </section>
    </main>
  );
}
