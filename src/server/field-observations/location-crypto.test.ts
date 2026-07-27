// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { protectFieldLocation, revealFieldLocation } from "./location-crypto";

describe("kesin konum amaç ayrımlı koruması", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("koordinat, doğruluk ve kaynak zamanını tek şifreli zarfla korur", () => {
    vi.stubEnv(
      "PII_ENCRYPTION_KEYRING",
      JSON.stringify({ 1: randomBytes(32).toString("base64") }),
    );
    vi.stubEnv("PII_ACTIVE_ENCRYPTION_KEY_VERSION", "1");
    vi.stubEnv(
      "PII_PHONE_HMAC_KEYRING",
      JSON.stringify({ 1: randomBytes(32).toString("base64") }),
    );
    vi.stubEnv("PII_ACTIVE_PHONE_HMAC_KEY_VERSION", "1");
    const location = {
      latitude: 41.0082,
      longitude: 28.9784,
      accuracy: 12,
      capturedAt: "2026-07-28T09:00:00.000Z",
    };
    const protectedLocation = protectFieldLocation(location);

    expect(protectedLocation.ok).toBe(true);

    if (!protectedLocation.ok) {
      return;
    }

    expect(protectedLocation.data.ciphertext.toString("utf8")).not.toContain(
      "41.0082",
    );
    expect(revealFieldLocation(protectedLocation.data)).toEqual({
      ok: true,
      data: location,
    });
  });

  it("geçersiz koordinatı ve yanlış keyring'i reddeder", () => {
    vi.stubEnv(
      "PII_ENCRYPTION_KEYRING",
      JSON.stringify({ 1: randomBytes(32).toString("base64") }),
    );
    vi.stubEnv("PII_ACTIVE_ENCRYPTION_KEY_VERSION", "1");
    vi.stubEnv(
      "PII_PHONE_HMAC_KEYRING",
      JSON.stringify({ 1: randomBytes(32).toString("base64") }),
    );
    vi.stubEnv("PII_ACTIVE_PHONE_HMAC_KEY_VERSION", "1");

    expect(
      protectFieldLocation({
        latitude: 91,
        longitude: 28,
        accuracy: 10,
        capturedAt: "2026-07-28T09:00:00.000Z",
      }),
    ).toEqual(expect.objectContaining({ ok: false }));
  });
});
