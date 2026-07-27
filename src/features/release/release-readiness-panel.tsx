import type { ReleaseReadinessResult } from "@/server/release/get-release-readiness";

function StatusMark({ passed }: { passed: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-8 shrink-0 place-items-center rounded-xl text-sm font-black ${
        passed
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-900"
      }`}
    >
      {passed ? "✓" : "!"}
    </span>
  );
}

export function ReleaseReadinessPanel({
  result,
}: {
  result: ReleaseReadinessResult;
}) {
  if (!result.ok) {
    return (
      <section
        className="mt-8 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-amber-950 sm:p-6"
        role="alert"
      >
        <p className="text-xs font-extrabold uppercase tracking-[0.18em]">
          Güvenlik kapısı
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
          Release durumu doğrulanamadı
        </h2>
        <p className="mt-3 text-sm leading-6">{result.error.message}</p>
      </section>
    );
  }

  const ready = result.data.livePiiAllowed;

  return (
    <section
      aria-labelledby="release-readiness-heading"
      className="mt-8 overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white shadow-[0_16px_45px_rgba(18,37,29,0.08)]"
    >
      <div
        className={`p-5 text-white sm:p-6 ${
          ready ? "bg-emerald-800" : "bg-[var(--ink)]"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
              Owner görünümü · {result.data.version}
            </p>
            <h2
              className="mt-2 text-2xl font-black tracking-[-0.04em]"
              id="release-readiness-heading"
            >
              Güvenlik ve release kapısı
            </h2>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-black ${
              ready
                ? "bg-white/15 text-white"
                : "bg-amber-300 text-amber-950"
            }`}
          >
            {ready ? "Canlı PII onaylı" : "Canlı PII engelli"}
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
          {result.data.summary} Bu ekran anahtar, token, kişi veya kanıt içeriği
          göstermez.
        </p>
      </div>

      <div className="grid gap-7 p-5 sm:p-6 lg:grid-cols-2">
        <section aria-labelledby="technical-gates-heading">
          <h3
            className="text-lg font-black text-[var(--ink)]"
            id="technical-gates-heading"
          >
            Teknik kontroller
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Sunucu yapılandırması ve temiz veritabanı sözleşmesi.
          </p>
          <ul className="mt-3 grid gap-3">
            {result.data.technicalChecks.map((check) => (
              <li
                className="flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--canvas)]/55 p-4"
                key={check.id}
              >
                <StatusMark passed={check.status === "passed"} />
                <div>
                  <p className="text-sm font-black text-[var(--ink)]">
                    {check.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    {check.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="manual-gates-heading">
          <h3
            className="text-lg font-black text-[var(--ink)]"
            id="manual-gates-heading"
          >
            Üretim kanıtları
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Kod testiyle doğrulanamayan hukuki ve operasyonel kapılar.
          </p>
          <ul className="mt-3 grid gap-3">
            {result.data.manualGates.map((gate) => (
              <li
                className="flex gap-3 rounded-2xl border border-[var(--line)] p-4"
                key={gate.id}
              >
                <StatusMark passed={gate.status === "approved"} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-[var(--ink)]">
                      {gate.label}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-extrabold text-slate-700">
                      {gate.owner}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    {gate.closureCriteria}
                  </p>
                  <p className="mt-2 text-xs font-extrabold text-[var(--ink)]">
                    {gate.status === "approved"
                      ? `Kanıt: ${gate.evidenceReference}`
                      : "Kanıt bekleniyor"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="border-t border-[var(--line)] bg-amber-50 px-5 py-4 text-xs font-bold leading-5 text-amber-950 sm:px-6">
        Kapı açık görünmeden canlı kişisel veri yüklemeyin. Onaylar yalnız Git
        geçmişinde incelenebilir kanıt referansıyla değiştirilebilir.
      </p>
    </section>
  );
}
