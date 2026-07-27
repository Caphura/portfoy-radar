import "server-only";

import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { callUntypedRpc } from "@/server/supabase/untyped-rpc";

export async function auditFieldObservationAccess(
  observationId: string,
  action:
    | "field_observation.photo_viewed"
    | "field_observation.maps_viewed"
    | "field_observation.directions_opened",
): Promise<boolean> {
  const session = await createSessionSupabaseClient();

  if (!session.ok) {
    return false;
  }

  const response = await callUntypedRpc(
    session.client,
    "record_field_observation_access",
    {
      requested_observation_id: observationId,
      requested_action: action,
    },
  );

  return !response.error && response.data === true;
}
