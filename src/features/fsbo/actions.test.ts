// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { initialQuickFsboActionState } from "./quick-fsbo-state";
import { defaultQuickFsboNextActionAt } from "./quick-fsbo-validation";

const { createQuickFsboMock, redirectMock, revalidatePathMock } = vi.hoisted(
  () => ({
    createQuickFsboMock: vi.fn(),
    redirectMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }),
);

vi.mock("@/server/fsbo/create-quick-fsbo", () => ({
  createQuickFsbo: createQuickFsboMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { createQuickFsboAction } from "./actions";

const subscriber = ["5", "55", "000", "00", "00"].join("");

function validFormData() {
  const formData = new FormData();
  formData.set("contactName", "Sentetik Kişi");
  formData.set("phone", `0${subscriber}`);
  formData.set("propertyType", "apartment");
  formData.set("city", "İstanbul");
  formData.set("district", "Kadıköy");
  formData.set("neighborhood", "Fenerbahçe");
  formData.set("roomCount", "3");
  formData.set("livingRoomCount", "1");
  formData.set("netAreaSqm", "110");
  formData.set("grossAreaSqm", "125");
  formData.set("platform", "sahibinden");
  formData.set("externalListingId", "123456");
  formData.set("listingUrl", "https://sahibinden.com/ilan/123456");
  formData.set("transactionType", "sale");
  formData.set("askingPrice", "7500000");
  formData.set("nextActionAt", defaultQuickFsboNextActionAt());
  return formData;
}

describe("createQuickFsboAction", () => {
  afterEach(() => {
    createQuickFsboMock.mockReset();
    redirectMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("alan hatalarını domain servisini çağırmadan döndürür", async () => {
    const result = await createQuickFsboAction(
      initialQuickFsboActionState,
      new FormData(),
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors.phone).toBeTruthy();
    expect(result.fieldErrors.askingPrice).toBeTruthy();
    expect(createQuickFsboMock).not.toHaveBeenCalled();
  });

  it("oturumsuz kullanıcıyı girişe yönlendirir", async () => {
    createQuickFsboMock.mockResolvedValue({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Devam etmek için giriş yapın.",
      },
    });
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      createQuickFsboAction(initialQuickFsboActionState, validFormData()),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
  });

  it("PII ve veritabanı hatalarını ayrıntı sızdırmadan Türkçeleştirir", async () => {
    createQuickFsboMock.mockResolvedValue({
      ok: false,
      error: {
        code: "PII_PROTECTION_UNAVAILABLE",
        message: "özel-sunucu-ayrıntısı",
      },
    });

    const result = await createQuickFsboAction(
      initialQuickFsboActionState,
      validFormData(),
    );

    expect(result.formError).toBe(
      "Kişisel veri koruması hazır olmadığı için kayıt oluşturulmadı. Lütfen yapılandırmayı kontrol edin.",
    );
    expect(JSON.stringify(result)).not.toContain("özel-sunucu-ayrıntısı");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("başarılı atomik kaydı maskeli özetle döndürüp ilgili sayfaları yeniler", async () => {
    createQuickFsboMock.mockResolvedValue({
      ok: true,
      data: {
        opportunityId: "11000000-0000-4000-8000-000000000001",
        listingId: "12000000-0000-4000-8000-000000000001",
        stage: "new",
        nextActionAt: "2090-07-26T08:00:00.000Z",
        maskedPhone: "+90 ••• ••• •• 00",
      },
    });

    const result = await createQuickFsboAction(
      initialQuickFsboActionState,
      validFormData(),
    );

    expect(result).toEqual({
      status: "success",
      fieldErrors: expect.objectContaining({
        phone: null,
        listingUrl: null,
      }),
      formError: null,
      success: {
        message: "FSBO fırsatı Yeni aşamasında oluşturuldu.",
        maskedPhone: "+90 ••• ••• •• 00",
        nextActionAt: "2090-07-26T08:00:00.000Z",
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace");
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace/ekle");
    expect(JSON.stringify(result)).not.toContain(subscriber.slice(0, -2));
  });
});
