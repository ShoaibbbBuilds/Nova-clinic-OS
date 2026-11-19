
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputClass =
    "mt-2 w-full rounded-xl border border-[#E1ECF8] bg-white px-4 py-3 text-sm text-[#16345C] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

const labelClass = "text-sm font-medium text-[#58718F]";

function Section({ title, description, children }) {
    return (
        <section className="rounded-2xl border border-[#E1ECF8] bg-white p-6 sm:p-7">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-[#16345C]">{title}</h2>
                <p className="mt-1 text-sm text-[#8BA0B8]">{description}</p>
            </div>
            {children}
        </section>
    );
}

export default function SettingsPanel({
    clinicId,
    userId,
    fullName = "",
    email = "",
    clinicName = "",
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

        if (profileError || profileData?.role !== "admin") {
            setError("You don't have permission to manage clinic settings.");
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
            <div className="rounded-2xl border border-[#E1ECF8] bg-white p-10 text-center text-sm text-[#7890AC]">
                Loading clinic settings...
            </div>
        );
    }

    if (error && !clinicId) {
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-7">
            <div>
                <p className="text-sm font-medium text-blue-600">
                    Clinic administration
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#16345C]">
                    Settings
                </h1>
                <p className="mt-2 text-sm text-[#7890AC]">
                    Manage your clinic information and administrator account.
                </p>
            </div>

            {message && (
                <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
                    {message}
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

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
                            onChange={(e) => updateClinicField("name", e.target.value)}
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
                                onChange={(e) => updateClinicField("phone", e.target.value)}
                                className={inputClass}
                                placeholder="Enter phone number"
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Clinic email</label>
                            <input
                                type="email"
                                value={clinic.email}
                                onChange={(e) => updateClinicField("email", e.target.value)}
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
                            onChange={(e) => updateClinicField("address", e.target.value)}
                            className={inputClass}
                            placeholder="Enter clinic address"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Website</label>
                        <input
                            type="url"
                            value={clinic.website}
                            onChange={(e) => updateClinicField("website", e.target.value)}
                            className={inputClass}
                            placeholder="https://example.com"
                        />
                    </div>

                    <div className="flex justify-end border-t border-[#EAF0F8] pt-5">
                        <button
                            type="submit"
                            disabled={savingClinic}
                            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                        >
                            {savingClinic ? "Saving..." : "Save clinic details"}
                        </button>
                    </div>
                </form>
            </Section>

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
                            className={`${inputClass} cursor-not-allowed bg-[#F4F8FD]`}
                        />
                        <p className="mt-2 text-xs text-[#9AAEC4]">
                            This is your login email. It is separate from the clinic contact email.
                        </p>
                    </div>

                    <div className="flex justify-end border-t border-[#EAF0F8] pt-5">
                        <button
                            type="submit"
                            disabled={savingProfile || !adminName.trim()}
                            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                        >
                            {savingProfile ? "Saving..." : "Save profile"}
                        </button>
                    </div>
                </form>
            </Section>

            <Section
                title="Account security"
                description="Protect your administrator account by resetting your password."
            >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-sm font-semibold text-[#16345C]">
                            Reset password
                        </p>
                        <p className="mt-1 text-sm text-[#8BA0B8]">
                            Receive a secure password reset link at your account email.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={sendPasswordReset}
                        disabled={sendingReset || !authEmail}
                        className="shrink-0 rounded-xl border border-[#DCE8F5] bg-white px-5 py-3 text-sm font-semibold text-[#315B89] transition hover:bg-[#F4F8FD] disabled:opacity-60"
                    >
                        {sendingReset ? "Sending..." : "Send reset link"}
                    </button>
                </div>
            </Section>
        </div>
    );
}
