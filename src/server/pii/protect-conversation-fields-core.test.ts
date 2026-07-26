// @vitest-environment node

import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { decryptPii } from "./crypto-core";
import { protectConversationFieldsWithConfig } from "./protect-conversation-fields-core";

function configuration() {
  return {
    ok: true as const,
    data: {
      encryption: {
        keys: new Map([[4, Buffer.alloc(32, 51)]]),
        activeVersion: 4,
      },
      phoneHmac: {
        keys: new Map([[5, Buffer.alloc(32, 52)]]),
        activeVersion: 5,
      },
    },
  };
}

describe("görüşme metni koruması", () => {
  it("not ve takip amacını farklı purpose değerleriyle şifreler", () => {
    const result = protectConversationFieldsWithConfig(
      "  Fiyat beklentisini paylaştı.  ",
      "  Yarın fiyat aralığını görüş.  ",
      configuration(),
    );

    expect(result.ok).toBe(true);

    if (!result.ok || !result.data.note || !result.data.followUpPurpose) {
      throw new Error("Geçerli görüşme metinleri şifrelenmeliydi.");
    }

    expect(
      decryptPii(
        result.data.note,
        "conversation.note",
        configuration().data.encryption.keys,
      ),
    ).toEqual({
      ok: true,
      data: "Fiyat beklentisini paylaştı.",
    });
    expect(
      decryptPii(
        result.data.followUpPurpose,
        "conversation.follow_up_purpose",
        configuration().data.encryption.keys,
      ),
    ).toEqual({
      ok: true,
      data: "Yarın fiyat aralığını görüş.",
    });
  });

  it("metin yoksa keyring olmadan güvenli boş zarflar döndürür", () => {
    const result = protectConversationFieldsWithConfig(null, null, {
      ok: false,
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED",
        message: "Yapılandırılmadı.",
      },
    });

    expect(result).toEqual({
      ok: true,
      data: {
        note: null,
        followUpPurpose: null,
      },
    });
  });

  it("uzun notu, kısa amacı ve gerekli keyring eksikliğini reddeder", () => {
    const longNote = protectConversationFieldsWithConfig(
      "x".repeat(2_001),
      null,
      configuration(),
    );
    const shortPurpose = protectConversationFieldsWithConfig(
      null,
      "x",
      configuration(),
    );
    const unavailable = protectConversationFieldsWithConfig(
      "Güvenli not",
      null,
      {
        ok: false,
        error: {
          code: "PII_PROTECTION_NOT_CONFIGURED",
          message: "Yapılandırılmadı.",
        },
      },
    );

    expect(longNote.ok).toBe(false);
    expect(shortPurpose.ok).toBe(false);
    expect(unavailable.ok).toBe(false);
  });
});
