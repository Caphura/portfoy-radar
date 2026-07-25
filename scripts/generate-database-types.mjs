import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const supabaseExecutable = path.join(
  repositoryRoot,
  "node_modules",
  ".bin",
  "supabase",
);
const result = spawnSync(
  supabaseExecutable,
  ["gen", "types", "typescript", "--local", "--schema", "public"],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
);

if (result.status !== 0 || !result.stdout.trim()) {
  process.stderr.write("Veritabanı tipleri yerel şemadan üretilemedi.\n");
  process.exit(1);
}

writeFileSync(
  path.join(repositoryRoot, "src", "types", "database.generated.ts"),
  `${result.stdout.trimEnd()}\n`,
  "utf8",
);

process.stdout.write("Veritabanı TypeScript tipleri güncellendi.\n");
