// @vitest-environment node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

describe("secret keyring denetleyicisi", () => {
  it("yalnız sürüm ve parmak izi raporlar, anahtar değerini yazdırmaz", () => {
    const temporaryDirectory = mkdtempSync(
      path.join(tmpdir(), "portfoy-radar-keyring-"),
    );
    const environmentPath = path.join(temporaryDirectory, "production.env");
    const piiKey = Buffer.alloc(32, 1).toString("base64");
    const hmacKey = Buffer.alloc(32, 2).toString("base64");
    const mediaKey = Buffer.alloc(32, 3).toString("base64");

    try {
      writeFileSync(
        environmentPath,
        [
          "SUPABASE_URL=https://example.supabase.co",
          "SUPABASE_SERVICE_ROLE_KEY=server-value-never-print",
          "CRON_SECRET=cron-value-never-print",
          "FIELD_OBSERVATION_MODE=disabled",
          "PII_ACTIVE_ENCRYPTION_KEY_VERSION=2",
          `PII_ENCRYPTION_KEYRING='${JSON.stringify({ 2: piiKey })}'`,
          "PII_ACTIVE_PHONE_HMAC_KEY_VERSION=2",
          `PII_PHONE_HMAC_KEYRING='${JSON.stringify({ 2: hmacKey })}'`,
          "MEDIA_ACTIVE_ENCRYPTION_KEY_VERSION=2",
          `MEDIA_ENCRYPTION_KEYRING='${JSON.stringify({ 2: mediaKey })}'`,
        ].join("\n"),
        { mode: 0o600 },
      );

      const output = execFileSync(
        process.execPath,
        [
          path.join(repositoryRoot, "scripts/inspect-secret-keyrings.mjs"),
          environmentPath,
        ],
        { encoding: "utf8" },
      );
      const result = JSON.parse(output) as {
        pii: { active: string; versions: Record<string, string> };
        phoneHmac: { active: string; versions: Record<string, string> };
        media: { active: string; versions: Record<string, string> };
        serviceRolePresent: boolean;
        cronSecretPresent: boolean;
      };

      expect(result.pii).toEqual({
        active: "2",
        versions: { 2: fingerprint(piiKey) },
      });
      expect(result.phoneHmac).toEqual({
        active: "2",
        versions: { 2: fingerprint(hmacKey) },
      });
      expect(result.media).toEqual({
        active: "2",
        versions: { 2: fingerprint(mediaKey) },
      });
      expect(result.serviceRolePresent).toBe(true);
      expect(result.cronSecretPresent).toBe(true);
      expect(output).not.toContain(piiKey);
      expect(output).not.toContain(hmacKey);
      expect(output).not.toContain(mediaKey);
      expect(output).not.toContain("server-value-never-print");
      expect(output).not.toContain("cron-value-never-print");
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
