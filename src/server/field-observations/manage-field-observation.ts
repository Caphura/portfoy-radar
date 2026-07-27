import "server-only";

import { z } from "zod";

import { toPostgresBytea } from "@/server/database/bytea";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { callUntypedRpc } from "@/server/supabase/untyped-rpc";
import { getWorkspaceAccess } from "@/server/workspace/access";

import { fieldLocationSchema, protectFieldLocation } from "./location-crypto";
import { observationIdSchema } from "./contracts";
import { getFieldObservationMode } from "./mode";

export type ManageFieldObservationResult =
  | { ok: true }
  | {
      ok: false;
      error: {
        code:
          | "UNAUTHENTICATED"
          | "WORKSPACE_REQUIRED"
          | "FORBIDDEN"
          | "FIELD_OBSERVATION_DISABLED"
          | "INVALID_INPUT"
          | "LOCATION_PROTECTION_FAILED"
          | "FIELD_OBSERVATION_UNAVAILABLE";
        message: string;
      };
    };

async function prepare() {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });

  if (!access.ok) {
    return {
      ok: false as const,
      error: {
        code:
          access.error.code === "WORKSPACE_SERVICE_UNAVAILABLE"
            ? ("FIELD_OBSERVATION_UNAVAILABLE" as const)
            : access.error.code,
        message: access.error.message,
      },
    };
  }

  const session = await createSessionSupabaseClient();

  if (!session.ok) {
    return {
      ok: false as const,
      error: {
        code: "FIELD_OBSERVATION_UNAVAILABLE" as const,
        message: "Saha kaydı şu anda güncellenemiyor.",
      },
    };
  }

  return { ok: true as const, session };
}

export async function updateFieldObservationLocation(
  observationId: string,
  locationInput: unknown,
): Promise<ManageFieldObservationResult> {
  const id = observationIdSchema.safeParse(observationId);
  const location = fieldLocationSchema.safeParse(locationInput);

  if (!id.success || !location.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Enlem, boylam ve konum doğruluğunu kontrol edin.",
      },
    };
  }

  const mode = getFieldObservationMode();

  if (!mode.ok) {
    return mode;
  }

  const protectedLocation = protectFieldLocation(location.data);

  if (!protectedLocation.ok) {
    return {
      ok: false,
      error: protectedLocation.error,
    };
  }

  const prepared = await prepare();

  if (!prepared.ok) {
    return prepared;
  }

  const response = await callUntypedRpc(
    prepared.session.client,
    "update_field_observation_location",
    {
      requested_observation_id: id.data,
      requested_location_ciphertext: toPostgresBytea(
        protectedLocation.data.ciphertext,
      ),
      requested_location_nonce: toPostgresBytea(protectedLocation.data.nonce),
      requested_location_auth_tag: toPostgresBytea(
        protectedLocation.data.authTag,
      ),
      requested_location_algorithm: protectedLocation.data.algorithm,
      requested_location_key_version: protectedLocation.data.keyVersion,
    },
  );

  if (response.error || response.data !== true) {
    return {
      ok: false,
      error: {
        code:
          response.error?.code === "42501"
            ? "FORBIDDEN"
            : "FIELD_OBSERVATION_UNAVAILABLE",
        message:
          response.error?.code === "42501"
            ? "Bu konumu güncellemek için yetkiniz bulunmuyor."
            : "Konum güvenli biçimde güncellenemedi.",
      },
    };
  }

  return { ok: true };
}

export async function setFieldObservationTrashState(
  observationId: string,
  trashed: boolean,
): Promise<ManageFieldObservationResult> {
  const id = observationIdSchema.safeParse(observationId);

  if (!id.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Saha kaydı bulunamadı.",
      },
    };
  }

  const prepared = await prepare();

  if (!prepared.ok) {
    return prepared;
  }

  const response = await callUntypedRpc(
    prepared.session.client,
    "set_field_observation_trash_state",
    {
      requested_observation_id: id.data,
      requested_trashed: trashed,
    },
  );
  const parsed = z
    .array(
      z.object({
        observation_id: z.uuid(),
        status: z.enum(["ready", "trashed"]),
        purge_after: z.iso.datetime({ offset: true }).nullable(),
      }),
    )
    .length(1)
    .safeParse(response.data);

  if (response.error || !parsed.success) {
    return {
      ok: false,
      error: {
        code:
          response.error?.code === "42501"
            ? "FORBIDDEN"
            : "FIELD_OBSERVATION_UNAVAILABLE",
        message:
          response.error?.code === "42501"
            ? "Bu saha kaydını yönetmek için yetkiniz bulunmuyor."
            : "Saha kaydı şu anda güncellenemiyor.",
      },
    };
  }

  return { ok: true };
}
