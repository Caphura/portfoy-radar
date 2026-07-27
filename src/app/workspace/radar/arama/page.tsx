import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CallCockpit } from "@/features/call-cockpit/call-cockpit";
import { getPriorityCallQueue } from "@/server/priority/get-priority-call-queue";
import { getWorkspaceAccess } from "@/server/workspace/access";

export const metadata: Metadata = {
  title: "Arama kokpiti",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CallCockpitPage() {
  const access = await getWorkspaceAccess();

  if (!access.ok && access.error.code === "UNAUTHENTICATED") {
    redirect("/giris");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      {access.ok ? (
        <CallCockpit
          canRecordConversation={access.membership.role !== "viewer"}
          result={await getPriorityCallQueue(access.workspace.id)}
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
              ? "Arama kokpiti erişiminiz bulunmuyor"
              : "Arama kokpiti kullanılamıyor"}
          </h1>
          <p className="mt-2 text-sm leading-6">{access.error.message}</p>
        </section>
      )}
    </div>
  );
}
