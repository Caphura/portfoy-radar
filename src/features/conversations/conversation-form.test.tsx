import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  recordConversationAction: vi.fn(),
}));

import { ConversationForm } from "./conversation-form";

const props = {
  opportunityId: "10000000-0000-4000-8000-000000000001",
  defaultOccurredAt: "2026-07-26T12:00",
  defaultFollowUpAt: "2026-07-27T12:00",
  opportunityClosed: false,
};

describe("ConversationForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("mobil manuel görüşme alanlarını ve otomasyon yokluğu açıklamasını gösterir", () => {
    render(<ConversationForm {...props} />);

    expect(
      screen.getByRole("heading", { name: "Görüşme kaydet" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Görüşme kanalı")).toHaveValue("phone");
    expect(screen.getByLabelText("Görüşme sonucu")).toHaveValue("");
    expect(screen.getByLabelText("Görüşme zamanı")).toHaveValue(
      "2026-07-26T12:00",
    );
    expect(
      screen.getByText(/arama veya mesaj göndermez/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/“Ulaşılamadı” bir görüşme sonucudur/i),
    ).toBeInTheDocument();
  });

  it("takip seçilince tarih ve amacı koşullu zorunlu alan olarak açar", () => {
    render(<ConversationForm {...props} />);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Bu görüşme takip gerektiriyor",
      }),
    );

    expect(screen.getByLabelText("Takip zamanı")).toBeRequired();
    expect(screen.getByLabelText("Takip zamanı")).toHaveValue(
      "2026-07-27T12:00",
    );
    expect(screen.getByLabelText("Takip amacı")).toBeRequired();
    expect(
      screen.getByText(/aynı işlemde açık görev oluşturulur/i),
    ).toBeInTheDocument();
  });

  it("kapanmış fırsatta takip seçimini kapatıp görüşme kaydını açık bırakır", () => {
    render(<ConversationForm {...props} opportunityClosed />);

    expect(
      screen.getByRole("checkbox", {
        name: "Bu görüşme takip gerektiriyor",
      }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Kapanmış fırsatta görüşme kaydı tutulabilir/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Görüşmeyi kaydet" }),
    ).toBeEnabled();
  });
});
