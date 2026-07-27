import { randomBytes } from "node:crypto";
import {
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const environmentPath = path.join(repositoryRoot, ".env.local");
const temporaryPath = `${environmentPath}.pii.tmp`;
const piiKeyNames = [
  "PII_ENCRYPTION_KEYRING",
  "PII_ACTIVE_ENCRYPTION_KEY_VERSION",
  "PII_PHONE_HMAC_KEYRING",
  "PII_ACTIVE_PHONE_HMAC_KEY_VERSION",
];
const mediaKeyNames = [
  "MEDIA_ENCRYPTION_KEYRING",
  "MEDIA_ACTIVE_ENCRYPTION_KEY_VERSION",
];

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const existing = existsSync(environmentPath)
  ? readFileSync(environmentPath, "utf8")
  : "";
const existingValues = new Map();

for (const line of existing.split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);

  if (match) {
    existingValues.set(match[1], match[2]);
  }
}

const configuredPiiCount = piiKeyNames.filter(
  (key) => (existingValues.get(key) ?? "").length > 0,
).length;
const configuredMediaCount = mediaKeyNames.filter(
  (key) => (existingValues.get(key) ?? "").length > 0,
).length;

if (
  configuredPiiCount === piiKeyNames.length &&
  configuredMediaCount === mediaKeyNames.length
) {
  process.stdout.write(
    "Yerel PII anahtarları zaten yapılandırılmış; mevcut sürümler korundu.\n",
  );
  process.exit(0);
}

if (
  (configuredPiiCount > 0 && configuredPiiCount < piiKeyNames.length) ||
  (configuredMediaCount > 0 && configuredMediaCount < mediaKeyNames.length)
) {
  fail(
    "PII anahtar yapılandırması eksik. Kısmi değerleri güvenli biçimde tamamlayın veya kaldırıp yeniden deneyin.",
  );
}

const replacements = new Map();

if (configuredPiiCount === 0) {
  replacements.set(
    "PII_ENCRYPTION_KEYRING",
    JSON.stringify({ 1: randomBytes(32).toString("base64") }),
  );
  replacements.set("PII_ACTIVE_ENCRYPTION_KEY_VERSION", "1");
  replacements.set(
    "PII_PHONE_HMAC_KEYRING",
    JSON.stringify({ 1: randomBytes(32).toString("base64") }),
  );
  replacements.set("PII_ACTIVE_PHONE_HMAC_KEY_VERSION", "1");
}

if (configuredMediaCount === 0) {
  replacements.set(
    "MEDIA_ENCRYPTION_KEYRING",
    JSON.stringify({ 1: randomBytes(32).toString("base64") }),
  );
  replacements.set("MEDIA_ACTIVE_ENCRYPTION_KEY_VERSION", "1");
}
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

writeFileSync(
  temporaryPath,
  `${outputLines.join("\n").replace(/\n+$/, "")}\n`,
  {
    encoding: "utf8",
    mode: 0o600,
  },
);
renameSync(temporaryPath, environmentPath);

process.stdout.write(
  "Yerel PII ve medya anahtarları .env.local dosyasına güvenli biçimde yazıldı; mevcut sürümler korundu ve değerler gösterilmedi.\n",
);
