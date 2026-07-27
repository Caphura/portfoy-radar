// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const readRepositoryFile = (relativePath: string) =>
  readFileSync(path.join(repositoryRoot, relativePath), "utf8");

describe("güvenlik ve release kapısı", () => {
  it("statik release sınırı denetimini başarıyla çalıştırır", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-release-boundary.mjs"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Release sınırı doğrulandı");
  });

  it("canlı PII yayınını eksik kanıtlarda bilinçli olarak reddeder", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/assert-live-pii-release.mjs"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Canlı PII yayın kapısı kapalı");
    expect(result.stderr).not.toMatch(/(?:\+90|0)5\d{9}/);
    expect(result.stderr).not.toMatch(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    );
  });

  it("CI workflow'unu salt okunur ve kilitli bağımlılık kurulumu ile sınırlar", () => {
    const workflow = readRepositoryFile(
      ".github/workflows/security-release-gate.yml",
    );

    expect(workflow).toMatch(/^permissions:\s*\n\s+contents: read$/m);
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm release:verify");
    expect(workflow).toContain("pnpm release:assert-live-pii");
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toContain("${{ secrets.");

    const actionReferences = [
      ...workflow.matchAll(/^\s+uses:\s+\S+@([^\s#]+)/gm),
    ]
      .map((match) => match[1])
      .filter((reference): reference is string => typeof reference === "string");

    expect(actionReferences).toHaveLength(6);
    expect(
      actionReferences.every((reference) => /^[a-f0-9]{40}$/.test(reference)),
    ).toBe(true);
  });

  it("audit yamalarını transitif bağımlılıklar için sabitler", () => {
    const packageJson = JSON.parse(readRepositoryFile("package.json"));
    const workspaceConfiguration = readRepositoryFile("pnpm-workspace.yaml");

    expect(workspaceConfiguration).toMatch(
      /^overrides:\s*\n\s+postcss: 8\.5\.23\s*\n\s+sharp: 0\.35\.3$/m,
    );
    expect(packageJson.scripts?.["audit:prod"]).toBe(
      "pnpm audit --prod --audit-level moderate",
    );
  });
});
