import "server-only";

import { z } from "zod";

import {
  decryptPii,
  encryptPii,
  type PiiEnvelope,
} from "@/server/pii/crypto-core";
import { getPiiProtectionConfig } from "@/server/pii/environment";

export const fieldLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().max(100_000),
  capturedAt: z.iso.datetime({ offset: true }),
});

export type FieldLocation = z.infer<typeof fieldLocationSchema>;

const locationError = {
  code: "LOCATION_PROTECTION_FAILED" as const,
  message: "Konum güvenli biçimde işlenemedi. Fotoğraf konumsuz kaydedilebilir.",
};

export function protectFieldLocation(
  input: unknown,
):
  | { ok: true; data: PiiEnvelope }
  | { ok: false; error: typeof locationError } {
  const parsed = fieldLocationSchema.safeParse(input);
  const configuration = getPiiProtectionConfig();

  if (!parsed.success || !configuration.ok) {
    return { ok: false, error: locationError };
  }

  const protectedValue = encryptPii(
    JSON.stringify(parsed.data),
    "field_observation_location",
    configuration.data.encryption.keys,
    configuration.data.encryption.activeVersion,
  );

  return protectedValue.ok
    ? protectedValue
    : { ok: false, error: locationError };
}

export function revealFieldLocation(
  envelope: PiiEnvelope,
):
  | { ok: true; data: FieldLocation }
  | { ok: false; error: typeof locationError } {
  const configuration = getPiiProtectionConfig();

  if (!configuration.ok) {
    return { ok: false, error: locationError };
  }

  const revealed = decryptPii(
    envelope,
    "field_observation_location",
    configuration.data.encryption.keys,
  );

  if (!revealed.ok) {
    return { ok: false, error: locationError };
  }

  try {
    const parsed = fieldLocationSchema.safeParse(JSON.parse(revealed.data));
    return parsed.success
      ? { ok: true, data: parsed.data }
      : { ok: false, error: locationError };
  } catch {
    return { ok: false, error: locationError };
  }
}
