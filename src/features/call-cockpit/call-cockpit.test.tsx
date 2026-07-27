import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  PriorityCallQueueItem,
  PriorityCallQueueResult,
} from "@/server/priority/priority-core";

vi.mock("./phone-reveal", () => ({
  PhoneReveal: ({ canReveal }: { canReveal: boolean }) =>
    canReveal ? (
      <button type="button">Telefonu göster</button>
    ) : (
      <p>Telefonu yalnızca sahip veya danışman açık eylemle görüntüleyebilir.</p>
    ),
}));

import { CallCockpit } from "./call-cockpit";

const item: PriorityCallQueueItem = {
  rank: 1,
  id: "20000000-0000-4000-8000-000000000001",
  scoreVersion: "priority-v1",
  priorityScore: 95,
  stage: "ready_to_call",
  stageLabel: "Aramaya Hazır",
  nextAction: {
    type: "call",
    label: "Ara",
    at: "2026-07-26T12:00:00+03:00",
  },
  createdAt: "2026-07-01T09:00:00+03:00",
  lastConversationAt: "2026-07-11T09:00:00+03:00",
  breakdown: {
    overdue: { days: 10, points: 30 },
    stage: { points: 20 },
    conversationAge: { days: 15, points: 20 },
    priceDrop: { recent: true, points: 15 },
    completeness: { completedGroups: 5, points: 10 },
    dueToday: { value: false, points: 0 },
  },
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
    externalListingId: "SAFE-1",
    transactionType: "sale",
    askingPrice: 5_000_000,
    currency: "TRY",
  },
};

const successResult: PriorityCallQueueResult = {
  ok: true,
  data: {
    scoreVersion: "priority-v1",
    opportunities: [item],
    truncated: false,
  },
};

describe("CallCockpit", () => {
  afterEach(cleanup);

  it("mobil sırayı, altı puan bileşenini ve manuel görüşme akışını gösterir", () => {
    const { container } = render(
      <CallCockpit canRecordConversation result={successResult} />,
    );

    expect(
      screen.getByRole("heading", { name: "Arama kokpiti" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sıradaki fırsat")).toBeInTheDocument();
    expect(screen.getByText("Moda · Kadıköy · İstanbul")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
    expect(
      screen.getByRole("list", {
        name: "1. sıra öncelik puanı açıklaması",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Gecikme")).toBeInTheDocument();
    expect(screen.getByText("Fırsat aşaması")).toBeInTheDocument();
    expect(screen.getByText("Son görüşme")).toBeInTheDocument();
    expect(screen.getByText("Fiyat düşüşü")).toBeInTheDocument();
    expect(screen.getByText("Profil ve ilan tamlığı")).toBeInTheDocument();
    expect(screen.getByText("Bugün planı")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Fırsatı aç ve görüşme kaydet" }),
    ).toHaveAttribute(
      "href",
      `/workspace/radar/${item.id}#gorusme-kaydi`,
    );
    expect(container).toHaveTextContent(
      "Bu ekran arama, SMS veya WhatsApp mesajı göndermez.",
    );
    expect(
      screen.getByRole("button", { name: "Telefonu göster" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Telefon uygulamasını aç" }),
    ).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/private-phone/i);
  });

  it("viewer rolünde kayıt çağrısını kapatır ve yalnız detaya gider", () => {
    render(
      <CallCockpit
        canRecordConversation={false}
        result={successResult}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Fırsatı incele" }),
    ).toHaveAttribute("href", `/workspace/radar/${item.id}`);
    expect(
      screen.queryByRole("link", { name: "Fırsatı aç ve görüşme kaydet" }),
    ).not.toBeInTheDocument();
  });

  it("boş ve servis hata durumlarını Türkçe açıklar", () => {
    const { rerender } = render(
      <CallCockpit
        canRecordConversation
        result={{
          ok: true,
          data: {
            scoreVersion: "priority-v1",
            opportunities: [],
            truncated: false,
          },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Arama sırasında fırsat yok" }),
    ).toBeInTheDocument();

    rerender(
      <CallCockpit
        canRecordConversation
        result={{
          ok: false,
          error: {
            code: "PRIORITY_QUEUE_UNAVAILABLE",
            message:
              "Günlük arama sırası şu anda yüklenemiyor. Lütfen yeniden deneyin.",
          },
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Arama kokpiti yüklenemedi",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("database");
  });
});
