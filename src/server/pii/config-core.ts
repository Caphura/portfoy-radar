import { Buffer } from "node:buffer";

import { z } from "zod";

const positiveVersionSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(32_767);
const environmentSchema = z.object({
  PII_ENCRYPTION_KEYRING: z.string().min(1),
  PII_ACTIVE_ENCRYPTION_KEY_VERSION: positiveVersionSchema,
  PII_PHONE_HMAC_KEYRING: z.string().min(1),
  PII_ACTIVE_PHONE_HMAC_KEY_VERSION: positiveVersionSchema,
});

export type PiiKeyring = ReadonlyMap<number, Buffer>;

export type PiiProtectionConfig = {
  encryption: {
    keys: PiiKeyring;
    activeVersion: number;
  };
  phoneHmac: {
    keys: PiiKeyring;
    activeVersion: number;
  };
};

export type PiiProtectionConfigResult =
  | {
      ok: true;
      data: PiiProtectionConfig;
    }
  | {
      ok: false;
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED";
        message: string;
      };
    };

type ServerEnvironment = Record<string, string | undefined>;

const unavailableResult: PiiProtectionConfigResult = {
  ok: false,
  error: {
    code: "PII_PROTECTION_NOT_CONFIGURED",
    message:
      "Kişisel veri koruması yapılandırılmadı. Telefon veya e-posta kaydetmeyin.",
  },
};

function decodeKey(value: unknown): Buffer | null {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value) ||
    value.length % 4 !== 0
  ) {
    return null;
  }

  const decoded = Buffer.from(value, "base64");

  if (decoded.length !== 32 || decoded.toString("base64") !== value) {
    return null;
  }

  return decoded;
}

function parseKeyring(source: string): PiiKeyring | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    return null;
  }

  const entries = Object.entries(parsed);

  if (entries.length === 0) {
    return null;
  }

  const keys = new Map<number, Buffer>();

  for (const [rawVersion, rawKey] of entries) {
    if (!/^[1-9]\d*$/.test(rawVersion)) {
      return null;
    }

    const version = Number(rawVersion);
    const key = decodeKey(rawKey);

    if (!Number.isSafeInteger(version) || version > 32_767 || !key) {
      return null;
    }

    keys.set(version, key);
  }

  return keys;
}

function keyringsAreSeparated(left: PiiKeyring, right: PiiKeyring): boolean {
  for (const leftKey of left.values()) {
    for (const rightKey of right.values()) {
      if (leftKey.equals(rightKey)) {
        return false;
      }
    }
  }

  return true;
}

export function parsePiiProtectionConfig(
  environment: ServerEnvironment,
): PiiProtectionConfigResult {
  const parsedEnvironment = environmentSchema.safeParse(environment);

  if (!parsedEnvironment.success) {
    return unavailableResult;
  }

  const encryptionKeys = parseKeyring(
    parsedEnvironment.data.PII_ENCRYPTION_KEYRING,
  );
  const phoneHmacKeys = parseKeyring(
    parsedEnvironment.data.PII_PHONE_HMAC_KEYRING,
  );

  if (
    !encryptionKeys ||
    !phoneHmacKeys ||
    !encryptionKeys.has(
      parsedEnvironment.data.PII_ACTIVE_ENCRYPTION_KEY_VERSION,
    ) ||
    !phoneHmacKeys.has(
      parsedEnvironment.data.PII_ACTIVE_PHONE_HMAC_KEY_VERSION,
    ) ||
    !keyringsAreSeparated(encryptionKeys, phoneHmacKeys)
  ) {
    return unavailableResult;
  }

  return {
    ok: true,
    data: {
      encryption: {
        keys: encryptionKeys,
        activeVersion:
          parsedEnvironment.data.PII_ACTIVE_ENCRYPTION_KEY_VERSION,
      },
      phoneHmac: {
        keys: phoneHmacKeys,
        activeVersion:
          parsedEnvironment.data.PII_ACTIVE_PHONE_HMAC_KEY_VERSION,
      },
    },
  };
}
