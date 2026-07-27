import type {
  MarketAnalysis,
  MarketAnalysisResult,
} from "@/server/market-analysis/market-analysis-core";

import { ComparableForm } from "./comparable-form";
import { MarketAnalysisRequestForm } from "./market-analysis-request-form";

type MarketAnalysisPanelProps = {
  result: MarketAnalysisResult;
  canManage: boolean;
  opportunityId: string;
  defaultTransactionType: "sale" | "rent";
  defaultCurrency: string;
  defaultTargetAt: string;
  defaultObservedOn: string;
  unavailable: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "short",
});
const dayFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
});

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString("tr-TR")} ${currency}`;
  }
}

function formatPerSqm(value: number | null, currency: string) {
  return value === null
    ? "—"
    : `${formatMoney(value, currency)} / m²`;
}

function AnalysisSummary({ analysis }: { analysis: MarketAnalysis }) {
  const transaction =
    analysis.transactionType === "sale" ? "Satılık" : "Kiralık";

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["İşlem", `${transaction} · ${analysis.currency}`],
          ["Konu alanı", `${analysis.subjectAreaSqm.toLocaleString("tr-TR")} m²`],
          ["Emsal", analysis.comparableCount.toLocaleString("tr-TR")],
          ["Hedef", dateFormatter.format(new Date(analysis.targetAt))],
        ].map(([label, value]) => (
          <div className="rounded-2xl bg-slate-50 px-3 py-3" key={label}>
            <dt className="text-xs font-bold text-[var(--muted)]">{label}</dt>
            <dd className="mt-1 break-words text-sm font-black text-[var(--ink)]">
              {value}
            </dd>
          </div>
        ))}
      </div>

      {analysis.comparableCount === 0 ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          Henüz emsal eklenmedi. İlk manuel emsalden sonra m² istatistikleri
          ve fiyat aralığı hesaplanır.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <section className="rounded-2xl border border-[var(--line)] p-4">
            <h3 className="text-sm font-black text-[var(--ink)]">
              {analysis.currency}/m² özeti
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["Minimum", analysis.minPricePerSqm],
                ["Medyan", analysis.medianPricePerSqm],
                ["Maksimum", analysis.maxPricePerSqm],
              ].map(([label, value]) => (
                <div
                  className="flex items-center justify-between gap-3"
                  key={label}
                >
                  <dt className="text-[var(--muted)]">{label}</dt>
                  <dd className="text-right font-extrabold text-[var(--ink)]">
                    {formatPerSqm(value as number | null, analysis.currency)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-2xl bg-[var(--brand-soft)] p-4">
            <h3 className="text-sm font-black text-[var(--brand)]">
              Önerilen fiyat aralığı
            </h3>
            <p className="mt-3 text-xl font-black tracking-[-0.03em] text-[var(--ink)]">
              {formatMoney(analysis.suggestedPriceLow!, analysis.currency)}
              <span className="mx-2 text-[var(--muted)]">–</span>
              {formatMoney(analysis.suggestedPriceHigh!, analysis.currency)}
            </p>
            <p className="mt-2 text-xs font-bold text-[var(--muted)]">
              Medyan TRY/m² × {analysis.subjectAreaSqm.toLocaleString("tr-TR")}{" "}
              m²; temel tahmin{" "}
              {formatMoney(analysis.baseEstimate!, analysis.currency)} ve ±%5
              bant.
            </p>
          </section>
        </div>
      )}
    </>
  );
}

export function MarketAnalysisPanel({
  result,
  canManage,
  opportunityId,
  defaultTransactionType,
  defaultCurrency,
  defaultTargetAt,
  defaultObservedOn,
  unavailable,
}: MarketAnalysisPanelProps) {
  if (!result.ok) {
    return (
      <section
        className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        role="alert"
      >
        <h2 className="text-lg font-black">Pazar analizi yüklenemedi</h2>
        <p className="mt-2 text-sm leading-6">{result.error.message}</p>
      </section>
    );
  }

  const analysis = result.data;

  return (
    <section
      aria-labelledby="market-analysis-title"
      className="mt-5 rounded-[2rem] border border-[var(--line)] bg-white p-5 sm:p-6"
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--brand)]">
        Manuel karşılaştırma
      </p>
      <h2
        className="mt-1 text-xl font-black text-[var(--ink)]"
        id="market-analysis-title"
      >
        Pazar analizi ve emsaller
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Emsaller yalnızca kullanıcı tarafından girilir. Portal taraması,
        otomatik telefon toplama veya harici mesaj gönderimi yapılmaz.
      </p>

      {!analysis ? (
        canManage ? (
          <MarketAnalysisRequestForm
            defaultCurrency={defaultCurrency}
            defaultTargetAt={defaultTargetAt}
            defaultTransactionType={defaultTransactionType}
            opportunityId={opportunityId}
            unavailable={unavailable}
          />
        ) : (
          <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
            Henüz pazar analizi yok. Analiz başlatmak için sahip veya danışman
            rolü gerekir.
          </p>
        )
      ) : (
        <>
          <AnalysisSummary analysis={analysis} />

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section>
              <h3 className="text-base font-black text-[var(--ink)]">
                Manuel emsaller
              </h3>
              {analysis.comparables.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  Emsal listesi boş.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {analysis.comparables.map((comparable) => (
                    <li
                      className="rounded-2xl border border-[var(--line)] p-4"
                      key={comparable.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-[var(--ink)]">
                            {comparable.neighborhood}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                            {comparable.areaSqm.toLocaleString("tr-TR")} m² ·{" "}
                            {dayFormatter.format(
                              new Date(
                                `${comparable.observedOn}T00:00:00+03:00`,
                              ),
                            )}
                          </p>
                        </div>
                        <p className="text-right text-sm font-black text-[var(--ink)]">
                          {formatMoney(
                            comparable.askingPrice,
                            analysis.currency,
                          )}
                        </p>
                      </div>
                      <p className="mt-3 text-sm font-extrabold text-[var(--brand)]">
                        {formatPerSqm(
                          comparable.pricePerSqm,
                          analysis.currency,
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {analysis.comparablesTruncated ? (
                <p className="mt-3 text-xs font-bold text-amber-800">
                  En yeni 50 emsal gösteriliyor.
                </p>
              ) : null}
            </section>

            <section>
              <h3 className="text-base font-black text-[var(--ink)]">
                Emsal ekle
              </h3>
              {canManage && analysis.status === "draft" && !unavailable ? (
                <ComparableForm
                  currency={analysis.currency}
                  defaultObservedOn={defaultObservedOn}
                  marketAnalysisId={analysis.id}
                  opportunityId={opportunityId}
                />
              ) : (
                <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                  {unavailable
                    ? "Kapanmış veya iletişim engelli fırsatın analizine emsal eklenemez."
                    : "Emsal eklemek için sahip veya danışman rolü ve taslak analiz gerekir."}
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
