"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";

import {
  liftContactCommunicationBlockAction,
  markContactDoNotCallAction,
} from "./actions";
import { initialCommunicationBlockActionState } from "./communication-block-state";
import type {
  CommunicationBlockFieldErrors,
  CommunicationBlockFieldName,
} from "./communication-block-validation";

type DoNotCallControlProps = {
  opportunityId: string;
  active: boolean;
  canManage: boolean;
};

const textAreaClassName =
  "mt-2 min-h-24 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base text-[var(--ink)] outline-none transition placeholder:text-slate-400 focus:border-red-600 focus:ring-4 focus:ring-red-900/5";

function FieldError({
  errors,
  field,
}: {
  errors: CommunicationBlockFieldErrors;
  field: CommunicationBlockFieldName;
}) {
  const message = errors[field];

  return message ? (
    <p className="mt-2 text-sm font-semibold text-red-700" id={`${field}-error`}>
      {message}
    </p>
  ) : null;
}

function ActionFeedback({
  state,
}: {
  state: typeof initialCommunicationBlockActionState;
}) {
  return (
    <>
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
    </>
  );
}

function ConfirmationField({
  errors,
  children,
}: {
  errors: CommunicationBlockFieldErrors;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-bold leading-6 text-[var(--ink)]">
        <input
          aria-describedby={
            errors.confirmation ? "confirmation-error" : undefined
          }
          aria-invalid={Boolean(errors.confirmation)}
          className="mt-0.5 size-5 shrink-0 accent-red-700"
          name="confirmation"
          required
          type="checkbox"
        />
        {children}
      </label>
      <FieldError errors={errors} field="confirmation" />
    </div>
  );
}

function MarkDoNotCallForm({ opportunityId }: { opportunityId: string }) {
  const [state, action] = useActionState(
    markContactDoNotCallAction,
    initialCommunicationBlockActionState,
  );

  return (
    <form action={action} className="mt-5 space-y-4" noValidate>
      <input name="opportunityId" type="hidden" value={opportunityId} />
      <ActionFeedback state={state} />
      <label className="block text-sm font-extrabold text-[var(--ink)]">
        Aranmayacak nedeni
        <textarea
          aria-describedby={
            state.fieldErrors.reason
              ? "reason-error block-reason-help"
              : "block-reason-help"
          }
          aria-invalid={Boolean(state.fieldErrors.reason)}
          className={textAreaClassName}
          maxLength={500}
          minLength={3}
          name="reason"
          placeholder="Kişinin iletişim talebini ve işlem gerekçesini yazın"
          required
        />
        <FieldError errors={state.fieldErrors} field="reason" />
      </label>
      <p className="text-xs leading-5 text-[var(--muted)]" id="block-reason-help">
        Neden şifrelenir; timeline, audit veya hata mesajına yazılmaz.
      </p>
      <ConfirmationField errors={state.fieldErrors}>
        Bu kişinin çalışma alanındaki bütün açık fırsatlarının kapanacağını ve
        açık takip görevlerinin iptal edileceğini anlıyorum.
      </ConfirmationField>
      <SubmitButton
        pendingLabel="İletişim engeli uygulanıyor…"
        tone="danger"
      >
        Kişiyi Aranmayacak yap
      </SubmitButton>
    </form>
  );
}

function LiftCommunicationBlockForm({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const [state, action] = useActionState(
    liftContactCommunicationBlockAction,
    initialCommunicationBlockActionState,
  );

  return (
    <form action={action} className="mt-5 space-y-4" noValidate>
      <input name="opportunityId" type="hidden" value={opportunityId} />
      <ActionFeedback state={state} />
      <label className="block text-sm font-extrabold text-[var(--ink)]">
        Engel kaldırma nedeni
        <textarea
          aria-describedby={
            state.fieldErrors.reason
              ? "reason-error lift-reason-help"
              : "lift-reason-help"
          }
          aria-invalid={Boolean(state.fieldErrors.reason)}
          className={textAreaClassName}
          maxLength={500}
          minLength={3}
          name="reason"
          placeholder="İletişime yeniden izin verilme gerekçesini yazın"
          required
        />
        <FieldError errors={state.fieldErrors} field="reason" />
      </label>
      <p className="text-xs leading-5 text-[var(--muted)]" id="lift-reason-help">
        Engel kalkar; eski fırsatlar ve görevler otomatik olarak yeniden
        açılmaz.
      </p>
      <ConfirmationField errors={state.fieldErrors}>
        İletişim engelini kaldırmak istediğimi ve eski fırsatların kapalı
        kalacağını anlıyorum.
      </ConfirmationField>
      <SubmitButton pendingLabel="İletişim engeli kaldırılıyor…">
        İletişim engelini kaldır
      </SubmitButton>
    </form>
  );
}

export function DoNotCallControl({
  opportunityId,
  active,
  canManage,
}: DoNotCallControlProps) {
  return (
    <section
      aria-labelledby="do-not-call-title"
      className={`rounded-3xl border p-5 ${
        active
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-red-700">
            İletişim güvenliği
          </p>
          <h2
            className="mt-1 text-lg font-black text-[var(--ink)]"
            id="do-not-call-title"
          >
            Aranmayacak sistemi
          </h2>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${
            active
              ? "bg-red-700 text-white"
              : "bg-amber-200 text-amber-950"
          }`}
        >
          {active ? "Engel aktif" : "Engel yok"}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--ink)]">
        {active
          ? "Bu kişi çalışma alanında iletişime kapalıdır; arama sırası ve otomatik görev önerilerine alınmaz."
          : "Etkinleştirildiğinde bu kişinin bütün açık fırsatları Aranmayacak aşamasında kapanır."}
      </p>

      {canManage ? (
        active ? (
          <LiftCommunicationBlockForm opportunityId={opportunityId} />
        ) : (
          <MarkDoNotCallForm opportunityId={opportunityId} />
        )
      ) : (
        <p className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          İletişim engelini yalnızca sahip veya danışman yönetebilir.
        </p>
      )}
    </section>
  );
}
