import { z } from "zod";

import {
  opportunityStageLabels,
  opportunityStageValues,
} from "@/features/opportunities/stages";
import type { WorkspaceRole } from "@/server/workspace/roles";

const safeIdentifierSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_.]{2,80}$/);
const occurredAtSchema = z.iso.datetime({ offset: true });
const activityRowSchema = z.object({
  id: z.uuid(),
  event_type: safeIdentifierSchema,
  entity_type: safeIdentifierSchema,
  details: z.record(z.string(), z.unknown()),
  occurred_at: occurredAtSchema,
});
const auditRowSchema = z.object({
  id: z.uuid(),
  action: safeIdentifierSchema,
  actor_id: z.uuid(),
  entity_type: safeIdentifierSchema,
  request_id: z.uuid(),
  occurred_at: occurredAtSchema,
});
const stageDetailsSchema = z.object({
  previous_stage: z.enum(opportunityStageValues).nullable(),
  new_stage: z.enum(opportunityStageValues),
});

type HistoryQueryResult = {
  data: unknown;
  error: unknown;
};

type ReadHistory = () => Promise<HistoryQueryResult>;

export type ActivityHistoryItem = {
  id: string;
  title: string;
  detail: string | null;
  entityLabel: string;
  occurredAt: string;
};

export type AuditHistoryItem = {
  id: string;
  title: string;
  entityLabel: string;
  actorReference: string;
  requestReference: string;
  occurredAt: string;
};

export type WorkspaceHistory = {
  activity: ActivityHistoryItem[];
  audit: {
    visible: boolean;
    items: AuditHistoryItem[];
  };
};

export type WorkspaceHistoryResult =
  | {
      ok: true;
      data: WorkspaceHistory;
    }
  | {
      ok: false;
      error: {
        code: "HISTORY_UNAVAILABLE";
        message: string;
      };
    };

const historyUnavailable: WorkspaceHistoryResult = {
  ok: false,
  error: {
    code: "HISTORY_UNAVAILABLE",
    message: "Geçmiş kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
  },
};

const eventTitles: Record<string, string> = {
  "workspace.created": "Çalışma alanı oluşturuldu",
  "workspace.name_changed": "Çalışma alanı adı güncellendi",
  "opportunity.created": "Fırsat oluşturuldu",
  "opportunity.stage_changed": "Fırsat aşaması değiştirildi",
  "fsbo.created": "Hızlı FSBO kaydı oluşturuldu",
  "duplicate.resolved": "Mükerrer kararı kaydedildi",
  "contact.communication_blocked": "Kişi Aranmayacak olarak işaretlendi",
  "contact.communication_block_lifted": "İletişim engeli kaldırıldı",
  "task.rescheduled": "Görev tarihi güncellendi",
  "task.completed": "Görev tamamlandı",
};

const entityLabels: Record<string, string> = {
  workspace: "Çalışma alanı",
  opportunity: "Fırsat",
  duplicate_review: "Mükerrer denetimi",
  contact: "Kişi",
  task: "Görev",
};

function eventTitle(eventType: string): string {
  return eventTitles[eventType] ?? "İşlem kaydedildi";
}

function entityLabel(entityType: string): string {
  return entityLabels[entityType] ?? "Kayıt";
}

function stageDetail(eventType: string, details: unknown): string | null {
  if (
    eventType !== "opportunity.created" &&
    eventType !== "opportunity.stage_changed"
  ) {
    return null;
  }

  const parsedDetails = stageDetailsSchema.safeParse(details);

  if (!parsedDetails.success) {
    return null;
  }

  const newStage = opportunityStageLabels[parsedDetails.data.new_stage];

  if (!parsedDetails.data.previous_stage) {
    return `${newStage} aşamasında başlatıldı`;
  }

  const previousStage =
    opportunityStageLabels[parsedDetails.data.previous_stage];

  return `${previousStage} → ${newStage}`;
}

function shortReference(value: string): string {
  return `••••${value.slice(-6)}`;
}

export async function resolveWorkspaceHistory(
  role: WorkspaceRole,
  readActivity: ReadHistory,
  readAudit?: ReadHistory,
): Promise<WorkspaceHistoryResult> {
  let activityResult: HistoryQueryResult;
  let auditResult: HistoryQueryResult = {
    data: [],
    error: null,
  };

  try {
    if (role === "owner") {
      if (!readAudit) {
        return historyUnavailable;
      }

      [activityResult, auditResult] = await Promise.all([
        readActivity(),
        readAudit(),
      ]);
    } else {
      activityResult = await readActivity();
    }
  } catch {
    return historyUnavailable;
  }

  if (activityResult.error || auditResult.error) {
    return historyUnavailable;
  }

  const activityRows = z.array(activityRowSchema).max(8).safeParse(
    activityResult.data,
  );
  const auditRows = z.array(auditRowSchema).max(8).safeParse(auditResult.data);

  if (!activityRows.success || !auditRows.success) {
    return historyUnavailable;
  }

  return {
    ok: true,
    data: {
      activity: activityRows.data.map((row) => ({
        id: row.id,
        title: eventTitle(row.event_type),
        detail: stageDetail(row.event_type, row.details),
        entityLabel: entityLabel(row.entity_type),
        occurredAt: row.occurred_at,
      })),
      audit: {
        visible: role === "owner",
        items: auditRows.data.map((row) => ({
          id: row.id,
          title: eventTitle(row.action),
          entityLabel: entityLabel(row.entity_type),
          actorReference: shortReference(row.actor_id),
          requestReference: shortReference(row.request_id),
          occurredAt: row.occurred_at,
        })),
      },
    },
  };
}
