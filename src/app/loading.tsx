export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Sayfa yükleniyor" className="min-h-dvh px-4 py-5">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="h-11 w-44 rounded-2xl bg-emerald-900/10" />
        <div className="mt-5 h-[26rem] rounded-[2rem] bg-emerald-950/10" />
      </div>
    </main>
  );
}
