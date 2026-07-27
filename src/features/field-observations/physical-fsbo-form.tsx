"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  duplicateMatchLabels,
  type DuplicateCandidate,
  type DuplicateDecision,
} from "@/features/fsbo/duplicate-review";
import {
  propertyTypeOptions,
  transactionTypeOptions,
} from "@/features/fsbo/quick-fsbo-options";

const inputClassName =
  "mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-base outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-emerald-900/5";

type Review = {
  candidates: DuplicateCandidate[];
  maskedPhone: string;
};

export function PhysicalFsboForm({
  observationId,
  defaultNextActionAt,
}: {
  observationId: string;
  defaultNextActionAt: string;
}) {
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [decision, setDecision] =
    useState<DuplicateDecision["decision"]>("use_existing");
  const [separationReason, setSeparationReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const nextActionValue = String(form.get("nextActionAt") ?? "");
    const nextActionAt = new Date(nextActionValue);
    const input = {
      contactName: form.get("contactName"),
      phone: form.get("phone"),
      propertyType: form.get("propertyType"),
      city: form.get("city"),
      district: form.get("district"),
      neighborhood: form.get("neighborhood"),
      roomCount: form.get("roomCount"),
      livingRoomCount: form.get("livingRoomCount"),
      netAreaSqm: form.get("netAreaSqm"),
      grossAreaSqm: form.get("grossAreaSqm"),
      transactionType: form.get("transactionType"),
      askingPrice: form.get("askingPrice"),
      nextActionAt: Number.isNaN(nextActionAt.getTime())
        ? nextActionValue
        : nextActionAt.toISOString(),
    };
    const selectedDecision =
      review && selectedCandidate
        ? {
            decision,
            candidateKey: selectedCandidate,
            separationReason:
              decision === "keep_separate" ? separationReason : null,
          }
        : null;

    try {
      const response = await fetch(
        `/api/workspace/field-observations/${observationId}/convert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input, decision: selectedDecision }),
          cache: "no-store",
        },
      );
      const result = (await response.json()) as {
        error?: string;
        opportunityId?: string | null;
        review?: Review;
      };

      if (response.status === 409 && result.review) {
        setReview(result.review);
        setSelectedCandidate(result.review.candidates[0]?.key ?? "");
        setError(
          "Mükerrer aday bulundu. Sistem otomatik birleştirme yapmadı; kararınızı seçin.",
        );
        return;
      }

      if (!response.ok) {
        setError(result.error ?? "FSBO dönüşümü tamamlanamadı.");
        return;
      }

      router.push(
        result.opportunityId
          ? `/workspace/radar/${result.opportunityId}`
          : `/workspace/ekle/saha/${observationId}`,
      );
      router.refresh();
    } catch {
      setError("Bağlantı kesildi. FSBO dönüşümü kaydedilmedi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-label="Fiziksel ilanı FSBO fırsatına dönüştürme formu"
      className="grid gap-5"
      onSubmit={submit}
    >
      {review ? (
        <section className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-800">
            Kullanıcı kararı gerekli
          </p>
          <h2 className="mt-2 text-xl font-black text-amber-950">
            {review.candidates.length} olası mükerrer
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Telefon yalnız {review.maskedPhone} olarak gösterilir. Fiziksel
            kayıtta platform ve URL eşleşmesi çalıştırılmadı.
          </p>
          <div className="mt-4 grid gap-3">
            {review.candidates.map((candidate) => (
              <label
                className="rounded-2xl border border-amber-200 bg-white p-4"
                key={candidate.key}
              >
                <span className="flex gap-3">
                  <input
                    checked={selectedCandidate === candidate.key}
                    className="mt-1 size-5 accent-amber-800"
                    name="candidate"
                    onChange={() => setSelectedCandidate(candidate.key)}
                    type="radio"
                  />
                  <span>
                    <span className="block text-sm font-black">
                      {candidate.matchKinds
                        .map((kind) => duplicateMatchLabels[kind])
                        .join(" · ")}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                      {[
                        candidate.property.neighborhood,
                        candidate.property.district,
                        candidate.property.roomCount !== null &&
                        candidate.property.livingRoomCount !== null
                          ? `${candidate.property.roomCount}+${candidate.property.livingRoomCount}`
                          : null,
                        candidate.property.netAreaSqm
                          ? `${candidate.property.netAreaSqm} m²`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
          <label className="mt-4 block text-sm font-black">
            Karar
            <select
              className={inputClassName}
              onChange={(event) =>
                setDecision(
                  event.target.value as DuplicateDecision["decision"],
                )
              }
              value={decision}
            >
              <option value="use_existing">Mevcut kaydı kullan</option>
              <option value="link_existing_property">
                Yeni fiziksel ilanı mevcut gayrimenkule bağla
              </option>
              <option value="keep_separate">Ayrı kayıt oluştur</option>
            </select>
          </label>
          {decision === "keep_separate" ? (
            <label className="mt-4 block text-sm font-black">
              Ayrı kayıt gerekçesi
              <textarea
                className={`${inputClassName} min-h-24 py-3`}
                maxLength={500}
                minLength={3}
                onChange={(event) => setSeparationReason(event.target.value)}
                required
                value={separationReason}
              />
            </label>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-[var(--line)] bg-white p-5 sm:p-6">
        <h2 className="text-xl font-black">Kişi ve gayrimenkul</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-black">
            Kişi adı
            <input className={inputClassName} maxLength={100} name="contactName" required />
          </label>
          <label className="text-sm font-black">
            Telefon
            <input
              autoComplete="tel"
              className={inputClassName}
              inputMode="tel"
              name="phone"
              placeholder="05xx xxx xx xx"
              required
            />
          </label>
          <label className="text-sm font-black">
            Gayrimenkul türü
            <select className={inputClassName} name="propertyType">
              {propertyTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-black">
            İl
            <input className={inputClassName} maxLength={100} name="city" required />
          </label>
          <label className="text-sm font-black">
            İlçe
            <input className={inputClassName} maxLength={100} name="district" required />
          </label>
          <label className="text-sm font-black">
            Mahalle
            <input className={inputClassName} maxLength={100} name="neighborhood" required />
          </label>
          <label className="text-sm font-black">
            Oda
            <input className={inputClassName} inputMode="numeric" name="roomCount" required />
          </label>
          <label className="text-sm font-black">
            Salon
            <input className={inputClassName} inputMode="numeric" name="livingRoomCount" required />
          </label>
          <label className="text-sm font-black">
            Net m²
            <input className={inputClassName} inputMode="decimal" name="netAreaSqm" required />
          </label>
          <label className="text-sm font-black">
            Brüt m²
            <input className={inputClassName} inputMode="decimal" name="grossAreaSqm" required />
          </label>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--line)] bg-white p-5 sm:p-6">
        <h2 className="text-xl font-black">Fiyat ve sonraki işlem</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-black">
            İşlem türü
            <select className={inputClassName} name="transactionType">
              {transactionTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-black">
            Fiyat (TRY)
            <input className={inputClassName} inputMode="decimal" name="askingPrice" required />
          </label>
          <label className="text-sm font-black sm:col-span-2">
            Sonraki arama
            <input
              className={inputClassName}
              defaultValue={defaultNextActionAt}
              name="nextActionAt"
              required
              type="datetime-local"
            />
          </label>
        </div>
      </section>

      <p className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        OCR yapılmaz; kişi, telefon, fiyat ve mülk bilgileri yalnız sizin
        girdiğiniz değerlerden oluşturulur.
      </p>

      {error ? (
        <p
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        className="min-h-14 rounded-2xl bg-[var(--brand)] px-5 text-base font-black text-white disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending
          ? "Mükerrerler denetleniyor ve kaydediliyor…"
          : review
            ? "Kararı uygula ve FSBO’ya dönüştür"
            : "Mükerrerleri denetle ve devam et"}
      </button>
    </form>
  );
}
