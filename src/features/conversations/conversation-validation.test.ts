import { describe, expect, it } from "vitest";

import {
  defaultConversationFollowUpAt,
  defaultConversationOccurredAt,
  validateConversationForm,
} from "./conversation-validation";

const now = new Date("2026-07-26T09:00:00.000Z");
const opportunityId = "10000000-0000-4000-8000-000000000001";

function validFormData() {
  const formData = new FormData();
  formData.set("opportunityId", opportunityId);
  formData.set("channel", "phone");
  formData.set("result", "unreachable");
  formData.set("occurredAt", "2026-07-26T11:55");
  formData.set("note", "Sentetik görüşme özeti.");
  return formData;
}

describe("validateConversationForm", () => {
  it("Ulaşılamadı sonucunu aşama değil görüşme sonucu olarak kabul eder", () => {
    const result = validateConversationForm(validFormData(), now);

    expect(result).toEqual({
      ok: true,
      data: {
        opportunityId,
        channel: "phone",
        result: "unreachable",
        occurredAt: "2026-07-26T08:55:00.000Z",
        note: "Sentetik görüşme özeti.",
        requiresFollowUp: false,
        followUpAt: null,
        followUpPurpose: null,
      },
    });
  });

  it("BR-02 gereği takip tarihini ve amacını birlikte zorunlu tutar", () => {
    const formData = validFormData();
    formData.set("requiresFollowUp", "on");

    const result = validateConversationForm(formData, now);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.fieldErrors.followUpAt).toBe(
        "Geçerli bir takip tarihi ve saati seçin.",
      );
      expect(result.fieldErrors.followUpPurpose).toBe(
        "Takip amacı en az 3 karakter olmalıdır.",
      );
    }
  });

  it("geçerli takip planını İstanbul saatinden ofsetli sunucu girdisine dönüştürür", () => {
    const formData = validFormData();
    formData.set("requiresFollowUp", "on");
    formData.set("followUpAt", "2026-07-27T12:00");
    formData.set("followUpPurpose", "Fiyat beklentisini yeniden görüş.");

    const result = validateConversationForm(formData, now);

    expect(result).toMatchObject({
      ok: true,
      data: {
        requiresFollowUp: true,
        followUpAt: "2026-07-27T09:00:00.000Z",
        followUpPurpose: "Fiyat beklentisini yeniden görüş.",
      },
    });
  });

  it("gelecekteki görüşmeyi ve geçmiş takip zamanını reddeder", () => {
    const formData = validFormData();
    formData.set("occurredAt", "2026-07-26T12:30");
    formData.set("requiresFollowUp", "on");
    formData.set("followUpAt", "2026-07-26T11:00");
    formData.set("followUpPurpose", "Yeniden ara.");

    const result = validateConversationForm(formData, now);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.fieldErrors.occurredAt).toBe(
        "Görüşme zamanı gelecekte olamaz.",
      );
      expect(result.fieldErrors.followUpAt).toBe(
        "Takip zamanı gelecekte olmalıdır.",
      );
    }
  });

  it("varsayılanları Europe/Istanbul iş saatiyle üretir", () => {
    expect(defaultConversationOccurredAt(now)).toBe("2026-07-26T12:00");
    expect(defaultConversationFollowUpAt(now)).toBe("2026-07-27T12:00");
  });
});
