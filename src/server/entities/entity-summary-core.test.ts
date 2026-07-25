import { describe, expect, it } from "vitest";

import { resolveWorkspaceEntitySummary } from "./entity-summary-core";

describe("resolveWorkspaceEntitySummary", () => {
  it("RLS görünümü satırını en küçük sayı DTO'suna dönüştürür", async () => {
    const result = await resolveWorkspaceEntitySummary(async () => ({
      data: {
        workspace_id: "a0000000-0000-4000-8000-000000000001",
        contact_count: 2,
        property_count: 3,
        listing_count: 4,
      },
      error: null,
    }));

    expect(result).toEqual({
      ok: true,
      data: {
        contacts: 2,
        properties: 3,
        listings: 4,
      },
    });
    expect(result).not.toHaveProperty("workspace_id");
  });

  it("geçersiz veya negatif sayıları Türkçe güvenli hataya dönüştürür", async () => {
    const result = await resolveWorkspaceEntitySummary(async () => ({
      data: {
        workspace_id: "a0000000-0000-4000-8000-000000000001",
        contact_count: -1,
        property_count: 0,
        listing_count: 0,
      },
      error: null,
    }));

    expect(result).toEqual({
      ok: false,
      error: {
        code: "ENTITY_SUMMARY_UNAVAILABLE",
        message: "Kayıt özeti şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    });
  });

  it("veritabanı ayrıntısını DTO veya test çıktısına taşımaz", async () => {
    const privateDetail = "private-database-detail";
    const result = await resolveWorkspaceEntitySummary(async () => ({
      data: null,
      error: new Error(privateDetail),
    }));

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(privateDetail);
  });

  it("sorgu istisnasını güvenli servis hatasına dönüştürür", async () => {
    const result = await resolveWorkspaceEntitySummary(async () => {
      throw new Error("internal-query-detail");
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("internal-query-detail");
  });
});
