export default function WorkspaceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Çalışma alanı yükleniyor"
      className="mx-auto w-full max-w-5xl animate-pulse px-4 py-5 sm:px-6 sm:py-8 lg:px-8"
    >
      <div className="h-4 w-24 rounded-full bg-emerald-900/10" />
      <div className="mt-3 h-10 w-52 rounded-2xl bg-emerald-900/10" />
      <div className="mt-6 h-72 rounded-[2rem] bg-emerald-950/10" />
    </div>
  );
}
