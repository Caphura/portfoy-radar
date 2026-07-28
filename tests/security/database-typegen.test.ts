// @vitest-environment node

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const typegenScript = path.join(
  repositoryRoot,
  "scripts/generate-database-types.mjs",
);
const temporaryDirectories: string[] = [];
const generatedTypes =
  "export type Database = { public: Record<string, never> };";
const originalTypes = "export type Database = { original: true };";

function createTestRepository() {
  const directory = mkdtempSync(path.join(tmpdir(), "portfoy-typegen-"));
  const executableDirectory = path.join(directory, "node_modules/.bin");
  const typeDirectory = path.join(directory, "src/types");
  const executablePath = path.join(executableDirectory, "supabase");
  const statePath = path.join(directory, "attempts.txt");
  const outputPath = path.join(typeDirectory, "database.generated.ts");

  temporaryDirectories.push(directory);
  mkdirSync(executableDirectory, { recursive: true });
  mkdirSync(typeDirectory, { recursive: true });
  writeFileSync(outputPath, `${originalTypes}\n`, "utf8");
  writeFileSync(
    executablePath,
    `#!/usr/bin/env node
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const statePath = process.env.TYPEGEN_TEST_STATE_PATH;
const previous = existsSync(statePath)
  ? Number.parseInt(readFileSync(statePath, "utf8"), 10)
  : 0;
const attempt = previous + 1;
writeFileSync(statePath, String(attempt), "utf8");

if (process.env.TYPEGEN_TEST_MODE === "persistent") {
  process.stderr.write(
    "connection failed: postgresql://postgres:database-secret@127.0.0.1:5432/postgres " +
      "sb_secret_private-value " +
      "eyJhbGciOiJIUzI1NiJ9.c2VjcmV0.c2lnbmF0dXJl\\n",
  );
  process.exit(1);
}

if (process.env.TYPEGEN_TEST_MODE === "transient" && attempt < 3) {
  process.stderr.write("temporary Docker connection failure\\n");
  process.exit(1);
}

process.stdout.write(${JSON.stringify(`${generatedTypes}\n`)});
`,
    "utf8",
  );
  chmodSync(executablePath, 0o755);

  return { directory, outputPath, statePath, typeDirectory };
}

function runTypegen(
  directory: string,
  statePath: string,
  mode: "success" | "transient" | "persistent",
) {
  return spawnSync(process.execPath, [typegenScript], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      PORTFOY_TYPEGEN_RETRY_DELAY_MS: "0",
      TYPEGEN_TEST_MODE: mode,
      TYPEGEN_TEST_STATE_PATH: statePath,
    },
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("veritabanı tip üretimi", () => {
  it("ilk başarılı çıktıyı atomik olarak yazar", () => {
    const testRepository = createTestRepository();
    const result = runTypegen(
      testRepository.directory,
      testRepository.statePath,
      "success",
    );

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(testRepository.statePath, "utf8")).toBe("1");
    expect(readFileSync(testRepository.outputPath, "utf8")).toBe(
      `${generatedTypes}\n`,
    );
    expect(result.stdout).toContain("TypeScript tipleri güncellendi");
    expect(result.stderr).toBe("");
    expect(readdirSync(testRepository.typeDirectory)).toEqual([
      "database.generated.ts",
    ]);
  });

  it("geçici hatalardan sonra en fazla üç denemede toparlanır", () => {
    const testRepository = createTestRepository();
    const result = runTypegen(
      testRepository.directory,
      testRepository.statePath,
      "transient",
    );

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(testRepository.statePath, "utf8")).toBe("3");
    expect(readFileSync(testRepository.outputPath, "utf8")).toBe(
      `${generatedTypes}\n`,
    );
    expect(result.stderr.match(/yeniden deneniyor/g)).toHaveLength(2);
    expect(result.stderr).not.toContain("temporary Docker connection failure");
  });

  it("kalıcı hatada mevcut dosyayı korur ve hassas tanıyı redakte eder", () => {
    const testRepository = createTestRepository();
    const result = runTypegen(
      testRepository.directory,
      testRepository.statePath,
      "persistent",
    );

    expect(result.status).toBe(1);
    expect(readFileSync(testRepository.statePath, "utf8")).toBe("3");
    expect(readFileSync(testRepository.outputPath, "utf8")).toBe(
      `${originalTypes}\n`,
    );
    expect(result.stderr).toContain("3 denemede üretilemedi");
    expect(result.stderr).toContain("[REDACTED]");
    expect(result.stderr).toContain("[REDACTED_SUPABASE_KEY]");
    expect(result.stderr).toContain("[REDACTED_JWT]");
    expect(result.stderr).not.toContain("database-secret");
    expect(result.stderr).not.toContain("sb_secret_private-value");
    expect(result.stderr).not.toContain("c2VjcmV0");
    expect(readdirSync(testRepository.typeDirectory)).toEqual([
      "database.generated.ts",
    ]);
  });
});
