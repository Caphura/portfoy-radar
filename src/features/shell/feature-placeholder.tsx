type FeaturePlaceholderProps = {
  description: string;
  eyebrow: string;
  title: string;
};

export function FeaturePlaceholder({
  description,
  eyebrow,
  title,
}: FeaturePlaceholderProps) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_20px_60px_rgba(18,37,29,0.08)] backdrop-blur sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--ink)] sm:text-4xl">
              {title}
            </h1>
          </div>
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-800">
            Hazırlanıyor
          </span>
        </div>

        <div className="mt-8 rounded-3xl border border-dashed border-[var(--line)] bg-[var(--canvas)] px-5 py-10 text-center sm:px-8">
          <span
            aria-hidden="true"
            className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--brand-soft)] text-2xl font-black text-[var(--brand)]"
          >
            ···
          </span>
          <h2 className="mt-5 text-lg font-extrabold text-[var(--ink)]">
            Bu bölüm henüz kullanıma açık değil
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">
            {description}
          </p>
        </div>
      </section>
    </div>
  );
}
