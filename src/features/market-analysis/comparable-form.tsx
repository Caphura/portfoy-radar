"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";

import { addMarketComparableAction } from "./actions";
import { initialComparableActionState } from "./market-analysis-state";
import type {
  ComparableFieldErrors,
  ComparableFieldName,
} from "./market-analysis-validation";

type ComparableFormProps = {
  marketAnalysisId: string;
  opportunityId: string;
  currency: string;
  defaultObservedOn: string;
};

const inputClassName =
  "mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-emerald-900/5";

function FieldError({
  errors,
  field,
}: {
  errors: ComparableFieldErrors;
  field: ComparableFieldName;
}) {
  const message = errors[field];

  return message ? (
    <p className="mt-2 text-sm font-semibold text-red-700" id={`${field}-error`}>
      {message}
    </p>
  ) : null;
}

export function ComparableForm({
  marketAnalysisId,
  opportunityId,
  currency,
  defaultObservedOn,
}: ComparableFormProps) {
  const [state, action] = useActionState(
    addMarketComparableAction,
    initialComparableActionState,
  );

  return (
    <form action={action} className="mt-5 space-y-4" noValidate>
      <input
        name="marketAnalysisId"
        type="hidden"
        value={marketAnalysisId}
      />
      <input name="opportunityId" type="hidden" value={opportunityId} />

      {state.formError ? (
        <p
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
          role="alert"
        >
          {state.formError}
        </p>
      ) : null}

      {state.success ? (
        <p
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950"
          role="status"
        >
          {state.success}
        </p>
      ) : null}

      <label className="block text-sm font-extrabold text-[var(--ink)]">
        Mahalle
        <input
          aria-describedby={
            state.fieldErrors.neighborhood ? "neighborhood-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors.neighborhood)}
          autoComplete="off"
          className={inputClassName}
          maxLength={100}
          name="neighborhood"
          placeholder="Örn. Moda"
          required
        />
        <FieldError errors={state.fieldErrors} field="neighborhood" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-extrabold text-[var(--ink)]">
          Alan (m²)
          <input
            aria-describedby={
              state.fieldErrors.areaSqm ? "areaSqm-error" : undefined
            }
            aria-invalid={Boolean(state.fieldErrors.areaSqm)}
            className={inputClassName}
            inputMode="decimal"
            name="areaSqm"
            placeholder="100"
            required
            type="text"
          />
          <FieldError errors={state.fieldErrors} field="areaSqm" />
        </label>

        <label className="block text-sm font-extrabold text-[var(--ink)]">
          Fiyat ({currency})
          <input
            aria-describedby={
              state.fieldErrors.askingPrice ? "askingPrice-error" : undefined
            }
            aria-invalid={Boolean(state.fieldErrors.askingPrice)}
            className={inputClassName}
            inputMode="decimal"
            name="askingPrice"
            placeholder="4500000"
            required
            type="text"
          />
          <FieldError errors={state.fieldErrors} field="askingPrice" />
        </label>
      </div>

      <label className="block text-sm font-extrabold text-[var(--ink)]">
        Gözlem tarihi
        <input
          aria-describedby={
            state.fieldErrors.observedOn ? "observedOn-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors.observedOn)}
          className={inputClassName}
          defaultValue={defaultObservedOn}
          name="observedOn"
          required
          type="date"
        />
        <FieldError errors={state.fieldErrors} field="observedOn" />
      </label>

      <SubmitButton pendingLabel="Emsal ekleniyor…">
        Manuel emsal ekle
      </SubmitButton>
    </form>
  );
}
