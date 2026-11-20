
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PAYMENT_METHODS = [
    { value: "cash", label: "Cash" },
    { value: "card", label: "Card" },
    { value: "upi", label: "UPI" },
    { value: "bank_transfer", label: "Bank transfer" },
];

const STATUS_LABELS = {
    unpaid: "Unpaid",
    partially_paid: "Partially paid",
    paid: "Paid",
    cancelled: "Cancelled",
};

const STATUS_STYLES = {
    unpaid: "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
    partially_paid: "border-[var(--info)] bg-[var(--info-soft)] text-[var(--info)]",
    paid: "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]",
    cancelled: "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]",
};

const emptyInvoiceForm = {
    patient_id: "",
    appointment_id: "",
};

const emptyPaymentForm = {
    amount: "",
    payment_method: "upi",
};

const inputClass =
    "w-full rounded-[var(--control-radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)] disabled:opacity-70";

const labelClass =
    "mb-2 block text-sm font-medium text-[var(--foreground)]";

const cardClass =
    "rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6";

const primaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-[var(--control-radius)] bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-[var(--control-radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]";

function money(value) {
    return `₹${Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatDate(value) {
    if (!value) return "—";

    return new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function formatDateTime(value) {
    if (!value) return "—";

    return new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function createInvoiceNumber() {
    const date = new Date();
    const datePart = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("");

    const randomPart =
        typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID().slice(0, 8).toUpperCase()
            : Math.random().toString(36).slice(2, 10).toUpperCase();

    return `INV-${datePart}-${randomPart}`;
}

function newLineItem() {
    return {
        id:
            typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,
        description: "",
        quantity: "1",
        unit_price: "",
    };
}

function SectionHeading({ eyebrow, title, description }) {
    return (
        <div>
            {eyebrow && (
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {eyebrow}
                </p>
            )}
            <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
                {title}
            </h2>
            {description && (
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                    {description}
                </p>
            )}
        </div>
    );
}

function StatusBadge({ status }) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.cancelled
                }`}
        >
            {STATUS_LABELS[status] || status}
        </span>
    );
}

function FeedbackMessage({ type, children }) {
    if (!children) return null;

    const styles =
        type === "success"
            ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
            : "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]";

    return (
        <div
            role="status"
            className={`rounded-[var(--control-radius)] border px-4 py-3 text-sm ${styles}`}
        >
            {children}
        </div>
    );
}

function SummaryCard({ label, value, detail, tone = "default" }) {
    const toneStyles = {
        default: "bg-[var(--surface)]",
        primary: "bg-[var(--primary-soft)]",
        success: "bg-[var(--success-soft)]",
        warning: "bg-[var(--warning-soft)]",
    };

    const valueStyles = {
        default: "text-[var(--foreground)]",
        primary: "text-[var(--primary)]",
        success: "text-[var(--success)]",
        warning: "text-[var(--warning)]",
    };

    return (
        <div
            className={`rounded-[var(--card-radius)] border border-[var(--border)] p-5 ${toneStyles[tone]}`}
        >
            <p className="text-sm font-medium text-[var(--text-secondary)]">
                {label}
            </p>
            <p
                className={`mt-3 text-[clamp(1.4rem,2vw,1.9rem)] font-semibold tracking-tight ${valueStyles[tone]}`}
            >
                {value}
            </p>
            {detail && (
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                    {detail}
                </p>
            )}
        </div>
    );
}

export default function BillingPanel() {
    const supabase = useMemo(() => createClient(), []);

    const [profile, setProfile] = useState(null);
    const [patients, setPatients] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [items, setItems] = useState([]);
    const [payments, setPayments] = useState([]);

    const [loading, setLoading] = useState(true);
    const [savingInvoice, setSavingInvoice] = useState(false);
    const [savingPayment, setSavingPayment] = useState(false);

    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [showPaymentForm, setShowPaymentForm] = useState(false);

    const [invoiceForm, setInvoiceForm] = useState(emptyInvoiceForm);
    const [lineItems, setLineItems] = useState([newLineItem()]);
    const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);

    const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const canManage = ["admin", "receptionist"].includes(profile?.role);

    const loadBilling = useCallback(async () => {
        setLoading(true);
        setError("");

        const { data: authData, error: authError } =
            await supabase.auth.getUser();

        if (authError || !authData.user) {
            setError("Your session has expired. Please log in again.");
            setLoading(false);
            return;
        }

        const { data: currentProfile, error: profileError } =
            await supabase
                .from("profiles")
                .select("clinic_id, role")
                .eq("id", authData.user.id)
                .single();

        if (profileError || !currentProfile?.clinic_id) {
            setError("Unable to load your clinic profile.");
            setLoading(false);
            return;
        }

        setProfile(currentProfile);

        const [
            patientsResult,
            appointmentsResult,
            invoicesResult,
            itemsResult,
            paymentsResult,
        ] = await Promise.all([
            supabase
                .from("patients")
                .select("id, patient_code, full_name, phone")
                .order("full_name", { ascending: true }),

            supabase
                .from("appointments")
                .select("id, patient_id, appointment_at, status")
                .order("appointment_at", { ascending: false }),

            supabase
                .from("invoices")
                .select(
                    "id, clinic_id, patient_id, appointment_id, invoice_number, total_amount, status, created_at"
                )
                .eq("clinic_id", currentProfile.clinic_id)
                .order("created_at", { ascending: false }),

            supabase
                .from("invoice_items")
                .select(
                    "id, invoice_id, description, quantity, unit_price, line_total"
                ),

            supabase
                .from("payments")
                .select("id, invoice_id, amount, payment_method, paid_at")
                .order("paid_at", { ascending: false }),
        ]);

        const queryError =
            patientsResult.error ||
            appointmentsResult.error ||
            invoicesResult.error ||
            itemsResult.error ||
            paymentsResult.error;

        if (queryError) {
            setError(queryError.message);
            setLoading(false);
            return;
        }

        setPatients(patientsResult.data || []);
        setAppointments(appointmentsResult.data || []);
        setInvoices(invoicesResult.data || []);
        setItems(itemsResult.data || []);
        setPayments(paymentsResult.data || []);

        setSelectedInvoiceId((current) => {
            const nextInvoices = invoicesResult.data || [];

            if (current && nextInvoices.some((item) => item.id === current)) {
                return current;
            }

            return nextInvoices[0]?.id || null;
        });

        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        const timer = setTimeout(() => {
            void loadBilling();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadBilling]);

    const selectedInvoice = invoices.find(
        (invoice) => invoice.id === selectedInvoiceId
    );

    const selectedPatient = selectedInvoice
        ? patients.find((patient) => patient.id === selectedInvoice.patient_id)
        : null;

    const selectedItems = selectedInvoice
        ? items.filter((item) => item.invoice_id === selectedInvoice.id)
        : [];

    const selectedPayments = selectedInvoice
        ? payments.filter((payment) => payment.invoice_id === selectedInvoice.id)
        : [];

    const paidAmount = selectedPayments.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0
    );

    const remainingBalance = Math.max(
        0,
        Number(selectedInvoice?.total_amount || 0) - paidAmount
    );

    const activeInvoices = invoices.filter(
        (invoice) => invoice.status !== "cancelled"
    );

    const totalBilled = activeInvoices.reduce(
        (total, invoice) => total + Number(invoice.total_amount || 0),
        0
    );

    const totalCollected = payments.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0
    );

    const totalOutstanding = activeInvoices.reduce((total, invoice) => {
        const invoicePaid = payments
            .filter((payment) => payment.invoice_id === invoice.id)
            .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

        return total + Math.max(0, Number(invoice.total_amount || 0) - invoicePaid);
    }, 0);

    const filteredInvoices = invoices.filter((invoice) => {
        const patient = patients.find(
            (item) => item.id === invoice.patient_id
        );

        const query = search.toLowerCase();

        const matchesSearch =
            invoice.invoice_number?.toLowerCase().includes(query) ||
            patient?.full_name?.toLowerCase().includes(query) ||
            patient?.patient_code?.toLowerCase().includes(query) ||
            patient?.phone?.toLowerCase().includes(query);

        const matchesStatus =
            statusFilter === "all" || invoice.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const invoicePreviewTotal = lineItems.reduce((total, item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price);

        if (
            !Number.isFinite(quantity) ||
            !Number.isFinite(unitPrice) ||
            quantity <= 0 ||
            unitPrice < 0
        ) {
            return total;
        }

        return total + quantity * unitPrice;
    }, 0);

    const patientAppointments = appointments.filter(
        (appointment) =>
            appointment.patient_id === invoiceForm.patient_id
    );

    function updateInvoiceForm(event) {
        const { name, value } = event.target;

        setInvoiceForm((current) => ({
            ...current,
            [name]: value,
            ...(name === "patient_id" ? { appointment_id: "" } : {}),
        }));
    }

    function updateLineItem(id, field, value) {
        setLineItems((current) =>
            current.map((item) =>
                item.id === id ? { ...item, [field]: value } : item
            )
        );
    }

    function addLineItem() {
        setLineItems((current) => [...current, newLineItem()]);
    }

    function removeLineItem(id) {
        setLineItems((current) => {
            if (current.length === 1) return current;

            return current.filter((item) => item.id !== id);
        });
    }

    function openInvoiceForm() {
        setError("");
        setSuccess("");
        setInvoiceForm(emptyInvoiceForm);
        setLineItems([newLineItem()]);
        setShowInvoiceForm(true);
        setShowPaymentForm(false);
    }

    async function createInvoice(event) {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!canManage) {
            setError("You don't have permission to create invoices.");
            return;
        }

        if (!invoiceForm.patient_id) {
            setError("Select a patient.");
            return;
        }

        const selectedPatient = patients.find(
            (patient) => patient.id === invoiceForm.patient_id
        );

        if (!selectedPatient) {
            setError("Select a valid patient.");
            return;
        }

        if (
            invoiceForm.appointment_id &&
            !patientAppointments.some(
                (appointment) => appointment.id === invoiceForm.appointment_id
            )
        ) {
            setError("Select a valid appointment for this patient.");
            return;
        }

        const preparedItems = lineItems.map((item) => ({
            description: item.description.trim(),
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
        }));

        if (
            preparedItems.some(
                (item) =>
                    !item.description ||
                    !Number.isFinite(item.quantity) ||
                    item.quantity <= 0 ||
                    !Number.isFinite(item.unit_price) ||
                    item.unit_price < 0
            )
        ) {
            setError(
                "Complete every line item with a description, positive quantity and valid price."
            );
            return;
        }

        if (preparedItems.length === 0) {
            setError("Add at least one invoice item.");
            return;
        }

        setSavingInvoice(true);

        const { data: authData, error: authError } =
            await supabase.auth.getUser();

        if (authError || !authData.user) {
            setError("Please log in again.");
            setSavingInvoice(false);
            return;
        }

        const { data: currentProfile, error: profileError } =
            await supabase
                .from("profiles")
                .select("clinic_id, role")
                .eq("id", authData.user.id)
                .single();

        if (
            profileError ||
            !currentProfile ||
            currentProfile.clinic_id !== profile?.clinic_id ||
            !["admin", "receptionist"].includes(currentProfile.role)
        ) {
            setError("You don't have permission to create invoices.");
            setSavingInvoice(false);
            return;
        }

        const { data: invoice, error: invoiceError } = await supabase
            .from("invoices")
            .insert({
                clinic_id: currentProfile.clinic_id,
                patient_id: invoiceForm.patient_id,
                appointment_id: invoiceForm.appointment_id || null,
                invoice_number: createInvoiceNumber(),
                total_amount: 0,
                status: "unpaid",
            })
            .select()
            .single();

        if (invoiceError || !invoice) {
            setError(invoiceError?.message || "Unable to create invoice.");
            setSavingInvoice(false);
            return;
        }

        const { error: itemsError } = await supabase
            .from("invoice_items")
            .insert(
                preparedItems.map((item) => ({
                    invoice_id: invoice.id,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                }))
            );

        if (itemsError) {
            await supabase
                .from("invoices")
                .delete()
                .eq("id", invoice.id)
                .eq("clinic_id", currentProfile.clinic_id);

            setError(
                `Invoice items could not be saved: ${itemsError.message}`
            );
            setSavingInvoice(false);
            return;
        }

        setShowInvoiceForm(false);
        setInvoiceForm(emptyInvoiceForm);
        setLineItems([newLineItem()]);
        setSuccess("Invoice created successfully.");

        await loadBilling();

        setSelectedInvoiceId(invoice.id);
        setSavingInvoice(false);
    }

    function openPaymentForm(invoice) {
        setSelectedInvoiceId(invoice.id);
        setPaymentForm(emptyPaymentForm);
        setError("");
        setSuccess("");
        setShowPaymentForm(true);
        setShowInvoiceForm(false);
    }

    async function recordPayment(event) {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!canManage) {
            setError("You don't have permission to record payments.");
            return;
        }

        if (!selectedInvoice) {
            setError("Select an invoice.");
            return;
        }

        const amount = Number(paymentForm.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            setError("Enter a valid payment amount greater than zero.");
            return;
        }

        if (amount > remainingBalance + 0.000001) {
            setError(
                `Payment exceeds the remaining balance of ${money(remainingBalance)}.`
            );
            return;
        }

        if (
            !PAYMENT_METHODS.some(
                (method) => method.value === paymentForm.payment_method
            )
        ) {
            setError("Select a valid payment method.");
            return;
        }

        setSavingPayment(true);

        const { data: authData, error: authError } =
            await supabase.auth.getUser();

        if (authError || !authData.user) {
            setError("Please log in again.");
            setSavingPayment(false);
            return;
        }

        const { data: currentProfile, error: profileError } =
            await supabase
                .from("profiles")
                .select("clinic_id, role")
                .eq("id", authData.user.id)
                .single();

        if (
            profileError ||
            !currentProfile ||
            currentProfile.clinic_id !== profile?.clinic_id ||
            !["admin", "receptionist"].includes(currentProfile.role)
        ) {
            setError("You don't have permission to record payments.");
            setSavingPayment(false);
            return;
        }

        const { error: paymentError } = await supabase
            .from("payments")
            .insert({
                invoice_id: selectedInvoice.id,
                amount,
                payment_method: paymentForm.payment_method,
            });

        if (paymentError) {
            setError(paymentError.message);
            setSavingPayment(false);
            return;
        }

        setPaymentForm(emptyPaymentForm);
        setShowPaymentForm(false);
        setSuccess("Payment recorded successfully.");

        await loadBilling();
        setSavingPayment(false);
    }

    async function cancelInvoice(invoice) {
        if (!canManage) return;

        const invoicePaid = payments
            .filter((payment) => payment.invoice_id === invoice.id)
            .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

        if (invoicePaid > 0) {
            setError(
                "An invoice with recorded payments cannot be cancelled."
            );
            return;
        }

        const confirmed = window.confirm(
            `Cancel invoice ${invoice.invoice_number}? This cannot be undone from the billing screen.`
        );

        if (!confirmed) return;

        setError("");
        setSuccess("");

        const { data: authData } = await supabase.auth.getUser();

        if (!authData.user) {
            setError("Please log in again.");
            return;
        }

        const { data: currentProfile } = await supabase
            .from("profiles")
            .select("clinic_id, role")
            .eq("id", authData.user.id)
            .single();

        if (
            currentProfile?.clinic_id !== profile?.clinic_id ||
            !["admin", "receptionist"].includes(currentProfile?.role)
        ) {
            setError("You don't have permission to cancel invoices.");
            return;
        }

        const { error: updateError } = await supabase
            .from("invoices")
            .update({ status: "cancelled" })
            .eq("id", invoice.id)
            .eq("clinic_id", currentProfile.clinic_id)
            .eq("status", "unpaid");

        if (updateError) {
            setError(updateError.message);
            return;
        }

        setSuccess("Invoice cancelled.");
        await loadBilling();
    }

    function printInvoice() {
        window.print();
    }

    return (
        <div className="space-y-7">
            {/* Page heading */}
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
                        Financial management
                    </p>
                    <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[32px]">
                        Billing & payments
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
                        Manage invoices, record payments and keep track of outstanding balances.
                    </p>
                </div>

                {canManage && (
                    <button
                        onClick={openInvoiceForm}
                        disabled={loading || patients.length === 0}
                        className={primaryButtonClass}
                    >
                        <span className="text-lg leading-none">+</span>
                        Create invoice
                    </button>
                )}
            </div>

            {/* Feedback */}
            <div className="space-y-3">
                <FeedbackMessage type="error">{error}</FeedbackMessage>
                <FeedbackMessage type="success">{success}</FeedbackMessage>
            </div>

            {/* Financial overview */}
            <section>
                <div className="mb-4">
                    <SectionHeading
                        eyebrow="Overview"
                        title="Financial summary"
                        description="A snapshot of your clinic's billing activity."
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        label="Total invoices"
                        value={invoices.length.toLocaleString("en-IN")}
                        detail="All invoice records"
                    />
                    <SummaryCard
                        label="Total billed"
                        value={money(totalBilled)}
                        detail="Excluding cancelled invoices"
                        tone="primary"
                    />
                    <SummaryCard
                        label="Collected"
                        value={money(totalCollected)}
                        detail="Payments recorded"
                        tone="success"
                    />
                    <SummaryCard
                        label="Outstanding"
                        value={money(totalOutstanding)}
                        detail="Remaining amount due"
                        tone="warning"
                    />
                </div>
            </section>

            {/* Invoice creation */}
            {showInvoiceForm && (
                <section className={`${cardClass} space-y-6`}>
                    <div className="flex items-start justify-between gap-4">
                        <SectionHeading
                            eyebrow="New billing record"
                            title="Create invoice"
                            description="Choose a patient and add the services or charges being billed."
                        />
                        <button
                            type="button"
                            onClick={() => setShowInvoiceForm(false)}
                            className={secondaryButtonClass}
                        >
                            Close
                        </button>
                    </div>

                    <form onSubmit={createInvoice} className="space-y-7">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <label className={labelClass}>Patient *</label>
                                <select
                                    required
                                    name="patient_id"
                                    value={invoiceForm.patient_id}
                                    onChange={updateInvoiceForm}
                                    className={inputClass}
                                >
                                    <option value="">Select patient</option>
                                    {patients.map((patient) => (
                                        <option key={patient.id} value={patient.id}>
                                            {patient.full_name}
                                            {patient.patient_code
                                                ? ` — ${patient.patient_code}`
                                                : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className={labelClass}>
                                    Link appointment
                                </label>
                                <select
                                    name="appointment_id"
                                    value={invoiceForm.appointment_id}
                                    onChange={updateInvoiceForm}
                                    disabled={!invoiceForm.patient_id}
                                    className={inputClass}
                                >
                                    <option value="">No appointment linked</option>
                                    {patientAppointments.map((appointment) => (
                                        <option key={appointment.id} value={appointment.id}>
                                            {formatDateTime(appointment.appointment_at)}
                                            {" — "}
                                            {appointment.status}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="border-t border-[var(--border)] pt-6">
                            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                <SectionHeading
                                    title="Invoice items"
                                    description="Add consultation fees, procedures, medicines or other charges."
                                />
                                <button
                                    type="button"
                                    onClick={addLineItem}
                                    className={secondaryButtonClass}
                                >
                                    <span className="text-base leading-none">+</span>
                                    Add item
                                </button>
                            </div>

                            <div className="space-y-3">
                                {lineItems.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="grid gap-4 rounded-[var(--control-radius)] border border-[var(--border)] bg-[var(--surface-subtle)] p-4 sm:grid-cols-[minmax(0,2fr)_110px_140px_40px] sm:items-end"
                                    >
                                        <div>
                                            <label className={labelClass}>
                                                Description {index + 1}
                                            </label>
                                            <input
                                                required
                                                value={item.description}
                                                onChange={(event) =>
                                                    updateLineItem(
                                                        item.id,
                                                        "description",
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="e.g. General consultation"
                                                className={inputClass}
                                            />
                                        </div>

                                        <div>
                                            <label className={labelClass}>Quantity</label>
                                            <input
                                                required
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={item.quantity}
                                                onChange={(event) =>
                                                    updateLineItem(
                                                        item.id,
                                                        "quantity",
                                                        event.target.value
                                                    )
                                                }
                                                className={inputClass}
                                            />
                                        </div>

                                        <div>
                                            <label className={labelClass}>
                                                Unit price (₹)
                                            </label>
                                            <input
                                                required
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.unit_price}
                                                onChange={(event) =>
                                                    updateLineItem(
                                                        item.id,
                                                        "unit_price",
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="0.00"
                                                className={inputClass}
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => removeLineItem(item.id)}
                                            disabled={lineItems.length === 1}
                                            aria-label={`Remove item ${index + 1}`}
                                            className="flex h-11 items-center justify-center rounded-[var(--control-radius)] text-xl text-[var(--danger)] transition hover:bg-[var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-30"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-5 flex justify-end">
                                <div className="w-full rounded-[var(--control-radius)] bg-[var(--surface-subtle)] p-5 sm:max-w-xs">
                                    <p className="text-sm text-[var(--text-secondary)]">
                                        Estimated total
                                    </p>
                                    <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                                        {money(invoicePreviewTotal)}
                                    </p>
                                    <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                                        Final total is calculated and stored by the database.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-5">
                            <button
                                type="submit"
                                disabled={savingInvoice || !canManage}
                                className={primaryButtonClass}
                            >
                                {savingInvoice ? "Creating invoice..." : "Create invoice"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowInvoiceForm(false)}
                                className={secondaryButtonClass}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* Payment form */}
            {showPaymentForm && selectedInvoice && (
                <section className={`${cardClass} space-y-6`}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--success)]">
                                Record payment
                            </p>
                            <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
                                {selectedInvoice.invoice_number}
                            </h2>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">
                                Remaining balance:{" "}
                                <span className="font-semibold text-[var(--foreground)]">
                                    {money(remainingBalance)}
                                </span>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowPaymentForm(false)}
                            className={secondaryButtonClass}
                        >
                            Close
                        </button>
                    </div>

                    <form onSubmit={recordPayment} className="space-y-6">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <label className={labelClass}>
                                    Amount received (₹) *
                                </label>
                                <input
                                    required
                                    type="number"
                                    min="0.01"
                                    max={remainingBalance}
                                    step="0.01"
                                    value={paymentForm.amount}
                                    onChange={(event) =>
                                        setPaymentForm((current) => ({
                                            ...current,
                                            amount: event.target.value,
                                        }))
                                    }
                                    placeholder="Enter amount"
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>
                                    Payment method *
                                </label>
                                <select
                                    required
                                    value={paymentForm.payment_method}
                                    onChange={(event) =>
                                        setPaymentForm((current) => ({
                                            ...current,
                                            payment_method: event.target.value,
                                        }))
                                    }
                                    className={inputClass}
                                >
                                    {PAYMENT_METHODS.map((method) => (
                                        <option key={method.value} value={method.value}>
                                            {method.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-5">
                            <button
                                type="submit"
                                disabled={savingPayment || remainingBalance <= 0}
                                className={primaryButtonClass}
                            >
                                {savingPayment ? "Recording..." : "Record payment"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowPaymentForm(false)}
                                className={secondaryButtonClass}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* Invoice register */}
            <section className={cardClass}>
                <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                    <SectionHeading
                        eyebrow="Billing records"
                        title="Invoice register"
                        description={`${filteredInvoices.length} invoices found`}
                    />

                    <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[460px]">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search invoice or patient..."
                            aria-label="Search invoices"
                            className={inputClass}
                        />
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            aria-label="Filter invoices by status"
                            className={inputClass}
                        >
                            <option value="all">All statuses</option>
                            <option value="unpaid">Unpaid</option>
                            <option value="partially_paid">Partially paid</option>
                            <option value="paid">Paid</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="py-14 text-center">
                        <p className="text-sm text-[var(--text-secondary)]">
                            Loading billing records...
                        </p>
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="rounded-[var(--control-radius)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-5 py-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-xl font-semibold text-[var(--text-muted)]">
                            ₹
                        </div>
                        <h3 className="mt-4 font-semibold text-[var(--foreground)]">
                            No invoices found
                        </h3>
                        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                            Create an invoice to start tracking clinic billing.
                        </p>
                        {canManage && patients.length > 0 && (
                            <button
                                onClick={openInvoiceForm}
                                className="mt-4 text-sm font-semibold text-[var(--primary)] transition hover:opacity-80"
                            >
                                + Create first invoice
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left">
                            <thead>
                                <tr className="border-b border-[var(--border)] text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                                    <th className="px-3 py-4">Invoice</th>
                                    <th className="px-3 py-4">Patient</th>
                                    <th className="px-3 py-4">Date</th>
                                    <th className="px-3 py-4">Total</th>
                                    <th className="px-3 py-4">Balance</th>
                                    <th className="px-3 py-4">Status</th>
                                    <th className="px-3 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.map((invoice) => {
                                    const patient = patients.find(
                                        (item) => item.id === invoice.patient_id
                                    );

                                    const invoicePaid = payments
                                        .filter((payment) => payment.invoice_id === invoice.id)
                                        .reduce(
                                            (sum, payment) => sum + Number(payment.amount || 0),
                                            0
                                        );

                                    const balance = Math.max(
                                        0,
                                        Number(invoice.total_amount || 0) - invoicePaid
                                    );

                                    const isSelected = selectedInvoiceId === invoice.id;

                                    return (
                                        <tr
                                            key={invoice.id}
                                            className={`border-b border-[var(--border)] last:border-0 transition ${isSelected
                                                ? "bg-[var(--primary-soft)]"
                                                : "hover:bg-[var(--surface-hover)]"
                                                }`}
                                        >
                                            <td className="px-3 py-4">
                                                <p className="text-sm font-semibold text-[var(--foreground)]">
                                                    {invoice.invoice_number}
                                                </p>
                                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                    {items.filter(
                                                        (item) => item.invoice_id === invoice.id
                                                    ).length}{" "}
                                                    items
                                                </p>
                                            </td>
                                            <td className="px-3 py-4">
                                                <p className="text-sm font-medium text-[var(--foreground)]">
                                                    {patient?.full_name || "Unknown patient"}
                                                </p>
                                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                    {patient?.patient_code || patient?.phone || "—"}
                                                </p>
                                            </td>
                                            <td className="px-3 py-4 text-sm text-[var(--text-secondary)]">
                                                {formatDate(invoice.created_at)}
                                            </td>
                                            <td className="px-3 py-4 text-sm font-semibold text-[var(--foreground)]">
                                                {money(invoice.total_amount)}
                                            </td>
                                            <td className="px-3 py-4 text-sm font-medium text-[var(--foreground)]">
                                                {invoice.status === "cancelled"
                                                    ? "—"
                                                    : money(balance)}
                                            </td>
                                            <td className="px-3 py-4">
                                                <StatusBadge status={invoice.status} />
                                            </td>
                                            <td className="px-3 py-4">
                                                <div className="flex justify-end gap-3 text-sm">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedInvoiceId(invoice.id);
                                                            setShowPaymentForm(false);
                                                            setShowInvoiceForm(false);
                                                        }}
                                                        className="font-medium text-[var(--primary)] transition hover:opacity-75"
                                                    >
                                                        View
                                                    </button>

                                                    {canManage &&
                                                        invoice.status !== "paid" &&
                                                        invoice.status !== "cancelled" && (
                                                            <button
                                                                onClick={() => openPaymentForm(invoice)}
                                                                className="font-medium text-[var(--success)] transition hover:opacity-75"
                                                            >
                                                                Pay
                                                            </button>
                                                        )}

                                                    {canManage &&
                                                        invoice.status === "unpaid" &&
                                                        invoicePaid === 0 && (
                                                            <button
                                                                onClick={() => cancelInvoice(invoice)}
                                                                className="font-medium text-[var(--danger)] transition hover:opacity-75"
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Selected invoice details */}
            {selectedInvoice && (
                <section className={`${cardClass} space-y-6`}>
                    <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-start">
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                Invoice details
                            </p>
                            <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                                {selectedInvoice.invoice_number}
                            </h2>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">
                                Created {formatDate(selectedInvoice.created_at)}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={printInvoice}
                                className={secondaryButtonClass}
                            >
                                Print invoice
                            </button>

                            {canManage &&
                                selectedInvoice.status !== "paid" &&
                                selectedInvoice.status !== "cancelled" && (
                                    <button
                                        onClick={() => openPaymentForm(selectedInvoice)}
                                        className={primaryButtonClass}
                                    >
                                        + Record payment
                                    </button>
                                )}
                        </div>
                    </div>

                    {/* Patient and invoice information */}
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                Billed to
                            </p>
                            <p className="mt-3 font-semibold text-[var(--foreground)]">
                                {selectedPatient?.full_name || "Unknown patient"}
                            </p>
                            {selectedPatient?.patient_code && (
                                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                    {selectedPatient.patient_code}
                                </p>
                            )}
                            {selectedPatient?.phone && (
                                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                    {selectedPatient.phone}
                                </p>
                            )}
                        </div>

                        <div className="sm:text-right">
                            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                Invoice status
                            </p>
                            <div className="mt-3 sm:flex sm:justify-end">
                                <StatusBadge status={selectedInvoice.status} />
                            </div>
                            <p className="mt-3 text-sm text-[var(--text-secondary)]">
                                Linked appointment:{" "}
                                {selectedInvoice.appointment_id
                                    ? formatDate(
                                        appointments.find(
                                            (appointment) =>
                                                appointment.id === selectedInvoice.appointment_id
                                        )?.appointment_at
                                    )
                                    : "None"}
                            </p>
                        </div>
                    </div>

                    {/* Invoice line items */}
                    <div className="border-t border-[var(--border)] pt-6">
                        <SectionHeading
                            title="Charges"
                            description="Services and items included in this invoice."
                        />

                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full min-w-[520px] text-left">
                                <thead>
                                    <tr className="border-b border-[var(--border)] text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                                        <th className="py-3">Description</th>
                                        <th className="px-3 py-3 text-right">Qty</th>
                                        <th className="px-3 py-3 text-right">Unit price</th>
                                        <th className="py-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedItems.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="border-b border-[var(--border)] last:border-0"
                                        >
                                            <td className="py-4 text-sm font-medium text-[var(--foreground)]">
                                                {item.description}
                                            </td>
                                            <td className="px-3 py-4 text-right text-sm text-[var(--text-secondary)]">
                                                {Number(item.quantity).toLocaleString("en-IN")}
                                            </td>
                                            <td className="px-3 py-4 text-right text-sm text-[var(--text-secondary)]">
                                                {money(item.unit_price)}
                                            </td>
                                            <td className="py-4 text-right text-sm font-semibold text-[var(--foreground)]">
                                                {money(item.line_total)}
                                            </td>
                                        </tr>
                                    ))}

                                    {selectedItems.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="py-7 text-center text-sm text-[var(--text-secondary)]"
                                            >
                                                No line items are available for this invoice.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="ml-auto mt-5 w-full max-w-sm space-y-3 border-t border-[var(--border)] pt-5">
                            <div className="flex justify-between gap-4 text-sm">
                                <span className="text-[var(--text-secondary)]">
                                    Total billed
                                </span>
                                <span className="font-semibold text-[var(--foreground)]">
                                    {money(selectedInvoice.total_amount)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4 text-sm">
                                <span className="text-[var(--text-secondary)]">
                                    Amount paid
                                </span>
                                <span className="font-semibold text-[var(--success)]">
                                    {money(paidAmount)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-3">
                                <span className="font-semibold text-[var(--foreground)]">
                                    Outstanding
                                </span>
                                <span className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
                                    {money(
                                        selectedInvoice.status === "cancelled"
                                            ? 0
                                            : remainingBalance
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Payment history */}
                    <div className="border-t border-[var(--border)] pt-6">
                        <SectionHeading
                            title="Payment history"
                            description={`${selectedPayments.length} payment records`}
                        />

                        {selectedPayments.length === 0 ? (
                            <div className="mt-4 rounded-[var(--control-radius)] bg-[var(--surface-subtle)] p-6 text-center text-sm text-[var(--text-secondary)]">
                                No payments have been recorded for this invoice.
                            </div>
                        ) : (
                            <div className="mt-4 divide-y divide-[var(--border)]">
                                {selectedPayments.map((payment) => (
                                    <div
                                        key={payment.id}
                                        className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                                    >
                                        <div>
                                            <p className="font-semibold text-[var(--foreground)]">
                                                {money(payment.amount)}
                                            </p>
                                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                {formatDateTime(payment.paid_at)}
                                            </p>
                                        </div>

                                        <span className="w-fit rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                                            {PAYMENT_METHODS.find(
                                                (method) =>
                                                    method.value === payment.payment_method
                                            )?.label || payment.payment_method}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {!loading && patients.length === 0 && (
                <div className="rounded-[var(--control-radius)] border border-[var(--warning)] bg-[var(--warning-soft)] p-5 text-sm text-[var(--warning)]">
                    Register at least one patient before creating an invoice.
                </div>
            )}
        </div>
    );
}
