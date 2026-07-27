"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";

import { requestMarketAnalysisAction } from "./actions";
import { initialMarketAnalysisActionState } from "./market-analysis-state";
import type {
  MarketAnalysisFieldErrors,
  MarketAnalysisFieldName,
} from "./market-analysis-validation";

type MarketAnalysisRequestFormProps = {
  opportunityId: string;
  defaultTransactionType: "sale" | "rent";
  defaultCurrency: string;
  defaultTargetAt: string;
  unavailable: boolean;
};

const inputClassName =
  "mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-emerald-900/5";

function FieldError({
  errors,
  field,
}: {
  errors: MarketAnalysisFieldErrors;
  field: MarketAnalysisFieldName;
}) {
  const message = errors[field];

  return message ? (
    <p className="mt-2 text-sm font-semibold text-red-700" id={`${field}-error`}>
      {message}
    </p>
  ) : null;
}

export function MarketAnalysisRequestForm({
  opportunityId,
  defaultTransactionType,
  defaultCurrency,
  defaultTargetAt,
  unavailable,
}: MarketAnalysisRequestFormProps) {
  const [state, action] = useActionState(
    requestMarketAnalysisAction,
    initialMarketAnalysisActionState,
  );

  if (unavailable) {
    return (
      <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
        Kapanmış veya iletişim engelli fırsata pazar analizi başlatılamaz.
      </p>
    );
  }

  return (
    <form action={action} className="mt-5 space-y-4" noValidate>
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
        <div
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950"
          role="status"
        >
          <p className="text-sm font-black">{state.success.message}</p>
          <p className="mt-1 text-sm leading-6">{state.success.detail}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-extrabold text-[var(--ink)]">
          İşlem türü
          <select
            aria-describedby={
              state.fieldErrors.transactionType
                ? "transactionType-error"
                : undefined
            }
            aria-invalid={Boolean(state.fieldErrors.transactionType)}
            className={inputClassName}
            defaultValue={defaultTransactionType}
            name="transactionType"
          >
            <option value="sale">Satılık</option>
            <option value="rent">Kiralık</option>
          </select>
          <FieldError
            errors={state.fieldErrors}
            field="transactionType"
          />
        </label>

        <label className="block text-sm font-extrabold text-[var(--ink)]">
          Para birimi
          <input
            aria-describedby={
              state.fieldErrors.currency ? "currency-error" : undefined
            }
            aria-invalid={Boolean(state.fieldErrors.currency)}
            className={`${inputClassName} uppercase`}
            defaultValue={defaultCurrency}
            inputMode="text"
            maxLength={3}
            name="currency"
            required
          />
          <FieldError errors={state.fieldErrors} field="currency" />
        </label>
      </div>

      <label className="block text-sm font-extrabold text-[var(--ink)]">
        Analiz hedefi
        <input
          aria-describedby={
            state.fieldErrors.targetAt ? "targetAt-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors.targetAt)}
          className={inputClassName}
          defaultValue={defaultTargetAt}
          name="targetAt"
          required
          type="datetime-local"
        />
        <FieldError errors={state.fieldErrors} field="targetAt" />
      </label>

      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-[var(--muted)]">
        <p className="font-extrabold text-[var(--ink)]">
          Birlikte açılacak görevler
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Emsalleri topla</li>
          <li>Fiyat özetini hazırla</li>
          <li>Danışman değerlendirmesi</li>
        </ol>
      </div>

      <SubmitButton pendingLabel="Analiz başlatılıyor…">
        Analizi ve üç görevi başlat
      </SubmitButton>
    </form>
  );
}
