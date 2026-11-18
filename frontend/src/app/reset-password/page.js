
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data: { session }, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        throw new Error("Reset session expired. Please request a new reset link.");
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      await supabase.auth.signOut();

      router.push("/login?password-updated=true");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        <p className="text-sm font-semibold tracking-widest text-blue-600">
          NOVA CLINIC OS
        </p>

        <h1 className="mt-5 text-3xl font-semibold text-gray-900">
          Set new password
        </h1>

        <p className="mt-2 mb-7 text-sm text-gray-500">
          Create a secure password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
          />

          <input
            required
            type="password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
          />

          {message && (
            <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              {message}
            </p>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full rounded-lg bg-gray-900 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}
