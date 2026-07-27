"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";

import { createAppointmentAction } from "./actions";
import { initialAppointmentActionState } from "./appointment-state";
import type {
  AppointmentFieldErrors,
  AppointmentFieldName,
} from "./appointment-validation";

type AppointmentFormProps = {
  opportunityId: string;
  defaultStartsAt: string;
  defaultEndsAt: string;
  unavailable: boolean;
};

const inputClassName =
  "mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-emerald-900/5";

function FieldError({
  errors,
  field,
}: {
  errors: AppointmentFieldErrors;
  field: AppointmentFieldName;
}) {
  const message = errors[field];

  return message ? (
    <p className="mt-2 text-sm font-semibold text-red-700" id={`${field}-error`}>
      {message}
    </p>
  ) : null;
}

export function AppointmentForm({
  opportunityId,
  defaultStartsAt,
  defaultEndsAt,
  unavailable,
}: AppointmentFormProps) {
  const [state, action] = useActionState(
    createAppointmentAction,
    initialAppointmentActionState,
  );

  return (
    <section
      aria-labelledby="appointment-form-title"
      className="rounded-3xl border border-[var(--line)] bg-white p-5"
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--brand)]">
        Uygulama içi takvim
      </p>
      <h2
        className="mt-1 text-lg font-black text-[var(--ink)]"
        id="appointment-form-title"
      >
        Randevu oluştur
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Kayıtla birlikte randevudan iki saat önceye, bu süre geçmişse hemen
        hazırlık görevi açılır. Harici takvime bildirim gönderilmez.
      </p>

      {unavailable ? (
        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          Kapanmış veya iletişim engelli fırsata randevu oluşturulamaz.
        </p>
      ) : (
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

          <label className="block text-sm font-extrabold text-[var(--ink)]">
            Başlangıç
            <input
              aria-describedby={
                state.fieldErrors.startsAt ? "startsAt-error" : undefined
              }
              aria-invalid={Boolean(state.fieldErrors.startsAt)}
              className={inputClassName}
              defaultValue={defaultStartsAt}
              name="startsAt"
              required
              type="datetime-local"
            />
            <FieldError errors={state.fieldErrors} field="startsAt" />
          </label>

          <label className="block text-sm font-extrabold text-[var(--ink)]">
            Bitiş
            <input
              aria-describedby={
                state.fieldErrors.endsAt ? "endsAt-error" : undefined
              }
              aria-invalid={Boolean(state.fieldErrors.endsAt)}
              className={inputClassName}
              defaultValue={defaultEndsAt}
              name="endsAt"
              required
              type="datetime-local"
            />
            <FieldError errors={state.fieldErrors} field="endsAt" />
          </label>

          <SubmitButton pendingLabel="Randevu oluşturuluyor…">
            Randevu ve hazırlık görevini oluştur
          </SubmitButton>
        </form>
      )}
    </section>
  );
}
