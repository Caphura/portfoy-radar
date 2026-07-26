// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const sourceRoot = path.join(repositoryRoot, "src");

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    return entry.isDirectory() ? collectSourceFiles(entryPath) : [entryPath];
  });
}

describe("istemci secret sınırı", () => {
  it("uygulama kaynaklarında service-role veya secret anahtar değeri taşımaz", () => {
    const source = collectSourceFiles(sourceRoot)
      .filter((filePath) => /\.(?:ts|tsx)$/.test(filePath))
      .map((filePath) => readFileSync(filePath, "utf8"))
      .join("\n");

    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("SUPABASE_SECRET_KEY");
    expect(source).not.toMatch(/\bsb_secret_[A-Za-z0-9_-]+\b/);
    expect(source).not.toContain("NEXT_PUBLIC_PII");
  });

  it("istemci bileşenleri PII anahtar kasasını veya Node kriptosunu içe aktarmaz", () => {
    const clientModules = collectSourceFiles(sourceRoot)
      .filter((filePath) => /\.(?:ts|tsx)$/.test(filePath))
      .map((filePath) => readFileSync(filePath, "utf8"))
      .filter((source) => /^\s*["']use client["'];/m.test(source))
      .join("\n");

    expect(clientModules).not.toContain("@/server/pii");
    expect(clientModules).not.toContain("node:crypto");
    expect(clientModules).not.toContain("PII_ENCRYPTION_KEYRING");
    expect(clientModules).not.toContain("PII_PHONE_HMAC_KEYRING");
  });

  it("örnek ortam dosyasında PII anahtar değeri bulunmaz", () => {
    const exampleEnvironment = readFileSync(
      path.join(repositoryRoot, ".env.example"),
      "utf8",
    );

    expect(exampleEnvironment).toMatch(/^PII_ENCRYPTION_KEYRING=$/m);
    expect(exampleEnvironment).toMatch(/^PII_PHONE_HMAC_KEYRING=$/m);
  });
});
