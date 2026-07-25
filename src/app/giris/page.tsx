import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/login-form";
import { getCurrentUser } from "@/server/auth/get-current-user";

export const metadata: Metadata = {
  title: "Giriş",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LoginPageProps = {
  searchParams: Promise<{
    durum?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const currentUser = await getCurrentUser();
  const { durum } = await searchParams;

  if (currentUser.ok) {
    redirect("/workspace");
  }

  const serviceUnavailable =
    currentUser.error.code === "AUTH_SERVICE_UNAVAILABLE";
  const logoutFailed = durum === "cikis-hatasi";

  return (
    <main className="min-h-dvh px-4 py-5 sm:grid sm:place-items-center sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <Link
          className="inline-flex items-center gap-3 rounded-2xl text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]"
          href="/"
        >
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-2xl bg-[var(--brand)] text-sm font-black text-white"
          >
            PR
          </span>
          <span>
            <span className="block text-base font-extrabold">Portföy Radar</span>
            <span className="block text-xs font-medium text-[var(--muted)]">
              Güvenli danışman girişi
            </span>
          </span>
        </Link>

        <section className="mt-8 rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_24px_70px_rgba(18,37,29,0.12)] backdrop-blur sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
            Davetli erişimi
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--ink)]">
            Çalışma alanına gir
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Yalnızca davet edilmiş danışman hesapları giriş yapabilir. Herkese açık kayıt
            bulunmaz.
          </p>

          {serviceUnavailable || logoutFailed ? (
            <p
              className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
              role="alert"
            >
              {logoutFailed
                ? "Oturum güvenli biçimde kapatılamadı. Lütfen yeniden deneyin."
                : currentUser.error.message}
            </p>
          ) : null}

          <LoginForm />
        </section>

        <p className="px-4 py-5 text-center text-xs leading-5 text-[var(--muted)]">
          Oturum bilgileri güvenli cookie ile korunur ve yetki her istekte sunucuda
          doğrulanır.
        </p>
      </div>
    </main>
  );
}
