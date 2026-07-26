import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initialQuickFsboActionState } from "./quick-fsbo-state";

const { useActionStateMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();

  return {
    ...original,
    useActionState: useActionStateMock,
  };
});

vi.mock("./actions", () => ({
  createQuickFsboAction: vi.fn(),
}));

import { QuickFsboForm } from "./quick-fsbo-form";

describe("QuickFsboForm", () => {
  afterEach(() => {
    cleanup();
    useActionStateMock.mockReset();
  });

  it("mobil öncelikli dört adımı ve zorunlu sonraki aramayı gösterir", () => {
    useActionStateMock.mockReturnValue([
      initialQuickFsboActionState,
      vi.fn(),
      false,
    ]);
    render(<QuickFsboForm defaultNextActionAt="2026-07-26T10:00" />);

    expect(
      screen.getByRole("form", { name: "Hızlı FSBO ekleme formu" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "1 · Mülk sahibi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "2 · Gayrimenkul" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "3 · İlan" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "4 · Sonraki işlem" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Arama tarihi ve saati")).toHaveValue(
      "2026-07-26T10:00",
    );
    expect(screen.getByText("Ara")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Denetle ve FSBO fırsatını oluştur",
      }),
    ).toBeInTheDocument();
  });

  it("PII, portal taraması ve otomatik birleştirme sınırlarını açıklar", () => {
    useActionStateMock.mockReturnValue([
      initialQuickFsboActionState,
      vi.fn(),
      false,
    ]);
    render(<QuickFsboForm defaultNextActionAt="2026-07-26T10:00" />);

    expect(screen.getByText(/Ad ve telefon uygulama sunucusunda şifrelenir/)).toBeInTheDocument();
    expect(screen.getByText(/portal sayfasına ağ isteği yapılmaz/)).toBeInTheDocument();
    expect(
      screen.getByText(/Mükerrer sinyaller kayıtları otomatik birleştirmez/),
    ).toBeInTheDocument();
  });

  it("mükerrer adayları mobil karar panelinde açıklanabilir ve PII içermeyen özetle gösterir", () => {
    const privateValue = "Açık kişi adı burada olmamalı";
    const candidateKey = [
      "11000000-0000-4000-8000-000000000001",
      "12000000-0000-4000-8000-000000000001",
      "13000000-0000-4000-8000-000000000001",
      "-",
    ].join(":");
    useActionStateMock.mockReturnValue([
      {
        ...initialQuickFsboActionState,
        status: "review",
        review: {
          maskedPhone: "+90 ••• ••• •• 00",
          candidates: [
            {
              key: candidateKey,
              rank: 1,
              matchKinds: ["platform_listing", "canonical_url"],
              linkable: true,
              listing: {
                platform: "sahibinden",
                externalListingId: "123456",
                transactionType: "sale",
                status: "active",
                askingPrice: 7_500_000,
                currency: "TRY",
                lastSeenAt: "2026-07-26T08:00:00.000Z",
              },
              property: {
                city: "İstanbul",
                district: "Kadıköy",
                neighborhood: "Fenerbahçe",
                roomCount: 3,
                livingRoomCount: 1,
                netAreaSqm: 110,
                grossAreaSqm: 125,
              },
              opportunity: {
                stage: "new",
                nextActionAt: "2026-07-26T10:00:00.000Z",
              },
            },
          ],
        },
      },
      vi.fn(),
      false,
    ]);

    const { container } = render(
      <QuickFsboForm defaultNextActionAt="2026-07-26T10:00" />,
    );

    const reviewHeading = screen.getByRole("heading", {
      name: "1 olası mükerrer bulundu",
    });
    expect(reviewHeading).toBeInTheDocument();
    expect(
      screen.getByText(/Aynı platform ve ilan numarası/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Aynı normalize ilan bağlantısı/),
    ).toBeInTheDocument();
    expect(reviewHeading.parentElement).toHaveTextContent(
      "+90 ••• ••• •• 00",
    );
    expect(
      screen.getByRole("button", { name: "Mevcut kaydı kullan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Yeni ilanı bu gayrimenkule bağla",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Gerekçeyle ayrı kayıt oluştur" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Ayrı kayıt gerekçesi")).toBeInTheDocument();
    expect(container).not.toHaveTextContent(privateValue);
    expect(
      screen.queryByRole("button", {
        name: "Denetle ve FSBO fırsatını oluştur",
      }),
    ).not.toBeInTheDocument();
  });
});
