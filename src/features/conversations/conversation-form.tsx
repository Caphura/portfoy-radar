"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";

import { recordConversationAction } from "./actions";
import {
  conversationChannelLabels,
  conversationChannelValues,
  conversationResultLabels,
  conversationResultValues,
} from "./conversation-options";
import { initialConversationActionState } from "./conversation-state";
import type {
  ConversationFieldErrors,
  ConversationFieldName,
} from "./conversation-validation";

type ConversationFormProps = {
  opportunityId: string;
  defaultOccurredAt: string;
  defaultFollowUpAt: string;
  opportunityClosed: boolean;
};

const inputClassName =
  "mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-4 focus:ring-emerald-900/5";

function FieldError({
  errors,
  field,
}: {
  errors: ConversationFieldErrors;
  field: ConversationFieldName;
}) {
  const message = errors[field];

  return message ? (
    <p className="mt-2 text-sm font-semibold text-red-700" id={`${field}-error`}>
      {message}
    </p>
  ) : null;
}

function describedBy(
  errors: ConversationFieldErrors,
  field: ConversationFieldName,
  descriptionId?: string,
) {
  return [errors[field] ? `${field}-error` : null, descriptionId]
    .filter(Boolean)
    .join(" ") || undefined;
}

export function ConversationForm({
  opportunityId,
  defaultOccurredAt,
  defaultFollowUpAt,
  opportunityClosed,
}: ConversationFormProps) {
  const [state, action] = useActionState(
    recordConversationAction,
    initialConversationActionState,
  );
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);

  return (
    <section
      aria-labelledby="conversation-form-title"
      className="rounded-3xl border border-[var(--line)] bg-white p-5"
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--brand)]">
        Manuel kayıt
      </p>
      <h2
        className="mt-1 text-lg font-black text-[var(--ink)]"
        id="conversation-form-title"
      >
        Görüşme kaydet
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Bu işlem arama veya mesaj göndermez; yalnızca gerçekleşmiş görüşmeyi
        kaydeder.
      </p>

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
          <label className="text-sm font-extrabold text-[var(--ink)]">
            Görüşme kanalı
            <select
              aria-describedby={describedBy(state.fieldErrors, "channel")}
              aria-invalid={Boolean(state.fieldErrors.channel)}
              className={inputClassName}
              defaultValue="phone"
              name="channel"
            >
              {conversationChannelValues.map((channel) => (
                <option key={channel} value={channel}>
                  {conversationChannelLabels[channel]}
                </option>
              ))}
            </select>
            <FieldError errors={state.fieldErrors} field="channel" />
          </label>

          <label className="text-sm font-extrabold text-[var(--ink)]">
            Görüşme sonucu
            <select
              aria-describedby={describedBy(
                state.fieldErrors,
                "result",
                "conversation-result-help",
              )}
              aria-invalid={Boolean(state.fieldErrors.result)}
              className={inputClassName}
              defaultValue=""
              name="result"
              required
            >
              <option disabled value="">
                Sonuç seçin
              </option>
              {conversationResultValues.map((result) => (
                <option key={result} value={result}>
                  {conversationResultLabels[result]}
                </option>
              ))}
            </select>
            <FieldError errors={state.fieldErrors} field="result" />
          </label>
        </div>

        <p
          className="text-xs leading-5 text-[var(--muted)]"
          id="conversation-result-help"
        >
          “Ulaşılamadı” bir görüşme sonucudur; fırsat aşamasını otomatik
          değiştirmez.
        </p>

        <label className="block text-sm font-extrabold text-[var(--ink)]">
          Görüşme zamanı
          <input
            aria-describedby={describedBy(state.fieldErrors, "occurredAt")}
            aria-invalid={Boolean(state.fieldErrors.occurredAt)}
            className={inputClassName}
            defaultValue={defaultOccurredAt}
            name="occurredAt"
            required
            type="datetime-local"
          />
          <FieldError errors={state.fieldErrors} field="occurredAt" />
        </label>

        <label className="block text-sm font-extrabold text-[var(--ink)]">
          Görüşme notu
          <textarea
            aria-describedby={describedBy(
              state.fieldErrors,
              "note",
              "conversation-note-help",
            )}
            aria-invalid={Boolean(state.fieldErrors.note)}
            className={`${inputClassName} min-h-28 py-3`}
            maxLength={2_000}
            name="note"
            placeholder="İsteğe bağlı kısa görüşme özeti"
          />
          <FieldError errors={state.fieldErrors} field="note" />
        </label>
        <p
          className="text-xs leading-5 text-[var(--muted)]"
          id="conversation-note-help"
        >
          Not sunucuda şifrelenir; timeline, audit veya hata mesajına yazılmaz.
        </p>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-black text-[var(--ink)]">
            <input
              checked={requiresFollowUp}
              className="size-5 accent-[var(--brand)]"
              disabled={opportunityClosed}
              name="requiresFollowUp"
              onChange={(event) => setRequiresFollowUp(event.target.checked)}
              type="checkbox"
            />
            Bu görüşme takip gerektiriyor
          </label>
          {opportunityClosed ? (
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              Kapanmış fırsatta görüşme kaydı tutulabilir, ancak takip görevi
              açılamaz.
            </p>
          ) : null}

          {requiresFollowUp ? (
            <div className="mt-4 space-y-4 border-t border-[var(--line)] pt-4">
              <label className="block text-sm font-extrabold text-[var(--ink)]">
                Takip zamanı
                <input
                  aria-describedby={describedBy(
                    state.fieldErrors,
                    "followUpAt",
                  )}
                  aria-invalid={Boolean(state.fieldErrors.followUpAt)}
                  className={inputClassName}
                  defaultValue={defaultFollowUpAt}
                  name="followUpAt"
                  required
                  type="datetime-local"
                />
                <FieldError errors={state.fieldErrors} field="followUpAt" />
              </label>

              <label className="block text-sm font-extrabold text-[var(--ink)]">
                Takip amacı
                <textarea
                  aria-describedby={describedBy(
                    state.fieldErrors,
                    "followUpPurpose",
                    "follow-up-purpose-help",
                  )}
                  aria-invalid={Boolean(state.fieldErrors.followUpPurpose)}
                  className={`${inputClassName} min-h-24 py-3`}
                  maxLength={500}
                  minLength={3}
                  name="followUpPurpose"
                  placeholder="Örn. Fiyat aralığını yeniden değerlendirmek"
                  required
                />
                <FieldError
                  errors={state.fieldErrors}
                  field="followUpPurpose"
                />
              </label>
              <p
                className="text-xs leading-5 text-[var(--muted)]"
                id="follow-up-purpose-help"
              >
                Amaç şifrelenir; aynı işlemde açık görev oluşturulur ve fırsatın
                sonraki işlemi güncellenir.
              </p>
            </div>
          ) : null}
        </div>

        <SubmitButton pendingLabel="Görüşme kaydediliyor…">
          Görüşmeyi kaydet
        </SubmitButton>
      </form>
    </section>
  );
}
