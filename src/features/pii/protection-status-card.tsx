import type { PiiProtectionStatusResult } from "@/server/pii/status-core";

type PiiProtectionStatusCardProps = {
  result: PiiProtectionStatusResult;
};

export function PiiProtectionStatusCard({
  result,
}: PiiProtectionStatusCardProps) {
  if (!result.ok) {
    return (
      <section
        className="mt-4 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-5 text-amber-50"
        role="alert"
      >
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-amber-200">
          Yayın engeli
        </p>
        <h2 className="mt-2 text-lg font-extrabold">
          Kişisel veri koruması hazır değil
        </h2>
        <p className="mt-2 text-sm leading-6 text-amber-50/75">
          {result.error.message}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="pii-protection-title"
      className="mt-4 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
            Güvenlik katmanı
          </p>
          <h2
            className="mt-2 text-lg font-extrabold"
            id="pii-protection-title"
          >
            Kişisel veri koruması hazır
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
            Telefon ve e-posta yalnız sunucuda korunur; normal listeler açık
            değer içermez.
          </p>
        </div>
        <span className="w-fit rounded-full bg-emerald-300/15 px-3 py-2 text-xs font-bold text-emerald-100">
          Hazır
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          ["Şifreleme", result.data.encryption],
          ["Mükerrer anahtarı", result.data.duplicateIndex],
          ["Telefon biçimi", result.data.phoneFormat],
          ["Liste görünümü", result.data.listMask],
          ["Anahtar rotasyonu", result.data.keyRotation],
        ].map(([label, value]) => (
          <div
            className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-white/[0.08] px-4 py-3"
            key={label}
          >
            <dt className="text-xs font-bold text-white/55">{label}</dt>
            <dd className="text-right text-sm font-extrabold text-white">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
