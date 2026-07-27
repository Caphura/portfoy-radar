import Link from "next/link";

import type { FieldObservationSummary } from "@/server/field-observations/contracts";

const formatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "short",
});

export function FieldObservationList({
  observations,
}: {
  observations: FieldObservationSummary[];
}) {
  return (
    <section className="mt-7" aria-labelledby="field-observation-list-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand)]">
            Son kayıtlar
          </p>
          <h2
            className="mt-1 text-2xl font-black tracking-[-0.04em]"
            id="field-observation-list-heading"
          >
            Saha gözlemleri
          </h2>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black">
          {observations.length}
        </span>
      </div>

      {observations.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-[var(--line)] bg-white/70 p-6 text-center">
          <p className="font-black">Henüz saha kaydı yok</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            İlk sentetik tabela fotoğrafınızı yukarıdaki akıştan ekleyin.
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {observations.map((observation) => (
            <li key={observation.id}>
              <Link
                className="flex min-h-20 items-center justify-between gap-4 rounded-3xl border border-[var(--line)] bg-white p-4 shadow-[0_8px_24px_rgba(18,37,29,0.05)]"
                href={`/workspace/ekle/saha/${observation.id}`}
              >
                <span>
                  <span className="block text-sm font-black">
                    {formatter.format(new Date(observation.observedAt))}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">
                    {observation.hasLocation
                      ? "Konum eklendi"
                      : "Konum eklenmedi"}
                    {" · "}
                    {observation.isLinked
                      ? "FSBO’ya dönüştürüldü"
                      : "Bağlantı bekliyor"}
                  </span>
                </span>
                <span aria-hidden="true" className="text-xl font-black">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
