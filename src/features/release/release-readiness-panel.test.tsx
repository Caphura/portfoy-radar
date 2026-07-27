import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReleaseReadinessPanel } from "./release-readiness-panel";

afterEach(cleanup);

describe("ReleaseReadinessPanel", () => {
  it("mobil owner görünümünde teknik sonuçları ve bekleyen kanıtları gösterir", () => {
    render(
      <ReleaseReadinessPanel
        result={{
          ok: true,
          data: {
            version: "release-v2",
            decision: "blocked",
            livePiiAllowed: false,
            summary:
              "Canlı kişisel veri yayını için teknik kontrol veya zorunlu kanıt bekleniyor.",
            technicalChecks: [
              {
                id: "database-contract",
                label: "Migration, RLS ve veritabanı sözleşmesi",
                status: "passed",
                detail: "Şema v18 doğrulandı.",
              },
              {
                id: "pii-protection",
                label: "PII şifreleme ve mükerrer blind index",
                status: "passed",
                detail: "Şifreleme sözleşmesi doğrulandı.",
              },
            ],
            manualGates: [
              {
                id: "secret-manager",
                label: "Üretim secret manager ve anahtar rotasyonu",
                owner: "Güvenlik",
                status: "open",
                closureCriteria:
                  "Üretim secret enjeksiyonu ve rotasyon tatbikatı tamamlanmalıdır.",
              },
              {
                id: "data-region-kvkk",
                label: "Üretim bölgesi ve KVKK onayı",
                owner: "Ürün sahibi",
                status: "open",
                closureCriteria:
                  "Üretim bölgesi ve KVKK politikası onaylanmalıdır.",
              },
              {
                id: "backup-restore",
                label: "Yedekten dönüş tatbikatı",
                owner: "Operasyon",
                status: "open",
                closureCriteria:
                  "Başarılı yedekten dönüş raporu kaydedilmelidir.",
              },
            ],
          },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Güvenlik ve release kapısı" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Canlı PII engelli")).toBeInTheDocument();
    expect(screen.getAllByText("Kanıt bekleniyor")).toHaveLength(3);
    expect(
      screen.getByText("Migration, RLS ve veritabanı sözleşmesi"),
    ).toBeInTheDocument();
  });

  it("politika hatasını teknik ayrıntı göstermeyen Türkçe uyarıyla verir", () => {
    render(
      <ReleaseReadinessPanel
        result={{
          ok: false,
          error: {
            code: "INVALID_RELEASE_POLICY",
            message:
              "Release politikası doğrulanamadı. Canlı kişisel veri yayını güvenli biçimde engellendi.",
          },
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Release durumu doğrulanamadı",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("stack");
  });
});
