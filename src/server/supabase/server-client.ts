import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseServerConfig } from "./environment";
import type { Database } from "@/types/database.generated";

export type ServerSupabaseClientResult =
  | {
      ok: true;
      client: ReturnType<typeof createServerClient<Database>>;
    }
  | {
      ok: false;
      error: {
        code: "AUTH_SERVICE_UNAVAILABLE";
        message: string;
      };
    };

export async function createSessionSupabaseClient(): Promise<ServerSupabaseClientResult> {
  const configuration = getSupabaseServerConfig();

  if (!configuration.ok) {
    return {
      ok: false,
      error: {
        code: "AUTH_SERVICE_UNAVAILABLE",
        message: "Giriş servisi şu anda kullanılamıyor. Lütfen daha sonra yeniden deneyin.",
      },
    };
  }

  const cookieStore = await cookies();

  return {
    ok: true,
    client: createServerClient<Database>(
      configuration.data.SUPABASE_URL,
      configuration.data.SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              for (const { name, value, options } of cookiesToSet) {
                cookieStore.set(name, value, options);
              }
            } catch {
              // Server Component'ler cookie yazamaz. Oturum yenilemesini proxy üstlenir.
            }
          },
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
