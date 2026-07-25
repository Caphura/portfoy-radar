"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";

import { renameWorkspaceAction } from "./rename-actions";
import { initialWorkspaceRenameActionState } from "./workspace-rename-state";

type WorkspaceRenameFormProps = {
  currentName: string;
};

export function WorkspaceRenameForm({
  currentName,
}: WorkspaceRenameFormProps) {
  const [state, action] = useActionState(
    renameWorkspaceAction,
    initialWorkspaceRenameActionState,
  );

  return (
    <form action={action} className="mt-5 space-y-4" noValidate>
      {state.formError ? (
        <p
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
          role="alert"
        >
          {state.formError}
        </p>
      ) : null}

      {state.successMessage ? (
        <p
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-800"
          role="status"
        >
          {state.successMessage}
        </p>
      ) : null}

      <div>
        <label
          className="text-sm font-bold text-[var(--ink)]"
          htmlFor="workspace-rename"
        >
          Çalışma alanı adı
        </label>
        <input
          aria-describedby={
            state.nameError ? "workspace-rename-error" : undefined
          }
          aria-invalid={Boolean(state.nameError)}
          className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-emerald-900/5"
          defaultValue={currentName}
          id="workspace-rename"
          maxLength={80}
          name="name"
          required
          type="text"
        />
        {state.nameError ? (
          <p
            className="mt-2 text-sm font-semibold text-red-700"
            id="workspace-rename-error"
          >
            {state.nameError}
          </p>
        ) : null}
      </div>

      <SubmitButton pendingLabel="Güncelleniyor…">Adı güncelle</SubmitButton>
    </form>
  );
}
