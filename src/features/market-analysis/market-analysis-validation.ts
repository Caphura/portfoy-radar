import { z } from "zod";

import {
  formatIstanbulDateKey,
  parseIstanbulLocalDateTime,
} from "@/shared/time/istanbul";

export const marketAnalysisFieldNames = [
  "opportunityId",
  "transactionType",
  "currency",
  "targetAt",
] as const;
export const comparableFieldNames = [
  "marketAnalysisId",
  "opportunityId",
  "neighborhood",
  "areaSqm",
  "askingPrice",
  "observedOn",
] as const;

export type MarketAnalysisFieldName =
  (typeof marketAnalysisFieldNames)[number];
export type ComparableFieldName = (typeof comparableFieldNames)[number];
export type MarketAnalysisFieldErrors = Record<
  MarketAnalysisFieldName,
  string | null
>;
export type ComparableFieldErrors = Record<
  ComparableFieldName,
  string | null
>;

export type MarketAnalysisInput = {
  opportunityId: string;
  transactionType: "sale" | "rent";
  currency: string;
  targetAt: string;
};

export type ComparableInput = {
  marketAnalysisId: string;
  opportunityId: string;
  neighborhood: string;
  areaSqm: number;
  askingPrice: number;
  observedOn: string;
};

const marketAnalysisSchema = z.object({
  opportunityId: z.uuid("Fırsat kimliği doğrulanamadı."),
  transactionType: z.enum(["sale", "rent"], {
    error: "İşlem türünü seçin.",
  }),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Para birimi üç harfli ISO kodu olmalıdır."),
  targetAt: z.string().trim().min(1, "Analiz hedefi zorunludur."),
});

const comparableSchema = z.object({
  marketAnalysisId: z.uuid("Pazar analizi kimliği doğrulanamadı."),
  opportunityId: z.uuid("Fırsat kimliği doğrulanamadı."),
  neighborhood: z
    .string()
    .trim()
    .min(2, "Mahalle en az 2 karakter olmalıdır.")
    .max(100, "Mahalle en fazla 100 karakter olabilir."),
  areaSqm: z.string().trim().min(1, "Emsal m² değeri zorunludur."),
  askingPrice: z.string().trim().min(1, "Emsal fiyatı zorunludur."),
  observedOn: z.string().trim().min(1, "Gözlem tarihi zorunludur."),
});

function emptyErrors<T extends readonly string[]>(
  fields: T,
): Record<T[number], string | null> {
  return Object.fromEntries(fields.map((field) => [field, null])) as Record<
    T[number],
    string | null
  >;
}

export function createEmptyMarketAnalysisFieldErrors() {
  return emptyErrors(marketAnalysisFieldNames);
}

export function createEmptyComparableFieldErrors() {
  return emptyErrors(comparableFieldNames);
}

function rawString(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function collectIssues<T extends readonly string[]>(
  issues: z.core.$ZodIssue[],
  fields: T,
  errors: Record<T[number], string | null>,
) {
  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string") {
      const typedField = field as T[number];

      if (fields.includes(typedField) && !errors[typedField]) {
        errors[typedField] = issue.message;
      }
    }
  }
}

function parseTurkishDecimal(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateMarketAnalysisForm(
  formData: FormData,
  now = new Date(),
):
  | { ok: true; data: MarketAnalysisInput }
  | { ok: false; fieldErrors: MarketAnalysisFieldErrors } {
  const parsed = marketAnalysisSchema.safeParse({
    opportunityId: rawString(formData, "opportunityId"),
    transactionType: rawString(formData, "transactionType"),
    currency: rawString(formData, "currency"),
    targetAt: rawString(formData, "targetAt"),
  });
  const fieldErrors = createEmptyMarketAnalysisFieldErrors();

  if (!parsed.success) {
    collectIssues(parsed.error.issues, marketAnalysisFieldNames, fieldErrors);
    return { ok: false, fieldErrors };
  }

  const targetAt = parseIstanbulLocalDateTime(parsed.data.targetAt);

  if (!targetAt.ok) {
    fieldErrors.targetAt = "Geçerli bir Türkiye tarih ve saati seçin.";
  } else {
    const targetTime = new Date(targetAt.iso).getTime();

    if (targetTime <= now.getTime()) {
      fieldErrors.targetAt = "Analiz hedefi gelecekte olmalıdır.";
    } else if (
      targetTime >
      now.getTime() + 366 * 24 * 60 * 60 * 1_000
    ) {
      fieldErrors.targetAt = "Analiz hedefi en fazla 366 gün sonrası olabilir.";
    }
  }

  if (!targetAt.ok || Object.values(fieldErrors).some(Boolean)) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      opportunityId: parsed.data.opportunityId,
      transactionType: parsed.data.transactionType,
      currency: parsed.data.currency,
      targetAt: targetAt.iso,
    },
  };
}

export function validateComparableForm(
  formData: FormData,
  now = new Date(),
):
  | { ok: true; data: ComparableInput }
  | { ok: false; fieldErrors: ComparableFieldErrors } {
  const parsed = comparableSchema.safeParse({
    marketAnalysisId: rawString(formData, "marketAnalysisId"),
    opportunityId: rawString(formData, "opportunityId"),
    neighborhood: rawString(formData, "neighborhood"),
    areaSqm: rawString(formData, "areaSqm"),
    askingPrice: rawString(formData, "askingPrice"),
    observedOn: rawString(formData, "observedOn"),
  });
  const fieldErrors = createEmptyComparableFieldErrors();

  if (!parsed.success) {
    collectIssues(parsed.error.issues, comparableFieldNames, fieldErrors);
    return { ok: false, fieldErrors };
  }

  const areaSqm = parseTurkishDecimal(parsed.data.areaSqm);
  const askingPrice = parseTurkishDecimal(parsed.data.askingPrice);

  if (areaSqm === null || areaSqm <= 0 || areaSqm > 100_000) {
    fieldErrors.areaSqm =
      "Emsal m² değeri 0’dan büyük ve en fazla 100.000 olmalıdır.";
  }

  if (
    askingPrice === null ||
    askingPrice <= 0 ||
    askingPrice > 9_999_999_999_999.99
  ) {
    fieldErrors.askingPrice =
      "Emsal fiyatı 0’dan büyük ve izin verilen aralıkta olmalıdır.";
  }

  const observedDate = new Date(
    `${parsed.data.observedOn}T00:00:00+03:00`,
  );
  const observedValid =
    /^\d{4}-\d{2}-\d{2}$/.test(parsed.data.observedOn) &&
    !Number.isNaN(observedDate.getTime()) &&
    formatIstanbulDateKey(observedDate) === parsed.data.observedOn;
  const oldest = new Date(now);
  oldest.setUTCFullYear(oldest.getUTCFullYear() - 10);
  const todayKey = formatIstanbulDateKey(now);
  const oldestKey = formatIstanbulDateKey(oldest);

  if (
    !observedValid ||
    parsed.data.observedOn > todayKey ||
    parsed.data.observedOn < oldestKey
  ) {
    fieldErrors.observedOn =
      "Gözlem tarihi bugün veya son 10 yıl içinde olmalıdır.";
  }

  if (
    areaSqm === null ||
    askingPrice === null ||
    Object.values(fieldErrors).some(Boolean)
  ) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      marketAnalysisId: parsed.data.marketAnalysisId,
      opportunityId: parsed.data.opportunityId,
      neighborhood: parsed.data.neighborhood,
      areaSqm,
      askingPrice,
      observedOn: parsed.data.observedOn,
    },
  };
}
