import "server-only";

import { z } from "zod";

import { fromPostgresBytea } from "@/server/database/bytea";
import { createAdminSupabaseClient } from "@/server/supabase/admin-client";
import { getWorkspaceAccess } from "@/server/workspace/access";

import type { PiiEnvelope } from "@/server/pii/crypto-core";

import { observationIdSchema } from "./contracts";
import type { MediaEnvelope } from "./media-crypto";

const observationRowSchema = z.object({
  id: z.uuid(),
  observed_at: z.iso.datetime({ offset: true }),
  created_at: z.iso.datetime({ offset: true }),
  created_by: z.uuid(),
  status: z.enum(["ready", "trashed"]),
  location_ciphertext: z.unknown().nullable(),
  location_nonce: z.unknown().nullable(),
  location_auth_tag: z.unknown().nullable(),
  location_algorithm: z.literal("AES-256-GCM").nullable(),
  location_key_version: z.number().int().positive().nullable(),
});

const mediaRowSchema = z.object({
  object_path: z.string().min(1).max(200),
  encryption_nonce: z.unknown(),
  encryption_auth_tag: z.unknown(),
  encryption_algorithm: z.literal("AES-256-GCM"),
  encryption_key_version: z.number().int().positive(),
  uploaded_at: z.iso.datetime({ offset: true }),
});

const linkRowSchema = z.object({
  listing_id: z.uuid(),
});

const opportunityLinkSchema = z.object({
  opportunity_id: z.uuid(),
});

export type SecureFieldObservationRecord = {
  id: string;
  workspaceId: string;
  observedAt: string;
  createdAt: string;
  createdBy: string;
  status: "ready" | "trashed";
  locationEnvelope: PiiEnvelope | null;
  media: {
    objectPath: string;
    envelope: Omit<MediaEnvelope, "ciphertext">;
  };
  listingId: string | null;
  opportunityId: string | null;
};

export type LoadSecureFieldObservationResult =
  | { ok: true; data: SecureFieldObservationRecord }
  | {
      ok: false;
      error: {
        code:
          | "UNAUTHENTICATED"
          | "WORKSPACE_REQUIRED"
          | "FORBIDDEN"
          | "NOT_FOUND"
          | "FIELD_OBSERVATION_UNAVAILABLE";
        message: string;
      };
    };

function parsePiiEnvelope(
  row: z.infer<typeof observationRowSchema>,
): PiiEnvelope | null | undefined {
  if (
    row.location_ciphertext === null &&
    row.location_nonce === null &&
    row.location_auth_tag === null &&
    row.location_algorithm === null &&
    row.location_key_version === null
  ) {
    return null;
  }

  const ciphertext = fromPostgresBytea(row.location_ciphertext);
  const nonce = fromPostgresBytea(row.location_nonce);
  const authTag = fromPostgresBytea(row.location_auth_tag);

  if (
    !ciphertext ||
    !nonce ||
    !authTag ||
    row.location_algorithm !== "AES-256-GCM" ||
    !row.location_key_version
  ) {
    return undefined;
  }

  return {
    ciphertext,
    nonce,
    authTag,
    algorithm: row.location_algorithm,
    keyVersion: row.location_key_version,
  };
}

export async function loadSecureFieldObservation(
  observationId: string,
): Promise<LoadSecureFieldObservationResult> {
  const parsedId = observationIdSchema.safeParse(observationId);

  if (!parsedId.success) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Saha kaydı bulunamadı.",
      },
    };
  }

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

  const admin = createAdminSupabaseClient();

  if (!admin.ok) {
    return {
      ok: false,
      error: {
        code: "FIELD_OBSERVATION_UNAVAILABLE",
        message: admin.error.message,
      },
    };
  }

  const [observationResponse, mediaResponse, linkResponse] = await Promise.all([
    admin.client
      .from("field_observations")
      .select(
        "id, observed_at, created_at, created_by, status, location_ciphertext, location_nonce, location_auth_tag, location_algorithm, location_key_version",
      )
      .eq("workspace_id", access.workspace.id)
      .eq("id", parsedId.data)
      .in("status", ["ready", "trashed"])
      .maybeSingle(),
    admin.client
      .from("field_observation_media")
      .select(
        "object_path, encryption_nonce, encryption_auth_tag, encryption_algorithm, encryption_key_version, uploaded_at",
      )
      .eq("workspace_id", access.workspace.id)
      .eq("observation_id", parsedId.data)
      .not("uploaded_at", "is", null)
      .maybeSingle(),
    admin.client
      .from("field_observation_listing_links")
      .select("listing_id")
      .eq("workspace_id", access.workspace.id)
      .eq("observation_id", parsedId.data)
      .maybeSingle(),
  ]);

  if (observationResponse.error || mediaResponse.error || linkResponse.error) {
    return {
      ok: false,
      error: {
        code: "FIELD_OBSERVATION_UNAVAILABLE",
        message: "Saha kaydı güvenli biçimde yüklenemedi.",
      },
    };
  }

  if (!observationResponse.data || !mediaResponse.data) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Saha kaydı bulunamadı.",
      },
    };
  }

  const observation = observationRowSchema.safeParse(observationResponse.data);
  const media = mediaRowSchema.safeParse(mediaResponse.data);
  const link = linkResponse.data
    ? linkRowSchema.safeParse(linkResponse.data)
    : null;

  if (!observation.success || !media.success || (link && !link.success)) {
    return {
      ok: false,
      error: {
        code: "FIELD_OBSERVATION_UNAVAILABLE",
        message: "Saha kaydı güvenlik sözleşmesiyle uyuşmuyor.",
      },
    };
  }

  const locationEnvelope = parsePiiEnvelope(observation.data);
  const nonce = fromPostgresBytea(media.data.encryption_nonce);
  const authTag = fromPostgresBytea(media.data.encryption_auth_tag);

  if (locationEnvelope === undefined || !nonce || !authTag) {
    return {
      ok: false,
      error: {
        code: "FIELD_OBSERVATION_UNAVAILABLE",
        message: "Saha kaydı güvenlik sözleşmesiyle uyuşmuyor.",
      },
    };
  }

  const listingId = link?.success ? link.data.listing_id : null;
  let opportunityId: string | null = null;

  if (listingId) {
    const opportunityResponse = await admin.client
      .from("opportunity_listings")
      .select("opportunity_id")
      .eq("workspace_id", access.workspace.id)
      .eq("listing_id", listingId)
      .limit(1)
      .maybeSingle();
    const opportunity = opportunityResponse.data
      ? opportunityLinkSchema.safeParse(opportunityResponse.data)
      : null;

    if (opportunityResponse.error || (opportunity && !opportunity.success)) {
      return {
        ok: false,
        error: {
          code: "FIELD_OBSERVATION_UNAVAILABLE",
          message: "Saha kaydı bağlantısı güvenli biçimde yüklenemedi.",
        },
      };
    }

    opportunityId = opportunity?.success
      ? opportunity.data.opportunity_id
      : null;
  }

  return {
    ok: true,
    data: {
      id: observation.data.id,
      workspaceId: access.workspace.id,
      observedAt: observation.data.observed_at,
      createdAt: observation.data.created_at,
      createdBy: observation.data.created_by,
      status: observation.data.status,
      locationEnvelope,
      media: {
        objectPath: media.data.object_path,
        envelope: {
          nonce,
          authTag,
          algorithm: media.data.encryption_algorithm,
          keyVersion: media.data.encryption_key_version,
        },
      },
      listingId,
      opportunityId,
    },
  };
}
