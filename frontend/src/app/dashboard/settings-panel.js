
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputClass =
    "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]";

const labelClass =
    "text-sm font-medium text-[var(--text-secondary)]";

function Section({ title, description, children }) {
    return (
        <section className="rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-7">
            <div className="mb-6">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
                    {title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                    {description}
                </p>
            </div>
            {children}
        </section>
    );
}

function ReadOnlyField({ label, value }) {
    return (
        <div>
            <p className={labelClass}>{label}</p>
            <div className="mt-2 min-h-12 break-words rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--foreground)]">
                {value || "Not provided"}
            </div>
        </div>
    );
}

function Notice({ children, type = "success" }) {
    const styles =
        type === "error"
            ? "border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]"
            : "border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]";

    return (
        <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
            {children}
        </div>
    );
}

function PrimaryButton({ children, disabled, ...props }) {
    return (
        <button
            {...props}
            disabled={disabled}
            className="rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
            {children}
        </button>
    );
}

export default function SettingsPanel({
    clinicId,
    userId,
    fullName = "",
    email = "",
    clinicName = "",
    isReadOnly = false,
}) {
    const supabase = useMemo(() => createClient(), []);

    const [clinic, setClinic] = useState({
        name: clinicName,
        phone: "",
        email: "",
        address: "",
        website: "",
    });

    const [adminName, setAdminName] = useState(fullName);
    const [authEmail, setAuthEmail] = useState(email);
    const [loading, setLoading] = useState(true);
    const [savingClinic, setSavingClinic] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [sendingReset, setSendingReset] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const loadSettings = useCallback(async () => {
        setLoading(true);
        setError("");

        const { data: authData, error: authError } =
            await supabase.auth.getUser();

        if (authError || !authData.user || authData.user.id !== userId) {
            setError("Your session has expired. Please log in again.");
            setLoading(false);
            return;
        }

        setAuthEmail(authData.user.email || "");

        const { data: clinicData, error: clinicError } = await supabase
            .from("clinics")
            .select("id, name, phone, email, address, website")
            .eq("id", clinicId)
            .single();

        if (clinicError) {
            setError(clinicError.message);
            setLoading(false);
            return;
        }

        const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("full_name, role")
            .eq("id", userId)
            .single();

        if (
            profileError ||
            (
                profileData?.role !== "admin" &&
                !(isReadOnly && profileData?.role === "demo")
            )
        ) {
            setError("You don't have permission to view clinic settings.");
            setLoading(false);
            return;
        }

        setClinic({
            name: clinicData.name || "",
            phone: clinicData.phone || "",
            email: clinicData.email || "",
            address: clinicData.address || "",
            website: clinicData.website || "",
        });

        setAdminName(profileData.full_name || "");
        setLoading(false);
    }, [supabase, clinicId, userId]);

    useEffect(() => {
        const timer = setTimeout(() => {
            void loadSettings();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadSettings]);

    const updateClinicField = (field, value) => {
        setClinic((current) => ({ ...current, [field]: value }));
    };

    const saveClinic = async (event) => {
        event.preventDefault();
        setSavingClinic(true);
        setMessage("");
        setError("");

        const { error: saveError } = await supabase
            .from("clinics")
            .update({
                name: clinic.name.trim(),
                phone: clinic.phone.trim() || null,
                email: clinic.email.trim() || null,
                address: clinic.address.trim() || null,
                website: clinic.website.trim() || null,
            })
            .eq("id", clinicId);

        if (saveError) {
            setError(saveError.message);
        } else {
            setMessage("Clinic information saved successfully.");
        }

        setSavingClinic(false);
    };

    const saveProfile = async (event) => {
        event.preventDefault();
        setSavingProfile(true);
        setMessage("");
        setError("");

        const { error: saveError } = await supabase
            .from("profiles")
            .update({ full_name: adminName.trim() })
            .eq("id", userId);

        if (saveError) {
            setError(saveError.message);
        } else {
            setMessage("Admin profile updated successfully.");
        }

        setSavingProfile(false);
    };

    const sendPasswordReset = async () => {
        if (!authEmail) {
            setError("No account email was found.");
            return;
        }

        setSendingReset(true);
        setMessage("");
        setError("");

        const { error: resetError } =
            await supabase.auth.resetPasswordForEmail(authEmail, {
                redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
            });

        if (resetError) {
            setError(resetError.message);
        } else {
            setMessage(`Password reset instructions sent to ${authEmail}.`);
        }

        setSendingReset(false);
    };

    if (loading) {
        return (
            <div className={`${"rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)]"} flex min-h-64 flex-col items-center justify-center p-10`}>
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
                <p className="mt-4 text-sm text-[var(--text-secondary)]">
                    Loading clinic settings...
                </p>
            </div>
        );
    }

    if (isReadOnly) {
        return (
            <div className="space-y-7">
                <div>
                    <p className="text-sm font-medium text-[var(--primary)]">
                        Clinic administration · Demo preview
                    </p>
                    <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
                        Settings
                    </h1>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        Explore the clinic settings interface. Changes are disabled in the public demo.
                    </p>
                </div>

                <div className="rounded-xl border border-[var(--warning)]/20 bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--foreground)]">
                    Read-only preview — clinic details, administrator profile and account security cannot be changed.
                </div>

                <Section
                    title="Clinic information"
                    description="Contact and business details associated with your clinic."
                >
                    <div className="space-y-5">
                        <ReadOnlyField label="Clinic name" value={clinic.name} />
                        <div className="grid gap-5 sm:grid-cols-2">
                            <ReadOnlyField label="Phone number" value={clinic.phone} />
                            <ReadOnlyField label="Clinic email" value={clinic.email} />
                        </div>
                        <ReadOnlyField label="Address" value={clinic.address} />
                        <ReadOnlyField label="Website" value={clinic.website} />
                    </div>
                </Section>

                <Section
                    title="Administrator profile"
                    description="Account details for the clinic administrator."
                >
                    <div className="grid gap-5 sm:grid-cols-2">
                        <ReadOnlyField label="Display name" value={adminName} />
                        <ReadOnlyField label="Account email" value={authEmail} />
                    </div>
                </Section>

                <Section
                    title="Account security"
                    description="Password management for the administrator account."
                >
                    <div className="rounded-xl bg-[var(--surface-subtle)] p-4">
                        <p className="text-sm text-[var(--text-secondary)]">
                            Password reset is unavailable in the public demo.
                        </p>
                    </div>
                </Section>
            </div>
        );
    }

    if (error && !clinicId) {
        return (
            <div className="rounded-[var(--card-radius)] border border-[var(--danger)]/20 bg-[var(--danger-soft)] p-6 text-sm text-[var(--danger)]">
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-7">
            {/* Page heading */}
            <div>
                <p className="text-sm font-medium text-[var(--primary)]">
                    Clinic administration
                </p>
                <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
                    Settings
                </h1>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Manage your clinic information and administrator account.
                </p>
            </div>

            {/* Feedback messages */}
            {message && <Notice>{message}</Notice>}
            {error && <Notice type="error">{error}</Notice>}

            {/* Clinic information */}
            <Section
                title="Clinic information"
                description="Update the contact and business details associated with your clinic."
            >
                <form onSubmit={saveClinic} className="space-y-5">
                    <div>
                        <label className={labelClass}>Clinic name</label>
                        <input
                            required
                            value={clinic.name}
                            onChange={(e) =>
                                updateClinicField("name", e.target.value)
                            }
                            className={inputClass}
                            placeholder="Enter clinic name"
                        />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className={labelClass}>Phone number</label>
                            <input
                                type="tel"
                                value={clinic.phone}
                                onChange={(e) =>
                                    updateClinicField("phone", e.target.value)
                                }
                                className={inputClass}
                                placeholder="Enter phone number"
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Clinic email</label>
                            <input
                                type="email"
                                value={clinic.email}
                                onChange={(e) =>
                                    updateClinicField("email", e.target.value)
                                }
                                className={inputClass}
                                placeholder="clinic@example.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Address</label>
                        <textarea
                            rows={3}
                            value={clinic.address}
                            onChange={(e) =>
                                updateClinicField("address", e.target.value)
                            }
                            className={`${inputClass} resize-y`}
                            placeholder="Enter clinic address"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Website</label>
                        <input
                            type="url"
                            value={clinic.website}
                            onChange={(e) =>
                                updateClinicField("website", e.target.value)
                            }
                            className={inputClass}
                            placeholder="https://example.com"
                        />
                    </div>

                    <div className="flex justify-end border-t border-[var(--border)] pt-5">
                        <PrimaryButton type="submit" disabled={savingClinic}>
                            {savingClinic ? "Saving..." : "Save clinic details"}
                        </PrimaryButton>
                    </div>
                </form>
            </Section>

            {/* Administrator profile */}
            <Section
                title="Administrator profile"
                description="Manage the personal details of your administrator account."
            >
                <form onSubmit={saveProfile} className="space-y-5">
                    <div>
                        <label className={labelClass}>Display name</label>
                        <input
                            required
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            className={inputClass}
                            placeholder="Enter your name"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Account email</label>
                        <input
                            value={authEmail}
                            readOnly
                            className={`${inputClass} cursor-not-allowed bg-[var(--surface-subtle)]`}
                        />
                        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                            This is your login email. It is separate from the clinic contact email.
                        </p>
                    </div>

                    <div className="flex justify-end border-t border-[var(--border)] pt-5">
                        <PrimaryButton
                            type="submit"
                            disabled={savingProfile || !adminName.trim()}
                        >
                            {savingProfile ? "Saving..." : "Save profile"}
                        </PrimaryButton>
                    </div>
                </form>
            </Section>

            {/* Account security */}
            <Section
                title="Account security"
                description="Protect your administrator account by resetting your password."
            >
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                            Reset password
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                            Receive a secure password reset link at your account email.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={sendPasswordReset}
                        disabled={sendingReset || !authEmail}
                        className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {sendingReset ? "Sending..." : "Send reset link"}
                    </button>
                </div>
            </Section>
        </div>
    );
}
