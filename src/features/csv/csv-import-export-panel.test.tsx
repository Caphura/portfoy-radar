import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { useActionStateMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: useActionStateMock,
}));
vi.mock("./actions", () => ({
  manageCsvImportAction: vi.fn(),
}));

import { initialCsvImportActionState } from "./csv-import-state";
import { CsvImportExportPanel } from "./csv-import-export-panel";

describe("CsvImportExportPanel", () => {
  afterEach(() => {
    cleanup();
    useActionStateMock.mockReset();
  });

  it("mobil öncelikli dosya, şablon ve maskeli export kontrollerini gösterir", () => {
    useActionStateMock.mockReturnValue([
      initialCsvImportActionState,
      vi.fn(),
      false,
    ]);

    render(<CsvImportExportPanel />);

    expect(
      screen.getByRole("heading", { name: "CSV içe / dışa aktar" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("İçe aktarılacak CSV")).toHaveAttribute(
      "accept",
      ".csv,text/csv",
    );
    expect(
      screen.getByRole("link", { name: "Boş şablonu indir" }),
    ).toHaveAttribute("href", "/api/workspace/csv/template");
    expect(
      screen.getByRole("link", { name: "Maskeli CSV indir" }),
    ).toHaveAttribute("href", "/api/workspace/csv/export");
    expect(screen.getByText(/1\.000 veri satırı/i)).toBeInTheDocument();
  });

  it("önizlemede yalnız maskeli telefonu ve açık mükerrer kararını gösterir", () => {
    useActionStateMock.mockReturnValue([
      {
        ...initialCsvImportActionState,
        status: "review",
        preview: {
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
                propertyType: "apartment",
                transactionType: "sale",
                askingPrice: 7500000,
                currency: "TRY",
                nextActionAt: "2026-07-28T09:00:00.000Z",
              },
              candidateCount: 1,
              candidatesTruncated: false,
              candidates: [
                {
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
                },
              ],
            },
          ],
        },
      },
      vi.fn(),
      false,
    ]);

    render(<CsvImportExportPanel />);

    expect(screen.getByText("+90 ••• ••• •• 01", { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText("Kullanıcı kararı")).toBeRequired();
    expect(
      screen.getByLabelText("Onay için aynı CSV dosyasını yeniden seçin"),
    ).toBeRequired();
    expect(screen.getByText(/otomatik arama veya mesaj göndermez/i)).toBeInTheDocument();
  });
});
