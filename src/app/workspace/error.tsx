"use client";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 py-8">
      <section
        className="w-full max-w-md rounded-[2rem] border border-red-100 bg-white p-6 text-center shadow-xl shadow-red-950/5"
        role="alert"
      >
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-700">
          Beklenmeyen durum
        </p>
        <h1 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--ink)]">
          Bu bölüm yüklenemedi
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          İşlem tamamlanamadı. Kişisel veya teknik hata ayrıntıları gösterilmedi.
        </p>
        <button
          className="mt-6 min-h-12 w-full rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          onClick={reset}
          type="button"
        >
          Yeniden dene
        </button>
      </section>
    </div>
  );
}
