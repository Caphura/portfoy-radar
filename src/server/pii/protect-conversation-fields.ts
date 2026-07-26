import "server-only";

import { getPiiProtectionConfig } from "./environment";
import {
  protectConversationFieldsWithConfig,
  type ProtectConversationFieldsResult,
} from "./protect-conversation-fields-core";

export type { ProtectConversationFieldsResult } from "./protect-conversation-fields-core";

export function protectConversationFields(
  note: string | null,
  followUpPurpose: string | null,
): ProtectConversationFieldsResult {
  return protectConversationFieldsWithConfig(
    note,
    followUpPurpose,
    getPiiProtectionConfig(),
  );
}
