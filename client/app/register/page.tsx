"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackendWakeError, waitForBackend } from "../apiAvailability";
type RegisterResponse = {
  message?: string;
  errors?: Array<{
    field?: string | number;
    message: string;
  }>;
};

export default function RegisterPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function clearRegisterForm() {
    formRef.current?.reset();
    setMessage("");
    setIsSuccess(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setIsSuccess(false);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const payload = {
      username: String(formData.get("username") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };

    try {
      await waitForBackend(() => setMessage("The server is starting. Please keep this page open…"));
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as RegisterResponse;

      if (!response.ok) {
        const validationMessages = data.errors
          ?.map((error) => error.message)
          .join(" ");

        setMessage(
          validationMessages || data.message || "Registration failed.",
        );
        return;
      }

      setIsSuccess(true);
      setMessage("Registration successful. You can now log in.");
      formRef.current?.reset();
      window.setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (error) {
      setMessage(error instanceof BackendWakeError ? error.message : "Could not connect to the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Join the community and start reading blogs.
        </p>

        <form ref={formRef} className="mt-6 space-y-4" onSubmit={handleSubmit} autoComplete="off">
          <div>
            <label
              className="mb-1 block text-sm font-medium text-zinc-700"
              htmlFor="username"
            >
              Username
            </label>
            <input
              className="w-full rounded-md border text-zinc-900 border-zinc-300 px-3 py-2"
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_]+"
              title="Use 3–20 letters, numbers, or underscores."
              required
            />
          </div>

          <div>
            <label
              className="mb-1 block text-sm font-medium text-zinc-700"
              htmlFor="email"
            >
              Email
            </label>
            <input
              className="w-full rounded-md border border-zinc-300 text-zinc-900 px-3 py-2"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
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
              className="w-full rounded-md border border-zinc-300 text-zinc-900 px-3 py-2"
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div>
            <label
              className="mb-1 block text-sm font-medium text-zinc-700"
              htmlFor="confirmPassword"
            >
              Confirm password
            </label>
            <input
              className="w-full rounded-md border border-zinc-300 text-zinc-900 px-3 py-2"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button
            className="w-full rounded-md bg-zinc-900 px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link
            className="font-medium text-zinc-900 underline underline-offset-4"
            href="/login"
            onClick={clearRegisterForm}
          >
            Log in
          </Link>
        </p>

        {message && (
          <p
            className={`mt-4 text-sm ${
              isSuccess ? "text-green-700" : "text-red-700"
            }`}
            role="status"
          >
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
