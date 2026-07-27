import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminConfig } from "./environment";

export type AdminSupabaseClientResult =
  | {
      ok: true;
      client: ReturnType<typeof createClient>;
    }
  | {
      ok: false;
      error: {
        code: "DATABASE_ADMIN_NOT_CONFIGURED";
        message: string;
      };
    };

export function createAdminSupabaseClient(): AdminSupabaseClientResult {
  const configuration = getSupabaseAdminConfig();

  if (!configuration.ok) {
    return configuration;
  }

  return {
    ok: true,
    client: createClient(
      configuration.data.SUPABASE_URL,
      configuration.data.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
        global: {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              cache: "no-store",
            }),
        },
      },
    ),
  };
}
