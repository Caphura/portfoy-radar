import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { toPostgresBytea } from "@/server/database/bytea";
import { createAdminSupabaseClient } from "@/server/supabase/admin-client";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { callUntypedRpc } from "@/server/supabase/untyped-rpc";
import { getWorkspaceAccess } from "@/server/workspace/access";

import {
  fieldObservationCreateInputSchema,
} from "./contracts";
import { sanitizeFieldPhoto } from "./image-sanitizer";
import { protectFieldLocation } from "./location-crypto";
import { getMediaProtectionConfig } from "./media-config";
import { encryptMedia } from "./media-crypto";
import { getFieldObservationMode } from "./mode";

const storageBucket = "field-observation-media";
const freeStorageSafetyLimit = Math.floor(1_073_741_824 * 0.9);

const pendingResultSchema = z
  .array(
    z.object({
      observation_id: z.uuid(),
      status: z.literal("upload_pending"),
    }),
  )
  .length(1);

const finalizeResultSchema = z
  .array(
    z.object({
      observation_id: z.uuid(),
      status: z.literal("ready"),
    }),
  )
  .length(1);

export type CreateFieldObservationResult =
  | {
      ok: true;
      data: {
        observationId: string;
        mode: "synthetic" | "live";
      };
    }
  | {
      ok: false;
      error: {
        code:
          | "UNAUTHENTICATED"
          | "FORBIDDEN"
          | "WORKSPACE_REQUIRED"
          | "FIELD_OBSERVATION_DISABLED"
          | "INVALID_INPUT"
          | "IMAGE_REJECTED"
          | "LOCATION_PROTECTION_FAILED"
          | "MEDIA_PROTECTION_FAILED"
          | "STORAGE_LIMIT_REACHED"
          | "FIELD_OBSERVATION_UNAVAILABLE";
        message: string;
      };
    };

async function storageHasCapacity(
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  workspaceId: string,
  incomingBytes: number,
) {
  if (!adminClient.ok) {
    return false;
  }

  const { data, error } = await adminClient.client
    .from("field_observation_media")
    .select("byte_size")
    .eq("workspace_id", workspaceId)
    .not("uploaded_at", "is", null);

  const rows = z
    .array(z.object({ byte_size: z.number().int().nullable() }))
    .safeParse(data);

  if (error || !rows.success) {
    return false;
  }

  const usedBytes = rows.data.reduce(
    (total, row) =>
      total +
      (typeof row.byte_size === "number" && Number.isFinite(row.byte_size)
        ? row.byte_size
        : 0),
    0,
  );

  return usedBytes + incomingBytes < freeStorageSafetyLimit;
}

export async function createFieldObservation(
  photo: File,
  input: unknown,
): Promise<CreateFieldObservationResult> {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });

  if (!access.ok) {
    return {
      ok: false,
      error: {
        code:
          access.error.code === "WORKSPACE_SERVICE_UNAVAILABLE"
            ? "FIELD_OBSERVATION_UNAVAILABLE"
            : access.error.code,
        message: access.error.message,
      },
    };
  }

  const mode = getFieldObservationMode();

  if (!mode.ok) {
    return mode;
  }

  const parsedInput = fieldObservationCreateInputSchema.safeParse(input);

  if (!parsedInput.success || !(photo instanceof File)) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Fotoğraf ve gözlem zamanını kontrol edin.",
      },
    };
  }

  const observedAt = new Date(parsedInput.data.observedAt);
  const now = Date.now();

  if (
    observedAt.getTime() > now + 10 * 60 * 1_000 ||
    observedAt.getTime() < now - 30 * 24 * 60 * 60 * 1_000
  ) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Gözlem zamanı son 30 gün içinde olmalıdır.",
      },
    };
  }

  let source: Buffer;

  try {
    source = Buffer.from(await photo.arrayBuffer());
  } catch {
    return {
      ok: false,
      error: {
        code: "IMAGE_REJECTED",
        message: "Fotoğraf okunamadı. Lütfen yeniden seçin.",
      },
    };
  }

  const sanitized = await sanitizeFieldPhoto(source, photo.type);

  if (!sanitized.ok) {
    return {
      ok: false,
      error: {
        code: "IMAGE_REJECTED",
        message: sanitized.error.message,
      },
    };
  }

  const protectedLocation = parsedInput.data.location
    ? protectFieldLocation(parsedInput.data.location)
    : null;

  if (protectedLocation && !protectedLocation.ok) {
    return {
      ok: false,
      error: protectedLocation.error,
    };
  }

  const mediaConfiguration = getMediaProtectionConfig();

  if (!mediaConfiguration.ok) {
    return {
      ok: false,
      error: {
        code: "MEDIA_PROTECTION_FAILED",
        message: mediaConfiguration.error.message,
      },
    };
  }

  const encryptedMedia = encryptMedia(
    sanitized.data.data,
    mediaConfiguration.data.keys,
    mediaConfiguration.data.activeVersion,
  );

  if (!encryptedMedia.ok) {
    return {
      ok: false,
      error: encryptedMedia.error,
    };
  }

  const [session, admin] = await Promise.all([
    createSessionSupabaseClient(),
    Promise.resolve(createAdminSupabaseClient()),
  ]);

  if (
    !session.ok ||
    !admin.ok ||
    !(await storageHasCapacity(admin, access.workspace.id, encryptedMedia.data.ciphertext.length))
  ) {
    return {
      ok: false,
      error: {
        code:
          session.ok && admin.ok
            ? "STORAGE_LIMIT_REACHED"
            : "FIELD_OBSERVATION_UNAVAILABLE",
        message:
          session.ok && admin.ok
            ? "Storage kotası güvenli sınıra ulaştı. Yeni fotoğraf yüklenmedi."
            : "Güvenli kayıt servisi şu anda kullanılamıyor.",
      },
    };
  }

  const objectPath = `${access.workspace.id}/${randomUUID()}.bin`;
  const locationEnvelope =
    protectedLocation && protectedLocation.ok ? protectedLocation.data : null;
  const pendingResponse = await callUntypedRpc(
    session.client,
    "create_field_observation_pending",
    {
      requested_observed_at: parsedInput.data.observedAt,
      requested_object_path: objectPath,
      requested_location_ciphertext: locationEnvelope
        ? toPostgresBytea(locationEnvelope.ciphertext)
        : null,
      requested_location_nonce: locationEnvelope
        ? toPostgresBytea(locationEnvelope.nonce)
        : null,
      requested_location_auth_tag: locationEnvelope
        ? toPostgresBytea(locationEnvelope.authTag)
        : null,
      requested_location_algorithm: locationEnvelope?.algorithm ?? null,
      requested_location_key_version: locationEnvelope?.keyVersion ?? null,
    },
  );
  const pending = pendingResultSchema.safeParse(pendingResponse.data);

  if (pendingResponse.error || !pending.success || !pending.data[0]) {
    return {
      ok: false,
      error: {
        code:
          pendingResponse.error?.code === "42501"
            ? "FORBIDDEN"
            : "FIELD_OBSERVATION_UNAVAILABLE",
        message:
          pendingResponse.error?.code === "42501"
            ? "Saha kaydı oluşturmak için yetkiniz bulunmuyor."
            : "Güvenli kayıt başlatılamadı. Lütfen yeniden deneyin.",
      },
    };
  }

  const observationId = pending.data[0].observation_id;
  const upload = await admin.client.storage
    .from(storageBucket)
    .upload(objectPath, encryptedMedia.data.ciphertext, {
      cacheControl: "0",
      contentType: "application/octet-stream",
      upsert: false,
    });

  if (upload.error) {
    const compensation = await admin.client.storage
      .from(storageBucket)
      .remove([objectPath]);

    if (!compensation.error) {
      await admin.client
        .from("field_observations")
        .delete()
        .eq("workspace_id", access.workspace.id)
        .eq("id", observationId)
        .eq("status", "upload_pending");
    }

    return {
      ok: false,
      error: {
        code: "FIELD_OBSERVATION_UNAVAILABLE",
        message:
          "Fotoğraf güvenli depoya yazılamadı. Yarım kayıt otomatik temizliğe alındı.",
      },
    };
  }

  const finalizedResponse = await callUntypedRpc(
    session.client,
    "finalize_field_observation_upload",
    {
      requested_observation_id: observationId,
      requested_byte_size: sanitized.data.data.length,
      requested_width: sanitized.data.width,
      requested_height: sanitized.data.height,
      requested_content_sha256: toPostgresBytea(sanitized.data.sha256),
      requested_encryption_nonce: toPostgresBytea(encryptedMedia.data.nonce),
      requested_encryption_auth_tag: toPostgresBytea(
        encryptedMedia.data.authTag,
      ),
      requested_encryption_algorithm: encryptedMedia.data.algorithm,
      requested_encryption_key_version: encryptedMedia.data.keyVersion,
    },
  );
  const finalized = finalizeResultSchema.safeParse(finalizedResponse.data);

  if (finalizedResponse.error || !finalized.success) {
    const compensation = await admin.client.storage
      .from(storageBucket)
      .remove([objectPath]);

    if (!compensation.error) {
      await admin.client
        .from("field_observations")
        .delete()
        .eq("workspace_id", access.workspace.id)
        .eq("id", observationId)
        .eq("status", "upload_pending");
    }

    return {
      ok: false,
      error: {
        code: "FIELD_OBSERVATION_UNAVAILABLE",
        message:
          "Güvenli kayıt tamamlanamadı. Yarım kayıt otomatik temizliğe alındı.",
      },
    };
  }

  return {
    ok: true,
    data: {
      observationId,
      mode: mode.mode,
    },
  };
}
