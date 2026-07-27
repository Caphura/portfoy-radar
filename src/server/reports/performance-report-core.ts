import { z } from "zod";

import {
  conversationResultLabels,
  conversationResultValues,
} from "@/features/conversations/conversation-options";
import {
  opportunityStageLabels,
  opportunityStageValues,
} from "@/features/opportunities/stages";
import {
  appointmentStatusLabels,
  appointmentStatusValues,
} from "@/features/reports/report-options";
import type { ReportPeriod } from "@/features/reports/report-period";

const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const funnelItemSchema = z
  .object({
    stage: z.enum(opportunityStageValues),
    count: countSchema,
  })
  .strict();

const conversationResultItemSchema = z
  .object({
    result: z.enum(conversationResultValues),
    count: countSchema,
  })
  .strict();

const appointmentStatusItemSchema = z
  .object({
    status: z.enum(appointmentStatusValues),
    count: countSchema,
  })
  .strict();

const reportRowSchema = z
  .object({
    report_version: z.literal("performance-v1"),
    period_start_date: z.iso.date(),
    period_end_date: z.iso.date(),
    period_start_at: z.iso.datetime({ offset: true }),
    period_end_at: z.iso.datetime({ offset: true }),
    new_opportunities: countSchema,
    converted_opportunities: countSchema,
    conversion_rate: z.number().min(0).max(100),
    total_conversations: countSchema,
    total_appointments: countSchema,
    funnel: z.array(funnelItemSchema).length(opportunityStageValues.length),
    conversation_results: z
      .array(conversationResultItemSchema)
      .length(conversationResultValues.length),
    appointment_statuses: z
      .array(appointmentStatusItemSchema)
      .length(appointmentStatusValues.length),
  })
  .strict();

type PerformanceReportQueryResult = {
  data: unknown;
  error: unknown;
};

export type PerformanceReport = {
  version: "performance-v1";
  period: ReportPeriod;
  summary: {
    newOpportunities: number;
    convertedOpportunities: number;
    conversionRate: number;
    totalConversations: number;
    totalAppointments: number;
  };
  funnel: Array<{
    stage: (typeof opportunityStageValues)[number];
    label: string;
    count: number;
    cohortRate: number;
  }>;
  conversationResults: Array<{
    result: (typeof conversationResultValues)[number];
    label: string;
    count: number;
    share: number;
  }>;
  appointmentStatuses: Array<{
    status: (typeof appointmentStatusValues)[number];
    label: string;
    count: number;
    share: number;
  }>;
  empty: boolean;
};

export type PerformanceReportResult =
  | { ok: true; data: PerformanceReport }
  | {
      ok: false;
      error: {
        code: "REPORT_UNAVAILABLE" | "FORBIDDEN" | "INVALID_PERIOD";
        message: string;
      };
    };

function unavailableResult(): PerformanceReportResult {
  return {
    ok: false,
    error: {
      code: "REPORT_UNAVAILABLE",
      message: "Rapor şu anda yüklenemiyor. Lütfen yeniden deneyin.",
    },
  };
}

function percentage(numerator: number, denominator: number) {
  return denominator === 0
    ? 0
    : Number(((numerator * 100) / denominator).toFixed(2));
}

function addOneDay(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function matchesExpectedPeriod(
  row: z.infer<typeof reportRowSchema>,
  period: ReportPeriod,
) {
  const expectedStart = new Date(
    `${period.startDate}T00:00:00+03:00`,
  ).getTime();
  const expectedEnd = new Date(
    `${addOneDay(period.endDate)}T00:00:00+03:00`,
  ).getTime();

  return (
    row.period_start_date === period.startDate &&
    row.period_end_date === period.endDate &&
    new Date(row.period_start_at).getTime() === expectedStart &&
    new Date(row.period_end_at).getTime() === expectedEnd
  );
}

function hasExpectedOrder<T extends string>(
  actual: readonly T[],
  expected: readonly T[],
) {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

export async function resolvePerformanceReport(
  query: () => Promise<PerformanceReportQueryResult>,
  period: ReportPeriod,
): Promise<PerformanceReportResult> {
  let result: PerformanceReportQueryResult;

  try {
    result = await query();
  } catch {
    return unavailableResult();
  }

  if (result.error) {
    const forbidden =
      typeof result.error === "object" &&
      result.error !== null &&
      "code" in result.error &&
      result.error.code === "42501";

    return forbidden
      ? {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Raporları görüntülemek için yetkiniz bulunmuyor.",
          },
        }
      : unavailableResult();
  }

  const parsed = z.array(reportRowSchema).length(1).safeParse(result.data);

  if (!parsed.success) {
    return unavailableResult();
  }

  const row = parsed.data[0]!;
  const funnelStages = row.funnel.map((item) => item.stage);
  const resultValues = row.conversation_results.map((item) => item.result);
  const statusValues = row.appointment_statuses.map((item) => item.status);
  const funnelNew = row.funnel.find((item) => item.stage === "new")?.count;
  const funnelConverted = row.funnel.find(
    (item) => item.stage === "converted",
  )?.count;
  const conversationTotal = row.conversation_results.reduce(
    (total, item) => total + item.count,
    0,
  );
  const appointmentTotal = row.appointment_statuses.reduce(
    (total, item) => total + item.count,
    0,
  );
  const expectedConversionRate = percentage(
    row.converted_opportunities,
    row.new_opportunities,
  );

  if (
    !matchesExpectedPeriod(row, period) ||
    !hasExpectedOrder(funnelStages, opportunityStageValues) ||
    !hasExpectedOrder(resultValues, conversationResultValues) ||
    !hasExpectedOrder(statusValues, appointmentStatusValues) ||
    funnelNew !== row.new_opportunities ||
    funnelConverted !== row.converted_opportunities ||
    conversationTotal !== row.total_conversations ||
    appointmentTotal !== row.total_appointments ||
    row.converted_opportunities > row.new_opportunities ||
    row.conversion_rate !== expectedConversionRate
  ) {
    return unavailableResult();
  }

  return {
    ok: true,
    data: {
      version: row.report_version,
      period,
      summary: {
        newOpportunities: row.new_opportunities,
        convertedOpportunities: row.converted_opportunities,
        conversionRate: row.conversion_rate,
        totalConversations: row.total_conversations,
        totalAppointments: row.total_appointments,
      },
      funnel: row.funnel.map((item) => ({
        stage: item.stage,
        label: opportunityStageLabels[item.stage],
        count: item.count,
        cohortRate: percentage(item.count, row.new_opportunities),
      })),
      conversationResults: row.conversation_results.map((item) => ({
        result: item.result,
        label: conversationResultLabels[item.result],
        count: item.count,
        share: percentage(item.count, row.total_conversations),
      })),
      appointmentStatuses: row.appointment_statuses.map((item) => ({
        status: item.status,
        label: appointmentStatusLabels[item.status],
        count: item.count,
        share: percentage(item.count, row.total_appointments),
      })),
      empty:
        row.new_opportunities === 0 &&
        row.total_conversations === 0 &&
        row.total_appointments === 0,
    },
  };
}
