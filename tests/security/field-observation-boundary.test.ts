// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

describe("hassas saha verisi güvenlik sınırı", () => {
  it("service worker yalnız sabit offline allowlist'ini cache'ler", () => {
    const worker = read("public/sw.js");

    expect(worker).not.toContain("field-observations");
    expect(worker).not.toContain("/workspace/ekle/saha");
    expect(worker).not.toContain("/api/workspace");
    expect(worker).not.toContain("indexedDB");
  });

  it("kamera ve konum yalnız saha route'unda self için açılır", () => {
    const proxy = read("src/proxy.ts");
    const config = read("next.config.ts");

    expect(config).toContain("camera=(), microphone=(), geolocation=()");
    expect(proxy).toContain('startsWith("/workspace/ekle/saha")');
    expect(proxy).toContain(
      "camera=(self), microphone=(), geolocation=(self)",
    );
    expect(proxy).toContain("private, no-store");
  });

  it("live modu release-v2 kanıtları onaylanmadan açılamaz", () => {
    const mode = read("src/server/field-observations/mode.ts");

    expect(mode).toContain("hasApprovedLivePiiEvidence");
    expect(mode).toContain("release-v2 kanıtları tamamlanmadan açılamaz");
  });

  it("fotoğraf signed/public URL vermeden no-store uygulama route'undan açılır", () => {
    const photoRoute = read(
      "src/app/api/workspace/field-observations/[observationId]/photo/route.ts",
    );
    const config = read("next.config.ts");
    const detailPage = read(
      "src/app/workspace/ekle/saha/[observationId]/page.tsx",
    );

    expect(photoRoute).toContain('"Cache-Control": "private, no-store');
    expect(photoRoute).not.toContain("createSignedUrl");
    expect(config).toContain(
      "/api/workspace/field-observations/:observationId/photo",
    );
    expect(config).toContain(
      "/api/workspace/field-observations/:observationId/maps",
    );
    expect(config.match(/value: "no-referrer"/g)).toHaveLength(2);
    expect(detailPage).toContain("/api/workspace/field-observations/");
  });

  it("yedek workflow'u yalnız age ciphertext artifact'ı 30 gün tutar", () => {
    const workflow = read(
      ".github/workflows/encrypted-production-backup.yml",
    );
    const backupScript = read(
      "scripts/create-encrypted-production-backup.mjs",
    );

    expect(workflow).toContain("retention-days: 30");
    expect(workflow).toContain("portfoy-radar-production.tar.age");
    expect(workflow).toContain("postgresql-client-17");
    expect(workflow).toContain(
      'echo "/usr/lib/postgresql/17/bin" >> "$GITHUB_PATH"',
    );
    expect(workflow).toContain(
      "/usr/lib/postgresql/17/bin/pg_dump --version",
    );
    expect(workflow).not.toContain("AGE_BACKUP_IDENTITY");
    expect(backupScript).toContain('"age"');
    expect(backupScript).toContain("manifest.json");
    expect(backupScript).not.toContain("console.log");
  });
});
