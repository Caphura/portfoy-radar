import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const environmentPath = path.join(repositoryRoot, ".env.local");
const temporaryPath = `${environmentPath}.tmp`;
const supabaseExecutable = path.join(
  repositoryRoot,
  "node_modules",
  ".bin",
  "supabase",
);

const status = spawnSync(supabaseExecutable, ["status", "-o", "env"], {
  cwd: repositoryRoot,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (status.status !== 0) {
  process.stderr.write(
    "Yerel Supabase çalışmıyor. Önce `pnpm supabase:start` komutunu çalıştırın.\n",
  );
  process.exit(1);
}

const sourceValues = new Map();

for (const line of status.stdout.split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(?:"(.*)"|(.*))$/);

  if (!match) {
    continue;
  }

  sourceValues.set(match[1], match[2] ?? match[3] ?? "");
}

const apiUrl = sourceValues.get("API_URL");
const publishableKey =
  sourceValues.get("PUBLISHABLE_KEY") ?? sourceValues.get("ANON_KEY");

if (!apiUrl || !publishableKey) {
  process.stderr.write(
    "Supabase durumu gerekli yerel bağlantı değerlerini döndürmedi.\n",
  );
  process.exit(1);
}

const replacements = new Map([
  ["SUPABASE_URL", apiUrl],
  ["SUPABASE_PUBLISHABLE_KEY", publishableKey],
]);

const existing = existsSync(environmentPath)
  ? readFileSync(environmentPath, "utf8")
  : "";
const outputLines = [];
const replacedKeys = new Set();

for (const line of existing.split(/\r?\n/)) {
  const key = line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1];

  if (key && replacements.has(key)) {
    outputLines.push(`${key}=${replacements.get(key)}`);
    replacedKeys.add(key);
    continue;
  }

  if (line.length > 0 || outputLines.length > 0) {
    outputLines.push(line);
  }
}

if (outputLines.length > 0 && outputLines.at(-1) !== "") {
  outputLines.push("");
}

for (const [key, value] of replacements) {
  if (!replacedKeys.has(key)) {
    outputLines.push(`${key}=${value}`);
  }
}

writeFileSync(temporaryPath, `${outputLines.join("\n").replace(/\n+$/, "")}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
renameSync(temporaryPath, environmentPath);

process.stdout.write(
  "Yerel Supabase bağlantı değişkenleri .env.local dosyasına güvenli biçimde yazıldı.\n",
);
