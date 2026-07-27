// @vitest-environment node

import { randomBytes } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getMediaProtectionConfig } from "./media-config";

const key = () => randomBytes(32).toString("base64");

describe("medya keyring yapılandırması", () => {
  it("PII anahtarından ayrı aktif medya anahtarını kabul eder", () => {
    const result = getMediaProtectionConfig({
      MEDIA_ENCRYPTION_KEYRING: JSON.stringify({ 1: key(), 2: key() }),
      MEDIA_ACTIVE_ENCRYPTION_KEY_VERSION: "2",
      PII_ENCRYPTION_KEYRING: JSON.stringify({ 1: key() }),
    });

    expect(result.ok).toBe(true);
  });

  it("PII ile aynı anahtarı veya eksik aktif sürümü reddeder", () => {
    const shared = key();

    expect(
      getMediaProtectionConfig({
        MEDIA_ENCRYPTION_KEYRING: JSON.stringify({ 1: shared }),
        MEDIA_ACTIVE_ENCRYPTION_KEY_VERSION: "1",
        PII_ENCRYPTION_KEYRING: JSON.stringify({ 1: shared }),
      }),
    ).toEqual(expect.objectContaining({ ok: false }));
    expect(
      getMediaProtectionConfig({
        MEDIA_ENCRYPTION_KEYRING: JSON.stringify({ 1: key() }),
        MEDIA_ACTIVE_ENCRYPTION_KEY_VERSION: "2",
        PII_ENCRYPTION_KEYRING: JSON.stringify({ 1: key() }),
      }),
    ).toEqual(expect.objectContaining({ ok: false }));
  });
});
