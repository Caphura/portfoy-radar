import type { ReactNode } from "react";

import { logoutAction } from "@/features/auth/actions";
import type { WorkspaceRole } from "@/server/workspace/roles";

import { AppNavigation } from "./app-navigation";

const roleLabels: Record<WorkspaceRole, string> = {
  owner: "Sahip",
  advisor: "Danışman",
  viewer: "Görüntüleyici",
};

type AppShellProps = {
  children: ReactNode;
  role: WorkspaceRole;
  workspaceName: string;
};

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand)] text-sm font-black tracking-[-0.04em] text-white shadow-[0_8px_24px_rgba(24,93,69,0.2)] lg:bg-white lg:text-[var(--brand)]"
    >
      PR
    </span>
  );
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <button
        className={
          compact
            ? "min-h-11 rounded-2xl border border-[var(--line)] bg-white px-3 text-xs font-extrabold text-[var(--ink)] transition hover:bg-[var(--brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            : "min-h-11 w-full rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-extrabold text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        }
        type="submit"
      >
        {compact ? "Çıkış" : "Güvenli çıkış"}
      </button>
    </form>
  );
}

export function AppShell({ children, role, workspaceName }: AppShellProps) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <a
        className="sr-only z-[60] rounded-xl bg-white px-4 py-3 font-bold text-[var(--ink)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        href="#ana-icerik"
      >
        Ana içeriğe geç
      </a>

      <aside className="hidden h-dvh flex-col bg-[var(--ink)] px-4 py-5 text-white lg:sticky lg:top-0 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <BrandMark />
          <div className="min-w-0">
            <p className="truncate text-base font-black tracking-[-0.02em]">
              Portföy Radar
            </p>
            <p className="text-xs font-semibold text-white/50">FSBO takip merkezi</p>
          </div>
        </div>

        <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.07] p-3">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-emerald-300">
            Çalışma alanı
          </p>
          <p className="mt-2 truncate text-sm font-extrabold" title={workspaceName}>
            {workspaceName}
          </p>
          <p className="mt-1 text-xs font-semibold text-white/50">{roleLabels[role]}</p>
        </div>

        <div className="mt-7">
          <AppNavigation placement="desktop" />
        </div>

        <div className="mt-auto pt-5">
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex min-h-[4.5rem] items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--canvas)]/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[var(--ink)]">
                {workspaceName}
              </p>
              <p className="truncate text-xs font-semibold text-[var(--muted)]">
                {roleLabels[role]} · Portföy Radar
              </p>
            </div>
          </div>
          <SignOutButton compact />
        </header>

        <main
          className="app-shell-content min-h-[calc(100dvh-4.5rem)]"
          id="ana-icerik"
          tabIndex={-1}
        >
          {children}
        </main>

        <AppNavigation placement="mobile" />
      </div>
    </div>
  );
}
