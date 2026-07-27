import Link from "next/link";

import type {
  CalendarItem,
  CalendarResult,
} from "@/server/calendar/calendar-core";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "short",
});

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  timeStyle: "short",
});

function CalendarCard({
  item,
  overdue,
}: {
  item: CalendarItem;
  overdue: boolean;
}) {
  const location =
    [item.property.neighborhood, item.property.district, item.property.city]
      .filter(Boolean)
      .join(" · ") || "Konum bilgisi girilmemiş";

  return (
    <article className="rounded-3xl border border-[var(--line)] bg-white p-4 shadow-[0_10px_30px_rgba(18,37,29,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand)]">
            {item.title}
          </p>
          <h3 className="mt-1 break-words text-lg font-black text-[var(--ink)]">
            {location}
          </h3>
        </div>
        {overdue ? (
          <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-extrabold text-red-800">
            Geçmiş
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <dt className="text-xs font-bold text-[var(--muted)]">Zaman</dt>
          <dd className="mt-1 font-extrabold text-[var(--ink)]">
            {dateFormatter.format(new Date(item.eventAt))}
          </dd>
          {item.endsAt ? (
            <dd className="mt-1 text-xs font-bold text-[var(--muted)]">
              Bitiş {timeFormatter.format(new Date(item.endsAt))}
            </dd>
          ) : null}
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <dt className="text-xs font-bold text-[var(--muted)]">Aşama</dt>
          <dd className="mt-1 font-extrabold text-[var(--ink)]">
            {item.stageLabel}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm text-[var(--muted)]">
        {item.property.typeLabel}
      </p>

      <Link
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-[var(--line)] px-4 text-sm font-extrabold text-[var(--brand)]"
        href={`/workspace/radar/${item.opportunityId}`}
      >
        Fırsatı aç
      </Link>
    </article>
  );
}

function CalendarSection({
  title,
  description,
  items,
  overdue = false,
}: {
  title: string;
  description: string;
  items: CalendarItem[];
  overdue?: boolean;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mt-6" aria-labelledby={`calendar-${title}`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2
            className="text-xl font-black text-[var(--ink)]"
            id={`calendar-${title}`}
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
        <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-extrabold text-[var(--brand)]">
          {items.length}
        </span>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <CalendarCard
            item={item}
            key={`${item.type}-${item.id}`}
            overdue={overdue}
          />
        ))}
      </div>
    </section>
  );
}

export function CalendarBoard({ result }: { result: CalendarResult }) {
  if (!result.ok) {
    return (
      <section
        className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        role="alert"
      >
        <h1 className="text-xl font-black">Takvim yüklenemedi</h1>
        <p className="mt-2 text-sm leading-6">{result.error.message}</p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-[2rem] bg-[var(--ink)] p-5 text-white shadow-[0_20px_60px_rgba(18,37,29,0.12)] sm:p-7">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
          Planlama
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">Takvim</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
          Randevular ve açık görevler Türkiye saatine göre tek listede
          gösterilir.
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-2">
          {[
            ["Geçmiş", result.data.overdue.length],
            ["Bugün", result.data.today.length],
            ["Yaklaşan", result.data.upcoming.length],
          ].map(([label, count]) => (
            <div
              className="rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-3 text-center"
              key={label}
            >
              <dt className="text-xs font-bold text-white/60">{label}</dt>
              <dd className="mt-1 text-2xl font-black tabular-nums">{count}</dd>
            </div>
          ))}
        </dl>
      </section>

      {result.data.total === 0 ? (
        <p className="mt-5 rounded-3xl border border-[var(--line)] bg-white px-5 py-8 text-center text-sm leading-6 text-[var(--muted)]">
          Takvimde henüz randevu veya açık görev yok. Bir fırsatın detayından
          randevu oluşturabilirsiniz.
        </p>
      ) : (
        <>
          <CalendarSection
            description="Planlanan zamanı geçmiş açık kayıtlar."
            items={result.data.overdue}
            overdue
            title="Geçmiş"
          />
          <CalendarSection
            description="Bugün planlanan randevu ve görevler."
            items={result.data.today}
            title="Bugün"
          />
          <CalendarSection
            description="Bugünden sonraki randevu ve görevler."
            items={result.data.upcoming}
            title="Yaklaşan"
          />
        </>
      )}

      {result.data.truncated ? (
        <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          İlk 100 kayıt gösteriliyor. Daha eski görevleri tamamlayarak takvimi
          daraltın.
        </p>
      ) : null}
    </>
  );
}
