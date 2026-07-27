import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CalendarBoard } from "@/features/calendar/calendar-board";
import { getCalendar } from "@/server/calendar/get-calendar";
import { getWorkspaceAccess } from "@/server/workspace/access";

export const metadata: Metadata = {
  title: "Takvim",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CalendarPage() {
  const access = await getWorkspaceAccess();

  if (!access.ok && access.error.code === "UNAUTHENTICATED") {
    redirect("/giris");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      {access.ok ? (
        <CalendarBoard result={await getCalendar(access.workspace.id)} />
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
              ? "Takvim erişiminiz bulunmuyor"
              : "Takvim kullanılamıyor"}
          </h1>
          <p className="mt-2 text-sm leading-6">{access.error.message}</p>
        </section>
      )}
    </div>
  );
}
