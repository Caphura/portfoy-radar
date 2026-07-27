import "server-only";

import type { FieldObservationDetail } from "./contracts";
import { revealFieldLocation } from "./location-crypto";
import { loadSecureFieldObservation } from "./secure-record";
import { getWorkspaceAccess } from "@/server/workspace/access";

export type GetFieldObservationDetailResult =
  | { ok: true; data: FieldObservationDetail }
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

export async function getFieldObservationDetail(
  observationId: string,
): Promise<GetFieldObservationDetailResult> {
  const [record, access] = await Promise.all([
    loadSecureFieldObservation(observationId),
    getWorkspaceAccess({ allowedRoles: ["owner", "advisor"] }),
  ]);

  if (!record.ok) {
    return record;
  }

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

  const location = record.data.locationEnvelope
    ? revealFieldLocation(record.data.locationEnvelope)
    : null;

  if (location && !location.ok) {
    return {
      ok: false,
      error: {
        code: "FIELD_OBSERVATION_UNAVAILABLE",
        message: "Konum bilgisi güvenli biçimde doğrulanamadı.",
      },
    };
  }

  return {
    ok: true,
    data: {
      id: record.data.id,
      observedAt: record.data.observedAt,
      createdAt: record.data.createdAt,
      status: record.data.status,
      hasLocation: Boolean(location?.ok),
      locationAccuracy: location?.ok ? location.data.accuracy : null,
      isLinked: Boolean(record.data.listingId),
      listingId: record.data.listingId,
      opportunityId: record.data.opportunityId,
      createdByCurrentUser: record.data.createdBy === access.userId,
    },
  };
}
