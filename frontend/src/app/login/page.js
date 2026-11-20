
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (!email.trim()) {
        throw new Error("Enter your email address.");
      }

      if (!isForgotPassword && !password) {
        throw new Error("Enter your password.");
      }

      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
          }
        );

        if (error) {
          throw new Error(
            "Unable to process your request. Please try again later."
          );
        }

        setMessage(
          "If an account exists for this email, a password reset link has been sent."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          throw new Error("Invalid email or password.");
        }

        router.replace("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        <div className="mb-8">
          <p className="text-sm font-semibold tracking-widest text-blue-600">
            NOVA CLINIC OS
          </p>

          <h1 className="mt-5 text-3xl font-semibold text-gray-900">
            {isForgotPassword ? "Reset your password" : "Welcome back"}
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {isForgotPassword
              ? "Enter your email to receive a password reset link."
              : "Sign in to manage your clinic."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required
            type="email"
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
          />

          {!isForgotPassword && (
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          )}

          {!isForgotPassword && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setMessage("");
                }}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          {message && (
            <p
              role="status"
              aria-live="polite"
              className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700"
            >
              {message}
            </p>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full rounded-lg bg-gray-900 py-3 font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : isForgotPassword
                ? "Send reset link"
                : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          {isForgotPassword ? (
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setMessage("");
              }}
              className="font-semibold text-blue-600 hover:underline"
            >
              Back to sign in
            </button>
          ) : (
            <p>Need access? Contact your clinic administrator.</p>
          )}
        </div>
      </div>
    </main>
  );
}
