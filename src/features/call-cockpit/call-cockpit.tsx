import Link from "next/link";

import type {
  PriorityCallQueueItem,
  PriorityCallQueueResult,
} from "@/server/priority/priority-core";

import { PhoneReveal } from "./phone-reveal";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatLocation(item: PriorityCallQueueItem) {
  return [
    item.property.neighborhood,
    item.property.district,
    item.property.city,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatProperty(item: PriorityCallQueueItem) {
  const rooms =
    item.property.roomCount !== null &&
    item.property.livingRoomCount !== null
      ? `${item.property.roomCount}+${item.property.livingRoomCount}`
      : null;
  const area = item.property.netAreaSqm ?? item.property.grossAreaSqm;

  return [
    item.property.typeLabel,
    rooms,
    area ? `${area.toLocaleString("tr-TR")} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatSource(item: PriorityCallQueueItem) {
  if (!item.listing) {
    return "Kaynak ilan bağlı değil";
  }

  const transaction =
    item.listing.transactionType === "sale" ? "Satılık" : "Kiralık";

  return `${transaction} · ${item.listing.platform} · #${item.listing.externalListingId}`;
}

function formatPrice(item: PriorityCallQueueItem) {
  if (!item.listing) {
    return "Fiyat bilgisi yok";
  }

  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: item.listing.currency,
      maximumFractionDigits: 0,
    }).format(item.listing.askingPrice);
  } catch {
    return `${item.listing.askingPrice.toLocaleString("tr-TR")} ${item.listing.currency}`;
  }
}

function ScoreItem({
  label,
  detail,
  points,
}: {
  label: string;
  detail: string;
  points: number;
}) {
  return (
    <li className="flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-[var(--canvas)] px-3 py-3">
      <div>
        <p className="text-xs font-extrabold text-[var(--ink)]">{label}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{detail}</p>
      </div>
      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black tabular-nums text-[var(--brand)]">
        +{points}
      </span>
    </li>
  );
}

function ScoreBreakdown({ item }: { item: PriorityCallQueueItem }) {
  const { breakdown } = item;

  return (
    <details className="mt-4 rounded-2xl border border-[var(--line)] bg-white">
      <summary className="min-h-12 cursor-pointer list-none px-4 py-3 text-sm font-extrabold text-[var(--brand)]">
        Puanı açıkla
      </summary>
      <div className="border-t border-[var(--line)] p-3">
        <ol
          aria-label={`${item.rank}. sıra öncelik puanı açıklaması`}
          className="grid gap-2 sm:grid-cols-2"
        >
          <ScoreItem
            detail={
              breakdown.overdue.days > 0
                ? `${breakdown.overdue.days} gecikmiş gün · en fazla 30 puan`
                : "Sonraki işlem gecikmemiş"
            }
            label="Gecikme"
            points={breakdown.overdue.points}
          />
          <ScoreItem
            detail={item.stageLabel}
            label="Fırsat aşaması"
            points={breakdown.stage.points}
          />
          <ScoreItem
            detail={
              breakdown.conversationAge.days === null
                ? "Henüz görüşme kaydı yok"
                : `${breakdown.conversationAge.days} tam gün geçti`
            }
            label="Son görüşme"
            points={breakdown.conversationAge.points}
          />
          <ScoreItem
            detail={
              breakdown.priceDrop.recent
                ? "Son 30 günde ardışık iki kayıtla doğrulandı"
                : "Son 30 günde doğrulanmış düşüş yok"
            }
            label="Fiyat düşüşü"
            points={breakdown.priceDrop.points}
          />
          <ScoreItem
            detail={`${breakdown.completeness.completedGroups}/5 bilgi grubu tamamlandı`}
            label="Profil ve ilan tamlığı"
            points={breakdown.completeness.points}
          />
          <ScoreItem
            detail={
              breakdown.dueToday.value
                ? "Sonraki işlem bugün"
                : "Sonraki işlem başka bir gün"
            }
            label="Bugün planı"
            points={breakdown.dueToday.points}
          />
        </ol>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          Toplam yalnız bu altı bileşenin toplamıdır. Puan otomatik arama veya
          mesaj başlatmaz.
        </p>
      </div>
    </details>
  );
}

function QueueCard({
  item,
  canRecordConversation,
}: {
  item: PriorityCallQueueItem;
  canRecordConversation: boolean;
}) {
  const first = item.rank === 1;

  return (
    <li
      className={`rounded-3xl border bg-white p-4 shadow-[0_12px_35px_rgba(18,37,29,0.07)] sm:p-5 ${
        first
          ? "border-emerald-300 ring-4 ring-emerald-900/5"
          : "border-[var(--line)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand)]">
            {first ? "Sıradaki fırsat" : `${item.rank}. sıra`}
          </p>
          <h2 className="mt-2 break-words text-xl font-black tracking-[-0.03em] text-[var(--ink)]">
            {formatLocation(item) || "Konum bilgisi yok"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
            {formatProperty(item)}
          </p>
        </div>
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[var(--ink)] text-center text-white">
          <div>
            <p className="text-2xl font-black tabular-nums">
              {item.priorityScore}
            </p>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-white/55">
              / 100
            </p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
        {formatSource(item)}
      </p>
      <p className="mt-2 text-2xl font-black text-[var(--ink)]">
        {formatPrice(item)}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-[var(--canvas)] p-3">
        <div>
          <dt className="text-xs font-bold text-[var(--muted)]">Aşama</dt>
          <dd className="mt-1 text-sm font-black text-[var(--ink)]">
            {item.stageLabel}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-[var(--muted)]">
            Sonraki işlem
          </dt>
          <dd className="mt-1 text-sm font-black text-[var(--ink)]">
            {item.nextAction.label}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-[var(--muted)]">
            {formatDate(item.nextAction.at)}
          </dd>
        </div>
      </dl>

      <ScoreBreakdown item={item} />

      <PhoneReveal
        canReveal={canRecordConversation}
        opportunityId={item.id}
      />

      <Link
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--brand)] px-4 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(24,93,69,0.2)]"
        href={
          canRecordConversation
            ? `/workspace/radar/${item.id}#gorusme-kaydi`
            : `/workspace/radar/${item.id}`
        }
      >
        {canRecordConversation
          ? "Fırsatı aç ve görüşme kaydet"
          : "Fırsatı incele"}
      </Link>
    </li>
  );
}

export function CallCockpit({
  result,
  canRecordConversation,
}: {
  result: PriorityCallQueueResult;
  canRecordConversation: boolean;
}) {
  if (!result.ok) {
    return (
      <section
        className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        role="alert"
      >
        <h1 className="text-xl font-black">Arama kokpiti yüklenemedi</h1>
        <p className="mt-2 text-sm leading-6">{result.error.message}</p>
        <Link
          className="mt-4 inline-flex min-h-11 items-center rounded-2xl border border-amber-300 px-4 text-sm font-extrabold"
          href="/workspace/radar"
        >
          Radar’a dön
        </Link>
      </section>
    );
  }

  return (
    <>
      <Link
        className="inline-flex min-h-11 items-center px-1 text-sm font-extrabold text-[var(--brand)]"
        href="/workspace/radar"
      >
        ← Radar’a dön
      </Link>

      <section className="mt-2 overflow-hidden rounded-[2rem] bg-[var(--ink)] p-5 text-white shadow-[0_20px_60px_rgba(18,37,29,0.14)] sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
              {result.data.scoreVersion}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
              Arama kokpiti
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
              İletişime uygun açık fırsatlar açıklanabilir puanla sıralanır.
              Bu ekran arama, SMS veya WhatsApp mesajı göndermez.
            </p>
          </div>
          <span className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-extrabold">
            {result.data.opportunities.length} fırsat
          </span>
        </div>
      </section>

      {result.data.opportunities.length === 0 ? (
        <section className="mt-5 rounded-3xl border border-dashed border-[var(--line)] bg-white/75 px-5 py-10 text-center">
          <h2 className="text-xl font-black text-[var(--ink)]">
            Arama sırasında fırsat yok
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">
            Açık ve iletişime uygun bir fırsat oluştuğunda priority-v1 sırası
            burada görünecek.
          </p>
          <Link
            className="mt-4 inline-flex min-h-11 items-center rounded-2xl bg-[var(--brand)] px-4 text-sm font-extrabold text-white"
            href="/workspace/radar"
          >
            Radar’a dön
          </Link>
        </section>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[var(--ink)]">
                Günlük arama sırası
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Eşitlikte işlem zamanı, oluşturma zamanı ve kayıt kimliği
                kullanılır.
              </p>
            </div>
          </div>
          <ol
            aria-label="Öncelikli günlük arama sırası"
            className="mt-4 grid gap-4 lg:grid-cols-2"
          >
            {result.data.opportunities.map((item) => (
              <QueueCard
                canRecordConversation={canRecordConversation}
                item={item}
                key={item.id}
              />
            ))}
          </ol>
        </>
      )}

      {result.data.truncated ? (
        <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          İlk 50 fırsat gösteriliyor. Sıra her yenilemede güncel priority-v1
          puanıyla yeniden hesaplanır.
        </p>
      ) : null}

      <aside className="mt-5 rounded-3xl border border-emerald-200 bg-[var(--brand-soft)] p-5 text-sm leading-6 text-[var(--ink)]">
        <p className="font-black">Güvenli arama sırası</p>
        <p className="mt-1">
          Aktif iletişim engeli olan veya kapanmış fırsatlar bu sıraya girmez.
          Kişi ve iletişim bilgileri kokpit DTO’sunda bulunmaz.
        </p>
      </aside>
    </>
  );
}
