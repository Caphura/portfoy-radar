"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";

import { loginAction } from "./actions";
import { initialLoginActionState } from "./login-state";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialLoginActionState);

  return (
    <form action={action} className="mt-7 space-y-5" noValidate>
      {state.formError ? (
        <p
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
          role="alert"
        >
          {state.formError}
        </p>
      ) : null}

      <div>
        <label className="text-sm font-bold text-[var(--ink)]" htmlFor="email">
          E-posta
        </label>
        <input
          aria-describedby={state.fieldErrors.email ? "email-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors.email)}
          autoComplete="email"
          className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-4 focus:ring-emerald-900/5"
          id="email"
          inputMode="email"
          maxLength={254}
          name="email"
          placeholder="ornek@adres.com"
          required
          type="email"
        />
        {state.fieldErrors.email ? (
          <p className="mt-2 text-sm font-semibold text-red-700" id="email-error">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label className="text-sm font-bold text-[var(--ink)]" htmlFor="password">
          Parola
        </label>
        <input
          aria-describedby={state.fieldErrors.password ? "password-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors.password)}
          autoComplete="current-password"
          className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-4 focus:ring-emerald-900/5"
          id="password"
          maxLength={256}
          name="password"
          placeholder="Parolanız"
          required
          type="password"
        />
        {state.fieldErrors.password ? (
          <p className="mt-2 text-sm font-semibold text-red-700" id="password-error">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      <SubmitButton pendingLabel="Giriş yapılıyor…">Giriş yap</SubmitButton>
    </form>
  );
}
