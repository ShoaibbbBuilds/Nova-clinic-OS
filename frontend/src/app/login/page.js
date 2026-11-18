
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [isSignup, setIsSignup] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });

        if (error) throw error;

        setMessage("If an account exists for this email, a password reset link has been sent. Check your inbox.");
      } else if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              clinic_name: clinicName,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setMessage("Account created. Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/dashboard");
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
            {isForgotPassword
              ? "Reset your password"
              : isSignup
                ? "Create your clinic"
                : "Welcome back"}
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {isForgotPassword
              ? "Enter your email to receive a password reset link."
              : isSignup
                ? "Set up your clinic management workspace."
                : "Sign in to manage your clinic."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              />

              <input
                required
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="Clinic name"
                className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              />
            </>
          )}

          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
          />

          {!isForgotPassword && (
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (minimum 8 characters)"
              className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          )}

          {!isSignup && !isForgotPassword && (
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
            <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
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
                : isSignup
                  ? "Create clinic account"
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
            <>
              {isSignup ? "Already have an account?" : "New to Nova Clinic OS?"}

              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setMessage("");
                }}
                className="ml-2 font-semibold text-blue-600 hover:underline"
              >
                {isSignup ? "Sign in" : "Create account"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
