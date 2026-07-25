import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const environmentPath = path.join(process.cwd(), ".env.local");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readEnvironment() {
  let source;

  try {
    source = readFileSync(environmentPath, "utf8");
  } catch {
    fail(
      ".env.local okunamadı. Önce `pnpm supabase:env` komutunu çalıştırın.",
    );
  }

  const values = new Map();

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);

    if (match) {
      values.set(match[1], match[2]);
    }
  }

  return values;
}

function validateLocalUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    fail("Yerel Supabase adresi geçerli bir URL değil.");
  }

  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

  if (url.protocol !== "http:" || !loopbackHosts.has(url.hostname)) {
    fail(
      "Doğrulama güvenlik nedeniyle yalnızca yerel HTTP Supabase adresinde çalışır.",
    );
  }

  return url;
}

const environment = readEnvironment();
const urlValue = environment.get("SUPABASE_URL");
const publishableKey = environment.get("SUPABASE_PUBLISHABLE_KEY");

if (!urlValue || !publishableKey || publishableKey.length < 20) {
  fail(
    "Yerel Supabase bağlantısı eksik. `pnpm supabase:env` komutunu yeniden çalıştırın.",
  );
}

const baseUrl = validateLocalUrl(urlValue);
const headers = {
  apikey: publishableKey,
  authorization: `Bearer ${publishableKey}`,
};
const safeContractUrl = new URL("/rest/v1/app_public_config", baseUrl);
safeContractUrl.searchParams.set(
  "select",
  "schema_version,locale,time_zone,default_currency",
);

let safeResponse;

try {
  safeResponse = await fetch(safeContractUrl, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
} catch {
  fail(
    "Yerel Supabase REST servisine ulaşılamadı. Servislerin çalıştığını kontrol edin.",
  );
}

if (!safeResponse.ok) {
  fail("Yerel Supabase güvenli yapılandırma okumasını reddetti.");
}

let rows;

try {
  rows = await safeResponse.json();
} catch {
  fail("Yerel Supabase beklenen JSON yanıtını döndürmedi.");
}

const contract =
  Array.isArray(rows) && rows.length === 1 ? rows[0] : undefined;
const contractIsValid =
  contract?.schema_version === 1 &&
  contract?.locale === "tr-TR" &&
  contract?.time_zone === "Europe/Istanbul" &&
  contract?.default_currency === "TRY";

if (!contractIsValid) {
  fail("Yerel Supabase şema sözleşmesi beklenen değerlerle uyuşmuyor.");
}

const protectedColumnUrl = new URL("/rest/v1/app_public_config", baseUrl);
protectedColumnUrl.searchParams.set("select", "updated_at");

let protectedResponse;

try {
  protectedResponse = await fetch(protectedColumnUrl, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
} catch {
  fail("Korumalı sütun erişim kontrolü tamamlanamadı.");
}

if (protectedResponse.ok) {
  fail("Korumalı yapılandırma sütunu anonim REST rolüne açık.");
}

process.stdout.write(
  "Yerel Supabase REST bağlantısı ve sütun yetkilendirmesi doğrulandı.\n",
);
