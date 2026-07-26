import { z } from "zod";

import type { Enums } from "@/types/database.generated";

export const duplicateMatchKinds = [
  "platform_listing",
  "canonical_url",
  "phone",
  "property_similarity",
  "closed_similar_listing",
] as const satisfies readonly Enums<"duplicate_match_kind">[];

export type DuplicateMatchKind = (typeof duplicateMatchKinds)[number];

export const duplicateMatchLabels: Record<DuplicateMatchKind, string> = {
  platform_listing: "Aynı platform ve ilan numarası",
  canonical_url: "Aynı normalize ilan bağlantısı",
  phone: "Aynı güvenli telefon eşleşmesi",
  property_similarity: "Benzer gayrimenkul ve fiyat",
  closed_similar_listing: "Son 12 ayda kapanmış benzer ilan",
};

export const duplicateRankLabels: Record<number, string> = {
  1: "Kesin ilan eşleşmesi",
  2: "Kesin bağlantı eşleşmesi",
  3: "Telefon eşleşmesi",
  4: "Gayrimenkul benzerliği",
  5: "Kapanmış ilan benzerliği",
};

export type DuplicateCandidate = {
  key: string;
  rank: number;
  matchKinds: DuplicateMatchKind[];
  linkable: boolean;
  listing: {
    platform: string | null;
    externalListingId: string | null;
    transactionType: Enums<"listing_transaction_type"> | null;
    status: Enums<"listing_status"> | null;
    askingPrice: number | null;
    currency: string | null;
    lastSeenAt: string | null;
  };
  property: {
    city: string | null;
    district: string | null;
    neighborhood: string | null;
    roomCount: number | null;
    livingRoomCount: number | null;
    netAreaSqm: number | null;
    grossAreaSqm: number | null;
  };
  opportunity: {
    stage: Enums<"opportunity_stage"> | null;
    nextActionAt: string | null;
  };
};

export type DuplicateDecision = {
  decision: Enums<"duplicate_review_decision">;
  candidateKey: string;
  separationReason: string | null;
};

export type DuplicateDecisionValidation =
  | {
      ok: true;
      data: DuplicateDecision | null;
    }
  | {
      ok: false;
      message: string;
      separationReasonError: string | null;
    };

const candidateKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|-)(?::(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|-)){3}$/,
  );

export function validateDuplicateDecisionForm(
  formData: FormData,
): DuplicateDecisionValidation {
  const rawDecision = formData.get("duplicateDecision");

  if (
    rawDecision === null ||
    rawDecision === "" ||
    rawDecision === "review_again"
  ) {
    return {
      ok: true,
      data: null,
    };
  }

  const decision = z
    .enum(["use_existing", "link_existing_property", "keep_separate"])
    .safeParse(rawDecision);
  const candidateKey = candidateKeySchema.safeParse(
    formData.get("duplicateCandidate"),
  );

  if (!decision.success || !candidateKey.success) {
    return {
      ok: false,
      message: "Devam etmek için geçerli bir mükerrer aday ve karar seçin.",
      separationReasonError: null,
    };
  }

  const rawReason = formData.get("separationReason");
  const separationReason =
    typeof rawReason === "string" ? rawReason.trim() : "";

  if (
    decision.data === "keep_separate" &&
    (separationReason.length < 3 || separationReason.length > 500)
  ) {
    return {
      ok: false,
      message: "Ayrı kayıt kararının gerekçesini kontrol edin.",
      separationReasonError: "Ayrı kayıt gerekçesi 3-500 karakter olmalıdır.",
    };
  }

  return {
    ok: true,
    data: {
      decision: decision.data,
      candidateKey: candidateKey.data,
      separationReason:
        decision.data === "keep_separate" ? separationReason : null,
    },
  };
}
