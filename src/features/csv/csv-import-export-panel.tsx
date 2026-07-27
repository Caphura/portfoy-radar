"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import {
  duplicateMatchLabels,
  duplicateRankLabels,
} from "@/features/fsbo/duplicate-review";

import { manageCsvImportAction } from "./actions";
import {
  initialCsvImportActionState,
} from "./csv-import-state";
import { fsboImportHeaders } from "./fsbo-csv-contract";

const fileClassName =
  "mt-3 block min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:font-extrabold file:text-emerald-950";

function candidateSummary(
  candidate: NonNullable<
    NonNullable<typeof initialCsvImportActionState.preview>["rows"][number]
  >["candidates"][number],
) {
  return [
    candidate.listing.platform && candidate.listing.externalListingId
      ? `${candidate.listing.platform} #${candidate.listing.externalListingId}`
      : null,
    candidate.property.neighborhood,
    candidate.property.roomCount !== null &&
    candidate.property.livingRoomCount !== null
      ? `${candidate.property.roomCount}+${candidate.property.livingRoomCount}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function CsvImportExportPanel() {
  const [state, action, pending] = useActionState(
    manageCsvImportAction,
    initialCsvImportActionState,
  );
  const duplicateRows =
    state.preview?.rows.filter((row) => row.candidateCount > 0) ?? [];

  return (
    <section
      aria-labelledby="csv-title"
      className="mt-8 rounded-[2rem] border border-[var(--line)] bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand)]">
            Toplu veri
          </p>
          <h2
            className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--ink)]"
            id="csv-title"
          >
            CSV içe / dışa aktar
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Önce dosyanın tamamı doğrulanır. Onayda bütün satırlar birlikte
            kaydedilir; tek hata varsa hiçbir satır yazılmaz.
          </p>
        </div>
        <div className="grid shrink-0 gap-2">
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-extrabold text-[var(--ink)]"
            href="/api/workspace/csv/template"
          >
            Boş şablonu indir
          </a>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--ink)] px-4 py-2 text-sm font-extrabold text-white"
            href="/api/workspace/csv/export"
          >
            Maskeli CSV indir
          </a>
        </div>
      </div>

      <details className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-[var(--muted)]">
        <summary className="cursor-pointer font-extrabold text-[var(--ink)]">
          Dosya biçimi ve kabul edilen değerler
        </summary>
        <p className="mt-3 leading-6">
          UTF-8, noktalı virgül ayraçlı, en fazla 1,5 MB ve 1.000 veri satırı.
          Fiyat iki ondalıklı, para birimi TRY; tarih saat dilimli ISO 8601
          olmalıdır.
        </p>
        <p className="mt-2 break-words font-mono text-xs leading-5">
          {fsboImportHeaders.join(";")}
        </p>
        <p className="mt-2 text-xs leading-5">
          Platform: sahibinden, hepsiemlak, emlakjet, other · İşlem: sale,
          rent · Tür: apartment, detached_house, residence, commercial, land,
          other
        </p>
      </details>

      {state.formError ? (
        <div
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-900"
          role="alert"
        >
          {state.formError}
        </div>
      ) : null}

      {state.validationErrors.length > 0 ? (
        <div
          className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
          role="alert"
        >
          <h3 className="font-black text-amber-950">Düzeltilmesi gerekenler</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
            {state.validationErrors.slice(0, 20).map((error, index) => (
              <li key={`${error.rowNumber}-${error.field}-${index}`}>
                {error.rowNumber ? `${error.rowNumber}. satır · ` : ""}
                {error.field ? `${error.field}: ` : ""}
                {error.message}
              </li>
            ))}
          </ul>
          {state.validationErrors.length > 20 ? (
            <p className="mt-2 text-xs font-bold text-amber-800">
              İlk 20 hata gösteriliyor. Toplam {state.validationErrors.length}{" "}
              hata var.
            </p>
          ) : null}
        </div>
      ) : null}

      {state.success ? (
        <div
          className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
          role="status"
        >
          <h3 className="text-lg font-black">{state.success.message}</h3>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-2xl bg-white/75 p-3">
              <dt>Yeni</dt>
              <dd className="mt-1 text-xl font-black">
                {state.success.createdNewCount}
              </dd>
            </div>
            <div className="rounded-2xl bg-white/75 p-3">
              <dt>Mevcut</dt>
              <dd className="mt-1 text-xl font-black">
                {state.success.usedExistingCount}
              </dd>
            </div>
            <div className="rounded-2xl bg-white/75 p-3">
              <dt>Bağlandı</dt>
              <dd className="mt-1 text-xl font-black">
                {state.success.linkedExistingPropertyCount}
              </dd>
            </div>
            <div className="rounded-2xl bg-white/75 p-3">
              <dt>Ayrı</dt>
              <dd className="mt-1 text-xl font-black">
                {state.success.createdSeparateCount}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {!state.preview ? (
        <form action={action} className="mt-5">
          <input name="intent" type="hidden" value="preview" />
          <label className="text-sm font-black text-[var(--ink)]" htmlFor="csv-preview-file">
            İçe aktarılacak CSV
          </label>
          <input
            accept=".csv,text/csv"
            className={fileClassName}
            id="csv-preview-file"
            name="csvFile"
            required
            type="file"
          />
          <div className="mt-4 sm:w-fit">
            <SubmitButton pendingLabel="Dosyanın tamamı denetleniyor…">
              Doğrula ve önizle
            </SubmitButton>
          </div>
        </form>
      ) : (
        <form action={action} className="mt-6">
          <input name="intent" type="hidden" value="confirm" />
          <div
            className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4"
            role="status"
          >
            <h3 className="font-black text-emerald-950">
              {state.preview.rowCount} satır doğrulandı
            </h3>
            <p className="mt-1 text-sm leading-6 text-emerald-900">
              {state.preview.duplicateRowCount === 0
                ? "Veritabanında mükerrer aday bulunmadı."
                : `${state.preview.duplicateRowCount} satır için kullanıcı kararı gerekiyor.`}
              {" "}Telefonlar yalnız maskeli gösterilir.
            </p>
          </div>

          {duplicateRows.map((row) => (
            <fieldset
              className="mt-4 rounded-3xl border-2 border-amber-300 bg-amber-50 p-4"
              key={row.rowNumber}
            >
              <legend className="px-2 text-sm font-black text-amber-950">
                CSV satırı {row.rowNumber + 1}
              </legend>
              <p className="text-sm font-extrabold text-amber-950">
                {row.summary.platform} #{row.summary.externalListingId} ·{" "}
                {row.summary.location}
              </p>
              <p className="mt-1 text-xs font-bold text-amber-800">
                Telefon {row.maskedPhone} · {row.candidateCount} aday
                {row.candidatesTruncated ? " (ilk 5 gösteriliyor)" : ""}
              </p>

              <div className="mt-4 space-y-2">
                {row.candidates.map((candidate, index) => (
                  <label
                    className="flex cursor-pointer gap-3 rounded-2xl border border-amber-200 bg-white p-3"
                    key={candidate.key}
                  >
                    <input
                      className="mt-1 size-5 accent-amber-700"
                      defaultChecked={index === 0}
                      name={`candidate-${row.rowNumber}`}
                      type="radio"
                      value={candidate.key}
                    />
                    <span className="min-w-0 text-sm">
                      <span className="block font-black text-amber-950">
                        {candidate.rank}. {duplicateRankLabels[candidate.rank]}
                      </span>
                      <span className="mt-1 block text-xs font-bold text-amber-800">
                        {candidate.matchKinds
                          .map((kind) => duplicateMatchLabels[kind])
                          .join(" · ")}
                      </span>
                      <span className="mt-1 block text-[var(--muted)]">
                        {candidateSummary(candidate) || "Korumalı mevcut kayıt"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <label
                className="mt-4 block text-sm font-black text-amber-950"
                htmlFor={`decision-${row.rowNumber}`}
              >
                Kullanıcı kararı
              </label>
              <select
                className="mt-2 min-h-12 w-full rounded-2xl border border-amber-300 bg-white px-4 text-base"
                defaultValue=""
                id={`decision-${row.rowNumber}`}
                name={`decision-${row.rowNumber}`}
                required
              >
                <option disabled value="">Karar seçin</option>
                <option value="use_existing">Mevcut kaydı kullan</option>
                <option value="link_existing_property">
                  İlanı mevcut gayrimenkule bağla
                </option>
                <option value="keep_separate">Ayrı kayıt oluştur</option>
              </select>
              <label
                className="mt-3 block text-sm font-black text-amber-950"
                htmlFor={`reason-${row.rowNumber}`}
              >
                Ayrı kayıt gerekçesi
              </label>
              <textarea
                className="mt-2 min-h-24 w-full rounded-2xl border border-amber-300 bg-white p-3 text-base"
                id={`reason-${row.rowNumber}`}
                maxLength={500}
                name={`reason-${row.rowNumber}`}
                placeholder="Yalnız “Ayrı kayıt oluştur” kararında zorunludur."
              />
              {state.decisionErrors[row.rowNumber] ? (
                <p className="mt-2 text-sm font-bold text-red-700" role="alert">
                  {state.decisionErrors[row.rowNumber]}
                </p>
              ) : null}
            </fieldset>
          ))}

          <div className="mt-5 rounded-2xl border border-[var(--line)] bg-slate-50 p-4">
            <label
              className="text-sm font-black text-[var(--ink)]"
              htmlFor="csv-confirm-file"
            >
              Onay için aynı CSV dosyasını yeniden seçin
            </label>
            <input
              accept=".csv,text/csv"
              className={fileClassName}
              id="csv-confirm-file"
              name="csvFile"
              required
              type="file"
            />
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              Dosya özeti önizlemeyle eşleşmezse işlem durur. Onay hiçbir
              otomatik arama veya mesaj göndermez.
            </p>
          </div>
          <div className="mt-4 sm:w-fit">
            <SubmitButton pendingLabel="Tüm satırlar tek işlemde kaydediliyor…">
              {state.preview.rowCount} satırı içe aktar
            </SubmitButton>
          </div>
          {pending ? (
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
              Bu sırada sayfayı kapatmayın.
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
