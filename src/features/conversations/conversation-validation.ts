import { z } from "zod";

import {
  conversationChannelValues,
  conversationResultValues,
  type ConversationChannel,
  type ConversationResult,
} from "./conversation-options";

export const conversationFieldNames = [
  "opportunityId",
  "channel",
  "result",
  "occurredAt",
  "note",
  "requiresFollowUp",
  "followUpAt",
  "followUpPurpose",
] as const;

export type ConversationFieldName = (typeof conversationFieldNames)[number];
export type ConversationFieldErrors = Record<
  ConversationFieldName,
  string | null
>;

export type ConversationInput = {
  opportunityId: string;
  channel: ConversationChannel;
  result: ConversationResult;
  occurredAt: string;
  note: string | null;
  requiresFollowUp: boolean;
  followUpAt: string | null;
  followUpPurpose: string | null;
};

export type ConversationValidationResult =
  | {
      ok: true;
      data: ConversationInput;
    }
  | {
      ok: false;
      fieldErrors: ConversationFieldErrors;
    };

const localDateTimeSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    "Geçerli bir tarih ve saat seçin.",
  );

const formSchema = z.object({
  opportunityId: z.uuid("Fırsat kimliği doğrulanamadı."),
  channel: z.enum(conversationChannelValues, {
    error: "Görüşme kanalı seçin.",
  }),
  result: z.enum(conversationResultValues, {
    error: "Görüşme sonucu seçin.",
  }),
  occurredAt: localDateTimeSchema,
  note: z
    .string()
    .trim()
    .max(2_000, "Görüşme notu en fazla 2000 karakter olabilir."),
  followUpAt: z.string().trim(),
  followUpPurpose: z
    .string()
    .trim()
    .max(500, "Takip amacı en fazla 500 karakter olabilir."),
});

export function createEmptyConversationFieldErrors(): ConversationFieldErrors {
  return Object.fromEntries(
    conversationFieldNames.map((field) => [field, null]),
  ) as ConversationFieldErrors;
}

function rawString(formData: FormData, field: ConversationFieldName) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function formatIstanbulLocalDateTime(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function defaultConversationOccurredAt(now = new Date()): string {
  return formatIstanbulLocalDateTime(now);
}

export function defaultConversationFollowUpAt(now = new Date()): string {
  return formatIstanbulLocalDateTime(
    new Date(now.getTime() + 24 * 60 * 60 * 1_000),
  );
}

function parseIstanbulDateTime(value: string): Date | null {
  const parsed = new Date(`${value}:00+03:00`);

  if (
    Number.isNaN(parsed.getTime()) ||
    formatIstanbulLocalDateTime(parsed) !== value
  ) {
    return null;
  }

  return parsed;
}

export function validateConversationForm(
  formData: FormData,
  now = new Date(),
): ConversationValidationResult {
  const source = {
    opportunityId: rawString(formData, "opportunityId"),
    channel: rawString(formData, "channel"),
    result: rawString(formData, "result"),
    occurredAt: rawString(formData, "occurredAt"),
    note: rawString(formData, "note"),
    followUpAt: rawString(formData, "followUpAt"),
    followUpPurpose: rawString(formData, "followUpPurpose"),
  };
  const parsed = formSchema.safeParse(source);
  const fieldErrors = createEmptyConversationFieldErrors();

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];

      if (
        typeof field === "string" &&
        conversationFieldNames.includes(field as ConversationFieldName) &&
        !fieldErrors[field as ConversationFieldName]
      ) {
        fieldErrors[field as ConversationFieldName] = issue.message;
      }
    }

    return {
      ok: false,
      fieldErrors,
    };
  }

  const occurredAt = parseIstanbulDateTime(parsed.data.occurredAt);

  if (!occurredAt) {
    fieldErrors.occurredAt = "Geçerli bir görüşme tarihi ve saati seçin.";
  } else if (occurredAt.getTime() > now.getTime() + 5 * 60 * 1_000) {
    fieldErrors.occurredAt = "Görüşme zamanı gelecekte olamaz.";
  } else if (
    occurredAt.getTime() <
    now.getTime() - 366 * 24 * 60 * 60 * 1_000
  ) {
    fieldErrors.occurredAt =
      "Görüşme zamanı en fazla bir yıl geçmiş olabilir.";
  }

  const requiresFollowUp =
    rawString(formData, "requiresFollowUp") === "on";
  let followUpAt: Date | null = null;

  if (requiresFollowUp) {
    followUpAt = parseIstanbulDateTime(parsed.data.followUpAt);

    if (!followUpAt) {
      fieldErrors.followUpAt = "Geçerli bir takip tarihi ve saati seçin.";
    } else if (followUpAt.getTime() <= now.getTime()) {
      fieldErrors.followUpAt = "Takip zamanı gelecekte olmalıdır.";
    } else if (
      followUpAt.getTime() >
      now.getTime() + 366 * 24 * 60 * 60 * 1_000
    ) {
      fieldErrors.followUpAt = "Takip zamanı en fazla bir yıl sonrası olabilir.";
    } else if (occurredAt && followUpAt.getTime() <= occurredAt.getTime()) {
      fieldErrors.followUpAt =
        "Takip zamanı görüşme zamanından sonra olmalıdır.";
    }

    if (parsed.data.followUpPurpose.length < 3) {
      fieldErrors.followUpPurpose = "Takip amacı en az 3 karakter olmalıdır.";
    }
  }

  if (Object.values(fieldErrors).some(Boolean) || !occurredAt) {
    return {
      ok: false,
      fieldErrors,
    };
  }

  return {
    ok: true,
    data: {
      opportunityId: parsed.data.opportunityId,
      channel: parsed.data.channel,
      result: parsed.data.result,
      occurredAt: occurredAt.toISOString(),
      note: parsed.data.note || null,
      requiresFollowUp,
      followUpAt: requiresFollowUp ? followUpAt?.toISOString() ?? null : null,
      followUpPurpose: requiresFollowUp
        ? parsed.data.followUpPurpose
        : null,
    },
  };
}
