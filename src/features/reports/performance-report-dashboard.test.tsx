import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PerformanceReport } from "@/server/reports/performance-report-core";

import { PerformanceReportDashboard } from "./performance-report-dashboard";

const period = { startDate: "2026-07-01", endDate: "2026-07-27" };

function report(): PerformanceReport {
  return {
    version: "performance-v1",
    period,
    summary: {
      newOpportunities: 3,
      convertedOpportunities: 1,
      conversionRate: 33.33,
      totalConversations: 3,
      totalAppointments: 2,
    },
    funnel: [
      { stage: "new", label: "Yeni", count: 3, cohortRate: 100 },
      {
        stage: "verifying",
        label: "Doğrulanıyor",
        count: 2,
        cohortRate: 66.67,
      },
      {
        stage: "ready_to_call",
        label: "Aramaya Hazır",
        count: 2,
        cohortRate: 66.67,
      },
      {
        stage: "contacted",
        label: "İletişim Kuruldu",
        count: 2,
        cohortRate: 66.67,
      },
      { stage: "follow_up", label: "Takipte", count: 1, cohortRate: 33.33 },
      {
        stage: "analysis_preparing",
        label: "Analiz Hazırlanıyor",
        count: 1,
        cohortRate: 33.33,
      },
      {
        stage: "appointment",
        label: "Randevu",
        count: 1,
        cohortRate: 33.33,
      },
      {
        stage: "authorization_pending",
        label: "Yetki Bekleniyor",
        count: 1,
        cohortRate: 33.33,
      },
      {
        stage: "converted",
        label: "Portföye Dönüştü",
        count: 1,
        cohortRate: 33.33,
      },
      { stage: "lost", label: "Kaybedildi", count: 0, cohortRate: 0 },
      {
        stage: "do_not_call",
        label: "Aranmayacak",
        count: 0,
        cohortRate: 0,
      },
    ],
    conversationResults: [
      { result: "reached", label: "Görüşüldü", count: 1, share: 33.33 },
      {
        result: "unreachable",
        label: "Ulaşılamadı",
        count: 1,
        share: 33.33,
      },
      { result: "interested", label: "İlgileniyor", count: 1, share: 33.33 },
      {
        result: "not_interested",
        label: "İlgilenmiyor",
        count: 0,
        share: 0,
      },
      { result: "wrong_number", label: "Yanlış numara", count: 0, share: 0 },
      { result: "other", label: "Diğer", count: 0, share: 0 },
    ],
    appointmentStatuses: [
      { status: "scheduled", label: "Planlandı", count: 1, share: 50 },
      { status: "completed", label: "Tamamlandı", count: 1, share: 50 },
      { status: "cancelled", label: "İptal edildi", count: 0, share: 0 },
    ],
    empty: false,
  };
}

describe("PerformanceReportDashboard", () => {
  afterEach(cleanup);

  it("mobil filtre, özet ve açıklanabilir dağılımları PII olmadan gösterir", () => {
    render(
      <PerformanceReportDashboard
        period={period}
        result={{ ok: true, data: report() }}
        today="2026-07-27"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Huni ve raporlar" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Başlangıç")).toHaveValue("2026-07-01");
    expect(screen.getByLabelText("Bitiş")).toHaveValue("2026-07-27");
    expect(screen.getByText("%33,33")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fırsat hunisi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Ulaşılamadı: 1, yüzde 33.33" }),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /telefon|e-posta|contact|blind|cipher/i,
    );
  });

  it("boş dönemi kategori açıklamalarını koruyarak anlatır", () => {
    const emptyReport = report();
    emptyReport.empty = true;
    emptyReport.summary = {
      newOpportunities: 0,
      convertedOpportunities: 0,
      conversionRate: 0,
      totalConversations: 0,
      totalAppointments: 0,
    };

    render(
      <PerformanceReportDashboard
        period={period}
        result={{ ok: true, data: emptyReport }}
        today="2026-07-27"
      />,
    );

    expect(
      screen.getByText(/Seçilen dönemde yeni fırsat, görüşme veya randevu/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Görüşme sonuçları" }),
    ).toBeInTheDocument();
  });

  it("alan ve servis hatalarını anlaşılır Türkçe gösterir", () => {
    render(
      <PerformanceReportDashboard
        fieldErrors={{ endDate: "Bitiş tarihi bugünden sonra olamaz." }}
        period={{ startDate: "2026-07-01", endDate: "2026-07-28" }}
        result={{
          ok: false,
          error: {
            code: "INVALID_PERIOD",
            message: "Rapor dönemini kontrol edip yeniden deneyin.",
          },
        }}
        today="2026-07-27"
      />,
    );

    expect(screen.getByDisplayValue("2026-07-28")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Rapor dönemi geçersiz",
    );
  });
});
