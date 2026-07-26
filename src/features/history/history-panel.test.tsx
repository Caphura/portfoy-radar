import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HistoryPanel } from "./history-panel";

const occurredAt = "2026-07-26T09:30:00+03:00";

describe("HistoryPanel", () => {
  afterEach(cleanup);

  it("mobil zaman çizelgesini ve owner audit izlerini gösterir", () => {
    render(
      <HistoryPanel
        result={{
          ok: true,
          data: {
            activity: [
              {
                id: "11000000-0000-4000-8000-000000000001",
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
                  id: "12000000-0000-4000-8000-000000000001",
                  title: "Fırsat aşaması değiştirildi",
                  entityLabel: "Fırsat",
                  actorReference: "••••000001",
                  requestReference: "••••000002",
                  occurredAt,
                },
              ],
            },
          },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Geçmiş ve audit" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Yeni → Doğrulanıyor")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Audit günlüğü" }),
    ).toBeInTheDocument();
    expect(screen.getByText("••••000001")).toBeInTheDocument();
    expect(screen.getByText("••••000002")).toBeInTheDocument();
    expect(screen.getAllByText("26 Tem 2026 09:30")).toHaveLength(2);
  });

  it("boş aktivite ve audit durumlarını Türkçe gösterir", () => {
    render(
      <HistoryPanel
        result={{
          ok: true,
          data: {
            activity: [],
            audit: {
              visible: true,
              items: [],
            },
          },
        }}
      />,
    );

    expect(
      screen.getByText(
        "Henüz geçmiş kaydı yok. Kritik bir işlem yapıldığında burada görünecek.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Henüz audit kaydı yok.")).toBeInTheDocument();
  });

  it("owner olmayan üyeye audit yerine yetki açıklaması gösterir", () => {
    render(
      <HistoryPanel
        result={{
          ok: true,
          data: {
            activity: [],
            audit: {
              visible: false,
              items: [],
            },
          },
        }}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "Audit günlüğü" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Audit günlüğünü yalnızca çalışma alanı sahibi görüntüleyebilir.",
      ),
    ).toBeInTheDocument();
  });

  it("servis hatasını erişilebilir ve Türkçe gösterir", () => {
    render(
      <HistoryPanel
        result={{
          ok: false,
          error: {
            code: "HISTORY_UNAVAILABLE",
            message:
              "Geçmiş kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
          },
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Geçmiş yüklenemedi");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Geçmiş kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
    );
  });
});
