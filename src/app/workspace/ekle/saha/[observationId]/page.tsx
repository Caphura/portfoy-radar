import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FieldObservationControls } from "@/features/field-observations/field-observation-controls";
import { getFieldObservationDetail } from "@/server/field-observations/get-field-observation-detail";
import { getWorkspaceAccess } from "@/server/workspace/access";

export const metadata: Metadata = {
  title: "Saha gözlemi",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const formatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "long",
  timeStyle: "short",
});

export default async function FieldObservationDetailPage({
  params,
}: {
  params: Promise<{ observationId: string }>;
}) {
  const { observationId } = await params;
  const [result, access] = await Promise.all([
    getFieldObservationDetail(observationId),
    getWorkspaceAccess({ allowedRoles: ["owner", "advisor"] }),
  ]);

  if (!result.ok && result.error.code === "UNAUTHENTICATED") {
    redirect("/giris");
  }

  if (!result.ok && result.error.code === "NOT_FOUND") {
    notFound();
  }

  if (!result.ok || !access.ok) {
    const errorMessage = !result.ok
      ? result.error.message
      : !access.ok
        ? access.error.message
        : "Saha kaydı açılamadı.";

    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <section
          className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
          role="alert"
        >
          <h1 className="text-xl font-black">Saha kaydı açılamadı</h1>
          <p className="mt-2 text-sm leading-6">
            {errorMessage}
          </p>
        </section>
      </div>
    );
  }

  const canManageTrash =
    access.membership.role === "owner" || result.data.createdByCurrentUser;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
      <Link
        className="text-sm font-extrabold text-[var(--brand)]"
        href="/workspace/ekle/saha"
      >
        ← Saha kayıtları
      </Link>
      <header className="mt-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
          Saha gözlemi
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">
          {formatter.format(new Date(result.data.observedAt))}
        </h1>
        <p className="mt-2 text-sm font-semibold text-[var(--muted)]">
          {result.data.hasLocation
            ? `Konum eklendi · yaklaşık ${Math.round(result.data.locationAccuracy ?? 0)} m doğruluk`
            : "Konum eklenmedi"}
          {" · "}
          {result.data.isLinked
            ? "FSBO’ya dönüştürüldü"
            : "FSBO bağlantısı bekliyor"}
        </p>
      </header>

      <section className="mt-5 overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--ink)]">
        {/* Next Image optimizasyon cache'i hassas fotoğraf için bilinçli olarak kullanılmaz. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="Sahada çekilen sahibinden tabela fotoğrafı"
          className="max-h-[70dvh] w-full object-contain"
          src={`/api/workspace/field-observations/${result.data.id}/photo`}
        />
      </section>

      {result.data.hasLocation ? (
        <section className="mt-5 grid grid-cols-2 gap-3">
          <a
            className="flex min-h-12 items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-3 text-center text-sm font-black"
            href={`/api/workspace/field-observations/${result.data.id}/maps?intent=view`}
            rel="noreferrer"
            target="_blank"
          >
            Haritada göster
          </a>
          <a
            className="flex min-h-12 items-center justify-center rounded-2xl bg-[var(--brand)] px-3 text-center text-sm font-black text-white"
            href={`/api/workspace/field-observations/${result.data.id}/maps?intent=directions`}
            rel="noreferrer"
            target="_blank"
          >
            Yol tarifi al
          </a>
        </section>
      ) : null}

      {result.data.isLinked && result.data.opportunityId ? (
        <Link
          className="mt-5 flex min-h-14 items-center justify-center rounded-2xl bg-[var(--brand)] px-5 text-base font-black text-white"
          href={`/workspace/radar/${result.data.opportunityId}`}
        >
          Bağlı fırsatı aç
        </Link>
      ) : null}

      <FieldObservationControls
        canManageTrash={canManageTrash}
        hasLocation={result.data.hasLocation}
        isLinked={result.data.isLinked}
        observationId={result.data.id}
        status={result.data.status}
      />
    </div>
  );
}
