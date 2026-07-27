import { spawnSync } from "node:child_process";
import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const required = [
  "PRODUCTION_DATABASE_URL",
  "PRODUCTION_SUPABASE_URL",
  "PRODUCTION_SUPABASE_SERVICE_ROLE_KEY",
  "AGE_BACKUP_RECIPIENT",
  "BACKUP_OUTPUT_PATH",
];

for (const name of required) {
  if (!process.env[name]) {
    process.stderr.write("Şifreli yedek yapılandırması eksik.\n");
    process.exit(1);
  }
}

const workDirectory = mkdtempSync(
  path.join(tmpdir(), "portfoy-radar-backup-"),
);
const archiveRoot = path.join(workDirectory, "archive");
const storageRoot = path.join(archiveRoot, "storage");
const databasePath = path.join(archiveRoot, "database.dump");
const archivePath = path.join(workDirectory, `${randomUUID()}.tar`);
const outputPath = path.resolve(process.env.BACKUP_OUTPUT_PATH);

function fail() {
  process.stderr.write("Şifreli Production yedeği oluşturulamadı.\n");
  rmSync(workDirectory, { force: true, recursive: true });
  process.exit(1);
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

async function listStorageObjects(client, prefix = "") {
  const response = await client.storage
    .from("field-observation-media")
    .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });

  if (response.error || !response.data) {
    fail();
  }

  const objects = [];

  for (const entry of response.data) {
    const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.id) {
      objects.push(objectPath);
    } else {
      objects.push(...(await listStorageObjects(client, objectPath)));
    }
  }

  return objects;
}

try {
  mkdirSync(storageRoot, { recursive: true });
  const dump = spawnSync(
    "pg_dump",
    [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--file",
      databasePath,
      process.env.PRODUCTION_DATABASE_URL,
    ],
    { stdio: ["ignore", "ignore", "ignore"] },
  );

  if (dump.status !== 0) {
    fail();
  }

  const client = createClient(
    process.env.PRODUCTION_SUPABASE_URL,
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const objectPaths = await listStorageObjects(client);
  const files = [
    {
      path: "database.dump",
      sha256: sha256(databasePath),
    },
  ];

  for (const objectPath of objectPaths) {
    const download = await client.storage
      .from("field-observation-media")
      .download(objectPath);

    if (download.error || !download.data) {
      fail();
    }

    const targetPath = path.join(storageRoot, objectPath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, Buffer.from(await download.data.arrayBuffer()), {
      mode: 0o600,
    });
    files.push({
      path: `storage/${objectPath}`,
      sha256: sha256(targetPath),
    });
  }

  writeFileSync(
    path.join(archiveRoot, "manifest.json"),
    `${JSON.stringify(
      {
        format: "portfoy-radar-encrypted-backup-v1",
        createdAt: new Date().toISOString(),
        files,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );

  const tar = spawnSync(
    "tar",
    ["-C", archiveRoot, "-cf", archivePath, "."],
    { stdio: ["ignore", "ignore", "ignore"] },
  );

  if (tar.status !== 0) {
    fail();
  }

  const age = spawnSync(
    "age",
    [
      "--recipient",
      process.env.AGE_BACKUP_RECIPIENT,
      "--output",
      outputPath,
      archivePath,
    ],
    { stdio: ["ignore", "ignore", "ignore"] },
  );

  if (age.status !== 0) {
    fail();
  }

  process.stdout.write("Production yedeği yalnız age şifreli artifact olarak hazırlandı.\n");
} finally {
  rmSync(workDirectory, { force: true, recursive: true });
}
