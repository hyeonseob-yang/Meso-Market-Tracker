"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    setIsPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-sm">
        <h2 className="text-lg font-medium text-gray-900">Check your email</h2>
        <p className="mt-2 text-sm text-gray-600">We sent a confirmation link to {email}. Click it to finish signing up.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h2 className="text-lg font-medium text-gray-900">Sign up</h2>
      <form onSubmit={handleSignup} className="mt-4 flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Signing up…" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-700 underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
