import Link from "next/link";

import { AppointmentForm } from "@/features/appointments/appointment-form";
import { DoNotCallControl } from "@/features/communication-blocks/do-not-call-control";
import { ConversationForm } from "@/features/conversations/conversation-form";
import { MarketAnalysisPanel } from "@/features/market-analysis/market-analysis-panel";
import type {
  OpportunityDetailResult,
  OpportunityTimelineItem,
} from "@/server/opportunity-detail/opportunity-detail-core";
import type { MarketAnalysisResult } from "@/server/market-analysis/market-analysis-core";
import type { RadarOpportunity } from "@/server/radar/radar-core";

type OpportunityDetailViewProps = {
  result: OpportunityDetailResult;
  canRecordConversation?: boolean;
  defaultConversationOccurredAt?: string;
  defaultConversationFollowUpAt?: string;
  canManageCommunicationBlock?: boolean;
  canCreateAppointment?: boolean;
  defaultAppointmentStartsAt?: string;
  defaultAppointmentEndsAt?: string;
  marketAnalysisResult?: MarketAnalysisResult;
  canManageMarketAnalysis?: boolean;
  defaultMarketAnalysisTargetAt?: string;
  defaultComparableObservedOn?: string;
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

function formatSource(opportunity: RadarOpportunity) {
  if (!opportunity.listing) {
    return "Kaynak ilan bağlı değil";
  }

  const transaction =
    opportunity.listing.transactionType === "sale" ? "Satılık" : "Kiralık";

  return `${transaction} · ${opportunity.listing.platform} · #${opportunity.listing.externalListingId}`;
}

function TimelineItem({ item }: { item: OpportunityTimelineItem }) {
  return (
    <li className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0">
      <span
        aria-hidden="true"
        className="relative z-10 mt-1.5 size-3 rounded-full bg-[var(--brand)] ring-4 ring-[var(--brand-soft)]"
      />
      <div className="min-w-0">
        <h3 className="text-sm font-black text-[var(--ink)]">{item.title}</h3>
        {item.detail ? (
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
            {item.detail}
          </p>
        ) : null}
        <time
          className="mt-1 block text-xs font-bold text-[var(--muted)]"
          dateTime={item.occurredAt}
        >
          {formatDate(item.occurredAt)}
        </time>
      </div>
    </li>
  );
}

export function OpportunityDetailView({
  result,
  canRecordConversation = false,
  defaultConversationOccurredAt = "",
  defaultConversationFollowUpAt = "",
  canManageCommunicationBlock = false,
  canCreateAppointment = false,
  defaultAppointmentStartsAt = "",
  defaultAppointmentEndsAt = "",
  marketAnalysisResult,
  canManageMarketAnalysis = false,
  defaultMarketAnalysisTargetAt = "",
  defaultComparableObservedOn = "",
}: OpportunityDetailViewProps) {
  if (!result.ok) {
    const notFound = result.error.code === "NOT_FOUND";

    return (
      <section
        className={`rounded-[2rem] border p-6 text-center ${
          notFound
            ? "border-[var(--line)] bg-white"
            : "border-amber-200 bg-amber-50 text-amber-950"
        }`}
        role={notFound ? "status" : "alert"}
      >
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
          {notFound ? "Fırsat detayı" : "Bağlantı sorunu"}
        </p>
        <h1 className="mt-3 text-2xl font-black tracking-[-0.04em]">
          {notFound ? "Fırsat bulunamadı" : "Fırsat ayrıntıları yüklenemedi"}
        </h1>
        <p className="mt-3 text-sm leading-6">{result.error.message}</p>
        <Link
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--brand)] px-5 text-sm font-extrabold text-white sm:w-auto"
          href="/workspace/radar"
        >
          Radar’a dön
        </Link>
      </section>
    );
  }

  const { communicationBlock, opportunity, timeline } = result.data;
  const location = formatLocation(opportunity);

  return (
    <>
      <Link
        className="inline-flex min-h-11 items-center rounded-2xl px-1 text-sm font-extrabold text-[var(--brand)]"
        href="/workspace/radar"
      >
        ← Radar’a dön
      </Link>

      <section className="mt-2 rounded-[2rem] bg-[var(--ink)] p-5 text-white shadow-[0_20px_60px_rgba(18,37,29,0.12)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-emerald-300">
              {formatSource(opportunity)}
            </p>
            <h1 className="mt-3 break-words text-3xl font-black tracking-[-0.05em] sm:text-4xl">
              {location || "Konum bilgisi yok"}
            </h1>
            <p className="mt-2 text-sm font-semibold text-white/65">
              {formatPropertyDetail(opportunity)}
            </p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-extrabold ring-1 ring-inset ${stageStyles[opportunity.stage]}`}
          >
            {opportunity.stageLabel}
          </span>
        </div>
        <p className="mt-6 text-3xl font-black tracking-[-0.04em]">
          {formatPrice(opportunity)}
        </p>
      </section>

      {marketAnalysisResult ? (
        <MarketAnalysisPanel
          canManage={canManageMarketAnalysis}
          defaultCurrency={opportunity.listing?.currency ?? "TRY"}
          defaultObservedOn={defaultComparableObservedOn}
          defaultTargetAt={defaultMarketAnalysisTargetAt}
          defaultTransactionType={
            opportunity.listing?.transactionType ?? "sale"
          }
          opportunityId={opportunity.id}
          result={marketAnalysisResult}
          unavailable={opportunity.closed || communicationBlock.active}
        />
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-[var(--line)] bg-white p-5">
            <h2 className="text-lg font-black text-[var(--ink)]">
              Fırsat özeti
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Sonraki işlem
                </dt>
                <dd className="mt-1 text-sm font-black text-[var(--ink)]">
                  {opportunity.nextAction?.label ?? "Fırsat kapandı"}
                </dd>
                <dd className="mt-1 text-xs font-semibold text-[var(--muted)]">
                  {opportunity.nextAction
                    ? formatDate(opportunity.nextAction.at)
                    : opportunity.closedAt
                      ? formatDate(opportunity.closedAt)
                      : "Kapanış zamanı yok"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Son güncelleme
                </dt>
                <dd className="mt-1 text-sm font-black text-[var(--ink)]">
                  {formatDate(opportunity.updatedAt)}
                </dd>
              </div>
            </dl>
          </section>

          <DoNotCallControl
            active={communicationBlock.active}
            canManage={canManageCommunicationBlock}
            opportunityId={opportunity.id}
          />

          {canCreateAppointment ? (
            <AppointmentForm
              defaultEndsAt={defaultAppointmentEndsAt}
              defaultStartsAt={defaultAppointmentStartsAt}
              opportunityId={opportunity.id}
              unavailable={opportunity.closed || communicationBlock.active}
            />
          ) : (
            <section className="rounded-3xl border border-[var(--line)] bg-white p-5">
              <h2 className="text-lg font-black text-[var(--ink)]">
                Randevu oluştur
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Randevu oluşturmak için sahip veya danışman rolü gerekir.
              </p>
            </section>
          )}

          <div className="scroll-mt-24" id="gorusme-kaydi">
            {canRecordConversation ? (
              <ConversationForm
                defaultFollowUpAt={defaultConversationFollowUpAt}
                defaultOccurredAt={defaultConversationOccurredAt}
                opportunityClosed={opportunity.closed}
                opportunityId={opportunity.id}
              />
            ) : (
              <section className="rounded-3xl border border-[var(--line)] bg-white p-5">
                <h2 className="text-lg font-black text-[var(--ink)]">
                  Görüşme kaydı
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Görüşme kaydetmek için sahip veya danışman rolü gerekir.
                </p>
              </section>
            )}
          </div>

          <section className="rounded-3xl border border-[var(--line)] bg-white p-5">
            <h2 className="text-lg font-black text-[var(--ink)]">
              Gayrimenkul
            </h2>
            <p className="mt-3 text-base font-black text-[var(--ink)]">
              {formatPropertyDetail(opportunity)}
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
              {location || "Konum bilgisi yok"}
            </p>
          </section>

          <aside className="rounded-3xl border border-emerald-200 bg-[var(--brand-soft)] p-5 text-sm leading-6 text-[var(--ink)]">
            <p className="font-black">Kişisel veri koruması</p>
            <p className="mt-1">
              Kişi ve iletişim bilgileri bu görünümde yer almaz.
            </p>
          </aside>
        </div>

        <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--brand)]">
              Append-only geçmiş
            </p>
            <h2 className="mt-1 text-xl font-black text-[var(--ink)]">
              İş zaman çizelgesi
            </h2>
          </div>

          {timeline.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-[var(--canvas)] px-4 py-6 text-center text-sm font-semibold text-[var(--muted)]">
              Bu fırsat için henüz gösterilebilir bir işlem yok.
            </p>
          ) : (
            <ol
              aria-label="Fırsat iş zaman çizelgesi"
              className="relative mt-6 before:absolute before:bottom-2 before:left-[0.34rem] before:top-2 before:w-px before:bg-[var(--line)]"
            >
              {timeline.map((item) => (
                <TimelineItem item={item} key={item.id} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
