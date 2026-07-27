import "server-only";

import { Buffer } from "node:buffer";

import { z } from "zod";

export type MediaKeyring = ReadonlyMap<number, Buffer>;

export type MediaProtectionConfigResult =
  | {
      ok: true;
      data: {
        keys: MediaKeyring;
        activeVersion: number;
      };
    }
  | {
      ok: false;
      error: {
        code: "MEDIA_PROTECTION_NOT_CONFIGURED";
        message: string;
      };
    };

const environmentSchema = z.object({
  MEDIA_ENCRYPTION_KEYRING: z.string().min(1),
  MEDIA_ACTIVE_ENCRYPTION_KEY_VERSION: z.coerce
    .number()
    .int()
    .min(1)
    .max(32_767),
  PII_ENCRYPTION_KEYRING: z.string().min(1),
});

function parseKeyring(source: string): MediaKeyring | null {
  let value: unknown;

  try {
    value = JSON.parse(source);
  } catch {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const keys = new Map<number, Buffer>();

  for (const [rawVersion, rawKey] of Object.entries(value)) {
    if (!/^[1-9]\d*$/.test(rawVersion) || typeof rawKey !== "string") {
      return null;
    }

    const key = Buffer.from(rawKey, "base64");

    if (
      key.length !== 32 ||
      key.toString("base64") !== rawKey ||
      Number(rawVersion) > 32_767
    ) {
      return null;
    }

    keys.set(Number(rawVersion), key);
  }

  return keys.size > 0 ? keys : null;
}

function keyringContains(
  source: string,
  candidateKeys: MediaKeyring,
): boolean {
  const piiKeys = parseKeyring(source);

  if (!piiKeys) {
    return true;
  }

  return [...candidateKeys.values()].some((candidate) =>
    [...piiKeys.values()].some((piiKey) => candidate.equals(piiKey)),
  );
}

export function getMediaProtectionConfig(
  environment: Record<string, string | undefined> = process.env,
): MediaProtectionConfigResult {
  const parsed = environmentSchema.safeParse(environment);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "MEDIA_PROTECTION_NOT_CONFIGURED",
        message:
          "Fotoğraf şifreleme anahtarı yapılandırılmadı. Saha kaydı oluşturulmadı.",
      },
    };
  }

  const keys = parseKeyring(parsed.data.MEDIA_ENCRYPTION_KEYRING);

  if (
    !keys ||
    !keys.has(parsed.data.MEDIA_ACTIVE_ENCRYPTION_KEY_VERSION) ||
    keyringContains(parsed.data.PII_ENCRYPTION_KEYRING, keys)
  ) {
    return {
      ok: false,
      error: {
        code: "MEDIA_PROTECTION_NOT_CONFIGURED",
        message:
          "Fotoğraf şifreleme anahtarları geçersiz veya PII anahtarından ayrılmamış.",
      },
    };
  }

  return {
    ok: true,
    data: {
      keys,
      activeVersion: parsed.data.MEDIA_ACTIVE_ENCRYPTION_KEY_VERSION,
    },
  };
}
