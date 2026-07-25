import { randomBytes, randomUUID } from "node:crypto";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

import { getLocalSupabaseSettings } from "./local-supabase-settings.mjs";

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createSupabaseClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function signInWithRetry(client, credential) {
  let lastResult;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    lastResult = await client.auth.signInWithPassword(credential);

    if (!lastResult.error) {
      return lastResult;
    }

    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }

  return lastResult;
}

let settings;

try {
  settings = getLocalSupabaseSettings();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Yerel Supabase kullanılamıyor."}\n`,
  );
  process.exit(1);
}

const admin = createSupabaseClient(settings.url, settings.secretKey);
const anonymous = createSupabaseClient(settings.url, settings.publishableKey);
const suffix = randomUUID();
const credentials = [
  {
    email: `auth-a-${suffix}@example.invalid`,
    password: `A1a!${randomBytes(18).toString("base64url")}`,
  },
  {
    email: `auth-b-${suffix}@example.invalid`,
    password: `B2b!${randomBytes(18).toString("base64url")}`,
  },
];
const publicSignupCredential = {
  email: `public-signup-${suffix}@example.invalid`,
  password: `C3c!${randomBytes(18).toString("base64url")}`,
};
const createdUserIds = [];
const createdWorkspaceIds = [];
let failure;

try {
  const publicSignup = await anonymous.auth.signUp(publicSignupCredential);
  ensure(
    Boolean(publicSignup.error) && !publicSignup.data.user,
    "Herkese açık kayıt engellenmedi.",
  );

  const userClients = [];

  for (const credential of credentials) {
    const created = await admin.auth.admin.createUser({
      email: credential.email,
      password: credential.password,
      email_confirm: true,
    });
    ensure(!created.error && created.data.user, "Test kullanıcısı oluşturulamadı.");
    createdUserIds.push(created.data.user.id);

    const client = createSupabaseClient(settings.url, settings.publishableKey);
    const signedIn = await signInWithRetry(client, credential);
    ensure(
      !signedIn?.error,
      `Test kullanıcısı giriş yapamadı (${
        signedIn?.error?.code ?? "AUTH_ERROR"
      }).`,
    );
    userClients.push(client);
  }

  const firstBootstrap = await userClients[0].rpc("bootstrap_workspace", {
    requested_name: "Test Workspace A",
  });
  ensure(
    !firstBootstrap.error && firstBootstrap.data?.length === 1,
    "Birinci workspace oluşturulamadı.",
  );
  createdWorkspaceIds.push(firstBootstrap.data[0].workspace_id);

  const secondBootstrap = await userClients[1].rpc("bootstrap_workspace", {
    requested_name: "Test Workspace B",
  });
  ensure(
    !secondBootstrap.error && secondBootstrap.data?.length === 1,
    "İkinci workspace oluşturulamadı.",
  );
  createdWorkspaceIds.push(secondBootstrap.data[0].workspace_id);

  const firstVisibleWorkspaces = await userClients[0]
    .from("workspaces")
    .select("id");
  ensure(
    !firstVisibleWorkspaces.error &&
      firstVisibleWorkspaces.data?.length === 1 &&
      firstVisibleWorkspaces.data[0]?.id === createdWorkspaceIds[0],
    "Workspace yatay izolasyonu başarısız.",
  );

  const crossWorkspaceRead = await userClients[0]
    .from("workspaces")
    .select("id")
    .eq("id", createdWorkspaceIds[1]);
  ensure(
    !crossWorkspaceRead.error && crossWorkspaceRead.data?.length === 0,
    "Başka workspace okuması engellenmedi.",
  );

  const ownerUpdate = await userClients[0]
    .from("workspaces")
    .update({ name: "Test Workspace A Güncel" })
    .eq("id", createdWorkspaceIds[0])
    .select("id, name");
  ensure(
    !ownerUpdate.error &&
      ownerUpdate.data?.length === 1 &&
      ownerUpdate.data[0]?.name === "Test Workspace A Güncel",
    "Owner workspace güncellemesi tamamlanamadı.",
  );

  const safeAccessView = await userClients[0]
    .from("current_workspace_access")
    .select("workspace_id, workspace_name, membership_role");
  ensure(
    !safeAccessView.error &&
      safeAccessView.data?.length === 1 &&
      safeAccessView.data[0]?.workspace_id === createdWorkspaceIds[0] &&
      safeAccessView.data[0]?.workspace_name === "Test Workspace A Güncel" &&
      safeAccessView.data[0]?.membership_role === "owner",
    "RLS-aware workspace erişim görünümü doğrulanamadı.",
  );

  const duplicateBootstrap = await userClients[0].rpc("bootstrap_workspace", {
    requested_name: "İkinci Kurulum",
  });
  ensure(
    Boolean(duplicateBootstrap.error),
    "İkinci workspace kurulumu engellenmedi.",
  );

  const anonymousBootstrap = await anonymous.rpc("bootstrap_workspace", {
    requested_name: "Anon Kurulum",
  });
  ensure(
    Boolean(anonymousBootstrap.error),
    "Oturumsuz workspace kurulumu engellenmedi.",
  );

  const roleUpdate = await admin
    .from("workspace_members")
    .update({ role: "viewer" })
    .eq("workspace_id", createdWorkspaceIds[1])
    .eq("user_id", createdUserIds[1]);
  ensure(!roleUpdate.error, "Rol testi hazırlanamadı.");

  const viewerUpdate = await userClients[1]
    .from("workspaces")
    .update({ name: "Yetkisiz Güncelleme" })
    .eq("id", createdWorkspaceIds[1])
    .select("id");
  ensure(
    !viewerUpdate.error && viewerUpdate.data?.length === 0,
    "Yetersiz rol güncellemesi engellenmedi.",
  );
} catch (error) {
  failure =
    error instanceof Error
      ? error.message
      : "Auth/workspace doğrulaması tamamlanamadı.";
} finally {
  for (const workspaceId of createdWorkspaceIds) {
    const result = await admin.from("workspaces").delete().eq("id", workspaceId);

    if (result.error && !failure) {
      failure = "Test workspace temizliği tamamlanamadı.";
    }
  }

  for (const userId of createdUserIds) {
    const result = await admin.auth.admin.deleteUser(userId);

    if (result.error && !failure) {
      failure = "Test kullanıcı temizliği tamamlanamadı.";
    }
  }
}

if (failure) {
  process.stderr.write(`${failure}\n`);
  process.exit(1);
}

process.stdout.write(
  "Yerel Auth, owner yazması, viewer reddi ve iki-workspace RLS izolasyonu doğrulandı.\n",
);
