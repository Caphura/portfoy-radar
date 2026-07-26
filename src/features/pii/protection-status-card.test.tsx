import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PiiProtectionStatusCard } from "./protection-status-card";

describe("PiiProtectionStatusCard", () => {
  afterEach(cleanup);

  it("mobil durum kartında açık kişisel veri olmadan korumaları gösterir", () => {
    render(
      <PiiProtectionStatusCard
        result={{
          ok: true,
          data: {
            encryption: "AES-256-GCM",
            duplicateIndex: "HMAC-SHA-256",
            phoneFormat: "TR / E.164",
            listMask: "Son 2 hane",
            keyRotation: "Sürümlü",
          },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Kişisel veri koruması hazır" }),
    ).toBeInTheDocument();
    expect(screen.getByText("AES-256-GCM")).toBeInTheDocument();
    expect(screen.getByText("HMAC-SHA-256")).toBeInTheDocument();
    expect(screen.getByText("Son 2 hane")).toBeInTheDocument();
  });

  it("eksik anahtarları erişilebilir Türkçe yayın engeli olarak gösterir", () => {
    render(
      <PiiProtectionStatusCard
        result={{
          ok: false,
          error: {
            code: "PII_PROTECTION_NOT_CONFIGURED",
            message:
              "Kişisel veri koruması yapılandırılmadı. Telefon veya e-posta kaydetmeyin.",
          },
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kişisel veri koruması hazır değil",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Telefon veya e-posta kaydetmeyin.",
    );
  });
});
