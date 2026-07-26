import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RadarBoard } from "@/features/radar/radar-board";
import {
  parseRadarFilters,
  type RadarSearchParams,
} from "@/features/radar/filters";
import { getRadar } from "@/server/radar/get-radar";
import { getWorkspaceAccess } from "@/server/workspace/access";

export const metadata: Metadata = {
  title: "Radar",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RadarPageProps = {
  searchParams?: Promise<RadarSearchParams>;
};

export default async function RadarPage({
  searchParams = Promise.resolve({}),
}: RadarPageProps = {}) {
  const [access, resolvedSearchParams] = await Promise.all([
    getWorkspaceAccess(),
    searchParams,
  ]);
  const parsedFilters = parseRadarFilters(resolvedSearchParams);

  if (!access.ok && access.error.code === "UNAUTHENTICATED") {
    redirect("/giris");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      {access.ok ? (
        <RadarBoard
          correctedFilters={parsedFilters.corrected}
          filters={parsedFilters.filters}
          result={await getRadar(access.workspace.id, parsedFilters.filters)}
        />
      ) : (
        <section
          className={`rounded-3xl border p-5 ${
            access.error.code === "FORBIDDEN"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
          role="alert"
        >
          <h1 className="text-xl font-black">
            {access.error.code === "FORBIDDEN"
              ? "Radar erişiminiz bulunmuyor"
              : "Radar kullanılamıyor"}
          </h1>
          <p className="mt-2 text-sm leading-6">{access.error.message}</p>
        </section>
      )}
    </div>
  );
}
