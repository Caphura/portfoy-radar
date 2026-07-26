// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { initialQuickFsboActionState } from "./quick-fsbo-state";
import { defaultQuickFsboNextActionAt } from "./quick-fsbo-validation";
import type { DuplicateCandidate } from "./duplicate-review";

vi.mock("server-only", () => ({}));

const {
  createQuickFsboMock,
  inspectQuickFsboDuplicatesMock,
  redirectMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
    createQuickFsboMock: vi.fn(),
    inspectQuickFsboDuplicatesMock: vi.fn(),
    redirectMock: vi.fn(),
    revalidatePathMock: vi.fn(),
}));

vi.mock("@/server/fsbo/create-quick-fsbo", () => ({
  createQuickFsbo: createQuickFsboMock,
}));

vi.mock("@/server/fsbo/inspect-quick-fsbo-duplicates", () => ({
  inspectQuickFsboDuplicates: inspectQuickFsboDuplicatesMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { createQuickFsboAction } from "./actions";

const subscriber = ["5", "55", "000", "00", "00"].join("");
const candidateKey = [
  "11000000-0000-4000-8000-000000000001",
  "12000000-0000-4000-8000-000000000001",
  "13000000-0000-4000-8000-000000000001",
  "-",
].join(":");
const duplicateCandidate: DuplicateCandidate = {
  key: candidateKey,
  rank: 1,
  matchKinds: ["platform_listing"],
  linkable: true,
  listing: {
    platform: "sahibinden",
    externalListingId: "123456",
    transactionType: "sale" as const,
    status: "active" as const,
    askingPrice: 7_500_000,
    currency: "TRY",
    lastSeenAt: "2026-07-26T08:00:00.000Z",
  },
  property: {
    city: "İstanbul",
    district: "Kadıköy",
    neighborhood: "Fenerbahçe",
    roomCount: 3,
    livingRoomCount: 1,
    netAreaSqm: 110,
    grossAreaSqm: 125,
  },
  opportunity: {
    stage: "new" as const,
    nextActionAt: "2026-07-26T08:00:00.000Z",
  },
};

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
    inspectQuickFsboDuplicatesMock.mockReset();
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
    expect(inspectQuickFsboDuplicatesMock).not.toHaveBeenCalled();
    expect(createQuickFsboMock).not.toHaveBeenCalled();
  });

  it("oturumsuz kullanıcıyı girişe yönlendirir", async () => {
    inspectQuickFsboDuplicatesMock.mockResolvedValue({
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
    inspectQuickFsboDuplicatesMock.mockResolvedValue({
      ok: true,
      data: {
        candidates: [],
        maskedPhone: "+90 ••• ••• •• 00",
      },
    });
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
    inspectQuickFsboDuplicatesMock.mockResolvedValue({
      ok: true,
      data: {
        candidates: [],
        maskedPhone: "+90 ••• ••• •• 00",
      },
    });
    createQuickFsboMock.mockResolvedValue({
      ok: true,
      data: {
        opportunityId: "11000000-0000-4000-8000-000000000001",
        listingId: "12000000-0000-4000-8000-000000000001",
        stage: "new",
        nextActionAt: "2090-07-26T08:00:00.000Z",
        maskedPhone: "+90 ••• ••• •• 00",
        outcome: "created_new",
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
      separationReasonError: null,
      review: null,
      success: {
        message: "FSBO fırsatı Yeni aşamasında oluşturuldu.",
        detail:
          "Mükerrer aday bulunmadı; kişi, gayrimenkul ve ilan ayrı kaydedildi.",
        maskedPhone: "+90 ••• ••• •• 00",
        nextActionAt: "2090-07-26T08:00:00.000Z",
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace");
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace/ekle");
    expect(JSON.stringify(result)).not.toContain(subscriber.slice(0, -2));
  });

  it("aday bulunduğunda kayıt oluşturmadan açıklanabilir karar durumuna geçer", async () => {
    inspectQuickFsboDuplicatesMock.mockResolvedValue({
      ok: true,
      data: {
        candidates: [duplicateCandidate],
        maskedPhone: "+90 ••• ••• •• 00",
      },
    });

    const result = await createQuickFsboAction(
      initialQuickFsboActionState,
      validFormData(),
    );

    expect(result).toMatchObject({
      status: "review",
      formError: null,
      separationReasonError: null,
      review: {
        maskedPhone: "+90 ••• ••• •• 00",
        candidates: [
          {
            key: candidateKey,
            rank: 1,
            matchKinds: ["platform_listing"],
          },
        ],
      },
      success: null,
    });
    expect(createQuickFsboMock).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(subscriber.slice(0, -2));
  });

  it("ayrı kayıt kararını gerekçesiyle domain servisine iletir", async () => {
    const formData = validFormData();
    formData.set("duplicateDecision", "keep_separate");
    formData.set("duplicateCandidate", candidateKey);
    formData.set("separationReason", "Malik ve adres bilgileri farklı.");
    createQuickFsboMock.mockResolvedValue({
      ok: true,
      data: {
        opportunityId: "11000000-0000-4000-8000-000000000002",
        listingId: "12000000-0000-4000-8000-000000000002",
        stage: "new",
        nextActionAt: "2090-07-26T08:00:00.000Z",
        maskedPhone: "+90 ••• ••• •• 00",
        outcome: "created_separate",
      },
    });

    const result = await createQuickFsboAction(
      {
        ...initialQuickFsboActionState,
        status: "review",
        review: {
          candidates: [duplicateCandidate],
          maskedPhone: "+90 ••• ••• •• 00",
        },
      },
      formData,
    );

    expect(inspectQuickFsboDuplicatesMock).not.toHaveBeenCalled();
    expect(createQuickFsboMock).toHaveBeenCalledWith(
      expect.objectContaining({ externalListingId: "123456" }),
      {
        decision: "keep_separate",
        candidateKey,
        separationReason: "Malik ve adres bilgileri farklı.",
      },
    );
    expect(result).toMatchObject({
      status: "success",
      success: {
        message: "Ayrı FSBO fırsatı oluşturuldu.",
      },
    });
  });
});
