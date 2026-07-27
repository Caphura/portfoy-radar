import type { ReportPeriod } from "@/features/reports/report-period";
import type { PerformanceReportResult } from "@/server/reports/performance-report-core";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00+03:00`));
}

function ProgressRow({
  label,
  count,
  rate,
}: {
  label: string;
  count: number;
  rate: number;
}) {
  return (
    <li className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-extrabold text-[var(--ink)]">
          {label}
        </span>
        <span className="shrink-0 text-sm font-black tabular-nums text-[var(--ink)]">
          {count} <span className="text-xs text-[var(--muted)]">%{rate}</span>
        </span>
      </div>
      <div
        aria-label={`${label}: ${count}, yüzde ${rate}`}
        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
        role="img"
      >
        <div
          className="h-full rounded-full bg-[var(--brand)]"
          style={{ width: `${Math.max(0, Math.min(100, rate))}%` }}
        />
      </div>
    </li>
  );
}

function PeriodFilter({
  period,
  today,
  fieldErrors,
}: {
  period: ReportPeriod;
  today: string;
  fieldErrors?: Partial<Record<keyof ReportPeriod, string>> | undefined;
}) {
  return (
    <form
      className="mt-5 rounded-3xl border border-[var(--line)] bg-white p-4 shadow-[0_10px_30px_rgba(18,37,29,0.05)] sm:p-5"
      method="get"
    >
      <fieldset>
        <legend className="text-base font-black text-[var(--ink)]">
          Rapor dönemi
        </legend>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          En fazla 366 gün seçebilirsiniz. Gün sınırları Türkiye saatine göre
          hesaplanır.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-sm font-extrabold text-[var(--ink)]">
            Başlangıç
            <input
              aria-describedby={
                fieldErrors?.startDate ? "report-start-error" : undefined
              }
              aria-invalid={Boolean(fieldErrors?.startDate)}
              className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-3 text-base outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              defaultValue={period.startDate}
              max={today}
              min="2000-01-01"
              name="startDate"
              required
              type="date"
            />
            {fieldErrors?.startDate ? (
              <span
                className="mt-2 block text-xs font-bold text-red-700"
                id="report-start-error"
              >
                {fieldErrors.startDate}
              </span>
            ) : null}
          </label>
          <label className="block text-sm font-extrabold text-[var(--ink)]">
            Bitiş
            <input
              aria-describedby={
                fieldErrors?.endDate ? "report-end-error" : undefined
              }
              aria-invalid={Boolean(fieldErrors?.endDate)}
              className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-3 text-base outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              defaultValue={period.endDate}
              max={today}
              min="2000-01-01"
              name="endDate"
              required
              type="date"
            />
            {fieldErrors?.endDate ? (
              <span
                className="mt-2 block text-xs font-bold text-red-700"
                id="report-end-error"
              >
                {fieldErrors.endDate}
              </span>
            ) : null}
          </label>
          <button
            className="min-h-12 w-full rounded-2xl bg-[var(--brand)] px-5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 sm:w-auto"
            type="submit"
          >
            Raporu getir
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export function PerformanceReportDashboard({
  result,
  period,
  today,
  fieldErrors,
}: {
  result: PerformanceReportResult;
  period: ReportPeriod;
  today: string;
  fieldErrors?: Partial<Record<keyof ReportPeriod, string>> | undefined;
}) {
  return (
    <>
      <section className="rounded-[2rem] bg-[var(--ink)] p-5 text-white shadow-[0_20px_60px_rgba(18,37,29,0.12)] sm:p-7">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
          Performans
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">
          Huni ve raporlar
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
          Yeni fırsat kohortunun aşama ilerleyişini, görüşmeleri ve randevuları
          kişisel veri göstermeden izleyin.
        </p>
      </section>

      <PeriodFilter
        fieldErrors={fieldErrors}
        period={period}
        today={today}
      />

      {!result.ok ? (
        <section
          className={`mt-5 rounded-3xl border p-5 ${
            result.error.code === "FORBIDDEN"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
          role="alert"
        >
          <h2 className="text-lg font-black">
            {result.error.code === "INVALID_PERIOD"
              ? "Rapor dönemi geçersiz"
              : result.error.code === "FORBIDDEN"
                ? "Rapor erişiminiz bulunmuyor"
                : "Rapor yüklenemedi"}
          </h2>
          <p className="mt-2 text-sm leading-6">{result.error.message}</p>
        </section>
      ) : (
        <>
          <section className="mt-5" aria-labelledby="report-summary-heading">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2
                  className="text-xl font-black text-[var(--ink)]"
                  id="report-summary-heading"
                >
                  Dönem özeti
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {formatDate(result.data.period.startDate)} –{" "}
                  {formatDate(result.data.period.endDate)}
                </p>
              </div>
              <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-extrabold text-[var(--brand)]">
                Europe/Istanbul
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ["Yeni fırsat", result.data.summary.newOpportunities],
                [
                  "Portföye dönüşen",
                  result.data.summary.convertedOpportunities,
                ],
                [
                  "Dönüşüm",
                  `%${result.data.summary.conversionRate.toLocaleString("tr-TR")}`,
                ],
                ["Görüşme", result.data.summary.totalConversations],
                ["Randevu", result.data.summary.totalAppointments],
              ].map(([label, value]) => (
                <div
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(18,37,29,0.04)]"
                  key={label}
                >
                  <dt className="text-xs font-bold text-[var(--muted)]">
                    {label}
                  </dt>
                  <dd className="mt-1 text-2xl font-black tabular-nums text-[var(--ink)]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {result.data.empty ? (
            <p className="mt-5 rounded-3xl border border-[var(--line)] bg-white px-5 py-8 text-center text-sm leading-6 text-[var(--muted)]">
              Seçilen dönemde yeni fırsat, görüşme veya randevu bulunmuyor.
              Tarih aralığını değiştirerek yeniden deneyebilirsiniz.
            </p>
          ) : null}

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section aria-labelledby="funnel-heading">
              <h2
                className="text-xl font-black text-[var(--ink)]"
                id="funnel-heading"
              >
                Fırsat hunisi
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Dönemde oluşturulan fırsatlardan her aşamaya en az bir kez
                ulaşanlar. Yüzde, yeni fırsat kohortuna göredir.
              </p>
              <ol className="mt-3 grid gap-2">
                {result.data.funnel.map((item) => (
                  <ProgressRow
                    count={item.count}
                    key={item.stage}
                    label={item.label}
                    rate={item.cohortRate}
                  />
                ))}
              </ol>
            </section>

            <div className="grid content-start gap-6">
              <section aria-labelledby="conversation-report-heading">
                <h2
                  className="text-xl font-black text-[var(--ink)]"
                  id="conversation-report-heading"
                >
                  Görüşme sonuçları
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  Görüşmenin gerçekleştiği zamana göre dağılım.
                </p>
                <ul className="mt-3 grid gap-2">
                  {result.data.conversationResults.map((item) => (
                    <ProgressRow
                      count={item.count}
                      key={item.result}
                      label={item.label}
                      rate={item.share}
                    />
                  ))}
                </ul>
              </section>

              <section aria-labelledby="appointment-report-heading">
                <h2
                  className="text-xl font-black text-[var(--ink)]"
                  id="appointment-report-heading"
                >
                  Randevu durumları
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  Başlangıç zamanı döneme düşen randevuların güncel durumu.
                </p>
                <ul className="mt-3 grid gap-2">
                  {result.data.appointmentStatuses.map((item) => (
                    <ProgressRow
                      count={item.count}
                      key={item.status}
                      label={item.label}
                      rate={item.share}
                    />
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}
