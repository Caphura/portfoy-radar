import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/conversations/conversation-form", () => ({
  ConversationForm: ({ opportunityId }: { opportunityId: string }) => (
    <section aria-label="Görüşme kayıt formu">
      <h2>Görüşme kaydet</h2>
      <input name="opportunityId" readOnly value={opportunityId} />
    </section>
  ),
}));

vi.mock("@/features/communication-blocks/do-not-call-control", () => ({
  DoNotCallControl: ({
    active,
    opportunityId,
  }: {
    active: boolean;
    opportunityId: string;
  }) => (
    <section aria-label="Aranmayacak yönetimi">
      <span>{active ? "Engel aktif" : "Engel yok"}</span>
      <input name="blockOpportunityId" readOnly value={opportunityId} />
    </section>
  ),
}));

import type { OpportunityDetailResult } from "@/server/opportunity-detail/opportunity-detail-core";

import { OpportunityDetailView } from "./opportunity-detail-view";

const successResult: OpportunityDetailResult = {
  ok: true,
  data: {
    communicationBlock: {
      active: false,
    },
    opportunity: {
      id: "20000000-0000-4000-8000-000000000001",
      stage: "follow_up",
      stageLabel: "Takipte",
      closed: false,
      nextAction: {
        type: "follow_up",
        label: "Takip et",
        at: "2026-07-28T10:00:00+03:00",
      },
      closedAt: null,
      createdAt: "2026-07-26T09:00:00+03:00",
      updatedAt: "2026-07-26T10:00:00+03:00",
      property: {
        id: "30000000-0000-4000-8000-000000000001",
        type: "apartment",
        typeLabel: "Daire",
        city: "İstanbul",
        district: "Kadıköy",
        neighborhood: "Moda",
        roomCount: 2,
        livingRoomCount: 1,
        netAreaSqm: 90,
        grossAreaSqm: 105,
      },
      listing: {
        id: "40000000-0000-4000-8000-000000000001",
        platform: "sahibinden",
        externalListingId: "DETAY-1",
        transactionType: "sale",
        status: "active",
        askingPrice: 5000000,
        currency: "TRY",
        lastSeenAt: "2026-07-26T09:00:00+03:00",
      },
    },
    timeline: [
      {
        id: "50000000-0000-4000-8000-000000000002",
        title: "Fırsat aşaması değiştirildi",
        detail: "Yeni → Takipte",
        occurredAt: "2026-07-26T10:00:00+03:00",
      },
      {
        id: "50000000-0000-4000-8000-000000000001",
        title: "Fırsat oluşturuldu",
        detail: "Yeni aşamasında başlatıldı",
        occurredAt: "2026-07-26T09:00:00+03:00",
      },
    ],
  },
};

describe("OpportunityDetailView", () => {
  afterEach(() => {
    cleanup();
  });

  it("mobil fırsat özetini ve PII içermeyen iş timelineını gösterir", () => {
    render(<OpportunityDetailView result={successResult} />);

    expect(
      screen.getByRole("heading", { name: "Moda · Kadıköy · İstanbul" }),
    ).toBeInTheDocument();
    expect(screen.getByText("₺5.000.000")).toBeInTheDocument();
    expect(screen.getByText("Takipte")).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Fırsat iş zaman çizelgesi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Fırsat aşaması değiştirildi"),
    ).toBeInTheDocument();
    expect(screen.getByText("Yeni → Takipte")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Kişi ve iletişim bilgileri bu görünümde yer almaz.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/telefon|e-posta/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Radar’a dön/ })).toHaveAttribute(
      "href",
      "/workspace/radar",
    );
  });

  it("boş timeline için anlaşılır Türkçe durum gösterir", () => {
    render(
      <OpportunityDetailView
        result={{
          ok: true,
          data: {
            ...successResult.data,
            timeline: [],
          },
        }}
      />,
    );

    expect(
      screen.getByText("Bu fırsat için henüz gösterilebilir bir işlem yok."),
    ).toBeInTheDocument();
  });

  it("owner veya danışman için mobil görüşme formunu fırsata bağlar", () => {
    const { container } = render(
      <OpportunityDetailView
        canRecordConversation
        defaultConversationFollowUpAt="2026-07-27T12:00"
        defaultConversationOccurredAt="2026-07-26T12:00"
        result={successResult}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Görüşme kaydet" }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Görüşme kayıt formu" }),
      ).getByDisplayValue(successResult.data.opportunity.id),
    ).toHaveAttribute("name", "opportunityId");
    expect(container.querySelector("#gorusme-kaydi")).toContainElement(
      screen.getByRole("region", { name: "Görüşme kayıt formu" }),
    );
  });

  it("iletişim engeli durumunu mobil yönetim alanına fırsat kimliğiyle bağlar", () => {
    render(
      <OpportunityDetailView
        canManageCommunicationBlock
        result={{
          ok: true,
          data: {
            ...successResult.data,
            communicationBlock: { active: true },
          },
        }}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Aranmayacak yönetimi" }),
    ).toHaveTextContent("Engel aktif");
    expect(
      screen.getByDisplayValue(successResult.data.opportunity.id),
    ).toHaveAttribute("name", "blockOpportunityId");
  });

  it("bulunamadı ile servis hatasını ayrı ve güvenli durumlarda gösterir", () => {
    const { rerender } = render(
      <OpportunityDetailView
        result={{
          ok: false,
          error: {
            code: "NOT_FOUND",
            message:
              "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor.",
          },
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Fırsat bulunamadı");

    rerender(
      <OpportunityDetailView
        result={{
          ok: false,
          error: {
            code: "OPPORTUNITY_DETAIL_UNAVAILABLE",
            message:
              "Fırsat ayrıntıları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
          },
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Fırsat ayrıntıları yüklenemedi",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("database");
  });
});
