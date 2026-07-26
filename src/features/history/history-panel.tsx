import type {
  ActivityHistoryItem,
  AuditHistoryItem,
  WorkspaceHistoryResult,
} from "@/server/history/history-core";

type HistoryPanelProps = {
  result: WorkspaceHistoryResult;
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

function HistoryTime({ value }: { value: string }) {
  return (
    <time className="text-xs font-medium text-white/45" dateTime={value}>
      {dateFormatter.format(new Date(value))}
    </time>
  );
}

function ActivityItem({ item }: { item: ActivityHistoryItem }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-extrabold text-white">
            {item.title}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-200/70">
            {item.entityLabel}
          </p>
        </div>
        <HistoryTime value={item.occurredAt} />
      </div>
      {item.detail ? (
        <p className="mt-3 text-sm leading-6 text-white/65">{item.detail}</p>
      ) : null}
    </li>
  );
}

function AuditItem({ item }: { item: AuditHistoryItem }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-extrabold text-white">
            {item.title}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-amber-200/70">
            {item.entityLabel}
          </p>
        </div>
        <HistoryTime value={item.occurredAt} />
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-xl bg-black/10 px-3 py-2">
          <dt className="text-white/45">Aktör</dt>
          <dd className="mt-1 font-bold text-white/75">
            {item.actorReference}
          </dd>
        </div>
        <div className="rounded-xl bg-black/10 px-3 py-2">
          <dt className="text-white/45">İstek izi</dt>
          <dd className="mt-1 font-bold text-white/75">
            {item.requestReference}
          </dd>
        </div>
      </dl>
    </li>
  );
}

export function HistoryPanel({ result }: HistoryPanelProps) {
  if (!result.ok) {
    return (
      <section
        className="mt-4 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-5 text-amber-50"
        role="alert"
      >
        <h2 className="text-lg font-extrabold">Geçmiş yüklenemedi</h2>
        <p className="mt-2 text-sm leading-6 text-amber-50/75">
          {result.error.message}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="history-title"
      className="mt-4 rounded-3xl border border-white/10 bg-white/[0.07] p-5"
    >
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
          Değiştirilemez kayıtlar
        </p>
        <h2 className="mt-2 text-lg font-extrabold" id="history-title">
          Geçmiş ve audit
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
          İş zaman çizelgesi ile güvenlik günlüğü birbirinden ayrı tutulur.
        </p>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-extrabold text-white">Son işlemler</h3>
        {result.data.activity.length > 0 ? (
          <ol className="mt-3 grid grid-cols-1 gap-2">
            {result.data.activity.map((item) => (
              <ActivityItem item={item} key={item.id} />
            ))}
          </ol>
        ) : (
          <p className="mt-3 rounded-2xl bg-white/[0.08] px-4 py-3 text-sm leading-6 text-white/70">
            Henüz geçmiş kaydı yok. Kritik bir işlem yapıldığında burada
            görünecek.
          </p>
        )}
      </div>

      {result.data.audit.visible ? (
        <div className="mt-6 border-t border-white/10 pt-5">
          <h3 className="text-sm font-extrabold text-white">Audit günlüğü</h3>
          <p className="mt-1 text-xs leading-5 text-white/50">
            Yalnızca çalışma alanı sahibi görebilir.
          </p>
          {result.data.audit.items.length > 0 ? (
            <ol className="mt-3 grid grid-cols-1 gap-2">
              {result.data.audit.items.map((item) => (
                <AuditItem item={item} key={item.id} />
              ))}
            </ol>
          ) : (
            <p className="mt-3 rounded-2xl bg-white/[0.08] px-4 py-3 text-sm leading-6 text-white/70">
              Henüz audit kaydı yok.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-white/[0.08] px-4 py-3 text-sm leading-6 text-white/70">
          Audit günlüğünü yalnızca çalışma alanı sahibi görüntüleyebilir.
        </p>
      )}
    </section>
  );
}
