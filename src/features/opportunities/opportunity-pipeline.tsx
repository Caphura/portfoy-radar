import type { OpportunityPipelineResult } from "@/server/opportunities/pipeline-core";

type OpportunityPipelineProps = {
  result: OpportunityPipelineResult;
};

export function OpportunityPipeline({ result }: OpportunityPipelineProps) {
  if (!result.ok) {
    return (
      <section
        className="mt-4 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-5 text-amber-50"
        role="alert"
      >
        <h2 className="text-lg font-extrabold">Fırsat hunisi yüklenemedi</h2>
        <p className="mt-2 text-sm leading-6 text-amber-50/75">
          {result.error.message}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="opportunity-pipeline-title"
      className="mt-4 rounded-3xl border border-white/10 bg-white/[0.07] p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
            Fırsat akışı
          </p>
          <h2
            className="mt-2 text-lg font-extrabold"
            id="opportunity-pipeline-title"
          >
            Fırsat hunisi
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
            Her fırsat tek bir güncel aşamada bulunur; bütün geçişler geçmişte
            korunur.
          </p>
        </div>
        <span className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold">
          Toplam {result.data.total}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/[0.08] px-4 py-3">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
            Açık
          </dt>
          <dd className="mt-1 text-2xl font-black tabular-nums">
            {result.data.open}
          </dd>
        </div>
        <div className="rounded-2xl bg-white/[0.08] px-4 py-3">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
            Kapanmış
          </dt>
          <dd className="mt-1 text-2xl font-black tabular-nums">
            {result.data.closed}
          </dd>
        </div>
      </dl>

      <ol className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {result.data.stages.map((stage, index) => (
          <li
            className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
            key={stage.stage}
          >
            <div className="min-w-0">
              <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-white/40">
                Aşama {index + 1}
              </p>
              <p className="mt-1 break-words text-sm font-bold">{stage.label}</p>
            </div>
            <span
              aria-label={`${stage.label}: ${stage.count}`}
              className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-black tabular-nums ${
                stage.closed
                  ? "bg-amber-300/15 text-amber-100"
                  : "bg-emerald-300/15 text-emerald-100"
              }`}
            >
              {stage.count}
            </span>
          </li>
        ))}
      </ol>

      {result.data.total === 0 ? (
        <p className="mt-5 rounded-2xl bg-white/[0.08] px-4 py-3 text-sm leading-6 text-white/70">
          Henüz fırsat yok. İlk fırsat eklendiğinde aşama dağılımı burada
          görünecek.
        </p>
      ) : null}
    </section>
  );
}
