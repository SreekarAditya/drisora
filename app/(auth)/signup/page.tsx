"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
      });
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 text-white">
      <h1 className="text-3xl font-semibold">Create your Drisora account</h1>
      <p className="mt-2 text-sm text-gray-500">Set up your account to start managing surveys.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <input
          className="w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-white outline-none focus:border-amber-500"
          type="text"
          placeholder="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        <input
          className="w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-white outline-none focus:border-amber-500"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-white outline-none focus:border-amber-500"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          className="w-full rounded-md bg-amber-500 px-3 py-2 font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Creating account..." : "Sign up"}
        </button>
      </form>
    </main>
  );
}
