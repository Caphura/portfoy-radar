import { z } from "zod";

import {
  isClosedOpportunityStage,
  opportunityStageLabels,
  opportunityStageValues,
  type OpportunityStage,
} from "@/features/opportunities/stages";

const pipelineRowSchema = z.object({
  workspace_id: z.uuid(),
  stage: z.enum(opportunityStageValues),
  stage_order: z.number().int().min(1).max(opportunityStageValues.length),
  opportunity_count: z.number().int().nonnegative(),
});

type PipelineQueryResult = {
  data: unknown;
  error: unknown;
};

export type OpportunityPipelineStage = {
  stage: OpportunityStage;
  label: string;
  count: number;
  closed: boolean;
};

export type OpportunityPipeline = {
  stages: OpportunityPipelineStage[];
  total: number;
  open: number;
  closed: number;
};

export type OpportunityPipelineResult =
  | {
      ok: true;
      data: OpportunityPipeline;
    }
  | {
      ok: false;
      error: {
        code: "OPPORTUNITY_PIPELINE_UNAVAILABLE";
        message: string;
      };
    };

const unavailableResult: OpportunityPipelineResult = {
  ok: false,
  error: {
    code: "OPPORTUNITY_PIPELINE_UNAVAILABLE",
    message: "Fırsat hunisi şu anda yüklenemiyor. Lütfen yeniden deneyin.",
  },
};

export async function resolveOpportunityPipeline(
  query: () => Promise<PipelineQueryResult>,
): Promise<OpportunityPipelineResult> {
  let result: PipelineQueryResult;

  try {
    result = await query();
  } catch {
    return unavailableResult;
  }

  if (result.error) {
    return unavailableResult;
  }

  const rows = z.array(pipelineRowSchema).safeParse(result.data);

  if (!rows.success || rows.data.length !== opportunityStageValues.length) {
    return unavailableResult;
  }

  const orderedRows = [...rows.data].sort(
    (left, right) => left.stage_order - right.stage_order,
  );

  const contractIsValid = orderedRows.every(
    (row, index) =>
      row.stage_order === index + 1 &&
      row.stage === opportunityStageValues[index],
  );

  if (!contractIsValid) {
    return unavailableResult;
  }

  const stages = orderedRows.map((row) => ({
    stage: row.stage,
    label: opportunityStageLabels[row.stage],
    count: row.opportunity_count,
    closed: isClosedOpportunityStage(row.stage),
  }));
  const open = stages
    .filter((stage) => !stage.closed)
    .reduce((total, stage) => total + stage.count, 0);
  const closed = stages
    .filter((stage) => stage.closed)
    .reduce((total, stage) => total + stage.count, 0);

  return {
    ok: true,
    data: {
      stages,
      total: open + closed,
      open,
      closed,
    },
  };
}
