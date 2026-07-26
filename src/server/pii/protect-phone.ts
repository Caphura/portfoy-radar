import "server-only";

import { getPiiProtectionConfig } from "./environment";
import {
  protectTurkishPhoneWithConfig,
  type ProtectPhoneResult,
} from "./protect-phone-core";

export type {
  MaskedPhoneDto,
  ProtectedPhone,
  ProtectPhoneResult,
} from "./protect-phone-core";
export { toMaskedPhoneDto } from "./protect-phone-core";

export function protectTurkishPhone(value: string): ProtectPhoneResult {
  return protectTurkishPhoneWithConfig(value, getPiiProtectionConfig());
}
