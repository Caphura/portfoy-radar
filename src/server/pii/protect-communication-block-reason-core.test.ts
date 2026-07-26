import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import type { PiiProtectionConfigResult } from "./config-core";
import { decryptPii } from "./crypto-core";
import { protectCommunicationBlockReasonWithConfig } from "./protect-communication-block-reason-core";

const encryptionKey = Buffer.alloc(32, 7);
const configuration: PiiProtectionConfigResult = {
  ok: true,
  data: {
    encryption: {
      keys: new Map([[3, encryptionKey]]),
      activeVersion: 3,
    },
    phoneHmac: {
      keys: new Map([[1, Buffer.alloc(32, 9)]]),
      activeVersion: 1,
    },
  },
};

describe("iletişim engeli nedeni koruması", () => {
  it("engel ve kaldırma nedenlerini birbirinden ayrı amaçlarla şifreler", () => {
    const block = protectCommunicationBlockReasonWithConfig(
      "Sentetik engel açıklaması.",
      "block",
      configuration,
    );
    const lift = protectCommunicationBlockReasonWithConfig(
      "Sentetik kaldırma açıklaması.",
      "lift",
      configuration,
    );

    expect(block.ok).toBe(true);
    expect(lift.ok).toBe(true);

    if (!block.ok || !lift.ok) {
      return;
    }

    expect(
      decryptPii(
        block.data,
        "communication_block.reason",
        configuration.data.encryption.keys,
      ),
    ).toEqual({
      ok: true,
      data: "Sentetik engel açıklaması.",
    });
    expect(
      decryptPii(
        lift.data,
        "communication_block.lift_reason",
        configuration.data.encryption.keys,
      ),
    ).toEqual({
      ok: true,
      data: "Sentetik kaldırma açıklaması.",
    });
    expect(
      decryptPii(
        block.data,
        "communication_block.lift_reason",
        configuration.data.encryption.keys,
      ).ok,
    ).toBe(false);
  });

  it("kısa, uzun ve yapılandırmasız nedenleri güvenli biçimde reddeder", () => {
    expect(
      protectCommunicationBlockReasonWithConfig("x", "block", configuration),
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_COMMUNICATION_BLOCK_REASON" },
    });
    expect(
      protectCommunicationBlockReasonWithConfig(
        "x".repeat(501),
        "lift",
        configuration,
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_COMMUNICATION_BLOCK_REASON" },
    });
    expect(
      protectCommunicationBlockReasonWithConfig("Geçerli neden.", "block", {
        ok: false,
        error: {
          code: "PII_PROTECTION_NOT_CONFIGURED",
          message: "private-keyring-detail",
        },
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "PII_PROTECTION_NOT_CONFIGURED" },
    });
  });
});
