const ISTANBUL_TIME_ZONE = "Europe/Istanbul";
const ISTANBUL_OFFSET = "+03:00";
const localDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function parts(value: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ISTANBUL_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function formatIstanbulDateKey(value: Date): string {
  const formatted = parts(value);

  return `${formatted.year}-${formatted.month}-${formatted.day}`;
}

export function formatIstanbulLocalDateTime(value: Date): string {
  const formatted = parts(value);

  return `${formatted.year}-${formatted.month}-${formatted.day}T${formatted.hour}:${formatted.minute}`;
}

export function parseIstanbulLocalDateTime(
  value: string,
): { ok: true; iso: string } | { ok: false } {
  if (!localDateTimePattern.test(value)) {
    return { ok: false };
  }

  const parsed = new Date(`${value}:00${ISTANBUL_OFFSET}`);

  if (
    Number.isNaN(parsed.getTime()) ||
    formatIstanbulLocalDateTime(parsed) !== value
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    iso: parsed.toISOString(),
  };
}

export function defaultIstanbulTaskActionAt(
  now = new Date(),
): string {
  return formatIstanbulLocalDateTime(
    new Date(now.getTime() + 24 * 60 * 60 * 1_000),
  );
}

export function defaultIstanbulAppointmentTimes(
  now = new Date(),
): { startsAt: string; endsAt: string } {
  const startsAt = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1_000);

  return {
    startsAt: formatIstanbulLocalDateTime(startsAt),
    endsAt: formatIstanbulLocalDateTime(endsAt),
  };
}
