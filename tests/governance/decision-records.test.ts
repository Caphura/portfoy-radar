// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const adrFiles = [
  "docs/adr/0001-modular-monolith-and-domain-boundaries.md",
  "docs/adr/0002-identity-authorization-and-data-access.md",
  "docs/adr/0003-locale-time-and-money.md",
  "docs/adr/0004-pii-and-duplicate-detection.md",
  "docs/adr/0005-opportunity-workflow-and-invariants.md",
  "docs/adr/0006-mvp-operational-decisions.md",
  "docs/adr/0007-field-observation-media-and-location.md",
] as const;

const businessRuleIds = Array.from(
  { length: 12 },
  (_, index) => `BR-${String(index + 1).padStart(2, "0")}`,
);

function readRepositoryFile(relativePath: string) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

describe("karar kayıtları", () => {
  it.each(adrFiles)("%s kabul edilmiş ve tam ADR yapısındadır", (relativePath) => {
    const absolutePath = path.join(repositoryRoot, relativePath);

    expect(existsSync(absolutePath)).toBe(true);

    const record = readRepositoryFile(relativePath);

    expect(record).toContain("- Durum: Kabul edildi");
    expect(record).toContain("## Bağlam");
    expect(record).toContain("## Karar");
    expect(record).toContain("## Sonuçlar");
    expect(record).toContain("## Doğrulama");
  });

  it("kişi, gayrimenkul, ilan ve fırsatı ayrı alan varlıkları olarak sabitler", () => {
    const domainDecision = readRepositoryFile(adrFiles[0]);

    for (const entity of ["contacts", "properties", "listings", "opportunities"]) {
      expect(domainDecision).toContain(`\`${entity}\``);
    }

    expect(domainDecision).toContain("aynı tablo veya kayıt");
  });
});

describe("iş kuralı izlenebilirliği", () => {
  const traceabilityPath = "docs/product/requirements-traceability.md";
  const traceability = readRepositoryFile(traceabilityPath);

  it("12 değişmez kuralın her birini tam bir kez içerir", () => {
    const allRuleRows = traceability
      .split("\n")
      .filter((line) => /^\| BR-\d{2} \|/.test(line));

    expect(allRuleRows).toHaveLength(12);

    for (const ruleId of businessRuleIds) {
      const matchingRows = allRuleRows.filter((line) => line.startsWith(`| ${ruleId} |`));

      expect(matchingRows, `${ruleId} tam bir kez bulunmalı`).toHaveLength(1);
    }
  });

  it("her kuralı arayüz, sunucu, veritabanı ve otomatik kanıta bağlar", () => {
    for (const ruleId of businessRuleIds) {
      const ruleRow = traceability
        .split("\n")
        .find((line) => line.startsWith(`| ${ruleId} |`));

      expect(ruleRow).toBeDefined();

      const cells = ruleRow
        ?.split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());

      expect(cells).toHaveLength(7);
      expect(cells?.slice(1, 6).every((cell) => cell.length > 0)).toBe(true);
      expect(["Planlandı", "Uygulandı"]).toContain(cells?.at(-1));

      if (cells?.at(-1) === "Uygulandı") {
        expect(cells.at(-2)).toMatch(/\[[^\]]+\]\([^)]+\)/);
      }
    }
  });
});

describe("tehdit modeli", () => {
  const threatModel = readRepositoryFile("docs/security/threat-model.md");

  it("altı STRIDE kategorisinin tamamını kapsar", () => {
    for (const category of [
      "Kimlik sahteciliği",
      "Veri tahrifi",
      "İnkâr etme",
      "Bilgi ifşası",
      "Hizmet engelleme",
      "Yetki yükseltme",
    ]) {
      expect(threatModel).toContain(category);
    }
  });

  it("yayın engellerinin kapatma ölçütü ve sahibi vardır", () => {
    const releaseBlockers = threatModel
      .split("\n")
      .filter(
        (line) =>
          line.startsWith("| Supabase Auth") ||
          line.startsWith("| Şifreleme/KMS") ||
          line.startsWith("| Üretim bölgesi") ||
          line.startsWith("| Yedekten dönüş") ||
          line.startsWith("| Hassas medya"),
      );

    expect(releaseBlockers).toHaveLength(5);

    for (const blocker of releaseBlockers) {
      const cells = blocker
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());

      expect(cells).toHaveLength(4);
      expect(cells.every((cell) => cell.length > 0)).toBe(true);
    }
  });

  it("belgelerde tamamlanmamış yer tutucu veya açık kişisel veri örneği bırakmaz", () => {
    const governanceDocuments = [
      ...adrFiles.map(readRepositoryFile),
      readRepositoryFile("docs/product/requirements-traceability.md"),
      threatModel,
    ].join("\n");

    expect(governanceDocuments).not.toMatch(/\b(?:TODO|TBD|FIXME|XXX)\b/);
    expect(governanceDocuments).not.toMatch(/(?:\+90|0)5\d{9}/);
    expect(governanceDocuments).not.toMatch(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    );
  });
});

describe("sentetik-only Production kararı", () => {
  const decisionPath =
    "docs/security/evidence/2026-07-28-synthetic-production-decision.md";
  const decision = readRepositoryFile(decisionPath);
  const releasePolicy = JSON.parse(
    readRepositoryFile("config/release-policy.json"),
  ) as {
    manualGates: Array<{ id: string; status: string }>;
  };

  it("gerçek veriyi yasaklar ve KVKK kapısını açık tutar", () => {
    expect(decision).toContain("OPS-2026-07-28-SYNTHETIC-ONLY");
    expect(decision).toContain("Gerçek veya belirlenebilir kişilere ait");
    expect(decision).toContain("`FIELD_OBSERVATION_MODE=disabled`");
    expect(decision).toContain("data-region-kvkk` onaylanamaz");

    expect(
      releasePolicy.manualGates.find(
        (gate) => gate.id === "data-region-kvkk",
      )?.status,
    ).toBe("open");
  });

  it("yerel, Preview ve Production ortam sınırlarını ayrı kaydeder", () => {
    for (const environment of ["Local", "Preview", "Production"]) {
      expect(decision).toContain(`| ${environment} |`);
    }

    expect(decision).toContain("`synthetic`");
    expect(decision.match(/`disabled`/g)).toHaveLength(2);
  });
});

describe("Production yedekleme ve geri yükleme kanıtı", () => {
  const evidencePath =
    "docs/security/evidence/2026-07-28-production-backup-restore-drill.md";
  const evidence = readRepositoryFile(evidencePath);
  const releasePolicy = JSON.parse(
    readRepositoryFile("config/release-policy.json"),
  ) as {
    manualGates: Array<{
      id: string;
      status: string;
      evidence?: { reference?: string };
    }>;
  };

  it("backup-restore kapısını ölçülmüş kanıt referansıyla onaylar", () => {
    const backupGate = releasePolicy.manualGates.find(
      (gate) => gate.id === "backup-restore",
    );

    expect(backupGate?.status).toBe("approved");
    expect(backupGate?.evidence?.reference).toBe(
      "OPS-2026-07-28-BACKUP-RESTORE",
    );
    expect(evidence).toContain("30346632246");
    expect(evidence).toContain("37 tablo/metadata metriğinin tamamı");
    expect(evidence).toMatch(/fark\s+sayısı sıfırdır/);
    expect(evidence).toContain("Artifact saklama: GitHub metadata'sıyla 30 gün");
    expect(evidence).toContain("`--network none`");
  });

  it("non-empty medya kanıtı yokken hassas medya kapısını açık tutar", () => {
    expect(evidence).toContain("Manifestte Storage nesnesi | 0");
    expect(evidence).toContain("`sensitive-media-location`");
    expect(
      releasePolicy.manualGates.find(
        (gate) => gate.id === "sensitive-media-location",
      )?.status,
    ).toBe("open");
  });
});
