import type { NextRequest } from "next/server";

import { updateSupabaseSession } from "@/server/supabase/update-session";

export async function proxy(request: NextRequest) {
  const response = await updateSupabaseSession(request);

  if (request.nextUrl.pathname.startsWith("/workspace/ekle/saha")) {
    response.headers.set(
      "Permissions-Policy",
      "camera=(self), microphone=(), geolocation=(self)",
    );
    response.headers.set("Cache-Control", "private, no-store");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline.html|api/system/status|api/system/database|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
