import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { SupabaseServerConfig } from "./environment";
import type { Database } from "@/types/database.generated";

export function createServerSupabaseClient(config: SupabaseServerConfig) {
  return createClient<Database>(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
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
  );
}
