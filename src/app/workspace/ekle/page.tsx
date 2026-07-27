import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CsvImportExportPanel } from "@/features/csv/csv-import-export-panel";
import { QuickFsboForm } from "@/features/fsbo/quick-fsbo-form";
import { defaultQuickFsboNextActionAt } from "@/features/fsbo/quick-fsbo-validation";
import { getWorkspaceAccess } from "@/server/workspace/access";

export const metadata: Metadata = {
  title: "Hızlı FSBO ekle",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AddPage() {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });

  if (!access.ok && access.error.code === "UNAUTHENTICATED") {
    redirect("/giris");
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
          Yeni kayıt
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--ink)] sm:text-4xl">
          Hızlı FSBO ekle
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Sahibinden ilanı güvenli biçimde fırsata dönüştürün. Açık fırsat sonraki
          arama planı olmadan kaydedilmez.
        </p>
      </header>

      {access.ok ? (
        <>
          <section
            aria-label="Kayıt türü"
            className="mb-6 grid gap-3 sm:grid-cols-2"
          >
            <a
              className="rounded-3xl border-2 border-[var(--brand)] bg-emerald-50 p-5"
              href="#hizli-fsbo"
            >
              <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand)]">
                Portal ilanı
              </span>
              <span className="mt-2 block text-xl font-black">
                Hızlı FSBO
              </span>
              <span className="mt-1 block text-sm leading-6 text-[var(--muted)]">
                İlan numarası ve bağlantıyla fırsat oluşturun.
              </span>
            </a>
            <Link
              className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[0_8px_24px_rgba(18,37,29,0.05)]"
              href="/workspace/ekle/saha"
            >
              <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand)]">
                Fiziksel tabela
              </span>
              <span className="mt-2 block text-xl font-black">
                Saha kaydı
              </span>
              <span className="mt-1 block text-sm leading-6 text-[var(--muted)]">
                Fotoğrafı ve isteğe bağlı konumu güvenle saklayın.
              </span>
            </Link>
          </section>
          <div id="hizli-fsbo">
          <QuickFsboForm
            defaultNextActionAt={defaultQuickFsboNextActionAt()}
          />
          </div>
          <CsvImportExportPanel />
        </>
      ) : (
        <section
          className={`rounded-3xl border p-5 ${
            access.error.code === "FORBIDDEN"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
          role="alert"
        >
          <h2 className="text-lg font-black">
            {access.error.code === "FORBIDDEN"
              ? "Kayıt yetkiniz bulunmuyor"
              : "Hızlı ekleme kullanılamıyor"}
          </h2>
          <p className="mt-2 text-sm leading-6">
            {access.error.code === "FORBIDDEN"
              ? "FSBO fırsatını yalnızca çalışma alanı sahibi veya danışman oluşturabilir."
              : access.error.message}
          </p>
        </section>
      )}
    </div>
  );
}
