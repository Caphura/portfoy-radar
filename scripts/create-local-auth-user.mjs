import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";

import { createClient } from "@supabase/supabase-js";

import { getLocalSupabaseSettings } from "./local-supabase-settings.mjs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readLocalEnvironment() {
  let contents = "";

  try {
    contents = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  } catch {
    fail(".env.local okunamadı. Önce yerel ortam değişkenlerini hazırlayın.");
  }

  const values = new Map();

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);

    if (match) {
      values.set(match[1], match[2]);
    }
  }

  return values;
}

async function promptForEmail() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail(
      "LOCAL_AUTH_EMAIL eksik. Etkileşimsiz kullanımda değeri ortam değişkeni olarak sağlayın.",
    );
  }

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const value = await prompt.question("Yerel giriş e-postası: ");
  prompt.close();

  return value;
}

async function promptForHiddenPassword() {
  if (
    !process.stdin.isTTY ||
    !process.stdout.isTTY ||
    typeof process.stdin.setRawMode !== "function"
  ) {
    fail(
      "LOCAL_AUTH_PASSWORD eksik. Etkileşimsiz kullanımda değeri ortam değişkeni olarak sağlayın.",
    );
  }

  process.stdout.write("Yerel giriş parolası (ekranda görünmez): ");
  process.stdin.setEncoding("utf8");
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";

    function finish() {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    }

    function onData(chunk) {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish();
          reject(new Error("İşlem iptal edildi."));
          return;
        }

        if (character === "\r" || character === "\n") {
          finish();
          resolve(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        if (character >= " ") {
          value += character;
        }
      }
    }

    process.stdin.on("data", onData);
  });
}

const environment = readLocalEnvironment();
const configuredEmail =
  process.env.LOCAL_AUTH_EMAIL ?? environment.get("LOCAL_AUTH_EMAIL");
const configuredPassword =
  process.env.LOCAL_AUTH_PASSWORD ?? environment.get("LOCAL_AUTH_PASSWORD");

let email = configuredEmail?.trim();
let password = configuredPassword;

if (!email) {
  email = (await promptForEmail()).trim();
}

if (!password) {
  try {
    password = await promptForHiddenPassword();
  } catch (error) {
    fail(error instanceof Error ? error.message : "İşlem iptal edildi.");
  }
}

if (
  !email ||
  email.length > 254 ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
) {
  fail("LOCAL_AUTH_EMAIL geçerli bir e-posta adresi olmalıdır.");
}

if (
  !password ||
  password.length < 12 ||
  !/[a-z]/.test(password) ||
  !/[A-Z]/.test(password) ||
  !/[0-9]/.test(password)
) {
  fail(
    "LOCAL_AUTH_PASSWORD en az 12 karakter, küçük/büyük harf ve rakam içermelidir.",
  );
}

let settings;

try {
  settings = getLocalSupabaseSettings();
} catch (error) {
  fail(error instanceof Error ? error.message : "Yerel Supabase kullanılamıyor.");
}

const admin = createClient(settings.url, settings.secretKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const { error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  fail("Yerel davetli kullanıcı oluşturulamadı. Bilgileri ve servisi kontrol edin.");
}

process.stdout.write(
  "Yerel davetli kullanıcı oluşturuldu. Bilgiler terminale yazdırılmadı.\n",
);
