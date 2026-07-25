import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

function fail(message) {
  throw new Error(message);
}

export function getLocalSupabaseSettings() {
  const repositoryRoot = process.cwd();
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
    fail("Yerel Supabase çalışmıyor.");
  }

  const values = new Map();

  for (const line of status.stdout.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(?:"(.*)"|(.*))$/);

    if (match) {
      values.set(match[1], match[2] ?? match[3] ?? "");
    }
  }

  const url = values.get("API_URL");
  const publishableKey =
    values.get("PUBLISHABLE_KEY") ?? values.get("ANON_KEY");
  const secretKey =
    values.get("SECRET_KEY") ?? values.get("SERVICE_ROLE_KEY");

  if (!url || !publishableKey || !secretKey) {
    fail("Yerel Supabase yönetim bağlantısı eksik.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    fail("Yerel Supabase adresi geçersiz.");
  }

  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

  if (
    parsedUrl.protocol !== "http:" ||
    !loopbackHosts.has(parsedUrl.hostname)
  ) {
    fail("Bu komut güvenlik nedeniyle yalnızca yerel Supabase ile çalışır.");
  }

  return {
    url,
    publishableKey,
    secretKey,
  };
}
