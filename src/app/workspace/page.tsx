import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutAction } from "@/features/auth/actions";
import { HistoryPanel } from "@/features/history/history-panel";
import { OpportunityPipeline } from "@/features/opportunities/opportunity-pipeline";
import { PiiProtectionStatusCard } from "@/features/pii/protection-status-card";
import { WorkspaceRenameForm } from "@/features/workspace/workspace-rename-form";
import { WorkspaceSetupForm } from "@/features/workspace/workspace-setup-form";
import { getWorkspaceEntitySummary } from "@/server/entities/get-entity-summary";
import { getWorkspaceHistory } from "@/server/history/get-workspace-history";
import { getOpportunityPipeline } from "@/server/opportunities/get-opportunity-pipeline";
import { getPiiProtectionStatus } from "@/server/pii/get-protection-status";
import { getWorkspaceAccess } from "@/server/workspace/access";
import type { WorkspaceRole } from "@/server/workspace/roles";

export const metadata: Metadata = {
  title: "Çalışma alanı",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const roleLabels: Record<WorkspaceRole, string> = {
  owner: "Sahip",
  advisor: "Danışman",
  viewer: "Görüntüleyici",
};

function SignOutForm() {
  return (
    <form action={logoutAction}>
      <button
        className="min-h-11 rounded-2xl border border-[var(--line)] bg-white/75 px-4 text-sm font-bold text-[var(--ink)] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        type="submit"
      >
        Çıkış yap
      </button>
    </form>
  );
}

export default async function WorkspacePage() {
  const access = await getWorkspaceAccess();

  if (!access.ok && access.error.code === "UNAUTHENTICATED") {
    redirect("/giris");
  }

  const [entitySummary, opportunityPipeline, piiProtection, history] = access.ok
    ? await Promise.all([
        getWorkspaceEntitySummary(access.workspace.id),
        getOpportunityPipeline(access.workspace.id),
        getPiiProtectionStatus(),
        getWorkspaceHistory(access.workspace.id, access.membership.role),
      ])
    : [null, null, null, null];

  return (
    <main className="min-h-dvh px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand)] text-sm font-black text-white"
            >
              PR
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold text-[var(--ink)]">
                Portföy Radar
              </p>
              <p className="truncate text-xs font-medium text-[var(--muted)]">
                Güvenli çalışma alanı
              </p>
            </div>
          </div>
          <SignOutForm />
        </header>

        {!access.ok && access.error.code === "WORKSPACE_REQUIRED" ? (
          <section className="mt-8 rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_24px_70px_rgba(18,37,29,0.12)] backdrop-blur sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
              İlk kurulum
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--ink)]">
              Çalışma alanını oluştur
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
              İlanlar, kişiler ve fırsatlar bu sınır içinde izole edilecek. Adı daha
              sonra owner yetkisiyle değiştirebilirsiniz.
            </p>
            <WorkspaceSetupForm />
          </section>
        ) : null}

        {!access.ok && access.error.code === "WORKSPACE_SERVICE_UNAVAILABLE" ? (
          <section
            className="mt-8 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-amber-950 sm:p-8"
            role="alert"
          >
            <h1 className="text-2xl font-black tracking-[-0.04em]">
              Çalışma alanı yüklenemedi
            </h1>
            <p className="mt-3 text-sm leading-6">{access.error.message}</p>
          </section>
        ) : null}

        {!access.ok && access.error.code === "FORBIDDEN" ? (
          <section
            className="mt-8 rounded-[2rem] border border-red-200 bg-red-50 p-5 text-red-900 sm:p-8"
            role="alert"
          >
            <h1 className="text-2xl font-black tracking-[-0.04em]">Erişim reddedildi</h1>
            <p className="mt-3 text-sm leading-6">{access.error.message}</p>
          </section>
        ) : null}

        {access.ok ? (
          <section className="mt-8 overflow-hidden rounded-[2rem] bg-[var(--ink)] p-5 text-white shadow-[0_24px_70px_rgba(18,37,29,0.15)] sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
                  Aktif çalışma alanı
                </p>
                <h1 className="mt-2 break-words text-3xl font-black tracking-[-0.05em]">
                  {access.workspace.name}
                </h1>
              </div>
              <span className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold">
                {roleLabels[access.membership.role]}
              </span>
            </div>

            {entitySummary?.ok ? (
              <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.07] p-5">
                <div>
                  <h2 className="text-lg font-extrabold">Kayıt özeti</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
                    Kişi, gayrimenkul ve ilan kayıtları birbirinden ayrı izlenir.
                  </p>
                </div>

                <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    ["Kişi", entitySummary.data.contacts],
                    ["Gayrimenkul", entitySummary.data.properties],
                    ["İlan", entitySummary.data.listings],
                  ].map(([label, count]) => (
                    <div
                      className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-4"
                      key={label}
                    >
                      <dt className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">
                        {label}
                      </dt>
                      <dd className="mt-2 text-3xl font-black tabular-nums">
                        {count}
                      </dd>
                    </div>
                  ))}
                </dl>

                {entitySummary.data.contacts +
                  entitySummary.data.properties +
                  entitySummary.data.listings ===
                0 ? (
                  <p className="mt-5 rounded-2xl bg-white/[0.08] px-4 py-3 text-sm leading-6 text-white/70">
                    Henüz kişi, gayrimenkul veya ilan kaydı yok.
                  </p>
                ) : null}
              </div>
            ) : null}

            {entitySummary && !entitySummary.ok ? (
              <div
                className="mt-8 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-5 text-amber-50"
                role="alert"
              >
                <h2 className="text-lg font-extrabold">Kayıt özeti yüklenemedi</h2>
                <p className="mt-2 text-sm leading-6 text-amber-50/75">
                  {entitySummary.error.message}
                </p>
              </div>
            ) : null}

            {opportunityPipeline ? (
              <OpportunityPipeline result={opportunityPipeline} />
            ) : null}

            {piiProtection ? (
              <PiiProtectionStatusCard result={piiProtection} />
            ) : null}

            {history ? <HistoryPanel result={history} /> : null}

            <div className="mt-4 rounded-3xl bg-white p-5 text-[var(--ink)]">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
                Yetkili ayar
              </p>
              <h2 className="mt-2 text-lg font-extrabold">Çalışma alanı adı</h2>
              {access.membership.role === "owner" ? (
                <>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Bu ayarı yalnızca çalışma alanı sahibi değiştirebilir. Yetkiniz
                    her kayıtta yeniden kontrol edilir.
                  </p>
                  <WorkspaceRenameForm currentName={access.workspace.name} />
                </>
              ) : (
                <p className="mt-2 rounded-2xl bg-[var(--brand-soft)] px-4 py-3 text-sm leading-6 text-[var(--brand)]">
                  Bu alanı yalnızca çalışma alanı sahibi değiştirebilir.
                </p>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
