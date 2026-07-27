import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import {
  csvFormatVersion,
  fsboExportHeaders,
  parseFsboImportFile,
  serializeSemicolonCsv,
  type CsvImportError,
} from "@/features/csv/fsbo-csv-contract";
import {
  duplicateMatchKinds,
  type DuplicateCandidate,
  type DuplicateDecision,
} from "@/features/fsbo/duplicate-review";
import type { QuickFsboInput } from "@/features/fsbo/quick-fsbo-validation";
import { maskTurkishPhone } from "@/features/pii/phone";
import { getPiiProtectionConfig } from "@/server/pii/environment";
import { protectContactName } from "@/server/pii/protect-contact-name";
import { protectDuplicateReason } from "@/server/pii/protect-duplicate-reason";
import { protectTurkishPhone } from "@/server/pii/protect-phone";
import { decryptPii, type PiiEnvelope } from "@/server/pii/crypto-core";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { getWorkspaceAccess } from "@/server/workspace/access";
import type { Json } from "@/types/database.generated";

type CsvFileLike = {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

const candidateSchema: z.ZodType<DuplicateCandidate> = z.object({
  key: z.string().min(1).max(200),
  rank: z.number().int().min(1).max(5),
  matchKinds: z.array(z.enum(duplicateMatchKinds)).min(1).max(5),
  linkable: z.boolean(),
  listing: z.object({
    platform: z.string().max(50).nullable(),
    externalListingId: z.string().max(100).nullable(),
    transactionType: z.enum(["sale", "rent"]).nullable(),
    status: z.enum(["active", "inactive", "closed"]).nullable(),
    askingPrice: z.number().positive().nullable(),
    currency: z.string().length(3).nullable(),
    lastSeenAt: z.iso.datetime({ offset: true }).nullable(),
  }),
  property: z.object({
    city: z.string().max(100).nullable(),
    district: z.string().max(100).nullable(),
    neighborhood: z.string().max(100).nullable(),
    roomCount: z.number().int().min(0).max(100).nullable(),
    livingRoomCount: z.number().int().min(0).max(20).nullable(),
    netAreaSqm: z.number().positive().nullable(),
    grossAreaSqm: z.number().positive().nullable(),
  }),
  opportunity: z.object({
    stage: z
      .enum([
        "new",
        "verifying",
        "ready_to_call",
        "contacted",
        "follow_up",
        "analysis_preparing",
        "appointment",
        "authorization_pending",
        "converted",
        "lost",
        "do_not_call",
      ])
      .nullable(),
    nextActionAt: z.iso.datetime({ offset: true }).nullable(),
  }),
});

const previewRpcSchema = z
  .array(
    z.object({
      preview_id: z.uuid(),
      expires_at: z.iso.datetime({ offset: true }),
      rows: z.array(
        z.object({
          rowNumber: z.number().int().min(1).max(1_000),
          candidateCount: z.number().int().nonnegative(),
          candidatesTruncated: z.boolean(),
          candidates: z.array(candidateSchema).max(5),
        }),
      ),
    }),
  )
  .length(1);

const confirmRpcSchema = z
  .array(
    z.object({
      import_id: z.uuid(),
      processed_count: z.number().int().min(1).max(1_000),
      created_new_count: z.number().int().nonnegative(),
      used_existing_count: z.number().int().nonnegative(),
      linked_existing_property_count: z.number().int().nonnegative(),
      created_separate_count: z.number().int().nonnegative(),
    }),
  )
  .length(1);

const exportStageSchema = z.enum([
  "new",
  "verifying",
  "ready_to_call",
  "contacted",
  "follow_up",
  "analysis_preparing",
  "appointment",
  "authorization_pending",
  "converted",
  "lost",
  "do_not_call",
]);

const exportRowSchema = z.object({
  opportunityId: z.uuid(),
  stage: exportStageSchema,
  nextActionAt: z.iso.datetime({ offset: true }).nullable(),
  propertyType: z.enum([
    "apartment",
    "detached_house",
    "residence",
    "commercial",
    "land",
    "other",
  ]),
  city: z.string().max(100),
  district: z.string().max(100),
  neighborhood: z.string().max(100),
  roomCount: z.number().int(),
  livingRoomCount: z.number().int(),
  netAreaSqm: z.number().positive(),
  grossAreaSqm: z.number().positive(),
  platform: z.string().max(50).nullable(),
  externalListingId: z.string().max(100).nullable(),
  canonicalUrl: z.string().max(2_048).nullable(),
  transactionType: z.enum(["sale", "rent"]).nullable(),
  askingPrice: z.number().positive().nullable(),
  currency: z.string().length(3).nullable(),
  phoneCiphertextHex: z.string().nullable(),
  phoneNonceHex: z.string().nullable(),
  phoneAuthTagHex: z.string().nullable(),
  phoneAlgorithm: z.string().nullable(),
  phoneKeyVersion: z.number().int().positive().nullable(),
});

const exportRpcSchema = z
  .array(
    z.object({
      export_id: z.uuid(),
      export_version: z.literal(csvFormatVersion),
      total_count: z.number().int().nonnegative(),
      truncated: z.boolean(),
      rows: z.array(exportRowSchema).max(1_000),
    }),
  )
  .length(1);

export type CsvPreviewRow = {
  rowNumber: number;
  maskedPhone: string;
  summary: {
    platform: string;
    externalListingId: string;
    location: string;
    propertyType: QuickFsboInput["propertyType"];
    transactionType: QuickFsboInput["transactionType"];
    askingPrice: number;
    currency: "TRY";
    nextActionAt: string;
  };
  candidateCount: number;
  candidatesTruncated: boolean;
  candidates: DuplicateCandidate[];
};

export type CsvPreview = {
  previewId: string;
  expiresAt: string;
  rowCount: number;
  duplicateRowCount: number;
  rows: CsvPreviewRow[];
};

type CsvServiceErrorCode =
  | "UNAUTHENTICATED"
  | "WORKSPACE_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_CSV"
  | "PII_PROTECTION_UNAVAILABLE"
  | "CSV_PREVIEW_UNAVAILABLE"
  | "CSV_IMPORT_STALE"
  | "DUPLICATE_REVIEW_REQUIRED"
  | "CSV_IMPORT_UNAVAILABLE"
  | "CSV_EXPORT_UNAVAILABLE";

export type CsvServiceError = {
  code: CsvServiceErrorCode;
  message: string;
  validationErrors?: CsvImportError[];
};

export type CsvImportDecisionMap = Readonly<Record<number, DuplicateDecision>>;

function toPostgresBytea(value: Buffer | Uint8Array) {
  return `\\x${Buffer.from(value).toString("hex")}`;
}

function fileSha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest();
}

function commonDatabaseRow(input: QuickFsboInput, protectedPhone: {
  blindIndex: Buffer;
  blindIndexKeyVersion: number;
}) {
  return {
    phone_blind_index: toPostgresBytea(protectedPhone.blindIndex),
    phone_blind_index_key_version: protectedPhone.blindIndexKeyVersion,
    property_type: input.propertyType,
    city: input.city,
    district: input.district,
    neighborhood: input.neighborhood,
    room_count: input.roomCount,
    living_room_count: input.livingRoomCount,
    net_area_sqm: input.netAreaSqm,
    gross_area_sqm: input.grossAreaSqm,
    platform: input.platform,
    external_listing_id: input.externalListingId,
    canonical_url: input.canonicalUrl,
    transaction_type: input.transactionType,
    asking_price: input.askingPrice,
    next_action_at: input.nextActionAt,
  };
}

function accessError(
  code: "UNAUTHENTICATED" | "WORKSPACE_REQUIRED" | "FORBIDDEN",
  message: string,
): { ok: false; error: CsvServiceError } {
  return { ok: false, error: { code, message } };
}

async function checkCsvAccess(
  unavailableCode:
    | "CSV_PREVIEW_UNAVAILABLE"
    | "CSV_IMPORT_UNAVAILABLE"
    | "CSV_EXPORT_UNAVAILABLE",
) {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });

  if (!access.ok) {
    if (access.error.code === "WORKSPACE_SERVICE_UNAVAILABLE") {
      return {
        ok: false as const,
        error: {
          code: unavailableCode,
          message: "CSV işlemi şu anda kullanılamıyor. Lütfen yeniden deneyin.",
        } satisfies CsvServiceError,
      };
    }

    return accessError(
      access.error.code,
      access.error.message,
    );
  }

  return { ok: true as const };
}

export async function previewCsvFsboImport(
  file: CsvFileLike,
  now = new Date(),
): Promise<{ ok: true; data: CsvPreview } | { ok: false; error: CsvServiceError }> {
  const access = await checkCsvAccess("CSV_PREVIEW_UNAVAILABLE");

  if (!access.ok) {
    return access;
  }

  const parsedFile = await parseFsboImportFile(file, now);

  if (!parsedFile.ok) {
    return {
      ok: false,
      error: {
        code: "INVALID_CSV",
        message:
          "CSV doğrulanamadı. Hiçbir kayıt oluşturulmadı; belirtilen satırları düzeltin.",
        validationErrors: parsedFile.errors,
      },
    };
  }

  const protectedPhones = parsedFile.data.inputs.map((input) =>
    protectTurkishPhone(input.phone),
  );

  if (protectedPhones.some((phone) => !phone.ok)) {
    return {
      ok: false,
      error: {
        code: "PII_PROTECTION_UNAVAILABLE",
        message:
          "Telefonlar güvenli biçimde denetlenemedi. Hiçbir kayıt oluşturulmadı.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "CSV_PREVIEW_UNAVAILABLE",
        message: "CSV önizlemesi oluşturulamadı. Lütfen yeniden deneyin.",
      },
    };
  }

  const requestRows = parsedFile.data.inputs.map((input, index) => {
    const phone = protectedPhones[index];

    if (!phone?.ok) {
      throw new Error("Korunan telefon dizisi tutarsız.");
    }

    return commonDatabaseRow(input, phone.data);
  });
  const { data, error } = await clientResult.client.rpc(
    "preview_csv_fsbo_import",
    {
      requested_file_sha256: toPostgresBytea(
        fileSha256(parsedFile.data.bytes),
      ),
      requested_rows: requestRows as Json,
    },
  );

  if (error) {
    return {
      ok: false,
      error: {
        code: error.code === "42501" ? "FORBIDDEN" : "CSV_PREVIEW_UNAVAILABLE",
        message:
          error.code === "42501"
            ? "CSV önizlemesi için sahip veya danışman olmalısınız."
            : "CSV önizlemesi oluşturulamadı. Lütfen yeniden deneyin.",
      },
    };
  }

  const result = previewRpcSchema.safeParse(data);

  if (!result.success || result.data[0]?.rows.length !== requestRows.length) {
    return {
      ok: false,
      error: {
        code: "CSV_PREVIEW_UNAVAILABLE",
        message: "CSV önizlemesi oluşturulamadı. Lütfen yeniden deneyin.",
      },
    };
  }

  const rpcPreview = result.data[0];
  const rows = rpcPreview.rows.map((rpcRow, index) => {
    const input = parsedFile.data.inputs[index];
    const phone = protectedPhones[index];

    if (!input || !phone?.ok) {
      throw new Error("CSV önizleme satırları tutarsız.");
    }

    return {
      rowNumber: rpcRow.rowNumber,
      maskedPhone: phone.data.maskedValue,
      summary: {
        platform: input.platform,
        externalListingId: input.externalListingId,
        location: [input.neighborhood, input.district, input.city].join(" · "),
        propertyType: input.propertyType,
        transactionType: input.transactionType,
        askingPrice: input.askingPrice,
        currency: "TRY" as const,
        nextActionAt: input.nextActionAt,
      },
      candidateCount: rpcRow.candidateCount,
      candidatesTruncated: rpcRow.candidatesTruncated,
      candidates: rpcRow.candidates,
    };
  });

  return {
    ok: true,
    data: {
      previewId: rpcPreview.preview_id,
      expiresAt: rpcPreview.expires_at,
      rowCount: rows.length,
      duplicateRowCount: rows.filter((row) => row.candidateCount > 0).length,
      rows,
    },
  };
}

export async function confirmCsvFsboImport(
  previewId: string,
  file: CsvFileLike,
  decisions: CsvImportDecisionMap,
  now = new Date(),
): Promise<
  | {
      ok: true;
      data: {
        importId: string;
        processedCount: number;
        createdNewCount: number;
        usedExistingCount: number;
        linkedExistingPropertyCount: number;
        createdSeparateCount: number;
      };
    }
  | { ok: false; error: CsvServiceError }
> {
  const access = await checkCsvAccess("CSV_IMPORT_UNAVAILABLE");

  if (!access.ok) {
    return access;
  }

  const parsedFile = await parseFsboImportFile(file, now);

  if (!parsedFile.ok) {
    return {
      ok: false,
      error: {
        code: "INVALID_CSV",
        message:
          "Onay dosyası doğrulanamadı. Hiçbir kayıt oluşturulmadı.",
        validationErrors: parsedFile.errors,
      },
    };
  }

  const protectedRows: Json[] = [];
  const protectedDecisions: Record<string, Json> = {};

  for (let index = 0; index < parsedFile.data.inputs.length; index += 1) {
    const input = parsedFile.data.inputs[index];

    if (!input) {
      continue;
    }

    const phone = protectTurkishPhone(input.phone);
    const name = protectContactName(input.contactName);

    if (!phone.ok || !name.ok) {
      return {
        ok: false,
        error: {
          code: "PII_PROTECTION_UNAVAILABLE",
          message:
            "Kişisel veriler güvenli biçimde korunamadı. Hiçbir kayıt oluşturulmadı.",
        },
      };
    }

    const rowNumber = index + 1;
    const decision = decisions[rowNumber];
    const reason =
      decision?.decision === "keep_separate" && decision.separationReason
        ? protectDuplicateReason(decision.separationReason)
        : null;

    if (reason && !reason.ok) {
      return {
        ok: false,
        error: {
          code: "PII_PROTECTION_UNAVAILABLE",
          message:
            "Mükerrer gerekçesi güvenli biçimde korunamadı. Hiçbir kayıt oluşturulmadı.",
        },
      };
    }

    const phoneEnvelope = phone.data.envelope;
    const row = {
      ...commonDatabaseRow(input, phone.data),
      display_name_ciphertext: toPostgresBytea(name.data.ciphertext),
      display_name_nonce: toPostgresBytea(name.data.nonce),
      display_name_auth_tag: toPostgresBytea(name.data.authTag),
      display_name_algorithm: name.data.algorithm,
      display_name_key_version: name.data.keyVersion,
      phone_ciphertext: toPostgresBytea(phoneEnvelope.ciphertext),
      phone_nonce: toPostgresBytea(phoneEnvelope.nonce),
      phone_auth_tag: toPostgresBytea(phoneEnvelope.authTag),
      phone_algorithm: phoneEnvelope.algorithm,
      phone_key_version: phoneEnvelope.keyVersion,
    };
    protectedRows.push(row as Json);

    if (decision) {
      protectedDecisions[String(rowNumber)] = {
        decision: decision.decision,
        candidate_key: decision.candidateKey,
        ...(reason?.ok
          ? {
              reason_ciphertext: toPostgresBytea(reason.data.ciphertext),
              reason_nonce: toPostgresBytea(reason.data.nonce),
              reason_auth_tag: toPostgresBytea(reason.data.authTag),
              reason_algorithm: reason.data.algorithm,
              reason_key_version: reason.data.keyVersion,
            }
          : {}),
      };
    }
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "CSV_IMPORT_UNAVAILABLE",
        message: "CSV içe aktarılamadı. Lütfen yeniden deneyin.",
      },
    };
  }

  const { data, error } = await clientResult.client.rpc(
    "confirm_csv_fsbo_import",
    {
      requested_preview_id: previewId,
      requested_file_sha256: toPostgresBytea(
        fileSha256(parsedFile.data.bytes),
      ),
      requested_rows: protectedRows,
      requested_decisions: protectedDecisions,
    },
  );

  if (error) {
    const code =
      error.code === "42501"
        ? "FORBIDDEN"
        : error.code === "22023"
          ? "CSV_IMPORT_STALE"
          : error.code === "P0001"
            ? "DUPLICATE_REVIEW_REQUIRED"
            : "CSV_IMPORT_UNAVAILABLE";
    const messageByCode: Record<typeof code, string> = {
      FORBIDDEN: "CSV içe aktarma için sahip veya danışman olmalısınız.",
      CSV_IMPORT_STALE:
        "Önizleme değişmiş veya süresi dolmuş. Dosyayı yeniden önizleyin.",
      DUPLICATE_REVIEW_REQUIRED:
        "Mükerrer adaylar için açık kullanıcı kararı gerekiyor.",
      CSV_IMPORT_UNAVAILABLE:
        "CSV içe aktarılamadı. Hiçbir satır kaydedilmedi; yeniden deneyin.",
    };

    return { ok: false, error: { code, message: messageByCode[code] } };
  }

  const result = confirmRpcSchema.safeParse(data);
  const imported = result.success ? result.data[0] : null;

  if (!imported) {
    return {
      ok: false,
      error: {
        code: "CSV_IMPORT_UNAVAILABLE",
        message: "CSV içe aktarılamadı. Lütfen yeniden deneyin.",
      },
    };
  }

  return {
    ok: true,
    data: {
      importId: imported.import_id,
      processedCount: imported.processed_count,
      createdNewCount: imported.created_new_count,
      usedExistingCount: imported.used_existing_count,
      linkedExistingPropertyCount:
        imported.linked_existing_property_count,
      createdSeparateCount: imported.created_separate_count,
    },
  };
}

function decodeEnvelope(
  row: z.infer<typeof exportRowSchema>,
): PiiEnvelope | null {
  if (
    row.phoneCiphertextHex === null &&
    row.phoneNonceHex === null &&
    row.phoneAuthTagHex === null &&
    row.phoneAlgorithm === null &&
    row.phoneKeyVersion === null
  ) {
    return null;
  }

  if (
    !row.phoneCiphertextHex ||
    !row.phoneNonceHex ||
    !row.phoneAuthTagHex ||
    row.phoneAlgorithm !== "AES-256-GCM" ||
    !row.phoneKeyVersion ||
    !/^[0-9a-f]+$/i.test(row.phoneCiphertextHex) ||
    !/^[0-9a-f]+$/i.test(row.phoneNonceHex) ||
    !/^[0-9a-f]+$/i.test(row.phoneAuthTagHex)
  ) {
    throw new Error("Geçersiz telefon zarfı.");
  }

  return {
    ciphertext: Buffer.from(row.phoneCiphertextHex, "hex"),
    nonce: Buffer.from(row.phoneNonceHex, "hex"),
    authTag: Buffer.from(row.phoneAuthTagHex, "hex"),
    algorithm: "AES-256-GCM",
    keyVersion: row.phoneKeyVersion,
  };
}

export async function exportWorkspaceFsboCsv(): Promise<
  | {
      ok: true;
      data: {
        content: string;
        filename: string;
        totalCount: number;
        truncated: boolean;
      };
    }
  | { ok: false; error: CsvServiceError }
> {
  const access = await checkCsvAccess("CSV_EXPORT_UNAVAILABLE");

  if (!access.ok) {
    return access;
  }

  const configuration = getPiiProtectionConfig();

  if (!configuration.ok) {
    return {
      ok: false,
      error: {
        code: "PII_PROTECTION_UNAVAILABLE",
        message: "Maskeli CSV için kişisel veri koruması hazır değil.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "CSV_EXPORT_UNAVAILABLE",
        message: "CSV dışa aktarılamadı. Lütfen yeniden deneyin.",
      },
    };
  }

  const { data, error } = await clientResult.client.rpc(
    "export_workspace_fsbo_csv",
  );

  if (error) {
    return {
      ok: false,
      error: {
        code: error.code === "42501" ? "FORBIDDEN" : "CSV_EXPORT_UNAVAILABLE",
        message:
          error.code === "42501"
            ? "CSV dışa aktarma için sahip veya danışman olmalısınız."
            : "CSV dışa aktarılamadı. Lütfen yeniden deneyin.",
      },
    };
  }

  const result = exportRpcSchema.safeParse(data);
  const exported = result.success ? result.data[0] : null;

  if (!exported) {
    return {
      ok: false,
      error: {
        code: "CSV_EXPORT_UNAVAILABLE",
        message: "CSV dışa aktarılamadı. Lütfen yeniden deneyin.",
      },
    };
  }

  try {
    const rows = exported.rows.map((row) => {
      const envelope = decodeEnvelope(row);
      let maskedPhone = "";

      if (envelope) {
        const decrypted = decryptPii(
          envelope,
          "contact.phone",
          configuration.data.encryption.keys,
        );

        if (!decrypted.ok) {
          throw new Error("Telefon çözülemedi.");
        }

        maskedPhone = maskTurkishPhone(decrypted.data);
      }

      return [
        row.opportunityId,
        row.stage,
        row.platform,
        row.externalListingId,
        row.canonicalUrl,
        row.transactionType,
        row.propertyType,
        row.city,
        row.district,
        row.neighborhood,
        row.roomCount,
        row.livingRoomCount,
        row.netAreaSqm.toFixed(2),
        row.grossAreaSqm.toFixed(2),
        row.askingPrice?.toFixed(2) ?? null,
        row.currency,
        maskedPhone,
        row.nextActionAt,
      ];
    });

    return {
      ok: true,
      data: {
        content: serializeSemicolonCsv(fsboExportHeaders, rows),
        filename: `portfoy-radar-fsbo-${new Date().toISOString().slice(0, 10)}.csv`,
        totalCount: exported.total_count,
        truncated: exported.truncated,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "CSV_EXPORT_UNAVAILABLE",
        message:
          "Maskeli CSV güvenli biçimde hazırlanamadı. Lütfen yeniden deneyin.",
      },
    };
  }
}
