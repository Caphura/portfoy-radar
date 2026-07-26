import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { opportunityStageLabels, opportunityStageValues } from "./stages";
import { OpportunityPipeline } from "./opportunity-pipeline";

describe("OpportunityPipeline", () => {
  afterEach(cleanup);

  it("mobil öncelikli hunide 11 aşama ile Türkçe boş durumu gösterir", () => {
    render(
      <OpportunityPipeline
        result={{
          ok: true,
          data: {
            stages: opportunityStageValues.map((stage) => ({
              stage,
              label: opportunityStageLabels[stage],
              count: 0,
              closed: ["converted", "lost", "do_not_call"].includes(stage),
            })),
            total: 0,
            open: 0,
            closed: 0,
          },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Fırsat hunisi" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(11);
    expect(screen.getByText("Yeni")).toBeInTheDocument();
    expect(screen.getByText("Aranmayacak")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Henüz fırsat yok. İlk fırsat eklendiğinde aşama dağılımı burada görünecek.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ulaşılamadı")).not.toBeInTheDocument();
  });

  it("açık, kapanmış ve toplam fırsat sayılarını gösterir", () => {
    render(
      <OpportunityPipeline
        result={{
          ok: true,
          data: {
            stages: [
              {
                stage: "new",
                label: "Yeni",
                count: 3,
                closed: false,
              },
              {
                stage: "converted",
                label: "Portföye Dönüştü",
                count: 1,
                closed: true,
              },
            ],
            total: 4,
            open: 3,
            closed: 1,
          },
        }}
      />,
    );

    expect(screen.getByText("Toplam 4")).toBeInTheDocument();
    expect(screen.getByLabelText("Yeni: 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Portföye Dönüştü: 1")).toBeInTheDocument();
  });

  it("servis hatasını Türkçe ve erişilebilir uyarı olarak gösterir", () => {
    render(
      <OpportunityPipeline
        result={{
          ok: false,
          error: {
            code: "OPPORTUNITY_PIPELINE_UNAVAILABLE",
            message: "Fırsat hunisi şu anda yüklenemiyor. Lütfen yeniden deneyin.",
          },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Fırsat hunisi yüklenemedi" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Fırsat hunisi şu anda yüklenemiyor. Lütfen yeniden deneyin.",
    );
  });
});
