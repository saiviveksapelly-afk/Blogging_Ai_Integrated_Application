"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEMO_USER_ID, readCurrentUser, readDemoPassword, saveCurrentUser } from "../blogs/data";

type LoginResponse = {
  message?: string;
  user?: { id: string; username: string; email: string; avatarURL?: string };
  errors?: Array<{
    message: string;
  }>;
};

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearLoginForm() {
    setEmail("");
    setPassword("");
    setMessage("");
    setIsSuccess(false);
  }

  function handleDemoLogin() {
    setEmail("demo@example.com");
    setPassword(readDemoPassword());
    setIsSuccess(true);
    setMessage("Demo credentials loaded successfully! click on submit");
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setIsSuccess(false);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const payload = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    if (
      payload.email.trim().toLowerCase() === "demo@example.com" &&
      payload.password === readDemoPassword()
    ) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
        const response = await fetch(`${apiUrl}/api/auth/demo`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
        const data = (await response.json()) as LoginResponse;
        if (!response.ok || !data.user) { setMessage(data.message ?? "Demo login failed."); return; }
        const savedDemoUser = readCurrentUser();
        saveCurrentUser({ id: DEMO_USER_ID, name: data.user.username, email: data.user.email, avatarURL: savedDemoUser?.id === DEMO_USER_ID ? savedDemoUser.avatarURL : undefined });
        clearLoginForm();
        router.replace("/blogs");
      } catch {
        setMessage("Could not connect to the server. Check that the backend is running.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as LoginResponse;

      if (!response.ok) {
        const validationMessages = data.errors
          ?.map((error) => error.message)
          .join(" ");

        setMessage(
          validationMessages || data.message || "Login failed.",
        );
        return;
      }

      if (!data.user?.id) {
        setMessage("Login succeeded, but the server did not return your account details.");
        return;
      }

      saveCurrentUser({ id: data.user.id, name: data.user.username, email: data.user.email, avatarURL: data.user.avatarURL });

      setIsSubmitting(false);
      clearLoginForm();
      router.replace("/blogs");
    } catch {
      setMessage(
        "Could not complete login. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Log in
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Log in to continue to the blog catalog.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-zinc-700"
              htmlFor="email"
            >
              Email
            </label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              className="mb-1 block text-sm font-medium text-zinc-700"
              htmlFor="password"
            >
              Password
            </label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            className="w-full rounded-md bg-zinc-900 px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
          <button
            className="w-full rounded-md bg-zinc-700 px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={isSubmitting}
            onClick={handleDemoLogin}
          >
            Load Demo Credentials
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-600">
          Don&apos;t have an account?{" "}
          <Link
            className="font-medium text-zinc-900 underline underline-offset-4"
            href="/register"
            onClick={clearLoginForm}
          >
            Register
          </Link>
        </p>

        {message && (
          <p
            className={`mt-4 text-sm ${
              isSuccess ? "text-green-700" : "text-red-700"
            }`}
            role={isSuccess ? "status" : "alert"}
          >
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
