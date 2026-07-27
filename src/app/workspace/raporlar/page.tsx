import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PerformanceReportDashboard } from "@/features/reports/performance-report-dashboard";
import {
  parseReportPeriod,
  type ReportSearchParams,
} from "@/features/reports/report-period";
import { ReleaseReadinessPanel } from "@/features/release/release-readiness-panel";
import { getReleaseReadiness } from "@/server/release/get-release-readiness";
import { getPerformanceReport } from "@/server/reports/get-performance-report";
import type { PerformanceReportResult } from "@/server/reports/performance-report-core";
import { getWorkspaceAccess } from "@/server/workspace/access";
import { formatIstanbulDateKey } from "@/shared/time/istanbul";

export const metadata: Metadata = {
  title: "Raporlar",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReportsPageProps = {
  searchParams?: Promise<ReportSearchParams>;
};

export default async function ReportsPage({
  searchParams = Promise.resolve({}),
}: ReportsPageProps = {}) {
  const now = new Date();
  const [access, resolvedSearchParams] = await Promise.all([
    getWorkspaceAccess(),
    searchParams,
  ]);
  const parsedPeriod = parseReportPeriod(resolvedSearchParams, now);

  if (!access.ok && access.error.code === "UNAUTHENTICATED") {
    redirect("/giris");
  }

  if (!access.ok) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
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
              ? "Rapor erişiminiz bulunmuyor"
              : "Raporlar kullanılamıyor"}
          </h1>
          <p className="mt-2 text-sm leading-6">{access.error.message}</p>
        </section>
      </div>
    );
  }

  const period = parsedPeriod.ok ? parsedPeriod.data : parsedPeriod.values;
  const result: PerformanceReportResult = parsedPeriod.ok
    ? await getPerformanceReport(access.workspace.id, parsedPeriod.data, now)
    : {
        ok: false,
        error: {
          code: "INVALID_PERIOD",
          message: parsedPeriod.message,
        },
      };
  const releaseReadiness =
    access.membership.role === "owner" ? await getReleaseReadiness() : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <PerformanceReportDashboard
        fieldErrors={parsedPeriod.ok ? undefined : parsedPeriod.fieldErrors}
        period={period}
        result={result}
        today={formatIstanbulDateKey(now)}
      />
      {releaseReadiness ? (
        <ReleaseReadinessPanel result={releaseReadiness} />
      ) : null}
    </div>
  );
}
