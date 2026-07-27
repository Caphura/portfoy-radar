import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { defaultQuickFsboNextActionAt } from "@/features/fsbo/quick-fsbo-validation";
import { PhysicalFsboForm } from "@/features/field-observations/physical-fsbo-form";
import { getFieldObservationDetail } from "@/server/field-observations/get-field-observation-detail";

export const metadata: Metadata = {
  title: "Saha kaydını FSBO’ya dönüştür",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConvertFieldObservationPage({
  params,
}: {
  params: Promise<{ observationId: string }>;
}) {
  const { observationId } = await params;
  const result = await getFieldObservationDetail(observationId);

  if (!result.ok && result.error.code === "UNAUTHENTICATED") {
    redirect("/giris");
  }

  if (!result.ok && result.error.code === "NOT_FOUND") {
    notFound();
  }

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <h1 className="text-xl font-black">Dönüşüm açılamadı</h1>
          <p className="mt-2 text-sm">{result.error.message}</p>
        </section>
      </div>
    );
  }

  if (result.data.isLinked) {
    redirect(`/workspace/ekle/saha/${result.data.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
      <Link
        className="text-sm font-extrabold text-[var(--brand)]"
        href={`/workspace/ekle/saha/${result.data.id}`}
      >
        ← Saha kaydına dön
      </Link>
      <header className="my-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
          Fiziksel ilan
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">
          FSBO fırsatına dönüştür
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Platform, ilan numarası ve URL oluşturulmaz. Telefon HMAC’i, mülk
          benzerliği ve kapanmış ilan adımları kullanıcı kararıyla uygulanır.
        </p>
      </header>
      <PhysicalFsboForm
        defaultNextActionAt={defaultQuickFsboNextActionAt()}
        observationId={result.data.id}
      />
    </div>
  );
}
