// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { initialPhoneRevealActionState } from "./phone-reveal-state";

const { redirectMock, revealOpportunityPhoneMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  revealOpportunityPhoneMock: vi.fn(),
}));

vi.mock("@/server/priority/reveal-opportunity-phone", () => ({
  revealOpportunityPhone: revealOpportunityPhoneMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { revealOpportunityPhoneAction } from "./actions";

const opportunityId = "10000000-0000-4000-8000-000000000001";

function formData(value = opportunityId) {
  const data = new FormData();
  data.set("opportunityId", value);
  return data;
}

describe("revealOpportunityPhoneAction", () => {
  afterEach(() => {
    redirectMock.mockReset();
    revealOpportunityPhoneMock.mockReset();
  });

  it("geçersiz fırsatı servise göndermeden Türkçe hata verir", async () => {
    const result = await revealOpportunityPhoneAction(
      initialPhoneRevealActionState,
      formData("gecersiz"),
    );

    expect(result).toEqual({
      status: "error",
      error: "Fırsat doğrulanamadı. Sayfayı yenileyip yeniden deneyin.",
      phone: null,
    });
    expect(revealOpportunityPhoneMock).not.toHaveBeenCalled();
  });

  it("oturumsuz kullanıcıyı giriş ekranına yönlendirir", async () => {
    revealOpportunityPhoneMock.mockResolvedValue({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "private-auth-detail",
      },
    });
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      revealOpportunityPhoneAction(
        initialPhoneRevealActionState,
        formData(),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
  });

  it("yetki ve servis ayrıntılarını güvenli kullanıcı mesajına dönüştürür", async () => {
    revealOpportunityPhoneMock
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "FORBIDDEN", message: "private-role-detail" },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "PHONE_REVEAL_UNAVAILABLE",
          message: "private-database-detail",
        },
      });

    const forbidden = await revealOpportunityPhoneAction(
      initialPhoneRevealActionState,
      formData(),
    );
    const unavailable = await revealOpportunityPhoneAction(
      initialPhoneRevealActionState,
      formData(),
    );

    expect(forbidden.error).toBe(
      "Telefonu göstermek için sahip veya danışman rolü gerekir.",
    );
    expect(unavailable.error).toBe(
      "Telefon şu anda gösterilemiyor. Lütfen yeniden deneyin.",
    );
    expect(JSON.stringify([forbidden, unavailable])).not.toContain("private-");
  });

  it("başarılı açık eylemde yalnız telefon değerini state'e taşır", async () => {
    const syntheticPhone = "+90-SENTETIK";
    revealOpportunityPhoneMock.mockResolvedValue({
      ok: true,
      data: {
        opportunityId,
        phone: syntheticPhone,
      },
    });

    const result = await revealOpportunityPhoneAction(
      initialPhoneRevealActionState,
      formData(),
    );

    expect(revealOpportunityPhoneMock).toHaveBeenCalledWith(opportunityId);
    expect(result).toEqual({
      status: "success",
      error: null,
      phone: syntheticPhone,
    });
  });
});
