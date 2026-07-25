"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <section className="w-full max-w-md rounded-[2rem] border border-red-100 bg-white p-7 text-center shadow-xl shadow-red-950/5">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-700">
          Beklenmeyen durum
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--ink)]">
          Bir sorun oluştu
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          İşlem tamamlanamadı. Bu ekran kişisel veya teknik hata ayrıntılarını göstermez.
        </p>
        <button
          className="mt-6 min-h-12 w-full rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          onClick={reset}
          type="button"
        >
          Yeniden dene
        </button>
      </section>
    </main>
  );
}
