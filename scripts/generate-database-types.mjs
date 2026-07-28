import { spawnSync } from "node:child_process";
import { renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_DIAGNOSTIC_LINES = 8;
const MAX_DIAGNOSTIC_LENGTH = 1_600;

const repositoryRoot = process.cwd();
const supabaseExecutable = path.join(
  repositoryRoot,
  "node_modules",
  ".bin",
  "supabase",
);
const outputPath = path.join(
  repositoryRoot,
  "src",
  "types",
  "database.generated.ts",
);
const temporaryOutputPath = `${outputPath}.tmp-${process.pid}`;

function readRetryDelay() {
  const configuredDelay = Number.parseInt(
    process.env.PORTFOY_TYPEGEN_RETRY_DELAY_MS ?? "",
    10,
  );

  if (
    Number.isSafeInteger(configuredDelay) &&
    configuredDelay >= 0 &&
    configuredDelay <= 5_000
  ) {
    return configuredDelay;
  }

  return DEFAULT_RETRY_DELAY_MS;
}

function wait(milliseconds) {
  if (milliseconds === 0) {
    return;
  }

  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(4)),
    0,
    0,
    milliseconds,
  );
}

function redactDiagnostic(value) {
  return value
    .replace(
      /\b(postgres(?:ql)?:\/\/[^:\s/@]+:)[^@\s/]+@/gi,
      "$1[REDACTED]@",
    )
    .replace(
      /\b(?:sb_(?:secret|publishable)_[A-Za-z0-9_-]+)\b/g,
      "[REDACTED_SUPABASE_KEY]",
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED_JWT]",
    )
    .replace(
      /\b((?:SUPABASE_[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)|DATABASE_URL)\s*[=:]\s*)\S+/gi,
      "$1[REDACTED]",
    )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-MAX_DIAGNOSTIC_LINES)
    .join("\n")
    .slice(-MAX_DIAGNOSTIC_LENGTH);
}

function diagnosticFor(result) {
  const details = [
    result.error instanceof Error ? result.error.message : "",
    typeof result.stderr === "string" ? result.stderr : "",
  ]
    .filter(Boolean)
    .join("\n");
  const redactedDetails = redactDiagnostic(details);

  if (redactedDetails) {
    return redactedDetails;
  }

  return `Supabase CLI çıkış kodu: ${result.status ?? "bilinmiyor"}`;
}

function writeTypesAtomically(types) {
  try {
    writeFileSync(temporaryOutputPath, `${types.trimEnd()}\n`, {
      encoding: "utf8",
      mode: 0o644,
    });
    renameSync(temporaryOutputPath, outputPath);
  } finally {
    rmSync(temporaryOutputPath, { force: true });
  }
}

const retryDelay = readRetryDelay();
let finalDiagnostic = "";
let generated = false;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const result = spawnSync(
    supabaseExecutable,
    ["gen", "types", "typescript", "--local", "--schema", "public"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const output = typeof result.stdout === "string" ? result.stdout.trim() : "";

  if (result.status === 0 && output) {
    writeTypesAtomically(output);
    generated = true;
    break;
  }

  finalDiagnostic = diagnosticFor(result);

  if (attempt < MAX_ATTEMPTS) {
    process.stderr.write(
      `Veritabanı tipi üretimi başarısız oldu; yeniden deneniyor (${attempt}/${MAX_ATTEMPTS}).\n`,
    );
    wait(retryDelay);
  }
}

if (!generated) {
  process.stderr.write(
    `Veritabanı tipleri ${MAX_ATTEMPTS} denemede üretilemedi.\n${finalDiagnostic}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write("Veritabanı TypeScript tipleri güncellendi.\n");
}
