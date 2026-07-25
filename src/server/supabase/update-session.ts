import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerConfig } from "./environment";
import type { Database } from "@/types/database.generated";

const privatePathPrefixes = ["/workspace", "/api/workspace"];
const privateBrowserPathPrefixes = ["/workspace"];

export async function updateSupabaseSession(request: NextRequest) {
  const configuration = getSupabaseServerConfig();
  const isPrivatePath = privatePathPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );
  const isPrivateBrowserPath = privateBrowserPathPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );
  let response = NextResponse.next({ request });

  if (!configuration.ok) {
    if (isPrivatePath) {
      response.headers.set("Cache-Control", "private, no-store");
    }

    return response;
  }

  const supabase = createServerClient<Database>(
    configuration.data.SUPABASE_URL,
    configuration.data.SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Cookie yenileme ile kullanıcı doğrulaması arasına başka Supabase işlemi eklenmemelidir.
  let claimsResult;

  try {
    claimsResult = await supabase.auth.getClaims();
  } catch {
    if (isPrivatePath) {
      response.headers.set("Cache-Control", "private, no-store");
    }

    return response;
  }

  if (
    isPrivateBrowserPath &&
    (claimsResult.error || !claimsResult.data?.claims)
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/giris";
    redirectUrl.search = "";

    const redirectResponse = NextResponse.redirect(redirectUrl);
    redirectResponse.headers.set("Cache-Control", "private, no-store");

    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    return redirectResponse;
  }

  if (isPrivatePath) {
    response.headers.set("Cache-Control", "private, no-store");
  }

  return response;
}
