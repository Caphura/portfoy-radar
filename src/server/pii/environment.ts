import "server-only";

import {
  parsePiiProtectionConfig,
  type PiiProtectionConfigResult,
} from "./config-core";

export function getPiiProtectionConfig(): PiiProtectionConfigResult {
  return parsePiiProtectionConfig(process.env);
}
