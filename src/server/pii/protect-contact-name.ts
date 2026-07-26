import "server-only";

import { getPiiProtectionConfig } from "./environment";
import {
  protectContactNameWithConfig,
  type ProtectContactNameResult,
} from "./protect-contact-name-core";

export type { ProtectContactNameResult } from "./protect-contact-name-core";

export function protectContactName(value: string): ProtectContactNameResult {
  return protectContactNameWithConfig(value, getPiiProtectionConfig());
}
