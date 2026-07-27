import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FieldObservationCapture } from "@/features/field-observations/field-observation-capture";
import { FieldObservationList } from "@/features/field-observations/field-observation-list";
import { getFieldObservations } from "@/server/field-observations/get-field-observations";

export const metadata: Metadata = {
  title: "Saha kaydı",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FieldObservationPage() {
  const result = await getFieldObservations();

  if (!result.ok && result.error.code === "UNAUTHENTICATED") {
    redirect("/giris");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
          Ekle · Saha
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
          Saha kaydı
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Camdaki sahibinden tabelasını tek fotoğraf ve isteğe bağlı konumla
          kaydedin. Thumbnail gösterilmez; fotoğraf yalnız detay ekranında
          yetki ve audit kontrolüyle açılır.
        </p>
      </header>

      {result.ok ? (
        <>
          {result.data.mode === "synthetic" ? (
            <div
              className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950"
              role="status"
            >
              Sentetik veri modu: Gerçek kişiye ait tabela, telefon veya konum
              yüklemeyin.
            </div>
          ) : null}
          <FieldObservationCapture />
          <FieldObservationList observations={result.data.observations} />
        </>
      ) : (
        <section
          className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
          role="alert"
        >
          <h2 className="text-lg font-black">Saha kaydı kullanılamıyor</h2>
          <p className="mt-2 text-sm leading-6">{result.error.message}</p>
        </section>
      )}
    </div>
  );
}
