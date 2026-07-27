// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import type { DuplicateCandidate } from "@/features/fsbo/duplicate-review";

import { initialCsvImportActionState } from "./csv-import-state";

vi.mock("server-only", () => ({}));

const {
  confirmCsvFsboImportMock,
  previewCsvFsboImportMock,
  redirectMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  confirmCsvFsboImportMock: vi.fn(),
  previewCsvFsboImportMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/server/csv/csv-fsbo-service", () => ({
  previewCsvFsboImport: previewCsvFsboImportMock,
  confirmCsvFsboImport: confirmCsvFsboImportMock,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { manageCsvImportAction } from "./actions";

const candidate: DuplicateCandidate = {
  key: [
    "11000000-0000-4000-8000-000000000001",
    "12000000-0000-4000-8000-000000000001",
    "13000000-0000-4000-8000-000000000001",
    "-",
  ].join(":"),
  rank: 1,
  matchKinds: ["platform_listing"],
  linkable: true,
  listing: {
    platform: "sahibinden",
    externalListingId: "12345",
    transactionType: "sale",
    status: "active",
    askingPrice: 7500000,
    currency: "TRY",
    lastSeenAt: null,
  },
  property: {
    city: "İstanbul",
    district: "Kadıköy",
    neighborhood: "Moda",
    roomCount: 3,
    livingRoomCount: 1,
    netAreaSqm: 100,
    grossAreaSqm: 120,
  },
  opportunity: { stage: "new", nextActionAt: null },
};

const preview = {
  previewId: "30000000-0000-4000-8000-000000000001",
  expiresAt: "2026-07-28T09:00:00.000Z",
  rowCount: 1,
  duplicateRowCount: 1,
  rows: [
    {
      rowNumber: 1,
      maskedPhone: "+90 ••• ••• •• 01",
      summary: {
        platform: "sahibinden",
        externalListingId: "12345",
        location: "Moda · Kadıköy · İstanbul",
        propertyType: "apartment" as const,
        transactionType: "sale" as const,
        askingPrice: 7500000,
        currency: "TRY" as const,
        nextActionAt: "2026-07-28T09:00:00.000Z",
      },
      candidateCount: 1,
      candidatesTruncated: false,
      candidates: [candidate],
    },
  ],
};

function fileForm(intent: "preview" | "confirm") {
  const data = new FormData();
  data.set("intent", intent);
  data.set(
    "csvFile",
    new File(["sentetik"], "fsbo.csv", { type: "text/csv" }),
  );
  return data;
}

describe("CSV server action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("başarılı önizlemeyi maskeli inceleme durumuna taşır", async () => {
    previewCsvFsboImportMock.mockResolvedValue({ ok: true, data: preview });

    const result = await manageCsvImportAction(
      initialCsvImportActionState,
      fileForm("preview"),
    );

    expect(result).toMatchObject({
      status: "review",
      preview: {
        rowCount: 1,
        rows: [{ maskedPhone: "+90 ••• ••• •• 01" }],
      },
    });
    expect(JSON.stringify(result)).not.toContain("0532");
  });

  it("mükerrer kararı eksikse onay servisini çağırmaz", async () => {
    const result = await manageCsvImportAction(
      { ...initialCsvImportActionState, status: "review", preview },
      fileForm("confirm"),
    );

    expect(result.status).toBe("error");
    expect(result.decisionErrors[1]).toContain("açık karar");
    expect(confirmCsvFsboImportMock).not.toHaveBeenCalled();
  });

  it("açık kararı atomik onaya iletir ve ilgili sayfaları yeniler", async () => {
    confirmCsvFsboImportMock.mockResolvedValue({
      ok: true,
      data: {
        importId: "40000000-0000-4000-8000-000000000001",
        processedCount: 1,
        createdNewCount: 0,
        usedExistingCount: 1,
        linkedExistingPropertyCount: 0,
        createdSeparateCount: 0,
      },
    });
    const data = fileForm("confirm");
    data.set("decision-1", "use_existing");
    data.set("candidate-1", candidate.key);

    const result = await manageCsvImportAction(
      { ...initialCsvImportActionState, status: "review", preview },
      data,
    );

    expect(confirmCsvFsboImportMock).toHaveBeenCalledWith(
      preview.previewId,
      expect.objectContaining({ name: "fsbo.csv" }),
      {
        1: {
          decision: "use_existing",
          candidateKey: candidate.key,
          separationReason: null,
        },
      },
    );
    expect(result).toMatchObject({
      status: "success",
      preview: null,
      success: { processedCount: 1, usedExistingCount: 1 },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace/radar");
  });

  it("oturumsuz önizlemeyi girişe yönlendirir", async () => {
    previewCsvFsboImportMock.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Giriş yapın." },
    });
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      manageCsvImportAction(initialCsvImportActionState, fileForm("preview")),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
  });
});
