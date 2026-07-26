import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OpportunityDetailView } from "@/features/opportunity-detail/opportunity-detail-view";
import { getOpportunityDetail } from "@/server/opportunity-detail/get-opportunity-detail";
import { getWorkspaceAccess } from "@/server/workspace/access";

export const metadata: Metadata = {
  title: "Fırsat detayı",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type OpportunityDetailPageProps = {
  params: Promise<{
    opportunityId: string;
  }>;
};

export default async function OpportunityDetailPage({
  params,
}: OpportunityDetailPageProps) {
  const [access, resolvedParams] = await Promise.all([
    getWorkspaceAccess(),
    params,
  ]);

  if (!access.ok && access.error.code === "UNAUTHENTICATED") {
    redirect("/giris");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      {access.ok ? (
        <OpportunityDetailView
          result={await getOpportunityDetail(
            access.workspace.id,
            resolvedParams.opportunityId,
          )}
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
              ? "Fırsat erişiminiz bulunmuyor"
              : "Fırsat ayrıntıları kullanılamıyor"}
          </h1>
          <p className="mt-2 text-sm leading-6">{access.error.message}</p>
        </section>
      )}
    </div>
  );
}
