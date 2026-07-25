"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";

import { createWorkspaceAction } from "./actions";
import { initialWorkspaceSetupActionState } from "./workspace-state";

export function WorkspaceSetupForm() {
  const [state, action] = useActionState(
    createWorkspaceAction,
    initialWorkspaceSetupActionState,
  );

  return (
    <form action={action} className="mt-6 space-y-5" noValidate>
      {state.formError ? (
        <p
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
          role="alert"
        >
          {state.formError}
        </p>
      ) : null}

      <div>
        <label className="text-sm font-bold text-[var(--ink)]" htmlFor="workspace-name">
          Çalışma alanı adı
        </label>
        <input
          aria-describedby={state.nameError ? "workspace-name-error" : undefined}
          aria-invalid={Boolean(state.nameError)}
          autoComplete="organization"
          className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-4 focus:ring-emerald-900/5"
          id="workspace-name"
          maxLength={80}
          name="name"
          placeholder="Örn. Anadolu Yakası Portföy"
          required
          type="text"
        />
        {state.nameError ? (
          <p
            className="mt-2 text-sm font-semibold text-red-700"
            id="workspace-name-error"
          >
            {state.nameError}
          </p>
        ) : (
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Bu kullanıcı ilk üye olarak owner rolüyle atanır.
          </p>
        )}
      </div>

      <SubmitButton pendingLabel="Oluşturuluyor…">Çalışma alanını oluştur</SubmitButton>
    </form>
  );
}
