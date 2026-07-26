// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { initialCommunicationBlockActionState } from "./communication-block-state";

const {
  liftContactCommunicationBlockMock,
  markContactDoNotCallMock,
  redirectMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  liftContactCommunicationBlockMock: vi.fn(),
  markContactDoNotCallMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/server/communication-blocks/manage-communication-block", () => ({
  liftContactCommunicationBlock: liftContactCommunicationBlockMock,
  markContactDoNotCall: markContactDoNotCallMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  liftContactCommunicationBlockAction,
  markContactDoNotCallAction,
} from "./actions";

const opportunityId = "10000000-0000-4000-8000-000000000001";

function validFormData() {
  const data = new FormData();
  data.set("opportunityId", opportunityId);
  data.set("reason", "Sentetik işlem gerekçesi.");
  data.set("confirmation", "on");
  return data;
}

describe("iletişim engeli server actionları", () => {
  afterEach(() => {
    liftContactCommunicationBlockMock.mockReset();
    markContactDoNotCallMock.mockReset();
    redirectMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("onaysız işlemi servisi çağırmadan alan hatasıyla reddeder", async () => {
    const data = validFormData();
    data.delete("confirmation");

    const result = await markContactDoNotCallAction(
      initialCommunicationBlockActionState,
      data,
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors.confirmation).toBe(
      "İşlemin etkisini anladığınızı onaylayın.",
    );
    expect(markContactDoNotCallMock).not.toHaveBeenCalled();
  });

  it("oturumsuz kullanıcıyı giriş ekranına yönlendirir", async () => {
    markContactDoNotCallMock.mockResolvedValue({
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
      markContactDoNotCallAction(
        initialCommunicationBlockActionState,
        validFormData(),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
  });

  it("PII ve veritabanı ayrıntısını güvenli Türkçe hataya dönüştürür", async () => {
    markContactDoNotCallMock.mockResolvedValue({
      ok: false,
      error: {
        code: "PII_PROTECTION_UNAVAILABLE",
        message: "private-keyring-detail",
      },
    });

    const result = await markContactDoNotCallAction(
      initialCommunicationBlockActionState,
      validFormData(),
    );

    expect(result.formError).toBe(
      "İşlem nedeni güvenli biçimde korunamadığı için değişiklik yapılmadı.",
    );
    expect(JSON.stringify(result)).not.toContain("private-keyring-detail");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("BR-03 atomik sonucunu sayımlarla bildirip ilgili ekranları yeniler", async () => {
    markContactDoNotCallMock.mockResolvedValue({
      ok: true,
      data: {
        communicationBlockId: "20000000-0000-4000-8000-000000000001",
        opportunityId,
        active: true,
        affectedOpportunityCount: 2,
        cancelledTaskCount: 1,
      },
    });

    const result = await markContactDoNotCallAction(
      initialCommunicationBlockActionState,
      validFormData(),
    );

    expect(markContactDoNotCallMock).toHaveBeenCalledWith(
      opportunityId,
      "Sentetik işlem gerekçesi.",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/workspace/radar/${opportunityId}`,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace/radar");
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace");
    expect(result).toMatchObject({
      status: "success",
      success: {
        message: "Kişi Aranmayacak olarak işaretlendi.",
        detail: "2 açık fırsat kapatıldı, 1 açık görev iptal edildi.",
      },
    });
  });

  it("engel kaldırmada eski kayıtların açılmadığını açıkça bildirir", async () => {
    liftContactCommunicationBlockMock.mockResolvedValue({
      ok: true,
      data: {
        communicationBlockId: "20000000-0000-4000-8000-000000000001",
        opportunityId,
        active: false,
        reopenedOpportunityCount: 0,
        reopenedTaskCount: 0,
      },
    });

    const result = await liftContactCommunicationBlockAction(
      initialCommunicationBlockActionState,
      validFormData(),
    );

    expect(liftContactCommunicationBlockMock).toHaveBeenCalledWith(
      opportunityId,
      "Sentetik işlem gerekçesi.",
    );
    expect(result).toMatchObject({
      status: "success",
      success: {
        message: "İletişim engeli kaldırıldı.",
        detail:
          "Eski fırsatlar ve iptal edilmiş görevler otomatik olarak yeniden açılmadı.",
      },
    });
  });
});
