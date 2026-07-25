import "server-only";

import { createServerSupabaseClient } from "@/server/supabase/client";
import { getSupabaseServerConfig } from "@/server/supabase/environment";

import {
  resolveDatabaseStatus,
  type DatabaseStatusResult,
} from "./database-status-core";

export async function getDatabaseStatus(): Promise<DatabaseStatusResult> {
  const configuration = getSupabaseServerConfig();

  if (!configuration.ok) {
    return configuration;
  }

  const supabase = createServerSupabaseClient(configuration.data);

  return resolveDatabaseStatus(async () => {
    const { data, error } = await supabase
      .from("app_public_config")
      .select("schema_version, locale, time_zone, default_currency")
      .limit(1)
      .maybeSingle();

    return { data, error };
  });
}
