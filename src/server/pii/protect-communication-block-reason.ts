import "server-only";

import { getPiiProtectionConfig } from "./environment";
import {
  protectCommunicationBlockReasonWithConfig,
  type CommunicationBlockReasonPurpose,
  type ProtectCommunicationBlockReasonResult,
} from "./protect-communication-block-reason-core";

export type { ProtectCommunicationBlockReasonResult } from "./protect-communication-block-reason-core";

export function protectCommunicationBlockReason(
  value: string,
  purpose: CommunicationBlockReasonPurpose,
): ProtectCommunicationBlockReasonResult {
  return protectCommunicationBlockReasonWithConfig(
    value,
    purpose,
    getPiiProtectionConfig(),
  );
}
