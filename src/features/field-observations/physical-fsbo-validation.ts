import { z } from "zod";

import { normalizeTurkishPhone } from "@/features/pii/phone";
import type { Enums } from "@/types/database.generated";

export type PhysicalFsboInput = {
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
  transactionType: Enums<"listing_transaction_type">;
  askingPrice: number;
  nextActionAt: string;
};

const decimal = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .pipe(z.string().regex(/^\d{1,11}(?:\.\d{1,2})?$/))
    .transform(Number)
    .refine(
      (value) => Number.isFinite(value) && value > 0 && value <= maximum,
      `${label} geçerli aralıkta olmalıdır.`,
    );

const integer = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/)
    .transform(Number)
    .refine(
      (value) => Number.isInteger(value) && value >= 0 && value <= maximum,
      `${label} 0-${maximum} arasında olmalıdır.`,
    );

const schema = z.object({
  contactName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(1).max(80),
  propertyType: z.enum([
    "apartment",
    "detached_house",
    "residence",
    "commercial",
    "land",
    "other",
  ]),
  city: z.string().trim().min(2).max(100),
  district: z.string().trim().min(2).max(100),
  neighborhood: z.string().trim().min(2).max(100),
  roomCount: integer("Oda sayısı", 100),
  livingRoomCount: integer("Salon sayısı", 20),
  netAreaSqm: decimal("Net alan", 100_000),
  grossAreaSqm: decimal("Brüt alan", 100_000),
  transactionType: z.enum(["sale", "rent"]),
  askingPrice: decimal("Fiyat", 99_999_999_999.99),
  nextActionAt: z.string().trim().min(1),
});

export function validatePhysicalFsboInput(
  input: unknown,
  now = new Date(),
):
  | { ok: true; data: PhysicalFsboInput }
  | { ok: false; message: string } {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Eksik veya hatalı ilan alanlarını kontrol edin.",
    };
  }

  const phone = normalizeTurkishPhone(parsed.data.phone);

  if (!phone.ok) {
    return {
      ok: false,
      message: phone.error.message,
    };
  }

  if (parsed.data.grossAreaSqm < parsed.data.netAreaSqm) {
    return {
      ok: false,
      message: "Brüt alan net alandan küçük olamaz.",
    };
  }

  const nextAction = new Date(parsed.data.nextActionAt);

  if (
    Number.isNaN(nextAction.getTime()) ||
    nextAction.getTime() < now.getTime() - 5 * 60 * 1_000 ||
    nextAction.getTime() > now.getTime() + 366 * 24 * 60 * 60 * 1_000
  ) {
    return {
      ok: false,
      message: "Sonraki arama zamanı şimdi ile bir yıl sonrası arasında olmalıdır.",
    };
  }

  return {
    ok: true,
    data: {
      ...parsed.data,
      phone: phone.e164,
      nextActionAt: nextAction.toISOString(),
    },
  };
}
