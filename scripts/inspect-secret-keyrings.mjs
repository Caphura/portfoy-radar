import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const envPath = process.argv[2] ?? ".env.local";

if (!existsSync(envPath)) {
  console.log(JSON.stringify({ exists: false, envPath }, null, 2));
  process.exit(0);
}

const env = {};

for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

  if (!match) {
    continue;
  }

  let value = match[2];
  const firstCharacter = value.at(0);
  const lastCharacter = value.at(-1);

  if (
    value.length >= 2 &&
    ((firstCharacter === '"' && lastCharacter === '"') ||
      (firstCharacter === "'" && lastCharacter === "'"))
  ) {
    value = value.slice(1, -1);
  }

  env[match[1]] = value;
}

function inspectKeyring(name) {
  try {
    const keyring = JSON.parse(env[name] ?? "{}");

    return Object.fromEntries(
      Object.entries(keyring).map(([version, key]) => [
        version,
        createHash("sha256")
          .update(String(key))
          .digest("hex")
          .slice(0, 16),
      ]),
    );
  } catch {
    return { invalid: true };
  }
}

let supabaseHost = null;

try {
  supabaseHost = new URL(env.SUPABASE_URL ?? "").host;
} catch {
  // Yalnız ana makine adı raporlanır; geçersiz veya eksik URL null kalır.
}

console.log(
  JSON.stringify(
    {
      exists: true,
      envPath,
      supabaseHost,
      pii: {
        active: env.PII_ACTIVE_ENCRYPTION_KEY_VERSION ?? null,
        versions: inspectKeyring("PII_ENCRYPTION_KEYRING"),
      },
      phoneHmac: {
        active: env.PII_ACTIVE_PHONE_HMAC_KEY_VERSION ?? null,
        versions: inspectKeyring("PII_PHONE_HMAC_KEYRING"),
      },
      media: {
        active: env.MEDIA_ACTIVE_ENCRYPTION_KEY_VERSION ?? null,
        versions: inspectKeyring("MEDIA_ENCRYPTION_KEYRING"),
      },
      serviceRolePresent: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      cronSecretPresent: Boolean(env.CRON_SECRET),
      fieldMode: env.FIELD_OBSERVATION_MODE ?? null,
    },
    null,
    2,
  ),
);
