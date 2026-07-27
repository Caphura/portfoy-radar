import {
  defaultIstanbulReportPeriod,
  formatIstanbulDateKey,
} from "@/shared/time/istanbul";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MINIMUM_REPORT_DATE = "2000-01-01";
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;

export type ReportPeriod = {
  startDate: string;
  endDate: string;
};

export type ReportSearchParams = {
  startDate?: string | string[];
  endDate?: string | string[];
};

export type ReportPeriodValidation =
  | {
      ok: true;
      data: ReportPeriod;
      corrected: boolean;
    }
  | {
      ok: false;
      values: ReportPeriod;
      fieldErrors: Partial<Record<keyof ReportPeriod, string>>;
      message: string;
    };

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseCalendarDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month! - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function validateReportPeriod(
  values: ReportPeriod,
  now = new Date(),
): ReportPeriodValidation {
  const fieldErrors: Partial<Record<keyof ReportPeriod, string>> = {};
  const start = parseCalendarDate(values.startDate);
  const end = parseCalendarDate(values.endDate);
  const today = formatIstanbulDateKey(now);

  if (!start) {
    fieldErrors.startDate = "Geçerli bir başlangıç tarihi seçin.";
  }

  if (!end) {
    fieldErrors.endDate = "Geçerli bir bitiş tarihi seçin.";
  }

  if (start && values.startDate < MINIMUM_REPORT_DATE) {
    fieldErrors.startDate = "Başlangıç tarihi 01.01.2000 veya sonrası olmalıdır.";
  }

  if (end && values.endDate > today) {
    fieldErrors.endDate = "Bitiş tarihi bugünden sonra olamaz.";
  }

  if (start && end && values.startDate > values.endDate) {
    fieldErrors.endDate = "Bitiş tarihi başlangıç tarihinden önce olamaz.";
  }

  if (
    start &&
    end &&
    values.startDate <= values.endDate &&
    (end.getTime() - start.getTime()) / DAY_IN_MILLISECONDS > 365
  ) {
    fieldErrors.endDate = "Rapor dönemi en fazla 366 gün olabilir.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      values,
      fieldErrors,
      message: "Rapor dönemini kontrol edip yeniden deneyin.",
    };
  }

  return { ok: true, data: values, corrected: false };
}

export function parseReportPeriod(
  searchParams: ReportSearchParams,
  now = new Date(),
): ReportPeriodValidation {
  const defaultPeriod = defaultIstanbulReportPeriod(now);
  const rawStartDate = firstValue(searchParams.startDate);
  const rawEndDate = firstValue(searchParams.endDate);

  if (rawStartDate === undefined && rawEndDate === undefined) {
    return {
      ok: true,
      data: defaultPeriod,
      corrected: true,
    };
  }

  return validateReportPeriod(
    {
      startDate: rawStartDate ?? "",
      endDate: rawEndDate ?? "",
    },
    now,
  );
}
