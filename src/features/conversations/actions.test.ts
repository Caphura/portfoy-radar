// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { initialConversationActionState } from "./conversation-state";
import {
  defaultConversationFollowUpAt,
  defaultConversationOccurredAt,
} from "./conversation-validation";

const { recordConversationMock, redirectMock, revalidatePathMock } = vi.hoisted(
  () => ({
    recordConversationMock: vi.fn(),
    redirectMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }),
);

vi.mock("@/server/conversations/record-conversation", () => ({
  recordConversation: recordConversationMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { recordConversationAction } from "./actions";

const opportunityId = "10000000-0000-4000-8000-000000000001";

function validFormData(requiresFollowUp = false) {
  const formData = new FormData();
  formData.set("opportunityId", opportunityId);
  formData.set("channel", "phone");
  formData.set("result", "unreachable");
  formData.set("occurredAt", defaultConversationOccurredAt());
  formData.set("note", "Sentetik görüşme özeti.");

  if (requiresFollowUp) {
    formData.set("requiresFollowUp", "on");
    formData.set("followUpAt", defaultConversationFollowUpAt());
    formData.set("followUpPurpose", "Fiyat beklentisini yeniden görüş.");
  }

  return formData;
}

describe("recordConversationAction", () => {
  afterEach(() => {
    recordConversationMock.mockReset();
    redirectMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("eksik sonucu sunucu servisini çağırmadan alan hatasıyla reddeder", async () => {
    const formData = validFormData();
    formData.delete("result");

    const result = await recordConversationAction(
      initialConversationActionState,
      formData,
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors.result).toBe("Görüşme sonucu seçin.");
    expect(recordConversationMock).not.toHaveBeenCalled();
  });

  it("oturumsuz kullanıcıyı giriş ekranına yönlendirir", async () => {
    recordConversationMock.mockResolvedValue({
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
      recordConversationAction(
        initialConversationActionState,
        validFormData(),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
  });

  it("PII koruma ve veritabanı ayrıntısını güvenli Türkçe hataya dönüştürür", async () => {
    recordConversationMock.mockResolvedValue({
      ok: false,
      error: {
        code: "PII_PROTECTION_UNAVAILABLE",
        message: "private-encryption-detail",
      },
    });

    const result = await recordConversationAction(
      initialConversationActionState,
      validFormData(),
    );

    expect(result.formError).toBe(
      "Not veya takip amacı güvenli biçimde korunamadığı için görüşme kaydedilmedi.",
    );
    expect(JSON.stringify(result)).not.toContain("private-encryption-detail");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("BR-02 atomik sonucunu bildirip fırsat ve Radar verisini yeniler", async () => {
    recordConversationMock.mockResolvedValue({
      ok: true,
      data: {
        conversationId: "20000000-0000-4000-8000-000000000001",
        followUpTaskId: "30000000-0000-4000-8000-000000000001",
        opportunityId,
        requiresFollowUp: true,
        nextActionAt: "2026-07-27T09:00:00.000Z",
        occurredAt: "2026-07-26T09:00:00.000Z",
      },
    });

    const result = await recordConversationAction(
      initialConversationActionState,
      validFormData(true),
    );

    expect(recordConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        opportunityId,
        result: "unreachable",
        requiresFollowUp: true,
        followUpPurpose: "Fiyat beklentisini yeniden görüş.",
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/workspace/radar/${opportunityId}`,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace/radar");
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace");
    expect(result).toMatchObject({
      status: "success",
      success: {
        message: "Görüşme ve takip planı kaydedildi.",
      },
    });
  });
});
