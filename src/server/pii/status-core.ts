import type { PiiProtectionConfigResult } from "./config-core";
import {
  phoneBlindIndexAlgorithm,
  piiEncryptionAlgorithm,
} from "./crypto-core";

export type PiiProtectionStatus = {
  encryption: typeof piiEncryptionAlgorithm;
  duplicateIndex: typeof phoneBlindIndexAlgorithm;
  phoneFormat: "TR / E.164";
  listMask: "Son 2 hane";
  keyRotation: "Sürümlü";
};

export type PiiProtectionStatusResult =
  | {
      ok: true;
      data: PiiProtectionStatus;
    }
  | {
      ok: false;
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED";
        message: string;
      };
    };

export function resolvePiiProtectionStatus(
  configuration: PiiProtectionConfigResult,
): PiiProtectionStatusResult {
  if (!configuration.ok) {
    return configuration;
  }

  return {
    ok: true,
    data: {
      encryption: piiEncryptionAlgorithm,
      duplicateIndex: phoneBlindIndexAlgorithm,
      phoneFormat: "TR / E.164",
      listMask: "Son 2 hane",
      keyRotation: "Sürümlü",
    },
  };
}
