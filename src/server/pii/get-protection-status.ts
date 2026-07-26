import "server-only";

import { getPiiProtectionConfig } from "./environment";
import {
  resolvePiiProtectionStatus,
  type PiiProtectionStatusResult,
} from "./status-core";

export function getPiiProtectionStatus(): PiiProtectionStatusResult {
  return resolvePiiProtectionStatus(getPiiProtectionConfig());
}
