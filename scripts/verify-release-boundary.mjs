import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";

const repositoryUrl = new URL("../", import.meta.url);
const readRepositoryFile = (relativePath) =>
  readFileSync(new URL(relativePath, repositoryUrl), "utf8");
const failures = [];
const verify = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};

const packageJson = JSON.parse(readRepositoryFile("package.json"));
const productionDependencies = Object.keys(packageJson.dependencies ?? {});
const forbiddenProductionDependencies = [
  "twilio",
  "whatsapp-web.js",
  "puppeteer",
  "playwright",
  "selenium-webdriver",
  "cheerio",
];

for (const dependency of forbiddenProductionDependencies) {
  verify(
    !productionDependencies.includes(dependency),
    `Yasaklı üretim kabiliyeti bağımlılığı bulundu: ${dependency}`,
  );
}

for (const scriptName of [
  "check",
  "db:verify",
  "security:verify",
  "release:verify",
  "release:assert-live-pii",
]) {
  verify(
    typeof packageJson.scripts?.[scriptName] === "string",
    `Zorunlu kalite komutu eksik: ${scriptName}`,
  );
}

verify(
  packageJson.scripts?.check ===
    "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
  "Uygulama kalite kapısı lint, tip, test ve üretim derlemesini birlikte çalıştırmalıdır.",
);
verify(
  packageJson.scripts?.["release:verify"]?.includes("pnpm db:verify"),
  "Release kapısı temiz migration, pgTAP ve RLS doğrulamasını içermelidir.",
);
verify(
  packageJson.scripts?.["release:verify"]?.includes("pnpm audit:prod"),
  "Release kapısı üretim bağımlılığı denetimini içermelidir.",
);
const pnpmWorkspace = readRepositoryFile("pnpm-workspace.yaml");
verify(
  /^overrides:\s*\n\s+postcss: 8\.5\.23\s*\n\s+sharp: 0\.35\.3$/m.test(
    pnpmWorkspace,
  ),
  "Audit yamaları pnpm workspace override'larında sabitlenmelidir.",
);

const exampleEnvironment = readRepositoryFile(".env.example");
for (const variableName of [
  "SUPABASE_PUBLISHABLE_KEY",
  "PII_ENCRYPTION_KEYRING",
  "PII_PHONE_HMAC_KEYRING",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MEDIA_ENCRYPTION_KEYRING",
  "CRON_SECRET",
  "LOCAL_AUTH_EMAIL",
  "LOCAL_AUTH_PASSWORD",
]) {
  verify(
    new RegExp(`^${variableName}=$`, "m").test(exampleEnvironment),
    `.env.example içinde ${variableName} değeri boş bırakılmalıdır.`,
  );
}

const gitignore = readRepositoryFile(".gitignore");
verify(
  /^\.env\*$/m.test(gitignore) && /^!\.env\.example$/m.test(gitignore),
  "Gerçek ortam dosyaları Git tarafından dışlanmalıdır.",
);

const supabaseConfig = readRepositoryFile("supabase/config.toml");
verify(
  /^\[auth\][\s\S]*?^enable_signup = false$/m.test(supabaseConfig),
  "Herkese açık Auth kaydı kapalı olmalıdır.",
);
verify(
  /^enable_anonymous_sign_ins = false$/m.test(supabaseConfig),
  "Anonim oturum kapalı olmalıdır.",
);
verify(
  /^\[auth\.sms\][\s\S]*?^enable_signup = false$/m.test(supabaseConfig),
  "SMS ile kayıt kapalı olmalıdır.",
);
verify(
  /^\[auth\.sms\.twilio\][\s\S]*?^enabled = false$/m.test(supabaseConfig),
  "SMS sağlayıcısı kapalı olmalıdır.",
);

const migrationFiles = readdirSync(
  new URL("supabase/migrations/", repositoryUrl),
).filter((fileName) => fileName.endsWith(".sql"));
const databaseTestFiles = readdirSync(
  new URL("supabase/tests/", repositoryUrl),
).filter((fileName) => fileName.endsWith(".test.sql"));
const databaseTestNumbers = databaseTestFiles
  .map((fileName) => Number(fileName.slice(0, 4)))
  .sort((left, right) => left - right);
const seed = readRepositoryFile("supabase/seed.sql");
const schemaVersionMatch = seed.match(/schema_version[\s\S]*?values\s*\(\s*true,\s*(\d+)/i);
const schemaVersion = Number(schemaVersionMatch?.[1]);

verify(
  migrationFiles.length >= databaseTestFiles.length,
  "Migration sayısı sürümlü pgTAP dilimlerinden az olamaz.",
);
verify(
  Number.isInteger(schemaVersion) &&
    databaseTestFiles.length === schemaVersion &&
    databaseTestNumbers.every((number, index) => number === index + 1),
  "Seed şema sürümü kesintisiz numaralanmış pgTAP test dilimleriyle aynı olmalıdır.",
);

const policy = JSON.parse(readRepositoryFile("config/release-policy.json"));
const expectedGateIds = [
  "secret-manager",
  "data-region-kvkk",
  "backup-restore",
  "sensitive-media-location",
];
const policyGateIds = Array.isArray(policy.manualGates)
  ? policy.manualGates.map((gate) => gate?.id)
  : [];

verify(policy.version === "release-v2", "Release politikası sürümü geçersiz.");
verify(
  policy.defaultDecision === "blocked-until-approved",
  "Canlı PII release politikası varsayılan olarak kapalı olmalıdır.",
);
verify(
  JSON.stringify(policyGateIds) === JSON.stringify(expectedGateIds),
  "Release politikası dört zorunlu manuel kanıt kapısını sırasıyla içermelidir.",
);

for (const gate of policy.manualGates ?? []) {
  verify(
    gate?.status === "open" ||
      (gate?.status === "approved" &&
        typeof gate?.evidence?.reference === "string" &&
        typeof gate?.evidence?.approvedAt === "string" &&
        typeof gate?.evidence?.approvedByRole === "string"),
    `Release kapısı ${String(gate?.id)} açık olmalı veya eksiksiz kanıt taşımalıdır.`,
  );
}

const workflowPath = new URL(
  ".github/workflows/security-release-gate.yml",
  repositoryUrl,
);
verify(existsSync(workflowPath), "Güvenlik/release CI workflow'u eksik.");

if (existsSync(workflowPath)) {
  const workflow = readFileSync(workflowPath, "utf8");

  verify(
    /^permissions:\s*\n\s+contents: read$/m.test(workflow),
    "CI token yetkisi yalnız contents: read olmalıdır.",
  );
  verify(
    !workflow.includes("pull_request_target"),
    "Release workflow'u pull_request_target kullanmamalıdır.",
  );
  const actionReferences = [
    ...workflow.matchAll(/^\s+uses:\s+\S+@([^\s#]+)/gm),
  ].map((match) => match[1]);
  verify(
    actionReferences.length > 0 &&
      actionReferences.every((reference) => /^[a-f0-9]{40}$/.test(reference)),
    "CI action'ları değişmez 40 karakterli commit SHA ile sabitlenmelidir.",
  );
  verify(
    workflow.includes("pnpm release:verify"),
    "CI teknik release kapısını çalıştırmalıdır.",
  );
  verify(
    workflow.includes("pnpm release:assert-live-pii"),
    "Manuel canlı PII workflow'u kanıt kapısını çalıştırmalıdır.",
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`Release sınırı hatası: ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log(
    `Release sınırı doğrulandı: ${migrationFiles.length} migration, ${databaseTestFiles.length} pgTAP dilimi ve 4 manuel kanıt kapısı.`,
  );
}
