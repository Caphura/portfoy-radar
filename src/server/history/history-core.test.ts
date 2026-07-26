// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { resolveWorkspaceHistory } from "./history-core";

const activityId = "11000000-0000-4000-8000-000000000001";
const auditId = "12000000-0000-4000-8000-000000000001";
const actorId = "13000000-0000-4000-8000-000000000001";
const requestId = "14000000-0000-4000-8000-000000000001";
const occurredAt = "2026-07-26T09:30:00+03:00";

describe("resolveWorkspaceHistory", () => {
  it("owner için aktiviteyi ve audit kaydını en küçük redakte DTO'ya dönüştürür", async () => {
    const privateMetadataValue = "sunucu-ayrintisi";
    const result = await resolveWorkspaceHistory(
      "owner",
      async () => ({
        data: [
          {
            id: activityId,
            event_type: "opportunity.stage_changed",
            entity_type: "opportunity",
            details: {
              previous_stage: "new",
              new_stage: "verifying",
              internal_fixture: privateMetadataValue,
            },
            occurred_at: occurredAt,
          },
        ],
        error: null,
      }),
      async () => ({
        data: [
          {
            id: auditId,
            action: "opportunity.stage_changed",
            actor_id: actorId,
            entity_type: "opportunity",
            request_id: requestId,
            occurred_at: occurredAt,
          },
        ],
        error: null,
      }),
    );

    expect(result).toEqual({
      ok: true,
      data: {
        activity: [
          {
            id: activityId,
            title: "Fırsat aşaması değiştirildi",
            detail: "Yeni → Doğrulanıyor",
            entityLabel: "Fırsat",
            occurredAt,
          },
        ],
        audit: {
          visible: true,
          items: [
            {
              id: auditId,
              title: "Fırsat aşaması değiştirildi",
              entityLabel: "Fırsat",
              actorReference: "••••000001",
              requestReference: "••••000001",
              occurredAt,
            },
          ],
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain(privateMetadataValue);
    expect(JSON.stringify(result)).not.toContain(actorId);
    expect(JSON.stringify(result)).not.toContain(requestId);
  });

  it("viewer için audit sorgusunu çalıştırmaz ve yalnız aktiviteyi döndürür", async () => {
    const auditQuery = vi.fn();
    const result = await resolveWorkspaceHistory(
      "viewer",
      async () => ({
        data: [
          {
            id: activityId,
            event_type: "workspace.name_changed",
            entity_type: "workspace",
            details: {
              changed_fields: ["name"],
            },
            occurred_at: occurredAt,
          },
        ],
        error: null,
      }),
      auditQuery,
    );

    expect(result.ok).toBe(true);
    expect(auditQuery).not.toHaveBeenCalled();

    if (!result.ok) {
      return;
    }

    expect(result.data.activity[0]).toMatchObject({
      title: "Çalışma alanı adı güncellendi",
      detail: null,
    });
    expect(result.data.audit).toEqual({
      visible: false,
      items: [],
    });
  });

  it("bilinmeyen güvenli olayları genel etiketle ve metadata olmadan gösterir", async () => {
    const result = await resolveWorkspaceHistory("advisor", async () => ({
      data: [
        {
          id: activityId,
          event_type: "task.completed",
          entity_type: "task",
          details: {
            safe_status: "done",
          },
          occurred_at: occurredAt,
        },
      ],
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.activity[0]).toEqual({
      id: activityId,
      title: "İşlem kaydedildi",
      detail: null,
      entityLabel: "Kayıt",
      occurredAt,
    });
  });

  it("hızlı FSBO audit olayını PII metadata taşımadan Türkçeleştirir", async () => {
    const result = await resolveWorkspaceHistory(
      "owner",
      async () => ({
        data: [],
        error: null,
      }),
      async () => ({
        data: [
          {
            id: auditId,
            action: "fsbo.created",
            actor_id: actorId,
            entity_type: "opportunity",
            request_id: requestId,
            occurred_at: occurredAt,
          },
        ],
        error: null,
      }),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.audit.items[0]).toMatchObject({
      title: "Hızlı FSBO kaydı oluşturuldu",
      entityLabel: "Fırsat",
    });
  });

  it("mükerrer kararını gerekçe veya aday ayrıntısı taşımadan Türkçeleştirir", async () => {
    const result = await resolveWorkspaceHistory(
      "owner",
      async () => ({
        data: [
          {
            id: activityId,
            event_type: "duplicate.resolved",
            entity_type: "duplicate_review",
            details: {
              decision: "keep_separate",
              match_kinds: ["phone"],
              primary_match_rank: 3,
            },
            occurred_at: occurredAt,
          },
        ],
        error: null,
      }),
      async () => ({
        data: [
          {
            id: auditId,
            action: "duplicate.resolved",
            actor_id: actorId,
            entity_type: "duplicate_review",
            request_id: requestId,
            occurred_at: occurredAt,
          },
        ],
        error: null,
      }),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.activity[0]).toEqual({
      id: activityId,
      title: "Mükerrer kararı kaydedildi",
      detail: null,
      entityLabel: "Mükerrer denetimi",
      occurredAt,
    });
    expect(result.data.audit.items[0]).toMatchObject({
      title: "Mükerrer kararı kaydedildi",
      entityLabel: "Mükerrer denetimi",
    });
    expect(JSON.stringify(result)).not.toContain("keep_separate");
    expect(JSON.stringify(result)).not.toContain("phone");
  });

  it("iletişim engeli olayını serbest neden taşımadan Türkçeleştirir", async () => {
    const result = await resolveWorkspaceHistory(
      "owner",
      async () => ({
        data: [
          {
            id: activityId,
            event_type: "contact.communication_blocked",
            entity_type: "contact",
            details: {
              status: "active",
              affected_opportunity_count: 2,
              cancelled_task_count: 1,
            },
            occurred_at: occurredAt,
          },
        ],
        error: null,
      }),
      async () => ({
        data: [
          {
            id: auditId,
            action: "contact.communication_blocked",
            actor_id: actorId,
            entity_type: "contact",
            request_id: requestId,
            occurred_at: occurredAt,
          },
        ],
        error: null,
      }),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.activity[0]).toMatchObject({
      title: "Kişi Aranmayacak olarak işaretlendi",
      detail: null,
      entityLabel: "Kişi",
    });
    expect(result.data.audit.items[0]).toMatchObject({
      title: "Kişi Aranmayacak olarak işaretlendi",
      entityLabel: "Kişi",
    });
    expect(JSON.stringify(result)).not.toContain("reason");
  });

  it("veritabanı hatasını veya bozuk sözleşmeyi ayrıntı sızdırmadan reddeder", async () => {
    const privateError = "private-history-error";
    const queryFailure = await resolveWorkspaceHistory(
      "owner",
      async () => ({
        data: null,
        error: new Error(privateError),
      }),
      async () => ({
        data: [],
        error: null,
      }),
    );
    const contractFailure = await resolveWorkspaceHistory(
      "viewer",
      async () => ({
        data: [
          {
            id: "gecersiz",
            event_type: "unsafe event",
            entity_type: "workspace",
            details: {},
            occurred_at: occurredAt,
          },
        ],
        error: null,
      }),
    );

    expect(queryFailure.ok).toBe(false);
    expect(contractFailure.ok).toBe(false);
    expect(JSON.stringify(queryFailure)).not.toContain(privateError);
  });

  it("owner audit sorgusu olmadan güvenli servis hatası verir", async () => {
    const result = await resolveWorkspaceHistory("owner", async () => ({
      data: [],
      error: null,
    }));

    expect(result).toEqual({
      ok: false,
      error: {
        code: "HISTORY_UNAVAILABLE",
        message: "Geçmiş kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    });
  });
});
