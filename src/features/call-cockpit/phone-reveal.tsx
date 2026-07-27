"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";

import { revealOpportunityPhoneAction } from "./actions";
import { initialPhoneRevealActionState } from "./phone-reveal-state";

export function PhoneReveal({
  opportunityId,
  canReveal,
}: {
  opportunityId: string;
  canReveal: boolean;
}) {
  const [state, action] = useActionState(
    revealOpportunityPhoneAction,
    initialPhoneRevealActionState,
  );

  if (!canReveal) {
    return (
      <p className="mt-4 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm leading-6 text-[var(--muted)]">
        Telefonu yalnızca sahip veya danışman açık eylemle görüntüleyebilir.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-[var(--brand-soft)] p-3">
      {state.status === "success" && state.phone ? (
        <div aria-live="polite">
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--brand)]">
            Telefon
          </p>
          <p
            className="mt-1 text-xl font-black tracking-wide text-[var(--ink)]"
            dir="ltr"
          >
            {state.phone}
          </p>
          <a
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--ink)] px-4 text-sm font-extrabold text-white"
            href={`tel:${state.phone}`}
          >
            Telefon uygulamasını aç
          </a>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Arama otomatik başlamaz; cihazınızın telefon ekranı açılır.
          </p>
        </div>
      ) : (
        <form action={action}>
          <input name="opportunityId" type="hidden" value={opportunityId} />
          {state.error ? (
            <p
              className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-800"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}
          <SubmitButton pendingLabel="Telefon güvenli biçimde açılıyor…">
            Telefonu göster
          </SubmitButton>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Yalnız bu kayıt açılır ve görüntüleme audit günlüğüne yazılır.
          </p>
        </form>
      )}
    </div>
  );
}
