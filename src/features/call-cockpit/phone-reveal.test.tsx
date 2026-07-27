import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initialPhoneRevealActionState } from "./phone-reveal-state";

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
  revealOpportunityPhoneAction: vi.fn(),
}));

import { PhoneReveal } from "./phone-reveal";

const opportunityId = "10000000-0000-4000-8000-000000000001";

describe("PhoneReveal", () => {
  afterEach(() => {
    cleanup();
    useActionStateMock.mockReset();
  });

  it("telefonu varsayılan listede göstermeyip açık eylem ve audit bilgisini sunar", () => {
    useActionStateMock.mockReturnValue([
      initialPhoneRevealActionState,
      vi.fn(),
      false,
    ]);

    render(<PhoneReveal canReveal opportunityId={opportunityId} />);

    expect(
      screen.getByRole("button", { name: "Telefonu göster" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Yalnız bu kayıt açılır ve görüntüleme audit günlüğüne yazılır.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Telefon uygulamasını aç" }),
    ).not.toBeInTheDocument();
  });

  it("açık eylem sonucunu kullanıcı kontrollü tel bağlantısıyla gösterir", () => {
    const syntheticPhone = "+90-SENTETIK";
    useActionStateMock.mockReturnValue([
      {
        status: "success",
        error: null,
        phone: syntheticPhone,
      },
      vi.fn(),
      false,
    ]);

    render(<PhoneReveal canReveal opportunityId={opportunityId} />);

    expect(screen.getByText(syntheticPhone)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Telefon uygulamasını aç" }),
    ).toHaveAttribute("href", `tel:${syntheticPhone}`);
    expect(
      screen.getByText(
        "Arama otomatik başlamaz; cihazınızın telefon ekranı açılır.",
      ),
    ).toBeInTheDocument();
  });

  it("viewer için açık telefon eylemini ve formu kapatır", () => {
    useActionStateMock.mockReturnValue([
      initialPhoneRevealActionState,
      vi.fn(),
      false,
    ]);

    render(<PhoneReveal canReveal={false} opportunityId={opportunityId} />);

    expect(
      screen.getByText(
        "Telefonu yalnızca sahip veya danışman açık eylemle görüntüleyebilir.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Telefonu göster" }),
    ).not.toBeInTheDocument();
  });

  it("sunucu hatasını telefon değeri olmadan Türkçe gösterir", () => {
    useActionStateMock.mockReturnValue([
      {
        status: "error",
        error: "Telefon şu anda gösterilemiyor. Lütfen yeniden deneyin.",
        phone: null,
      },
      vi.fn(),
      false,
    ]);

    render(<PhoneReveal canReveal opportunityId={opportunityId} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Telefon şu anda gösterilemiyor",
    );
    expect(
      screen.queryByRole("link", { name: "Telefon uygulamasını aç" }),
    ).not.toBeInTheDocument();
  });
});
