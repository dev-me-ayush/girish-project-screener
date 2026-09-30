"use client";

import { useActionState, useState } from "react";
import { signIn, type SignInState } from "@/app/sign-in/actions";

const initialState: SignInState = { error: null };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="w-full" noValidate>
      <div className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="eyebrow block text-faint"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="you@example.com"
            className="mt-2.5 h-12 w-full rounded-lg border border-line bg-ink px-4 text-sm text-paper transition-colors placeholder:text-faint hover:border-line-bright focus:border-signal focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="password" className="eyebrow block text-faint">
            Password
          </label>
          <div className="relative mt-2.5">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="h-12 w-full rounded-lg border border-line bg-ink pr-16 pl-4 text-sm text-paper transition-colors placeholder:text-faint hover:border-line-bright focus:border-signal focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-16 items-center justify-end pr-4 text-xs text-faint transition-colors hover:text-paper"
            >
              {showPassword ? "Hide" : "Show"}
              <span className="sr-only"> password</span>
            </button>
          </div>
        </div>

        {state.error && (
          <p
            role="alert"
            className="rounded-lg border border-drop/40 bg-drop/10 px-4 py-3 text-sm text-drop"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-full bg-signal text-sm font-medium text-ink transition-transform duration-200 hover:-translate-y-px hover:bg-signal-dim active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </form>

  );
}
