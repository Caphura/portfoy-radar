import { describe, expect, it } from "vitest";

import { opportunityStageValues } from "@/features/opportunities/stages";

import { resolveOpportunityPipeline } from "./pipeline-core";

const workspaceId = "a0000000-0000-4000-8000-000000000001";

function createRows(counts: Partial<Record<(typeof opportunityStageValues)[number], number>> = {}) {
  return opportunityStageValues.map((stage, index) => ({
    workspace_id: workspaceId,
    stage,
    stage_order: index + 1,
    opportunity_count: counts[stage] ?? 0,
  }));
}

describe("resolveOpportunityPipeline", () => {
  it("onaylı 11 aşamayı Türkçe etiket ve açık/kapalı toplamlarına dönüştürür", async () => {
    const result = await resolveOpportunityPipeline(async () => ({
      data: createRows({
        new: 2,
        follow_up: 3,
        converted: 1,
        lost: 1,
      }),
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Geçerli fırsat hunisi reddedilmemeliydi.");
    }

    expect(result.data).toMatchObject({
      total: 7,
      open: 5,
      closed: 2,
    });
    expect(result.data.stages).toHaveLength(11);
    expect(result.data.stages[0]).toEqual({
      stage: "new",
      label: "Yeni",
      count: 2,
      closed: false,
    });
    expect(result.data.stages.at(-1)).toEqual({
      stage: "do_not_call",
      label: "Aranmayacak",
      count: 0,
      closed: true,
    });
    expect(JSON.stringify(result)).not.toContain("Ulaşılamadı");
  });

  it("boş workspace için bütün aşamaları sıfırla korur", async () => {
    const result = await resolveOpportunityPipeline(async () => ({
      data: createRows(),
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.total).toBe(0);
      expect(result.data.stages.every((stage) => stage.count === 0)).toBe(true);
    }
  });

  it("eksik, yinelenmiş veya sırası bozuk aşama sözleşmesini reddeder", async () => {
    const invalidRows = createRows().slice(0, -1);
    invalidRows[1] = {
      ...invalidRows[1]!,
      stage: "new",
    };

    const result = await resolveOpportunityPipeline(async () => ({
      data: invalidRows,
      error: null,
    }));

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OPPORTUNITY_PIPELINE_UNAVAILABLE",
        message: "Fırsat hunisi şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    });
  });

  it("veritabanı ayrıntısını güvenli hata DTO'suna taşımaz", async () => {
    const privateDetail = "private-pipeline-database-detail";
    const result = await resolveOpportunityPipeline(async () => ({
      data: null,
      error: new Error(privateDetail),
    }));

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(privateDetail);
  });

  it("sorgu istisnasını Türkçe servis hatasına dönüştürür", async () => {
    const result = await resolveOpportunityPipeline(async () => {
      throw new Error("internal-pipeline-detail");
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("internal-pipeline-detail");
  });
});
