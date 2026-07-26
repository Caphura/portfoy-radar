import Link from "next/link";

import {
  opportunityStageLabels,
  opportunityStageValues,
} from "@/features/opportunities/stages";
import {
  propertyTypeOptions,
  transactionTypeOptions,
} from "@/features/fsbo/quick-fsbo-options";
import type { RadarResult, RadarOpportunity } from "@/server/radar/radar-core";

import {
  hasActiveRadarFilters,
  radarFiltersToQuery,
  type RadarFilters,
} from "./filters";

type RadarBoardProps = {
  correctedFilters: boolean;
  filters: RadarFilters;
  result: RadarResult;
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "short",
});

const stageStyles: Record<RadarOpportunity["stage"], string> = {
  new: "bg-sky-50 text-sky-800 ring-sky-200",
  verifying: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  ready_to_call: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  contacted: "bg-teal-50 text-teal-800 ring-teal-200",
  follow_up: "bg-amber-50 text-amber-900 ring-amber-200",
  analysis_preparing: "bg-violet-50 text-violet-800 ring-violet-200",
  appointment: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200",
  authorization_pending: "bg-orange-50 text-orange-900 ring-orange-200",
  converted: "bg-green-50 text-green-800 ring-green-200",
  lost: "bg-slate-100 text-slate-700 ring-slate-200",
  do_not_call: "bg-red-50 text-red-800 ring-red-200",
};

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatPrice(opportunity: RadarOpportunity) {
  if (!opportunity.listing) {
    return "Fiyat bilgisi yok";
  }

  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: opportunity.listing.currency,
      maximumFractionDigits: 0,
    }).format(opportunity.listing.askingPrice);
  } catch {
    return `${opportunity.listing.askingPrice.toLocaleString("tr-TR")} ${opportunity.listing.currency}`;
  }
}

function formatLocation(opportunity: RadarOpportunity) {
  return [
    opportunity.property.neighborhood,
    opportunity.property.district,
    opportunity.property.city,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatPropertyDetail(opportunity: RadarOpportunity) {
  const rooms =
    opportunity.property.roomCount !== null &&
    opportunity.property.livingRoomCount !== null
      ? `${opportunity.property.roomCount}+${opportunity.property.livingRoomCount}`
      : null;
  const area =
    opportunity.property.netAreaSqm ?? opportunity.property.grossAreaSqm;

  return [
    opportunity.property.typeLabel,
    rooms,
    area ? `${area.toLocaleString("tr-TR")} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatSource(opportunity: RadarOpportunity) {
  if (!opportunity.listing) {
    return "Kaynak ilan yok";
  }

  const transaction =
    opportunity.listing.transactionType === "sale" ? "Satılık" : "Kiralık";

  return `${transaction} · ${opportunity.listing.platform} · #${opportunity.listing.externalListingId}`;
}

function NextAction({ opportunity }: { opportunity: RadarOpportunity }) {
  if (opportunity.nextAction) {
    return (
      <div>
        <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
          Sonraki işlem
        </dt>
        <dd className="mt-1 text-sm font-black text-[var(--ink)]">
          {opportunity.nextAction.label}
        </dd>
        <dd className="mt-1 text-xs font-semibold text-[var(--muted)]">
          {formatDate(opportunity.nextAction.at)}
        </dd>
      </div>
    );
  }

  return (
    <div>
      <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Kapanış
      </dt>
      <dd className="mt-1 text-sm font-black text-[var(--ink)]">
        {opportunity.closedAt
          ? formatDate(opportunity.closedAt)
          : "Kapanış zamanı yok"}
      </dd>
    </div>
  );
}

function StageBadge({ opportunity }: { opportunity: RadarOpportunity }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-extrabold ring-1 ring-inset ${stageStyles[opportunity.stage]}`}
    >
      {opportunity.stageLabel}
    </span>
  );
}

function RadarCard({ opportunity }: { opportunity: RadarOpportunity }) {
  return (
    <li className="rounded-3xl border border-[var(--line)] bg-white p-4 shadow-[0_10px_30px_rgba(18,37,29,0.06)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            {formatSource(opportunity)}
          </p>
          <h2 className="mt-2 break-words text-lg font-black tracking-[-0.025em] text-[var(--ink)]">
            {formatLocation(opportunity) || "Konum bilgisi yok"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
            {formatPropertyDetail(opportunity)}
          </p>
        </div>
        <StageBadge opportunity={opportunity} />
      </div>

      <p className="mt-5 text-2xl font-black tracking-[-0.035em] text-[var(--ink)]">
        {formatPrice(opportunity)}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-[var(--canvas)] p-4">
        <NextAction opportunity={opportunity} />
        <div>
          <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
            Son güncelleme
          </dt>
          <dd className="mt-1 text-sm font-black text-[var(--ink)]">
            {formatDate(opportunity.updatedAt)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs font-semibold leading-5 text-[var(--muted)]">
        Kişi ve telefon bilgileri Radar listesine dahil edilmez.
      </p>
    </li>
  );
}

function RadarListRow({ opportunity }: { opportunity: RadarOpportunity }) {
  return (
    <li className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(18,37,29,0.04)]">
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1.5fr)_minmax(9rem,0.8fr)_minmax(10rem,0.9fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
            {formatSource(opportunity)}
          </p>
          <h2 className="mt-1 truncate text-base font-black text-[var(--ink)]">
            {formatLocation(opportunity) || "Konum bilgisi yok"}
          </h2>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            {formatPropertyDetail(opportunity)}
          </p>
        </div>
        <p className="text-base font-black text-[var(--ink)]">
          {formatPrice(opportunity)}
        </p>
        <dl>
          <NextAction opportunity={opportunity} />
        </dl>
        <StageBadge opportunity={opportunity} />
      </div>
    </li>
  );
}

function RadarFiltersForm({ filters }: { filters: RadarFilters }) {
  const selectClassName =
    "mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-3 text-sm font-bold text-[var(--ink)] outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-emerald-900/5";

  return (
    <form
      aria-label="Radar filtreleri"
      className="mt-5 rounded-3xl border border-[var(--line)] bg-white p-4 sm:p-5"
      method="get"
    >
      <input name="view" type="hidden" value={filters.view} />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-extrabold text-[var(--ink)]">
          Aşama
          <select
            className={selectClassName}
            defaultValue={filters.stage}
            name="stage"
          >
            <option value="all">Tüm aşamalar</option>
            {opportunityStageValues.map((stage) => (
              <option key={stage} value={stage}>
                {opportunityStageLabels[stage]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-extrabold text-[var(--ink)]">
          İşlem türü
          <select
            className={selectClassName}
            defaultValue={filters.transaction}
            name="transaction"
          >
            <option value="all">Satılık ve kiralık</option>
            {transactionTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-extrabold text-[var(--ink)]">
          Gayrimenkul
          <select
            className={selectClassName}
            defaultValue={filters.propertyType}
            name="propertyType"
          >
            <option value="all">Tüm gayrimenkuller</option>
            {propertyTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-4 text-sm font-extrabold text-[var(--ink)]"
          href={radarFiltersToQuery({ ...filters, stage: "all", transaction: "all", propertyType: "all" })}
        >
          Filtreleri temizle
        </Link>
        <button
          className="min-h-11 rounded-2xl bg-[var(--brand)] px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(24,93,69,0.18)]"
          type="submit"
        >
          Sonuçları göster
        </button>
      </div>
    </form>
  );
}

export function RadarBoard({
  correctedFilters,
  filters,
  result,
}: RadarBoardProps) {
  if (!result.ok) {
    return (
      <section
        className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        role="alert"
      >
        <h2 className="text-lg font-black">Radar yüklenemedi</h2>
        <p className="mt-2 text-sm leading-6">{result.error.message}</p>
      </section>
    );
  }

  const hasFilters = hasActiveRadarFilters(filters);

  return (
    <>
      {correctedFilters ? (
        <p
          className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"
          role="status"
        >
          Geçersiz filtre değeri yok sayıldı; güvenli varsayılan kullanıldı.
        </p>
      ) : null}

      <section className="rounded-[2rem] bg-[var(--ink)] p-5 text-white shadow-[0_20px_60px_rgba(18,37,29,0.12)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
              Fırsat keşfi
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
              Radar
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
              Fırsatları güvenli gayrimenkul ve ilan bilgileriyle izleyin.
              Öncelik puanı ve günlük arama sırası bu görünümün kapsamı dışındadır.
            </p>
          </div>
          <span className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-extrabold">
            {result.data.opportunities.length} sonuç
          </span>
        </div>
      </section>

      <RadarFiltersForm filters={filters} />

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[var(--muted)]">
          Sonraki işlem zamanına göre sıralı
        </p>
        <nav
          aria-label="Radar görünümü"
          className="inline-flex rounded-2xl border border-[var(--line)] bg-white p-1"
        >
          <Link
            aria-current={filters.view === "cards" ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-xl px-3 text-xs font-extrabold ${
              filters.view === "cards"
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--muted)]"
            }`}
            href={radarFiltersToQuery(filters, { view: "cards" })}
          >
            Kart
          </Link>
          <Link
            aria-current={filters.view === "list" ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-xl px-3 text-xs font-extrabold ${
              filters.view === "list"
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--muted)]"
            }`}
            href={radarFiltersToQuery(filters, { view: "list" })}
          >
            Liste
          </Link>
        </nav>
      </div>

      {result.data.opportunities.length === 0 ? (
        <section className="mt-5 rounded-3xl border border-dashed border-[var(--line)] bg-white/70 px-5 py-10 text-center">
          <h2 className="text-lg font-black text-[var(--ink)]">
            {hasFilters
              ? "Bu filtrelerle fırsat bulunamadı"
              : "Radar’da henüz fırsat yok"}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">
            {hasFilters
              ? "Aşama, işlem türü veya gayrimenkul filtresini değiştirerek yeniden deneyin."
              : "İlk FSBO fırsatını eklediğinizde güvenli liste burada görünecek."}
          </p>
          <Link
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--brand)] px-4 text-sm font-extrabold text-white"
            href={hasFilters ? "/workspace/radar" : "/workspace/ekle"}
          >
            {hasFilters ? "Tüm fırsatları göster" : "FSBO ekle"}
          </Link>
        </section>
      ) : (
        <ol
          aria-label={
            filters.view === "cards"
              ? "Radar kart görünümü"
              : "Radar liste görünümü"
          }
          className={
            filters.view === "cards"
              ? "mt-5 grid gap-4 md:grid-cols-2"
              : "mt-5 space-y-3"
          }
        >
          {result.data.opportunities.map((opportunity) =>
            filters.view === "cards" ? (
              <RadarCard key={opportunity.id} opportunity={opportunity} />
            ) : (
              <RadarListRow key={opportunity.id} opportunity={opportunity} />
            ),
          )}
        </ol>
      )}

      {result.data.truncated ? (
        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          İlk 50 kayıt gösteriliyor. Sonuçları daraltmak için filtreleri kullanın.
        </p>
      ) : null}
    </>
  );
}
