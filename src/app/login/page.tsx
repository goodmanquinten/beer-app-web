"use client";

import { useState } from "react";
import Link from "next/link";
import { logIn } from "@/actions/auth";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await logIn(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center blur-[3px] scale-105 brightness-75"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1920&q=80&auto=format')`,
        }}
      />
      <div className="absolute inset-0 bg-black/35" />

      <div className="w-full max-w-sm space-y-6 relative z-10 bg-black/40 backdrop-blur-md rounded-2xl p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-600">BeerApp</h1>
          <p className="mt-1 text-gray-300">Log in to your account</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-200">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              minLength={2}
              maxLength={20}
              pattern="[a-zA-Z0-9_]{2,20}"
              placeholder="e.g. beer_lover42"
              className="mt-1 block w-full rounded-lg border border-gray-600 bg-black/30 px-3 py-2 text-white placeholder-gray-400 focus:border-amber-500 focus:ring-amber-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-200">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              maxLength={64}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-lg border border-gray-600 bg-black/30 px-3 py-2 text-white placeholder-gray-400 focus:border-amber-500 focus:ring-amber-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-600 px-4 py-2 text-white font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-amber-500 hover:text-amber-400 font-medium">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
