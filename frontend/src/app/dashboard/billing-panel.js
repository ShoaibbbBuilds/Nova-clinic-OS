
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
    unpaid: "bg-amber-50 text-amber-700",
    partially_paid: "bg-blue-50 text-blue-700",
    paid: "bg-teal-50 text-teal-700",
    cancelled: "bg-red-50 text-red-700",
};

const emptyInvoiceForm = {
    patient_id: "",
    appointment_id: "",
};

const emptyPaymentForm = {
    amount: "",
    payment_method: "upi",
};

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
            // Remove the empty invoice if its line items could not be saved.
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
            {/* Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <p className="text-sm font-medium text-blue-600">
                        Financial management
                    </p>

                    <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
                        Billing & payments
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        Create invoices, record payments and track outstanding balances.
                    </p>
                </div>

                {canManage && (
                    <button
                        onClick={openInvoiceForm}
                        disabled={loading || patients.length === 0}
                        className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        + Create invoice
                    </button>
                )}
            </div>

            {/* Feedback */}
            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {success && (
                <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
                    {success}
                </div>
            )}

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                    <p className="text-sm text-blue-700">Total invoices</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">
                        {invoices.length}
                    </p>
                </div>

                <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-5">
                    <p className="text-sm text-purple-700">Total billed</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {money(totalBilled)}
                    </p>
                </div>

                <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5">
                    <p className="text-sm text-teal-700">Collected</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {money(totalCollected)}
                    </p>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
                    <p className="text-sm text-amber-700">Outstanding</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {money(totalOutstanding)}
                    </p>
                </div>
            </div>

            {/* Invoice creation */}
            {showInvoiceForm && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900">
                                Create invoice
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Add a patient and the services or charges being billed.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowInvoiceForm(false)}
                            className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
                        >
                            Close
                        </button>
                    </div>

                    <form onSubmit={createInvoice} className="space-y-6">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Patient *
                                </label>

                                <select
                                    required
                                    name="patient_id"
                                    value={invoiceForm.patient_id}
                                    onChange={updateInvoiceForm}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Link appointment
                                </label>

                                <select
                                    name="appointment_id"
                                    value={invoiceForm.appointment_id}
                                    onChange={updateInvoiceForm}
                                    disabled={!invoiceForm.patient_id}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
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

                        {/* Line items */}
                        <div className="border-t border-slate-100 pt-6">
                            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                <div>
                                    <h3 className="font-semibold text-slate-900">
                                        Invoice items
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Add consultation fees, procedures, medicines or other charges.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={addLineItem}
                                    className="w-fit rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                                >
                                    + Add item
                                </button>
                            </div>

                            <div className="space-y-3">
                                {lineItems.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[minmax(0,2fr)_110px_140px_40px] sm:items-end"
                                    >
                                        <div>
                                            <label className="mb-2 block text-xs font-medium text-slate-600">
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
                                                className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-medium text-slate-600">
                                                Quantity
                                            </label>

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
                                                className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-medium text-slate-600">
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
                                                className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => removeLineItem(item.id)}
                                            disabled={lineItems.length === 1}
                                            aria-label={`Remove item ${index + 1}`}
                                            className="h-10 rounded-lg text-lg text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-5 flex flex-col items-end border-t border-slate-100 pt-5">
                                <p className="text-sm text-slate-500">Estimated total</p>
                                <p className="mt-1 text-3xl font-semibold text-slate-900">
                                    {money(invoicePreviewTotal)}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    Final total is calculated and stored by the database.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                            <button
                                type="submit"
                                disabled={savingInvoice || !canManage}
                                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                            >
                                {savingInvoice ? "Creating invoice..." : "Create invoice"}
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowInvoiceForm(false)}
                                className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* Payment form */}
            {showPaymentForm && selectedInvoice && (
                <section className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-teal-700">
                                Record payment
                            </p>

                            <h2 className="mt-1 text-xl font-semibold text-slate-900">
                                {selectedInvoice.invoice_number}
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Remaining balance: {money(remainingBalance)}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowPaymentForm(false)}
                            className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
                        >
                            Close
                        </button>
                    </div>

                    <form onSubmit={recordPayment} className="space-y-5">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
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
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
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
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                                >
                                    {PAYMENT_METHODS.map((method) => (
                                        <option key={method.value} value={method.value}>
                                            {method.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                            <button
                                type="submit"
                                disabled={savingPayment || remainingBalance <= 0}
                                className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
                            >
                                {savingPayment ? "Recording..." : "Record payment"}
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowPaymentForm(false)}
                                className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* Invoice list */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                            Invoice register
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {filteredInvoices.length} invoices found
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search invoice or patient..."
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                        />

                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
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
                    <div className="py-12 text-center text-sm text-slate-500">
                        Loading billing records...
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 px-5 py-12 text-center">
                        <div className="text-3xl">₹</div>
                        <h3 className="mt-3 font-semibold text-slate-800">
                            No invoices found
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Create an invoice to start tracking clinic billing.
                        </p>

                        {canManage && patients.length > 0 && (
                            <button
                                onClick={openInvoiceForm}
                                className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
                            >
                                + Create first invoice
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left">
                            <thead>
                                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                                    <th className="px-3 py-4 font-medium">Invoice</th>
                                    <th className="px-3 py-4 font-medium">Patient</th>
                                    <th className="px-3 py-4 font-medium">Date</th>
                                    <th className="px-3 py-4 font-medium">Total</th>
                                    <th className="px-3 py-4 font-medium">Balance</th>
                                    <th className="px-3 py-4 font-medium">Status</th>
                                    <th className="px-3 py-4 text-right font-medium">Action</th>
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
                                            className={`border-b border-slate-50 last:border-0 ${isSelected ? "bg-blue-50/50" : "hover:bg-slate-50/70"
                                                }`}
                                        >
                                            <td className="px-3 py-4">
                                                <p className="font-semibold text-slate-800">
                                                    {invoice.invoice_number}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-400">
                                                    {items.filter(
                                                        (item) => item.invoice_id === invoice.id
                                                    ).length}{" "}
                                                    items
                                                </p>
                                            </td>

                                            <td className="px-3 py-4">
                                                <p className="text-sm font-medium text-slate-800">
                                                    {patient?.full_name || "Unknown patient"}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-400">
                                                    {patient?.patient_code || patient?.phone || "—"}
                                                </p>
                                            </td>

                                            <td className="px-3 py-4 text-sm text-slate-600">
                                                {formatDate(invoice.created_at)}
                                            </td>

                                            <td className="px-3 py-4 text-sm font-semibold text-slate-800">
                                                {money(invoice.total_amount)}
                                            </td>

                                            <td className="px-3 py-4 text-sm font-medium text-slate-700">
                                                {invoice.status === "cancelled"
                                                    ? "—"
                                                    : money(balance)}
                                            </td>

                                            <td className="px-3 py-4">
                                                <span
                                                    className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[invoice.status] ||
                                                        "bg-slate-100 text-slate-600"
                                                        }`}
                                                >
                                                    {STATUS_LABELS[invoice.status] || invoice.status}
                                                </span>
                                            </td>

                                            <td className="px-3 py-4">
                                                <div className="flex justify-end gap-3 text-sm">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedInvoiceId(invoice.id);
                                                            setShowPaymentForm(false);
                                                            setShowInvoiceForm(false);
                                                        }}
                                                        className="font-medium text-blue-600 hover:text-blue-800"
                                                    >
                                                        View
                                                    </button>

                                                    {canManage &&
                                                        invoice.status !== "paid" &&
                                                        invoice.status !== "cancelled" && (
                                                            <button
                                                                onClick={() => openPaymentForm(invoice)}
                                                                className="font-medium text-teal-600 hover:text-teal-800"
                                                            >
                                                                Pay
                                                            </button>
                                                        )}

                                                    {canManage &&
                                                        invoice.status === "unpaid" &&
                                                        invoicePaid === 0 && (
                                                            <button
                                                                onClick={() => cancelInvoice(invoice)}
                                                                className="font-medium text-red-500 hover:text-red-700"
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
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="flex flex-col justify-between gap-5 border-b border-slate-100 pb-6 sm:flex-row sm:items-start">
                        <div>
                            <p className="text-sm font-medium text-blue-600">
                                Invoice details
                            </p>

                            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                                {selectedInvoice.invoice_number}
                            </h2>

                            <p className="mt-2 text-sm text-slate-500">
                                Created {formatDate(selectedInvoice.created_at)}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={printInvoice}
                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Print invoice
                            </button>

                            {canManage &&
                                selectedInvoice.status !== "paid" &&
                                selectedInvoice.status !== "cancelled" && (
                                    <button
                                        onClick={() => openPaymentForm(selectedInvoice)}
                                        className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                                    >
                                        + Record payment
                                    </button>
                                )}
                        </div>
                    </div>

                    <div className="grid gap-6 py-6 sm:grid-cols-2">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Billed to
                            </p>

                            <p className="mt-2 font-semibold text-slate-800">
                                {selectedPatient?.full_name || "Unknown patient"}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                                {selectedPatient?.patient_code || ""}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                                {selectedPatient?.phone || ""}
                            </p>
                        </div>

                        <div className="sm:text-right">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Invoice status
                            </p>

                            <span
                                className={`mt-2 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${STATUS_STYLES[selectedInvoice.status]
                                    }`}
                            >
                                {STATUS_LABELS[selectedInvoice.status]}
                            </span>

                            <p className="mt-3 text-sm text-slate-500">
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
                    <div className="border-t border-slate-100 pt-5">
                        <h3 className="font-semibold text-slate-900">
                            Charges
                        </h3>

                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full min-w-[520px] text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                                        <th className="py-3 font-medium">Description</th>
                                        <th className="px-3 py-3 text-right font-medium">Qty</th>
                                        <th className="px-3 py-3 text-right font-medium">
                                            Unit price
                                        </th>
                                        <th className="py-3 text-right font-medium">Amount</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {selectedItems.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="border-b border-slate-50 last:border-0"
                                        >
                                            <td className="py-4 text-sm font-medium text-slate-800">
                                                {item.description}
                                            </td>

                                            <td className="px-3 py-4 text-right text-sm text-slate-600">
                                                {Number(item.quantity).toLocaleString("en-IN")}
                                            </td>

                                            <td className="px-3 py-4 text-right text-sm text-slate-600">
                                                {money(item.unit_price)}
                                            </td>

                                            <td className="py-4 text-right text-sm font-semibold text-slate-800">
                                                {money(item.line_total)}
                                            </td>
                                        </tr>
                                    ))}

                                    {selectedItems.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="py-6 text-center text-sm text-slate-500"
                                            >
                                                No line items are available for this invoice.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="ml-auto mt-5 max-w-sm space-y-3 border-t border-slate-100 pt-5">
                            <div className="flex justify-between text-sm text-slate-500">
                                <span>Total billed</span>
                                <span className="font-semibold text-slate-800">
                                    {money(selectedInvoice.total_amount)}
                                </span>
                            </div>

                            <div className="flex justify-between text-sm text-slate-500">
                                <span>Amount paid</span>
                                <span className="font-semibold text-teal-700">
                                    {money(paidAmount)}
                                </span>
                            </div>

                            <div className="flex justify-between border-t border-slate-100 pt-3">
                                <span className="font-semibold text-slate-800">
                                    Outstanding
                                </span>

                                <span className="text-xl font-bold text-slate-900">
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
                    <div className="mt-8 border-t border-slate-100 pt-6">
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Payment history
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {selectedPayments.length} payment records
                                </p>
                            </div>
                        </div>

                        {selectedPayments.length === 0 ? (
                            <div className="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                                No payments have been recorded for this invoice.
                            </div>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {selectedPayments.map((payment) => (
                                    <div
                                        key={payment.id}
                                        className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center"
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-800">
                                                {money(payment.amount)}
                                            </p>

                                            <p className="mt-1 text-xs text-slate-500">
                                                {formatDateTime(payment.paid_at)}
                                            </p>
                                        </div>

                                        <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium capitalize text-blue-700">
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
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                    Register at least one patient before creating an invoice.
                </div>
            )}
        </div>
    );
}
