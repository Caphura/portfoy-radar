import Link from "next/link";

import { getDatabaseStatus } from "@/server/system/get-database-status";
import { getPublicSystemStatus } from "@/server/system/get-public-system-status";

export const dynamic = "force-dynamic";

export default async function Home() {
  const systemStatus = getPublicSystemStatus();
  const databaseStatus = await getDatabaseStatus();
  const infrastructureReady = systemStatus.ok && databaseStatus.ok;
  const readinessItems = [
    {
      title: "Mobil öncelikli temel",
      description: "Arayüz küçük ekranlardan başlayarak geniş ekranlara uyum sağlar.",
    },
    {
      title: databaseStatus.ok ? "Supabase bağlı" : "Supabase bekleniyor",
      description: databaseStatus.ok
        ? `Yerel PostgreSQL şema sözleşmesi v${databaseStatus.data.schemaVersion} doğrulandı.`
        : databaseStatus.error.message,
    },
    {
      title: "Kalite kapıları açık",
      description: "Tip, kod kalitesi, otomatik test ve üretim derlemesi tek komutla doğrulanır.",
    },
  ];

  return (
    <main className="min-h-dvh px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-2xl bg-[var(--brand)] text-sm font-black tracking-[-0.04em] text-white shadow-[0_8px_24px_rgba(24,93,69,0.2)]"
            >
              PR
            </span>
            <div>
              <p className="text-base font-extrabold tracking-[-0.02em] text-[var(--ink)]">
                Portföy Radar
              </p>
              <p className="text-xs font-medium text-[var(--muted)]">FSBO takip çalışma alanı</p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${
              infrastructureReady
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
            role="status"
          >
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${
                infrastructureReady ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {infrastructureReady ? "Altyapı hazır" : "Yerel ortam bekleniyor"}
          </span>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-[var(--ink)] px-5 py-8 text-white shadow-[0_24px_70px_rgba(18,37,29,0.14)] sm:px-8 sm:py-12 lg:grid lg:grid-cols-[1.35fr_0.65fr] lg:gap-12">
          <div>
            <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-300">
              Temel proje altyapısı
            </p>
            <h1 className="max-w-2xl text-[clamp(2.25rem,8vw,4.5rem)] font-black leading-[0.96] tracking-[-0.06em]">
              Fırsatları düzene dönüştürecek sağlam başlangıç.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
              Portföy Radar&apos;ın güvenli, test edilebilir ve Türkçe ürün modülleri için
              ihtiyaç duyduğu uygulama zemini hazır.
            </p>
            <Link
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-[var(--ink)] transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              href="/giris"
            >
              Çalışma alanına gir
            </Link>
          </div>

          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.07] p-5 lg:mt-0 lg:self-end">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
              Çalışma varsayımları
            </p>
            {systemStatus.ok ? (
              <dl className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1">
                <div className="rounded-2xl bg-white/[0.07] p-3">
                  <dt className="text-[0.68rem] font-semibold text-white/45">Dil</dt>
                  <dd className="mt-1 text-sm font-extrabold">{systemStatus.data.locale}</dd>
                </div>
                <div className="rounded-2xl bg-white/[0.07] p-3">
                  <dt className="text-[0.68rem] font-semibold text-white/45">Saat</dt>
                  <dd className="mt-1 truncate text-sm font-extrabold">
                    {systemStatus.data.timeZone}
                  </dd>
                </div>
                <div className="rounded-2xl bg-white/[0.07] p-3">
                  <dt className="text-[0.68rem] font-semibold text-white/45">Para</dt>
                  <dd className="mt-1 text-sm font-extrabold">
                    {systemStatus.data.defaultCurrency}
                  </dd>
                </div>
                <div className="rounded-2xl bg-white/[0.07] p-3">
                  <dt className="text-[0.68rem] font-semibold text-white/45">Veritabanı</dt>
                  <dd className="mt-1 text-sm font-extrabold">
                    {databaseStatus.ok
                      ? `Şema v${databaseStatus.data.schemaVersion}`
                      : "Bağlantı bekleniyor"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-950/40 p-4 text-sm leading-6 text-red-100">
                {systemStatus.error.message}
              </p>
            )}
            {!databaseStatus.ok ? (
              <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-950/30 p-4 text-sm leading-6 text-amber-100">
                {databaseStatus.error.message}
              </p>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="readiness-title" className="py-3 sm:py-5">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
                Hazırlık durumu
              </p>
              <h2
                className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--ink)]"
                id="readiness-title"
              >
                Bir sonraki modüle hazır
              </h2>
            </div>
            <span className="hidden text-sm font-semibold text-[var(--muted)] sm:block">
              Kişisel veri içermez
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {readinessItems.map((item, index) => (
              <article
                className="rounded-3xl border border-[var(--line)] bg-white/75 p-5 shadow-[0_10px_35px_rgba(26,45,37,0.05)] backdrop-blur"
                key={item.title}
              >
                <span className="grid size-9 place-items-center rounded-xl bg-[var(--brand-soft)] text-xs font-black text-[var(--brand)]">
                  0{index + 1}
                </span>
                <h3 className="mt-5 text-base font-extrabold tracking-[-0.02em] text-[var(--ink)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-1 border-t border-[var(--line)] px-1 py-5 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>Portföy Radar · Türkiye çalışma ayarları</p>
          <p>Kimlik ve workspace sınırı hazır</p>
        </footer>
      </div>
    </main>
  );
}
