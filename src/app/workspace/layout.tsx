import { redirect } from "next/navigation";

import { AppShell } from "@/features/shell/app-shell";
import { WorkspaceSetupForm } from "@/features/workspace/workspace-setup-form";
import { getWorkspaceAccess } from "@/server/workspace/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await getWorkspaceAccess();

  if (!access.ok && access.error.code === "UNAUTHENTICATED") {
    redirect("/giris");
  }

  if (!access.ok && access.error.code === "WORKSPACE_REQUIRED") {
    return (
      <main className="min-h-dvh px-4 py-5 sm:grid sm:place-items-center sm:px-6 sm:py-10">
        <section className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_24px_70px_rgba(18,37,29,0.12)] backdrop-blur sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
            İlk kurulum
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--ink)]">
            Çalışma alanını oluştur
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
            İlanlar, kişiler ve fırsatlar bu güvenli sınır içinde izole edilecek.
            Kurulum tamamlanınca mobil uygulama kabuğu açılır.
          </p>
          <WorkspaceSetupForm />
        </section>
      </main>
    );
  }

  if (!access.ok) {
    const forbidden = access.error.code === "FORBIDDEN";

    return (
      <main className="grid min-h-dvh place-items-center px-4 py-8">
        <section
          className={`w-full max-w-md rounded-[2rem] border p-6 text-center shadow-xl ${
            forbidden
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
          role="alert"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.18em]">
            {forbidden ? "Erişim reddedildi" : "Bağlantı sorunu"}
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-[-0.04em]">
            {forbidden
              ? "Bu çalışma alanını açamazsınız"
              : "Uygulama kabuğu yüklenemedi"}
          </h1>
          <p className="mt-3 text-sm leading-6">{access.error.message}</p>
        </section>
      </main>
    );
  }

  return (
    <AppShell
      role={access.membership.role}
      workspaceName={access.workspace.name}
    >
      {children}
    </AppShell>
  );
}
