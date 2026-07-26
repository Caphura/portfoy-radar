import "server-only";

import { getPiiProtectionConfig } from "./environment";
import {
  protectDuplicateReasonWithConfig,
  type ProtectDuplicateReasonResult,
} from "./protect-duplicate-reason-core";

export type { ProtectDuplicateReasonResult } from "./protect-duplicate-reason-core";

export function protectDuplicateReason(
  value: string,
): ProtectDuplicateReasonResult {
  return protectDuplicateReasonWithConfig(value, getPiiProtectionConfig());
}
