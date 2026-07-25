import "server-only";

import { createSessionSupabaseClient } from "@/server/supabase/server-client";

export type CurrentUserResult =
  | {
      ok: true;
      user: {
        id: string;
      };
    }
  | {
      ok: false;
      error: {
        code: "UNAUTHENTICATED" | "AUTH_SERVICE_UNAVAILABLE";
        message: string;
      };
    };

export async function getCurrentUser(): Promise<CurrentUserResult> {
  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return clientResult;
  }

  const {
    data: { user },
    error,
  } = await clientResult.client.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Devam etmek için giriş yapın.",
      },
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
    },
  };
}
