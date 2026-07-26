"use client";

import Link from "next/link";
import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";

import { createQuickFsboAction } from "./actions";
import {
  propertyTypeOptions,
  quickFsboPlatformOptions,
  transactionTypeOptions,
} from "./quick-fsbo-options";
import { initialQuickFsboActionState } from "./quick-fsbo-state";
import type {
  QuickFsboFieldErrors,
  QuickFsboFieldName,
} from "./quick-fsbo-validation";

type QuickFsboFormProps = {
  defaultNextActionAt: string;
};

const inputClassName =
  "mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-4 focus:ring-emerald-900/5";

function FieldError({
  errors,
  field,
}: {
  errors: QuickFsboFieldErrors;
  field: QuickFsboFieldName;
}) {
  const message = errors[field];

  return message ? (
    <p className="mt-2 text-sm font-semibold text-red-700" id={`${field}-error`}>
      {message}
    </p>
  ) : null;
}

function describedBy(errors: QuickFsboFieldErrors, field: QuickFsboFieldName) {
  return errors[field] ? `${field}-error` : undefined;
}

function SuccessSummary({
  maskedPhone,
  nextActionAt,
  message,
}: {
  maskedPhone: string;
  nextActionAt: string;
  message: string;
}) {
  const formattedNextAction = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(nextActionAt));

  return (
    <section
      className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
      role="status"
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">
        Kayıt tamamlandı
      </p>
      <h2 className="mt-2 text-lg font-black">{message}</h2>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-white/75 px-4 py-3">
          <dt className="font-semibold text-emerald-800">Telefon</dt>
          <dd className="mt-1 font-extrabold">{maskedPhone}</dd>
        </div>
        <div className="rounded-2xl bg-white/75 px-4 py-3">
          <dt className="font-semibold text-emerald-800">Sonraki işlem</dt>
          <dd className="mt-1 font-extrabold">Ara · {formattedNextAction}</dd>
        </div>
      </dl>
      <Link
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-800 px-4 py-2 text-sm font-extrabold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
        href="/workspace"
      >
        Ana sayfaya dön
      </Link>
      <form action="/workspace/ekle" className="ml-2 mt-4 inline-flex" method="get">
        <button
          className="min-h-11 rounded-2xl border border-emerald-300 bg-white px-4 py-2 text-sm font-extrabold text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          type="submit"
        >
          Yeni FSBO ekle
        </button>
      </form>
    </section>
  );
}

export function QuickFsboForm({
  defaultNextActionAt,
}: QuickFsboFormProps) {
  const [state, action] = useActionState(
    createQuickFsboAction,
    initialQuickFsboActionState,
  );

  if (state.success) {
    return <SuccessSummary {...state.success} />;
  }

  return (
    <form
        action={action}
        aria-label="Hızlı FSBO ekleme formu"
        className="space-y-5"
        noValidate
      >
        {state.formError ? (
          <p
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
            role="alert"
          >
            {state.formError}
          </p>
        ) : null}

        <fieldset className="rounded-3xl border border-[var(--line)] bg-white p-4 sm:p-5">
          <legend className="px-2 text-base font-black text-[var(--ink)]">
            1 · Mülk sahibi
          </legend>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Ad ve telefon uygulama sunucusunda şifrelenir; başarı ekranında telefon
            maskeli gösterilir.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-[var(--ink)]" htmlFor="contactName">
                Kişi adı
              </label>
              <input
                aria-describedby={describedBy(state.fieldErrors, "contactName")}
                aria-invalid={Boolean(state.fieldErrors.contactName)}
                autoComplete="name"
                className={inputClassName}
                id="contactName"
                maxLength={100}
                name="contactName"
                placeholder="Örn. Mülk sahibi"
                required
                type="text"
              />
              <FieldError errors={state.fieldErrors} field="contactName" />
            </div>

            <div>
              <label className="text-sm font-bold text-[var(--ink)]" htmlFor="phone">
                Türkiye telefonu
              </label>
              <input
                aria-describedby={describedBy(state.fieldErrors, "phone")}
                aria-invalid={Boolean(state.fieldErrors.phone)}
                autoComplete="tel"
                className={inputClassName}
                id="phone"
                inputMode="tel"
                maxLength={80}
                name="phone"
                placeholder="05xx xxx xx xx"
                required
                type="tel"
              />
              <FieldError errors={state.fieldErrors} field="phone" />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-3xl border border-[var(--line)] bg-white p-4 sm:p-5">
          <legend className="px-2 text-base font-black text-[var(--ink)]">
            2 · Gayrimenkul
          </legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-[var(--ink)]" htmlFor="propertyType">
                Gayrimenkul türü
              </label>
              <select
                aria-describedby={describedBy(state.fieldErrors, "propertyType")}
                aria-invalid={Boolean(state.fieldErrors.propertyType)}
                className={inputClassName}
                defaultValue="apartment"
                id="propertyType"
                name="propertyType"
              >
                {propertyTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldError errors={state.fieldErrors} field="propertyType" />
            </div>

            <div>
              <label className="text-sm font-bold text-[var(--ink)]" htmlFor="city">
                İl
              </label>
              <input
                aria-describedby={describedBy(state.fieldErrors, "city")}
                aria-invalid={Boolean(state.fieldErrors.city)}
                autoComplete="address-level1"
                className={inputClassName}
                defaultValue="İstanbul"
                id="city"
                maxLength={100}
                name="city"
                required
                type="text"
              />
              <FieldError errors={state.fieldErrors} field="city" />
            </div>

            <div>
              <label className="text-sm font-bold text-[var(--ink)]" htmlFor="district">
                İlçe
              </label>
              <input
                aria-describedby={describedBy(state.fieldErrors, "district")}
                aria-invalid={Boolean(state.fieldErrors.district)}
                autoComplete="address-level2"
                className={inputClassName}
                id="district"
                maxLength={100}
                name="district"
                required
                type="text"
              />
              <FieldError errors={state.fieldErrors} field="district" />
            </div>

            <div>
              <label className="text-sm font-bold text-[var(--ink)]" htmlFor="neighborhood">
                Mahalle
              </label>
              <input
                aria-describedby={describedBy(state.fieldErrors, "neighborhood")}
                aria-invalid={Boolean(state.fieldErrors.neighborhood)}
                className={inputClassName}
                id="neighborhood"
                maxLength={100}
                name="neighborhood"
                required
                type="text"
              />
              <FieldError errors={state.fieldErrors} field="neighborhood" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="text-sm font-bold text-[var(--ink)]" htmlFor="roomCount">
                Oda
              </label>
              <input
                aria-describedby={describedBy(state.fieldErrors, "roomCount")}
                aria-invalid={Boolean(state.fieldErrors.roomCount)}
                className={inputClassName}
                defaultValue="2"
                id="roomCount"
                inputMode="numeric"
                max="100"
                min="0"
                name="roomCount"
                required
                type="number"
              />
              <FieldError errors={state.fieldErrors} field="roomCount" />
            </div>

            <div>
              <label
                className="text-sm font-bold text-[var(--ink)]"
                htmlFor="livingRoomCount"
              >
                Salon
              </label>
              <input
                aria-describedby={describedBy(state.fieldErrors, "livingRoomCount")}
                aria-invalid={Boolean(state.fieldErrors.livingRoomCount)}
                className={inputClassName}
                defaultValue="1"
                id="livingRoomCount"
                inputMode="numeric"
                max="20"
                min="0"
                name="livingRoomCount"
                required
                type="number"
              />
              <FieldError errors={state.fieldErrors} field="livingRoomCount" />
            </div>

            <div>
              <label className="text-sm font-bold text-[var(--ink)]" htmlFor="netAreaSqm">
                Net m²
              </label>
              <input
                aria-describedby={describedBy(state.fieldErrors, "netAreaSqm")}
                aria-invalid={Boolean(state.fieldErrors.netAreaSqm)}
                className={inputClassName}
                id="netAreaSqm"
                inputMode="decimal"
                name="netAreaSqm"
                placeholder="95"
                required
                type="text"
              />
              <FieldError errors={state.fieldErrors} field="netAreaSqm" />
            </div>

            <div>
              <label className="text-sm font-bold text-[var(--ink)]" htmlFor="grossAreaSqm">
                Brüt m²
              </label>
              <input
                aria-describedby={describedBy(state.fieldErrors, "grossAreaSqm")}
                aria-invalid={Boolean(state.fieldErrors.grossAreaSqm)}
                className={inputClassName}
                id="grossAreaSqm"
                inputMode="decimal"
                name="grossAreaSqm"
                placeholder="110"
                required
                type="text"
              />
              <FieldError errors={state.fieldErrors} field="grossAreaSqm" />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-3xl border border-[var(--line)] bg-white p-4 sm:p-5">
          <legend className="px-2 text-base font-black text-[var(--ink)]">
            3 · İlan
          </legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-[var(--ink)]" htmlFor="platform">
                Platform
              </label>
              <select
                aria-describedby={describedBy(state.fieldErrors, "platform")}
                aria-invalid={Boolean(state.fieldErrors.platform)}
                className={inputClassName}
                defaultValue="sahibinden"
                id="platform"
                name="platform"
              >
                {quickFsboPlatformOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldError errors={state.fieldErrors} field="platform" />
            </div>

            <div>
              <label
                className="text-sm font-bold text-[var(--ink)]"
                htmlFor="externalListingId"
              >
                İlan numarası
              </label>
              <input
                aria-describedby={describedBy(state.fieldErrors, "externalListingId")}
                aria-invalid={Boolean(state.fieldErrors.externalListingId)}
                className={inputClassName}
                id="externalListingId"
                maxLength={100}
                name="externalListingId"
                required
                type="text"
              />
              <FieldError errors={state.fieldErrors} field="externalListingId" />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-bold text-[var(--ink)]" htmlFor="listingUrl">
                İlan bağlantısı
              </label>
              <input
                aria-describedby={describedBy(state.fieldErrors, "listingUrl")}
                aria-invalid={Boolean(state.fieldErrors.listingUrl)}
                className={inputClassName}
                id="listingUrl"
                inputMode="url"
                maxLength={2048}
                name="listingUrl"
                placeholder="https://..."
                required
                type="url"
              />
              <FieldError errors={state.fieldErrors} field="listingUrl" />
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Bağlantı yerel olarak normalize edilir; portal sayfasına ağ isteği
                yapılmaz.
              </p>
            </div>

            <div>
              <label
                className="text-sm font-bold text-[var(--ink)]"
                htmlFor="transactionType"
              >
                İşlem türü
              </label>
              <select
                aria-describedby={describedBy(state.fieldErrors, "transactionType")}
                aria-invalid={Boolean(state.fieldErrors.transactionType)}
                className={inputClassName}
                defaultValue="sale"
                id="transactionType"
                name="transactionType"
              >
                {transactionTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldError errors={state.fieldErrors} field="transactionType" />
            </div>

            <div>
              <label className="text-sm font-bold text-[var(--ink)]" htmlFor="askingPrice">
                İlan fiyatı
              </label>
              <div className="relative">
                <input
                  aria-describedby={describedBy(state.fieldErrors, "askingPrice")}
                  aria-invalid={Boolean(state.fieldErrors.askingPrice)}
                  className={`${inputClassName} pr-16`}
                  id="askingPrice"
                  inputMode="decimal"
                  name="askingPrice"
                  placeholder="7500000"
                  required
                  type="text"
                />
                <span className="pointer-events-none absolute inset-y-2 right-4 flex items-center text-sm font-extrabold text-[var(--muted)]">
                  TRY
                </span>
              </div>
              <FieldError errors={state.fieldErrors} field="askingPrice" />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-3xl border border-[var(--line)] bg-white p-4 sm:p-5">
          <legend className="px-2 text-base font-black text-[var(--ink)]">
            4 · Sonraki işlem
          </legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-[0.7fr_1.3fr]">
            <div className="rounded-2xl bg-[var(--brand-soft)] px-4 py-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand)]">
                İşlem türü
              </p>
              <p className="mt-1 text-base font-black text-[var(--ink)]">Ara</p>
            </div>
            <div>
              <label
                className="text-sm font-bold text-[var(--ink)]"
                htmlFor="nextActionAt"
              >
                Arama tarihi ve saati
              </label>
              <input
                aria-describedby={describedBy(state.fieldErrors, "nextActionAt")}
                aria-invalid={Boolean(state.fieldErrors.nextActionAt)}
                className={inputClassName}
                defaultValue={defaultNextActionAt}
                id="nextActionAt"
                name="nextActionAt"
                required
                type="datetime-local"
              />
              <FieldError errors={state.fieldErrors} field="nextActionAt" />
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Türkiye saatiyle bir saat sonrası önerildi; kaydetmeden önce
                değiştirebilirsiniz.
              </p>
            </div>
          </div>
        </fieldset>

        <div className="rounded-3xl bg-[var(--ink)] p-5 text-white">
          <p className="text-sm font-extrabold">Kaydetme özeti</p>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Kişi, gayrimenkul, ilan, ilk fiyat ve fırsat ayrı kayıtlar olarak tek
            işlemde oluşturulur. Mükerrer sinyaller kayıtları otomatik birleştirmez.
          </p>
          <div className="mt-5">
            <SubmitButton pendingLabel="Güvenli biçimde kaydediliyor…">
              FSBO fırsatını oluştur
            </SubmitButton>
          </div>
        </div>
    </form>
  );
}
