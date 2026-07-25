import { z } from "zod";

const entityCountRowSchema = z.object({
  workspace_id: z.uuid(),
  contact_count: z.number().int().nonnegative(),
  property_count: z.number().int().nonnegative(),
  listing_count: z.number().int().nonnegative(),
});

type EntityCountQueryResult = {
  data: unknown;
  error: unknown;
};

export type WorkspaceEntitySummary = {
  contacts: number;
  properties: number;
  listings: number;
};

export type WorkspaceEntitySummaryResult =
  | {
      ok: true;
      data: WorkspaceEntitySummary;
    }
  | {
      ok: false;
      error: {
        code: "ENTITY_SUMMARY_UNAVAILABLE";
        message: string;
      };
    };

const unavailableResult: WorkspaceEntitySummaryResult = {
  ok: false,
  error: {
    code: "ENTITY_SUMMARY_UNAVAILABLE",
    message: "Kayıt özeti şu anda yüklenemiyor. Lütfen yeniden deneyin.",
  },
};

export async function resolveWorkspaceEntitySummary(
  query: () => Promise<EntityCountQueryResult>,
): Promise<WorkspaceEntitySummaryResult> {
  let result: EntityCountQueryResult;

  try {
    result = await query();
  } catch {
    return unavailableResult;
  }

  if (result.error) {
    return unavailableResult;
  }

  const row = entityCountRowSchema.safeParse(result.data);

  if (!row.success) {
    return unavailableResult;
  }

  return {
    ok: true,
    data: {
      contacts: row.data.contact_count,
      properties: row.data.property_count,
      listings: row.data.listing_count,
    },
  };
}
