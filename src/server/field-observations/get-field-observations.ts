import "server-only";

import { z } from "zod";

import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { callUntypedRpc } from "@/server/supabase/untyped-rpc";
import { getWorkspaceAccess } from "@/server/workspace/access";

import {
  fieldObservationSummarySchema,
  type FieldObservationSummary,
} from "./contracts";
import { getFieldObservationMode } from "./mode";

export type GetFieldObservationsResult =
  | {
      ok: true;
      data: {
        mode: "synthetic" | "live";
        observations: FieldObservationSummary[];
      };
    }
  | {
      ok: false;
      error: {
        code:
          | "UNAUTHENTICATED"
          | "WORKSPACE_REQUIRED"
          | "FORBIDDEN"
          | "FIELD_OBSERVATION_DISABLED"
          | "FIELD_OBSERVATION_UNAVAILABLE";
        message: string;
      };
    };

export async function getFieldObservations(): Promise<GetFieldObservationsResult> {
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

  const session = await createSessionSupabaseClient();

  if (!session.ok) {
    return {
      ok: false,
      error: {
        code: "FIELD_OBSERVATION_UNAVAILABLE",
        message: "Saha kayıtları şu anda yüklenemiyor.",
      },
    };
  }

  const response = await callUntypedRpc(
    session.client,
    "list_field_observations",
  );
  const parsed = z.array(fieldObservationSummarySchema).max(100).safeParse(
    response.data,
  );

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
            ? "Saha kayıtlarını görmek için yetkiniz bulunmuyor."
            : "Saha kayıtları şu anda yüklenemiyor.",
      },
    };
  }

  return {
    ok: true,
    data: {
      mode: mode.mode,
      observations: parsed.data.map((row) => ({
        id: row.observation_id,
        observedAt: row.observed_at,
        createdAt: row.created_at,
        status: row.status,
        hasLocation: row.has_location,
        isLinked: row.is_linked,
      })),
    },
  };
}
