import Link from "next/link";

export default function WorkspaceNotFound() {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 py-8">
      <section className="w-full max-w-md rounded-[2rem] border border-[var(--line)] bg-white p-6 text-center shadow-xl shadow-emerald-950/5">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
          404
        </p>
        <h1 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--ink)]">
          Bu uygulama bölümü bulunamadı
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Bağlantı değişmiş veya bölüm henüz kullanıma açılmamış olabilir.
        </p>
        <Link
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          href="/workspace"
        >
          Ana sayfaya dön
        </Link>
      </section>
    </div>
  );
}
