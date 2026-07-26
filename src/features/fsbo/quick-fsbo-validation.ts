import { z } from "zod";

import { normalizeTurkishPhone } from "@/features/pii/phone";
import type { Enums } from "@/types/database.generated";

import { canonicalizeListingUrl } from "./canonicalize-listing-url";
import type { QuickFsboPlatform } from "./quick-fsbo-options";

export const quickFsboFieldNames = [
  "contactName",
  "phone",
  "propertyType",
  "city",
  "district",
  "neighborhood",
  "roomCount",
  "livingRoomCount",
  "netAreaSqm",
  "grossAreaSqm",
  "platform",
  "externalListingId",
  "listingUrl",
  "transactionType",
  "askingPrice",
  "nextActionAt",
] as const;

export type QuickFsboFieldName = (typeof quickFsboFieldNames)[number];
export type QuickFsboFieldErrors = Record<QuickFsboFieldName, string | null>;

export type QuickFsboInput = {
  contactName: string;
  phone: string;
  propertyType: Enums<"property_type">;
  city: string;
  district: string;
  neighborhood: string;
  roomCount: number;
  livingRoomCount: number;
  netAreaSqm: number;
  grossAreaSqm: number;
  platform: QuickFsboPlatform;
  externalListingId: string;
  canonicalUrl: string;
  transactionType: Enums<"listing_transaction_type">;
  askingPrice: number;
  nextActionAt: string;
};

export type QuickFsboValidationResult =
  | {
      ok: true;
      data: QuickFsboInput;
    }
  | {
      ok: false;
      fieldErrors: QuickFsboFieldErrors;
    };

const decimalString = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .pipe(
      z
        .string()
        .regex(/^\d{1,11}(?:\.\d{1,2})?$/, `${label} geçerli bir sayı olmalıdır.`),
    )
    .transform(Number)
    .refine(
      (value) => Number.isFinite(value) && value > 0 && value <= maximum,
      `${label} 0'dan büyük ve izin verilen aralıkta olmalıdır.`,
    );

const integerString = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} tam sayı olmalıdır.`)
    .transform(Number)
    .refine(
      (value) => Number.isInteger(value) && value >= 0 && value <= maximum,
      `${label} 0-${maximum} arasında olmalıdır.`,
    );

const formSchema = z.object({
  contactName: z
    .string()
    .trim()
    .min(2, "Kişi adı en az 2 karakter olmalıdır.")
    .max(100, "Kişi adı en fazla 100 karakter olabilir."),
  phone: z.string().trim().min(1, "Telefon numarası zorunludur.").max(80),
  propertyType: z.enum([
    "apartment",
    "detached_house",
    "residence",
    "commercial",
    "land",
    "other",
  ]),
  city: z
    .string()
    .trim()
    .min(2, "İl en az 2 karakter olmalıdır.")
    .max(100, "İl en fazla 100 karakter olabilir."),
  district: z
    .string()
    .trim()
    .min(2, "İlçe en az 2 karakter olmalıdır.")
    .max(100, "İlçe en fazla 100 karakter olabilir."),
  neighborhood: z
    .string()
    .trim()
    .min(2, "Mahalle en az 2 karakter olmalıdır.")
    .max(100, "Mahalle en fazla 100 karakter olabilir."),
  roomCount: integerString("Oda sayısı", 100),
  livingRoomCount: integerString("Salon sayısı", 20),
  netAreaSqm: decimalString("Net alan", 100_000),
  grossAreaSqm: decimalString("Brüt alan", 100_000),
  platform: z.enum(["sahibinden", "hepsiemlak", "emlakjet", "other"]),
  externalListingId: z
    .string()
    .trim()
    .min(1, "İlan numarası zorunludur.")
    .max(100, "İlan numarası en fazla 100 karakter olabilir."),
  listingUrl: z.string().trim().min(1, "İlan bağlantısı zorunludur.").max(2_048),
  transactionType: z.enum(["sale", "rent"]),
  askingPrice: decimalString("İlan fiyatı", 99_999_999_999.99),
  nextActionAt: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
      "Geçerli bir sonraki arama tarihi seçin.",
    ),
});

export function createEmptyQuickFsboFieldErrors(): QuickFsboFieldErrors {
  return Object.fromEntries(
    quickFsboFieldNames.map((field) => [field, null]),
  ) as QuickFsboFieldErrors;
}

function rawString(formData: FormData, field: QuickFsboFieldName) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function formatIstanbulLocalDateTime(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function defaultQuickFsboNextActionAt(now = new Date()): string {
  return formatIstanbulLocalDateTime(new Date(now.getTime() + 60 * 60 * 1_000));
}

function parseIstanbulDateTime(
  value: string,
  now: Date,
): { ok: true; iso: string } | { ok: false; message: string } {
  const parsed = new Date(`${value}:00+03:00`);

  if (
    Number.isNaN(parsed.getTime()) ||
    formatIstanbulLocalDateTime(parsed) !== value
  ) {
    return {
      ok: false,
      message: "Geçerli bir sonraki arama tarihi seçin.",
    };
  }

  if (parsed.getTime() < now.getTime() - 5 * 60 * 1_000) {
    return {
      ok: false,
      message: "Sonraki arama zamanı geçmişte olamaz.",
    };
  }

  if (parsed.getTime() > now.getTime() + 366 * 24 * 60 * 60 * 1_000) {
    return {
      ok: false,
      message: "Sonraki arama zamanı en fazla bir yıl sonrası olabilir.",
    };
  }

  return {
    ok: true,
    iso: parsed.toISOString(),
  };
}

export function validateQuickFsboForm(
  formData: FormData,
  now = new Date(),
): QuickFsboValidationResult {
  const source = Object.fromEntries(
    quickFsboFieldNames.map((field) => [field, rawString(formData, field)]),
  );
  const parsed = formSchema.safeParse(source);
  const fieldErrors = createEmptyQuickFsboFieldErrors();

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];

      if (
        typeof field === "string" &&
        quickFsboFieldNames.includes(field as QuickFsboFieldName) &&
        !fieldErrors[field as QuickFsboFieldName]
      ) {
        fieldErrors[field as QuickFsboFieldName] = issue.message;
      }
    }

    return {
      ok: false,
      fieldErrors,
    };
  }

  const normalizedPhone = normalizeTurkishPhone(parsed.data.phone);

  if (!normalizedPhone.ok) {
    fieldErrors.phone = normalizedPhone.error.message;
  }

  const canonicalUrl = canonicalizeListingUrl(
    parsed.data.listingUrl,
    parsed.data.platform,
  );

  if (!canonicalUrl.ok) {
    fieldErrors.listingUrl = canonicalUrl.message;
  }

  const nextAction = parseIstanbulDateTime(parsed.data.nextActionAt, now);

  if (!nextAction.ok) {
    fieldErrors.nextActionAt = nextAction.message;
  }

  if (parsed.data.grossAreaSqm < parsed.data.netAreaSqm) {
    fieldErrors.grossAreaSqm = "Brüt alan net alandan küçük olamaz.";
  }

  if (
    !normalizedPhone.ok ||
    !canonicalUrl.ok ||
    !nextAction.ok ||
    fieldErrors.grossAreaSqm
  ) {
    return {
      ok: false,
      fieldErrors,
    };
  }

  return {
    ok: true,
    data: {
      contactName: parsed.data.contactName,
      phone: parsed.data.phone,
      propertyType: parsed.data.propertyType,
      city: parsed.data.city,
      district: parsed.data.district,
      neighborhood: parsed.data.neighborhood,
      roomCount: parsed.data.roomCount,
      livingRoomCount: parsed.data.livingRoomCount,
      netAreaSqm: parsed.data.netAreaSqm,
      grossAreaSqm: parsed.data.grossAreaSqm,
      platform: parsed.data.platform,
      externalListingId: parsed.data.externalListingId,
      canonicalUrl: canonicalUrl.value,
      transactionType: parsed.data.transactionType,
      askingPrice: parsed.data.askingPrice,
      nextActionAt: nextAction.iso,
    },
  };
}
